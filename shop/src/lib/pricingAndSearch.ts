import { slugifyVi, stripVietnameseDiacritics } from "@/lib/format";
import type { ProductListItem, ProductVariant } from "@/types/storefront";

export interface BulkTierInput {
  minQty: number;
  unitPrice: number;
  label?: string;
}

export interface GiftTierInput {
  minQty: number;
  rewardTitle: string;
  estimatedValueVnd: number;
}

export const DEFAULT_GIFT_TIERS: GiftTierInput[] = [
  {
    minQty: 5,
    rewardTitle: "Mua 5 sản phẩm → Tặng 1 áo 11Sport Dry-Fit",
    estimatedValueVnd: 350_000,
  },
  {
    minQty: 10,
    rewardTitle: "Mua 10 sản phẩm → Tặng 2 áo + 1 túi 11Sport Tour",
    estimatedValueVnd: 1_150_000,
  },
];

export interface PerVariantCartLineInput {
  productId: string;
  variantKey: string;
  quantity: number;
  regularPrice: number;
  bulkTiers?: BulkTierInput[];
}

export interface CalculatedVariantLine {
  productId: string;
  variantKey: string;
  quantity: number;
  regularUnitPrice: number;
  effectiveUnitPrice: number;
  appliedBulkTierMinQty: number | null;
  lineSubtotal: number;
  lineSaved: number;
}

export interface PerVariantCartPricingResult {
  lines: CalculatedVariantLine[];
  totalQuantity: number;
  regularSubtotal: number;
  subtotal: number;
  bulkDiscountSaved: number;
  shippingFee: number;
  totalPayable: number;
  unlockedGift: GiftTierInput | null;
  nextGiftTier: {
    minQty: number;
    itemsNeeded: number;
    rewardTitle: string;
  } | null;
}

/**
 * Builds a single deterministic variantId (`${productId}::${resolvedVariantKey}`)
 * shared across ProductCard quick-add and ProductDetailClient add-to-cart so items
 * added from either surface merge into the same variant line and trigger 3+ / 5+ bulk tiers.
 */
export function buildCartVariantId(
  productId: string,
  options?: {
    variantKey?: string;
    colorName?: string;
    size?: string;
    variants?: ProductVariant[];
  }
): string {
  if (options?.variantKey) {
    return `${productId}::${options.variantKey}`;
  }
  const variants = options?.variants ?? [];
  if (options?.colorName && variants.length > 0) {
    const matched = variants.find(
      (v) =>
        v.color?.toLowerCase() === options.colorName?.toLowerCase() &&
        (!options.size || v.size === options.size)
    );
    if (matched?.variantKey) {
      return `${productId}::${matched.variantKey}`;
    }
  }
  if (variants[0]?.variantKey) {
    return `${productId}::${variants[0].variantKey}`;
  }
  const fallbackKey = options?.colorName
    ? slugifyVi(options.colorName)
    : "default";
  return `${productId}::${fallbackKey}`;
}

/**
 * Evaluates mipik.vn exact tiered pricing rules:
 * 1. Bulk pricing (`GIÁ MUA NHIỀU`) aggregates PER VARIANT (`productId::variantKey`).
 *    When a variant's quantity meets a tier threshold (3+ or 5+), the highest matching
 *    tier unitPrice replaces the retail/sale unit price (non-stacking).
 * 2. Free gifts (`QUÀ TẶNG KÈM THEO`) aggregate across total cart quantity (5+ or 10+)
 *    and unlock ONLY the highest reached tier (non-stacking).
 */
export function calculatePerVariantCartPricing(
  rawLines: PerVariantCartLineInput[],
  giftTiers: GiftTierInput[] = DEFAULT_GIFT_TIERS
): PerVariantCartPricingResult {
  const merged = new Map<string, PerVariantCartLineInput>();

  for (const line of rawLines) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const key = `${line.productId}::${line.variantKey}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      merged.set(key, { ...line, quantity: qty });
    }
  }

  const lines: CalculatedVariantLine[] = [];
  let totalQuantity = 0;
  let regularSubtotal = 0;
  let subtotal = 0;

  for (const item of Array.from(merged.values())) {
    const sortedTiers = [...(item.bulkTiers ?? [])]
      .filter((t) => t.unitPrice > 0)
      .sort((a, b) => b.minQty - a.minQty);
    const matchedTier =
      sortedTiers.find((t) => item.quantity >= t.minQty) ?? null;
    const effectiveUnitPrice = matchedTier
      ? matchedTier.unitPrice
      : item.regularPrice;

    const lineReg = item.regularPrice * item.quantity;
    const lineSub = effectiveUnitPrice * item.quantity;
    const lineSaved = Math.max(0, lineReg - lineSub);

    lines.push({
      productId: item.productId,
      variantKey: item.variantKey,
      quantity: item.quantity,
      regularUnitPrice: item.regularPrice,
      effectiveUnitPrice,
      appliedBulkTierMinQty: matchedTier ? matchedTier.minQty : null,
      lineSubtotal: lineSub,
      lineSaved,
    });

    totalQuantity += item.quantity;
    regularSubtotal += lineReg;
    subtotal += lineSub;
  }

  const bulkDiscountSaved = Math.max(0, regularSubtotal - subtotal);

  const ascGifts = [...giftTiers].sort((a, b) => a.minQty - b.minQty);
  let unlockedGift: GiftTierInput | null = null;
  let nextGiftTier: PerVariantCartPricingResult["nextGiftTier"] = null;

  for (const g of ascGifts) {
    if (totalQuantity >= g.minQty) {
      unlockedGift = g;
    } else if (!nextGiftTier) {
      nextGiftTier = {
        minQty: g.minQty,
        itemsNeeded: g.minQty - totalQuantity,
        rewardTitle: g.rewardTitle,
      };
    }
  }

  return {
    lines,
    totalQuantity,
    regularSubtotal,
    subtotal,
    bulkDiscountSaved,
    shippingFee: 0,
    totalPayable: subtotal,
    unlockedGift,
    nextGiftTier,
  };
}

/**
 * Deterministic Vietnamese diacritic-insensitive product search ranker.
 */
export function rankStorefrontProducts<
  T extends Pick<
    ProductListItem,
    "_id" | "code" | "name" | "slug" | "brand" | "category" | "isFeatured"
  >
>(products: T[], rawQuery: string): T[] {
  const normQuery = stripVietnameseDiacritics(rawQuery);
  if (!normQuery) return [];

  const tokens = normQuery.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const cleanPhrase = tokens.join(" ");

  const scored: Array<{ item: T; score: number }> = [];

  for (const item of products) {
    let score = 0;
    const skuNorm = stripVietnameseDiacritics(item.code);
    const nameNorm = stripVietnameseDiacritics(item.name);
    const slugNorm = stripVietnameseDiacritics(item.slug.replace(/-/g, " "));
    const brandNorm = stripVietnameseDiacritics(
      item.brand?.name || item.brand?.slug || ""
    );
    const catNorm = stripVietnameseDiacritics(
      item.category?.name || item.category?.slug || ""
    );

    if (skuNorm === normQuery || skuNorm === cleanPhrase) score += 200;
    else if (skuNorm.includes(cleanPhrase)) score += 100;

    if (nameNorm.includes(cleanPhrase)) score += 90;

    let hitCount = 0;
    for (const tk of tokens) {
      let hit = false;
      if (nameNorm.includes(tk)) {
        score += 30;
        hit = true;
      }
      if (slugNorm.includes(tk) || brandNorm.includes(tk)) {
        score += 20;
        hit = true;
      }
      if (catNorm.includes(tk)) {
        score += 10;
        hit = true;
      }
      if (hit) hitCount += 1;
    }

    if (hitCount === tokens.length && tokens.length > 1) {
      score += 45;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        Number(Boolean(b.item.isFeatured)) - Number(Boolean(a.item.isFeatured))
      );
    })
    .map((entry) => entry.item);
}

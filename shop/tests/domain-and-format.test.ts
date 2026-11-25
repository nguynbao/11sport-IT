import { describe, expect, it } from "vitest";
import {
  calcDiscountPercent,
  formatPriceByCurrency,
  formatVND,
  resolveMediaUrl,
  stripVietnameseDiacritics,
} from "@/lib/format";
import {
  buildCartVariantId,
  calculatePerVariantCartPricing,
  rankStorefrontProducts,
} from "@/lib/pricingAndSearch";
import {
  extractHeadingsFromHtml,
  injectHeadingIds,
} from "@/lib/articleHtml";
import { normalizeProductPromotions } from "@/lib/storefront";
import type { ProductDetail } from "@/types/storefront";

describe("Shop Domain · Formatting, Per-Variant Bulk Pricing & Vietnamese Search", () => {
  it("resolves local /images/mock/* SVG assets while keeping formatVND & USD conversion accurate", () => {
    expect(resolveMediaUrl("/images/mock/paddle-joola-red.svg")).toBe(
      "/images/mock/paddle-joola-red.svg"
    );
    expect(formatVND(5_100_000)).toContain("5.100.000");
    expect(formatPriceByCurrency(5_000_000, "USD")).toContain("$");
    expect(calcDiscountPercent(5_100_000, 5_300_000)).toBe(4);
    expect(stripVietnameseDiacritics("Vợt Pickleball Độc Quyền")).toBe(
      "vot pickleball doc quyen"
    );
  });

  it("Review Focus #2: evaluates bulk tier pricing PER VARIANT (3+ / 5+ cùng biến thể) and awards non-stacking cart gifts at 5+ and 10+ total items", () => {
    const tiers = [
      { minQty: 3, unitPrice: 5_000_000, label: "Mua từ 3 sản phẩm cùng biến thể" },
      { minQty: 5, unitPrice: 4_900_000, label: "Mua từ 5 sản phẩm cùng biến thể" },
    ];

    const mixed4 = calculatePerVariantCartPricing([
      {
        productId: "p-joola",
        variantKey: "red-16mm",
        quantity: 2,
        regularPrice: 5_100_000,
        bulkTiers: tiers,
      },
      {
        productId: "p-joola",
        variantKey: "mint-14mm",
        quantity: 2,
        regularPrice: 5_100_000,
        bulkTiers: tiers,
      },
    ]);
    expect(mixed4.lines[0]?.effectiveUnitPrice).toBe(5_100_000);
    expect(mixed4.lines[1]?.effectiveUnitPrice).toBe(5_100_000);
    expect(mixed4.totalQuantity).toBe(4);
    expect(mixed4.unlockedGift).toBeNull();
    expect(mixed4.nextGiftTier?.itemsNeeded).toBe(1);

    const mixed5 = calculatePerVariantCartPricing([
      {
        productId: "p-joola",
        variantKey: "red-16mm",
        quantity: 3,
        regularPrice: 5_100_000,
        bulkTiers: tiers,
      },
      {
        productId: "p-joola",
        variantKey: "mint-14mm",
        quantity: 2,
        regularPrice: 5_100_000,
        bulkTiers: tiers,
      },
    ]);
    expect(mixed5.lines[0]?.effectiveUnitPrice).toBe(5_000_000);
    expect(mixed5.lines[1]?.effectiveUnitPrice).toBe(5_100_000);
    expect(mixed5.bulkDiscountSaved).toBe(300_000);
    expect(mixed5.unlockedGift?.minQty).toBe(5);

    const tier10 = calculatePerVariantCartPricing([
      {
        productId: "p-joola",
        variantKey: "red-16mm",
        quantity: 10,
        regularPrice: 5_100_000,
        bulkTiers: tiers,
      },
    ]);
    expect(tier10.lines[0]?.effectiveUnitPrice).toBe(4_900_000);
    expect(tier10.unlockedGift?.minQty).toBe(10);
  });

  it("Critical #2: produces identical canonical cart variantId from both ProductCard color selection and PDP variant selection", () => {
    const product = {
      _id: "prod-joola-perseus-fx",
      variants: [
        {
          variantKey: "blaze-red-16mm",
          variantCode: "JL-PER-RED-16",
          color: "Blaze Red",
          size: "16mm (Control)",
          effectiveSellingPrice: 5_100_000,
          stockAvailable: 15,
          inStock: true,
        },
      ],
    };

    const fromCard = buildCartVariantId(product._id, {
      colorName: "Blaze Red",
      variants: product.variants,
    });
    const fromPdp = buildCartVariantId(product._id, {
      variantKey: "blaze-red-16mm",
      variants: product.variants,
    });
    expect(fromCard).toBe("prod-joola-perseus-fx::blaze-red-16mm");
    expect(fromPdp).toBe("prod-joola-perseus-fx::blaze-red-16mm");
  });

  it("Review Focus #3 & Important #5: ranks 'Joola Perseus Power FX' #1 for accent-free and punctuation-separated queries", () => {
    const items = [
      {
        _id: "1",
        code: "KM-ALPHA",
        name: "Vợt Pickleball Kamito Alpha",
        slug: "vot-pickleball-kamito-alpha",
        sellingPrice: 2_190_000,
        inStock: true,
      },
      {
        _id: "2",
        code: "JL-PERSEUS-FX",
        name: "Vợt Pickleball Joola Perseus Power FX 16mm",
        slug: "joola-perseus-power-fx",
        sellingPrice: 5_100_000,
        inStock: true,
      },
      {
        _id: "3",
        code: "JL-HYP-3S",
        name: "Vợt Pickleball Joola Hyperion 3S",
        slug: "vot-pickleball-joola-hyperion-3s",
        sellingPrice: 5_200_000,
        inStock: true,
      },
    ];
    expect(rankStorefrontProducts(items, "vot joola perseus")[0]?.slug).toBe(
      "joola-perseus-power-fx"
    );
    expect(rankStorefrontProducts(items, "joola, perseus!")[0]?.slug).toBe(
      "joola-perseus-power-fx"
    );
    expect(rankStorefrontProducts(items, "   ")).toEqual([]);
  });

  it("Important #4: injects matching id='sec-N' attributes into article HTML headings for TOC anchor links", () => {
    const rawHtml = "<h2>1. Quy tắc giao bóng</h2><p>Nội dung</p><h3>Chi tiết</h3>";
    const headings = extractHeadingsFromHtml(rawHtml);
    const injected = injectHeadingIds(rawHtml);
    expect(headings).toHaveLength(2);
    expect(injected).toContain('id="sec-1"');
    expect(injected).toContain('id="sec-2"');
  });

  it("formats VND, PHP (₱), and USD ($) currencies and normalizes BE tierPricing & giftPromotions", () => {
    expect(formatPriceByCurrency(4_400_000, "PHP")).toContain("₱");
    expect(formatPriceByCurrency(4_400_000, "PHP")).toContain("10");
    expect(formatPriceByCurrency(5_000_000, "USD")).toContain("$");
    expect(formatPriceByCurrency(5_000_000, "VND")).toContain("5.000.000");

    const rawDetail = {
      _id: "p-be-1",
      code: "BE-1",
      name: "Vợt Pickleball Test BE",
      slug: "vot-pickleball-test-be",
      sellingPrice: 1_000_000,
      inStock: true,
      variants: [],
      promotions: {
        tierPricing: [
          { minQty: 2, discountType: "AMOUNT", discountValue: 100_000 },
          { minQty: 5, discountType: "PERCENT", discountValue: 20 },
        ],
        giftPromotions: [
          {
            _id: "gp-be-1",
            name: "Mua 2 tặng quấn cán",
            minQuantity: 2,
            gifts: [
              {
                productId: "gift-1",
                productName: "Quấn cán 11Sport",
                quantity: 1,
              },
            ],
          },
        ],
      },
    } as unknown as ProductDetail;

    const normalized = normalizeProductPromotions(rawDetail);
    expect(normalized.promotions?.tierPricing).toHaveLength(2);
    expect(normalized.promotions?.tierPricing?.[0]?.discountAmount).toBe(100_000);
    expect(normalized.promotions?.tierPricing?.[1]?.discountPercent).toBe(20);
    expect(normalized.promotions?.giftPromotions).toHaveLength(1);
    expect(normalized.promotions?.giftPromotions?.[0]?.giftProductName).toBe(
      "Quấn cán 11Sport"
    );
    expect(normalized.promotions?.giftPromotions?.[0]?.title).toContain(
      "Quấn cán 11Sport"
    );
  });
});

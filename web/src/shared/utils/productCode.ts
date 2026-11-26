import type { Product, ProductVariant } from "@/shared/types";
import { toCompactUpperFE } from "./productCodeBrands";
import { generateVariantProductCode } from "./productCodeParts";
import { extractVariantFromText } from "./productCodeExtract";
import type { ProductCodeOptionsFE } from "./productCodeExtract";

export {
  estimateCode128Dots,
  compactColorTokenForBarcode,
  toCompactBarcode128,
  isCompactBarcodeMatchVariant,
} from "./productCodeBarcode";

export {
  isStandardSixDigitProductCode,
  generateVariantProductCode,
  generateSixDigitsFromSeed,
  resolveCategoryInitial,
  resolveBrandInfo,
} from "./productCodeParts";
export { extractVariantFromText } from "./productCodeExtract";
export type { ProductCodeOptionsFE } from "./productCodeExtract";
export function generateProductCode(
  rawName: string,
  options?: ProductCodeOptionsFE
): string {
  if (options?.keepVariantInCode) {
    return toCompactUpperFE(rawName);
  }
  const trimmed = String(rawName || "").trim();
  if (!trimmed) {
    if (options?.brand || options?.modelName || options?.categoryCode || options?.categoryName) {
      return extractVariantFromText("", options).code;
    }
    return "";
  }
  return extractVariantFromText(trimmed, options).code;
}

/** Giá bán hiệu lực của biến thể (R8): giá riêng > 0, ngược lại giá gốc. */
export function variantEffectiveSellingPrice(product: Pick<Product, "sellingPrice">, variant?: Partial<ProductVariant> | null): number {
  if (variant) {
    const eff = Number(variant.effectiveSellingPrice || 0);
    if (eff > 0) return eff;
    const own = Number(variant.sellingPrice || 0);
    if (own > 0) return own;
  }
  return Number(product.sellingPrice || 0);
}

/** Giá vốn hiệu lực của biến thể: giá riêng > 0, ngược lại giá gốc. */
export function variantEffectiveCostPrice(product: Pick<Product, "costPrice">, variant?: Partial<ProductVariant> | null): number {
  const own = Number(variant?.costPrice || 0);
  if (own > 0) return own;
  return Number(product.costPrice || 0);
}

/** Tất cả mã (mới + cũ) của 1 biến thể/sản phẩm để khớp khi quét tem. */
export function collectProductCodes(product: Partial<Product>, variant?: Partial<ProductVariant> | null): string[] {
  const out = new Set<string>();
  const push = (v?: string) => {
    const s = String(v || "").trim().toUpperCase();
    if (s) out.add(s);
  };
  if (variant) {
    push(variant.variantCode);
    push(variant.barcode);
    push(variant.legacyVariantCode);
    (variant.legacyVariantCodes || []).forEach(push);
  } else {
    push(product.code);
    push(product.barcode);
    push(product.legacyCode);
    (product.legacyCodes || []).forEach(push);
  }
  return Array.from(out);
}

/** Gợi ý mã màu 2–3 ký tự từ tên màu (chỉ là gợi ý; server preview-code là nguồn chuẩn). */
export function suggestColorCodeFE(color: string): string {
  const base = String(color || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim();
  if (!base) return "";
  const words = base.split(/\s+/).filter(Boolean);
  let code = words.length >= 2 ? words.map((w) => w[0]).join("") : words[0];
  if (code.length < 2) code = (words.join("") + "X").slice(0, 2);
  return code.slice(0, 3);
}

/** Sản phẩm theo quy chuẩn mã mới v5.0 (có versionCode do server sinh). */
export function isNewSchemeProductFE(p?: Partial<Product> | null): boolean {
  return Boolean(p && String(p.versionCode || "").trim());
}

function sameColorKey(a?: string, b?: string): boolean {
  return toCompactUpperFE(String(a || "")) === toCompactUpperFE(String(b || ""));
}

/** Tìm biến thể theo Màu + Size trong sản phẩm. */
export function findVariantByColorSize(
  product: Partial<Product> | null | undefined,
  color?: string,
  size?: string
): ProductVariant | undefined {
  const list = Array.isArray(product?.variants) ? product!.variants! : [];
  return list.find(
    (v) => sameColorKey(v.color, color) && toCompactUpperFE(String(v.size || "")) === toCompactUpperFE(String(size || ""))
  );
}

/**
 * Mã con (SKU/barcode) của 1 biến thể — ƯU TIÊN mã do server sinh (variantCode/barcode).
 */
export function resolveVariantCode(
  product: Partial<Product> | null | undefined,
  baseCode?: string,
  color?: string,
  size?: string
): string {
  const root = String(baseCode || product?.code || "").trim().toUpperCase();
  const hit = findVariantByColorSize(product, color, size);
  if (hit && (hit.variantCode || hit.barcode)) return String(hit.variantCode || hit.barcode);
  if (!color && !size) return root;
  if (isNewSchemeProductFE(product)) {
    const sibling = (product?.variants || []).find((v) => sameColorKey(v.color, color) && v.colorCode);
    const cc = color ? sibling?.colorCode || suggestColorCodeFE(color) : "";
    return `${root}${cc}${toCompactUpperFE(String(size || ""))}`;
  }
  return generateVariantProductCode(root, color, size);
}

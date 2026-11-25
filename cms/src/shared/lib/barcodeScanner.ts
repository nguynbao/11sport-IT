import { generateVariantProductCode, isCompactBarcodeMatchVariant } from "@/shared/utils/productCode";
import { cleanBarcodeCode, getBarcodeCandidates, isScannedCodeMatch, parseVariantSuffix } from "./barcodeMatcher";
export * from "./barcodeMatcher";
export * from "./useBarcodeScanner";

export interface ScannableProduct {
  code?: string;
  barcode?: string;
  versionCode?: string;
  legacyCode?: string;
  legacyCodes?: string[];
  stockFloor1?: number;
  stockFloor2?: number;
  stock?: number;
  variants?: Array<{
    variantKey?: string;
    color: string;
    size: string;
    variantCode?: string;
    barcode?: string;
    legacyVariantCode?: string;
    legacyVariantCodes?: string[];
    stockFloor1: number;
    stockFloor2: number;
    stock: number;
  }>;
}

function exactCodeMatch(rawScanned: string, codes: (string | undefined)[]): boolean {
  const candidates = getBarcodeCandidates(rawScanned);
  return codes.some((c) => {
    const t = cleanBarcodeCode(c || "");
    return Boolean(t) && candidates.includes(t);
  });
}

export interface ScannedProductVariantMatch<T> {
  product: T;
  matchedVariant?: {
    variantKey?: string;
    color: string;
    size: string;
    variantCode: string;
    stockFloor1: number;
    stockFloor2: number;
    stock: number;
  };
  isVariantExactMatch: boolean;
}

/**
 * Tìm sản phẩm VÀ biến thể (Màu, Size) tương ứng theo chuỗi mã vạch vừa quét.
 * - Ưu tiên 1: Khớp chính xác Mã con theo thuộc tính (VD: GASIA221401DO38 -> Giày Asia Đỏ Size 38).
 * - Ưu tiên 2: Khớp Mã gốc của sản phẩm (VD: GASIA221401).
 * - Ưu tiên 3: Khớp Mã có dấu phân cách (VD: GASIA221401-DO-38).
 * - Ưu tiên 4: Khớp tiền tố Mã gốc chuẩn ([A-Z]{2,}[0-9]{6}) + hậu tố thuộc tính [MÀU][SIZE]
 *              (kể cả khi biến thể vừa in chưa kịp đồng bộ giữa các máy).
 */
export function findProductAndVariantByScannedBarcode<
  T extends ScannableProduct
>(products: T[], rawScanned: string): ScannedProductVariantMatch<T> | undefined {
  if (!rawScanned || !Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  // 0. v5.0: khớp CHÍNH XÁC mã con do server sinh hoặc mã con cũ (legacyVariantCode/s) trước mọi suy luận
  for (const p of products) {
    for (const v of p.variants || []) {
      const serverCode = v.variantCode || v.barcode || "";
      if (
        exactCodeMatch(rawScanned, [
          v.variantCode,
          v.barcode,
          v.legacyVariantCode,
          ...(v.legacyVariantCodes || []),
        ])
      ) {
        return {
          product: p,
          matchedVariant: {
            ...v,
            variantCode: serverCode || generateVariantProductCode(p.code, v.color, v.size),
          },
          isVariantExactMatch: Boolean(v.color || v.size),
        };
      }
    }
  }

  // 1. Khớp Mã con (variantCode) của từng thuộc tính (color, size) — hỗ trợ cả mã rút gọn & mã đầy đủ (tem cũ)
  for (const p of products) {
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      const isNewScheme = Boolean(String(p.versionCode || "").trim());
      for (const v of p.variants) {
        // Sản phẩm mã mới: KHÔNG tự sinh mã ở client — chỉ dùng mã server + mã cũ
        const compactCode = isNewScheme ? "" : generateVariantProductCode(p.code, v.color, v.size);
        const fullCode = isNewScheme ? "" : cleanBarcodeCode(`${p.code || ""}${v.color || ""}${v.size || ""}`);
        const vCode = v.variantCode || v.barcode || compactCode;
        const legacyCodes = [v.legacyVariantCode, ...(v.legacyVariantCodes || [])].filter(Boolean) as string[];
        if (
          (vCode && isScannedCodeMatch(rawScanned, vCode, v.barcode || vCode)) ||
          (compactCode && isScannedCodeMatch(rawScanned, compactCode)) ||
          (fullCode && isScannedCodeMatch(rawScanned, fullCode)) ||
          legacyCodes.some((lc) => isScannedCodeMatch(rawScanned, lc))
        ) {
          return {
            product: p,
            matchedVariant: {
              ...v,
              variantCode: v.variantCode || v.barcode || compactCode || vCode,
            },
            isVariantExactMatch: Boolean(v.color || v.size),
          };
        }
      }
    }
  }

  // 2. Khớp Mã gốc của sản phẩm (kể cả mã cũ legacyCode/legacyCodes)
  const exactRoot =
    products.find((p) => exactCodeMatch(rawScanned, [p.code, p.barcode, p.legacyCode, ...(p.legacyCodes || [])])) ||
    products.find(
      (p) =>
        isScannedCodeMatch(rawScanned, p.code, p.barcode) ||
        [p.legacyCode, ...(p.legacyCodes || [])].some((lc) => Boolean(lc) && isScannedCodeMatch(rawScanned, lc))
    );
  if (exactRoot) {
    const singleVariant =
      Array.isArray(exactRoot.variants) && exactRoot.variants.length === 1
        ? {
            ...exactRoot.variants[0],
            variantCode:
              exactRoot.variants[0].variantCode ||
              generateVariantProductCode(
                exactRoot.code,
                exactRoot.variants[0].color,
                exactRoot.variants[0].size
              ),
          }
        : undefined;
    return {
      product: exactRoot,
      matchedVariant: singleVariant,
      isVariantExactMatch: Boolean(singleVariant),
    };
  }

  // 3. Nếu mã quét có dấu phân cách (VD: GASIA221401-DO-38)
  const parts = rawScanned.trim().split(/[-_/:|\s]+/);
  if (parts.length > 1 && parts[0].length >= 4) {
    const basePart = parts[0];
    const suffixNorm = cleanBarcodeCode(parts.slice(1).join(""));
    const byBase = products.find((p) =>
      isScannedCodeMatch(basePart, p.code, p.barcode)
    );
    if (byBase) {
      if (suffixNorm && Array.isArray(byBase.variants)) {
        const foundVar = byBase.variants.find((v) => {
          const vc = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
          const vs = cleanBarcodeCode(v.size || "");
          const vcol = cleanBarcodeCode(v.color || "");
          return suffixNorm === vc || suffixNorm === vs || suffixNorm === vcol;
        });
        if (foundVar) {
          const vCode =
            foundVar.variantCode ||
            generateVariantProductCode(byBase.code, foundVar.color, foundVar.size);
          return {
            product: byBase,
            matchedVariant: { ...foundVar, variantCode: vCode },
            isVariantExactMatch: true,
          };
        }
      }
      return {
        product: byBase,
        isVariantExactMatch: false,
      };
    }
  }

  // 4. Khớp tiền tố Mã gốc chuẩn ([A-Z]{2,}[0-9]{6}) + hậu tố thuộc tính [MÀU][SIZE] (VD: BSOXTER625170S)
  const candidates = getBarcodeCandidates(rawScanned);
  for (const cand of candidates) {
    const rootPrefixMatch = cand.match(/^([A-Z]{2,}[0-9]{6})([A-Z0-9]+)$/);
    if (!rootPrefixMatch) continue;
    const [, rootCandidate, suffixCandidate] = rootPrefixMatch;
    const matchedProd = products.find(
      (p) => cleanBarcodeCode(p.code || "") === rootCandidate
    );
    if (matchedProd) {
      if (Array.isArray(matchedProd.variants) && matchedProd.variants.length > 0) {
        const matchedVar = matchedProd.variants.find((v) => {
          const vSuffix = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
          const vSize = cleanBarcodeCode(v.size || "");
          const vColor = cleanBarcodeCode(v.color || "");
          return (
            suffixCandidate === vSuffix ||
            suffixCandidate === vSize ||
            suffixCandidate === vColor
          );
        });
        if (matchedVar) {
          const vCode =
            matchedVar.variantCode ||
            generateVariantProductCode(
              matchedProd.code,
              matchedVar.color,
              matchedVar.size
            );
          return {
            product: matchedProd,
            matchedVariant: { ...matchedVar, variantCode: vCode },
            isVariantExactMatch: true,
          };
        }
      }

      const parsed = parseVariantSuffix(suffixCandidate);
      const f1 = Number(matchedProd.stockFloor1 ?? matchedProd.stock ?? 0);
      const f2 = Number(matchedProd.stockFloor2 ?? 0);
      return {
        product: matchedProd,
        matchedVariant: {
          color: parsed.color,
          size: parsed.size,
          variantCode: `${rootCandidate}${suffixCandidate}`,
          stockFloor1: f1,
          stockFloor2: f2,
          stock: f1 + f2,
        },
        isVariantExactMatch: Boolean(parsed.color || parsed.size),
      };
    }
  }

  return undefined;
}

export function findProductByScannedBarcode<
  T extends ScannableProduct
>(products: T[], rawScanned: string): T | undefined {
  return findProductAndVariantByScannedBarcode(products, rawScanned)?.product;
}


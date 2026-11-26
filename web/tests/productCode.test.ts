import { describe, it, expect } from "vitest";
import {
  isStandardSixDigitProductCode,
  generateProductCode,
  generateVariantProductCode,
  extractVariantFromText,
  toCompactBarcode128,
  isCompactBarcodeMatchVariant,
  suggestColorCodeFE,
  variantEffectiveSellingPrice,
  variantEffectiveCostPrice,
} from "@/shared/utils/productCode";

describe("shared/utils/productCode", () => {
  it("validates 6-digit standard codes and generates root/variant codes", () => {
    expect(isStandardSixDigitProductCode("VYONEX123456")).toBe(true);
    expect(isStandardSixDigitProductCode("ABC123")).toBe(false);

    const code = generateProductCode("Vợt cầu lông Yonex Astrox 77", {
      categoryName: "Vợt cầu lông",
      brand: "Yonex",
    });
    expect(isStandardSixDigitProductCode(code)).toBe(true);
    expect(code.startsWith("VYONEX")).toBe(true);

    expect(generateVariantProductCode("GASIA221401", "Đỏ", "39")).toBe("GASIA221401DO39");
  });

  it("extracts color and size from text", () => {
    const parsed = extractVariantFromText("Giày cầu lông màu Đỏ size 40");
    expect(parsed.color).toBeTruthy();
    expect(parsed.size).toBe("40");
  });

  it("compacts long Code128 barcodes and matches variant codes", () => {
    const raw = "GASIACOLORVERYLONG42";
    const compact = toCompactBarcode128(raw, 200);
    expect(compact.length).toBeGreaterThan(0);
    expect(isCompactBarcodeMatchVariant(raw, raw)).toBe(true);
    expect(isCompactBarcodeMatchVariant(compact, raw)).toBe(true);
  });

  it("resolves color codes and effective variant prices", () => {
    expect(suggestColorCodeFE("Đen")).toBe("DEN");
    expect(variantEffectiveSellingPrice({ sellingPrice: 500000 }, { sellingPrice: 650000 })).toBe(650000);
    expect(variantEffectiveSellingPrice({ sellingPrice: 500000 }, { sellingPrice: 0 })).toBe(500000);
    expect(variantEffectiveCostPrice({ costPrice: 300000 }, { costPrice: 350000 })).toBe(350000);
  });
});

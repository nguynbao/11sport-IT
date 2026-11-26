import { toCompactUpperFE } from "./productCodeBrands";

/**
 * Tính chính xác số lượng module (dots ở 1x) của chuỗi khi mã hóa Code 128 Auto (B + C).
 */
export function estimateCode128Dots(rawText: string): number {
  const text =
    (rawText || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
      .trim()
      .replace(/[^\x20-\x7E]/g, "") || "ITEM";

  const countConsecutiveDigits = (str: string, startIdx: number): number => {
    let count = 0;
    while (startIdx + count < str.length) {
      const ch = str.charCodeAt(startIdx + count);
      if (ch >= 48 && ch <= 57) count++;
      else break;
    }
    return count;
  };

  let symbols = 1;
  let i = 0;
  let mode: "B" | "C" = countConsecutiveDigits(text, 0) >= 4 ? "C" : "B";

  while (i < text.length) {
    if (mode === "C") {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 2) {
        symbols += 1;
        i += 2;
      } else {
        symbols += 1;
        mode = "B";
      }
    } else {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 4) {
        if (dCount % 2 === 1) {
          symbols += 1;
          i += 1;
        }
        symbols += 1;
        mode = "C";
      } else {
        symbols += 1;
        i += 1;
      }
    }
  }

  return (symbols + 2) * 11 + 2;
}

export function compactColorTokenForBarcode(colorPart: string, maxLen: number): string {
  const clean = (colorPart || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean || clean.length <= maxLen) return clean;
  if (maxLen <= 1) return clean.slice(0, 1);

  const knownMap: [RegExp, string][] = [
    [/^TRANGXANH|^TRXANH|^TRXAN|^TRXA/, "TX"],
    [/^TRANGDO|^TRDO/, "TD"],
    [/^TRANGDEN|^TRDEN/, "TDE"],
    [/^TRANGVANG|^TRVA/, "TV"],
    [/^DENDO|^DEDO/, "DD"],
    [/^DENTRANG|^DETR/, "DT"],
    [/^DENVANG|^DEVA/, "DV"],
    [/^XANHDUONG|^XADU/, "XD"],
    [/^XANHDEN|^XADE/, "XDE"],
    [/^XANHLA|^XALA/, "XL"],
    [/^XANHNGOC|^XANGO/, "XN"],
    [/^XANHTRANG|^XATR/, "XT"],
    [/^WHBCOF|^WHBCO/, "WBC"],
    [/^WHBLUE/, "WBL"],
    [/^SOOVKH|^SOOVK/, "SVK"],
    [/^BLGOL/, "BG"],
    [/^GREIGESO|^GRSOO/, "GSO"],
    [/^WHSTGR/, "WSG"],
    [/^WHCAFE/, "WCF"],
  ];

  for (const [re, short] of knownMap) {
    if (re.test(clean)) {
      return short.length <= maxLen ? short : short.slice(0, maxLen);
    }
  }

  if (maxLen === 2) {
    return clean[0] + clean[Math.floor(clean.length / 2)];
  }
  return clean.slice(0, maxLen - 1) + clean[clean.length - 1];
}

/**
 * Chuẩn hóa mã sản phẩm / mã con biến thể sang chuỗi Code 128 gọn (<= 200 dots = 25.0mm ở 203 DPI),
 * đảm bảo lề trắng tĩnh (Quiet Zone) >= 4.0mm mỗi bên trên tem 35x20mm.
 */
export function toCompactBarcode128(rawCode: string, maxDots = 200): string {
  const clean = toCompactUpperFE(rawCode || "");
  if (!clean) return "ITEM";
  if (estimateCode128Dots(clean) <= maxDots) return clean;

  const m = clean.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  if (!m) {
    // v5.0: mã theo quy chuẩn mới (CATE+BRAND+VERSION+MÀU+SIZE) do server sinh — KHÔNG cắt bớt
    return clean;
  }

  const [, cat, brand, sixDigits, suffix] = m;
  let colorPart = "";
  let sizePart = "";
  if (suffix) {
    const sm = suffix.match(/^(.*?)(FREESIZE|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234]\d(?:5)?|[2345]U|S|M|L)$/);
    if (sm) {
      colorPart = sm[1] || "";
      sizePart = sm[2] || "";
    } else {
      colorPart = suffix;
    }
  }

  const sizeTokens = sizePart === "FREESIZE" ? ["FREESIZE", "FS"] : [sizePart];

  for (const sz of sizeTokens) {
    if (colorPart) {
      for (const cLen of [3, 2]) {
        const sc = compactColorTokenForBarcode(colorPart, cLen);
        const candidate = `${cat}${brand}${sixDigits}${sc}${sz}`;
        if (estimateCode128Dots(candidate) <= maxDots) {
          return candidate;
        }
      }
    }

    for (let bLen = Math.min(brand.length, 5); bLen >= 2; bLen--) {
      const sb = brand.slice(0, bLen);
      for (const cLen of [3, 2]) {
        const sc = compactColorTokenForBarcode(colorPart, cLen);
        const candidate = `${cat}${sb}${sixDigits}${sc}${sz}`;
        if (estimateCode128Dots(candidate) <= maxDots) {
          return candidate;
        }
      }
    }
  }

  const finalSize = sizePart === "FREESIZE" ? "FS" : sizePart;
  const sc1 = compactColorTokenForBarcode(colorPart, 1);
  return `${cat}${brand.slice(0, 2)}${sixDigits}${sc1}${finalSize}`;
}

export function isCompactBarcodeMatchVariant(scannedRaw: string, targetVariantCodeRaw: string): boolean {
  const s = toCompactUpperFE(scannedRaw || "");
  const t = toCompactUpperFE(targetVariantCodeRaw || "");
  if (!s || !t) return false;
  if (s === t) return true;
  if (s === toCompactBarcode128(t, 200) || toCompactBarcode128(s, 200) === toCompactBarcode128(t, 200)) {
    return true;
  }

  const sm = s.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  const tm = t.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  if (!sm || !tm) return false;

  const [, sCat, sBrand, sDigits, sSuffix] = sm;
  const [, tCat, tBrand, tDigits, tSuffix] = tm;

  if (sCat !== tCat || sDigits !== tDigits) return false;
  if (!tBrand.startsWith(sBrand) && !sBrand.startsWith(tBrand)) return false;
  if (sSuffix === tSuffix) return true;

  const splitSuffix = (sfx: string) => {
    const m = sfx.match(/^(.*?)(FREESIZE|FS|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234]\d(?:5)?|[2345]U|S|M|L)$/);
    return m ? { color: m[1] || "", size: m[2] === "FS" ? "FREESIZE" : m[2] || "" } : { color: sfx, size: "" };
  };

  const sParts = splitSuffix(sSuffix);
  const tParts = splitSuffix(tSuffix);
  if (sParts.size !== tParts.size) return false;
  if (!sParts.color && !tParts.color) return true;
  if (!sParts.color || !tParts.color) return false;

  for (const cLen of [3, 2, 1]) {
    if (sParts.color === compactColorTokenForBarcode(tParts.color, cLen)) {
      return true;
    }
  }
  return false;
}

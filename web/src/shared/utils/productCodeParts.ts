import { KNOWN_BRANDS_FE, NO_BRAND_TOKENS_FE, toCompactUpperFE } from "./productCodeBrands";

export function isStandardSixDigitProductCode(code?: string): boolean {
  const clean = toCompactUpperFE(String(code || ""));
  return /^[A-Z]{2,}[0-9]{6}$/.test(clean);
}

function buildCompactColorTokenFE(rawColor: string, maxColorLen: number): string {
  const words = String(rawColor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const filteredWords = words.length > 1 && words[0] === "MAU" ? words.slice(1) : words;
  const fullColor = filteredWords.join("");
  if (!fullColor || fullColor.length <= maxColorLen) return fullColor;

  const digits = filteredWords.filter((w) => /^\d+$/.test(w)).join("");
  const alphaWords = filteredWords.filter((w) => !/^\d+$/.test(w));
  if (alphaWords.length === 0) {
    return fullColor.slice(0, maxColorLen);
  }
  if (alphaWords.length === 1) {
    const take = Math.max(2, maxColorLen - digits.length);
    return alphaWords[0].slice(0, take) + digits;
  }

  const budget = Math.max(4, maxColorLen - digits.length);
  const firstWord = alphaWords[0];
  const lastWord = alphaWords[alphaWords.length - 1];
  const midInitials =
    alphaWords.length > 2
      ? alphaWords
          .slice(1, -1)
          .map((w) => w[0])
          .join("")
      : "";
  const firstPart = firstWord.slice(0, Math.min(2, firstWord.length));
  const remForLast = Math.max(1, budget - firstPart.length - midInitials.length);
  const lastPart = lastWord.slice(0, Math.min(lastWord.length, Math.max(2, remForLast)));
  const combined = (firstPart + midInitials + lastPart).slice(0, budget);
  return combined + digits;
}

/**
 * Sinh Mã con riêng cho từng thuộc tính biến thể (Màu, Size) từ Mã gốc.
 */
export function generateVariantProductCode(
  baseCode?: string,
  color?: string,
  size?: string
): string {
  const root = toCompactUpperFE(String(baseCode || ""));
  if (!root) return "";
  const rawColorStr = String(color || "");
  const cleanColor = toCompactUpperFE(rawColorStr);
  const cleanSize = toCompactUpperFE(String(size || ""));
  if (!cleanColor && !cleanSize) return root;
  const fullSuffix = `${cleanColor}${cleanSize}`;
  if (fullSuffix && root.endsWith(fullSuffix) && root.length <= 22) return root;
  const rootBase =
    fullSuffix && root.endsWith(fullSuffix) && root.length > fullSuffix.length
      ? root.slice(0, root.length - fullSuffix.length)
      : root;

  const fullCode = `${rootBase}${fullSuffix}`;
  if (fullCode.length <= 22) return fullCode;

  const maxColorLen = Math.max(4, 20 - rootBase.length - cleanSize.length);
  const shortColor = buildCompactColorTokenFE(rawColorStr, maxColorLen);
  const shortSuffix = `${shortColor}${cleanSize}`;
  if (shortSuffix && rootBase.endsWith(shortSuffix)) return rootBase;
  return `${rootBase}${shortSuffix}`;
}

export function generateSixDigitsFromSeed(seed?: string): string {
  const clean = toCompactUpperFE(String(seed || ""));
  if (!clean) {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = 100000 + (Math.abs(hash) % 900000);
  return String(num).padStart(6, "0");
}

export function resolveCategoryInitial(
  baseName: string,
  categoryCode?: string,
  categoryName?: string
): string {
  const trimmedName = String(baseName || "").trim();

  if (/^(giày|giay)\b/i.test(trimmedName)) return "G";
  if (/^(áo|ao)\b/i.test(trimmedName)) return "A";
  if (/^(quần|quan)\b/i.test(trimmedName) && !/^(quấn\s*cán|quan\s*can)/i.test(trimmedName)) {
    return "Q";
  }
  if (/^(vợt|vot|váy|vay)\b/i.test(trimmedName)) return "V";
  if (/^(bóng|bong)\b/i.test(trimmedName)) return "B";
  if (/^(phụ\s*kiện|phu\s*kien)\b/i.test(trimmedName)) return "P";

  const normCatName = toCompactUpperFE(categoryName || "").replace(/[^A-Z]/g, "");
  if (normCatName.length > 0) return normCatName.charAt(0);

  const normCatCode = toCompactUpperFE(categoryCode || "").replace(/[^A-Z]/g, "");
  if (normCatCode.length > 0) return normCatCode.charAt(0);

  if (/^(balo|ba\s*lô|băng|bang|bộ|bo|bảo\s*vệ|bao\s*ve)\b/i.test(trimmedName)) return "B";
  if (/^(túi|tui|tất|tat)\b/i.test(trimmedName)) return "T";
  if (/^(vớ|vo)\b/i.test(trimmedName)) return "V";
  if (/^(mũ|mu)\b/i.test(trimmedName)) return "M";
  if (/^(nón|non)\b/i.test(trimmedName)) return "N";
  if (/^(dép|dep|dán|dan)\b/i.test(trimmedName)) return "D";
  if (/^(chì|chi|cuốn|cuon|cước|cuoc)\b/i.test(trimmedName)) return "C";

  const normBaseLetters = toCompactUpperFE(trimmedName).replace(/[^A-Z]/g, "");
  return normBaseLetters.charAt(0) || "S";
}

export function resolveBrandInfo(
  rawName: string,
  explicitBrand?: string
): { brandCode: string; brandDisplay: string } {
  const cleanExplicit = String(explicitBrand || "").trim();
  if (cleanExplicit) {
    const compactExplicit = toCompactUpperFE(cleanExplicit).replace(/[^A-Z0-9]/g, "");
    if (NO_BRAND_TOKENS_FE.has(compactExplicit)) {
      return { brandCode: "NN", brandDisplay: "" };
    }
    if (compactExplicit) {
      const matchedKnown = KNOWN_BRANDS_FE.find(
        (b) => b.code.toUpperCase() === compactExplicit || b.pattern.test(cleanExplicit)
      );
      return {
        brandCode: matchedKnown ? matchedKnown.code.toUpperCase() : compactExplicit,
        brandDisplay: matchedKnown ? matchedKnown.display : cleanExplicit,
      };
    }
  }

  const cleanName = String(rawName || "").trim();
  if (cleanName) {
    for (const kb of KNOWN_BRANDS_FE) {
      if (kb.pattern.test(cleanName)) {
        return { brandCode: kb.code.toUpperCase(), brandDisplay: kb.display };
      }
    }
  }

  return { brandCode: "NN", brandDisplay: "" };
}

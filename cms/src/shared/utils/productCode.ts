import type { Product, ProductVariant } from "@/shared/types";

const KNOWN_BRANDS_FE: { pattern: RegExp; code: string; display: string }[] = [
  { pattern: /\b(under\s*armour|underarmour)\b/i, code: "UNDERARMOUR", display: "Under Armour" },
  { pattern: /\b(new\s*balance|newbalance)\b/i, code: "NEWBALANCE", display: "New Balance" },
  { pattern: /\b(thuong\s*dinh|thượng\s*đình|thuongdinh)\b/i, code: "THUONGDINH", display: "Thượng Đình" },
  { pattern: /\b(dong\s*luc|động\s*lực|dongluc)\b/i, code: "DONGLUC", display: "Động Lực" },
  { pattern: /\b(pickleballo)\b/i, code: "PICKLEBALLO", display: "Pickleballo" },
  { pattern: /\b(paddletek)\b/i, code: "PADDLETEK", display: "Paddletek" },
  { pattern: /\b(jogabola|jogarbola)\b/i, code: "JOGABOLA", display: "Jogabola" },
  { pattern: /\b(kaitashi)\b/i, code: "KAITASHI", display: "Kaitashi" },
  { pattern: /\b(kawasaki)\b/i, code: "KAWASAKI", display: "Kawasaki" },
  { pattern: /\b(franklin)\b/i, code: "FRANKLIN", display: "Franklin" },
  { pattern: /\b(decathlon)\b/i, code: "DECATHLON", display: "Decathlon" },
  { pattern: /\b(uhlsport)\b/i, code: "UHLSPORT", display: "Uhlsport" },
  { pattern: /\b(converse)\b/i, code: "CONVERSE", display: "Converse" },
  { pattern: /\b(spalding)\b/i, code: "SPALDING", display: "Spalding" },
  { pattern: /\b(six\s*zero|sixzero)\b/i, code: "SIXZERO", display: "Six Zero" },
  { pattern: /\b(goodfit)\b/i, code: "GOODFIT", display: "Goodfit" },
  { pattern: /\b(facolos)\b/i, code: "FACOLOS", display: "Facolos" },
  { pattern: /\b(selkirk)\b/i, code: "SELKIRK", display: "Selkirk" },
  { pattern: /\b(thunder)\b/i, code: "THUNDER", display: "Thunder" },
  { pattern: /\b(babolat)\b/i, code: "BABOLAT", display: "Babolat" },
  { pattern: /\b(gearbox)\b/i, code: "GEARBOX", display: "Gearbox" },
  { pattern: /\b(passion)\b/i, code: "PASSION", display: "Passion" },
  { pattern: /\b(artengo)\b/i, code: "ARTENGO", display: "Artengo" },
  { pattern: /\b(kalenji)\b/i, code: "KALENJI", display: "Kalenji" },
  { pattern: /\b(diadora)\b/i, code: "DIADORA", display: "Diadora" },
  { pattern: /\b(kamito)\b/i, code: "KAMITO", display: "Kamito" },
  { pattern: /\b(mizuno)\b/i, code: "MIZUNO", display: "Mizuno" },
  { pattern: /\b(zocker)\b/i, code: "ZOCKER", display: "Zocker" },
  { pattern: /\b(promax)\b/i, code: "PROMAX", display: "Promax" },
  { pattern: /\b(dalton)\b/i, code: "DALTON", display: "Dalton" },
  { pattern: /\b(ligpro)\b/i, code: "LIGPRO", display: "Ligpro" },
  { pattern: /\b(lippro)\b/i, code: "LIPPRO", display: "Lippro" },
  { pattern: /\b(soxter)\b/i, code: "SOXTER", display: "Soxter" },
  { pattern: /\b(li[\s\-]*ning|lining)\b/i, code: "LINING", display: "Lining" },
  { pattern: /\b(victor)\b/i, code: "VICTOR", display: "Victor" },
  { pattern: /\b(adidas)\b/i, code: "ADIDAS", display: "Adidas" },
  { pattern: /\b(wilson)\b/i, code: "WILSON", display: "Wilson" },
  { pattern: /\b(prince)\b/i, code: "PRINCE", display: "Prince" },
  { pattern: /\b(kumpoo)\b/i, code: "KUMPOO", display: "Kumpoo" },
  { pattern: /\b(proace)\b/i, code: "PROACE", display: "Proace" },
  { pattern: /\b(venson)\b/i, code: "VENSON", display: "Venson" },
  { pattern: /\b(molten)\b/i, code: "MOLTEN", display: "Molten" },
  { pattern: /\b(mikasa)\b/i, code: "MIKASA", display: "Mikasa" },
  { pattern: /\b(kipsta)\b/i, code: "KIPSTA", display: "Kipsta" },
  { pattern: /\b(speedo)\b/i, code: "SPEEDO", display: "Speedo" },
  { pattern: /\b(garmin)\b/i, code: "GARMIN", display: "Garmin" },
  { pattern: /\b(reusch)\b/i, code: "REUSCH", display: "Reusch" },
  { pattern: /\b(select)\b/i, code: "SELECT", display: "Select" },
  { pattern: /\b(beyono)\b/i, code: "BEYONO", display: "Beyono" },
  { pattern: /\b(bulbal)\b/i, code: "BULBAL", display: "Bulbal" },
  { pattern: /\b(reebok)\b/i, code: "REEBOK", display: "Reebok" },
  { pattern: /\b(pikdy)\b/i, code: "PIKDY", display: "Pikdy" },
  { pattern: /\b(sypik)\b/i, code: "SYPIK", display: "Sypik" },
  { pattern: /\b(joola)\b/i, code: "JOOLA", display: "Joola" },
  { pattern: /\b(asics)\b/i, code: "ASICS", display: "Asics" },
  { pattern: /\b(lotto)\b/i, code: "LOTTO", display: "Lotto" },
  { pattern: /\b(picko)\b/i, code: "PICKO", display: "Picko" },
  { pattern: /\b(yonex)\b/i, code: "YONEX", display: "Yonex" },
  { pattern: /\b(fleet)\b/i, code: "FLEET", display: "Fleet" },
  { pattern: /\b(apacs)\b/i, code: "APACS", display: "Apacs" },
  { pattern: /\b(felet)\b/i, code: "FELET", display: "Felet" },
  { pattern: /\b(arena)\b/i, code: "ARENA", display: "Arena" },
  { pattern: /\b(kelme)\b/i, code: "KELME", display: "Kelme" },
  { pattern: /\b(umbro)\b/i, code: "UMBRO", display: "Umbro" },
  { pattern: /\b(kappa)\b/i, code: "KAPPA", display: "Kappa" },
  { pattern: /\b(mitre)\b/i, code: "MITRE", display: "Mitre" },
  { pattern: /\b(bitis|biti's)\b/i, code: "BITIS", display: "Bitis" },
  { pattern: /\b(asia)\b/i, code: "ASIA", display: "Asia" },
  { pattern: /\b(wika)\b/i, code: "WIKA", display: "Wika" },
  { pattern: /\b(pili)\b/i, code: "PILI", display: "Pili" },
  { pattern: /\b(crbn)\b/i, code: "CRBN", display: "CRBN" },
  { pattern: /\b(wiro)\b/i, code: "WIRO", display: "Wiro" },
  { pattern: /\b(nike)\b/i, code: "NIKE", display: "Nike" },
  { pattern: /\b(puma)\b/i, code: "PUMA", display: "Puma" },
  { pattern: /\b(head)\b/i, code: "HEAD", display: "Head" },
  { pattern: /\b(mira)\b/i, code: "MIRA", display: "Mira" },
  { pattern: /\b(egan)\b/i, code: "EGAN", display: "Egan" },
  { pattern: /\b(joma)\b/i, code: "JOMA", display: "Joma" },
  { pattern: /\b(vans)\b/i, code: "VANS", display: "Vans" },
  { pattern: /\b(fila)\b/i, code: "FILA", display: "Fila" },
  { pattern: /\b(anta)\b/i, code: "ANTA", display: "Anta" },
  { pattern: /\b(peak)\b/i, code: "PEAK", display: "Peak" },
  { pattern: /\b(xtep)\b/i, code: "XTEP", display: "Xtep" },
  { pattern: /\b(rpm)\b/i, code: "RPM", display: "RPM" },
  { pattern: /\b(vnb)\b/i, code: "VNB", display: "VNB" },
];

const NO_BRAND_TOKENS_FE = new Set([
  "",
  "NN",
  "NONAME",
  "NO",
  "NONE",
  "NA",
  "KHONGHANG",
  "KHONG",
  "KHONGCO",
  "KHAC",
  "OEM",
  "11SPORT",
]);

function toCompactUpperFE(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

}


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
 * Công thức: [Mã gốc IN HOA][MÀU BỎ DẤU IN HOA][SIZE IN HOA]
 * Ví dụ: GASIA221401 + Đỏ + 38 -> GASIA221401DO38
 * Tự động rút gọn phần Màu nếu tổng chiều dài > 19 ký tự để vừa khít tem nhiệt 35×20mm (203 DPI).
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

export interface ProductCodeOptionsFE {
  categoryCode?: string;
  categoryName?: string;
  brand?: string;
  modelName?: string;
  color?: string;
  size?: string;
  sixDigits?: string;
  existingCode?: string;
  seedSuffix?: string;
  keepVariantInCode?: boolean;
}

export function extractVariantFromText(
  rawName: string,
  options?: ProductCodeOptionsFE
): {
  baseName: string;
  code: string;
  variantCode: string;
  brand: string;
  color: string;
  size: string;
  categoryInitial: string;
  brandCode: string;
  sixDigits: string;
} {
  const raw = String(rawName || "").trim();
  const explicitBrand = options?.brand ? String(options.brand).trim() : "";
  if (!raw && !explicitBrand && !options?.modelName) {
    return {
      baseName: "",
      code: "",
      variantCode: "",
      brand: "",
      color: "",
      size: "",
      categoryInitial: "",
      brandCode: "NN",
      sixDigits: "",
    };
  }

  const compactRaw = toCompactUpperFE(raw);
  if (
    !/\s/.test(raw) &&
    /^[A-Z]{2,}[0-9]{6}$/.test(compactRaw) &&
    !options?.categoryCode &&
    !options?.categoryName &&
    !explicitBrand
  ) {
    const sixDigits = compactRaw.slice(-6);
    const catInit = compactRaw.charAt(0);
    const bCode = compactRaw.slice(1, -6) || "NN";
    const c = options?.color || "";
    const s = options?.size || "";
    return {
      baseName: raw,
      code: compactRaw,
      variantCode: generateVariantProductCode(compactRaw, c, s),
      brand: bCode === "NN" ? "" : bCode,
      color: c,
      size: s,
      categoryInitial: catInit,
      brandCode: bCode,
      sixDigits,
    };
  }

  const stripClause = (clause: string) => {
    let working = String(clause || "").trim();
    let size = "";
    let color = "";

    const explicitSize = working.match(
      /(?:[\s\-\/,]+|^)(?:size|sz|cỡ|co|kích\s*cỡ)\s*[:\-]?\s*(XXS|XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|FREESIZE|FREE\s*SIZE|[234][0-9](?:\.[05])?)\b/i
    );
    if (explicitSize) {
      size = explicitSize[1].replace(/\s+/g, "").toUpperCase();
      working = (
        working.slice(0, explicitSize.index) +
        working.slice((explicitSize.index || 0) + explicitSize[0].length)
      ).trim();
    } else {
      const trailingSize = working.match(
        /(?:[\-\/,]\s*|\s+)(FREESIZE|FREE\s*SIZE|XXS|XS|XL|2XL|3XL|4XL|XXL|XXXL)\s*$/i
      );
      if (trailingSize) {
        size = trailingSize[1].replace(/\s+/g, "").toUpperCase();
        working = working.slice(0, trailingSize.index).trim();
      } else {
        const dashSingle = working.match(/(?:[\-\/,]\s*)(S|M|L)\s*$/i);
        if (dashSingle) {
          size = dashSingle[1].toUpperCase();
          working = working.slice(0, dashSingle.index).trim();
        }
      }
    }

    const explicitColor = working.match(
      /(?:[\s\-\/,]+|^)(?:màu|mau|color)\s*[:\-]?\s*([A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)?)\s*$/i
    );
    if (explicitColor) {
      color = explicitColor[1].trim();
      working = working.slice(0, explicitColor.index).trim();
    } else {
      const trailingColor = working.match(
        /(?:[\-\/,]\s*|\s+|^)(xanh\s*dương|xanh\s*duong|xanh\s*lá|xanh\s*la|xanh\s*đen|xanh\s*den|xanh\s*ngọc|xanh\s*ngoc|đỏ|do|đen|den|trắng|trang|xanh|vàng|vang|hồng|hong|tím|tim|xám|xam|ghi|cam|nâu|nau|kem|bạc|bac|red|blue|pink|gray|grey|white|black|green|yellow|purple|orange|navy|silver|gold)\s*$/i
      );
      if (trailingColor) {
        color = trailingColor[1].trim();
        working = working.slice(0, trailingColor.index).trim();
      }
    }

    return {
      cleaned: working.replace(/^[\-\/,:\s]+|[\-\/,:\s]+$/g, "").trim(),
      color,
      size,
    };
  };

  let baseName = raw;
  let color = options?.color ? String(options.color).trim() : "";
  let size = options?.size ? String(options.size).trim().toUpperCase() : "";

  const matches = Array.from(raw.matchAll(/\(([^()]+)\)/g));
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const inside = last[1].trim();
    const before = raw.slice(0, last.index).trim();
    const sIn = stripClause(inside);
    const sBefore = stripClause(before);
    baseName = sBefore.cleaned || sIn.cleaned || before || inside;
    color = color || sIn.color || sBefore.color;
    size = size || sIn.size || sBefore.size;
  } else if (raw) {
    const stripped = stripClause(raw);
    baseName = stripped.cleaned || raw;
    color = color || stripped.color;
    size = size || stripped.size;
  }

  const categoryInitial = resolveCategoryInitial(
    baseName || raw,
    options?.categoryCode,
    options?.categoryName
  );
  const { brandCode, brandDisplay } = resolveBrandInfo(baseName || raw, explicitBrand);

  let sixDigits = "";
  if (options?.sixDigits && /^\d{6}$/.test(options.sixDigits.trim())) {
    sixDigits = options.sixDigits.trim();
  } else if (options?.existingCode) {
    const existingMatch = toCompactUpperFE(options.existingCode).match(/(\d{6})$/);
    if (existingMatch) {
      sixDigits = existingMatch[1];
    }
  }
  if (!sixDigits) {
    const nameSixDigitsMatch = raw.match(/\b(\d{6})\b/) || compactRaw.match(/(\d{6})$/);
    if (nameSixDigitsMatch) {
      sixDigits = nameSixDigitsMatch[1];
    }
  }
  if (!sixDigits) {
    const seedParts = [baseName || raw, options?.modelName || "", options?.seedSuffix || ""]
      .filter(Boolean)
      .join("_");
    sixDigits = generateSixDigitsFromSeed(seedParts);
  }

  const code = `${categoryInitial}${brandCode}${sixDigits}`;
  const variantCode = generateVariantProductCode(code, color, size);

  return {
    baseName,
    code,
    variantCode,
    brand: brandDisplay,
    color,
    size,
    categoryInitial,
    brandCode,
    sixDigits,
  };
}

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
    // v5.0: mã theo quy chuẩn mới (CATE+BRAND+VERSION+MÀU+SIZE) do server sinh — KHÔNG cắt bớt,
    // in/quét đúng nguyên mã (máy in tự co giãn module vạch).
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

    const sc2 = compactColorTokenForBarcode(colorPart, 2);
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

// ============================================================
// HRM & Attendance APIs (v4.0)
// ============================================================


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
 * Chỉ khi biến thể chưa tồn tại trên server mới hiển thị mã dự kiến:
 *  - sản phẩm mã mới: Mã gốc + colorCode (lấy từ biến thể cùng màu, hoặc gợi ý) + SizeCode;
 *  - sản phẩm mã cũ: công thức cũ (chỉ để tương thích tem cũ).
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

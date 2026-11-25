const CODE128_PATTERNS: string[] = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011"
];

const THERMAL_KEYWORDS = [
  "xprinter", "xp-", "365b", "350b", "420b", "470b", "gprinter", "gp-",
  "zebra", "zd", "zt", "godex", "tsc", "bixolon", "pos", "thermal",
  "barcode", "label", "hprt", "rongta", "deli", "zys", "kpos", "apson"
];

export function isThermalPrinter(name: string, driverName: string): boolean {
  const combined = `${name} ${driverName}`.toLowerCase();
  return THERMAL_KEYWORDS.some((kw) => combined.includes(kw));
}

export function sanitizeAsciiCode128(input: string): string {
  const normalized = (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      out += normalized[i];
    }
  }
  return out || "ITEM";
}

function compactColorTokenForBarcode(colorPart: string, maxLen: number): string {
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

function encodeCode128RawPattern(rawText: string): string {
  const text = sanitizeAsciiCode128(rawText);
  const START_B = 104;
  const START_C = 105;
  const CODE_B = 100;
  const CODE_C = 99;
  const STOP_CODE = 106;

  const countConsecutiveDigits = (str: string, startIdx: number): number => {
    let count = 0;
    while (startIdx + count < str.length) {
      const ch = str.charCodeAt(startIdx + count);
      if (ch >= 48 && ch <= 57) count++;
      else break;
    }
    return count;
  };

  const codes: number[] = [];
  let i = 0;
  const initialDigits = countConsecutiveDigits(text, 0);
  let mode: "B" | "C" = initialDigits >= 4 ? "C" : "B";
  codes.push(mode === "C" ? START_C : START_B);

  while (i < text.length) {
    if (mode === "C") {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 2) {
        codes.push(parseInt(text.slice(i, i + 2), 10));
        i += 2;
      } else {
        codes.push(CODE_B);
        mode = "B";
      }
    } else {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 4) {
        if (dCount % 2 === 1) {
          codes.push(text.charCodeAt(i) - 32);
          i += 1;
        }
        codes.push(CODE_C);
        mode = "C";
      } else {
        codes.push(text.charCodeAt(i) - 32);
        i += 1;
      }
    }
  }

  let checksum = codes[0];
  for (let idx = 1; idx < codes.length; idx++) {
    checksum += codes[idx] * idx;
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  return codes.map((c) => CODE128_PATTERNS[c] || "").join("");
}

export function toCompactBarcode128(rawCode: string, maxDots = 200): string {
  const clean = sanitizeAsciiCode128(rawCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return "ITEM";
  if (encodeCode128RawPattern(clean).length <= maxDots) return clean;

  const m = clean.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  if (!m) {
    // v5.0: mã quy chuẩn mới do server sinh — không cắt bớt
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
        if (encodeCode128RawPattern(candidate).length <= maxDots) {
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
        if (encodeCode128RawPattern(candidate).length <= maxDots) {
          return candidate;
        }
      }
    }
  }

  const finalSize = sizePart === "FREESIZE" ? "FS" : sizePart;
  const sc1 = compactColorTokenForBarcode(colorPart, 1);
  return `${cat}${brand.slice(0, 2)}${sixDigits}${sc1}${finalSize}`;
}

export function encodeCode128BPattern(rawText: string, maxDots = 200): string {
  const safeMaxDots = Math.max(120, Math.min(212, Number(maxDots) || 200));
  const compactText = toCompactBarcode128(rawText, safeMaxDots);
  const pat = encodeCode128RawPattern(compactText);
  if (!pat) return "";

  if (pat.length * 2 <= Math.min(safeMaxDots, 178)) {
    let doubled = "";
    for (let i = 0; i < pat.length; i++) {
      doubled += pat[i] === "1" ? "11" : "00";
    }
    return doubled;
  }

  return pat;
}


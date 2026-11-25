import { toCompactBarcode128 } from "@/shared/utils/productCode";

export interface BarcodeLabelItem {
  id?: string | number;
  code?: string;
  productCode?: string;
  name?: string;
  productName?: string;
  price?: number;
  sellingPrice?: number;
  color?: string;
  size?: string;
  unit?: string;
  category?: string;
  defaultQty?: number;
}

export interface NormalizedLabelItem {
  id: string;
  code: string;
  baseCode: string;
  name: string;
  attrLabel: string;
  price: number;
  defaultQty: number;
}

export interface BarcodeLabelModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  items: BarcodeLabelItem[];
  title?: string;
  shopName?: string;
}

export type SystemPrinterInfo = {
  Name: string;
  DriverName: string;
  PortName: string;
  PrinterStatus: string;
  Default: boolean;
  WorkOffline: boolean;
  IsOnline: boolean;
  IsThermal: boolean;
};

// Cấu hình cố định chuẩn máy in tem 2 cột 70 × 20 mm (2 tem 34×20mm + khe giữa 2mm)
export const FIXED_LABEL_CONFIG = {
  id: "70x20_2up",
  name: "Tem đôi 2 cột 70 × 20 mm (2 tem 35×20mm / hàng)",
  columns: 2 as const,
  pageWidthMm: 70,
  pageHeightMm: 20,
  labelWidthMm: 34,
  labelHeightMm: 20,
  colGapMm: 2
};

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

export function sanitizeAscii(input: string): string {
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

function encodeCode128RawPattern(rawText: string): string {
  const text = sanitizeAscii(rawText);
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
  const checkIndex = checksum % 103;
  codes.push(checkIndex);
  codes.push(STOP_CODE);

  return codes.map((c) => CODE128_PATTERNS[c] || "").join("");
}

/**
 * Mã hóa chuỗi Code 128 nguyên bản 1-bit Pixel-Aligned ở 203 DPI:
 * - Tự động chuẩn hóa qua toCompactBarcode128 (<= 200 dots ~ 25.0mm) để có Quiet Zone >= 4.0mm mỗi bên.
 * - Chỉ nhân hệ số nguyên (1x hoặc 2x), không bao giờ dùng hệ số lẻ gây biến dạng vạch.
 */
function encodeCode128Bars(rawText: string, maxDots = 200): string {
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

export function renderCode128SvgString(rawText: string, height = 46): string {
  const pattern = encodeCode128Bars(rawText, 200);
  const quietZoneUnits = 14;
  const exactWidthPx = pattern.length + quietZoneUnits * 2;

  const rects: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "1") {
      let run = 1;
      while (i + run < pattern.length && pattern[i + run] === "1") {
        run++;
      }
      const x = quietZoneUnits + i;
      const w = run;
      rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000" shape-rendering="crispEdges" />`);
      i += run;
    } else {
      i++;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${exactWidthPx} ${height}" width="100%" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;margin:0 auto;background:#ffffff;image-rendering:pixelated;image-rendering:crisp-edges;">
    <rect x="0" y="0" width="${exactWidthPx}" height="${height}" fill="#ffffff" />
    ${rects.join("")}
  </svg>`;
}

/**
 * Kết xuất Vector SVG chuẩn từng dot 203 DPI (1 dot = 25.4/203 ≈ 0.12512mm) cho in qua trình duyệt (Ctrl+P).
 * Giữ chiều rộng vạch <= 200 dots (~25.0mm) kèm Quiet Zone trắng tích hợp để khi bóc dán lên sản phẩm luôn quét nhạy 100%.
 */
export function renderCode128PrintSvgFor203Dpi(rawText: string, labelWidthMm = 34): string {
  const maxBarDots = Math.min(200, Math.round((labelWidthMm - 7.5) * 8));
  const pattern = encodeCode128Bars(rawText, maxBarDots);
  const dotsPerUnit = Math.max(1, Math.min(2, Math.floor(maxBarDots / pattern.length) || 1));
  const quietZoneDots = 12;
  const totalBarDots = pattern.length * dotsPerUnit + quietZoneDots * 2;
  const exactBarWidthMm = (totalBarDots * 25.4) / 203;
  const viewBoxHeight = 100;

  const rects: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "1") {
      let run = 1;
      while (i + run < pattern.length && pattern[i + run] === "1") {
        run++;
      }
      const x = quietZoneDots + i * dotsPerUnit;
      const w = run * dotsPerUnit;
      rects.push(
        `<rect x="${x}" y="0" width="${w}" height="${viewBoxHeight}" fill="#000000" shape-rendering="crispEdges" />`
      );
      i += run;
    } else {
      i++;
    }
  }

  return `<svg class="barcode-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalBarDots} ${viewBoxHeight}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:${exactBarWidthMm.toFixed(3)}mm;max-width:100%;height:100%;display:block;margin:0 auto;background:#ffffff;">
    <rect x="0" y="0" width="${totalBarDots}" height="${viewBoxHeight}" fill="#ffffff" shape-rendering="crispEdges" />
    ${rects.join("")}
  </svg>`;
}

export function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const PRINTER_STORAGE_KEY = "11sport_preferred_thermal_printer";


import type React from "react";

export interface SportColorPreset {
  name: string;
  hex: string;
  keywords: string[];
}

export const SPORT_COLOR_PALETTE: SportColorPreset[] = [
  { name: "Trắng", hex: "#FFFFFF", keywords: ["trang", "white", "clear"] },
  { name: "Đen", hex: "#18181B", keywords: ["den", "black", "dark"] },
  { name: "Đỏ", hex: "#EF4444", keywords: ["do", "red", "crimson", "scarlet"] },
  { name: "Đỏ Đô", hex: "#9F1239", keywords: ["do do", "burgundy", "maroon", "wine", "bordeaux"] },
  { name: "Xanh Dương", hex: "#2563EB", keywords: ["xanh duong", "blue", "royal", "cobalt", "sky"] },
  { name: "Xanh Đen", hex: "#1E3A8A", keywords: ["xanh den", "navy", "midnight", "indigo"] },
  { name: "Xanh Ngọc", hex: "#0D9488", keywords: ["xanh ngoc", "teal", "mint", "turquoise", "cyan", "aqua"] },
  { name: "Xanh Lá", hex: "#16A34A", keywords: ["xanh la", "green", "lime", "emerald", "neon"] },
  { name: "Rêu / Khaki", hex: "#65743A", keywords: ["vintage khaki", "khaki", "reu", "olive", "moss", "army"] },
  { name: "Vàng", hex: "#EAB308", keywords: ["vang", "yellow", "lemon", "sun"] },
  { name: "Gold / Đồng", hex: "#D97706", keywords: ["gold", "vang dong", "dong", "amber", "bronze"] },
  { name: "Cam", hex: "#F97316", keywords: ["cam", "orange", "coral", "tangerine"] },
  { name: "Hồng / Rose", hex: "#F43F5E", keywords: ["hong", "pink", "rose", "peach", "magenta", "coral pink"] },
  { name: "Tím", hex: "#9333EA", keywords: ["tim", "purple", "violet", "lavender", "lilac", "plum"] },
  { name: "Xám / Grey", hex: "#64748B", keywords: ["steel grey", "xam", "grey", "gray", "charcoal", "slate"] },
  { name: "Greige / Xám Kem", hex: "#9E9B95", keywords: ["greige", "xam kem", "ash", "taupe"] },
  { name: "Kem / Soft Oat", hex: "#EAE0C8", keywords: ["soft oat", "oat", "kem", "cream", "beige", "ivory", "vanilla", "sand"] },
  { name: "Nâu / Cafe", hex: "#78350F", keywords: ["black coffe", "coffe", "coffee", "cafe", "nau", "brown", "mocha", "chocolate", "cacao"] },
];

function normalizeTextForColorMatch(str?: string): string {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim();
}

export function sanitizeHexList(hexes?: string[]): string[] {
  if (!Array.isArray(hexes)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of hexes) {
    const clean = String(raw || "").trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(clean) || /^#[0-9A-F]{3}$/.test(clean)) {
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
  }
  return out;
}

/**
 * Tự động suy luận 1 hoặc nhiều mã màu Hex từ chuỗi tên màu (VD: "White/black coffe", "Soft oat/vintage khaki", "Đỏ/Trắng")
 */
export function inferColorHexesFromText(colorText?: string): string[] {
  const norm = normalizeTextForColorMatch(colorText);
  if (!norm) return [];

  // Tách theo dấu phân cách màu phổ biến: /, -, +, &, ,, ;
  const segments = norm
    .split(/[\/\-+&,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedHexes: string[] = [];
  const addHex = (h: string) => {
    const upper = h.toUpperCase();
    if (!matchedHexes.includes(upper)) matchedHexes.push(upper);
  };

  for (const seg of segments) {
    // Tìm tất cả màu xuất hiện trong segment theo thứ tự vị trí chữ
    const hits: { pos: number; len: number; hex: string }[] = [];
    for (const preset of SPORT_COLOR_PALETTE) {
      for (const kw of preset.keywords) {
        if (kw === "black coffe") continue; // để "black" và "coffe" khớp riêng 2 màu
        const regex = new RegExp(`(^|[^a-z0-9])${kw.replace(/\s+/g, "\\s+")}(?=$|[^a-z0-9])`, "i");
        const m = regex.exec(seg);
        if (m) {
          const pos = m.index + (m[1] ? m[1].length : 0);
          hits.push({ pos, len: kw.length, hex: preset.hex });
        }
      }
    }
    hits.sort((a, b) => a.pos - b.pos || b.len - a.len);
    const covered: [number, number][] = [];
    for (const h of hits) {
      const start = h.pos;
      const end = h.pos + h.len;
      const overlaps = covered.some(([cs, ce]) => start < ce && end > cs);
      if (!overlaps) {
        covered.push([start, end]);
        addHex(h.hex);
      }
    }
  }

  return matchedHexes;
}

/**
 * Trả về danh sách mã màu Hex ưu tiên colorHexes đã chọn, nếu chưa có sẽ suy luận từ tên màu.
 */
export function resolveVariantColorHexes(colorText?: string, explicitHexes?: string[]): string[] {
  const cleanExplicit = sanitizeHexList(explicitHexes);
  if (cleanExplicit.length > 0) return cleanExplicit;
  return inferColorHexesFromText(colorText);
}

/**
 * Tạo style CSS cho viền (border) của box hiển thị 1 hoặc nhiều màu.
 */
export function getColorBoxBorderStyle(
  hexes: string[],
  bgFill = "var(--box-bg, #f8fafc)",
  borderWidthPx = 2.5
): React.CSSProperties {
  const clean = sanitizeHexList(hexes);
  if (clean.length === 0) return {};

  const isPureWhite = (hex: string) =>
    hex === "#FFFFFF" || hex === "#FFF" || hex === "#F8FAFC" || hex === "#F1F5F9";

  const toVisibleBorderColor = (hex: string) => {
    if (isPureWhite(hex)) return "#CBD5E1";
    if (hex === "#E7E5E4" || hex === "#EAE0C8") return "#C6AE8E";
    return hex;
  };

  if (clean.length === 1) {
    const c = clean[0];
    if (isPureWhite(c)) {
      return {
        border: `${borderWidthPx}px solid #94A3B8`,
        boxShadow: "inset 0 0 0 2px #FFFFFF, 0 1px 2px rgba(15, 23, 42, 0.06)",
        backgroundColor: bgFill,
      };
    }
    const borderCol = toVisibleBorderColor(c);
    return {
      border: `${borderWidthPx}px solid ${borderCol}`,
      boxShadow: `0 1px 3px ${borderCol}22`,
      backgroundColor: bgFill,
    };
  }

  // Nhiều màu (2, 3, 4+ màu): nếu có màu Trắng đi kèm màu khác, thu gọn phần màu Trắng (22%)
  // để phần viền màu chính kéo dài hơn quanh box (~78%) nhìn rõ và đẹp hơn trên nền sáng.
  const hasWhiteAndNonWhite =
    clean.some(isPureWhite) && clean.some((h) => !isPureWhite(h));
  const weights = clean.map((h) => (hasWhiteAndNonWhite && isPureWhite(h) ? 0.3 : 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const stops: string[] = [];
  let acc = 0;
  const n = clean.length;
  for (let i = 0; i < n; i++) {
    const c = toVisibleBorderColor(clean[i]);
    const segSpan = (weights[i] / totalWeight) * 100;
    const startPct = Math.round(acc);
    acc += segSpan;
    const endPct = i === n - 1 ? 100 : Math.round(acc);
    const pad = Math.min(3, Math.floor(segSpan / 6));
    const s = i === 0 ? 0 : startPct + pad;
    const e = i === n - 1 ? 100 : endPct - pad;
    stops.push(`${c} ${s}%`, `${c} ${e}%`);
  }

  return {
    border: `${borderWidthPx}px solid transparent`,
    background: `linear-gradient(${bgFill}, ${bgFill}) padding-box, linear-gradient(135deg, ${stops.join(", ")}) border-box`,
    boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.45)",
  };
}

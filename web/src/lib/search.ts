import { useEffect, useState } from "react";

/**
 * React Hook: Debounce một giá trị theo khoảng thời gian `delayMs` (từ 300ms đến 500ms, mặc định 400ms).
 * Giúp gom các lần gõ phím liên tiếp thành một lần cập nhật duy nhất, tối ưu số lượng request API
 * và tính toán lọc dữ liệu lớn trên giao diện.
 * - Khi giá trị rỗng (xóa trắng ô tìm kiếm), cập nhật ngay lập tức (0ms) để phản hồi tức thì.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Nếu người dùng xóa trắng chuỗi tìm kiếm thì cập nhật ngay lập tức
    if (typeof value === "string" && value.trim() === "") {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt về dạng không dấu, chữ thường, gom khoảng trắng
 * và chuyển các ký tự phân tách mã (_ - / . ,) thành khoảng trắng để tách từ chính xác.
 */
export function normalizeVietnamese(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[_\-./\\,;:()[\]{}+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chuẩn hóa chuỗi chỉ giữ lại chữ và số viết liền (dùng để so khớp mã SKU, mã đơn, SĐT, barcode)
 */
export function compactAlphaNum(input: string | null | undefined): string {
  if (!input) return "";
  return normalizeVietnamese(input).replace(/[^a-z0-9]/g, "");
}

/**
 * Chuẩn hóa số điện thoại Việt Nam (chuyển +84/84 đầu về 0, chỉ giữ chữ số)
 */
export function normalizePhoneDigits(input: string | null | undefined): string {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  return digits;
}

/**
 * Tạo chuỗi viết tắt từ các chữ cái đầu của từng từ
 * Ví dụ: "Áo Polo Thể Thao" -> "aptt"
 */
export function buildAcronym(normalizedSpaced: string): string {
  if (!normalizedSpaced) return "";
  const words = normalizedSpaced.split(" ").filter(Boolean);
  if (words.length < 2) return "";
  return words.map((w) => w[0]).join("");
}

/**
 * Khoảng cách Damerau-Levenshtein giới hạn để bắt lỗi gõ phím nhẹ (1 ký tự hoặc đảo 2 ký tự liền kề)
 */
function boundedEditDistanceLeq1(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > 1) return false;
  if (a === b) return true;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < lenA && j < lenB) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      // Kiểm tra đảo 2 ký tự liền kề (transposition)
      if (
        lenA === lenB &&
        i + 1 < lenA &&
        a[i] === b[j + 1] &&
        a[i + 1] === b[j]
      ) {
        i += 2;
        j += 2;
      } else if (lenA > lenB) {
        i++;
      } else if (lenB > lenA) {
        j++;
      } else {
        i++;
        j++;
      }
    }
  }

  if (i < lenA || j < lenB) edits++;
  return edits <= 1;
}

export interface SearchField {
  text: string | null | undefined;
  /** Trọng số ưu tiên của trường (mặc định 1.0; mã/SĐT thường 1.4 - 1.6, tên 1.2, ghi chú 0.8) */
  weight?: number;
}

interface PreparedField {
  rawLower: string;
  norm: string;
  compact: string;
  words: string[];
  acronym: string;
  phoneDigits: string;
  weight: number;
}

/**
 * Chấm điểm mức độ khớp của một bản ghi với câu truy vấn tìm kiếm `rawQuery`.
 * Trả về `0` nếu không khớp, hoặc điểm số `> 0` (càng cao càng khớp sát).
 */
export function scoreSearchMatch(
  rawQuery: string | null | undefined,
  fields: (SearchField | string | null | undefined)[]
): number {
  const trimmedQuery = String(rawQuery || "").trim();
  if (!trimmedQuery) return 1;

  const qNorm = normalizeVietnamese(trimmedQuery);
  const qCompact = compactAlphaNum(trimmedQuery);
  if (!qNorm && !qCompact) return 1;

  const qTokens = qNorm.split(" ").filter(Boolean);
  const qPhone = normalizePhoneDigits(trimmedQuery);
  const isPhoneLikeQuery = qPhone.length >= 3 && /^[\d\s+().-]+$/.test(trimmedQuery);

  const preparedFields: PreparedField[] = [];
  for (const f of fields) {
    if (!f) continue;
    const text = typeof f === "string" ? f : f.text;
    const weight = typeof f === "string" ? 1.0 : (f.weight ?? 1.0);
    if (!text) continue;
    const rawStr = String(text).trim();
    if (!rawStr) continue;

    const norm = normalizeVietnamese(rawStr);
    const compact = norm.replace(/[^a-z0-9]/g, "");
    const words = norm.split(" ").filter(Boolean);
    const acronym = buildAcronym(norm);
    const phoneDigits = normalizePhoneDigits(rawStr);

    preparedFields.push({
      rawLower: rawStr.toLowerCase(),
      norm,
      compact,
      words,
      acronym,
      phoneDigits,
      weight,
    });
  }

  if (preparedFields.length === 0) return 0;

  let bestWholeScore = 0;

  // 1. So khớp toàn cụm (Exact / Prefix / Substring / Compact / Phone / Acronym)
  for (const pf of preparedFields) {
    let fieldScore = 0;

    if (pf.compact && qCompact && pf.compact === qCompact) {
      fieldScore = Math.max(fieldScore, 120);
    } else if (pf.norm && pf.norm === qNorm) {
      fieldScore = Math.max(fieldScore, 115);
    } else if (pf.compact && qCompact.length >= 2 && pf.compact.startsWith(qCompact)) {
      fieldScore = Math.max(fieldScore, 95);
    } else if (pf.norm && pf.norm.startsWith(qNorm)) {
      fieldScore = Math.max(fieldScore, 92);
    } else if (pf.norm && pf.norm.includes(qNorm)) {
      fieldScore = Math.max(fieldScore, 78);
    } else if (pf.compact && qCompact.length >= 3 && pf.compact.includes(qCompact)) {
      fieldScore = Math.max(fieldScore, 72);
    }

    if (isPhoneLikeQuery && pf.phoneDigits) {
      if (pf.phoneDigits === qPhone) {
        fieldScore = Math.max(fieldScore, 125);
      } else if (pf.phoneDigits.startsWith(qPhone) || pf.phoneDigits.endsWith(qPhone)) {
        fieldScore = Math.max(fieldScore, 96);
      } else if (pf.phoneDigits.includes(qPhone)) {
        fieldScore = Math.max(fieldScore, 82);
      }
    }

    if (qTokens.length === 1 && qCompact.length >= 2 && pf.acronym) {
      if (pf.acronym === qCompact) {
        fieldScore = Math.max(fieldScore, 76);
      } else if (pf.acronym.startsWith(qCompact)) {
        fieldScore = Math.max(fieldScore, 64);
      }
    }

    if (fieldScore > 0) {
      const weighted = fieldScore * pf.weight;
      if (weighted > bestWholeScore) {
        bestWholeScore = weighted;
      }
    }
  }

  // 2. So khớp đa từ (Multi-token AND across fields)
  let allTokensMatched = true;
  let tokenTotalScore = 0;

  for (const token of qTokens) {
    let bestTokenScore = 0;
    const isPureAlpha = token.length >= 4 && /^[a-z]+$/.test(token);

    for (const pf of preparedFields) {
      let tScore = 0;

      for (let wi = 0; wi < pf.words.length; wi++) {
        const w = pf.words[wi];
        if (w === token) {
          tScore = Math.max(tScore, wi === 0 ? 36 : 32);
          break;
        } else if (w.startsWith(token)) {
          tScore = Math.max(tScore, wi === 0 ? 28 : 25);
        } else if (token.length >= 2 && w.includes(token)) {
          tScore = Math.max(tScore, 18);
        } else if (
          isPureAlpha &&
          w.length >= 4 &&
          /^[a-z]+$/.test(w) &&
          w[0] === token[0] &&
          boundedEditDistanceLeq1(token, w)
        ) {
          tScore = Math.max(tScore, 12);
        }
      }

      if (tScore === 0 && token.length >= 2 && pf.compact.includes(token)) {
        tScore = 20;
      }

      if (tScore === 0 && /^\d+$/.test(token) && pf.phoneDigits.includes(token)) {
        tScore = 24;
      }

      if (tScore === 0 && token.length >= 2 && pf.acronym && pf.acronym.startsWith(token)) {
        tScore = 22;
      }

      const weighted = tScore * pf.weight;
      if (weighted > bestTokenScore) {
        bestTokenScore = weighted;
      }
    }

    if (bestTokenScore === 0) {
      allTokensMatched = false;
      break;
    }
    tokenTotalScore += bestTokenScore;
  }

  if (!allTokensMatched && bestWholeScore === 0) {
    return 0;
  }

  const normalizedTokenScore = allTokensMatched
    ? (tokenTotalScore / Math.max(1, qTokens.length)) * 1.5
    : 0;

  let finalScore = bestWholeScore + normalizedTokenScore;

  const rawLowerQuery = trimmedQuery.toLowerCase();
  for (const pf of preparedFields) {
    if (pf.rawLower.includes(rawLowerQuery)) {
      finalScore += 8 * pf.weight;
      break;
    }
  }

  return finalScore;
}

/**
 * Lọc và sắp xếp danh sách `items` theo mức độ liên quan (relevance) với `query`.
 * Khi `query` rỗng, giữ nguyên thứ tự gốc của `items`.
 */
export function filterAndRankBySearch<T>(
  items: T[],
  query: string | null | undefined,
  getFields: (item: T) => (SearchField | string | null | undefined)[]
): T[] {
  const trimmed = String(query || "").trim();
  if (!trimmed) return items;

  const scored: { item: T; score: number; index: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreSearchMatch(trimmed, getFields(item));
    if (score > 0) {
      scored.push({ item, score, index: i });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map((s) => s.item);
}

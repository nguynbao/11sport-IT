/**
 * Bộ công cụ Tìm kiếm Thông minh (Smart Search Engine) chuẩn 11Sport:
 * - Bỏ dấu tiếng Việt (NFD + đ/Đ -> d), không phân biệt hoa/thường.
 * - Hỗ trợ tìm kiếm đa từ khóa không liền kề (Multi-token non-contiguous search), VD: "ao do size l", "polo kmap xl".
 * - Hỗ trợ tìm xuyên qua dấu gạch dưới '_', gạch ngang '-', khoảng trắng (VD: "hd0001" khớp "HD-0001", "090 123" khớp "090123...").
 * - Hỗ trợ viết tắt chữ cái đầu (Acronym), VD: "aptt" khớp "Áo Polo Thể Thao".
 * - Chịu lỗi chính tả nhẹ (Typo-tolerant Damerau-Levenshtein) cho từ vựng tiếng Việt/Anh >= 4 ký tự (không áp dụng nhầm lên số SKU/Size).
 * - Chấm điểm độ liên quan (Relevance Scoring) để đẩy kết quả khớp chính xác nhất lên đầu.
 */

export function normalizeVietnamese(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function compactAlphaNum(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizePhoneDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const digits = String(input).replace(/\D+/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function getWordInitials(normalizedText: string): string {
  if (!normalizedText) return '';
  const words = normalizedText.split(' ').filter(Boolean);
  if (words.length < 2) return '';
  return words.map((w) => w[0]).join('');
}

/**
 * Khoảng cách chỉnh sửa Damerau-Levenshtein có giới hạn (chỉ dùng cho từ thuần chữ cái >= 4 ký tự)
 */
function boundedEditDistance(a: string, b: string, maxDist: number): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    new Array<number>(lenB + 1).fill(0)
  );
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[lenA][lenB];
}

export interface SearchFieldWeight {
  text: string | number | null | undefined;
  /** Trọng số ưu tiên của trường (VD: code/barcode = 1.5, name = 1.2, category/note = 0.8) */
  weight?: number;
}

/**
 * Tính điểm khớp của một bản ghi với câu truy vấn `rawQuery`.
 * Trả về `0` nếu không khớp, trả về số dương càng lớn nếu độ liên quan càng cao.
 */
export function scoreSearchMatch(
  rawQuery: string | null | undefined,
  fields: (string | number | null | undefined | SearchFieldWeight)[]
): number {
  const qRaw = String(rawQuery || '').trim();
  if (!qRaw) return 1;

  const qNorm = normalizeVietnamese(qRaw);
  const qCompact = compactAlphaNum(qRaw);
  if (!qNorm && !qCompact) return 1;

  const qLower = qRaw.toLowerCase().trim();
  const qTokens = qNorm.split(' ').filter(Boolean);
  const qPhone = normalizePhoneDigits(qRaw);
  const isPhoneLikeQuery = /^\+?[\d\s.\-()]{3,}$/.test(qRaw) && qPhone.length >= 3;

  const preparedFields = fields
    .map((f) => {
      if (f && typeof f === 'object' && 'text' in f) {
        const raw = String(f.text ?? '').trim();
        return {
          raw,
          rawLower: raw.toLowerCase(),
          norm: normalizeVietnamese(raw),
          compact: compactAlphaNum(raw),
          phone: normalizePhoneDigits(raw),
          weight: f.weight ?? 1,
        };
      }
      const raw = String(f ?? '').trim();
      return {
        raw,
        rawLower: raw.toLowerCase(),
        norm: normalizeVietnamese(raw),
        compact: compactAlphaNum(raw),
        phone: normalizePhoneDigits(raw),
        weight: 1,
      };
    })
    .filter((f) => f.norm.length > 0 || f.compact.length > 0);

  if (preparedFields.length === 0) return 0;

  let bestDirectScore = 0;

  // 1. Kiểm tra khớp trực tiếp trên từng trường (Exact, Prefix, Phrase, Compact, Phone, Acronym)
  for (const f of preparedFields) {
    const w = f.weight;

    // Khớp chính xác tuyệt đối (mã SP, mã đơn, SĐT, tên)
    if (f.rawLower === qLower || f.norm === qNorm || (qCompact.length >= 2 && f.compact === qCompact)) {
      bestDirectScore = Math.max(bestDirectScore, 1000 * w);
      continue;
    }

    // Khớp số điện thoại đã chuẩn hóa (+84 -> 0, bỏ khoảng trắng)
    if (isPhoneLikeQuery && f.phone.length >= 6) {
      if (f.phone === qPhone) {
        bestDirectScore = Math.max(bestDirectScore, 980 * w);
        continue;
      }
      if (f.phone.startsWith(qPhone) || f.phone.endsWith(qPhone)) {
        bestDirectScore = Math.max(bestDirectScore, 820 * w);
      } else if (f.phone.includes(qPhone)) {
        bestDirectScore = Math.max(bestDirectScore, 680 * w);
      }
    }

    // Khớp tiền tố (Prefix) trên chuỗi gốc hoặc chuỗi bỏ dấu / compact
    if (f.rawLower.startsWith(qLower)) {
      bestDirectScore = Math.max(bestDirectScore, 860 * w);
    } else if (f.norm.startsWith(qNorm)) {
      bestDirectScore = Math.max(bestDirectScore, 800 * w);
    } else if (qCompact.length >= 2 && f.compact.startsWith(qCompact)) {
      bestDirectScore = Math.max(bestDirectScore, 750 * w);
    }

    // Khớp cụm từ nguyên vẹn (Exact substring phrase) có dấu hoặc không dấu
    if (f.rawLower.includes(qLower)) {
      bestDirectScore = Math.max(bestDirectScore, 660 * w);
    } else if (f.norm.includes(qNorm)) {
      bestDirectScore = Math.max(bestDirectScore, 600 * w);
    } else if (qCompact.length >= 3 && f.compact.includes(qCompact)) {
      bestDirectScore = Math.max(bestDirectScore, 520 * w);
    }

    // Khớp viết tắt chữ cái đầu (Acronym, VD: "aptt" -> "Áo Polo Thể Thao")
    if (qTokens.length === 1 && qCompact.length >= 3) {
      const initials = getWordInitials(f.norm);
      if (initials && initials.includes(qCompact)) {
        bestDirectScore = Math.max(
          bestDirectScore,
          (initials.startsWith(qCompact) ? 480 : 400) * w
        );
      }
    }
  }

  // 2. Kiểm tra khớp đa từ khóa không liền kề (Multi-token matching across fields)
  // Gom toàn bộ từ vựng của các trường để đối chiếu từng token trong câu tìm kiếm
  const allWords: { word: string; weight: number }[] = [];
  for (const f of preparedFields) {
    const words = f.norm.split(' ').filter(Boolean);
    for (const word of words) {
      allWords.push({ word, weight: f.weight });
    }
  }

  if (qTokens.length > 0 && allWords.length > 0) {
    let allTokensMatched = true;
    let tokenScoreSum = 0;

    for (let tIdx = 0; tIdx < qTokens.length; tIdx++) {
      const qt = qTokens[tIdx];
      const isLastToken = tIdx === qTokens.length - 1;
      let bestTokenScore = 0;

      for (const { word, weight } of allWords) {
        if (word === qt) {
          // Khớp chính xác từ (VD: size "l", màu "do", mã "kmap262510")
          bestTokenScore = Math.max(bestTokenScore, 120 * weight);
          break;
        }
        if (word.startsWith(qt)) {
          // Nếu token chỉ có 1 ký tự (VD: "l", "m", "s") và câu truy vấn có nhiều từ,
          // chỉ cho phép khớp tiền tố nếu đó là từ cuối cùng người dùng đang gõ dở
          if (qt.length === 1 && qTokens.length > 1 && !isLastToken) {
            continue;
          }
          bestTokenScore = Math.max(bestTokenScore, 90 * weight);
          continue;
        }
        // Khớp chuỗi con bên trong 1 từ (VD: "2625" trong "kmap262510", hoặc "pol" trong "aopolo")
        if (qt.length >= 2 && word.includes(qt)) {
          bestTokenScore = Math.max(bestTokenScore, 65 * weight);
          continue;
        }
        // Chịu lỗi chính tả nhẹ (chỉ áp dụng cho từ thuần chữ cái >= 4 ký tự, cùng ký tự đầu)
        if (
          bestTokenScore === 0 &&
          qt.length >= 4 &&
          word.length >= 4 &&
          qt[0] === word[0] &&
          /^[a-z]+$/.test(qt) &&
          /^[a-z]+$/.test(word)
        ) {
          const maxDist = qt.length >= 7 ? 2 : 1;
          const dist = boundedEditDistance(qt, word, maxDist);
          if (dist <= maxDist) {
            bestTokenScore = Math.max(bestTokenScore, (dist === 1 ? 45 : 30) * weight);
          }
        }
      }

      // Fallback: token có thể nằm vắt qua ranh giới compact (VD: gõ "kmap26" khi tên viết "kmap 26")
      if (bestTokenScore === 0 && qt.length >= 3) {
        for (const f of preparedFields) {
          if (f.compact.includes(qt)) {
            bestTokenScore = Math.max(bestTokenScore, 55 * f.weight);
          }
        }
      }

      if (bestTokenScore === 0) {
        allTokensMatched = false;
        break;
      }
      tokenScoreSum += bestTokenScore;
    }

    if (allTokensMatched) {
      const avgTokenScore = tokenScoreSum / qTokens.length;
      const multiTokenBonus = Math.min(150, qTokens.length * 25);
      bestDirectScore = Math.max(bestDirectScore, 300 + avgTokenScore + multiTokenBonus);
    }
  }

  return bestDirectScore;
}

/**
 * Lọc và sắp xếp danh sách `items` theo độ liên quan với từ khóa `query`.
 * Nếu `query` rỗng, giữ nguyên danh sách và thứ tự ban đầu.
 */
export function filterAndRankBySearch<T>(
  items: T[],
  query: string | null | undefined,
  getFields: (item: T) => (string | number | null | undefined | SearchFieldWeight)[]
): T[] {
  const q = String(query || '').trim();
  if (!q) return items;

  const scored: { item: T; score: number; index: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreSearchMatch(q, getFields(item));
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

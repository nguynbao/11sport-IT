import {
  generateProductCode,
  generateVariantProductCode,
  normalizeToCompactUpperCode,
  normalizeToUpperCode,
  tokenizeUpperAlphaNum,
} from './productCode';

const TELEX_COMBINING_MARK_TO_KEY: Record<string, string> = {
  '\u0300': 'F',
  '\u0301': 'S',
  '\u0303': 'X',
  '\u0309': 'R',
  '\u0323': 'J',
  '\u0302': '__CIRCUMFLEX__',
  '\u0306': 'W',
  '\u031B': 'W',
};

function collapseUnikeyBackspaceStutter(rawInput: string): string {
  if (!rawInput) return '';
  interface DecomposedUnit {
    base: string;
    marks: string;
    hasHornOrBreve: boolean;
  }
  const units: DecomposedUnit[] = [];
  for (const ch of rawInput) {
    if (ch === 'đ' || ch === 'Đ') {
      units.push({ base: 'D', marks: 'D', hasHornOrBreve: false });
      continue;
    }
    const nfd = ch.normalize('NFD');
    let base = '';
    let marks = '';
    let hasHornOrBreve = false;
    for (const c of nfd) {
      if (c >= '\u0300' && c <= '\u036f') {
        marks += c;
        if (c === '\u031B' || c === '\u0306') hasHornOrBreve = true;
      } else {
        base += c.toUpperCase();
      }
    }
    units.push({ base, marks, hasHornOrBreve });
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < 12) {
    changed = false;
    guard++;
    for (let i = 0; i < units.length; i++) {
      for (let offset = 1; offset <= 5 && i + offset < units.length; offset++) {
        const left = units[i];
        const right = units[i + offset];
        if (!left.base || left.base !== right.base) continue;
        if (!/^[AEIOUYD]$/.test(left.base)) continue;

        const rightIsStrictUpgrade =
          (right.marks.length > left.marks.length && right.marks.startsWith(left.marks)) ||
          (left.marks === '' && right.marks.length > 0);
        if (!rightIsStrictUpgrade) continue;

        let midSame = true;
        for (let k = 1; k < offset; k++) {
          if (i + k >= units.length || i + offset + k >= units.length) {
            midSame = false;
            break;
          }
          const m1 = units[i + k];
          const m2 = units[i + offset + k];
          if (m1.base !== m2.base) {
            midSame = false;
            break;
          }
          if (!(m2.marks === m1.marks || (m1.marks === '' && m2.marks.length > 0))) {
            midSame = false;
            break;
          }
        }
        if (midSame) {
          for (let k = 0; k < offset; k++) {
            if (units[i + k].hasHornOrBreve && !units[i + offset + k].hasHornOrBreve) {
              units[i + offset + k].marks = '\u031B' + units[i + offset + k].marks;
              units[i + offset + k].hasHornOrBreve = true;
            }
          }
          units.splice(i, offset);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return units
    .map((u) => {
      if (u.base === 'D' && u.marks === 'D') return 'Đ';
      return (u.base + u.marks).normalize('NFC');
    })
    .join('');
}

function reconstructTelexFromInput(rawInput: string, standaloneUAsW = false): string {
  if (!rawInput) return '';
  let out = '';
  for (const ch of rawInput) {
    if (ch === 'đ' || ch === 'Đ') {
      out += 'DD';
      continue;
    }
    const nfd = ch.normalize('NFD');
    const base = nfd[0] ? nfd[0].toUpperCase() : '';
    const marks = nfd.slice(1);
    if (!marks) {
      out += base;
      continue;
    }
    if (standaloneUAsW && base === 'U' && marks === '\u031B') {
      out += 'W';
      continue;
    }
    let reconstructed = base;
    for (const m of marks) {
      const key = TELEX_COMBINING_MARK_TO_KEY[m];
      if (key === '__CIRCUMFLEX__') {
        reconstructed += base;
      } else if (key) {
        reconstructed += key;
      }
    }
    out += reconstructed;
  }
  return out.replace(/[^A-Z0-9]/g, '');
}

export function getBarcodeCandidatesServer(rawInput: string): string[] {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return [];
  const collapsed = collapseUnikeyBackspaceStutter(trimmed);
  const candidates = new Set<string>();
  const hasToneMarks = /[\u0300\u0301\u0303\u0309\u0323]/.test(trimmed.normalize('NFD'));

  for (const source of [collapsed, trimmed]) {
    const telexRestored = reconstructTelexFromInput(source, false);
    if (telexRestored) candidates.add(telexRestored);

    const telexRestoredW = reconstructTelexFromInput(source, true);
    if (telexRestoredW) candidates.add(telexRestoredW);

    if (!hasToneMarks) {
      const stripped = normalizeToCompactUpperCode(source);
      if (stripped) candidates.add(stripped);

      const rawW = source
        .replace(/[ưƯ]/g, 'W')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'D')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      if (rawW) candidates.add(rawW);
    }
  }

  return Array.from(candidates);
}

export function decodeScannedBarcodeServer(rawInput: string): string {
  const candidates = getBarcodeCandidatesServer(rawInput);
  return candidates[0] || '';
}

export function isScannedCodeMatchServer(rawScanned: string, targetCode?: string | null): boolean {
  if (!rawScanned || !targetCode) return false;
  const cleanTarget = normalizeToCompactUpperCode(targetCode);
  if (!cleanTarget) return false;
  const candidates = getBarcodeCandidatesServer(rawScanned);
  return candidates.includes(cleanTarget);
}

/**
  * So khớp kết quả quét tag với các dòng trong phiếu nhập.
  * - Ưu tiên khớp chính xác mã con (variantCode) hoặc mã vạch (barcode) đã được ghi nhớ trên dòng hàng.
  * - Tiếp theo khớp chính xác mã hàng (productCode) kết hợp token màu/size.
  * - Sau đó chấm điểm theo token của tên hàng/mã hàng/màu/size (mã mẫu/SKU có chữ số bắt buộc phải khớp).
  * - Không bao giờ thêm dòng mới: không khớp => trả về null.
  */
export interface TagScanInput {
  query?: string;
  productCode?: string;
  productName?: string;
  barcode?: string;
  codes?: string[];
  rawText?: string;
}

export interface TagMatchItem {
  productCode: string;
  variantCode?: string;
  productName: string;
  color?: string;
  size?: string;
  barcode?: string;
  isChecked?: boolean;
}

export interface TagMatchResult {
  index: number | null;
  ambiguous: boolean;
  candidates: number[];
}

const MIN_SCORE = 0.6;

const tokensOf = (s?: string): string[] =>
  tokenizeUpperAlphaNum(String(s || '')).filter((t) => t !== 'SIZE');

const isSkuToken = (t: string) =>
  t.length >= 3 && t.length <= 14 && /\d/.test(t) && t !== '11SPORT';

export function matchTagToItems(items: TagMatchItem[], scan: TagScanInput): TagMatchResult {
  const cleanBarcode = String(scan.barcode || scan.productCode || scan.query || '').trim();
  const scanCandidates = getBarcodeCandidatesServer(cleanBarcode);

  if (cleanBarcode || scanCandidates.length > 0) {
    // 1. Ưu tiên khớp chính xác Mã con (variantCode) hoặc Barcode riêng của dòng (chỉ khi dòng có thuộc tính hoặc barcode riêng)
    const variantCodeMatches = items
      .map((it, idx) => {
        const hasAttr = Boolean((it.color && it.color.trim()) || (it.size && it.size.trim()) || it.variantCode);
        const expectedVariantCode = hasAttr
          ? it.variantCode || generateVariantProductCode(it.productCode, it.color, it.size)
          : '';
        const fullVariantCode = hasAttr
          ? normalizeToCompactUpperCode(`${it.productCode || ''}${it.color || ''}${it.size || ''}`)
          : '';
        return { it, idx, expectedVariantCode, fullVariantCode };
      })
      .filter(({ it, expectedVariantCode, fullVariantCode }) => {
        const itemBc = String(it.barcode || '').trim();
        return (
          (itemBc && (itemBc === cleanBarcode || isScannedCodeMatchServer(cleanBarcode, itemBc))) ||
          (expectedVariantCode && isScannedCodeMatchServer(cleanBarcode, expectedVariantCode)) ||
          (fullVariantCode && isScannedCodeMatchServer(cleanBarcode, fullVariantCode))
        );
      })
      .map(({ idx }) => idx);

    if (variantCodeMatches.length === 1) {
      return { index: variantCodeMatches[0], ambiguous: false, candidates: variantCodeMatches };
    }
    if (variantCodeMatches.length > 1) {
      const unchecked = variantCodeMatches.filter((i) => !items[i].isChecked);
      if (unchecked.length === 1) {
        return { index: unchecked[0], ambiguous: false, candidates: variantCodeMatches };
      }
      return { index: null, ambiguous: true, candidates: variantCodeMatches };
    }
  }

  const sources = [
    scan.productCode,
    scan.productName,
    scan.query,
    scan.barcode,
    ...(Array.isArray(scan.codes) ? scan.codes : []),
  ].filter((s): s is string => Boolean(s && String(s).trim()));

  const tagCodes = new Set<string>();
  for (const s of sources) {
    for (const cand of getBarcodeCandidatesServer(s)) {
      if (cand) tagCodes.add(cand);
    }
    const c0 = normalizeToCompactUpperCode(s);
    const c1 = generateProductCode(s);
    const c2 = normalizeToUpperCode(s);
    if (c0) tagCodes.add(c0);
    if (c1) tagCodes.add(c1);
    if (c2) tagCodes.add(c2);
  }
  const tagTokens = new Set<string>(
    [...sources, String(scan.rawText || '').slice(0, 2000)].flatMap(tokensOf)
  );
  if (tagCodes.size === 0 && tagTokens.size === 0) {
    return { index: null, ambiguous: false, candidates: [] };
  }

  const scores = items.map((item) => {
    const code = item.productCode || generateProductCode(item.productName);
    if (!code && !item.productName) return 0;

    const hasAttr = Boolean((item.color && item.color.trim()) || (item.size && item.size.trim()) || item.variantCode);
    const itemVariantCode = hasAttr
      ? item.variantCode || generateVariantProductCode(code, item.color, item.size)
      : '';
    if (itemVariantCode && tagCodes.has(normalizeToCompactUpperCode(itemVariantCode))) {
      return 12;
    }

    const nameTokens = tokensOf(item.productName);
    const itemTokens = Array.from(
      new Set([
        ...nameTokens,
        ...tokensOf(item.color),
        ...tokensOf(item.size),
        ...(code ? tokensOf(code) : []),
      ])
    );
    if (itemTokens.length === 0) {
      return code && tagCodes.has(code) ? 1 : 0;
    }

    // Mã mẫu/SKU (có chữ số, độ dài vừa phải <= 14) trên tên dòng hàng phải xuất hiện trên tag
    const skuTokens = nameTokens.filter((t) => isSkuToken(t) && t.length <= 14);
    const hasExactCodeMatch = Boolean(code && tagCodes.has(code));
    if (
      !hasExactCodeMatch &&
      skuTokens.length > 0 &&
      !skuTokens.every((t) => tagTokens.has(t) || Array.from(tagCodes).some((tc) => tc.includes(t)))
    ) {
      return 0;
    }

    const hit = itemTokens.filter((t) => tagTokens.has(t)).length;
    const ratio = hit / itemTokens.length;
    let score = skuTokens.length > 0 || hasExactCodeMatch ? 0.6 + 0.39 * ratio : ratio;

    // Cộng điểm phân biệt nếu khớp đúng màu/size riêng của dòng
    const variantTokens = [...tokensOf(item.color), ...tokensOf(item.size)];
    if (variantTokens.length > 0) {
      const variantHit = variantTokens.filter((vt) => tagTokens.has(vt)).length;
      score += 0.05 * (variantHit / variantTokens.length);
    }

    // Nếu quét đúng toàn bộ chuỗi tên sản phẩm (bao gồm cả màu/size trong ngoặc)
    const fullItemCompact = normalizeToUpperCode(
      `${item.productName || ''} ${item.color || ''} ${item.size || ''}`
    );
    if (fullItemCompact && tagCodes.has(fullItemCompact)) {
      score = Math.max(score, 10);
    }

    return score;
  });

  const best = Math.max(0, ...scores);
  if (best < MIN_SCORE) return { index: null, ambiguous: false, candidates: [] };

  const top = scores
    .map((s, i) => ({ s, i }))
    .filter((x) => Math.abs(x.s - best) < 1e-9)
    .map((x) => x.i);

  if (top.length === 1) return { index: top[0], ambiguous: false, candidates: top };

  // Nhiều dòng cùng điểm: nếu chỉ còn 1 dòng chưa kiểm thì chọn dòng đó
  const unchecked = top.filter((i) => !items[i].isChecked);
  if (unchecked.length === 1) return { index: unchecked[0], ambiguous: false, candidates: top };

  return { index: null, ambiguous: true, candidates: top };
}

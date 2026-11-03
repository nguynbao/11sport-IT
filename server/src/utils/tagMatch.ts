import {
  generateProductCode,
  normalizeToUpperCode,
  tokenizeUpperAlphaNum,
} from './productCode';

/**
 * So khớp kết quả quét tag với các dòng trong phiếu nhập.
 * - Ưu tiên khớp chính xác mã vạch (barcode) đã được ghi nhớ trên dòng hàng.
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
  const cleanBarcode = String(scan.barcode || '').trim();
  if (cleanBarcode) {
    const barcodeMatches = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.barcode && String(it.barcode).trim() === cleanBarcode)
      .map(({ idx }) => idx);

    if (barcodeMatches.length === 1) {
      return { index: barcodeMatches[0], ambiguous: false, candidates: barcodeMatches };
    }
    if (barcodeMatches.length > 1) {
      const unchecked = barcodeMatches.filter((i) => !items[i].isChecked);
      if (unchecked.length >= 1) {
        return { index: unchecked[0], ambiguous: false, candidates: barcodeMatches };
      }
      return { index: barcodeMatches[0], ambiguous: false, candidates: barcodeMatches };
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
    const c1 = generateProductCode(s);
    const c2 = normalizeToUpperCode(s);
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

    const itemTokens = Array.from(
      new Set([
        ...tokensOf(item.productName),
        ...tokensOf(item.color),
        ...tokensOf(item.size),
        ...(code ? tokensOf(code) : []),
      ])
    );
    if (itemTokens.length === 0) {
      return code && tagCodes.has(code) ? 1 : 0;
    }

    // Mã mẫu/SKU (có chữ số, độ dài vừa phải <= 12) trên dòng hàng phải xuất hiện trên tag
    const skuTokens = itemTokens.filter((t) => isSkuToken(t) && t.length <= 14);
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

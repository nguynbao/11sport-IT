import { generateProductCode, normalizeToUpperCode } from './productCode';

/**
 * So khớp kết quả quét tag với các dòng trong phiếu nhập (danh sách đã OCR ở bước Kiểm hàng).
 * - Ưu tiên khớp chính xác mã vạch (barcode) đã được ghi nhớ trên dòng hàng.
 * - Tiếp theo khớp chính xác mã hàng (productCode).
 * - Sau đó chấm điểm theo token của mã hàng (mã mẫu/SKU có chữ số bắt buộc phải khớp, màu/size phải có trên tag).
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
  normalizeToUpperCode(String(s || ''))
    .split('_')
    .filter(Boolean);

const isSkuToken = (t: string) => t.length >= 3 && /\d/.test(t);

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
      if (unchecked.length === 1) {
        return { index: unchecked[0], ambiguous: false, candidates: barcodeMatches };
      }
      if (unchecked.length > 1) {
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
    if (!code) return 0;
    if (tagCodes.has(code)) return 10; // khớp chính xác mã hàng

    const itemTokens = Array.from(new Set(code.split('_').filter(Boolean)));
    if (itemTokens.length === 0) return 0;

    // Mã mẫu/SKU (có chữ số) trên dòng hàng phải xuất hiện trên tag
    const skuTokens = itemTokens.filter(isSkuToken);
    if (skuTokens.length > 0 && !skuTokens.every((t) => tagTokens.has(t))) return 0;

    const hit = itemTokens.filter((t) => tagTokens.has(t)).length;
    const ratio = hit / itemTokens.length;
    // Có SKU khớp => đủ điều kiện, phần còn lại (màu/size...) dùng để phân biệt các biến thể
    let score = skuTokens.length > 0 ? 0.6 + 0.39 * ratio : ratio;

    // Tag chứa nguyên mã hàng (VD tag in đầy đủ chuỗi trong ngoặc đơn kèm chữ khác)
    for (const tc of tagCodes) {
      if (tc.includes(code)) score = Math.max(score, 0.995);
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

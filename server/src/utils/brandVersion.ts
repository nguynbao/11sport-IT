/**
 * v5.0 — Tiện ích nhận diện Thương hiệu (Brand) & Version từ tên sản phẩm,
 * dựng danh sách Brand seed và CateCode (Category.skuCode).
 * Dùng chung cho: migration seed Brand, script chuyển đổi mã (recodeProducts), nhập kho.
 */
import {
  getKnownBrandList,
  isNoBrandToken,
  normalizeToCompactUpperCode,
  suggestBrandCode,
  suggestCategorySkuCode,
  suggestVersionCode,
  tokenizeUpperAlphaNum,
  NO_BRAND_CODE,
} from './productCode';

export interface BrandLike {
  _id?: string;
  code: string;
  name: string;
  aliases?: string[];
  status?: string;
  isSystem?: boolean;
  categoryIds?: string[];
}

export const SYSTEM_BRAND_NAME = 'Không hãng (NN)';
export const SYSTEM_BRAND_ALIASES = ['NN', 'No name', 'Noname', 'Không hãng', 'OEM'];

/** Tên gọi khác phổ biến (viết sai/viết liền) để nhận diện hãng khi import */
const EXTRA_ALIASES: Record<string, string[]> = {
  ZOCKER: ['Zoker'],
  SIXZERO: ['SixZero', 'Six-Zero'],
  DONGLUC: ['Dong Luc', 'DongLuc'],
  THUONGDINH: ['Thuong Dinh', 'ThuongDinh'],
  UNDERARMOUR: ['UnderArmour'],
  NEWBALANCE: ['NewBalance'],
  LINING: ['Li-Ning', 'Li Ning'],
  JOGABOLA: ['Jogarbola'],
  BITIS: ["Biti's"],
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Các cụm từ (token IN HOA không dấu) dùng để nhận diện 1 brand trong chuỗi */
export function brandTerms(brand: Pick<BrandLike, 'name' | 'aliases'>): string[][] {
  const raws = [brand.name, ...(brand.aliases || [])].filter(Boolean) as string[];
  const terms: string[][] = [];
  for (const r of raws) {
    if (isNoBrandToken(r)) continue;
    const toks = tokenizeUpperAlphaNum(r);
    if (toks.length > 0) terms.push(toks);
    if (toks.length > 1) terms.push([toks.join('')]);
  }
  const seen = new Set<string>();
  return terms.filter((t) => {
    const k = t.join(' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function findTermIndex(words: string[], term: string[]): number {
  for (let i = 0; i + term.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < term.length; j++) {
      if (words[i + j] !== term[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/** Tìm brand xuất hiện trong chuỗi (ưu tiên cụm dài nhất). Bỏ qua brand hệ thống NN. */
export function matchBrandInText<T extends BrandLike>(text: string, brands: T[]): T | null {
  const words = tokenizeUpperAlphaNum(text);
  if (words.length === 0) return null;
  let best: { brand: T; len: number; idx: number } | null = null;
  for (const b of brands) {
    if (b.isSystem || b.code === NO_BRAND_CODE) continue;
    for (const term of brandTerms(b)) {
      const idx = findTermIndex(words, term);
      if (idx < 0) continue;
      const len = term.join('').length;
      if (!best || len > best.len || (len === best.len && idx < best.idx)) {
        best = { brand: b, len, idx };
      }
    }
  }
  return best ? best.brand : null;
}

/** Tìm brand trùng khớp chính xác theo tên/mã/alias */
export function findBrandExact<T extends BrandLike>(input: string, brands: T[]): T | null {
  const key = normalizeToCompactUpperCode(input);
  if (!key) return null;
  return (
    brands.find((b) => normalizeToCompactUpperCode(b.name) === key) ||
    brands.find((b) => b.code === key) ||
    brands.find((b) => (b.aliases || []).some((a) => normalizeToCompactUpperCode(a) === key)) ||
    null
  );
}

/** Danh sách brand dựng sẵn từ KNOWN_BRANDS (chưa có code mới) */
export function knownBrandCandidates(): BrandLike[] {
  return getKnownBrandList().map((k) => ({
    code: '',
    name: k.display,
    aliases: uniq([k.code, ...(EXTRA_ALIASES[k.code] || [])]),
  }));
}

export interface ResolvedBrand<T extends BrandLike> {
  brand: T | null;
  /** Tên hiển thị của hãng ('' nếu không hãng) */
  name: string;
  source: 'FIELD' | 'NAME' | 'NONE';
}

/**
 * Xác định brand của 1 sản phẩm: ưu tiên trường brand (nếu không phải NN/rỗng), sau đó tên sản phẩm.
 * `brands` là danh sách Brand trong DB (hoặc danh sách ứng viên khi chưa seed).
 */
export function resolveBrandForProduct<T extends BrandLike>(
  product: { brand?: string; brandName?: string; name?: string },
  brands: T[]
): ResolvedBrand<T> {
  const field = String(product.brandName || product.brand || '').trim();
  if (field && !isNoBrandToken(field)) {
    const exact = findBrandExact(field, brands) || matchBrandInText(field, brands);
    return { brand: exact, name: exact ? exact.name : field, source: 'FIELD' };
  }
  const fromName = matchBrandInText(String(product.name || ''), brands);
  if (fromName) return { brand: fromName, name: fromName.name, source: 'NAME' };
  return { brand: null, name: '', source: 'NONE' };
}

/** Bỏ tên hãng khỏi tên sản phẩm để lấy Version (giữ nguyên chữ có dấu của phần còn lại). */
export function stripBrandFromName(name: string, brand: Pick<BrandLike, 'name' | 'aliases'> | null): string {
  const raw = String(name || '').trim();
  if (!brand) return raw;
  const words = raw.split(/\s+/).filter(Boolean);
  const folded = words.map((w) => normalizeToCompactUpperCode(w));
  const terms = brandTerms(brand).sort((a, b) => b.join('').length - a.join('').length);
  for (const term of terms) {
    // So khớp theo từng từ đã chuẩn hoá; 1 từ gốc có thể chứa cả cụm viết liền (VD "SixZero")
    for (let i = 0; i < folded.length; i++) {
      let j = i;
      let acc = '';
      const target = term.join('');
      while (j < folded.length && acc.length < target.length) {
        acc += folded[j];
        j++;
      }
      if (acc === target) {
        const rest = [...words.slice(0, i), ...words.slice(j)].join(' ');
        const cleaned = rest.replace(/^[\s\-–—_/,:.]+|[\s\-–—_/,:.]+$/g, '').replace(/\s{2,}/g, ' ').trim();
        return cleaned || raw;
      }
    }
  }
  return raw;
}

/** Đề xuất versionName + versionCode từ tên sản phẩm và brand đã nhận diện */
export function proposeVersion(
  productName: string,
  brand: Pick<BrandLike, 'name' | 'aliases'> | null
): { versionName: string; versionCode: string } {
  const versionName = stripBrandFromName(productName, brand);
  const versionCode = suggestVersionCode(versionName) || suggestVersionCode(productName) || 'V1';
  return { versionName, versionCode };
}

export interface BrandSeedItem {
  code: string;
  name: string;
  aliases: string[];
  categoryIds: string[];
  isSystem: boolean;
  productCount: number;
}

/**
 * Dựng danh sách Brand seed tất định (cùng DB => cùng kết quả) cho migration & dry-run:
 * 1. Brand đang có trong sản phẩm (trường brand hoặc nhận diện từ tên), sắp theo số sản phẩm giảm dần;
 * 2. Các brand còn lại trong KNOWN_BRANDS (chưa gắn Category);
 * 3. Brand hệ thống NN.
 * `existing` = Brand đã có trong DB (giữ nguyên code).
 */
export function buildBrandSeedList(
  products: { brand?: string; name?: string; categoryId?: string }[],
  existing: BrandLike[] = []
): BrandSeedItem[] {
  const candidates = knownBrandCandidates();
  const pool: BrandLike[] = [...existing, ...candidates];
  const byKey = new Map<string, { name: string; aliases: string[]; categoryIds: Set<string>; count: number }>();

  for (const p of products) {
    const resolved = resolveBrandForProduct(p, pool);
    if (!resolved.name) continue;
    const key = normalizeToCompactUpperCode(resolved.name);
    if (!key) continue;
    const entry =
      byKey.get(key) ||
      {
        name: resolved.name,
        aliases: resolved.brand?.aliases ? [...resolved.brand.aliases] : [],
        categoryIds: new Set<string>(),
        count: 0,
      };
    if (p.categoryId) entry.categoryIds.add(String(p.categoryId));
    entry.count += 1;
    byKey.set(key, entry);
  }

  const used = new Set<string>([NO_BRAND_CODE, ...existing.map((b) => b.code).filter(Boolean)]);
  const existingByKey = new Map(existing.map((b) => [normalizeToCompactUpperCode(b.name), b]));
  const result: BrandSeedItem[] = [];

  const fromProducts = Array.from(byKey.entries()).sort(
    (a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name)
  );
  for (const [key, e] of fromProducts) {
    const ex = existingByKey.get(key);
    const code = ex?.code || suggestBrandCode(e.name, used);
    used.add(code);
    result.push({
      code,
      name: ex?.name || e.name,
      aliases: uniq([...(ex?.aliases || []), ...e.aliases]),
      categoryIds: Array.from(e.categoryIds),
      isSystem: false,
      productCount: e.count,
    });
  }

  const taken = new Set(result.map((r) => normalizeToCompactUpperCode(r.name)));
  for (const c of candidates) {
    const key = normalizeToCompactUpperCode(c.name);
    if (taken.has(key)) continue;
    taken.add(key);
    const ex = existingByKey.get(key);
    const code = ex?.code || suggestBrandCode(c.name, used);
    used.add(code);
    result.push({
      code,
      name: ex?.name || c.name,
      aliases: uniq([...(ex?.aliases || []), ...(c.aliases || [])]),
      categoryIds: [],
      isSystem: false,
      productCount: 0,
    });
  }

  result.push({
    code: NO_BRAND_CODE,
    name: SYSTEM_BRAND_NAME,
    aliases: SYSTEM_BRAND_ALIASES,
    categoryIds: [],
    isSystem: true,
    productCount: 0,
  });
  return result;
}

/** Gán skuCode cho các category chưa có (tất định theo thứ tự truyền vào). */
export function assignCategorySkuCodes<T extends { _id?: any; code?: string; name?: string; skuCode?: string }>(
  categories: T[]
): Map<string, string> {
  const used = new Set<string>(categories.map((c) => String(c.skuCode || '')).filter(Boolean));
  const out = new Map<string, string>();
  for (const c of categories) {
    if (c.skuCode) {
      out.set(String(c._id), String(c.skuCode));
      continue;
    }
    const sku = suggestCategorySkuCode(String(c.name || ''), String(c.code || ''), used);
    used.add(sku);
    out.set(String(c._id), sku);
  }
  return out;
}

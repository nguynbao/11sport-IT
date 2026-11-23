/**
 * Chuyển đổi mã sản phẩm cũ sang quy chuẩn v5.0: CateCode + BrandCode + VersionCode (+ ColorCode + SizeCode).
 * Yêu cầu: docs/requirements/ma-san-pham-brand-version-v1.md (mục 3). CHỈ CHẠY TRÊN DB LOCAL.
 *
 * Điểm chạy CLI: src/scripts/recodeProductsCli.ts
 *   npm run recode:products                         # = --dry-run: xuất file review CSV (UTF-8 BOM, mở bằng Excel), KHÔNG ghi DB
 *   npm run recode:products -- --apply <file.csv>   # đọc file đã duyệt -> backup -> đổi mã tại chỗ -> báo cáo đối soát
 *
 * An toàn:
 *  - Từ chối chạy nếu MONGODB_URI không trỏ 127.0.0.1/localhost hoặc là mongodb+srv (KHÔNG BAO GIỜ chạy production).
 *  - --apply luôn backup trước (mongodump nếu có + dump EJSON từng collection) vào server/backups/.
 *  - Dùng transaction nếu MongoDB là replica set; nếu không thì ghi tuần tự (đã có backup để khôi phục).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { BSON, MongoClient, Db, ObjectId, ClientSession } from 'mongodb';
import {
  NO_BRAND_CODE,
  buildRootCode,
  buildVariantKey,
  buildVariantSku,
  estimateCode128Dots,
  isLegacyProductCode,
  isValidSkuPart,
  normalizeToCompactUpperCode,
  suggestColorCode,
  toSizeCode,
} from '../utils/productCode';
import {
  BrandSeedItem,
  assignCategorySkuCodes,
  buildBrandSeedList,
  proposeVersion,
  resolveBrandForProduct,
  SYSTEM_BRAND_ALIASES,
  SYSTEM_BRAND_NAME,
} from '../utils/brandVersion';
import { parseXlsxBufferToMatrix } from '../utils/fileImportParser';

/* ------------------------------------------------------------------ Guard */

export function assertLocalMongoUri(uri: string | undefined): string {
  const u = String(uri || '').trim();
  if (!u) throw new Error('Thiếu MONGODB_URI. Script chỉ chạy với DB local (127.0.0.1 / localhost).');
  if (/^mongodb\+srv:/i.test(u)) throw new Error('Từ chối chạy: MONGODB_URI là mongodb+srv (cloud/production).');
  const hostPart = u.replace(/^mongodb:\/\//i, '').split('/')[0].split('@').pop() || '';
  const hosts = hostPart.split(',').map((h) => h.split(':')[0].toLowerCase());
  if (hosts.length === 0 || hosts.some((h) => h !== '127.0.0.1' && h !== 'localhost')) {
    throw new Error(`Từ chối chạy: MONGODB_URI không trỏ 127.0.0.1/localhost (host: ${hosts.join(',')}).`);
  }
  return u;
}

/* ------------------------------------------------------------------ Types */

export const REVIEW_COLUMNS = [
  'stt',
  'productId',
  'status',
  'mergeIntoCode',
  'legacyCode',
  'productName',
  'unit',
  'categoryId',
  'categoryName',
  'cateCode',
  'brandName',
  'brandCode',
  'versionName',
  'versionCode',
  'newCode',
  'variantKey',
  'color',
  'size',
  'legacyVariantCode',
  'colorCode',
  'sizeCode',
  'newVariantCode',
  'stockFloor1',
  'stockFloor2',
  'note',
] as const;

export type ReviewRow = Record<(typeof REVIEW_COLUMNS)[number], string>;

export interface PlanStats {
  products: number;
  alreadyRecoded: number;
  variants: number;
  mergeGroups: number;
  mergedAway: number;
  conflicts: number;
  noBrand: number;
  brandsToCreate: number;
}

export interface RecodePlan {
  rows: ReviewRow[];
  stats: PlanStats;
  brandSeed: BrandSeedItem[];
  categorySku: Map<string, string>;
}

const norm = (v: any) => normalizeToCompactUpperCode(String(v ?? ''));

/** Đổi VersionCode khi trùng: thay đuôi bằng số thứ tự; luôn giữ ít nhất 1 chữ cái để không trùng định dạng mã cũ */
function bumpVersion(vc: string, n: number): string {
  const s = String(n);
  const out = `${vc.slice(0, Math.max(1, 6 - s.length))}${s}`;
  if (/[A-Z]/.test(out)) return out;
  return `${vc.slice(0, Math.max(0, 5 - s.length))}V${s}`;
}

function productVariants(p: any): any[] {
  return Array.isArray(p.variants) ? p.variants : [];
}

/* ------------------------------------------------------------------ Dry-run (plan) */

export async function buildRecodePlan(db: Db): Promise<RecodePlan> {
  const categories = await db.collection('categories').find({}).sort({ createdAt: 1 }).toArray();
  const products = await db.collection('products').find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  const existingBrands = await db.collection('brands').find({}).toArray();
  const catById = new Map(categories.map((c: any) => [String(c._id), c]));
  const categorySku = assignCategorySkuCodes(categories as any[]);

  const brandSeed = buildBrandSeedList(
    products.map((p: any) => ({ brand: p.brandName || p.brand, name: p.name, categoryId: String(p.categoryId || '') })),
    existingBrands.map((b: any) => ({ _id: String(b._id), code: b.code, name: b.name, aliases: b.aliases || [] }))
  );
  const brandPool = brandSeed.filter((b) => !b.isSystem);
  const existingCodes = new Set(existingBrands.map((b: any) => b.code));

  const stats: PlanStats = {
    products: products.length,
    alreadyRecoded: 0,
    variants: 0,
    mergeGroups: 0,
    mergedAway: 0,
    conflicts: 0,
    noBrand: 0,
    brandsToCreate: 0,
  };

  interface Draft {
    p: any;
    cateCode: string;
    brand: { code: string; name: string };
    versionName: string;
    versionCode: string;
    root: string;
    status: 'OK' | 'MERGE' | 'CONFLICT' | 'NN' | 'ALREADY';
    mergeInto?: Draft;
    notes: string[];
  }
  const drafts: Draft[] = [];
  const groups = new Map<string, Draft>(); // root -> target draft
  const usedBrandCodes = new Set<string>();

  for (const p of products as any[]) {
    if (p.versionCode && p.legacyCode) {
      stats.alreadyRecoded += 1;
      const d: Draft = {
        p,
        cateCode: categorySku.get(String(p.categoryId)) || '',
        brand: { code: p.brandCode || NO_BRAND_CODE, name: p.brandName || '' },
        versionName: p.versionName || '',
        versionCode: p.versionCode,
        root: p.code,
        status: 'ALREADY',
        notes: ['Đã chuyển đổi trước đó — bỏ qua'],
      };
      groups.set(p.code, d);
      drafts.push(d);
      continue;
    }
    const notes: string[] = [];
    const cat = catById.get(String(p.categoryId));
    let cateCode = categorySku.get(String(p.categoryId)) || '';
    if (!cat || !cateCode) {
      cateCode = 'X';
      notes.push('Không tìm thấy danh mục của sản phẩm — cần gán danh mục trước');
    }
    const resolved = resolveBrandForProduct({ brand: p.brandName || p.brand, name: p.name }, brandPool);
    const brandItem = resolved.brand;
    const brand = brandItem ? { code: brandItem.code, name: brandItem.name } : { code: NO_BRAND_CODE, name: '' };
    if (resolved.source === 'NAME') notes.push(`Nhận diện hãng "${brand.name}" từ tên sản phẩm`);
    if (!brandItem && resolved.name) notes.push(`Hãng "${resolved.name}" không nhận diện được — dùng NN`);
    usedBrandCodes.add(brand.code);
    const proposal = proposeVersion(String(p.name || ''), brandItem || null);
    let versionName = proposal.versionName;
    let baseVc = proposal.versionCode;
    if (!/[A-Z]/.test(baseVc)) baseVc = `${baseVc.slice(0, 5)}V`;
    let versionCode = baseVc;
    let status: Draft['status'] = brand.code === NO_BRAND_CODE ? 'NN' : 'OK';
    let mergeInto: Draft | undefined;
    let root = '';
    for (let n = 2; n < 100; n++) {
      root = buildRootCode(cateCode, brand.code, versionCode);
      if (isLegacyProductCode(root)) {
        notes.push(`Mã ${root} trùng định dạng mã cũ — tự thêm chữ V vào VersionCode`);
        versionCode = `${versionCode.slice(0, 5)}V`;
        continue;
      }
      const g = groups.get(root);
      if (!g) break;
      const sameModel =
        g.status !== 'ALREADY' &&
        String(g.p.categoryId) === String(p.categoryId) &&
        norm(g.versionName) === norm(versionName) &&
        g.brand.code === brand.code;
      const sameUnit = norm(g.p.unit || 'Cái') === norm(p.unit || 'Cái');
      if (sameModel && sameUnit) {
        mergeInto = g.mergeInto || g;
        status = 'MERGE';
        notes.push(`Gộp vào ${mergeInto.p.code} (cùng Danh mục + Hãng + Version)`);
        break;
      }
      status = 'CONFLICT';
      if (sameModel && !sameUnit) {
        const unitTag = norm(p.unit || '').slice(0, 1) || 'U';
        notes.push(`Trùng mẫu với ${g.p.code} nhưng khác ĐVT (${g.p.unit} ≠ ${p.unit}) — tách mã, cần duyệt`);
        versionName = `${proposal.versionName} (${p.unit})`;
        versionCode = n === 2 ? `${baseVc.slice(0, 5)}${unitTag}` : bumpVersion(`${baseVc.slice(0, 4)}${unitTag}`, n);
      } else {
        notes.push(`Mã ${root} trùng với ${g.p.code} (Version khác) — tự đổi VersionCode, cần duyệt`);
        versionCode = bumpVersion(baseVc, n);
      }
    }
    const d: Draft = { p, cateCode, brand, versionName, versionCode, root, status, mergeInto, notes };
    if (!cat) d.status = 'CONFLICT';
    if (!mergeInto) groups.set(root, d);
    drafts.push(d);
  }

  // ColorCode theo sản phẩm cuối (sau gộp) & mã con
  const finalOf = (d: Draft) => d.mergeInto || d;
  const colorMaps = new Map<Draft, Map<string, string>>();
  const ownerOfCode = new Map<string, Draft>();
  const rows: ReviewRow[] = [];
  const mergeTargets = new Set<Draft>();
  for (const d of drafts) if (d.mergeInto) mergeTargets.add(d.mergeInto);
  stats.mergeGroups = mergeTargets.size;
  stats.mergedAway = drafts.filter((d) => d.mergeInto).length;

  // Mã gốc mới cũng phải không trùng mã cũ của sản phẩm KHÁC (tránh quét nhầm tem cũ)
  const legacyOwner = new Map<string, Draft>();
  for (const d of drafts) {
    legacyOwner.set(norm(d.p.code), d);
    for (const v of productVariants(d.p)) if (v.variantCode) legacyOwner.set(norm(v.variantCode), d);
  }

  let stt = 0;
  for (const d of drafts) {
    const target = finalOf(d);
    if (d.status === 'NN' || (d.status !== 'ALREADY' && d.brand.code === NO_BRAND_CODE)) stats.noBrand += 1;
    let cmap = colorMaps.get(target);
    if (!cmap) {
      cmap = new Map();
      for (const v of productVariants(target.p)) {
        if (v.colorCode && v.color) cmap.set(norm(v.color), String(v.colorCode));
      }
      colorMaps.set(target, cmap);
    }
    const rootOwnerLegacy = legacyOwner.get(norm(target.root));
    if (d === target && rootOwnerLegacy && rootOwnerLegacy !== d && finalOf(rootOwnerLegacy) !== d) {
      d.status = 'CONFLICT';
      d.notes.push(`Mã mới ${target.root} trùng mã cũ của ${rootOwnerLegacy.p.code}`);
    }
    if (d === target) {
      const prev = ownerOfCode.get(target.root);
      if (prev && prev !== target) {
        d.status = 'CONFLICT';
        d.notes.push(`Mã mới ${target.root} trùng mã con của ${prev.p.code}`);
      }
      ownerOfCode.set(target.root, target);
    }
    const variants = productVariants(d.p);
    const baseRow = {
      productId: String(d.p._id),
      status: d.status,
      mergeIntoCode: d.mergeInto ? d.mergeInto.p.code : '',
      legacyCode: d.p.legacyCode && d.status === 'ALREADY' ? d.p.legacyCode : d.p.code,
      productName: d.p.name || '',
      unit: d.p.unit || '',
      categoryId: String(d.p.categoryId || ''),
      categoryName: catById.get(String(d.p.categoryId))?.name || d.p.categoryName || '',
      cateCode: d.cateCode,
      brandName: d.brand.name,
      brandCode: d.brand.code,
      versionName: d.versionName,
      versionCode: d.versionCode,
      newCode: target.root,
    };
    if (variants.length === 0) {
      rows.push({
        stt: String(++stt),
        ...baseRow,
        variantKey: '',
        color: '',
        size: '',
        legacyVariantCode: '',
        colorCode: '',
        sizeCode: '',
        newVariantCode: '',
        stockFloor1: String(Number(d.p.stockFloor1 || 0)),
        stockFloor2: String(Number(d.p.stockFloor2 || 0)),
        note: d.notes.join(' | '),
      });
      continue;
    }
    for (const v of variants) {
      stats.variants += 1;
      const ck = norm(v.color);
      let cc = '';
      if (ck) {
        cc = cmap.get(ck) || (v.colorCode ? String(v.colorCode) : '') || suggestColorCode(String(v.color), new Set(cmap.values()));
        cmap.set(ck, cc);
      }
      const vsku = buildVariantSku(target.root, cc, v.size);
      const vNotes = [...d.notes];
      const owner = ownerOfCode.get(vsku);
      if (owner && owner !== target) {
        d.status = 'CONFLICT';
        vNotes.push(`Mã con ${vsku} trùng mã của ${owner.p.code}`);
      }
      ownerOfCode.set(vsku, target);
      if (estimateCode128Dots(vsku) > 200) {
        vNotes.push(`Mã con ${vsku} dài (> 200 dots, có thể tràn tem 35mm) — nên rút ColorCode/VersionCode`);
      }
      const lOwner = legacyOwner.get(norm(vsku));
      if (lOwner && finalOf(lOwner) !== target) {
        d.status = 'CONFLICT';
        vNotes.push(`Mã con ${vsku} trùng mã cũ của ${lOwner.p.code}`);
      }
      rows.push({
        stt: String(++stt),
        ...baseRow,
        status: d.status,
        variantKey: buildVariantKey(v.color, v.size),
        color: String(v.color || ''),
        size: String(v.size || ''),
        legacyVariantCode: String(v.legacyVariantCode || v.variantCode || ''),
        colorCode: cc,
        sizeCode: toSizeCode(v.size),
        newVariantCode: vsku,
        stockFloor1: String(Number(v.stockFloor1 || 0)),
        stockFloor2: String(Number(v.stockFloor2 || 0)),
        note: vNotes.join(' | '),
      });
    }
  }
  // Đồng bộ status CONFLICT cho mọi dòng của cùng sản phẩm
  const conflictIds = new Set(rows.filter((r) => r.status === 'CONFLICT').map((r) => r.productId));
  for (const r of rows) if (conflictIds.has(r.productId)) r.status = 'CONFLICT';
  stats.conflicts = conflictIds.size;
  stats.brandsToCreate = Array.from(usedBrandCodes).filter((c) => !existingCodes.has(c)).length;
  return { rows, stats, brandSeed, categorySku };
}

/* ------------------------------------------------------------------ CSV I/O */

function csvEscape(v: string): string {
  const s = String(v ?? '');
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeReviewCsv(rows: ReviewRow[], filePath: string): void {
  const lines = [REVIEW_COLUMNS.join(','), ...rows.map((r) => REVIEW_COLUMNS.map((c) => csvEscape(r[c])).join(','))];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
}

/** Đọc CSV (dấu phẩy hoặc chấm phẩy, có/không BOM) hoặc XLSX đã duyệt */
export function readReviewFile(filePath: string): ReviewRow[] {
  const buf = fs.readFileSync(filePath);
  let matrix: string[][];
  if (/\.xlsx$/i.test(filePath)) {
    matrix = parseXlsxBufferToMatrix(buf);
  } else {
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    matrix = parseCsvStrict(text, delimiter);
  }
  if (matrix.length === 0) throw new Error('File review rỗng');
  const header = matrix[0].map((h) => String(h || '').trim());
  for (const col of ['productId', 'cateCode', 'brandCode', 'brandName', 'versionName', 'versionCode', 'variantKey', 'colorCode']) {
    if (!header.includes(col)) throw new Error(`File review thiếu cột bắt buộc: ${col}`);
  }
  return matrix
    .slice(1)
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => {
      const row: any = {};
      for (const col of REVIEW_COLUMNS) {
        const idx = header.indexOf(col);
        row[col] = idx >= 0 ? String(r[idx] ?? '').trim() : '';
      }
      return row as ReviewRow;
    });
}

/** Parser CSV theo RFC 4180 (ngoặc kép, xuống dòng trong ô, "" escape) */
function parseCsvStrict(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ Apply */

export interface ApplyOptions {
  backupDir: string;
  /** Chạy mongodump (nếu có trong PATH) trước khi ghi. Tắt trong test. */
  useMongodump?: boolean;
  uri?: string;
  client?: MongoClient;
  log?: (...args: any[]) => void;
}

export interface ApplyReport {
  backupPath: string;
  usedTransaction: boolean;
  productsBefore: number;
  productsAfter: number;
  recoded: number;
  mergedAway: number;
  brandsCreated: number;
  stockBefore: { floor1: number; floor2: number };
  stockAfter: { floor1: number; floor2: number };
  stockMatched: boolean;
  updatedRefs: Record<string, number>;
  remainingLegacyRefs: number;
  remainingLegacySamples: string[];
  orphanRefs: number;
}

const REF_COLLECTIONS = ['orders', 'stockmovements', 'importreceipts', 'returnexchanges', 'promotions', 'shifthandovers'];
const LEGACY_FIELDS = new Set(['legacyCode', 'legacyCodes', 'legacyVariantCode', 'legacyVariantCodes']);
const CODE_FIELDS = new Set(['code', 'productCode', 'variantCode', 'barcode']);

async function totalStock(db: Db, session?: ClientSession) {
  const res = await db
    .collection('products')
    .aggregate(
      [{ $group: { _id: null, f1: { $sum: { $ifNull: ['$stockFloor1', 0] } }, f2: { $sum: { $ifNull: ['$stockFloor2', 0] } } } }],
      { session }
    )
    .toArray();
  return { floor1: Number(res[0]?.f1 || 0), floor2: Number(res[0]?.f2 || 0) };
}

export async function backupDatabase(db: Db, opts: ApplyOptions): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(opts.backupDir, `recode-backup-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  if (opts.useMongodump && opts.uri) {
    try {
      execFileSync('mongodump', [`--uri=${opts.uri}`, `--archive=${path.join(dir, 'mongodump.archive.gz')}`, '--gzip'], {
        stdio: 'ignore',
      });
      opts.log?.(`✔ mongodump -> ${path.join(dir, 'mongodump.archive.gz')}`);
    } catch (e: any) {
      opts.log?.(`⚠ mongodump không chạy được (${e?.message || e}) — dùng dump EJSON`);
    }
  }
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const docs = await db.collection(c.name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${c.name}.ejson`), BSON.EJSON.stringify(docs, { relaxed: false }), 'utf8');
  }
  opts.log?.(`✔ Dump EJSON ${cols.length} collection -> ${dir}`);
  return dir;
}

function walkCount(node: any, codes: Set<string>, samples: string[], pathKey = ''): number {
  if (node === null || node === undefined) return 0;
  if (Array.isArray(node)) return node.reduce((s, x) => s + walkCount(x, codes, samples, pathKey), 0);
  if (node instanceof ObjectId || node instanceof Date) return 0;
  if (typeof node === 'object') {
    let s = 0;
    for (const [k, v] of Object.entries(node)) {
      if (LEGACY_FIELDS.has(k)) continue;
      if (typeof v === 'string') {
        if (CODE_FIELDS.has(k) && codes.has(norm(v))) {
          s += 1;
          if (samples.length < 20) samples.push(`${pathKey}.${k}=${v}`);
        }
      } else s += walkCount(v, codes, samples, `${pathKey}.${k}`);
    }
    return s;
  }
  return 0;
}

export async function applyRecode(db: Db, review: ReviewRow[], opts: ApplyOptions): Promise<ApplyReport> {
  const log = opts.log || (() => undefined);
  const products = await db.collection('products').find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  const categories = await db.collection('categories').find({}).toArray();
  const brands = await db.collection('brands').find({}).toArray();
  const prodById = new Map(products.map((p: any) => [String(p._id), p]));
  const catById = new Map(categories.map((c: any) => [String(c._id), c]));

  // ---- 1. Đọc & kiểm tra file review
  interface ProdPlan {
    p: any;
    cateCode: string;
    brandCode: string;
    brandName: string;
    versionName: string;
    versionCode: string;
    root: string;
    colorByKey: Map<string, string>;
  }
  const plans = new Map<string, ProdPlan>();
  const errors: string[] = [];
  for (const r of review) {
    if (!r.productId) continue;
    const p = prodById.get(r.productId);
    if (!p) {
      errors.push(`Dòng ${r.stt}: không tìm thấy sản phẩm ${r.productId} (${r.legacyCode}) trong DB`);
      continue;
    }
    if (p.versionCode && p.legacyCode) continue; // đã chuyển đổi
    let plan = plans.get(r.productId);
    if (!plan) {
      const cateCode = r.cateCode.toUpperCase();
      const brandCode = r.brandCode.toUpperCase();
      const versionCode = r.versionCode.toUpperCase();
      if (!isValidSkuPart(cateCode, 'category')) errors.push(`Dòng ${r.stt}: cateCode "${cateCode}" không hợp lệ (1–3 ký tự A-Z0-9)`);
      if (!isValidSkuPart(brandCode, 'brand')) errors.push(`Dòng ${r.stt}: brandCode "${brandCode}" không hợp lệ (2–4 ký tự)`);
      if (!isValidSkuPart(versionCode, 'version')) errors.push(`Dòng ${r.stt}: versionCode "${versionCode}" không hợp lệ (≤ 6 ký tự)`);
      if (!r.versionName) errors.push(`Dòng ${r.stt}: thiếu versionName`);
      const root = buildRootCode(cateCode, brandCode, versionCode);
      if (isLegacyProductCode(root)) errors.push(`Dòng ${r.stt}: mã ${root} trùng định dạng mã cũ`);
      plan = {
        p,
        cateCode,
        brandCode,
        brandName: brandCode === NO_BRAND_CODE ? '' : r.brandName,
        versionName: r.versionName,
        versionCode,
        root,
        colorByKey: new Map(),
      };
      plans.set(r.productId, plan);
    } else if (
      plan.cateCode !== r.cateCode.toUpperCase() ||
      plan.brandCode !== r.brandCode.toUpperCase() ||
      plan.versionCode !== r.versionCode.toUpperCase()
    ) {
      errors.push(`Dòng ${r.stt}: cateCode/brandCode/versionCode khác các dòng trước của cùng sản phẩm ${plan.p.code}`);
    }
    if (r.variantKey) {
      const cc = r.colorCode.toUpperCase();
      if (r.color && !isValidSkuPart(cc, 'color')) errors.push(`Dòng ${r.stt}: colorCode "${cc}" không hợp lệ (2–3 ký tự)`);
      plan.colorByKey.set(r.variantKey, r.color ? cc : '');
    }
  }
  for (const p of products as any[]) {
    if (p.versionCode && p.legacyCode) continue;
    if (!plans.has(String(p._id))) errors.push(`Sản phẩm ${p.code} (${p.name}) không có trong file review — chạy lại --dry-run`);
  }

  // CateCode thống nhất theo category
  const skuByCat = new Map<string, string>();
  for (const pl of plans.values()) {
    const cid = String(pl.p.categoryId);
    const cat = catById.get(cid);
    if (!cat) errors.push(`Sản phẩm ${pl.p.code}: không tìm thấy danh mục`);
    const prev = skuByCat.get(cid);
    if (prev && prev !== pl.cateCode) errors.push(`Danh mục ${cat?.name}: cateCode không thống nhất (${prev} / ${pl.cateCode})`);
    skuByCat.set(cid, pl.cateCode);
    if (cat?.skuCode && cat.skuCode !== pl.cateCode) {
      errors.push(`Danh mục ${cat.name} đã có skuCode ${cat.skuCode}, file ghi ${pl.cateCode}`);
    }
  }
  const catBySku = new Map<string, string>();
  for (const c of categories as any[]) if (c.skuCode) catBySku.set(c.skuCode, String(c._id));
  for (const [cid, sku] of skuByCat) {
    const owner = catBySku.get(sku);
    if (owner && owner !== cid) errors.push(`cateCode ${sku} đang thuộc danh mục khác`);
    catBySku.set(sku, cid);
  }

  // Gộp: cùng (categoryId, brandCode, versionCode)
  const groups = new Map<string, ProdPlan[]>();
  for (const pl of plans.values()) {
    const key = `${pl.p.categoryId}|${pl.brandCode}|${pl.versionCode}`;
    const list = groups.get(key) || [];
    list.push(pl);
    groups.set(key, list);
  }
  const rootOwner = new Map<string, string>();
  for (const [, list] of groups) {
    const units = new Set(list.map((pl) => norm(pl.p.unit || 'Cái')));
    if (units.size > 1) {
      errors.push(`Không gộp được ${list.map((x) => x.p.code).join(', ')}: khác ĐVT — sửa versionCode trong file`);
    }
    const root = list[0].root;
    if (rootOwner.has(root)) errors.push(`Mã ${root} bị trùng giữa các danh mục/hãng khác nhau`);
    rootOwner.set(root, list[0].p.code);
    for (const p of products as any[]) {
      if (norm(p.code) === root && !list.some((x) => x.p === p)) {
        errors.push(`Mã mới ${root} trùng mã hiện tại của sản phẩm khác ${p.code}`);
      }
    }
  }
  // Brand code <-> name thống nhất, không đụng brand khác trong DB
  const brandByCode = new Map(brands.map((b: any) => [b.code, b]));
  const nameByCode = new Map<string, string>();
  for (const pl of plans.values()) {
    if (pl.brandCode === NO_BRAND_CODE) continue;
    const prev = nameByCode.get(pl.brandCode);
    if (prev && norm(prev) !== norm(pl.brandName)) errors.push(`brandCode ${pl.brandCode} ứng với 2 tên hãng: ${prev} / ${pl.brandName}`);
    nameByCode.set(pl.brandCode, pl.brandName);
    const ex = brandByCode.get(pl.brandCode);
    if (ex && norm(ex.name) !== norm(pl.brandName)) {
      errors.push(`brandCode ${pl.brandCode} đã thuộc hãng "${ex.name}" trong DB, file ghi "${pl.brandName}"`);
    }
  }

  // Dựng sản phẩm đích + mã con, kiểm tra trùng toàn cục
  interface Target {
    keep: any;
    members: ProdPlan[];
    plan: ProdPlan;
    variants: any[];
    stockFloor1: number;
    stockFloor2: number;
    legacyCodes: string[];
    variantCodeMap: Map<string, string>; // old variant code -> new
    keyMap: Map<string, string>; // `${productId}|${variantKey}` -> new variant code
  }
  const targets: Target[] = [];
  const allNewCodes = new Map<string, string>();
  for (const [, list] of groups) {
    const keep = list[0];
    const anyVariants = list.some((pl) => productVariants(pl.p).length > 0);
    const merged = new Map<string, any>();
    const colorByColor = new Map<string, string>();
    const variantCodeMap = new Map<string, string>();
    const keyMap = new Map<string, string>();
    let f1 = 0;
    let f2 = 0;
    for (const pl of list) {
      const pv = productVariants(pl.p);
      const pSelling = Math.round(Number(pl.p.sellingPrice) || 0);
      const pCost = Math.round(Number(pl.p.costPrice) || 0);
      const keepSelling = Math.round(Number(keep.p.sellingPrice) || 0);
      const keepCost = Math.round(Number(keep.p.costPrice) || 0);
      const sources =
        pv.length > 0
          ? pv
          : anyVariants
          ? [{ variantKey: 'DEFAULT', color: '', size: '', stockFloor1: pl.p.stockFloor1 || 0, stockFloor2: pl.p.stockFloor2 || 0, variantCode: pl.p.code }]
          : [];
      if (sources.length === 0) {
        f1 += Number(pl.p.stockFloor1 || 0);
        f2 += Number(pl.p.stockFloor2 || 0);
      }
      for (const v of sources) {
        const key = buildVariantKey(v.color, v.size);
        const ck = norm(v.color);
        let cc = '';
        if (ck) {
          cc = colorByColor.get(ck) || pl.colorByKey.get(v.variantKey || key) || pl.colorByKey.get(key) || '';
          if (!cc) cc = suggestColorCode(String(v.color), new Set(colorByColor.values()));
          const holder = Array.from(colorByColor.entries()).find(([c, code]) => code === cc && c !== ck);
          if (holder) errors.push(`Sản phẩm ${keep.p.code}: colorCode ${cc} dùng cho 2 màu khác nhau`);
          colorByColor.set(ck, cc);
        }
        const newCode = buildVariantSku(keep.root, cc, v.size);
        const oldCode = String(v.variantCode || v.barcode || '');
        if (oldCode) variantCodeMap.set(norm(oldCode), newCode);
        keyMap.set(`${pl.p._id}|${key}`, newCode);
        const existing = merged.get(key);
        const vf1 = Math.max(0, Math.round(Number(v.stockFloor1) || 0));
        const vf2 = Math.max(0, Math.round(Number(v.stockFloor2) || 0));
        if (existing) {
          existing.stockFloor1 += vf1;
          existing.stockFloor2 += vf2;
          existing.stock = existing.stockFloor1 + existing.stockFloor2;
          if (oldCode) existing.legacyVariantCodes = Array.from(new Set([...(existing.legacyVariantCodes || []), norm(oldCode)]));
        } else {
          const rec: any = {
            ...v,
            variantKey: key,
            color: String(v.color || ''),
            size: String(v.size || ''),
            variantCode: newCode,
            barcode: newCode,
            stockFloor1: vf1,
            stockFloor2: vf2,
            stock: vf1 + vf2,
          };
          if (cc) rec.colorCode = cc;
          else delete rec.colorCode;
          if (oldCode) {
            rec.legacyVariantCode = norm(oldCode);
            rec.legacyVariantCodes = [norm(oldCode)];
          }
          // Giữ giá riêng khi gộp sản phẩm khác giá (R8)
          if (pl !== keep) {
            if (!rec.sellingPrice && pSelling > 0 && pSelling !== keepSelling) rec.sellingPrice = pSelling;
            if (!rec.costPrice && pCost > 0 && pCost !== keepCost) rec.costPrice = pCost;
          }
          merged.set(key, rec);
        }
      }
    }
    const variants = Array.from(merged.values());
    if (variants.length > 0) {
      f1 = variants.reduce((s, v) => s + v.stockFloor1, 0);
      f2 = variants.reduce((s, v) => s + v.stockFloor2, 0);
    }
    for (const code of [keep.root, ...variants.map((v) => v.variantCode)]) {
      const owner = allNewCodes.get(code);
      if (owner && owner !== keep.p.code) errors.push(`Mã ${code} trùng giữa ${owner} và ${keep.p.code}`);
      allNewCodes.set(code, keep.p.code);
    }
    targets.push({
      keep: keep.p,
      members: list,
      plan: keep,
      variants,
      stockFloor1: f1,
      stockFloor2: f2,
      legacyCodes: list.map((pl) => norm(pl.p.code)),
      variantCodeMap,
      keyMap,
    });
  }

  if (errors.length > 0) {
    const msg = `File review có ${errors.length} lỗi, KHÔNG ghi DB:\n- ${errors.slice(0, 50).join('\n- ')}`;
    throw new Error(msg);
  }

  // ---- 2. Backup
  const backupPath = await backupDatabase(db, { ...opts, log });
  const stockBefore = await totalStock(db);
  const productsBefore = products.length;

  // ---- 3. Ghi (transaction nếu replica set)
  let usedTransaction = false;
  let session: ClientSession | undefined;
  try {
    const hello = await db.admin().command({ hello: 1 });
    if (hello?.setName && opts.client) {
      session = opts.client.startSession();
      usedTransaction = true;
    }
  } catch {
    usedTransaction = false;
  }

  const idMap = new Map<string, string>(); // productId cũ -> productId giữ lại
  const rootMap = new Map<string, string>(); // mã gốc cũ -> mã gốc mới
  const variantMap = new Map<string, string>(); // mã con cũ -> mã con mới
  const keyMapAll = new Map<string, string>(); // productId|variantKey -> mã con mới
  const newRootById = new Map<string, string>();
  for (const t of targets) {
    for (const m of t.members) {
      idMap.set(String(m.p._id), String(t.keep._id));
      rootMap.set(norm(m.p.code), t.plan.root);
      newRootById.set(String(m.p._id), t.plan.root);
    }
    t.variantCodeMap.forEach((v, k) => variantMap.set(k, v));
    t.keyMap.forEach((v, k) => keyMapAll.set(k, v));
  }
  const oldIdByCode = new Map<string, string>();
  for (const p of products as any[]) oldIdByCode.set(norm(p.code), String(p._id));
  const colorCodeByRoot = new Map<string, Map<string, string>>();
  for (const t of targets) {
    const m = new Map<string, string>();
    for (const v of t.variants) if (v.colorCode && v.color) m.set(norm(v.color), v.colorCode);
    colorCodeByRoot.set(t.plan.root, m);
  }
  const variantCodeFor = (root: string, color: any, size: any): string => {
    const ck = norm(color);
    if (!ck) return buildVariantSku(root, '', size);
    const m = colorCodeByRoot.get(root) || new Map<string, string>();
    let cc = m.get(ck);
    if (!cc) {
      cc = suggestColorCode(String(color), new Set(m.values()));
      m.set(ck, cc);
      colorCodeByRoot.set(root, m);
    }
    return buildVariantSku(root, cc, size);
  };
  const mapCode = (code: any): string | null => {
    const k = norm(code);
    if (!k) return null;
    return rootMap.get(k) || variantMap.get(k) || null;
  };

  const updatedRefs: Record<string, number> = {};
  let brandsCreated = 0;

  const work = async (s?: ClientSession) => {
    // 3a. Brand + Category skuCode
    const brandIdByCode = new Map<string, string>();
    const nnExisting = await db.collection('brands').findOne({ code: NO_BRAND_CODE }, { session: s });
    if (!nnExisting) {
      const now = new Date();
      const ins = await db.collection('brands').insertOne(
        {
          code: NO_BRAND_CODE,
          name: SYSTEM_BRAND_NAME,
          status: 'ACTIVE',
          aliases: SYSTEM_BRAND_ALIASES,
          categoryIds: [],
          isSystem: true,
          createdAt: now,
          updatedAt: now,
        },
        { session: s }
      );
      brandIdByCode.set(NO_BRAND_CODE, String(ins.insertedId));
      brandsCreated += 1;
    } else brandIdByCode.set(NO_BRAND_CODE, String(nnExisting._id));

    for (const t of targets) {
      const { brandCode, brandName } = t.plan;
      const cid = String(t.keep.categoryId);
      if (brandCode === NO_BRAND_CODE) continue;
      let b = await db.collection('brands').findOne({ code: brandCode }, { session: s });
      if (!b) {
        const now = new Date();
        const ins = await db.collection('brands').insertOne(
          { code: brandCode, name: brandName, status: 'ACTIVE', aliases: [], categoryIds: [cid], isSystem: false, createdAt: now, updatedAt: now },
          { session: s }
        );
        brandsCreated += 1;
        b = { _id: ins.insertedId } as any;
      } else {
        await db.collection('brands').updateOne({ _id: b._id }, { $addToSet: { categoryIds: cid } }, { session: s });
      }
      brandIdByCode.set(brandCode, String(b!._id));
    }
    for (const [cid, sku] of skuByCat) {
      const cat = catById.get(cid);
      if (cat && !cat.skuCode) {
        await db.collection('categories').updateOne({ _id: cat._id }, { $set: { skuCode: sku } }, { session: s });
      }
    }

    // 3b. Sản phẩm: đổi mã tại chỗ (giữ _id), gộp, xoá bản đã gộp
    for (const t of targets) {
      const pl = t.plan;
      const set: Record<string, any> = {
        code: pl.root,
        barcode: pl.root,
        brand: pl.brandName,
        brandId: brandIdByCode.get(pl.brandCode),
        brandCode: pl.brandCode,
        brandName: pl.brandName,
        versionName: pl.versionName,
        versionCode: pl.versionCode,
        legacyCode: norm(t.keep.code),
        legacyCodes: t.legacyCodes,
        variants: t.variants,
        stockFloor1: t.stockFloor1,
        stockFloor2: t.stockFloor2,
        stock: t.stockFloor1 + t.stockFloor2,
        updatedAt: new Date(),
      };
      await db.collection('products').updateOne({ _id: t.keep._id }, { $set: set }, { session: s });
      for (const m of t.members) {
        if (m.p === t.keep) continue;
        await db.collection('products').deleteOne({ _id: m.p._id }, { session: s });
      }
    }
    // parentSetProductId trỏ vào sản phẩm đã gộp
    const linked = await db.collection('products').find({ parentSetProductId: { $nin: ['', null] } }, { session: s }).toArray();
    for (const lp of linked) {
      const to = idMap.get(String(lp.parentSetProductId));
      if (to && to !== String(lp.parentSetProductId)) {
        await db.collection('products').updateOne({ _id: lp._id }, { $set: { parentSetProductId: to } }, { session: s });
      }
    }

    // 3c. Bảng tham chiếu
    const remapLine = (line: any, opt: { variant?: boolean } = {}) => {
      if (!line || typeof line !== 'object') return false;
      let changed = false;
      const pid = String(line.productId || '');
      const newPid = pid ? idMap.get(pid) : undefined;
      const newRoot = (pid && newRootById.get(pid)) || mapCode(line.productCode);
      if (newPid && newPid !== pid) {
        line.productId = newPid;
        changed = true;
      }
      if (newRoot && norm(line.productCode) !== newRoot) {
        if (!line.legacyCode) line.legacyCode = String(line.productCode || '');
        line.productCode = newRoot;
        changed = true;
      }
      if (opt.variant) {
        const key = buildVariantKey(line.color, line.size);
        const oldPid = pid || oldIdByCode.get(norm(line.legacyCode || line.productCode)) || '';
        const byKey = oldPid ? keyMapAll.get(`${oldPid}|${key}`) : undefined;
        const oldVariant = String(line.variantCode || '');
        const newVariant =
          byKey || mapCode(oldVariant) || (newRoot ? variantCodeFor(newRoot, line.color, line.size) : null);
        if (newVariant && norm(oldVariant) !== newVariant) {
          if (!line.legacyVariantCode) line.legacyVariantCode = oldVariant;
          line.variantCode = newVariant;
          changed = true;
        }
        const mappedBarcode = mapCode(line.barcode);
        if (mappedBarcode || (line.barcode && norm(line.barcode) === norm(oldVariant))) {
          const nb = norm(line.barcode) === norm(oldVariant) ? line.variantCode : mappedBarcode;
          if (nb && norm(line.barcode) !== nb) {
            line.barcode = nb;
            changed = true;
          }
        }
      }
      return changed;
    };

    const processCollection = async (name: string, fn: (doc: any) => boolean) => {
      const docs = await db.collection(name).find({}, { session: s }).toArray();
      let n = 0;
      for (const d of docs) {
        if (fn(d)) {
          const { _id, ...rest } = d;
          await db.collection(name).replaceOne({ _id }, { _id, ...rest }, { session: s });
          n += 1;
        }
      }
      updatedRefs[name] = n;
    };

    await processCollection('orders', (d) => (d.items || []).map((it: any) => remapLine(it)).some(Boolean));
    await processCollection('stockmovements', (d) => remapLine(d));
    await processCollection('importreceipts', (d) =>
      (d.items || []).map((it: any) => remapLine(it, { variant: true })).some(Boolean)
    );
    await processCollection('returnexchanges', (d) =>
      [...(d.returnItems || []), ...(d.exchangeItems || [])].map((it: any) => remapLine(it)).some(Boolean)
    );
    await processCollection('promotions', (d) => {
      let changed = [...(d.conditionProducts || []), ...(d.giftItems || [])].map((it: any) => remapLine(it)).some(Boolean);
      if (Array.isArray(d.conditionProductIds)) {
        const next = Array.from(new Set(d.conditionProductIds.map((id: any) => idMap.get(String(id)) || String(id))));
        if (next.join(',') !== d.conditionProductIds.map(String).join(',')) {
          d.conditionProductIds = next;
          changed = true;
        }
      }
      return changed;
    });
    await processCollection('shifthandovers', (d) =>
      (d.discrepancies || [])
        .map((it: any) => {
          const mapped = mapCode(it.productCode);
          if (mapped && norm(it.productCode) !== mapped) {
            if (!it.legacyCode) it.legacyCode = it.productCode;
            it.productCode = mapped;
            return true;
          }
          return false;
        })
        .some(Boolean)
    );
  };

  if (session) {
    try {
      await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  } else {
    await work(undefined);
  }

  // ---- 4. Đối soát
  const stockAfter = await totalStock(db);
  const productsAfter = await db.collection('products').countDocuments({});
  const legacySet = new Set<string>();
  for (const [oldCode, newCode] of [...rootMap, ...variantMap]) if (oldCode !== norm(newCode)) legacySet.add(oldCode);
  const samples: string[] = [];
  let remaining = 0;
  for (const name of [...REF_COLLECTIONS, 'products']) {
    const docs = await db.collection(name).find({}).toArray();
    remaining += walkCount(docs, legacySet, samples, name);
  }
  // Tham chiếu tới mã của sản phẩm đã bị xoá trước đó (không thể ánh xạ)
  const knownCodes = new Set<string>();
  const finalProducts = await db.collection('products').find({}).toArray();
  for (const p of finalProducts as any[]) {
    knownCodes.add(norm(p.code));
    for (const v of productVariants(p)) knownCodes.add(norm(v.variantCode));
  }
  let orphan = 0;
  for (const name of ['orders', 'stockmovements', 'returnexchanges']) {
    const docs = await db.collection(name).find({}).toArray();
    for (const d of docs) {
      const lines = name === 'stockmovements' ? [d] : name === 'orders' ? d.items || [] : [...(d.returnItems || []), ...(d.exchangeItems || [])];
      for (const l of lines) if (l?.productCode && !knownCodes.has(norm(l.productCode))) orphan += 1;
    }
  }

  const report: ApplyReport = {
    backupPath,
    usedTransaction,
    productsBefore,
    productsAfter,
    recoded: targets.length,
    mergedAway: productsBefore - productsAfter,
    brandsCreated,
    stockBefore,
    stockAfter,
    stockMatched: stockBefore.floor1 === stockAfter.floor1 && stockBefore.floor2 === stockAfter.floor2,
    updatedRefs,
    remainingLegacyRefs: remaining,
    remainingLegacySamples: samples,
    orphanRefs: orphan,
  };
  fs.writeFileSync(path.join(backupPath, 'recode-report.json'), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

/* ------------------------------------------------------------------ CLI */

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function runRecodeCli() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
  const uri = assertLocalMongoUri(process.env.MONGODB_URI);
  const args = process.argv.slice(2);
  const applyIdx = args.indexOf('--apply');
  const backupDir = path.resolve(__dirname, '../../backups');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();
  console.log(`[recode] DB: ${uri.replace(/:([^:@/]+)@/, ':***@')} (${db.databaseName})`);
  try {
    if (applyIdx >= 0) {
      const file = args[applyIdx + 1];
      if (!file || !fs.existsSync(file)) throw new Error('Cần truyền đường dẫn file review đã duyệt: --apply <file.csv|xlsx>');
      const rows = readReviewFile(path.resolve(file));
      console.log(`[recode] Đọc ${rows.length} dòng từ ${file}`);
      const report = await applyRecode(db, rows, { backupDir, useMongodump: true, uri, client, log: console.log });
      console.log('\n===== BÁO CÁO ĐỐI SOÁT =====');
      console.log(JSON.stringify(report, null, 2));
      if (!report.stockMatched || report.remainingLegacyRefs > 0) {
        console.error('⚠ Đối soát KHÔNG khớp — kiểm tra lại, có thể khôi phục từ backup:', report.backupPath);
        process.exitCode = 2;
      } else {
        console.log('✔ Tồn kho T1/T2 trước = sau, không còn tham chiếu mã cũ.');
      }
    } else {
      const plan = await buildRecodePlan(db);
      const file = path.join(backupDir, `recode-review-${timestamp()}.csv`);
      writeReviewCsv(plan.rows, file);
      console.log(`✔ DRY-RUN (không ghi DB). File review: ${file}`);
      console.log(JSON.stringify(plan.stats, null, 2));
      console.log(
        'Hướng dẫn: mở file bằng Excel, chỉ sửa các cột cateCode/brandName/brandCode/versionName/versionCode/colorCode; ' +
          'lưu lại dạng CSV UTF-8 (hoặc .xlsx), rồi chạy: npm run recode:products -- --apply <file>'
      );
    }
  } finally {
    await client.close();
  }
}


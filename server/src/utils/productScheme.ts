/**
 * v5.0 — Nghiệp vụ mã sản phẩm theo quy chuẩn mới (R1–R4, R9, R10):
 * resolve Category/Brand, sinh mã gốc/mã con, kiểm tra trùng bộ (Category, Brand, Version) và trùng mã.
 */
import {
  brandRepo,
  categoryRepo,
  productRepo,
  orderRepo,
  stockMovementRepo,
  importReceiptRepo,
  returnExchangeRepo,
  promotionRepo,
  shiftHandoverRepo,
} from '../config/db';
import { ensureCategorySkuCode } from '../routes/categories';
import { ensureSystemBrand } from '../routes/brands';
import { ApiError } from './errors';
import {
  NO_BRAND_CODE,
  buildRootCode,
  buildVariantKey,
  buildVariantSku,
  isLegacyProductCode,
  isValidSkuPart,
  normalizeToCompactUpperCode,
  suggestColorCode,
  suggestVersionCode,
  toSizeCode,
} from './productCode';

export interface SchemeVariantInput {
  color?: string;
  colorCode?: string;
  size?: string;
  [key: string]: any;
}

export interface SchemeVariantOutput extends SchemeVariantInput {
  color: string;
  colorCode: string;
  size: string;
  sizeCode: string;
  variantKey: string;
  variantCode: string;
}

export async function resolveCategoryAndBrand(categoryId: any, brandId: any) {
  if (!categoryId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn danh mục', { categoryId: 'Bắt buộc' });
  }
  if (!brandId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn thương hiệu', { brandId: 'Bắt buộc' });
  }
  const category = await categoryRepo.findById(String(categoryId));
  if (!category) {
    throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại', { categoryId: 'Không hợp lệ' });
  }
  await ensureSystemBrand();
  const brand = await brandRepo.findById(String(brandId));
  if (!brand) {
    throw new ApiError(400, 'BRAND_NOT_FOUND', 'Thương hiệu không tồn tại', { brandId: 'Không hợp lệ' });
  }
  if (!brand.isSystem && !(brand.categoryIds || []).map(String).includes(String(category._id))) {
    throw new ApiError(
      400,
      'BRAND_NOT_IN_CATEGORY',
      `Thương hiệu "${brand.name}" không thuộc danh mục "${category.name}"`,
      { brandId: 'Thương hiệu không thuộc danh mục đã chọn' }
    );
  }
  const categoryCode = await ensureCategorySkuCode(category);
  return { category, brand, categoryCode };
}

export function resolveVersionCode(versionName: any, versionCode: any): { versionName: string; versionCode: string; suggested: string } {
  const name = String(versionName || '').trim();
  if (!name) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập Version (tên mẫu)', { versionName: 'Bắt buộc' });
  }
  const suggested = suggestVersionCode(name);
  const code = versionCode !== undefined && String(versionCode).trim()
    ? String(versionCode).trim().toUpperCase()
    : suggested;
  if (!isValidSkuPart(code, 'version')) {
    throw new ApiError(400, 'INVALID_VERSION_CODE', 'Mã Version phải gồm 1–6 ký tự A-Z, 0-9', {
      versionCode: 'Mã không hợp lệ',
    });
  }
  return { versionName: name, versionCode: code, suggested };
}

export function buildSchemeRootCode(categoryCode: string, brandCode: string, versionCode: string): string {
  const code = buildRootCode(categoryCode, brandCode, versionCode);
  if (isLegacyProductCode(code)) {
    throw new ApiError(
      400,
      'INVALID_VERSION_CODE',
      `Mã "${code}" trùng định dạng mã cũ ([A-Z][0-9]{6}); vui lòng đổi mã Version (VD thêm chữ cái)`,
      { versionCode: 'Trùng định dạng mã cũ' }
    );
  }
  return code;
}

/**
 * Chuẩn hoá danh sách biến thể của 1 sản phẩm mã mới: kiểm tra colorCode (2–3 ký tự),
 * 1 màu ↔ 1 colorCode, không trùng (màu, size); sinh mã con.
 */
export function prepareSchemeVariants(
  rootCode: string,
  rawVariants: SchemeVariantInput[],
  existingVariants: any[] = []
): SchemeVariantOutput[] {
  const codeByColor = new Map<string, string>();
  const colorByCode = new Map<string, string>();
  const register = (colorKey: string, cc: string, label: string) => {
    const prevCode = codeByColor.get(colorKey);
    if (prevCode && prevCode !== cc) {
      throw new ApiError(400, 'COLOR_CODE_DUPLICATE', `Màu "${label}" đang dùng mã màu ${prevCode}, không thể dùng thêm ${cc}`, {
        colorCode: 'Mỗi màu chỉ 1 mã màu',
      });
    }
    const prevColor = colorByCode.get(cc);
    if (prevColor && prevColor !== colorKey) {
      throw new ApiError(400, 'COLOR_CODE_DUPLICATE', `Mã màu ${cc} đã được dùng cho màu khác trong sản phẩm`, {
        colorCode: 'Mã màu bị trùng',
      });
    }
    codeByColor.set(colorKey, cc);
    colorByCode.set(cc, colorKey);
  };
  for (const v of existingVariants || []) {
    const ck = normalizeToCompactUpperCode(String(v?.color || ''));
    const cc = normalizeToCompactUpperCode(String(v?.colorCode || ''));
    if (ck && cc) register(ck, cc, String(v.color));
  }

  const existingKeys = new Set((existingVariants || []).map((v: any) => buildVariantKey(v?.color, v?.size)));
  const seenKeys = new Set<string>();
  const out: SchemeVariantOutput[] = [];
  for (const raw of rawVariants) {
    const color = String(raw?.color || '').trim();
    const size = String(raw?.size || '').trim().toUpperCase();
    const ck = normalizeToCompactUpperCode(color);
    let cc = '';
    if (ck) {
      const explicit = raw?.colorCode !== undefined && String(raw.colorCode).trim()
        ? String(raw.colorCode).trim().toUpperCase()
        : '';
      if (explicit && !isValidSkuPart(explicit, 'color')) {
        throw new ApiError(400, 'INVALID_COLOR_CODE', `Mã màu "${explicit}" phải gồm 2–3 ký tự A-Z, 0-9`, {
          colorCode: 'Mã màu không hợp lệ',
        });
      }
      cc = explicit || codeByColor.get(ck) || suggestColorCode(color, new Set(colorByCode.keys()));
      register(ck, cc, color);
    }
    const variantKey = buildVariantKey(color, size);
    if (seenKeys.has(variantKey) || existingKeys.has(variantKey)) {
      throw new ApiError(400, 'DUPLICATE_VARIANT', `Biến thể ${color || '-'} / ${size || '-'} đã tồn tại trong sản phẩm`, {
        variants: 'Trùng màu + size',
      });
    }
    seenKeys.add(variantKey);
    out.push({
      ...raw,
      color,
      colorCode: cc,
      size,
      sizeCode: toSizeCode(size),
      variantKey,
      variantCode: buildVariantSku(rootCode, cc, size),
    });
  }
  return out;
}

export interface CodeConflict {
  type: 'CODE_CONFLICT';
  code: string;
  productId: string;
  productCode: string;
}

/** Tìm sản phẩm khác trong danh sách đang dùng 1 trong các mã (mã gốc, barcode, mã con, mã cũ). */
export function findCodeConflictsInList(
  products: any[],
  codes: string[],
  excludeProductId?: string
): CodeConflict[] {
  const wanted = new Set(codes.map((c) => normalizeToCompactUpperCode(c)).filter(Boolean));
  if (wanted.size === 0) return [];
  const conflicts: CodeConflict[] = [];
  for (const p of products as any[]) {
    if (excludeProductId && String(p._id) === String(excludeProductId)) continue;
    const owned = new Set<string>(
      [
        p.code,
        p.barcode,
        p.legacyCode,
        ...(p.legacyCodes || []),
        ...(p.variants || []).flatMap((v: any) => [
          v.variantCode,
          v.barcode,
          v.legacyVariantCode,
          ...(v.legacyVariantCodes || []),
        ]),
      ]
        .map((c) => normalizeToCompactUpperCode(String(c || '')))
        .filter(Boolean)
    );
    for (const c of wanted) {
      if (owned.has(c)) conflicts.push({ type: 'CODE_CONFLICT', code: c, productId: String(p._id), productCode: p.code });
    }
  }
  return conflicts;
}

/** Tìm sản phẩm khác đang dùng 1 trong các mã (mã gốc, barcode, mã con, mã cũ). */
export async function findCodeConflicts(codes: string[], excludeProductId?: string): Promise<CodeConflict[]> {
  const wanted = new Set(codes.map((c) => normalizeToCompactUpperCode(c)).filter(Boolean));
  if (wanted.size === 0) return [];
  const products = await productRepo.find({});
  return findCodeConflictsInList(products, codes, excludeProductId);
}

/** R4: sản phẩm đã có cùng bộ (Category, Brand, VersionCode) */
export async function findDuplicateProduct(categoryId: string, brandId: string, versionCode: string, excludeId?: string) {
  const list = await productRepo.find({ categoryId: String(categoryId), brandId: String(brandId) } as any);
  return (
    list.find(
      (p: any) =>
        String(p.versionCode || '').toUpperCase() === versionCode.toUpperCase() &&
        (!excludeId || String(p._id) !== String(excludeId))
    ) || null
  );
}

export function isSystemBrandCode(code?: string): boolean {
  return String(code || '').toUpperCase() === NO_BRAND_CODE;
}

/* ---------------------------------------------------------------------------------
 * Nhập kho (imports): khớp sản phẩm có sẵn theo mã chính xác & đề xuất mã mới
 * cho sản phẩm chưa có trên hệ thống (KHÔNG khớp mờ theo tên).
 * --------------------------------------------------------------------------------- */
import type { BrandLike } from './brandVersion';
import { assignCategorySkuCodes, proposeVersion, resolveBrandForProduct } from './brandVersion';
import { suggestBrandCode, isNewSchemeProduct } from './productCode';

export interface ImportSchemeContext {
  products: any[];
  brands: any[];
  categories: any[];
  skuByCategory: Map<string, string>;
  /** colorCode đã cấp theo từng mã gốc trong phiên xử lý (giữ nhất quán giữa các dòng) */
  colorCodes: Map<string, Map<string, string>>;
  /** Mã gốc đã đề xuất trong phiên (mã -> khoá category|brand|versionName) để tránh 2 mẫu khác nhau trùng mã */
  proposals: Map<string, string>;
}

export async function loadImportSchemeContext(): Promise<ImportSchemeContext> {
  await ensureSystemBrand();
  const [products, brands, categories] = await Promise.all([
    productRepo.find({}),
    brandRepo.find({}),
    categoryRepo.find({}, { createdAt: 1 }),
  ]);
  return {
    products,
    brands,
    categories,
    skuByCategory: assignCategorySkuCodes(categories),
    colorCodes: new Map(),
    proposals: new Map(),
  };
}

/** Khớp sản phẩm có sẵn theo productId hoặc mã chính xác (mã gốc, mã con, mã cũ) */
export function findExistingProductForImport(item: any, products: any[]): any | null {
  const pid = String(item?.productId || '').trim();
  if (pid) {
    const byId = products.find((p) => String(p._id) === pid);
    if (byId) return byId;
  }
  const code = normalizeToCompactUpperCode(String(item?.productCode || ''));
  if (!code) return null;
  const norm = (v: any) => normalizeToCompactUpperCode(String(v || ''));
  return (
    products.find((p) => norm(p.code) === code) ||
    products.find((p) => norm(p.legacyCode) === code || (p.legacyCodes || []).some((c: any) => norm(c) === code)) ||
    products.find((p) =>
      (p.variants || []).some(
        (v: any) =>
          norm(v.variantCode) === code ||
          norm(v.legacyVariantCode) === code ||
          (v.legacyVariantCodes || []).some((c: any) => norm(c) === code)
      )
    ) ||
    null
  );
}

/** colorCode cho 1 màu trong sản phẩm (nhất quán giữa các dòng của cùng mã gốc) */
export function resolveImportColorCode(
  ctx: ImportSchemeContext,
  rootCode: string,
  existingVariants: any[],
  color: string,
  explicit?: string
): string {
  const ck = normalizeToCompactUpperCode(color);
  if (!ck) return '';
  const rawExp = String(explicit || '').trim().toUpperCase();
  if (rawExp && !isValidSkuPart(rawExp, 'color')) {
    throw new ApiError(400, 'INVALID_COLOR_CODE', `Mã màu "${rawExp}" phải gồm 2–3 ký tự A-Z, 0-9`, {
      colorCode: 'Mã màu không hợp lệ',
    });
  }
  let map = ctx.colorCodes.get(rootCode);
  if (!map) {
    map = new Map<string, string>();
    for (const v of existingVariants || []) {
      const k = normalizeToCompactUpperCode(String(v?.color || ''));
      if (k && v?.colorCode && !map.has(k)) map.set(k, String(v.colorCode));
    }
    ctx.colorCodes.set(rootCode, map);
  }
  if (map.has(ck)) {
    const prev = map.get(ck)!;
    if (rawExp && prev !== rawExp) {
      throw new ApiError(400, 'COLOR_CODE_DUPLICATE', `Màu "${color}" đang dùng mã màu ${prev}, không thể dùng thêm ${rawExp}`, {
        colorCode: 'Mỗi màu chỉ 1 mã màu',
      });
    }
    return prev;
  }
  if (rawExp) {
    for (const [otherCk, otherCC] of map.entries()) {
      if (otherCC === rawExp && otherCk !== ck) {
        throw new ApiError(400, 'COLOR_CODE_DUPLICATE', `Mã màu ${rawExp} đã được dùng cho màu khác trong sản phẩm`, {
          colorCode: 'Mã màu bị trùng',
        });
      }
    }
  }
  const cc = rawExp || suggestColorCode(color, new Set(map.values()));
  map.set(ck, cc);
  return cc;
}

/**
 * Xử lý dòng nhập kho có truyền tường minh brandId + (versionCode hoặc versionName):
 * - Sinh mã chính xác theo scheme mới từ (categoryId, brandId, versionCode, colorCode, size) (không đoán từ tên).
 * - Kiểm tra BRAND_NOT_IN_CATEGORY, INVALID_VERSION_CODE, INVALID_COLOR_CODE, COLOR_CODE_DUPLICATE, CODE_CONFLICT.
 * - Nếu trùng (categoryId, brandId, versionCode) với sản phẩm đã có trên DB thì gắn vào sản phẩm đó.
 */
export function resolveExplicitImportSchemeItem(
  ctx: ImportSchemeContext,
  input: {
    categoryId: string;
    brandId: string;
    versionName?: string;
    versionCode?: string;
    color?: string;
    colorCode?: string;
    size?: string;
  }
): ImportProductProposal & { colorCode: string; variantCode: string } {
  const category = ctx.categories.find((c) => String(c._id) === String(input.categoryId));
  if (!category) {
    throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại', { categoryId: 'Không hợp lệ' });
  }
  const brand = ctx.brands.find((b) => String(b._id) === String(input.brandId));
  if (!brand) {
    throw new ApiError(400, 'BRAND_NOT_FOUND', 'Thương hiệu không tồn tại', { brandId: 'Không hợp lệ' });
  }
  if (!brand.isSystem && !(brand.categoryIds || []).map(String).includes(String(category._id))) {
    throw new ApiError(
      400,
      'BRAND_NOT_IN_CATEGORY',
      `Thương hiệu "${brand.name}" không thuộc danh mục "${category.name}"`,
      { brandId: 'Thương hiệu không thuộc danh mục đã chọn' }
    );
  }
  const categoryCode = category.skuCode || ctx.skuByCategory.get(String(category._id)) || '';
  const rawVersionName = String(input.versionName || input.versionCode || '').trim();
  const version = resolveVersionCode(rawVersionName, input.versionCode);
  const sameTriple =
    ctx.products.find(
      (p) =>
        String(p.categoryId) === String(category._id) &&
        String(p.brandId || '') === String(brand._id) &&
        String(p.versionCode || '').toUpperCase() === version.versionCode.toUpperCase()
    ) || null;
  const code = sameTriple
    ? String(sameTriple.code)
    : buildSchemeRootCode(categoryCode, brand.code, version.versionCode);
  const color = String(input.color || '').trim();
  const size = String(input.size || '').trim().toUpperCase();
  const colorCode = resolveImportColorCode(ctx, code, sameTriple?.variants || [], color, input.colorCode);
  const variantCode = buildVariantSku(code, colorCode, size);

  const codesToCheck = sameTriple ? [variantCode] : [code, variantCode];
  const conflicts = findCodeConflictsInList(
    ctx.products,
    codesToCheck,
    sameTriple ? String(sameTriple._id) : undefined
  );
  if (conflicts.length > 0) {
    throw new ApiError(
      409,
      'CODE_CONFLICT',
      `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}. Vui lòng sửa mã Version/mã màu.`,
      { code: conflicts[0].code, conflictProductId: conflicts[0].productId }
    );
  }

  const proposalKey = `${category._id}|${brand._id}|${version.versionCode}`;
  const prevProposal = ctx.proposals.get(code);
  if (prevProposal && prevProposal !== proposalKey) {
    throw new ApiError(
      409,
      'CODE_CONFLICT',
      `Mã ${code} bị trùng với một dòng sản phẩm khác trong phiếu nhập. Vui lòng sửa mã Version.`,
      { code }
    );
  }
  ctx.proposals.set(code, proposalKey);

  return {
    existing: sameTriple,
    code,
    categoryCode,
    brand,
    versionName: sameTriple?.versionName || version.versionName,
    versionCode: version.versionCode,
    colorCode,
    variantCode,
  };
}

export interface ImportProductProposal {
  existing: any | null;
  code: string;
  categoryCode: string;
  brand: BrandLike & { _id?: string; isSystem?: boolean };
  versionName: string;
  versionCode: string;
}

function bumpVersionCode(vc: string, n: number): string {
  const suffix = String(n);
  return `${vc.slice(0, Math.max(1, 6 - suffix.length))}${suffix}`;
}

/** Đề xuất mã theo quy chuẩn mới cho 1 dòng nhập kho chưa có sản phẩm */
export function proposeImportProduct(
  ctx: ImportSchemeContext,
  input: { name: string; brand?: string; categoryId: string }
): ImportProductProposal | null {
  const category = ctx.categories.find((c) => String(c._id) === String(input.categoryId));
  if (!category) return null;
  const categoryCode = ctx.skuByCategory.get(String(category._id)) || '';
  if (!categoryCode) return null;
  const resolved = resolveBrandForProduct({ brand: input.brand, name: input.name }, ctx.brands);
  let brand: any = resolved.brand;
  if (!brand && resolved.name) {
    // Hãng chưa có trong danh mục Thương hiệu -> đề xuất mới (tạo khi hoàn thành nhập kho)
    brand = { code: suggestBrandCode(resolved.name, new Set(ctx.brands.map((b) => b.code))), name: resolved.name, aliases: [] };
  }
  if (!brand) brand = ctx.brands.find((b) => b.code === NO_BRAND_CODE) || { code: NO_BRAND_CODE, name: '', isSystem: true };
  const { versionName, versionCode: baseVc } = proposeVersion(input.name, brand.isSystem ? null : brand);
  const proposalKey = `${category._id}|${brand.code}|${normalizeToCompactUpperCode(versionName)}`;
  let versionCode = baseVc;
  for (let n = 2; n < 60; n++) {
    const code = buildRootCode(categoryCode, brand.code, versionCode);
    const sameKey = ctx.products.find(
      (p) =>
        String(p.categoryId) === String(category._id) &&
        brand._id &&
        String(p.brandId || '') === String(brand._id) &&
        String(p.versionCode || '') === versionCode
    );
    if (sameKey) return { existing: sameKey, code: sameKey.code, categoryCode, brand, versionName, versionCode };
    const taken = ctx.products.some(
      (p) => normalizeToCompactUpperCode(p.code) === code || normalizeToCompactUpperCode(p.legacyCode || '') === code
    );
    const proposedFor = ctx.proposals.get(code);
    if (!taken && !isLegacyProductCode(code) && (!proposedFor || proposedFor === proposalKey)) {
      ctx.proposals.set(code, proposalKey);
      return { existing: null, code, categoryCode, brand, versionName, versionCode };
    }
    versionCode = bumpVersionCode(baseVc, n);
  }
  return null;
}

/** Tạo sản phẩm mã mới khi hoàn thành nhập kho dòng hàng chưa có trên hệ thống */
export async function createProductFromImportProposal(
  proposal: ImportProductProposal,
  data: { name: string; categoryId: string; unit: string; sellingPrice: number; costPrice: number }
) {
  const category = await categoryRepo.findById(String(data.categoryId));
  if (!category) throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại');
  const categoryCode = await ensureCategorySkuCode(category);
  let brand: any = proposal.brand._id ? await brandRepo.findById(String(proposal.brand._id)) : null;
  if (!brand) brand = await brandRepo.findOne({ code: proposal.brand.code });
  if (!brand) {
    brand = await brandRepo.create({
      code: proposal.brand.code,
      name: proposal.brand.name,
      status: 'ACTIVE',
      aliases: [],
      categoryIds: [String(category._id)],
      isSystem: false,
    } as any);
  } else if (!brand.isSystem && !(brand.categoryIds || []).map(String).includes(String(category._id))) {
    await brandRepo.updateById(String(brand._id), { categoryIds: [...(brand.categoryIds || []), String(category._id)] } as any);
  }
  const code = buildSchemeRootCode(categoryCode, brand.code, proposal.versionCode);
  const dup = await findDuplicateProduct(String(category._id), String(brand._id), proposal.versionCode);
  if (dup) return dup;
  return productRepo.create({
    code,
    barcode: code,
    name: data.name,
    brand: brand.isSystem ? '' : brand.name,
    brandId: String(brand._id),
    brandCode: brand.code,
    brandName: brand.isSystem ? '' : brand.name,
    versionName: proposal.versionName,
    versionCode: proposal.versionCode,
    modelName: '',
    categoryId: String(category._id),
    categoryCode: category.code,
    categoryName: category.name,
    unit: data.unit,
    sellingPrice: data.sellingPrice,
    costPrice: data.costPrice,
    variants: [],
    stockFloor1: 0,
    stockFloor2: 0,
    stock: 0,
    status: 'ACTIVE',
  } as any);
}

export { isNewSchemeProduct };

/**
 * Đồng bộ toàn bộ 6 bảng lịch sử (orders, stockmovements, importreceipts, returnexchanges, promotions, shifthandovers)
 * khi 1 sản phẩm đổi mã gốc (code) hoặc mã con (variantCode) qua UI CMS.
 */
export async function syncProductReferencesAfterRecode(oldProduct: any, updatedProduct: any) {
  if (!oldProduct || !updatedProduct) return;
  const prodId = String(updatedProduct._id);
  const oldCode = String(oldProduct.code || '').trim().toUpperCase();
  const newCode = String(updatedProduct.code || '').trim().toUpperCase();
  if (!newCode || oldCode === newCode) return;

  // Map variantKey -> variantCode mới
  const variantCodeByKey = new Map<string, string>();
  for (const v of (updatedProduct.variants || []) as any[]) {
    const k = buildVariantKey(v.color, v.size);
    if (v.variantCode) variantCodeByKey.set(k, String(v.variantCode));
  }

  // 1. Orders (Lịch sử đơn hàng)
  const allOrders = await orderRepo.find({});
  for (const ord of allOrders as any[]) {
    let changed = false;
    const nextItems = (ord.items || []).map((it: any) => {
      if (String(it.productId || '') === prodId || String(it.productCode || '').toUpperCase() === oldCode) {
        if (it.productCode !== newCode) {
          changed = true;
          return {
            ...it,
            productId: prodId,
            legacyCode: it.legacyCode || it.productCode || oldCode,
            productCode: newCode,
          };
        }
      }
      return it;
    });
    if (changed) {
      await orderRepo.updateById(String(ord._id), { items: nextItems } as any);
    }
  }

  // 2. StockMovements (Sổ kho)
  const movements = await stockMovementRepo.find({});
  for (const m of movements as any[]) {
    if (String(m.productId || '') === prodId || String(m.productCode || '').toUpperCase() === oldCode) {
      if (m.productCode !== newCode) {
        await stockMovementRepo.updateById(String(m._id), {
          productId: prodId,
          legacyCode: m.legacyCode || m.productCode || oldCode,
          productCode: newCode,
          unit: updatedProduct.unit || m.unit,
          categoryId: String(updatedProduct.categoryId || m.categoryId),
        } as any);
      }
    }
  }

  // 3. ImportReceipts (Phiếu nhập kho)
  const receipts = await importReceiptRepo.find({});
  for (const rec of receipts as any[]) {
    let changed = false;
    const nextItems = (rec.items || []).map((it: any) => {
      if (String(it.productId || '') === prodId || String(it.productCode || '').toUpperCase() === oldCode) {
        const vKey = buildVariantKey(it.color, it.size);
        const nextVarCode = variantCodeByKey.get(vKey) || it.variantCode || '';
        changed = true;
        return {
          ...it,
          productId: prodId,
          legacyCode: it.legacyCode || (it.productCode !== newCode ? it.productCode : oldCode),
          productCode: newCode,
          ...(nextVarCode && nextVarCode !== it.variantCode
            ? {
                legacyVariantCode: it.legacyVariantCode || it.variantCode || '',
                variantCode: nextVarCode,
                barcode: nextVarCode,
              }
            : {}),
        };
      }
      return it;
    });
    if (changed) {
      await importReceiptRepo.updateById(String(rec._id), { items: nextItems } as any);
    }
  }

  // 4. ReturnExchanges (Phiếu trả / đổi hàng)
  const returns = await returnExchangeRepo.find({});
  for (const ret of returns as any[]) {
    let changed = false;
    const mapRetItem = (it: any) => {
      if (String(it.productId || '') === prodId || String(it.productCode || '').toUpperCase() === oldCode) {
        if (it.productCode !== newCode) {
          changed = true;
          return {
            ...it,
            productId: prodId,
            legacyCode: it.legacyCode || it.productCode || oldCode,
            productCode: newCode,
          };
        }
      }
      return it;
    };
    const nextReturnItems = (ret.returnItems || []).map(mapRetItem);
    const nextExchangeItems = (ret.exchangeItems || []).map(mapRetItem);
    if (changed) {
      await returnExchangeRepo.updateById(String(ret._id), {
        returnItems: nextReturnItems,
        exchangeItems: nextExchangeItems,
      } as any);
    }
  }

  // 5. Promotions (Chương trình khuyến mãi)
  const promos = await promotionRepo.find({});
  for (const pr of promos as any[]) {
    let changed = false;
    const mapPromoItem = (it: any) => {
      if (String(it.productId || '') === prodId || String(it.productCode || '').toUpperCase() === oldCode) {
        if (it.productCode !== newCode) {
          changed = true;
          return {
            ...it,
            productId: prodId,
            legacyCode: it.legacyCode || it.productCode || oldCode,
            productCode: newCode,
          };
        }
      }
      return it;
    };
    const nextGifts = (pr.giftItems || []).map(mapPromoItem);
    const nextCombos = (pr.comboItems || []).map(mapPromoItem);
    if (changed) {
      await promotionRepo.updateById(String(pr._id), {
        giftItems: nextGifts,
        comboItems: nextCombos,
      } as any);
    }
  }

  // 6. ShiftHandovers (Biên bản bàn giao ca)
  const handovers = await shiftHandoverRepo.find({});
  for (const sh of handovers as any[]) {
    let changed = false;
    const nextDisc = (sh.discrepancies || []).map((d: any) => {
      if (String(d.productCode || '').toUpperCase() === oldCode) {
        changed = true;
        return {
          ...d,
          legacyCode: d.legacyCode || d.productCode || oldCode,
          productCode: newCode,
        };
      }
      return d;
    });
    if (changed) {
      await shiftHandoverRepo.updateById(String(sh._id), { discrepancies: nextDisc } as any);
    }
  }
}

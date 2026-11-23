import { Router } from 'express';
import { brandRepo, categoryRepo, productRepo } from '../config/db';
import { ApiError } from '../utils/errors';
import { filterAndRankBySearch } from '../utils/search';
import {
  NO_BRAND_CODE,
  isValidSkuPart,
  normalizeToCompactUpperCode,
  suggestBrandCode,
} from '../utils/productCode';
import { SYSTEM_BRAND_ALIASES, SYSTEM_BRAND_NAME } from '../utils/brandVersion';
import { syncProductReferencesAfterRecode } from '../utils/productScheme';

export const brandsRouter = Router();

function requireBrandManager(role?: string) {
  if (role && role !== 'CEO' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Giám đốc (CEO), Quản trị viên (ADMIN) hoặc Kế toán (ACCOUNTANT) mới có quyền quản lý thương hiệu'
    );
  }
}

function cleanAliases(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of raw) {
    const s = String(a || '').trim();
    const k = normalizeToCompactUpperCode(s);
    if (!s || !k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.slice(0, 60));
  }
  return out.slice(0, 30);
}

/** Đảm bảo luôn có Brand hệ thống NN (dùng cho mọi Category). */
export async function ensureSystemBrand() {
  const existing = await brandRepo.findOne({ code: NO_BRAND_CODE });
  if (existing) return existing;
  return brandRepo.create({
    code: NO_BRAND_CODE,
    name: SYSTEM_BRAND_NAME,
    status: 'ACTIVE',
    aliases: SYSTEM_BRAND_ALIASES,
    categoryIds: [],
    isSystem: true,
  });
}

/**
 * Đếm sản phẩm theo brand: theo brandId (sản phẩm mã mới) hoặc theo tên hãng (sản phẩm legacy chưa gắn brandId).
 */
export async function countProductsByBrand(): Promise<{
  byId: Map<string, number>;
  byIdAndCategory: Map<string, Set<string>>;
  legacyByName: Map<string, { count: number; categories: Set<string> }>;
}> {
  const products = await productRepo.find({});
  const byId = new Map<string, number>();
  const byIdAndCategory = new Map<string, Set<string>>();
  const legacyByName = new Map<string, { count: number; categories: Set<string> }>();
  for (const p of products as any[]) {
    if (p.brandId) {
      const id = String(p.brandId);
      byId.set(id, (byId.get(id) || 0) + 1);
      const set = byIdAndCategory.get(id) || new Set<string>();
      set.add(String(p.categoryId));
      byIdAndCategory.set(id, set);
    } else if (p.brand) {
      const k = normalizeToCompactUpperCode(p.brand);
      if (!k) continue;
      const e = legacyByName.get(k) || { count: 0, categories: new Set<string>() };
      e.count += 1;
      e.categories.add(String(p.categoryId));
      legacyByName.set(k, e);
    }
  }
  return { byId, byIdAndCategory, legacyByName };
}

function brandUsage(
  brand: any,
  counts: Awaited<ReturnType<typeof countProductsByBrand>>
): { count: number; categories: Set<string> } {
  const id = String(brand._id);
  const categories = new Set<string>(counts.byIdAndCategory.get(id) || []);
  let count = counts.byId.get(id) || 0;
  if (!brand.isSystem) {
    const keys = new Set([
      normalizeToCompactUpperCode(brand.name),
      ...(brand.aliases || []).map((a: string) => normalizeToCompactUpperCode(a)),
    ]);
    for (const k of keys) {
      const legacy = counts.legacyByName.get(k);
      if (legacy) {
        count += legacy.count;
        legacy.categories.forEach((c) => categories.add(c));
      }
    }
  }
  return { count, categories };
}

async function validateCategoryIds(raw: any): Promise<string[]> {
  if (!Array.isArray(raw)) return [];
  const ids = Array.from(new Set(raw.map((x: any) => String(x || '').trim()).filter(Boolean)));
  for (const id of ids) {
    const cat = await categoryRepo.findById(id);
    if (!cat) {
      throw new ApiError(400, 'CATEGORY_NOT_FOUND', `Danh mục không tồn tại: ${id}`, {
        categoryIds: 'Danh mục không hợp lệ',
      });
    }
  }
  return ids;
}

async function assertUniqueName(name: string, exceptId?: string) {
  const key = normalizeToCompactUpperCode(name);
  const all = await brandRepo.find({});
  const dup = all.find((b) => String(b._id) !== String(exceptId || '') && normalizeToCompactUpperCode(b.name) === key);
  if (dup) {
    throw new ApiError(400, 'DUPLICATE_BRAND_NAME', `Thương hiệu "${name}" đã tồn tại (mã ${dup.code})`, {
      name: 'Tên thương hiệu đã tồn tại',
    });
  }
}

// GET /api/v1/brands?categoryId=&status=&search=
brandsRouter.get('/brands', async (req, res, next) => {
  try {
    await ensureSystemBrand();
    const { categoryId, status, search } = req.query;
    let brands = await brandRepo.find({}, { name: 1 });
    if (status) {
      const st = String(status).toUpperCase();
      brands = brands.filter((b) => b.status === st);
    }
    if (categoryId) {
      const cid = String(categoryId);
      brands = brands.filter((b) => b.isSystem || (b.categoryIds || []).map(String).includes(cid));
    }
    const counts = await countProductsByBrand();
    const mapped = brands
      .map((b) => ({ ...b, productCount: brandUsage(b, counts).count }))
      // Brand hệ thống NN luôn ở cuối danh sách
      .sort((a, b) => Number(Boolean(a.isSystem)) - Number(Boolean(b.isSystem)));
    const data = search
      ? filterAndRankBySearch(mapped, String(search), (b) => [
          { text: b.code, weight: 1.5 },
          { text: b.name, weight: 1.4 },
          ...(b.aliases || []).map((a: string) => ({ text: a, weight: 1.1 })),
        ])
      : mapped;
    res.json({ data, meta: { total: data.length } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/brands
brandsRouter.post('/brands', async (req, res, next) => {
  try {
    requireBrandManager(req.user?.role);
    const { code, name, categoryIds, aliases, status } = req.body || {};
    const cleanName = String(name || '').trim();
    const catIds = await validateCategoryIds(categoryIds);
    if (!cleanName || catIds.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên thương hiệu và ít nhất 1 danh mục là bắt buộc', {
        name: !cleanName ? 'Bắt buộc' : '',
        categoryIds: catIds.length === 0 ? 'Chọn ít nhất 1 danh mục' : '',
      });
    }
    const existing = await brandRepo.find({});
    const used = new Set(existing.map((b) => b.code));
    const finalCode = code ? String(code).trim().toUpperCase() : suggestBrandCode(cleanName, used);
    if (!isValidSkuPart(finalCode, 'brand')) {
      throw new ApiError(400, 'INVALID_BRAND_CODE', 'Mã thương hiệu phải gồm 2–4 ký tự A-Z, 0-9', {
        code: 'Mã không hợp lệ',
      });
    }
    if (finalCode === NO_BRAND_CODE || used.has(finalCode)) {
      throw new ApiError(400, 'DUPLICATE_BRAND_CODE', `Mã thương hiệu "${finalCode}" đã tồn tại`, {
        code: 'Mã đã tồn tại',
      });
    }
    await assertUniqueName(cleanName);
    const created = await brandRepo.create({
      code: finalCode,
      name: cleanName,
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      aliases: cleanAliases(aliases),
      categoryIds: catIds,
      isSystem: false,
    });
    res.status(201).json({ data: { ...created, productCount: 0 }, meta: {} });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/brands/:id
brandsRouter.patch('/brands/:id', async (req, res, next) => {
  try {
    requireBrandManager(req.user?.role);
    const brand = await brandRepo.findById(req.params.id);
    if (!brand) throw new ApiError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu');
    const { code, name, categoryIds, aliases, status, allowRecode } = req.body || {};
    const counts = await countProductsByBrand();
    const usage = brandUsage(brand, counts);
    const update: Record<string, any> = {};

    if (code !== undefined && String(code).trim().toUpperCase() !== brand.code) {
      if (brand.isSystem) {
        throw new ApiError(400, 'BRAND_SYSTEM_LOCKED', 'Không được sửa mã của thương hiệu hệ thống NN');
      }
      if (!allowRecode && usage.count > 0) {
        throw new ApiError(
          400,
          'BRAND_CODE_IMMUTABLE',
          'Thương hiệu đã có sản phẩm, không được đổi mã (mã nằm trong mã sản phẩm)',
          { code: 'Không được đổi mã' }
        );
      }
      const nextCode = String(code).trim().toUpperCase();
      if (!isValidSkuPart(nextCode, 'brand')) {
        throw new ApiError(400, 'INVALID_BRAND_CODE', 'Mã thương hiệu phải gồm 2–4 ký tự A-Z, 0-9', {
          code: 'Mã không hợp lệ',
        });
      }
      const dup = await brandRepo.findOne({ code: nextCode });
      if ((dup && String(dup._id) !== String(brand._id)) || nextCode === NO_BRAND_CODE) {
        throw new ApiError(400, 'DUPLICATE_BRAND_CODE', `Mã thương hiệu "${nextCode}" đã tồn tại`, {
          code: 'Mã đã tồn tại',
        });
      }
      update.code = nextCode;
    }
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) throw new ApiError(400, 'VALIDATION_ERROR', 'Tên thương hiệu không được để trống');
      await assertUniqueName(cleanName, String(brand._id));
      update.name = cleanName;
    }
    if (aliases !== undefined) update.aliases = cleanAliases(aliases);
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái phải là ACTIVE hoặc INACTIVE');
      }
      if (brand.isSystem && status !== 'ACTIVE') {
        throw new ApiError(400, 'BRAND_SYSTEM_LOCKED', 'Không được ngừng sử dụng thương hiệu hệ thống NN');
      }
      update.status = status;
    }
    if (categoryIds !== undefined) {
      if (brand.isSystem) {
        throw new ApiError(400, 'BRAND_SYSTEM_LOCKED', 'Thương hiệu NN dùng cho mọi danh mục, không cần gắn danh mục');
      }
      const ids = await validateCategoryIds(categoryIds);
      if (ids.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Chọn ít nhất 1 danh mục', { categoryIds: 'Bắt buộc' });
      }
      const removedInUse = Array.from(usage.categories).filter((c) => !ids.includes(c));
      if (removedInUse.length > 0) {
        throw new ApiError(
          400,
          'BRAND_CATEGORY_IN_USE',
          'Không thể bỏ danh mục đang có sản phẩm của thương hiệu này',
          { categoryIds: removedInUse.join(',') }
        );
      }
      update.categoryIds = ids;
    }

    const updated = await brandRepo.updateById(String(brand._id), update);
    // Đồng bộ tên hãng hiển thị & mã SKU trên sản phẩm đã gắn brandId
    if (update.name || update.code) {
      const prods = await productRepo.find({ brandId: String(brand._id) });
      for (const p of prods as any[]) {
        const prodPatch: Record<string, any> = {};
        if (update.name) {
          prodPatch.brand = brand.isSystem ? '' : update.name;
          prodPatch.brandName = update.name;
        }
        if (update.code) {
          prodPatch.brandCode = update.code;
          if (p.versionCode) {
            const cat = await categoryRepo.findById(String(p.categoryId));
            const cateSku = String(cat?.skuCode || p.categoryCode?.charAt(0) || 'S').toUpperCase();
            const nextRootCode = `${cateSku}${update.code}${p.versionCode}`;
            if (nextRootCode !== p.code) {
              const legacySet = new Set<string>(Array.isArray(p.legacyCodes) ? p.legacyCodes : []);
              if (p.legacyCode) legacySet.add(String(p.legacyCode));
              if (p.code) legacySet.add(String(p.code));
              prodPatch.legacyCode = p.legacyCode || p.code;
              prodPatch.legacyCodes = Array.from(legacySet);
              prodPatch.code = nextRootCode;
              prodPatch.barcode = nextRootCode;
              if (Array.isArray(p.variants) && p.variants.length > 0) {
                prodPatch.variants = p.variants.map((v: any) => {
                  const cPart = String(v.colorCode || '').toUpperCase();
                  const sPart = normalizeToCompactUpperCode(String(v.size || '')).replace(/[^A-Z0-9]/g, '');
                  const nextVarCode = `${nextRootCode}${cPart}${sPart}`;
                  const vLegSet = new Set<string>(Array.isArray(v.legacyVariantCodes) ? v.legacyVariantCodes : []);
                  if (v.legacyVariantCode) vLegSet.add(String(v.legacyVariantCode));
                  if (v.variantCode && v.variantCode !== nextVarCode) vLegSet.add(String(v.variantCode));
                  return {
                    ...v,
                    legacyVariantCode: v.legacyVariantCode || (v.variantCode !== nextVarCode ? v.variantCode : ''),
                    legacyVariantCodes: Array.from(vLegSet),
                    variantCode: nextVarCode,
                    barcode: nextVarCode,
                  };
                });
              }
            }
          }
        }
        if (Object.keys(prodPatch).length > 0) {
          const updatedProd = await productRepo.updateById(p._id, prodPatch as any);
          if (prodPatch.code && updatedProd) {
            await syncProductReferencesAfterRecode(p, updatedProd);
          }
        }
      }
    }
    res.json({ data: { ...updated, productCount: usage.count }, meta: {} });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/brands/:id
brandsRouter.delete('/brands/:id', async (req, res, next) => {
  try {
    requireBrandManager(req.user?.role);
    const brand = await brandRepo.findById(req.params.id);
    if (!brand) throw new ApiError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu');
    if (brand.isSystem) {
      throw new ApiError(400, 'BRAND_SYSTEM_LOCKED', 'Không được xoá thương hiệu hệ thống NN');
    }
    const usage = brandUsage(brand, await countProductsByBrand());
    if (usage.count > 0) {
      throw new ApiError(
        409,
        'BRAND_HAS_PRODUCTS',
        'Không thể xoá thương hiệu đang có sản phẩm; chỉ được ngừng sử dụng',
        { productCount: String(usage.count) }
      );
    }
    await brandRepo.deleteById(String(brand._id));
    res.json({ data: { _id: brand._id, deleted: true }, meta: {} });
  } catch (err) {
    next(err);
  }
});

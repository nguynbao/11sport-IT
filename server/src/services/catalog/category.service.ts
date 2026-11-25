import { ServiceContext } from '../../shared/http';
import { created as createdResult, ok, ServiceResult } from '../../shared/result';
import { categoryRepo, productRepo } from '../../repositories';
import { isValidSkuPart, normalizeToUpperCode, suggestCategorySkuCode } from '../../shared/productCode';
import { syncProductReferencesAfterRecode } from './productScheme.service';
import { ApiError } from '../../shared/errors';
import { filterAndRankBySearch } from '../../shared/search';


async function validateSkuCode(raw: any, exceptId?: string): Promise<string> {
  const sku = String(raw || '').trim().toUpperCase();
  if (!isValidSkuPart(sku, 'category')) {
    throw new ApiError(400, 'INVALID_SKU_CODE', 'Mã viết tắt (skuCode) phải gồm 1–3 ký tự A-Z, 0-9', {
      skuCode: 'Mã không hợp lệ',
    });
  }
  const dup = await categoryRepo.findOne({ skuCode: sku });
  if (dup && String(dup._id) !== String(exceptId || '')) {
    throw new ApiError(400, 'DUPLICATE_SKU_CODE', `Mã viết tắt "${sku}" đã được dùng cho danh mục "${dup.name}"`, {
      skuCode: 'Mã đã tồn tại',
    });
  }
  return sku;
}

function requireCategoryManager(role?: string) {
  if (!role || (role !== 'CEO' && role !== 'ADMIN')) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Giám đốc (CEO) hoặc Quản trị viên (ADMIN) mới có quyền quản lý danh mục sản phẩm'
    );
  }
}

// GET /api/v1/categories

// POST /api/v1/categories

// PATCH /api/v1/categories/:id

// DELETE /api/v1/categories/:id

export async function listCategories(query: any): Promise<ServiceResult> {
  const { status, search } = query || {};
    const filter: Record<string, any> = {};
    if (status) {
      filter.status = String(status).toUpperCase();
    }

    const categories = await categoryRepo.find(filter, { createdAt: 1 });
    const allProducts = await productRepo.find({});

    const mapped = categories.map((cat) => {
      const productCount = allProducts.filter(
        (p) => String(p.categoryId) === String(cat._id)
      ).length;
      return {
        ...cat,
        productCount,
      };
    });

    const data = search
      ? filterAndRankBySearch(mapped, String(search), (cat) => [
          { text: cat.code, weight: 1.5 },
          { text: cat.name, weight: 1.3 },
        ])
      : mapped;

    return ok(data, { total: data.length });
}

export async function createCategory(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  requireCategoryManager(ctx.user?.role);
    const { code, name, status, skuCode } = body || {};
    if (!code || !name) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Mã và tên category là bắt buộc', {
        code: !code ? 'Bắt buộc' : '',
        name: !name ? 'Bắt buộc' : '',
      });
    }

    const normalizedCode = normalizeToUpperCode(String(code));
    if (!normalizedCode) {
      throw new ApiError(400, 'INVALID_CATEGORY_CODE', 'Mã category không hợp lệ');
    }

    const existing = await categoryRepo.findOne({ code: normalizedCode });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_CATEGORY_CODE', `Mã category "${normalizedCode}" đã tồn tại`, {
        code: 'Mã đã tồn tại',
      });
    }

    let finalSku: string;
    if (skuCode !== undefined && String(skuCode).trim()) {
      finalSku = await validateSkuCode(skuCode);
    } else {
      const all = await categoryRepo.find({});
      finalSku = suggestCategorySkuCode(
        String(name),
        normalizedCode,
        new Set(all.map((c) => String(c.skuCode || '')).filter(Boolean))
      );
    }

    const created = await categoryRepo.create({
      code: normalizedCode,
      skuCode: finalSku,
      name: String(name).trim(),
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

    return createdResult({ ...created, productCount: 0 }, {});
}

export async function updateCategory(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  requireCategoryManager(ctx.user?.role);
    const category = await categoryRepo.findById(id);
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy category');
    }

    const { code, name, status, skuCode, allowRecode } = body || {};
    const updateData: Record<string, any> = {};

    if (code !== undefined) {
      const normalizedCode = normalizeToUpperCode(String(code));
      if (!normalizedCode) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Mã category không được để trống', { code: 'Bắt buộc' });
      }
      if (normalizedCode !== category.code) {
        const existingCode = await categoryRepo.findOne({ code: normalizedCode });
        if (existingCode && String(existingCode._id) !== String(id)) {
          throw new ApiError(400, 'DUPLICATE_CATEGORY_CODE', `Mã category "${normalizedCode}" đã tồn tại`, {
            code: 'Mã đã tồn tại',
          });
        }
        updateData.code = normalizedCode;
      }
    }

    if (skuCode !== undefined && String(skuCode).trim().toUpperCase() !== String(category.skuCode || '')) {
      const sku = await validateSkuCode(skuCode, id);
      const count = await productRepo.countDocuments({ categoryId: id });
      if (!allowRecode && count > 0 && category.skuCode) {
        throw new ApiError(
          400,
          'CATEGORY_SKU_CODE_IMMUTABLE',
          'Danh mục đã có sản phẩm, không được đổi mã viết tắt (nằm trong mã sản phẩm)',
          { skuCode: 'Không được đổi' }
        );
      }
      updateData.skuCode = sku;
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Tên category không được để trống');
      }
      updateData.name = String(name).trim();
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái category phải là ACTIVE hoặc INACTIVE');
      }
      updateData.status = status;
    }

    const updated = await categoryRepo.updateById(id, updateData);

    // Đồng bộ tên / mã category và mã SKU trên sản phẩm nếu có thay đổi
    if (updateData.name || updateData.code || updateData.skuCode) {
      const products = await productRepo.find({ categoryId: id });
      for (const p of products as any[]) {
        const prodPatch: Record<string, any> = {};
        if (updateData.name) prodPatch.categoryName = updateData.name;
        if (updateData.code) prodPatch.categoryCode = updateData.code;
        if (updateData.skuCode && p.versionCode && p.brandCode) {
          const nextRootCode = `${updateData.skuCode}${p.brandCode}${p.versionCode}`;
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
                const sPart = normalizeToUpperCode(String(v.size || '')).replace(/[^A-Z0-9]/g, '');
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
        if (Object.keys(prodPatch).length > 0) {
          const updatedProd = await productRepo.updateById(p._id, prodPatch as any);
          if (prodPatch.code && updatedProd) {
            await syncProductReferencesAfterRecode(p, updatedProd);
          }
        }
      }
    }

    const productCount = await productRepo.countDocuments({ categoryId: id });

    return ok({ ...updated, productCount }, {});
}

export async function deleteCategory(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  requireCategoryManager(ctx.user?.role);
    const category = await categoryRepo.findById(id);
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy category');
    }

    const productCount = await productRepo.countDocuments({ categoryId: id });
    if (productCount > 0) {
      throw new ApiError(
        400,
        'CATEGORY_HAS_PRODUCTS',
        'Không thể xóa category đang có sản phẩm; chỉ được ngừng sử dụng',
        { categoryId: `Đang có ${productCount} sản phẩm` }
      );
    }

    await categoryRepo.deleteById(id);
    return ok({ deleted: true, _id: id });
}


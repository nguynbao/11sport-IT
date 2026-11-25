import { brandRepo, categoryRepo } from '../repositories';
import { NO_BRAND_CODE, suggestCategorySkuCode } from '../shared/productCode';
import { SYSTEM_BRAND_ALIASES, SYSTEM_BRAND_NAME } from '../shared/brandVersion';

/** v5.0: lấy (hoặc gán lần đầu) CateCode của category — dùng trong mã sản phẩm mới */
export async function ensureCategorySkuCode(category: any): Promise<string> {
  if (category?.skuCode) return String(category.skuCode);
  const all = await categoryRepo.find({});
  const used = new Set(all.map((c) => String(c.skuCode || '')).filter(Boolean));
  const sku = suggestCategorySkuCode(
    String(category?.name || ''),
    String(category?.code || ''),
    used
  );
  await categoryRepo.updateById(String(category._id), { skuCode: sku } as any);
  category.skuCode = sku;
  return sku;
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

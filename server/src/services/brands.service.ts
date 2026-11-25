import { brandRepo, productRepo } from '../repositories';
import { NO_BRAND_CODE, normalizeToCompactUpperCode } from '../utils/productCode';
import { SYSTEM_BRAND_ALIASES, SYSTEM_BRAND_NAME } from '../utils/brandVersion';

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

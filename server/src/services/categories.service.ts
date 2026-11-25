import { categoryRepo } from '../repositories';
import { suggestCategorySkuCode } from '../utils/productCode';

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

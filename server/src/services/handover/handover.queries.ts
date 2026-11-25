import { attendanceConfigRepo, categoryRepo, productRepo } from "../../repositories";
import { toLocalDateStr } from "../../shared/date";
import { generateVariantProductCode } from "../../shared/productCode";
import { getFloorStocks } from "../warehouseFloor.service";
import { isRacketCategory, pickDailyCompanionIndex, stripVnAccents } from "./handover.rules";
import { HandoverCategorySummary } from "./handover.types";

export const HANDOVER_SCHEDULE_CONFIG_KEY = "HANDOVER_SCHEDULE_CONFIG";

export async function getStoredHandoverWeeklySchedule(): Promise<Record<string, string[]>> {
  const doc = await attendanceConfigRepo.findOne({ key: HANDOVER_SCHEDULE_CONFIG_KEY });
  if (doc && doc.handoverWeeklySchedule && typeof doc.handoverWeeklySchedule === 'object') {
    return doc.handoverWeeklySchedule as Record<string, string[]>;
  }
  return {};
}

export async function computeDailyHandoverCheck(targetDate?: string) {
  const dateStr =
    targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : toLocalDateStr();
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(y || 2026, (m || 1) - 1, d || 1).getDay(); // 0: CN, 1: T2 ... 6: T7

  const [categories, allProducts, storedWeeklySchedule] = await Promise.all([
    categoryRepo.find({}),
    productRepo.find({}),
    getStoredHandoverWeeklySchedule(),
  ]);

  const catMap = new Map(categories.map((c: any) => [String(c._id), c]));
  const catByCode = new Map(categories.map((c: any) => [String(c.code || '').toUpperCase(), c]));
  const catByName = new Map(
    categories.map((c: any) => [String(c.name || '').trim().toLowerCase(), c])
  );

  const allFloorProducts = allProducts
    .filter((p: any) => p.status !== 'INACTIVE')
    .map((p: any) => {
      const cat =
        catMap.get(String(p.categoryId)) ||
        (p.categoryCode ? catByCode.get(String(p.categoryCode).toUpperCase()) : undefined) ||
        (p.categoryName ? catByName.get(String(p.categoryName).trim().toLowerCase()) : undefined);
      const floors = getFloorStocks(p);
      const visibleVariants = floors.variants.map((v: any) => {
        const hasAttr = Boolean(
          (v.color && String(v.color).trim()) || (v.size && String(v.size).trim())
        );
        const vCode = hasAttr
          ? generateVariantProductCode(p.code, v.color, v.size)
          : v.variantCode || p.code;
        return {
          ...v,
          sku: vCode,
          variantCode: vCode,
          barcode: vCode,
          stockFloor1: v.stockFloor1,
          stockQtyFloor1: v.stockFloor1,
        };
      });
      return {
        _id: p._id,
        code: p.code,
        barcode: p.barcode || p.code,
        name: p.name,
        brand: p.brand || '',
        modelName: p.modelName || '',
        unit: p.unit || 'Cái',
        sellingPrice: Number(p.sellingPrice) || 0,
        categoryId: cat?._id ? String(cat._id) : String(p.categoryId || ''),
        categoryCode: cat?.code || p.categoryCode || '',
        categorySlug: String(cat?.code || p.categoryCode || '').toLowerCase(),
        categoryName: cat?.name || p.categoryName || 'Chưa phân loại',
        stockFloor1: floors.stockFloor1,
        stockQtyFloor1: floors.stockFloor1,
        stock: floors.stockFloor1,
        variants: visibleVariants,
      };
    });

  // Quy đổi liên kết Bộ -> Lẻ: tồn Sản phẩm Bộ tại Tầng 1 được quy ra đơn vị lẻ (x packSize)
  // và cộng vào Sản phẩm Lẻ; Sản phẩm Bộ không đếm riêng để tránh cộng lẫn đơn vị (Hộp + Quả).
  const activeById = new Map(allFloorProducts.map((p: any) => [String(p._id), p]));
  const mergedSetIds = new Set<string>();
  for (const raw of allProducts as any[]) {
    if (raw.status === 'INACTIVE') continue;
    const retailId = String(raw._id);
    const parentId = String(raw.parentSetProductId || '').trim();
    const packSize = Math.max(0, Math.round(Number(raw.packSize) || 0));
    if (!parentId || packSize <= 0 || parentId === retailId || mergedSetIds.has(parentId)) continue;
    const retail = activeById.get(retailId);
    const setProd = activeById.get(parentId);
    if (!retail || !setProd) continue;
    const setQty = Number(setProd.stockFloor1) || 0;
    const converted = setQty * packSize;
    retail.retailOwnStockFloor1 = retail.stockFloor1;
    retail.parentSetProductId = parentId;
    retail.parentSetProductCode = setProd.code;
    retail.parentSetUnit = setProd.unit;
    retail.parentSetStockFloor1 = setQty;
    retail.packSize = packSize;
    retail.stockFloor1 = retail.stockFloor1 + converted;
    retail.stockQtyFloor1 = retail.stockFloor1;
    retail.stock = retail.stockFloor1;
    mergedSetIds.add(parentId);
  }

  const floor1Products = allFloorProducts
    .filter((p: any) => !mergedSetIds.has(String(p._id)))
    .filter((p: any) => (Number(p.stockFloor1) || 0) > 0);

  const activeCategories = categories.filter((c: any) => c.status !== 'INACTIVE');
  const racketCatDoc = activeCategories.find((c: any) => isRacketCategory(c.code, c.name));

  const primaryProducts = floor1Products
    .filter(
      (p: any) =>
        (racketCatDoc && String(p.categoryId) === String(racketCatDoc._id)) ||
        isRacketCategory(p.categoryCode, p.categoryName)
    )
    .map((p: any) => ({ ...p, isPrimaryCategory: true }));

  const primaryExpectedTotalQty = primaryProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.stockQtyFloor1 ?? p.stockFloor1) || 0),
    0
  );

  const primaryCategory = {
    _id: racketCatDoc ? String(racketCatDoc._id) : 'VOT',
    code: racketCatDoc?.code || 'VOT',
    slug: String(racketCatDoc?.code || 'vot').toLowerCase(),
    name: racketCatDoc?.name || 'Vợt',
    unit: primaryProducts[0]?.unit || 'Cái',
    productCount: primaryProducts.length,
    expectedTotalQty: primaryExpectedTotalQty,
  };

  // Xây dựng danh sách các Category đi kèm (ngoài Vợt)
  const nonRacketCategories = activeCategories
    .filter((c: any) => !isRacketCategory(c.code, c.name))
    .map((c: any) => {
      const catProds = floor1Products.filter(
        (p: any) =>
          String(p.categoryId) === String(c._id) ||
          (c.code && String(p.categoryCode).toUpperCase() === String(c.code).toUpperCase()) ||
          stripVnAccents(p.categoryName) === stripVnAccents(c.name)
      );
      const expectedTotalQty = catProds.reduce(
        (sum: number, p: any) => sum + (Number(p.stockQtyFloor1 ?? p.stockFloor1) || 0),
        0
      );
      return {
        _id: String(c._id),
        code: String(c.code || ''),
        slug: String(c.code || '').toLowerCase(),
        name: String(c.name || ''),
        // Danh mục lẫn nhiều đơn vị (Hộp + Quả...) -> hiển thị chung là "Sản phẩm" để tránh hiểu nhầm
        unit:
          new Set(catProds.map((p: any) => p.unit || 'Cái')).size > 1
            ? 'Sản phẩm'
            : catProds[0]?.unit || 'Cái',
        productCount: catProds.length,
        expectedTotalQty,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const nonEmptyCompanions = nonRacketCategories.filter((c) => c.productCount > 0);
  const defaultFallbackCompanions = [
    { _id: 'GIAY', code: 'GIAY', slug: 'giay', name: 'Giày', unit: 'Đôi', productCount: 0, expectedTotalQty: 0 },
    { _id: 'BONG_THI_DAU', code: 'BONG_THI_DAU', slug: 'bong_thi_dau', name: 'Bóng thi đấu', unit: 'Hộp', productCount: 0, expectedTotalQty: 0 },
    { _id: 'PHU_KIEN', code: 'PHU_KIEN', slug: 'phu_kien', name: 'Phụ kiện', unit: 'Cái', productCount: 0, expectedTotalQty: 0 },
  ];

  const availableCompanionCategories =
    nonEmptyCompanions.length > 0
      ? nonEmptyCompanions
      : nonRacketCategories.length > 0
        ? nonRacketCategories
        : defaultFallbackCompanions;

  // Xây dựng lịch cố định theo Thứ trong tuần (0..6): ưu tiên cấu hình của Quản lý, nếu chưa có thì phân bổ cố định theo Thứ
  const allCompanionCandidates =
    nonRacketCategories.length > 0 ? nonRacketCategories : defaultFallbackCompanions;

  const resolveCompanionDisplayName = (rawToken: string): string => {
    const token = String(rawToken || '').trim();
    if (!token) return '';
    const upper = token.toUpperCase();
    const norm = stripVnAccents(token);
    const matched =
      allCompanionCandidates.find(
        (c) =>
          String(c._id) === token ||
          String(c.code).toUpperCase() === upper ||
          stripVnAccents(c.name) === norm
      ) || null;
    return matched ? matched.name : token;
  };

  const resolvedWeeklySchedule: Record<string, string[]> = {};
  for (let wd = 0; wd <= 6; wd++) {
    const key = String(wd);
    const customList = Array.isArray(storedWeeklySchedule[key])
      ? storedWeeklySchedule[key]
          .map((x) => resolveCompanionDisplayName(String(x || '')))
          .filter(Boolean)
      : [];
    if (customList.length > 0) {
      resolvedWeeklySchedule[key] = customList;
    } else if (availableCompanionCategories.length > 0) {
      // Lịch cố định mặc định theo thứ (T2=0, T3=1, T4=2, T5=0, T6=1, T7=0, CN=2...)
      const defaultIdx =
        wd === 1 || wd === 4 || wd === 6
          ? 0
          : wd === 2 || wd === 5
            ? 1 % availableCompanionCategories.length
            : 2 % availableCompanionCategories.length;
      const picked = availableCompanionCategories[defaultIdx] || availableCompanionCategories[0];
      resolvedWeeklySchedule[key] = [picked.name || picked.code];
    } else {
      resolvedWeeklySchedule[key] = [];
    }
  }

  const configuredCodesForToday = resolvedWeeklySchedule[String(weekday)] || [];
  let selectedCompanions = configuredCodesForToday
    .map((token) => {
      const upper = token.toUpperCase();
      const norm = stripVnAccents(token);
      return (
        availableCompanionCategories.find(
          (c) =>
            String(c._id) === token ||
            String(c.code).toUpperCase() === upper ||
            stripVnAccents(c.name) === norm
        ) ||
        nonRacketCategories.find(
          (c) =>
            String(c._id) === token ||
            String(c.code).toUpperCase() === upper ||
            stripVnAccents(c.name) === norm
        ) ||
        null
      );
    })
    .filter(Boolean) as typeof availableCompanionCategories;

  if (selectedCompanions.length === 0 && availableCompanionCategories.length > 0) {
    const pickedIdx = pickDailyCompanionIndex(dateStr, availableCompanionCategories.length);
    if (availableCompanionCategories[pickedIdx]) {
      selectedCompanions = [availableCompanionCategories[pickedIdx]];
    }
  }

  const companionCategory = selectedCompanions[0] || null;

  const companionProducts =
    selectedCompanions.length > 0
      ? floor1Products
          .filter(
            (p: any) =>
              !primaryProducts.some((vp: any) => String(vp._id) === String(p._id)) &&
              selectedCompanions.some(
                (comp) =>
                  String(p.categoryId) === String(comp._id) ||
                  (comp.code &&
                    String(p.categoryCode).toUpperCase() === String(comp.code).toUpperCase()) ||
                  stripVnAccents(p.categoryName) === stripVnAccents(comp.name)
              )
          )
          .map((p: any) => ({ ...p, isPrimaryCategory: false }))
      : [];

  const selectedProducts = [...primaryProducts, ...companionProducts];
  const checkedCategories = [
    primaryCategory.name,
    ...selectedCompanions.map((c) => c.name),
  ];
  const categoryLabel = checkedCategories.join(' + ');

  const categorySummaries: HandoverCategorySummary[] = [
    {
      categoryId: primaryCategory._id,
      categoryCode: primaryCategory.code,
      categoryName: primaryCategory.name,
      isPrimaryCategory: true,
      unit: primaryCategory.unit || 'Cái',
      productCount: primaryCategory.productCount,
      expectedTotalQty: primaryCategory.expectedTotalQty,
    },
    ...selectedCompanions.map((comp) => ({
      categoryId: comp._id,
      categoryCode: comp.code || comp.name,
      categoryName: comp.name,
      isPrimaryCategory: false,
      unit: comp.unit || 'Cái',
      productCount: comp.productCount,
      expectedTotalQty: comp.expectedTotalQty,
    })),
  ];

  const totalExpectedQty = categorySummaries.reduce((sum, c) => sum + c.expectedTotalQty, 0);

  return {
    date: dateStr,
    weekday,
    categoryLabel,
    checkedCategoryLabel: categoryLabel,
    checkedCategories,
    totalCheckedProducts: selectedProducts.length,
    totalExpectedQty,
    categorySummaries,
    weeklySchedule: resolvedWeeklySchedule,
    primaryCategory,
    companionCategory,
    availableCompanionCategories:
      nonRacketCategories.length > 0 ? nonRacketCategories : defaultFallbackCompanions,
    products: selectedProducts,
  };
}

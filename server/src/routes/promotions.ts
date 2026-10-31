import { Router } from 'express';
import { categoryRepo, productRepo, promotionRepo } from '../config/db';
import { ApiError } from '../utils/errors';
import {
  IPromotionConditionCategory,
  IPromotionConditionProduct,
  IPromotionGiftItem,
  PromotionConditionType,
  PromotionDiscountType,
  PromotionStatus,
} from '../models/Promotion';
import { getFloorStocks } from '../utils/warehouseFloor';
import { filterAndRankBySearch } from '../utils/search';

export const promotionsRouter = Router();

export type EffectivePromotionStatus =
  | 'RUNNING_PERMANENT'
  | 'RUNNING'
  | 'UPCOMING'
  | 'EXPIRED'
  | 'PAUSED';

export function parsePromotionDate(raw: any, isEndOfDayIfDateOnly = false): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (isEndOfDayIfDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T23:59:59.999`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (!isEndOfDayIfDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00.000`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function computePromotionEffectiveState(
  promo: any,
  now: Date = new Date()
): {
  isCurrentlyActive: boolean;
  effectiveStatus: EffectivePromotionStatus;
} {
  if (promo.status !== 'ACTIVE') {
    return { isCurrentlyActive: false, effectiveStatus: 'PAUSED' };
  }
  if (promo.isPermanent) {
    return { isCurrentlyActive: true, effectiveStatus: 'RUNNING_PERMANENT' };
  }
  const start = promo.startDate ? new Date(promo.startDate) : null;
  const end = promo.endDate ? new Date(promo.endDate) : null;

  if (start && !isNaN(start.getTime()) && now.getTime() < start.getTime()) {
    return { isCurrentlyActive: false, effectiveStatus: 'UPCOMING' };
  }
  if (end && !isNaN(end.getTime()) && now.getTime() > end.getTime()) {
    return { isCurrentlyActive: false, effectiveStatus: 'EXPIRED' };
  }
  return { isCurrentlyActive: true, effectiveStatus: 'RUNNING' };
}

function assertAdminRole(req: any) {
  if (req.user?.role !== 'ADMIN') {
    throw new ApiError(
      403,
      'PROMOTION_FORBIDDEN',
      'Chỉ Quản lý (ADMIN) mới có quyền tạo, chỉnh sửa hoặc xóa Chương trình khuyến mãi'
    );
  }
}

async function enrichPromotions(promos: any[]) {
  const allProducts = await productRepo.find({});
  const allCategories = await categoryRepo.find({});
  const prodById = new Map(allProducts.map((p) => [String(p._id), p]));
  const catById = new Map(allCategories.map((c) => [String(c._id), c]));
  const now = new Date();

  return promos.map((p) => {
    const { isCurrentlyActive, effectiveStatus } = computePromotionEffectiveState(p, now);

    const conditionProductIds: string[] = Array.isArray(p.conditionProductIds)
      ? p.conditionProductIds.map(String)
      : [];
    const conditionProducts = conditionProductIds.map((pid) => {
      const found = prodById.get(pid);
      const saved = (p.conditionProducts || []).find(
        (cp: any) => String(cp.productId) === pid
      );
      return {
        productId: pid,
        productCode: found?.code || saved?.productCode || '',
        productName: found?.name || saved?.productName || 'Sản phẩm đã xóa',
        unit: found?.unit || saved?.unit || 'Cái',
        sellingPrice: found?.sellingPrice ?? 0,
        stockFloor1: found ? getFloorStocks(found).stockFloor1 : 0,
      };
    });

    const conditionCategoryIds: string[] = Array.isArray(p.conditionCategoryIds)
      ? p.conditionCategoryIds.map(String)
      : [];
    const conditionCategories = conditionCategoryIds.map((cid) => {
      const found = catById.get(cid);
      const saved = (p.conditionCategories || []).find(
        (cc: any) => String(cc.categoryId) === cid
      );
      return {
        categoryId: cid,
        categoryCode: found?.code || saved?.categoryCode || '',
        categoryName: found?.name || saved?.categoryName || 'Danh mục',
      };
    });

    const giftItems = (Array.isArray(p.giftItems) ? p.giftItems : []).map((g: any) => {
      const gid = String(g.productId);
      const found = prodById.get(gid);
      return {
        productId: gid,
        productCode: found?.code || g.productCode || '',
        productName: found?.name || g.productName || 'Sản phẩm tặng',
        unit: found?.unit || g.unit || 'Cái',
        quantity: Math.max(1, Math.round(Number(g.quantity) || 1)),
        sellingPrice: found?.sellingPrice ?? 0,
        stockFloor1: found ? getFloorStocks(found).stockFloor1 : 0,
      };
    });

    return {
      ...p,
      conditionProductIds,
      conditionProducts,
      conditionCategoryIds,
      conditionCategories,
      giftItems,
      isCurrentlyActive,
      effectiveStatus,
    };
  });
}

// GET /api/v1/promotions
promotionsRouter.get('/promotions', async (req, res, next) => {
  try {
    const { activeOnly, status, search } = req.query;
    const allPromos = await promotionRepo.find({}, { createdAt: -1 });
    const enriched = await enrichPromotions(allPromos);

    const filtered = enriched.filter((p) => {
      if (String(activeOnly).toLowerCase() === 'true' && !p.isCurrentlyActive) {
        return false;
      }
      if (status && p.status !== String(status).toUpperCase()) {
        return false;
      }
      return true;
    });

    const searched = search
      ? filterAndRankBySearch(filtered, String(search), (p) => [
          { text: p.code, weight: 1.5 },
          { text: p.name, weight: 1.4 },
          { text: p.description, weight: 0.9 },
          ...p.conditionProducts.map((cp: any) => ({ text: cp.productName, weight: 1.2 })),
          ...p.conditionCategories.map((cc: any) => ({ text: cc.categoryName, weight: 1.1 })),
          ...p.giftItems.map((g: any) => ({ text: g.productName, weight: 1.2 })),
        ])
      : filtered;

    res.json({
      data: searched,
      meta: {
        total: searched.length,
        activeCount: enriched.filter((x) => x.isCurrentlyActive).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

async function buildAndValidatePromotionPayload(body: any, existingPromo?: any) {
  const name =
    body.name !== undefined
      ? String(body.name || '').trim()
      : existingPromo?.name || '';
  if (!name) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tên chương trình khuyến mãi là bắt buộc', {
      name: 'Bắt buộc',
    });
  }

  const description =
    body.description !== undefined
      ? String(body.description || '').trim()
      : existingPromo?.description || '';

  const rawStatus = String(body.status ?? existingPromo?.status ?? 'ACTIVE').toUpperCase();
  const status: PromotionStatus = rawStatus === 'PAUSED' ? 'PAUSED' : 'ACTIVE';

  const isPermanent =
    body.isPermanent !== undefined
      ? Boolean(body.isPermanent)
      : existingPromo
      ? Boolean(existingPromo.isPermanent)
      : true;

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (!isPermanent) {
    startDate =
      body.startDate !== undefined
        ? parsePromotionDate(body.startDate, false)
        : existingPromo?.startDate
        ? new Date(existingPromo.startDate)
        : null;
    endDate =
      body.endDate !== undefined
        ? parsePromotionDate(body.endDate, true)
        : existingPromo?.endDate
        ? new Date(existingPromo.endDate)
        : null;

    if (!startDate && !endDate) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Vui lòng chọn thời gian bắt đầu hoặc kết thúc (hoặc bật chế độ Chạy vĩnh viễn)',
        { startDate: 'Cần chọn thời gian' }
      );
    }
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu',
        { endDate: 'Không hợp lệ' }
      );
    }
  }

  const rawCondType = String(
    body.conditionType ?? existingPromo?.conditionType ?? 'BUY_PRODUCTS'
  ).toUpperCase();
  const conditionType: PromotionConditionType =
    rawCondType === 'BUY_CATEGORY' || rawCondType === 'ALL_PRODUCTS'
      ? (rawCondType as PromotionConditionType)
      : 'BUY_PRODUCTS';

  const minQuantity = Math.max(
    1,
    Math.round(Number(body.minQuantity ?? existingPromo?.minQuantity ?? 1) || 1)
  );
  const minOrderAmount = Math.max(
    0,
    Math.round(Number(body.minOrderAmount ?? existingPromo?.minOrderAmount ?? 0) || 0)
  );

  const rawProductIds: string[] = Array.isArray(body.conditionProductIds)
    ? body.conditionProductIds.map((x: any) => String(x).trim()).filter(Boolean)
    : existingPromo?.conditionProductIds || [];
  const uniqueProductIds = Array.from(new Set(rawProductIds));

  const conditionProducts: IPromotionConditionProduct[] = [];
  for (const pid of uniqueProductIds) {
    const prod =
      (await productRepo.findById(pid)) ||
      (await productRepo.findOne({ code: pid.toUpperCase() }));
    if (!prod) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm điều kiện: ${pid}`);
    }
    conditionProducts.push({
      productId: String(prod._id),
      productCode: prod.code,
      productName: prod.name,
      unit: prod.unit,
    });
  }

  const rawCategoryIds: string[] = Array.isArray(body.conditionCategoryIds)
    ? body.conditionCategoryIds.map((x: any) => String(x).trim()).filter(Boolean)
    : existingPromo?.conditionCategoryIds || [];
  const uniqueCategoryIds = Array.from(new Set(rawCategoryIds));

  const conditionCategories: IPromotionConditionCategory[] = [];
  for (const cid of uniqueCategoryIds) {
    const cat =
      (await categoryRepo.findById(cid)) ||
      (await categoryRepo.findOne({ code: cid.toUpperCase() }));
    if (!cat) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', `Không tìm thấy danh mục điều kiện: ${cid}`);
    }
    conditionCategories.push({
      categoryId: String(cat._id),
      categoryCode: cat.code,
      categoryName: cat.name,
    });
  }

  if (conditionType === 'BUY_PRODUCTS' && conditionProducts.length === 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Vui lòng chọn ít nhất 1 sản phẩm điều kiện cho chương trình khuyến mãi',
      { conditionProductIds: 'Chưa chọn sản phẩm' }
    );
  }

  if (conditionType === 'BUY_CATEGORY' && conditionCategories.length === 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Vui lòng chọn ít nhất 1 danh mục (Category) điều kiện cho chương trình khuyến mãi',
      { conditionCategoryIds: 'Chưa chọn danh mục' }
    );
  }

  // Quà tặng kèm (giftItems)
  const rawGiftItems: any[] =
    body.giftItems !== undefined
      ? Array.isArray(body.giftItems)
        ? body.giftItems
        : []
      : existingPromo?.giftItems || [];

  const giftByProdId = new Map<string, IPromotionGiftItem>();
  for (const g of rawGiftItems) {
    if (!g || !g.productId) continue;
    const qty = Math.max(1, Math.round(Number(g.quantity) || 1));
    const prod =
      (await productRepo.findById(String(g.productId))) ||
      (await productRepo.findOne({ code: String(g.productId).toUpperCase() }));
    if (!prod) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm tặng kèm: ${g.productId}`);
    }
    const key = String(prod._id);
    const prev = giftByProdId.get(key);
    if (prev) {
      prev.quantity += qty;
    } else {
      giftByProdId.set(key, {
        productId: key,
        productCode: prod.code,
        productName: prod.name,
        unit: prod.unit,
        quantity: qty,
      });
    }
  }
  const giftItems = Array.from(giftByProdId.values());

  const multiplyGiftByConditionQty =
    body.multiplyGiftByConditionQty !== undefined
      ? Boolean(body.multiplyGiftByConditionQty)
      : existingPromo
      ? Boolean(existingPromo.multiplyGiftByConditionQty)
      : true;

  // Giảm giá từng SP
  const rawItemDiscType = String(
    body.itemDiscountType ?? existingPromo?.itemDiscountType ?? 'NONE'
  ).toUpperCase();
  const itemDiscountType: PromotionDiscountType =
    rawItemDiscType === 'PERCENT' || rawItemDiscType === 'AMOUNT'
      ? (rawItemDiscType as PromotionDiscountType)
      : 'NONE';
  const rawItemDiscVal = Math.max(
    0,
    Number(body.itemDiscountValue ?? existingPromo?.itemDiscountValue ?? 0) || 0
  );
  const itemDiscountValue =
    itemDiscountType === 'PERCENT'
      ? Math.min(100, rawItemDiscVal)
      : itemDiscountType === 'AMOUNT'
      ? Math.round(rawItemDiscVal)
      : 0;

  // Giảm giá tổng Bill
  const rawBillDiscType = String(
    body.billDiscountType ?? existingPromo?.billDiscountType ?? 'NONE'
  ).toUpperCase();
  const billDiscountType: PromotionDiscountType =
    rawBillDiscType === 'PERCENT' || rawBillDiscType === 'AMOUNT'
      ? (rawBillDiscType as PromotionDiscountType)
      : 'NONE';
  const rawBillDiscVal = Math.max(
    0,
    Number(body.billDiscountValue ?? existingPromo?.billDiscountValue ?? 0) || 0
  );
  const billDiscountValue =
    billDiscountType === 'PERCENT'
      ? Math.min(100, rawBillDiscVal)
      : billDiscountType === 'AMOUNT'
      ? Math.round(rawBillDiscVal)
      : 0;

  const hasGift = giftItems.length > 0;
  const hasItemDiscount = itemDiscountType !== 'NONE' && itemDiscountValue > 0;
  const hasBillDiscount = billDiscountType !== 'NONE' && billDiscountValue > 0;

  if (!hasGift && !hasItemDiscount && !hasBillDiscount) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Chương trình khuyến mãi phải có ít nhất 1 ưu đãi: Tặng kèm sản phẩm/phụ kiện HOẶC Giảm giá sản phẩm HOẶC Giảm giá tổng Bill',
      { reward: 'Chưa cấu hình ưu đãi' }
    );
  }

  return {
    name,
    description,
    status,
    isPermanent,
    startDate: isPermanent ? null : startDate,
    endDate: isPermanent ? null : endDate,
    conditionType,
    conditionProductIds: conditionProducts.map((cp) => cp.productId),
    conditionProducts,
    conditionCategoryIds: conditionCategories.map((cc) => cc.categoryId),
    conditionCategories,
    minQuantity,
    minOrderAmount,
    giftItems,
    multiplyGiftByConditionQty,
    itemDiscountType: (hasItemDiscount ? itemDiscountType : 'NONE') as PromotionDiscountType,
    itemDiscountValue: hasItemDiscount ? itemDiscountValue : 0,
    billDiscountType: (hasBillDiscount ? billDiscountType : 'NONE') as PromotionDiscountType,
    billDiscountValue: hasBillDiscount ? billDiscountValue : 0,
  };
}

// POST /api/v1/promotions
promotionsRouter.post('/promotions', async (req, res, next) => {
  try {
    assertAdminRole(req);
    const payload = await buildAndValidatePromotionPayload(req.body || {});

    const allPromos = await promotionRepo.find({});
    let nextNum = allPromos.length + 1;
    let code = `KM-${String(nextNum).padStart(4, '0')}`;
    while (allPromos.some((p) => p.code === code)) {
      nextNum++;
      code = `KM-${String(nextNum).padStart(4, '0')}`;
    }

    const created = await promotionRepo.create({
      code,
      ...payload,
      createdBy: req.user?.userId || 'ADMIN',
      createdByName: req.user?.fullName || 'Quản trị viên',
    });

    const [enriched] = await enrichPromotions([created]);
    res.status(201).json({
      data: enriched,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/promotions/:id
promotionsRouter.patch('/promotions/:id', async (req, res, next) => {
  try {
    assertAdminRole(req);
    const { id } = req.params;
    const existing = await promotionRepo.findById(id);
    if (!existing) {
      throw new ApiError(404, 'PROMOTION_NOT_FOUND', 'Không tìm thấy chương trình khuyến mãi');
    }

    const payload = await buildAndValidatePromotionPayload(req.body || {}, existing);
    const updated = await promotionRepo.updateById(id, payload);
    const [enriched] = await enrichPromotions([updated]);

    res.json({
      data: enriched,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/promotions/:id
promotionsRouter.delete('/promotions/:id', async (req, res, next) => {
  try {
    assertAdminRole(req);
    const { id } = req.params;
    const existing = await promotionRepo.findById(id);
    if (!existing) {
      throw new ApiError(404, 'PROMOTION_NOT_FOUND', 'Không tìm thấy chương trình khuyến mãi');
    }

    await promotionRepo.deleteById(id);
    res.json({
      data: {
        deleted: true,
        _id: id,
        code: existing.code,
        name: existing.name,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/promotions/evaluate
promotionsRouter.post('/promotions/evaluate', async (req, res, next) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const allProducts = await productRepo.find({});
    const prodById = new Map(allProducts.map((p) => [String(p._id), p]));

    const cartItems: { product: any; quantity: number }[] = [];
    for (const ri of rawItems) {
      const qty = Math.round(Number(ri?.quantity) || 0);
      if (!ri?.productId || qty <= 0) continue;
      const prod = prodById.get(String(ri.productId));
      if (prod) {
        cartItems.push({ product: prod, quantity: qty });
      }
    }

    const allPromos = await promotionRepo.find({}, { createdAt: -1 });
    const enrichedPromos = await enrichPromotions(allPromos);
    const activePromos = enrichedPromos.filter((p) => p.isCurrentlyActive);

    const rawCartAmount = cartItems.reduce(
      (s, ci) => s + (Number(ci.product.sellingPrice) || 0) * ci.quantity,
      0
    );

    const appliedPromotions: any[] = [];
    const giftMap = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productName: string;
        unit: string;
        sellingPrice: number;
        stockFloor1: number;
        requestedQuantity: number;
        promoIds: string[];
        promoNames: string[];
      }
    >();

    const itemDiscountsMap = new Map<
      string,
      {
        productId: string;
        discountType: PromotionDiscountType;
        discountValue: number;
        discountPerUnit: number;
        promoId: string;
        promoName: string;
      }
    >();

    let bestBillDiscount: {
      discountType: PromotionDiscountType;
      discountValue: number;
      estimatedDiscountAmount: number;
      promoId: string;
      promoName: string;
    } | null = null;

    for (const promo of activePromos) {
      let matchingItems: { product: any; quantity: number }[] = [];
      if (promo.conditionType === 'BUY_PRODUCTS') {
        const setIds = new Set((promo.conditionProductIds || []).map(String));
        matchingItems = cartItems.filter((ci) => setIds.has(String(ci.product._id)));
      } else if (promo.conditionType === 'BUY_CATEGORY') {
        const setCatIds = new Set((promo.conditionCategoryIds || []).map(String));
        matchingItems = cartItems.filter((ci) => setCatIds.has(String(ci.product.categoryId)));
      } else {
        matchingItems = [...cartItems];
      }

      const matchedQty = matchingItems.reduce((s, ci) => s + ci.quantity, 0);
      const minQty = Math.max(1, Number(promo.minQuantity) || 1);
      const minOrderAmt = Math.max(0, Number(promo.minOrderAmount) || 0);

      if (matchedQty < minQty || rawCartAmount < minOrderAmt || matchingItems.length === 0) {
        continue;
      }

      const multiplier = promo.multiplyGiftByConditionQty
        ? Math.max(1, Math.floor(matchedQty / minQty))
        : 1;

      appliedPromotions.push({
        _id: promo._id,
        code: promo.code,
        name: promo.name,
        multiplier,
        matchedQty,
      });

      // 1. Quà tặng kèm
      for (const g of promo.giftItems || []) {
        const gid = String(g.productId);
        const prod = prodById.get(gid);
        const stockFloor1 = prod ? getFloorStocks(prod).stockFloor1 : Number(g.stockFloor1) || 0;
        const addQty = Math.max(1, Number(g.quantity) || 1) * multiplier;
        const existing = giftMap.get(gid);
        if (existing) {
          existing.requestedQuantity += addQty;
          if (!existing.promoIds.includes(promo._id)) {
            existing.promoIds.push(promo._id);
            existing.promoNames.push(promo.name);
          }
        } else {
          giftMap.set(gid, {
            productId: gid,
            productCode: prod?.code || g.productCode || '',
            productName: prod?.name || g.productName || '',
            unit: prod?.unit || g.unit || 'Cái',
            sellingPrice: prod?.sellingPrice ?? g.sellingPrice ?? 0,
            stockFloor1,
            requestedQuantity: addQty,
            promoIds: [promo._id],
            promoNames: [promo.name],
          });
        }
      }

      // 2. Giảm giá từng SP khớp điều kiện
      if (promo.itemDiscountType !== 'NONE' && promo.itemDiscountValue > 0) {
        for (const ci of matchingItems) {
          const pid = String(ci.product._id);
          const origPrice = Math.round(Number(ci.product.sellingPrice) || 0);
          const discPerUnit =
            promo.itemDiscountType === 'PERCENT'
              ? Math.round((origPrice * promo.itemDiscountValue) / 100)
              : Math.min(origPrice, Math.round(promo.itemDiscountValue));

          const prev = itemDiscountsMap.get(pid);
          if (!prev || discPerUnit > prev.discountPerUnit) {
            itemDiscountsMap.set(pid, {
              productId: pid,
              discountType: promo.itemDiscountType,
              discountValue: promo.itemDiscountValue,
              discountPerUnit: discPerUnit,
              promoId: promo._id,
              promoName: promo.name,
            });
          }
        }
      }

      // 3. Giảm giá tổng Bill
      if (promo.billDiscountType !== 'NONE' && promo.billDiscountValue > 0) {
        const estAmt =
          promo.billDiscountType === 'PERCENT'
            ? Math.round((rawCartAmount * promo.billDiscountValue) / 100)
            : Math.min(rawCartAmount, Math.round(promo.billDiscountValue));
        if (!bestBillDiscount || estAmt > bestBillDiscount.estimatedDiscountAmount) {
          bestBillDiscount = {
            discountType: promo.billDiscountType,
            discountValue: promo.billDiscountValue,
            estimatedDiscountAmount: estAmt,
            promoId: promo._id,
            promoName: promo.name,
          };
        }
      }
    }

    const saleQtyByProdId = new Map(
      cartItems.map((ci) => [String(ci.product._id), ci.quantity])
    );

    const autoGiftItems = Array.from(giftMap.values()).map((g) => {
      const inSaleCart = saleQtyByProdId.get(g.productId) || 0;
      const availableForGift = Math.max(0, g.stockFloor1 - inSaleCart);
      const quantity = Math.min(g.requestedQuantity, availableForGift);
      return {
        ...g,
        quantity,
        stockCapped: quantity < g.requestedQuantity,
      };
    });

    res.json({
      data: {
        appliedPromotions,
        autoGiftItems,
        itemDiscounts: Array.from(itemDiscountsMap.values()),
        billDiscount: bestBillDiscount,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

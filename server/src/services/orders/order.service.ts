import {
  attendanceRepo,
  customerRepo,
  orderRepo,
  productRepo,
  returnExchangeRepo,
  shiftAssignmentRepo,
  stockMovementRepo,
} from "../../repositories";
import type {
  DebtStatus,
  DiscountType,
  IOrderItem,
  ISplitPaymentItem,
  OrderShiftCode,
  PaymentMethod,
  SplitMethod,
} from "../../models/Order";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ok, ServiceResult } from "../../shared/result";
import { filterAndRankBySearch, normalizePhoneDigits } from "../../shared/search";
import { buildVariantKey, resolveVariantPricing } from "../../shared/productCode";
import { withOrderLock } from "../../shared/orderLock";
import {
  deductStockForSale,
  executeUnpackSetToRetail,
  formatProductWithVariant,
  getFloorStocks,
  getVariantFloorStocks,
} from "../inventory";
import {
  computeShiftOrdersSummary,
  getOrderEffectiveShiftAndDate,
  getSalesAllowedBillDates,
  getShiftDisplayLabel,
  inferShiftCodeFromTime,
  isOrderInSalesCurrentShift,
  isSalesOnlyUser,
  parseDueDateInput,
  SALES_MAX_BILL_CHECK_DAYS,
  toLocalDateStr,
} from "./orderShift.rules";

export async function resolveStaffShiftForDate(
  user: { userId?: string; role?: string; department?: string } | undefined | null,
  dateStr: string,
  now = new Date()
): Promise<'SHIFT_1' | 'SHIFT_2' | 'BOTH' | 'OFF'> {
  if (!user?.userId) return inferShiftCodeFromTime(now);

  const att =
    (await attendanceRepo.findOne({ staffId: String(user.userId), date: dateStr })) ||
    (await attendanceRepo.findOne({ staffId: user.userId as any, date: dateStr }));

  if (
    att &&
    (att.shiftCode === 'SHIFT_1' ||
      att.shiftCode === 'SHIFT_2' ||
      att.shiftCode === 'BOTH')
  ) {
    return att.shiftCode;
  }

  const assigned =
    (await shiftAssignmentRepo.findOne({
      staffId: String(user.userId),
      date: dateStr,
    })) ||
    (await shiftAssignmentRepo.findOne({
      staffId: user.userId as any,
      date: dateStr,
    }));

  if (
    assigned &&
    (assigned.shiftCode === 'SHIFT_1' ||
      assigned.shiftCode === 'SHIFT_2' ||
      assigned.shiftCode === 'BOTH' ||
      assigned.shiftCode === 'OFF')
  ) {
    return assigned.shiftCode;
  }

  return inferShiftCodeFromTime(now);
}

export async function resolveOrderShiftOnWrite(
  reqUser: any,
  requestedShiftCode?: unknown,
  now = new Date()
): Promise<{ shiftDate: string; shiftCode: OrderShiftCode }> {
  const shiftDate = toLocalDateStr(now);
  const rawReq = String(requestedShiftCode || '').trim().toUpperCase();

  if (isSalesOnlyUser(reqUser)) {
    const staffShift = await resolveStaffShiftForDate(reqUser, shiftDate, now);
    if (staffShift === 'SHIFT_1' || staffShift === 'SHIFT_2') {
      return { shiftDate, shiftCode: staffShift };
    }
    if (staffShift === 'BOTH') {
      if (rawReq === 'SHIFT_1' || rawReq === 'SHIFT_2') {
        return { shiftDate, shiftCode: rawReq };
      }
      return { shiftDate, shiftCode: inferShiftCodeFromTime(now) };
    }
    return { shiftDate, shiftCode: inferShiftCodeFromTime(now) };
  }

  if (rawReq === 'SHIFT_1' || rawReq === 'SHIFT_2' || rawReq === 'BOTH') {
    return { shiftDate, shiftCode: rawReq as OrderShiftCode };
  }
  return { shiftDate, shiftCode: inferShiftCodeFromTime(now) };
}


async function generateNextOrderCode(): Promise<string> {
  const all = await orderRepo.find({});
  let maxNum = all.length;
  for (const o of all) {
    const m = /^HD-(\d+)$/i.exec(String(o.orderCode || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `HD-${String(maxNum + 1).padStart(4, '0')}`;
}

async function prepareOrderData(body: any, isDraft: boolean) {
  const {
    customerName,
    customerPhone,
    paymentMethod,
    paymentMethodDetail,
    splitPayments,
    debtAmount: rawBodyDebtAmount,
    debtDueDate: rawBodyDebtDueDate,
    hasCardFee,
    cardFeePercent: rawCardFeePercent,
    billDiscountType,
    billDiscountValue,
    note,
    items,
  } = body || {};

  const cleanPhone = String(customerPhone || '').replace(/\s+/g, '').trim();
  if (!cleanPhone) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Số điện thoại khách hàng là bắt buộc', {
      customerPhone: 'Bắt buộc',
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'EMPTY_ORDER_ITEMS', 'Đơn hàng phải có ít nhất 1 sản phẩm');
  }

  const existingCustomer = cleanPhone ? await customerRepo.findOne({ phone: cleanPhone }) : null;
  const rawName = String(customerName || existingCustomer?.name || '').trim();
  const finalCustomerName = rawName;
  if (!finalCustomerName) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tên khách hàng mới', {
      customerName: 'Bắt buộc đối với khách mới',
    });
  }

  const validPaymentMethods: PaymentMethod[] = ['CASH', 'BANKING', 'CARD', 'OTHER'];
  const method: PaymentMethod = validPaymentMethods.includes(paymentMethod)
    ? paymentMethod
    : 'CASH';
  const cleanPaymentDetail =
    method === 'OTHER'
      ? String(paymentMethodDetail || 'Hình thức khác').trim() || 'Hình thức khác'
      : '';

  const orderItems: IOrderItem[] = [];
  const productUpdates: { product: any; qty: number; isGift: boolean; color: string; size: string }[] = [];
  const requestedQtyByProdId = new Map<string, number>();
  const requestedQtyByVariant = new Map<string, number>();

  for (const rawItem of items) {
    const qty = Math.round(Number(rawItem.quantity));
    if (!rawItem.productId || isNaN(qty) || qty <= 0) {
      throw new ApiError(400, 'INVALID_ORDER_ITEM', 'Số lượng sản phẩm mua phải lớn hơn 0');
    }

    const product =
      (await productRepo.findById(String(rawItem.productId))) ||
      (await productRepo.findOne({ code: String(rawItem.productId).toUpperCase() }));

    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm ID: ${rawItem.productId}`);
    }

    let itemColor = rawItem.color ? String(rawItem.color).trim() : '';
    let itemSize = rawItem.size ? String(rawItem.size).trim().toUpperCase() : '';
    if (!itemColor && !itemSize && Array.isArray(product.variants) && product.variants.length > 0) {
      const candidate =
        product.variants.find((v: any) => Number(v.stockFloor1 || 0) >= qty) || product.variants[0];
      if (candidate) {
        itemColor = String(candidate.color || '').trim();
        itemSize = String(candidate.size || '').trim().toUpperCase();
      }
    }
    const displayProductName = formatProductWithVariant(product.name, itemColor, itemSize);

    const rawItemDiscType = String(rawItem.discountType || 'NONE').toUpperCase();
    const isGift = Boolean(rawItem.isGift) || rawItemDiscType === 'GIFT';

    // v5.0 (R8): giá hiệu lực theo biến thể (màu + size), fallback giá sản phẩm gốc
    const variantPricing = resolveVariantPricing(product, itemColor, itemSize);

    // BR-04: Chặn bán sản phẩm có sellingPrice <= 0 (trừ khi chọn làm hàng tặng)
    if (!isGift && variantPricing.sellingPrice <= 0) {
      throw new ApiError(
        400,
        'PRODUCT_PRICE_NOT_SET',
        `Sản phẩm "${product.name}" chưa có giá bán hợp lệ (giá bán = 0), không được phép bán`,
        { productId: product._id }
      );
    }

    const prodKey = String(product._id);
    const totalRequestedForProduct = (requestedQtyByProdId.get(prodKey) || 0) + qty;
    requestedQtyByProdId.set(prodKey, totalRequestedForProduct);

    const variantKey = `${prodKey}__${buildVariantKey(itemColor, itemSize)}`;
    const totalRequestedForVariant = (requestedQtyByVariant.get(variantKey) || 0) + qty;
    requestedQtyByVariant.set(variantKey, totalRequestedForVariant);

    const originalUnitPrice = variantPricing.sellingPrice;
    const unitCost = variantPricing.costPrice;

    if (isGift) {
      orderItems.push({
        productId: product._id,
        productCode: product.code,
        productName: displayProductName,
        color: itemColor,
        size: itemSize,
        unit: product.unit,
        originalUnitPrice,
        unitCost,
        isGift: true,
        discountType: 'GIFT',
        discountValue: 100,
        discountAmount: 0,
        unitPrice: 0,
        quantity: qty,
        returnedQuantity: 0,
        lineTotal: 0,
      });
    } else {
      const itemDiscType: DiscountType =
        rawItemDiscType === 'PERCENT' || rawItemDiscType === 'AMOUNT'
          ? (rawItemDiscType as DiscountType)
          : 'NONE';
      const rawItemDiscVal = Math.max(0, Number(rawItem.discountValue) || 0);
      const itemDiscValue =
        itemDiscType === 'PERCENT'
          ? Math.min(100, rawItemDiscVal)
          : itemDiscType === 'AMOUNT'
          ? Math.min(originalUnitPrice, Math.round(rawItemDiscVal))
          : 0;

      const discountPerUnit =
        itemDiscType === 'PERCENT'
          ? Math.round((originalUnitPrice * itemDiscValue) / 100)
          : itemDiscType === 'AMOUNT'
          ? itemDiscValue
          : 0;

      const unitPrice = Math.max(0, originalUnitPrice - discountPerUnit);
      const itemDiscountAmount = discountPerUnit * qty;
      const lineTotal = unitPrice * qty;

      orderItems.push({
        productId: product._id,
        productCode: product.code,
        productName: displayProductName,
        color: itemColor,
        size: itemSize,
        unit: product.unit,
        originalUnitPrice,
        unitCost,
        isGift: false,
        discountType: itemDiscValue > 0 ? itemDiscType : 'NONE',
        discountValue: itemDiscValue,
        discountAmount: itemDiscountAmount,
        unitPrice,
        quantity: qty,
        returnedQuantity: 0,
        lineTotal,
      });
    }

    productUpdates.push({ product, qty, isGift, color: itemColor, size: itemSize });
  }

  // Khi chốt đơn thanh toán (!isDraft): kiểm tra đủ tồn tại Kho Tầng 1 hoặc tự động tách từ Sản phẩm Bộ ở Kho Tầng 1
  const autoUnpackPlans: {
    retailProduct: any;
    parentProduct: any;
    setsToUnpack: number;
    color: string;
    size: string;
  }[] = [];

  if (!isDraft) {
    const checkedKeys = new Set<string>();
    const plannedSetsBySetId = new Map<string, number>();

    for (const upd of productUpdates) {
      const { product, color: itemColor, size: itemSize } = upd;
      const prodKey = String(product._id);
      const floors = getFloorStocks(product);
      const hasVariant = Boolean((itemColor || itemSize) && floors.variants.length > 0);
      const checkKey = hasVariant
        ? `${prodKey}__${buildVariantKey(itemColor, itemSize)}`
        : prodKey;

      if (checkedKeys.has(checkKey)) continue;
      checkedKeys.add(checkKey);

      const displayProductName = formatProductWithVariant(product.name, itemColor, itemSize);
      const vStocks = hasVariant ? getVariantFloorStocks(product, itemColor, itemSize) : floors;
      const currentRetailFloor1 = vStocks.stockFloor1;
      const neededQty = hasVariant
        ? requestedQtyByVariant.get(checkKey) || 0
        : requestedQtyByProdId.get(prodKey) || 0;

      if (currentRetailFloor1 < neededQty) {
        const parentSetId = String(product.parentSetProductId || '').trim();
        const packSize = Math.max(0, Math.round(Number(product.packSize) || 0));
        const parentProduct =
          parentSetId && packSize > 0 && parentSetId !== prodKey
            ? await productRepo.findById(parentSetId)
            : null;

        if (parentProduct && packSize > 0) {
          const shortage = neededQty - currentRetailFloor1;
          const setsNeeded = Math.ceil(shortage / packSize);
          const parentId = String(parentProduct._id);
          const parentFloors = getFloorStocks(parentProduct);
          const parentHasVariants =
            parentFloors.variants.length > 0 && Boolean(itemColor || itemSize);
          const parentTargetStocks = parentHasVariants
            ? getVariantFloorStocks(parentProduct, itemColor, itemSize)
            : parentFloors;

          const directSetInCart = requestedQtyByProdId.get(parentId) || 0;
          const alreadyPlannedSets = plannedSetsBySetId.get(parentId) || 0;
          const parentAvailFloor1 = Math.max(
            0,
            parentTargetStocks.stockFloor1 - directSetInCart - alreadyPlannedSets
          );
          const parentAvailFloor2 = parentTargetStocks.stockFloor2;

          if (parentAvailFloor1 < setsNeeded) {
            if (parentAvailFloor2 >= setsNeeded) {
              throw new ApiError(
                400,
                'INSUFFICIENT_SET_FLOOR1_NEED_TRANSFER',
                `Sản phẩm lẻ "${displayProductName}" không đủ tại Kho Tầng 1 (còn ${currentRetailFloor1} ${product.unit}, cần ${neededQty}) và Sản phẩm bộ "${parentProduct.name}" (${parentProduct.code}) đã hết tại Kho Tầng 1 (đang còn ${parentAvailFloor2} ${parentProduct.unit} ở Kho Tầng 2). Vui lòng làm phiếu chuyển tầng Sản phẩm bộ xuống Kho Tầng 1 trước khi bán!`,
                {
                  productId: prodKey,
                  stockFloor1: String(currentRetailFloor1),
                  parentSetProductId: parentId,
                  parentSetStockFloor2: String(parentAvailFloor2),
                }
              );
            }

            throw new ApiError(
              400,
              'INSUFFICIENT_STOCK',
              `Sản phẩm "${displayProductName}" không đủ tồn tại Kho Tầng 1 (Tồn lẻ Tầng 1: ${currentRetailFloor1} ${product.unit}, Sản phẩm bộ "${parentProduct.name}" ở Tầng 1 còn: ${parentAvailFloor1} ${parentProduct.unit} = +${parentAvailFloor1 * packSize} ${product.unit}, Yêu cầu: ${neededQty} ${product.unit})`,
              { productId: prodKey, stockFloor1: String(currentRetailFloor1) }
            );
          }

          plannedSetsBySetId.set(parentId, alreadyPlannedSets + setsNeeded);
          autoUnpackPlans.push({
            retailProduct: product,
            parentProduct,
            setsToUnpack: setsNeeded,
            color: itemColor,
            size: itemSize,
          });
        } else {
          throw new ApiError(
            400,
            'INSUFFICIENT_STOCK',
            `Sản phẩm "${hasVariant ? displayProductName : product.name}" không đủ tồn tại Kho Tầng 1 (Tồn Kho Tầng 1: ${currentRetailFloor1}, Yêu cầu: ${neededQty})`,
            { productId: prodKey, stockFloor1: String(currentRetailFloor1) }
          );
        }
      }
    }
  }

  const rawSubtotal = orderItems.reduce(
    (sum, i) =>
      i.isGift || i.discountType === 'GIFT'
        ? sum
        : sum + (Number(i.originalUnitPrice ?? i.unitPrice) || 0) * i.quantity,
    0
  );
  const itemDiscountTotal = orderItems.reduce(
    (sum, i) => sum + (Number(i.discountAmount) || 0),
    0
  );
  const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const rawBillDiscType = String(billDiscountType || 'NONE').toUpperCase();
  const cleanBillDiscType: DiscountType =
    rawBillDiscType === 'PERCENT' || rawBillDiscType === 'AMOUNT'
      ? (rawBillDiscType as DiscountType)
      : 'NONE';
  const rawBillDiscVal = Math.max(0, Number(billDiscountValue) || 0);
  const cleanBillDiscValue =
    cleanBillDiscType === 'PERCENT'
      ? Math.min(100, rawBillDiscVal)
      : cleanBillDiscType === 'AMOUNT'
      ? Math.min(subtotal, Math.round(rawBillDiscVal))
      : 0;

  const billDiscountAmount =
    cleanBillDiscType === 'PERCENT'
      ? Math.round((subtotal * cleanBillDiscValue) / 100)
      : cleanBillDiscType === 'AMOUNT'
      ? cleanBillDiscValue
      : 0;

  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);
  let resolvedCardFeePercent = 0;
  if (method === 'CARD') {
    const parsedPct = Number(rawCardFeePercent);
    if (rawCardFeePercent !== undefined && rawCardFeePercent !== null && !isNaN(parsedPct) && parsedPct >= 0) {
      resolvedCardFeePercent = parsedPct;
    } else if (hasCardFee === false) {
      resolvedCardFeePercent = 0;
    } else {
      resolvedCardFeePercent = 1.8;
    }
  }
  const applyCardFee = method === 'CARD' && resolvedCardFeePercent > 0;
  const cardFeePercent = applyCardFee ? resolvedCardFeePercent : 0;
  const cardFee = applyCardFee ? Math.round((afterBillDiscount * cardFeePercent) / 100) : 0;
  const totalAmount = afterBillDiscount + cardFee;

  // Xử lý tách thanh toán & Công nợ (Mua trước trả sau) khi method === 'OTHER'
  const validSplitMethods: SplitMethod[] = ['CASH', 'BANKING', 'CARD', 'DEBT'];
  const cleanSplitPayments: ISplitPaymentItem[] = [];
  if (method === 'OTHER' && Array.isArray(splitPayments)) {
    for (const sp of splitPayments) {
      const m = String(sp?.method || '').toUpperCase() as SplitMethod;
      if (validSplitMethods.includes(m)) {
        cleanSplitPayments.push({
          method: m,
          amount: Math.max(0, Math.round(Number(sp?.amount) || 0)),
        });
      }
    }
  }

  let debtAmount = 0;
  if (rawBodyDebtAmount !== undefined && rawBodyDebtAmount !== null && Number(rawBodyDebtAmount) > 0) {
    debtAmount = Math.min(totalAmount, Math.max(0, Math.round(Number(rawBodyDebtAmount) || 0)));
  } else if (method === 'OTHER') {
    const debtFromSplits = cleanSplitPayments
      .filter((s) => s.method === 'DEBT')
      .reduce((sum, s) => sum + s.amount, 0);
    const hasDebtSplit = cleanSplitPayments.some((s) => s.method === 'DEBT');
    const nonDebtPaidFromSplits = cleanSplitPayments
      .filter((s) => s.method !== 'DEBT')
      .reduce((sum, s) => sum + s.amount, 0);

    if (rawBodyDebtAmount !== undefined && rawBodyDebtAmount !== null) {
      debtAmount = Math.min(totalAmount, Math.max(0, Math.round(Number(rawBodyDebtAmount) || 0)));
    } else if (debtFromSplits > 0) {
      debtAmount = Math.min(totalAmount, debtFromSplits);
    } else if (hasDebtSplit) {
      // Nếu chọn thẻ Công nợ nhưng để trống số tiền (0), tự hiểu phần còn lại sau khi trừ các phương thức đã trả là Công nợ
      debtAmount = Math.max(0, totalAmount - nonDebtPaidFromSplits);
    } else if (/công\s*nợ|trả\s*sau|debt/i.test(cleanPaymentDetail)) {
      const m = /(?:công\s*nợ|trả\s*sau|debt)[^0-9]*([0-9][0-9.,]*)/i.exec(cleanPaymentDetail);
      if (m) {
        const parsed = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          debtAmount = Math.min(totalAmount, parsed);
        }
      }
      if (debtAmount === 0) {
        debtAmount = totalAmount;
      }
    }
  }

  const initialDebtAmount = debtAmount;
  const paidAmount = Math.max(0, totalAmount - debtAmount);
  const debtStatus: DebtStatus =
    debtAmount <= 0 ? 'NONE' : paidAmount <= 0 ? 'UNPAID' : 'PARTIAL';
  const debtDueDate = debtAmount > 0 ? parseDueDateInput(rawBodyDebtDueDate) : null;

  return {
    cleanPhone,
    existingCustomer,
    finalCustomerName,
    orderItems,
    productUpdates,
    autoUnpackPlans,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    cleanBillDiscType: (cleanBillDiscValue > 0 ? cleanBillDiscType : 'NONE') as DiscountType,
    cleanBillDiscValue,
    billDiscountAmount,
    method,
    cleanPaymentDetail,
    cleanSplitPayments,
    applyCardFee,
    cardFeePercent,
    cardFee,
    totalAmount,
    paidAmount,
    debtAmount,
    initialDebtAmount,
    debtStatus,
    debtDueDate,
    cleanNote: note && String(note).trim() ? String(note).trim() : 'Giá đã bao gồm thuế',
  };
}

async function applyPaidOrderSideEffects(
  orderId: string,
  orderCode: string,
  prepared: Awaited<ReturnType<typeof prepareOrderData>>,
  user: any
) {
  let customer = prepared.existingCustomer;
  if (!customer) {
    customer = await customerRepo.create({
      phone: prepared.cleanPhone,
      name: prepared.finalCustomerName,
      totalOrders: 1,
      totalSpent: prepared.totalAmount,
      lastOrderAt: new Date(),
    });
  } else {
    customer = await customerRepo.updateById(customer._id, {
      name: prepared.finalCustomerName,
      totalOrders: (customer.totalOrders || 0) + 1,
      totalSpent: (customer.totalSpent || 0) + prepared.totalAmount,
      lastOrderAt: new Date(),
    });
  }

  // Thực hiện tự động tách Bộ -> Lẻ tại Kho Tầng 1 trước khi trừ tồn bán hàng
  if (Array.isArray(prepared.autoUnpackPlans) && prepared.autoUnpackPlans.length > 0) {
    for (const plan of prepared.autoUnpackPlans) {
      await executeUnpackSetToRetail({
        retailProductId: String(plan.retailProduct._id),
        setsToUnpack: plan.setsToUnpack,
        warehouse: 'FLOOR_1',
        color: plan.color,
        size: plan.size,
        reason: `Tự động tách bộ khi bán đơn ${orderCode}`,
        actorId: user?.userId || 'SALES',
        actorName: user?.fullName || 'Nhân viên bán hàng',
        actorRole: user?.role || 'SALES',
      });
    }
  }

  for (const { product, qty, isGift, color, size } of prepared.productUpdates) {
    const currentProd = (await productRepo.findById(product._id)) || product;
    const beforeFloors = getFloorStocks(currentProd);
    const balanceBefore = beforeFloors.stock;
    const nextFloors = deductStockForSale(currentProd, qty, color, size);
    const balanceAfter = nextFloors.stock;

    await productRepo.updateById(product._id, {
      variants: nextFloors.variants,
      stockFloor1: nextFloors.stockFloor1,
      stockFloor2: nextFloors.stockFloor2,
      stock: nextFloors.stock,
    });

    await stockMovementRepo.create({
      type: 'SALE',
      productId: product._id,
      productCode: product.code,
      productName: formatProductWithVariant(product.name, color, size),
      color,
      size,
      categoryId: product.categoryId,
      unit: product.unit,
      quantityChange: -qty,
      balanceBefore,
      balanceAfter,
      warehouseLocation: 'FLOOR_1',
      referenceType: 'ORDER',
      referenceId: orderId,
      referenceCode: orderCode,
      performedBy: user?.userId || 'SALES',
      performedByName: user?.fullName || 'Nhân viên bán hàng',
      note: isGift
        ? `Xuất hàng tặng đơn ${orderCode} (Kho Tầng 1)`
        : `Bán hàng đơn ${orderCode} (Kho Tầng 1)`,
    });
  }

  return customer;
}

// POST /api/v1/orders

// PUT /api/v1/orders/:id

// POST /api/v1/orders/:id/confirm

// POST /api/v1/orders/:id/debt-payment — Chỉ CEO, ADMIN hoặc ACCOUNTANT trên CMS được xác nhận thu nợ / tất toán công nợ

// DELETE /api/v1/orders/:id


export async function getCurrentShiftOrders(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const {
      search,
      status,
      paymentMethod,
      shiftCode: queryShiftCode,
      date: queryDate,
    } = query || {};
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    const rawDate = String(queryDate || '').trim();
    const isAllDates =
      !rawDate ||
      rawDate.toUpperCase() === 'ALL' ||
      rawDate.toUpperCase() === '3DAYS';

    if (!isAllDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        throw new ApiError(400, 'INVALID_DATE', 'Định dạng ngày lọc không hợp lệ (YYYY-MM-DD)');
      }
    }

    const staffShift = await resolveStaffShiftForDate(ctx.user, todayStr, now);
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const qShift = String(queryShiftCode || '').trim().toUpperCase();

    // 1. Lọc danh sách đơn theo ngày (nếu chọn) hoặc toàn bộ ngày (khi chọn ALL), không giới hạn ca hay số ngày
    const shiftOrders = allOrders
      .filter((o) => {
        const eff = getOrderEffectiveShiftAndDate(o);
        if (!isAllDates && eff.shiftDate !== rawDate) {
          return false;
        }

        if (qShift === 'SHIFT_1' || qShift === 'SHIFT_2') {
          return eff.shiftCode === qShift;
        }
        return true;
      })
      .map((o) => {
        const eff = getOrderEffectiveShiftAndDate(o);
        return {
          ...o,
          shiftDate: o.shiftDate || eff.shiftDate,
          shiftCode: o.shiftCode || eff.shiftCode,
        };
      });

    const summary = computeShiftOrdersSummary(shiftOrders);

    // 2. Áp dụng bộ lọc phụ (status, paymentMethod, search)
    const subFiltered = shiftOrders.filter((o) => {
      if (status && String(status).toUpperCase() !== 'ALL') {
        if (o.status !== String(status).toUpperCase()) return false;
      }
      if (paymentMethod && String(paymentMethod).toUpperCase() !== 'ALL') {
        if (o.paymentMethod !== String(paymentMethod).toUpperCase()) return false;
      }
      return true;
    });

    const filtered = search
      ? filterAndRankBySearch(subFiltered, String(search), (o) => [
          { text: o.orderCode, weight: 1.6 },
          { text: o.customerPhone, weight: 1.5 },
          { text: o.customerName, weight: 1.3 },
          { text: o.createdByName, weight: 0.9 },
          { text: o.confirmedByName || '', weight: 0.9 },
          { text: o.paymentMethodDetail || '', weight: 0.8 },
          { text: o.note, weight: 0.7 },
          ...(o.items || []).flatMap((i: any) => [
            { text: i.productCode, weight: 1.2 },
            { text: i.productName, weight: 1.1 },
            { text: i.color || '', weight: 1.1 },
            { text: i.size || '', weight: 1.0 },
          ]),
        ])
      : subFiltered;

    const effectiveShiftForMeta: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' =
      qShift === 'SHIFT_1'
        ? 'SHIFT_1'
        : qShift === 'SHIFT_2'
          ? 'SHIFT_2'
          : 'BOTH';

    const effectiveShiftLabel =
      effectiveShiftForMeta === 'SHIFT_1'
        ? getShiftDisplayLabel('SHIFT_1')
        : effectiveShiftForMeta === 'SHIFT_2'
          ? getShiftDisplayLabel('SHIFT_2')
          : 'Cả ngày (Mọi ca)';

    return ok(filtered, {
        total: filtered.length,
        date: !isAllDates ? rawDate : todayStr,
        dateFilter: !isAllDates ? rawDate : 'ALL',
        maxDate: todayStr,
        staffShift,
        shiftCode: effectiveShiftForMeta,
        shiftLabel: effectiveShiftLabel,
        summary,
      });
}

export async function listOrders(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const {
      search,
      phone,
      status,
      paymentMethod,
      debtStatus,
      date: queryDate,
      shiftCode: queryShiftCode,
    } = query || {};
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const normFilterPhone = phone ? normalizePhoneDigits(String(phone)) : '';
    const now = new Date();
    const nowMs = now.getTime();

    const baseFiltered = allOrders.filter((o) => {
      const eff = getOrderEffectiveShiftAndDate(o);
      if (typeof queryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(queryDate.trim())) {
        if (eff.shiftDate !== queryDate.trim()) return false;
      }
      if (typeof queryShiftCode === 'string' && queryShiftCode.trim() && queryShiftCode !== 'ALL') {
        if (eff.shiftCode !== queryShiftCode.trim().toUpperCase()) return false;
      }

      if (phone) {
        const oPhoneNorm = normalizePhoneDigits(o.customerPhone);
        const rawMatch =
          o.customerPhone.replace(/\s+/g, '') === String(phone).replace(/\s+/g, '').trim();
        if (!rawMatch && (!normFilterPhone || oPhoneNorm !== normFilterPhone)) {
          return false;
        }
      }
      if (status && o.status !== String(status).toUpperCase()) return false;
      if (paymentMethod && o.paymentMethod !== String(paymentMethod).toUpperCase()) return false;
      if (debtStatus) {
        const ds = String(debtStatus).toUpperCase();
        const debtAmt = Math.max(0, Number(o.debtAmount) || 0);
        const initDebtAmt = Math.max(0, Number(o.initialDebtAmount) || debtAmt);
        const oDebtStatus = o.debtStatus || (debtAmt > 0 ? 'UNPAID' : 'NONE');
        if (ds === 'HAS_DEBT') {
          if (debtAmt <= 0) return false;
        } else if (ds === 'ALL_DEBT') {
          if (initDebtAmt <= 0 && debtAmt <= 0) return false;
        } else if (ds === 'OVERDUE') {
          if (
            debtAmt <= 0 ||
            !o.debtDueDate ||
            new Date(o.debtDueDate).getTime() >= nowMs
          ) {
            return false;
          }
        } else if (oDebtStatus !== ds) {
          return false;
        }
      }
      return true;
    });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (o) => [
          { text: o.orderCode, weight: 1.6 },
          { text: o.customerPhone, weight: 1.5 },
          { text: o.customerName, weight: 1.3 },
          { text: o.createdByName, weight: 0.9 },
          { text: o.confirmedByName, weight: 0.9 },
          { text: o.paymentMethodDetail || '', weight: 0.8 },
          { text: o.note, weight: 0.7 },
          ...o.items.flatMap((i) => [
            { text: i.productCode, weight: 1.2 },
            { text: i.productName, weight: 1.1 },
            { text: i.color || '', weight: 1.1 },
            { text: i.size || '', weight: 1.0 },
          ]),
        ])
      : baseFiltered;

    return ok(filtered, {
        total: filtered.length,
      });
}

export async function getOrderByCode(ctx: ServiceContext, code: string): Promise<ServiceResult> {
  const cleanCode = String(code || '').trim().toUpperCase();
    const order = await orderRepo.findOne({ orderCode: cleanCode });
    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Không tìm thấy đơn hàng có mã "${code}"`);
    }

    const returns = await returnExchangeRepo.find({ orderId: order._id }, { createdAt: -1 });

    return ok({
        ...order,
        returns,
      }, {});
}

export async function getOrderById(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  const idOrCode = String(id || '').trim();
    const order =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
    }

    const returns = await returnExchangeRepo.find({ orderId: order._id }, { createdAt: -1 });

    return ok({
        ...order,
        returns,
      }, {});
}

export async function createOrder(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const rawStatus = String(body?.status || '').toUpperCase();
    const isDraft = Boolean(body?.isDraft) || rawStatus === 'DRAFT';

    const prepared = await prepareOrderData(body, isDraft);
    const orderCode = await generateNextOrderCode();
    const now = new Date();
    const { shiftDate, shiftCode } = await resolveOrderShiftOnWrite(
      ctx.user,
      body?.shiftCode,
      now
    );

    const createdOrder = await orderRepo.create({
      orderCode,
      customerId: prepared.existingCustomer?._id || '',
      customerName: prepared.finalCustomerName,
      customerPhone: prepared.cleanPhone,
      items: prepared.orderItems,
      rawSubtotal: prepared.rawSubtotal,
      itemDiscountTotal: prepared.itemDiscountTotal,
      subtotal: prepared.subtotal,
      billDiscountType: prepared.cleanBillDiscType,
      billDiscountValue: prepared.cleanBillDiscValue,
      billDiscountAmount: prepared.billDiscountAmount,
      paymentMethod: prepared.method,
      paymentMethodDetail: prepared.cleanPaymentDetail,
      splitPayments: prepared.cleanSplitPayments,
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
      paidAmount: prepared.paidAmount,
      debtAmount: prepared.debtAmount,
      initialDebtAmount: prepared.initialDebtAmount,
      debtStatus: prepared.debtStatus,
      debtDueDate: prepared.debtDueDate,
      debtPayments: [],
      debtAdjustments: [],
      note: prepared.cleanNote,
      status: isDraft ? 'DRAFT' : 'PAID',
      shiftDate,
      shiftCode,
      createdBy: ctx.user?.userId || 'SALES',
      createdByName: ctx.user?.fullName || 'Nhân viên bán hàng',
      confirmedBy: isDraft ? '' : ctx.user?.userId || 'SALES',
      confirmedByName: isDraft ? '' : ctx.user?.fullName || 'Nhân viên bán hàng',
      confirmedAt: isDraft ? null : now,
    });

    if (!isDraft) {
      const customer = await applyPaidOrderSideEffects(
        createdOrder._id,
        createdOrder.orderCode,
        prepared,
        ctx.user
      );
      if (customer && !createdOrder.customerId) {
        await orderRepo.updateById(createdOrder._id, { customerId: customer._id });
        createdOrder.customerId = customer._id;
      }
    }

    return created(createdOrder, { isDraft, shiftDate, shiftCode });
}

export async function updateDraftOrder(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const idOrCode = String(id || '').trim();
    const existingOrder =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!existingOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy hóa đơn cần cập nhật');
    }

    if (existingOrder.status !== 'DRAFT') {
      throw new ApiError(
        400,
        'ORDER_ALREADY_PAID',
        `Hóa đơn ${existingOrder.orderCode} đã thanh toán (${existingOrder.status}), không thể sửa bản nháp`
      );
    }

    const now = new Date();
    const todayStr = toLocalDateStr(now);
    if (isSalesOnlyUser(ctx.user)) {
      const staffShift = await resolveStaffShiftForDate(ctx.user, todayStr, now);
      if (!isOrderInSalesCurrentShift(existingOrder, staffShift, todayStr)) {
        throw new ApiError(
          403,
          'ORDER_SHIFT_RESTRICTED',
          'Nhân viên Sales chỉ được thao tác trên đơn hàng trong ca làm việc hiện tại của ngày hôm nay.'
        );
      }
    }

    const rawStatus = String(body?.status || 'DRAFT').toUpperCase();
    const isDraft = body?.isDraft !== undefined ? Boolean(body.isDraft) : rawStatus !== 'PAID';

    const mergedBody = {
      customerName: body?.customerName ?? existingOrder.customerName,
      customerPhone: body?.customerPhone ?? existingOrder.customerPhone,
      paymentMethod: body?.paymentMethod ?? existingOrder.paymentMethod,
      paymentMethodDetail: body?.paymentMethodDetail ?? existingOrder.paymentMethodDetail,
      splitPayments: body?.splitPayments ?? existingOrder.splitPayments,
      debtAmount: body?.debtAmount ?? existingOrder.debtAmount,
      debtDueDate: body?.debtDueDate ?? existingOrder.debtDueDate,
      hasCardFee: body?.hasCardFee ?? existingOrder.hasCardFee,
      cardFeePercent: body?.cardFeePercent ?? existingOrder.cardFeePercent,
      billDiscountType: body?.billDiscountType ?? existingOrder.billDiscountType,
      billDiscountValue: body?.billDiscountValue ?? existingOrder.billDiscountValue,
      note: body?.note ?? existingOrder.note,
      items: body?.items ?? existingOrder.items,
    };

    const prepared = await prepareOrderData(mergedBody, isDraft);

    let customerId = existingOrder.customerId || prepared.existingCustomer?._id || '';
    if (!isDraft) {
      const customer = await applyPaidOrderSideEffects(
        existingOrder._id,
        existingOrder.orderCode,
        prepared,
        ctx.user
      );
      if (customer) customerId = customer._id;
    }

    const resolvedShift = !isDraft
      ? await resolveOrderShiftOnWrite(ctx.user, body?.shiftCode, now)
      : null;

    const updatedOrder = await orderRepo.updateById(existingOrder._id, {
      customerId,
      customerName: prepared.finalCustomerName,
      customerPhone: prepared.cleanPhone,
      items: prepared.orderItems,
      rawSubtotal: prepared.rawSubtotal,
      itemDiscountTotal: prepared.itemDiscountTotal,
      subtotal: prepared.subtotal,
      billDiscountType: prepared.cleanBillDiscType,
      billDiscountValue: prepared.cleanBillDiscValue,
      billDiscountAmount: prepared.billDiscountAmount,
      paymentMethod: prepared.method,
      paymentMethodDetail: prepared.cleanPaymentDetail,
      splitPayments: prepared.cleanSplitPayments,
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
      paidAmount: prepared.paidAmount,
      debtAmount: prepared.debtAmount,
      initialDebtAmount: prepared.initialDebtAmount,
      debtStatus: prepared.debtStatus,
      debtDueDate: prepared.debtDueDate,
      note: prepared.cleanNote,
      status: isDraft ? 'DRAFT' : 'PAID',
      ...(isDraft
        ? {}
        : {
            shiftDate: resolvedShift?.shiftDate || existingOrder.shiftDate,
            shiftCode: resolvedShift?.shiftCode || existingOrder.shiftCode,
            confirmedBy: ctx.user?.userId || 'SALES',
            confirmedByName: ctx.user?.fullName || 'Nhân viên bán hàng',
            confirmedAt: now,
          }),
    });

    return ok(updatedOrder, { isDraft });
}

export async function confirmDraftOrder(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const idOrCode = String(id || '').trim();
    const existingOrder =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!existingOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy hóa đơn nháp cần xác nhận thanh toán');
    }

    if (existingOrder.status !== 'DRAFT') {
      throw new ApiError(
        400,
        'ORDER_ALREADY_PAID',
        `Hóa đơn ${existingOrder.orderCode} đã được thanh toán trước đó (${existingOrder.status})`
      );
    }

    const now = new Date();
    const todayStr = toLocalDateStr(now);
    if (isSalesOnlyUser(ctx.user)) {
      const staffShift = await resolveStaffShiftForDate(ctx.user, todayStr, now);
      if (!isOrderInSalesCurrentShift(existingOrder, staffShift, todayStr)) {
        throw new ApiError(
          403,
          'ORDER_SHIFT_RESTRICTED',
          'Nhân viên Sales chỉ được xác nhận thanh toán bản nháp trong ca làm việc hiện tại của ngày hôm nay.'
        );
      }
    }

    const mergedBody = {
      customerName: body?.customerName ?? existingOrder.customerName,
      customerPhone: body?.customerPhone ?? existingOrder.customerPhone,
      paymentMethod: body?.paymentMethod ?? existingOrder.paymentMethod,
      paymentMethodDetail: body?.paymentMethodDetail ?? existingOrder.paymentMethodDetail,
      splitPayments: body?.splitPayments ?? existingOrder.splitPayments,
      debtAmount: body?.debtAmount ?? existingOrder.debtAmount,
      debtDueDate: body?.debtDueDate ?? existingOrder.debtDueDate,
      hasCardFee: body?.hasCardFee ?? existingOrder.hasCardFee,
      cardFeePercent: body?.cardFeePercent ?? existingOrder.cardFeePercent,
      billDiscountType: body?.billDiscountType ?? existingOrder.billDiscountType,
      billDiscountValue: body?.billDiscountValue ?? existingOrder.billDiscountValue,
      note: body?.note ?? existingOrder.note,
      items: body?.items ?? existingOrder.items,
    };

    const prepared = await prepareOrderData(mergedBody, false);
    const customer = await applyPaidOrderSideEffects(
      existingOrder._id,
      existingOrder.orderCode,
      prepared,
      ctx.user
    );
    const { shiftDate, shiftCode } = await resolveOrderShiftOnWrite(
      ctx.user,
      body?.shiftCode,
      now
    );

    const updatedOrder = await orderRepo.updateById(existingOrder._id, {
      customerId: customer?._id || existingOrder.customerId || '',
      customerName: prepared.finalCustomerName,
      customerPhone: prepared.cleanPhone,
      items: prepared.orderItems,
      rawSubtotal: prepared.rawSubtotal,
      itemDiscountTotal: prepared.itemDiscountTotal,
      subtotal: prepared.subtotal,
      billDiscountType: prepared.cleanBillDiscType,
      billDiscountValue: prepared.cleanBillDiscValue,
      billDiscountAmount: prepared.billDiscountAmount,
      paymentMethod: prepared.method,
      paymentMethodDetail: prepared.cleanPaymentDetail,
      splitPayments: prepared.cleanSplitPayments,
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
      paidAmount: prepared.paidAmount,
      debtAmount: prepared.debtAmount,
      initialDebtAmount: prepared.initialDebtAmount,
      debtStatus: prepared.debtStatus,
      debtDueDate: prepared.debtDueDate,
      note: prepared.cleanNote,
      status: 'PAID',
      shiftDate,
      shiftCode,
      confirmedBy: ctx.user?.userId || 'SALES',
      confirmedByName: ctx.user?.fullName || 'Nhân viên bán hàng',
      confirmedAt: now,
    });

    return ok(updatedOrder, { shiftDate, shiftCode });
}


export async function deleteDraftOrder(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  const idOrCode = String(id || '').trim();
    const existingOrder =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!existingOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy hóa đơn');
    }

    if (existingOrder.status !== 'DRAFT') {
      throw new ApiError(
        400,
        'ORDER_ALREADY_PAID',
        `Chỉ được xóa hóa đơn ở trạng thái Bản nháp (DRAFT). Hóa đơn ${existingOrder.orderCode} đang ở trạng thái ${existingOrder.status}`
      );
    }

    if (isSalesOnlyUser(ctx.user)) {
      const now = new Date();
      const todayStr = toLocalDateStr(now);
      const staffShift = await resolveStaffShiftForDate(ctx.user, todayStr, now);
      if (!isOrderInSalesCurrentShift(existingOrder, staffShift, todayStr)) {
        throw new ApiError(
          403,
          'ORDER_SHIFT_RESTRICTED',
          'Nhân viên Sales chỉ được xóa bản nháp trong ca làm việc hiện tại của ngày hôm nay.'
        );
      }
    }

    await orderRepo.deleteById(existingOrder._id);
    return ok({
        deleted: true,
        _id: existingOrder._id,
        orderCode: existingOrder.orderCode,
      }, {});
}


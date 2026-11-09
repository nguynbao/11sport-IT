import { Router } from 'express';
import {
  customerRepo,
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import {
  DebtStatus,
  DiscountType,
  IDebtPaymentRecord,
  IOrderItem,
  ISplitPaymentItem,
  PaymentMethod,
  SplitMethod,
} from '../models/Order';
import {
  deductStockForSale,
  getFloorStocks,
  getVariantFloorStocks,
  formatProductWithVariant,
} from '../utils/warehouseFloor';
import { executeUnpackSetToRetail } from '../utils/unpackSet';
import { buildVariantKey } from '../utils/productCode';
import { filterAndRankBySearch, normalizePhoneDigits } from '../utils/search';

export const ordersCustomersRouter = Router();

function parseDueDateInput(raw: unknown): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

// GET /api/v1/customers/lookup?phone=...
ordersCustomersRouter.get('/customers/lookup', async (req, res, next) => {
  try {
    const rawPhone = String(req.query.phone || '').replace(/\s+/g, '').trim();
    const normPhone = normalizePhoneDigits(rawPhone);
    if (!rawPhone) {
      throw new ApiError(400, 'PHONE_REQUIRED', 'Vui lòng nhập số điện thoại để tra cứu', {
        phone: 'Bắt buộc',
      });
    }

    const allCustomers = await customerRepo.find({});
    const customer =
      (await customerRepo.findOne({ phone: rawPhone })) ||
      (normPhone
        ? allCustomers.find((c) => normalizePhoneDigits(c.phone) === normPhone) || null
        : null);

    const targetPhone = customer?.phone || normPhone || rawPhone;
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const orders = allOrders.filter(
      (o) =>
        o.customerPhone === targetPhone ||
        (normPhone && normalizePhoneDigits(o.customerPhone) === normPhone)
    );
    const allReturns = await returnExchangeRepo.find({}, { createdAt: -1 });
    const returns = allReturns.filter(
      (r) =>
        r.customerPhone === targetPhone ||
        (normPhone && normalizePhoneDigits(r.customerPhone) === normPhone)
    );

    const nowMs = Date.now();
    let totalDebtAmount = 0;
    let unpaidOrdersCount = 0;
    let overdueOrdersCount = 0;

    for (const o of orders) {
      if (o.status === 'DRAFT') continue;
      const debt = Math.max(0, Number(o.debtAmount) || 0);
      if (debt > 0) {
        totalDebtAmount += debt;
        unpaidOrdersCount += 1;
        if (o.debtDueDate && new Date(o.debtDueDate).getTime() < nowMs) {
          overdueOrdersCount += 1;
        }
      }
    }

    res.json({
      data: {
        found: !!customer,
        customer: customer || null,
        orders,
        returns,
        debtSummary: {
          totalDebtAmount,
          unpaidOrdersCount,
          overdueOrdersCount,
        },
      },
      meta: {
        orderCount: orders.length,
        returnCount: returns.length,
        totalDebtAmount,
        unpaidOrdersCount,
        overdueOrdersCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers
ordersCustomersRouter.get('/customers', async (req, res, next) => {
  try {
    const { search } = req.query;
    const allCustomers = await customerRepo.find({}, { lastOrderAt: -1 });

    const filtered = search
      ? filterAndRankBySearch(allCustomers, String(search), (c) => [
          { text: c.phone, weight: 1.5 },
          { text: c.name, weight: 1.3 },
        ])
      : allCustomers;

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders
ordersCustomersRouter.get('/orders', async (req, res, next) => {
  try {
    const { search, phone, status, paymentMethod, debtStatus } = req.query;
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const normFilterPhone = phone ? normalizePhoneDigits(String(phone)) : '';
    const nowMs = Date.now();

    const baseFiltered = allOrders.filter((o) => {
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

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/by-code/:code
ordersCustomersRouter.get('/orders/by-code/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const order = await orderRepo.findOne({ orderCode: code });
    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Không tìm thấy đơn hàng có mã "${code}"`);
    }

    const returns = await returnExchangeRepo.find({ orderId: order._id }, { createdAt: -1 });

    res.json({
      data: {
        ...order,
        returns,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id
ordersCustomersRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const idOrCode = String(req.params.id || '').trim();
    const order =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
    }

    const returns = await returnExchangeRepo.find({ orderId: order._id }, { createdAt: -1 });

    res.json({
      data: {
        ...order,
        returns,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

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

    // BR-04: Chặn bán sản phẩm có sellingPrice <= 0 (trừ khi chọn làm hàng tặng)
    if (!isGift && (!product.sellingPrice || product.sellingPrice <= 0)) {
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

    const originalUnitPrice = Math.round(Number(product.sellingPrice) || 0);

    if (isGift) {
      orderItems.push({
        productId: product._id,
        productCode: product.code,
        productName: displayProductName,
        color: itemColor,
        size: itemSize,
        unit: product.unit,
        originalUnitPrice,
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
  if (method === 'OTHER') {
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
ordersCustomersRouter.post('/orders', async (req, res, next) => {
  try {
    const rawStatus = String(req.body?.status || '').toUpperCase();
    const isDraft = Boolean(req.body?.isDraft) || rawStatus === 'DRAFT';

    const prepared = await prepareOrderData(req.body, isDraft);
    const orderCode = await generateNextOrderCode();

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
      note: prepared.cleanNote,
      status: isDraft ? 'DRAFT' : 'PAID',
      createdBy: req.user?.userId || 'SALES',
      createdByName: req.user?.fullName || 'Nhân viên bán hàng',
      confirmedBy: isDraft ? '' : req.user?.userId || 'SALES',
      confirmedByName: isDraft ? '' : req.user?.fullName || 'Nhân viên bán hàng',
      confirmedAt: isDraft ? null : new Date(),
    });

    if (!isDraft) {
      const customer = await applyPaidOrderSideEffects(
        createdOrder._id,
        createdOrder.orderCode,
        prepared,
        req.user
      );
      if (customer && !createdOrder.customerId) {
        await orderRepo.updateById(createdOrder._id, { customerId: customer._id });
        createdOrder.customerId = customer._id;
      }
    }

    res.status(201).json({
      data: createdOrder,
      meta: { isDraft },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/orders/:id
ordersCustomersRouter.put('/orders/:id', async (req, res, next) => {
  try {
    const idOrCode = String(req.params.id || '').trim();
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

    const rawStatus = String(req.body?.status || 'DRAFT').toUpperCase();
    const isDraft = req.body?.isDraft !== undefined ? Boolean(req.body.isDraft) : rawStatus !== 'PAID';

    const mergedBody = {
      customerName: req.body?.customerName ?? existingOrder.customerName,
      customerPhone: req.body?.customerPhone ?? existingOrder.customerPhone,
      paymentMethod: req.body?.paymentMethod ?? existingOrder.paymentMethod,
      paymentMethodDetail: req.body?.paymentMethodDetail ?? existingOrder.paymentMethodDetail,
      splitPayments: req.body?.splitPayments ?? existingOrder.splitPayments,
      debtAmount: req.body?.debtAmount ?? existingOrder.debtAmount,
      debtDueDate: req.body?.debtDueDate ?? existingOrder.debtDueDate,
      hasCardFee: req.body?.hasCardFee ?? existingOrder.hasCardFee,
      cardFeePercent: req.body?.cardFeePercent ?? existingOrder.cardFeePercent,
      billDiscountType: req.body?.billDiscountType ?? existingOrder.billDiscountType,
      billDiscountValue: req.body?.billDiscountValue ?? existingOrder.billDiscountValue,
      note: req.body?.note ?? existingOrder.note,
      items: req.body?.items ?? existingOrder.items,
    };

    const prepared = await prepareOrderData(mergedBody, isDraft);

    let customerId = existingOrder.customerId || prepared.existingCustomer?._id || '';
    if (!isDraft) {
      const customer = await applyPaidOrderSideEffects(
        existingOrder._id,
        existingOrder.orderCode,
        prepared,
        req.user
      );
      if (customer) customerId = customer._id;
    }

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
            confirmedBy: req.user?.userId || 'SALES',
            confirmedByName: req.user?.fullName || 'Nhân viên bán hàng',
            confirmedAt: new Date(),
          }),
    });

    res.json({
      data: updatedOrder,
      meta: { isDraft },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/confirm
ordersCustomersRouter.post('/orders/:id/confirm', async (req, res, next) => {
  try {
    const idOrCode = String(req.params.id || '').trim();
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

    const mergedBody = {
      customerName: req.body?.customerName ?? existingOrder.customerName,
      customerPhone: req.body?.customerPhone ?? existingOrder.customerPhone,
      paymentMethod: req.body?.paymentMethod ?? existingOrder.paymentMethod,
      paymentMethodDetail: req.body?.paymentMethodDetail ?? existingOrder.paymentMethodDetail,
      splitPayments: req.body?.splitPayments ?? existingOrder.splitPayments,
      debtAmount: req.body?.debtAmount ?? existingOrder.debtAmount,
      debtDueDate: req.body?.debtDueDate ?? existingOrder.debtDueDate,
      hasCardFee: req.body?.hasCardFee ?? existingOrder.hasCardFee,
      cardFeePercent: req.body?.cardFeePercent ?? existingOrder.cardFeePercent,
      billDiscountType: req.body?.billDiscountType ?? existingOrder.billDiscountType,
      billDiscountValue: req.body?.billDiscountValue ?? existingOrder.billDiscountValue,
      note: req.body?.note ?? existingOrder.note,
      items: req.body?.items ?? existingOrder.items,
    };

    const prepared = await prepareOrderData(mergedBody, false);
    const customer = await applyPaidOrderSideEffects(
      existingOrder._id,
      existingOrder.orderCode,
      prepared,
      req.user
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
      confirmedBy: req.user?.userId || 'SALES',
      confirmedByName: req.user?.fullName || 'Nhân viên bán hàng',
      confirmedAt: new Date(),
    });

    res.json({
      data: updatedOrder,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/debt-payment — Chỉ ADMIN hoặc ACCOUNTANT trên CMS được xác nhận thu nợ / tất toán công nợ
ordersCustomersRouter.post('/orders/:id/debt-payment', async (req, res, next) => {
  try {
    if (!['ADMIN', 'ACCOUNTANT'].includes(req.user?.role || '')) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Quản lý (ADMIN) hoặc Kế toán (ACCOUNTANT) trên CMS mới được phép xác nhận thu nợ / tất toán công nợ'
      );
    }

    const idOrCode = String(req.params.id || '').trim();
    const existingOrder =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!existingOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng cần thu nợ');
    }

    if (existingOrder.status === 'DRAFT') {
      throw new ApiError(
        400,
        'ORDER_IS_DRAFT',
        'Đơn hàng đang ở trạng thái Bản nháp (DRAFT), chưa phát sinh công nợ thực tế'
      );
    }

    const currentDebt = Math.max(0, Number(existingOrder.debtAmount) || 0);
    if (currentDebt <= 0) {
      throw new ApiError(
        400,
        'ORDER_NO_DEBT',
        `Đơn hàng ${existingOrder.orderCode} đã thanh toán đủ, không còn dư nợ`
      );
    }

    const rawAmount = req.body?.amount;
    const payAmount =
      rawAmount === undefined || rawAmount === null || req.body?.payFull === true
        ? currentDebt
        : Math.round(Number(rawAmount));

    if (isNaN(payAmount) || payAmount <= 0 || payAmount > currentDebt) {
      throw new ApiError(
        400,
        'INVALID_DEBT_PAYMENT_AMOUNT',
        `Số tiền thu nợ phải lớn hơn 0 và không vượt quá dư nợ hiện tại (${currentDebt.toLocaleString('vi-VN')} VND)`,
        { amount: 'Số tiền thu nợ không hợp lệ' }
      );
    }

    const rawMethod = String(req.body?.method || 'BANKING').toUpperCase();
    const validMethods: ('CASH' | 'BANKING' | 'CARD')[] = ['CASH', 'BANKING', 'CARD'];
    const method: 'CASH' | 'BANKING' | 'CARD' = validMethods.includes(rawMethod as any)
      ? (rawMethod as 'CASH' | 'BANKING' | 'CARD')
      : 'BANKING';

    const note = String(req.body?.note || '').trim() || 'Thu công nợ khách hàng';
    const paymentRecord: IDebtPaymentRecord = {
      _id: `dp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: payAmount,
      method,
      note,
      paidAt: new Date(),
      collectedBy: req.user?.userId || 'ADMIN',
      collectedByName: req.user?.fullName || 'Quản Trị Viên 11Sport',
    };

    const prevPayments = Array.isArray(existingOrder.debtPayments)
      ? existingOrder.debtPayments
      : [];
    const nextDebtAmount = Math.max(0, currentDebt - payAmount);
    const totalOrderAmount = Math.max(0, Number(existingOrder.totalAmount) || 0);
    const nextPaidAmount = Math.max(0, totalOrderAmount - nextDebtAmount);
    const initialDebt = Math.max(
      currentDebt,
      Number(existingOrder.initialDebtAmount) || currentDebt
    );
    const nextDebtStatus: DebtStatus = nextDebtAmount === 0 ? 'SETTLED' : 'PARTIAL';

    const updatedOrder = await orderRepo.updateById(existingOrder._id, {
      paidAmount: nextPaidAmount,
      debtAmount: nextDebtAmount,
      initialDebtAmount: initialDebt,
      debtStatus: nextDebtStatus,
      debtPayments: [...prevPayments, paymentRecord],
    });

    res.json({
      data: updatedOrder,
      meta: {
        collectedAmount: payAmount,
        remainingDebt: nextDebtAmount,
        debtStatus: nextDebtStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/orders/:id
ordersCustomersRouter.delete('/orders/:id', async (req, res, next) => {
  try {
    const idOrCode = String(req.params.id || '').trim();
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

    await orderRepo.deleteById(existingOrder._id);
    res.json({
      data: {
        deleted: true,
        _id: existingOrder._id,
        orderCode: existingOrder.orderCode,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

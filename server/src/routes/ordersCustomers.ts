import { Router } from 'express';
import {
  customerRepo,
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { DiscountType, IOrderItem, PaymentMethod } from '../models/Order';
import { deductStockForSale, getFloorStocks } from '../utils/warehouseFloor';
import { filterAndRankBySearch, normalizePhoneDigits } from '../utils/search';

export const ordersCustomersRouter = Router();

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

    res.json({
      data: {
        found: !!customer,
        customer: customer || null,
        orders,
        returns,
      },
      meta: {
        orderCount: orders.length,
        returnCount: returns.length,
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
    const { search, phone, status, paymentMethod } = req.query;
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const normFilterPhone = phone ? normalizePhoneDigits(String(phone)) : '';

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
      return true;
    });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (o) => [
          { text: o.orderCode, weight: 1.6 },
          { text: o.customerPhone, weight: 1.5 },
          { text: o.customerName, weight: 1.3 },
          { text: o.createdByName, weight: 0.9 },
          { text: o.confirmedByName, weight: 0.9 },
          { text: o.note, weight: 0.7 },
          ...o.items.flatMap((i) => [
            { text: i.productCode, weight: 1.2 },
            { text: i.productName, weight: 1.1 },
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
    hasCardFee,
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

  // Kiểm tra từng sản phẩm: tồn tại, sellingPrice > 0, và khi chốt thanh toán (!isDraft) thì tổng số lượng <= stockFloor1
  const orderItems: IOrderItem[] = [];
  const productUpdates: { product: any; qty: number; isGift: boolean }[] = [];
  const requestedQtyByProdId = new Map<string, number>();

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

    // Khi chốt đơn thanh toán (!isDraft): bắt buộc kiểm tra đủ tồn tại Kho Tầng 1
    if (!isDraft) {
      const floors = getFloorStocks(product);
      if (floors.stockFloor1 < totalRequestedForProduct) {
        throw new ApiError(
          400,
          'INSUFFICIENT_STOCK',
          `Sản phẩm "${product.name}" không đủ tồn tại Kho Tầng 1 (Tồn Kho Tầng 1: ${floors.stockFloor1}, Yêu cầu: ${totalRequestedForProduct})`,
          { productId: String(product._id), stockFloor1: String(floors.stockFloor1) }
        );
      }
    }

    const originalUnitPrice = Math.round(Number(product.sellingPrice) || 0);

    if (isGift) {
      orderItems.push({
        productId: product._id,
        productCode: product.code,
        productName: product.name,
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
        productName: product.name,
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

    productUpdates.push({ product, qty, isGift });
  }

  // Tính tiền hàng (không tính tiền hàng tặng), giảm giá sản phẩm, giảm giá Bill & Phí quẹt thẻ 3%
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
  const applyCardFee = method === 'CARD' && Boolean(hasCardFee);
  const cardFeePercent = applyCardFee ? 3 : 0;
  const cardFee = applyCardFee ? Math.round(afterBillDiscount * 0.03) : 0;
  const totalAmount = afterBillDiscount + cardFee;

  return {
    cleanPhone,
    existingCustomer,
    finalCustomerName,
    orderItems,
    productUpdates,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    cleanBillDiscType: (cleanBillDiscValue > 0 ? cleanBillDiscType : 'NONE') as DiscountType,
    cleanBillDiscValue,
    billDiscountAmount,
    method,
    cleanPaymentDetail,
    applyCardFee,
    cardFeePercent,
    cardFee,
    totalAmount,
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

  for (const { product, qty, isGift } of prepared.productUpdates) {
    const currentProd = (await productRepo.findById(product._id)) || product;
    const beforeFloors = getFloorStocks(currentProd);
    const balanceBefore = beforeFloors.stock;
    const nextFloors = deductStockForSale(currentProd, qty);
    const balanceAfter = nextFloors.stock;

    await productRepo.updateById(product._id, nextFloors);

    await stockMovementRepo.create({
      type: 'SALE',
      productId: product._id,
      productCode: product.code,
      productName: product.name,
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
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
      note: prepared.cleanNote,
      status: isDraft ? 'DRAFT' : 'PAID',
      createdBy: req.user?.userId || 'SALES',
      createdByName: req.user?.fullName || 'Nhân viên bán hàng',
      confirmedBy: isDraft ? '' : req.user?.userId || 'SALES',
      confirmedByName: isDraft ? '' : req.user?.fullName || 'Nhân viên bán hàng',
      confirmedAt: isDraft ? null : new Date(),
    });

    // Nếu không phải bản nháp (PAID): trừ tồn kho Kho Tầng 1, ghi StockMovement loại SALE và cập nhật Customer
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

// PUT /api/v1/orders/:id — Cập nhật hóa đơn nháp (hoặc truyền status='PAID' để chốt thanh toán)
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
      hasCardFee: req.body?.hasCardFee ?? existingOrder.hasCardFee,
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
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
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

// POST /api/v1/orders/:id/confirm — Xác nhận thanh toán cho hóa đơn nháp (DRAFT -> PAID) & trừ kho Tầng 1
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
      hasCardFee: req.body?.hasCardFee ?? existingOrder.hasCardFee,
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
      hasCardFee: prepared.applyCardFee,
      cardFeePercent: prepared.cardFeePercent,
      cardFee: prepared.cardFee,
      totalAmount: prepared.totalAmount,
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

// DELETE /api/v1/orders/:id — Xóa hóa đơn nháp (DRAFT)
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

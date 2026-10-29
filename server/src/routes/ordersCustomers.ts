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

export const ordersCustomersRouter = Router();

// GET /api/v1/customers/lookup?phone=...
ordersCustomersRouter.get('/customers/lookup', async (req, res, next) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!phone) {
      throw new ApiError(400, 'PHONE_REQUIRED', 'Vui lòng nhập số điện thoại để tra cứu', {
        phone: 'Bắt buộc',
      });
    }

    const customer = await customerRepo.findOne({ phone });
    const orders = await orderRepo.find({ customerPhone: phone }, { createdAt: -1 });
    const returns = await returnExchangeRepo.find({ customerPhone: phone }, { createdAt: -1 });

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

    const filtered = allCustomers.filter((c) => {
      if (!search) return true;
      const q = String(search).toLowerCase();
      return c.phone.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });

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

    const filtered = allOrders.filter((o) => {
      if (phone && o.customerPhone !== String(phone).trim()) return false;
      if (status && o.status !== String(status).toUpperCase()) return false;
      if (paymentMethod && o.paymentMethod !== String(paymentMethod).toUpperCase()) return false;
      if (search) {
        const q = String(search).toLowerCase();
        const match =
          o.orderCode.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q) ||
          o.items.some(
            (i) =>
              i.productCode.toLowerCase().includes(q) ||
              i.productName.toLowerCase().includes(q)
          );
        if (!match) return false;
      }
      return true;
    });

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

// POST /api/v1/orders
ordersCustomersRouter.post('/orders', async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      paymentMethod,
      hasCardFee,
      billDiscountType,
      billDiscountValue,
      note,
      items,
    } = req.body || {};

    const cleanPhone = String(customerPhone || '').trim();
    if (!cleanPhone) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Số điện thoại khách hàng là bắt buộc', {
        customerPhone: 'Bắt buộc',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'EMPTY_ORDER_ITEMS', 'Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    const existingCustomer = await customerRepo.findOne({ phone: cleanPhone });
    const finalCustomerName = String(customerName || existingCustomer?.name || '').trim();
    if (!finalCustomerName) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tên khách hàng mới', {
        customerName: 'Bắt buộc đối với khách mới',
      });
    }

    const validPaymentMethods: PaymentMethod[] = ['CASH', 'BANKING', 'CARD'];
    const method: PaymentMethod = validPaymentMethods.includes(paymentMethod)
      ? paymentMethod
      : 'CASH';

    // Kiểm tra từng sản phẩm: tồn tại, sellingPrice > 0, tổng số lượng theo SP <= stockFloor1 (Kho Tầng 1)
    const orderItems: IOrderItem[] = [];
    const productUpdates: { product: any; qty: number }[] = [];
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

      // BR-04: Chặn bán sản phẩm có sellingPrice <= 0
      if (!product.sellingPrice || product.sellingPrice <= 0) {
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

      // Chỉ được bán số lượng ở Kho Tầng 1, tuyệt đối không được bán vượt Kho Tầng 1
      const floors = getFloorStocks(product);
      if (floors.stockFloor1 < totalRequestedForProduct) {
        throw new ApiError(
          400,
          'INSUFFICIENT_STOCK',
          `Sản phẩm "${product.name}" không đủ tồn tại Kho Tầng 1 (Tồn Kho Tầng 1: ${floors.stockFloor1}, Yêu cầu: ${totalRequestedForProduct})`,
          { productId: String(product._id), stockFloor1: String(floors.stockFloor1) }
        );
      }

      const originalUnitPrice = Math.round(Number(product.sellingPrice) || 0);
      const rawItemDiscType = String(rawItem.discountType || 'NONE').toUpperCase();
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
        discountType: itemDiscValue > 0 ? itemDiscType : 'NONE',
        discountValue: itemDiscValue,
        discountAmount: itemDiscountAmount,
        unitPrice,
        quantity: qty,
        returnedQuantity: 0,
        lineTotal,
      });

      productUpdates.push({ product, qty });
    }

    // Tính tiền hàng, giảm giá sản phẩm, giảm giá Bill & Phí quẹt thẻ 3%
    const rawSubtotal = orderItems.reduce(
      (sum, i) => sum + (Number(i.originalUnitPrice ?? i.unitPrice) || 0) * i.quantity,
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

    // Tạo hoặc cập nhật hồ sơ khách hàng
    let customer = existingCustomer;
    if (!customer) {
      customer = await customerRepo.create({
        phone: cleanPhone,
        name: finalCustomerName,
        totalOrders: 1,
        totalSpent: totalAmount,
        lastOrderAt: new Date(),
      });
    } else {
      customer = await customerRepo.updateById(customer._id, {
        name: finalCustomerName,
        totalOrders: (customer.totalOrders || 0) + 1,
        totalSpent: (customer.totalSpent || 0) + totalAmount,
        lastOrderAt: new Date(),
      });
    }

    const orderCount = await orderRepo.countDocuments({});
    const orderCode = `HD-${String(orderCount + 1).padStart(4, '0')}`;

    const createdOrder = await orderRepo.create({
      orderCode,
      customerId: customer!._id,
      customerName: finalCustomerName,
      customerPhone: cleanPhone,
      items: orderItems,
      rawSubtotal,
      itemDiscountTotal,
      subtotal,
      billDiscountType: cleanBillDiscValue > 0 ? cleanBillDiscType : 'NONE',
      billDiscountValue: cleanBillDiscValue,
      billDiscountAmount,
      paymentMethod: method,
      hasCardFee: applyCardFee,
      cardFeePercent,
      cardFee,
      totalAmount,
      note: note && String(note).trim() ? String(note).trim() : 'Giá đã bao gồm thuế',
      status: 'PAID',
      createdBy: req.user?.userId || 'SALES',
      createdByName: req.user?.fullName || 'Nhân viên bán hàng',
    });

    // Trừ tồn kho Kho Tầng 1 và ghi StockMovement loại SALE (warehouseLocation: FLOOR_1)
    for (const { product, qty } of productUpdates) {
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
        referenceId: createdOrder._id,
        referenceCode: createdOrder.orderCode,
        performedBy: req.user?.userId || 'SALES',
        performedByName: req.user?.fullName || 'Nhân viên bán hàng',
        note: `Bán hàng đơn ${createdOrder.orderCode} (Kho Tầng 1)`,
      });
    }

    res.status(201).json({
      data: createdOrder,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import {
  customerRepo,
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { IOrderItem, PaymentMethod } from '../models/Order';

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

    // Kiểm tra từng sản phẩm: tồn tại, sellingPrice > 0, stock >= quantity
    const orderItems: IOrderItem[] = [];
    const productUpdates: { product: any; qty: number }[] = [];

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

      // BR-04: Chặn bán vượt tồn kho
      if (product.stock < qty) {
        throw new ApiError(
          400,
          'INSUFFICIENT_STOCK',
          `Sản phẩm "${product.name}" không đủ tồn kho (Tồn: ${product.stock}, Yêu cầu: ${qty})`,
          { productId: product._id }
        );
      }

      const lineTotal = product.sellingPrice * qty;
      orderItems.push({
        productId: product._id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        unitPrice: product.sellingPrice,
        quantity: qty,
        returnedQuantity: 0,
        lineTotal,
      });

      productUpdates.push({ product, qty });
    }

    // BR-12: Tính tiền & Phí quẹt thẻ 3%
    const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const applyCardFee = method === 'CARD' && Boolean(hasCardFee);
    const cardFeePercent = applyCardFee ? 3 : 0;
    const cardFee = applyCardFee ? Math.round(subtotal * 0.03) : 0;
    const totalAmount = subtotal + cardFee;

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
      subtotal,
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

    // Trừ tồn kho và ghi StockMovement loại SALE
    for (const { product, qty } of productUpdates) {
      const currentProd = await productRepo.findById(product._id);
      const balanceBefore = currentProd ? currentProd.stock : product.stock;
      const balanceAfter = balanceBefore - qty;

      await productRepo.updateById(product._id, { stock: balanceAfter });

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
        referenceType: 'ORDER',
        referenceId: createdOrder._id,
        referenceCode: createdOrder.orderCode,
        performedBy: req.user?.userId || 'SALES',
        performedByName: req.user?.fullName || 'Nhân viên bán hàng',
        note: `Bán hàng đơn ${createdOrder.orderCode}`,
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

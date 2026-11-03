import { Router } from 'express';
import {
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { IReturnItem, IExchangeItem, ReturnCondition } from '../models/ReturnExchange';
import { PaymentMethod } from '../models/Order';
import {
  applyFloorDelta,
  deductStockForSale,
  getFloorStocks,
  getVariantFloorStocks,
  formatProductWithVariant,
} from '../utils/warehouseFloor';
import { buildVariantKey } from '../utils/productCode';
import { filterAndRankBySearch } from '../utils/search';

export const returnsRouter = Router();

async function prepareReturnExchangeCalculation(body: any) {
  const { orderId, orderCode, returnItems = [], exchangeItems = [] } = body || {};

  const lookupKey = String(orderId || orderCode || '').trim();
  if (!lookupKey) {
    throw new ApiError(400, 'ORDER_ID_REQUIRED', 'Vui lòng cung cấp mã đơn hàng gốc (orderId hoặc orderCode)');
  }

  const order =
    (await orderRepo.findById(lookupKey)) ||
    (await orderRepo.findOne({ orderCode: lookupKey.toUpperCase() }));

  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng gốc cần trả/đổi');
  }
  if (order.status === 'DRAFT') {
    throw new ApiError(400, 'ORDER_IS_DRAFT', 'Hóa đơn đang ở trạng thái Bản nháp (chưa thanh toán), không thể thực hiện trả/đổi hàng');
  }

  if (!Array.isArray(returnItems) || returnItems.length === 0) {
    throw new ApiError(400, 'EMPTY_RETURN_ITEMS', 'Phải chọn ít nhất 1 sản phẩm trả lại');
  }

  const preparedReturnItems: IReturnItem[] = [];
  const cumulativeReturnByLineKey = new Map<string, number>();
  for (const rItem of returnItems) {
    const qty = Math.round(Number(rItem.quantity));
    if (!rItem.productId || isNaN(qty) || qty <= 0) {
      throw new ApiError(400, 'INVALID_RETURN_QUANTITY', 'Số lượng trả phải lớn hơn 0');
    }

    const rColor = rItem.color ? String(rItem.color).trim() : '';
    const rSize = rItem.size ? String(rItem.size).trim().toUpperCase() : '';

    // Tìm dòng khớp theo productId + (color, size) nếu có, hoặc fallback theo productId
    const originalLine =
      order.items.find(
        (i) =>
          (String(i.productId) === String(rItem.productId) ||
            i.productCode === String(rItem.productId).toUpperCase()) &&
          buildVariantKey(i.color, i.size) === buildVariantKey(rColor, rSize)
      ) ||
      order.items.find(
        (i) =>
          String(i.productId) === String(rItem.productId) ||
          i.productCode === String(rItem.productId).toUpperCase()
      );

    if (!originalLine) {
      throw new ApiError(
        400,
        'ITEM_NOT_IN_ORDER',
        `Sản phẩm "${rItem.productId}" không thuộc đơn hàng gốc ${order.orderCode}`
      );
    }

    const lineKey = `${String(originalLine.productId)}__${buildVariantKey(originalLine.color, originalLine.size)}`;
    const totalReturning = (cumulativeReturnByLineKey.get(lineKey) || 0) + qty;
    cumulativeReturnByLineKey.set(lineKey, totalReturning);

    const maxReturnable = originalLine.quantity - (originalLine.returnedQuantity || 0);
    if (totalReturning > maxReturnable) {
      throw new ApiError(
        400,
        'EXCEED_RETURNABLE_QUANTITY',
        `Số lượng trả của "${originalLine.productName}" (${totalReturning}) vượt quá số lượng có thể trả (${maxReturnable})`,
        { productId: originalLine.productId }
      );
    }

    const condition: ReturnCondition =
      rItem.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';

    preparedReturnItems.push({
      productId: originalLine.productId,
      productCode: originalLine.productCode,
      productName: originalLine.productName,
      color: originalLine.color || rColor,
      size: originalLine.size || rSize,
      unit: originalLine.unit,
      unitPrice: originalLine.unitPrice,
      quantity: qty,
      condition,
      restocked: condition === 'GOOD',
      lineTotal: originalLine.unitPrice * qty,
    });
  }

  const preparedExchangeItems: IExchangeItem[] = [];
  const cumulativeExchangeByProdId = new Map<string, number>();
  const cumulativeExchangeByVariant = new Map<string, number>();

  if (Array.isArray(exchangeItems) && exchangeItems.length > 0) {
    for (const eItem of exchangeItems) {
      const qty = Math.round(Number(eItem.quantity));
      if (!eItem.productId || isNaN(qty) || qty <= 0) {
        throw new ApiError(400, 'INVALID_EXCHANGE_QUANTITY', 'Số lượng sản phẩm đổi mới phải lớn hơn 0');
      }

      const product =
        (await productRepo.findById(String(eItem.productId))) ||
        (await productRepo.findOne({ code: String(eItem.productId).toUpperCase() }));

      if (!product) {
        throw new ApiError(404, 'EXCHANGE_PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm đổi mới: ${eItem.productId}`);
      }

      if (!product.sellingPrice || product.sellingPrice <= 0) {
        throw new ApiError(
          400,
          'EXCHANGE_PRODUCT_PRICE_ZERO',
          `Sản phẩm đổi mới "${product.name}" chưa có giá bán hợp lệ`
        );
      }

      const eColor = eItem.color ? String(eItem.color).trim() : '';
      const eSize = eItem.size ? String(eItem.size).trim().toUpperCase() : '';
      const displayExName = formatProductWithVariant(product.name, eColor, eSize);

      const exKey = String(product._id);
      const totalExchanging = (cumulativeExchangeByProdId.get(exKey) || 0) + qty;
      cumulativeExchangeByProdId.set(exKey, totalExchanging);

      const exVariantKey = `${exKey}__${buildVariantKey(eColor, eSize)}`;
      const totalExchangingVariant = (cumulativeExchangeByVariant.get(exVariantKey) || 0) + qty;
      cumulativeExchangeByVariant.set(exVariantKey, totalExchangingVariant);

      const exFloors = getFloorStocks(product);
      if (exFloors.stockFloor1 < totalExchanging) {
        throw new ApiError(
          400,
          'INSUFFICIENT_EXCHANGE_STOCK',
          `Sản phẩm đổi mới "${product.name}" không đủ tồn tại Kho Tầng 1 (Tồn Tầng 1: ${exFloors.stockFloor1}, Cần: ${totalExchanging})`
        );
      }

      if ((eColor || eSize) && exFloors.variants.length > 0) {
        const vFloors = getVariantFloorStocks(product, eColor, eSize);
        if (vFloors.stockFloor1 < totalExchangingVariant) {
          throw new ApiError(
            400,
            'INSUFFICIENT_EXCHANGE_STOCK',
            `Sản phẩm đổi mới "${displayExName}" không đủ tồn tại Kho Tầng 1 (Tồn Tầng 1: ${vFloors.stockFloor1}, Cần: ${totalExchangingVariant})`
          );
        }
      }

      preparedExchangeItems.push({
        productId: product._id,
        productCode: product.code,
        productName: displayExName,
        color: eColor,
        size: eSize,
        unit: product.unit,
        unitPrice: product.sellingPrice,
        quantity: qty,
        lineTotal: product.sellingPrice * qty,
      });
    }
  }

  const returnTotal = preparedReturnItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const exchangeTotal = preparedExchangeItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const netDifference = exchangeTotal - returnTotal;
  const refundAmount = netDifference < 0 ? Math.abs(netDifference) : 0;
  const additionalCharge = netDifference > 0 ? netDifference : 0;

  return {
    order,
    preparedReturnItems,
    preparedExchangeItems,
    returnTotal,
    exchangeTotal,
    netDifference,
    refundAmount,
    additionalCharge,
  };
}

// GET /api/v1/returns
returnsRouter.get('/returns', async (req, res, next) => {
  try {
    const { orderId, type, search } = req.query;
    const allReturns = await returnExchangeRepo.find({}, { createdAt: -1 });

    const baseFiltered = allReturns.filter((r) => {
      if (orderId && String(r.orderId) !== String(orderId) && r.orderCode !== String(orderId)) {
        return false;
      }
      if (type && r.type !== String(type).toUpperCase()) return false;
      return true;
    });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (r) => [
          { text: r.code, weight: 1.6 },
          { text: r.orderCode, weight: 1.5 },
          { text: r.customerPhone, weight: 1.5 },
          { text: r.customerName, weight: 1.3 },
          { text: r.performedByName, weight: 0.9 },
          { text: r.note, weight: 0.8 },
          ...(r.returnItems || []).flatMap((i) => [
            { text: i.productCode, weight: 1.2 },
            { text: i.productName, weight: 1.1 },
          ]),
          ...(r.exchangeItems || []).flatMap((i) => [
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

// POST /api/v1/returns/calculate
returnsRouter.post('/returns/calculate', async (req, res, next) => {
  try {
    const calc = await prepareReturnExchangeCalculation(req.body);
    res.json({
      data: {
        orderId: calc.order._id,
        orderCode: calc.order.orderCode,
        returnItems: calc.preparedReturnItems,
        exchangeItems: calc.preparedExchangeItems,
        returnTotal: calc.returnTotal,
        exchangeTotal: calc.exchangeTotal,
        netDifference: calc.netDifference,
        refundAmount: calc.refundAmount,
        additionalCharge: calc.additionalCharge,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/returns
returnsRouter.post('/returns', async (req, res, next) => {
  try {
    const calc = await prepareReturnExchangeCalculation(req.body);
    const {
      order,
      preparedReturnItems,
      preparedExchangeItems,
      returnTotal,
      exchangeTotal,
      netDifference,
      refundAmount,
      additionalCharge,
    } = calc;

    const isExchange =
      req.body?.type === 'EXCHANGE' || preparedExchangeItems.length > 0;
    const recordType = isExchange ? 'EXCHANGE' : 'RETURN';

    const validMethods: PaymentMethod[] = ['CASH', 'BANKING', 'CARD', 'OTHER'];
    const refundMethod: PaymentMethod = validMethods.includes(req.body?.refundMethod)
      ? req.body.refundMethod
      : 'CASH';

    const count = await returnExchangeRepo.countDocuments({});
    const code = `${isExchange ? 'DH' : 'TH'}-${String(count + 1).padStart(4, '0')}`;

    const createdRecord = await returnExchangeRepo.create({
      code,
      orderId: order._id,
      orderCode: order.orderCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      type: recordType,
      returnItems: preparedReturnItems,
      exchangeItems: preparedExchangeItems,
      returnTotal,
      exchangeTotal,
      netDifference,
      refundAmount,
      additionalCharge,
      refundMethod,
      note: req.body?.note ? String(req.body.note).trim() : '',
      performedBy: req.user?.userId || 'SALES',
      performedByName: req.user?.fullName || 'Nhân viên bán hàng',
    });

    // 1. Xử lý tồn kho cho hàng trả về: chỉ cộng lại vào kho khi condition === 'GOOD' (BR-15)
    for (const rItem of preparedReturnItems) {
      if (rItem.condition === 'GOOD') {
        const product = await productRepo.findById(rItem.productId);
        if (product) {
          const beforeFloors = getFloorStocks(product);
          const balanceBefore = beforeFloors.stock;
          const nextFloors = applyFloorDelta(
            product,
            'FLOOR_1',
            rItem.quantity,
            rItem.color,
            rItem.size
          );
          const balanceAfter = nextFloors.stock;
          await productRepo.updateById(product._id, {
            variants: nextFloors.variants,
            stockFloor1: nextFloors.stockFloor1,
            stockFloor2: nextFloors.stockFloor2,
            stock: nextFloors.stock,
          });

          await stockMovementRepo.create({
            type: isExchange ? 'EXCHANGE_IN' : 'RETURN',
            productId: product._id,
            productCode: product.code,
            productName: formatProductWithVariant(product.name, rItem.color, rItem.size),
            color: rItem.color || '',
            size: rItem.size || '',
            categoryId: product.categoryId,
            unit: product.unit,
            quantityChange: rItem.quantity,
            balanceBefore,
            balanceAfter,
            warehouseLocation: 'FLOOR_1',
            referenceType: 'RETURN_EXCHANGE',
            referenceId: createdRecord._id,
            referenceCode: createdRecord.code,
            performedBy: req.user?.userId || 'SALES',
            performedByName: req.user?.fullName || 'Nhân viên bán hàng',
            note: `Nhận lại hàng (${rItem.condition}) từ đơn ${order.orderCode}`,
          });
        }
      }
    }

    // 2. Xử lý tồn kho cho hàng đổi mới: trừ tồn kho & ghi StockMovement loại EXCHANGE_OUT
    for (const eItem of preparedExchangeItems) {
      const product = await productRepo.findById(eItem.productId);
      if (product) {
        const beforeFloors = getFloorStocks(product);
        const balanceBefore = beforeFloors.stock;
        const nextFloors = deductStockForSale(product, eItem.quantity, eItem.color, eItem.size);
        const balanceAfter = nextFloors.stock;
        await productRepo.updateById(product._id, {
          variants: nextFloors.variants,
          stockFloor1: nextFloors.stockFloor1,
          stockFloor2: nextFloors.stockFloor2,
          stock: nextFloors.stock,
        });

        await stockMovementRepo.create({
          type: 'EXCHANGE_OUT',
          productId: product._id,
          productCode: product.code,
          productName: formatProductWithVariant(product.name, eItem.color, eItem.size),
          color: eItem.color || '',
          size: eItem.size || '',
          categoryId: product.categoryId,
          unit: product.unit,
          quantityChange: -eItem.quantity,
          balanceBefore,
          balanceAfter,
          referenceType: 'RETURN_EXCHANGE',
          referenceId: createdRecord._id,
          referenceCode: createdRecord.code,
          performedBy: req.user?.userId || 'SALES',
          performedByName: req.user?.fullName || 'Nhân viên bán hàng',
          note: `Xuất hàng đổi mới cho đơn ${order.orderCode}`,
        });
      }
    }

    // 3. Cập nhật returnedQuantity và trạng thái đơn gốc
    const updatedOrderItems = order.items.map((item) => {
      const returnedInThisTx = preparedReturnItems
        .filter(
          (r) =>
            String(r.productId) === String(item.productId) &&
            buildVariantKey(r.color, r.size) === buildVariantKey(item.color, item.size)
        )
        .reduce((sum, r) => sum + r.quantity, 0);
      return {
        ...item,
        returnedQuantity: (item.returnedQuantity || 0) + returnedInThisTx,
      };
    });

    const allFullyReturned = updatedOrderItems.every(
      (i) => i.returnedQuantity >= i.quantity
    );
    const newOrderStatus = allFullyReturned
      ? 'FULLY_RETURNED'
      : 'PARTIALLY_RETURNED';

    const updatedOrder = await orderRepo.updateById(order._id, {
      items: updatedOrderItems,
      status: newOrderStatus,
    });

    res.status(201).json({
      data: {
        returnExchange: createdRecord,
        order: updatedOrder,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

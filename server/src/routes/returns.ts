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
import { executeUnpackSetToRetail } from '../utils/unpackSet';
import { buildVariantKey } from '../utils/productCode';
import { filterAndRankBySearch } from '../utils/search';

export const returnsRouter = Router();

async function generateNextReturnExchangeCode(isExchange: boolean): Promise<string> {
  const all = await returnExchangeRepo.find({});
  let maxNum = all.length;
  for (const r of all) {
    const m = /^(?:TH|DH)-(\d+)$/i.exec(String(r.code || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `${isExchange ? 'DH' : 'TH'}-${String(maxNum + 1).padStart(4, '0')}`;
}

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

  const maxReturnableByIdx = order.items.map((it) =>
    Math.max(0, Number(it.quantity || 0) - Number(it.returnedQuantity || 0))
  );
  const allocatedByIdx = new Map<number, number>();
  const getRemainingForIdx = (idx: number) =>
    Math.max(0, (maxReturnableByIdx[idx] || 0) - (allocatedByIdx.get(idx) || 0));

  const preparedReturnItems: IReturnItem[] = [];
  for (const rItem of returnItems) {
    const qty = Math.round(Number(rItem.quantity));
    if (!rItem.productId || isNaN(qty) || qty <= 0) {
      throw new ApiError(400, 'INVALID_RETURN_QUANTITY', 'Số lượng trả phải lớn hơn 0');
    }

    const rColor = rItem.color ? String(rItem.color).trim() : '';
    const rSize = rItem.size ? String(rItem.size).trim().toUpperCase() : '';
    const hasExplicitVariant = Boolean(rColor || rSize);
    const rVariantKey = buildVariantKey(rColor, rSize);

    const matchingProdEntries = order.items
      .map((item, idx) => ({ item, idx }))
      .filter(
        ({ item }) =>
          String(item.productId) === String(rItem.productId) ||
          item.productCode === String(rItem.productId).toUpperCase()
      );

    if (matchingProdEntries.length === 0) {
      throw new ApiError(
        400,
        'ITEM_NOT_IN_ORDER',
        `Sản phẩm "${rItem.productId}" không thuộc đơn hàng gốc ${order.orderCode}`
      );
    }

    const condition: ReturnCondition =
      rItem.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';

    const rawLineIndex =
      rItem.lineIndex !== undefined && rItem.lineIndex !== null && rItem.lineIndex !== ''
        ? Number(rItem.lineIndex)
        : NaN;
    const explicitEntry = Number.isInteger(rawLineIndex)
      ? matchingProdEntries.find(({ idx, item }) => {
          if (idx !== rawLineIndex) return false;
          if (!hasExplicitVariant) return true;
          return buildVariantKey(item.color, item.size) === rVariantKey;
        })
      : undefined;

    let candidateEntries = matchingProdEntries;
    if (explicitEntry) {
      candidateEntries = [explicitEntry];
    } else if (hasExplicitVariant) {
      const exactVariantEntries = matchingProdEntries.filter(
        ({ item }) => buildVariantKey(item.color, item.size) === rVariantKey
      );
      if (exactVariantEntries.length > 0) {
        candidateEntries = exactVariantEntries;
      } else {
        const onlyDefaultInOrder = matchingProdEntries.every(
          ({ item }) => buildVariantKey(item.color, item.size) === 'DEFAULT'
        );
        if (!onlyDefaultInOrder) {
          throw new ApiError(
            400,
            'ITEM_NOT_IN_ORDER',
            `Phân loại "${[rColor, rSize].filter(Boolean).join(' - ')}" của sản phẩm "${rItem.productId}" không thuộc đơn hàng gốc ${order.orderCode}`
          );
        }
      }
    } else {
      // Client không truyền color/size: ưu tiên dòng không phân loại (DEFAULT) nếu đủ số lượng,
      // nếu không có hoặc không đủ thì tự động phân bổ sang các dòng biến thể cùng productId còn hạn mức trả.
      const defaultVariantEntries = matchingProdEntries.filter(
        ({ item }) => buildVariantKey(item.color, item.size) === 'DEFAULT'
      );
      const defaultRemaining = defaultVariantEntries.reduce(
        (sum, { idx }) => sum + getRemainingForIdx(idx),
        0
      );
      if (defaultVariantEntries.length > 0 && defaultRemaining >= qty) {
        candidateEntries = defaultVariantEntries;
      }
    }

    const totalCandidateMax = candidateEntries.reduce(
      (sum, { idx }) => sum + (maxReturnableByIdx[idx] || 0),
      0
    );
    const totalCandidateAlreadyAllocated = candidateEntries.reduce(
      (sum, { idx }) => sum + (allocatedByIdx.get(idx) || 0),
      0
    );
    const totalCandidateRemaining = Math.max(0, totalCandidateMax - totalCandidateAlreadyAllocated);

    if (qty > totalCandidateRemaining) {
      const refLine = candidateEntries[0].item;
      throw new ApiError(
        400,
        'EXCEED_RETURNABLE_QUANTITY',
        `Số lượng trả của "${refLine.productName}" (${totalCandidateAlreadyAllocated + qty}) vượt quá số lượng có thể trả (${totalCandidateMax})`,
        { productId: refLine.productId }
      );
    }

    let leftToAllocate = qty;
    for (const { item: originalLine, idx } of candidateEntries) {
      if (leftToAllocate <= 0) break;
      const avail = getRemainingForIdx(idx);
      if (avail <= 0) continue;
      const take = Math.min(avail, leftToAllocate);
      allocatedByIdx.set(idx, (allocatedByIdx.get(idx) || 0) + take);
      leftToAllocate -= take;

      preparedReturnItems.push({
        productId: originalLine.productId,
        productCode: originalLine.productCode,
        productName: originalLine.productName,
        color: originalLine.color || rColor,
        size: originalLine.size || rSize,
        unit: originalLine.unit,
        unitPrice: originalLine.unitPrice,
        quantity: take,
        condition,
        restocked: condition === 'GOOD',
        lineTotal: originalLine.unitPrice * take,
      });
    }
  }

  // Bảng cộng dồn hàng trả về còn bán được (GOOD) theo sản phẩm & biến thể — lượng này sẽ được cộng vào Kho Tầng 1 trước khi xuất đổi
  const restockedByProdId = new Map<string, number>();
  const restockedByVariant = new Map<string, number>();
  for (const rItem of preparedReturnItems) {
    if (rItem.condition === 'GOOD') {
      const rProdKey = String(rItem.productId);
      restockedByProdId.set(rProdKey, (restockedByProdId.get(rProdKey) || 0) + rItem.quantity);
      const rVarKey = `${rProdKey}__${buildVariantKey(rItem.color, rItem.size)}`;
      restockedByVariant.set(rVarKey, (restockedByVariant.get(rVarKey) || 0) + rItem.quantity);
    }
  }

  if (
    String(body?.type || '').toUpperCase() === 'EXCHANGE' &&
    (!Array.isArray(exchangeItems) || exchangeItems.length === 0)
  ) {
    throw new ApiError(
      400,
      'EMPTY_EXCHANGE_ITEMS',
      'Bạn đang chọn chế độ ĐỔI HÀNG. Vui lòng chọn ít nhất 1 sản phẩm mới muốn đổi sang'
    );
  }

  const preparedExchangeItems: IExchangeItem[] = [];
  const exchangeProductUpdates: { product: any; qty: number; color: string; size: string }[] = [];
  const cumulativeExchangeByProdId = new Map<string, number>();
  const cumulativeExchangeByVariant = new Map<string, number>();
  const autoUnpackPlans: {
    retailProduct: any;
    parentProduct: any;
    setsToUnpack: number;
    color: string;
    size: string;
  }[] = [];

  if (Array.isArray(exchangeItems) && exchangeItems.length > 0) {
    let cachedAllProducts: any[] | null = null;

    for (const eItem of exchangeItems) {
      const qty = Math.round(Number(eItem.quantity));
      if (!eItem.productId || isNaN(qty) || qty <= 0) {
        throw new ApiError(400, 'INVALID_EXCHANGE_QUANTITY', 'Số lượng sản phẩm đổi mới phải lớn hơn 0');
      }

      const rawLookup = String(eItem.productId).trim();
      const upperLookup = rawLookup.toUpperCase();
      let product =
        (await productRepo.findById(rawLookup)) ||
        (await productRepo.findOne({ code: upperLookup }));
      let matchedChildVariant: { color: string; size: string } | null = null;

      // Cho phép tra cứu sản phẩm đổi theo cả barcode hoặc mã biến thể con (variantCode)
      if (!product) {
        if (!cachedAllProducts) {
          cachedAllProducts = await productRepo.find({});
        }
        for (const p of cachedAllProducts) {
          if (String(p.barcode || '').trim().toUpperCase() === upperLookup) {
            product = p;
            break;
          }
          const pFloors = getFloorStocks(p);
          const childVar = pFloors.variants.find(
            (v) =>
              String(v.variantCode || '').trim().toUpperCase() === upperLookup ||
              String(v.barcode || '').trim().toUpperCase() === upperLookup
          );
          if (childVar) {
            product = p;
            matchedChildVariant = { color: childVar.color || '', size: childVar.size || '' };
            break;
          }
        }
      }

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

      const exKey = String(product._id);
      const exFloors = getFloorStocks(product);
      const rawColor = eItem.color
        ? String(eItem.color).trim()
        : matchedChildVariant?.color || '';
      const rawSize = eItem.size
        ? String(eItem.size).trim()
        : matchedChildVariant?.size || '';

      let eColor = rawColor;
      let eSize = rawSize;

      if (exFloors.variants.length > 0) {
        if (rawColor || rawSize) {
          const targetVarKey = buildVariantKey(rawColor, rawSize);
          const matchedVar = exFloors.variants.find((v) => v.variantKey === targetVarKey);
          if (matchedVar) {
            eColor = String(matchedVar.color || '').trim();
            eSize = String(matchedVar.size || '').trim();
          } else if (
            exFloors.variants.length === 1 &&
            exFloors.variants[0].variantKey === 'DEFAULT'
          ) {
            eColor = '';
            eSize = '';
          } else {
            throw new ApiError(
              400,
              'EXCHANGE_VARIANT_NOT_FOUND',
              `Phân loại "${[rawColor, rawSize].filter(Boolean).join(' - ')}" của sản phẩm đổi mới "${product.name}" không tồn tại trong kho`
            );
          }
        } else {
          // Client không truyền color/size cho sản phẩm có biến thể
          const availVariants = exFloors.variants.filter((v) => {
            const vRestocked = restockedByVariant.get(`${exKey}__${v.variantKey}`) || 0;
            return v.stockFloor1 + vRestocked > 0;
          });
          if (exFloors.variants.length === 1) {
            eColor = String(exFloors.variants[0].color || '').trim();
            eSize = String(exFloors.variants[0].size || '').trim();
          } else if (availVariants.length === 1) {
            eColor = String(availVariants[0].color || '').trim();
            eSize = String(availVariants[0].size || '').trim();
          } else if (availVariants.length > 1) {
            throw new ApiError(
              400,
              'EXCHANGE_VARIANT_REQUIRED',
              `Sản phẩm đổi mới "${product.name}" có nhiều phân loại Màu sắc / Size đang còn hàng. Vui lòng chọn cụ thể phân loại muốn đổi!`
            );
          } else {
            eColor = String(exFloors.variants[0].color || '').trim();
            eSize = String(exFloors.variants[0].size || '').trim();
          }
        }
      }

      const displayExName = formatProductWithVariant(product.name, eColor, eSize);

      const totalExchanging = (cumulativeExchangeByProdId.get(exKey) || 0) + qty;
      cumulativeExchangeByProdId.set(exKey, totalExchanging);

      const exVariantKey = `${exKey}__${buildVariantKey(eColor, eSize)}`;
      const totalExchangingVariant = (cumulativeExchangeByVariant.get(exVariantKey) || 0) + qty;
      cumulativeExchangeByVariant.set(exVariantKey, totalExchangingVariant);

      exchangeProductUpdates.push({
        product,
        qty,
        color: eColor,
        size: eSize,
      });

      preparedExchangeItems.push({
        productId: product._id,
        productCode: product.code,
        productName: displayExName,
        color: eColor,
        size: eSize,
        unit: product.unit || 'Cái',
        unitPrice: product.sellingPrice,
        quantity: qty,
        lineTotal: product.sellingPrice * qty,
      });
    }

    // Kiểm tra tồn Kho Tầng 1 (bao gồm hàng GOOD vừa nhận lại & hỗ trợ tự động tách Bộ -> Lẻ tại Tầng 1)
    const checkedKeys = new Set<string>();
    const plannedSetsBySetId = new Map<string, number>();

    for (const upd of exchangeProductUpdates) {
      const { product, color: eColor, size: eSize } = upd;
      const prodKey = String(product._id);
      const exFloors = getFloorStocks(product);
      const hasVariant = Boolean((eColor || eSize) && exFloors.variants.length > 0);
      const checkKey = hasVariant
        ? `${prodKey}__${buildVariantKey(eColor, eSize)}`
        : prodKey;

      if (checkedKeys.has(checkKey)) continue;
      checkedKeys.add(checkKey);

      const displayExName = formatProductWithVariant(product.name, eColor, eSize);
      const vStocks = hasVariant ? getVariantFloorStocks(product, eColor, eSize) : exFloors;
      const goodRestocked = hasVariant
        ? restockedByVariant.get(`${prodKey}__${buildVariantKey(eColor, eSize)}`) || 0
        : restockedByProdId.get(prodKey) || 0;
      const currentRetailFloor1 = vStocks.stockFloor1 + goodRestocked;
      const neededQty = hasVariant
        ? cumulativeExchangeByVariant.get(`${prodKey}__${buildVariantKey(eColor, eSize)}`) || 0
        : cumulativeExchangeByProdId.get(prodKey) || 0;

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
            parentFloors.variants.length > 0 && Boolean(eColor || eSize);
          const parentTargetStocks = parentHasVariants
            ? getVariantFloorStocks(parentProduct, eColor, eSize)
            : parentFloors;

          const parentGoodRestocked = parentHasVariants
            ? restockedByVariant.get(`${parentId}__${buildVariantKey(eColor, eSize)}`) || 0
            : restockedByProdId.get(parentId) || 0;
          const directSetExchanging = cumulativeExchangeByProdId.get(parentId) || 0;
          const alreadyPlannedSets = plannedSetsBySetId.get(parentId) || 0;
          const parentAvailFloor1 = Math.max(
            0,
            parentTargetStocks.stockFloor1 +
              parentGoodRestocked -
              directSetExchanging -
              alreadyPlannedSets
          );
          const parentAvailFloor2 = parentTargetStocks.stockFloor2;

          if (parentAvailFloor1 < setsNeeded) {
            if (parentAvailFloor2 >= setsNeeded) {
              throw new ApiError(
                400,
                'INSUFFICIENT_SET_FLOOR1_NEED_TRANSFER',
                `Sản phẩm lẻ "${displayExName}" không đủ tại Kho Tầng 1 (còn ${currentRetailFloor1} ${product.unit || 'Cái'}, cần ${neededQty}) và Sản phẩm bộ "${parentProduct.name}" (${parentProduct.code}) đang còn ${parentAvailFloor2} ${parentProduct.unit || 'Bộ'} ở Kho Tầng 2. Vui lòng chuyển tầng Sản phẩm bộ xuống Kho Tầng 1 trước khi đổi hàng!`,
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
              'INSUFFICIENT_EXCHANGE_STOCK',
              `Sản phẩm đổi mới "${displayExName}" không đủ tồn tại Kho Tầng 1 (Tồn lẻ Tầng 1: ${currentRetailFloor1}, Sản phẩm bộ "${parentProduct.name}" ở Tầng 1 còn: ${parentAvailFloor1} ${parentProduct.unit || 'Bộ'} = +${parentAvailFloor1 * packSize} ${product.unit || 'Cái'}, Cần: ${neededQty})`
            );
          }

          plannedSetsBySetId.set(parentId, alreadyPlannedSets + setsNeeded);
          autoUnpackPlans.push({
            retailProduct: product,
            parentProduct,
            setsToUnpack: setsNeeded,
            color: eColor,
            size: eSize,
          });
        } else {
          const floor2Hint =
            (vStocks.stockFloor2 || 0) >= neededQty - currentRetailFloor1
              ? ` (Kho Tầng 2 đang còn ${vStocks.stockFloor2} — vui lòng chuyển tầng xuống Kho Tầng 1 trước)`
              : '';
          throw new ApiError(
            400,
            'INSUFFICIENT_EXCHANGE_STOCK',
            `Sản phẩm đổi mới "${hasVariant ? displayExName : product.name}" không đủ tồn tại Kho Tầng 1 (Tồn Tầng 1: ${currentRetailFloor1}, Cần: ${neededQty})${floor2Hint}`
          );
        }
      }
    }
  }

  const returnSubtotal = preparedReturnItems.reduce((sum, i) => sum + i.lineTotal, 0);

  // Nếu đơn gốc thanh toán thẻ có thu phí (order.cardFee > 0), hoàn lại số phí thẻ tương ứng cho khách
  const orderCardFee = Math.max(0, Math.round(Number(order.cardFee) || 0));
  let refundedCardFee = 0;
  if (orderCardFee > 0 && returnSubtotal > 0) {
    const prevReturns = await returnExchangeRepo.find({ orderId: order._id });
    const alreadyRefundedCardFee = prevReturns.reduce(
      (sum, r) => sum + Math.max(0, Math.round(Number(r.refundedCardFee) || 0)),
      0
    );
    const remainingCardFee = Math.max(0, orderCardFee - alreadyRefundedCardFee);

    const allPaidLinesReturned = order.items.every(
      (item, idx) =>
        (Number(item.lineTotal) || 0) <= 0 ||
        (Number(item.returnedQuantity) || 0) + (allocatedByIdx.get(idx) || 0) >=
          Number(item.quantity || 0)
    );

    if (allPaidLinesReturned) {
      refundedCardFee = remainingCardFee;
    } else {
      const orderSubtotal = Math.max(0, Number(order.subtotal) || 0);
      refundedCardFee =
        orderSubtotal > 0
          ? Math.min(remainingCardFee, Math.round((returnSubtotal / orderSubtotal) * orderCardFee))
          : remainingCardFee;
    }
  }

  const returnTotal = returnSubtotal + refundedCardFee;
  const exchangeTotal = preparedExchangeItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const netDifference = exchangeTotal - returnTotal;
  const refundAmount = netDifference < 0 ? Math.abs(netDifference) : 0;
  const additionalCharge = netDifference > 0 ? netDifference : 0;

  return {
    order,
    allocatedByIdx,
    autoUnpackPlans,
    preparedReturnItems,
    preparedExchangeItems,
    returnSubtotal,
    refundedCardFee,
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
        returnSubtotal: calc.returnSubtotal,
        refundedCardFee: calc.refundedCardFee,
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
      returnSubtotal,
      refundedCardFee,
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

    const code = await generateNextReturnExchangeCode(isExchange);

    const createdRecord = await returnExchangeRepo.create({
      code,
      orderId: order._id,
      orderCode: order.orderCode,
      customerName: order.customerName || 'Khách lẻ',
      customerPhone: order.customerPhone || '',
      type: recordType,
      returnItems: preparedReturnItems,
      exchangeItems: preparedExchangeItems,
      returnSubtotal,
      refundedCardFee,
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
            categoryId: product.categoryId || '',
            unit: product.unit || 'Cái',
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

    // 1.5. Thực hiện tự động tách Bộ -> Lẻ tại Kho Tầng 1 trước khi xuất hàng đổi mới (nếu có)
    if (Array.isArray(calc.autoUnpackPlans) && calc.autoUnpackPlans.length > 0) {
      for (const plan of calc.autoUnpackPlans) {
        await executeUnpackSetToRetail({
          retailProductId: String(plan.retailProduct._id),
          setsToUnpack: plan.setsToUnpack,
          warehouse: 'FLOOR_1',
          color: plan.color,
          size: plan.size,
          reason: `Tự động tách bộ khi đổi hàng phiếu ${createdRecord.code} (đơn gốc ${order.orderCode})`,
          actorId: req.user?.userId || 'SALES',
          actorName: req.user?.fullName || 'Nhân viên bán hàng',
          actorRole: req.user?.role || 'SALES',
        });
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
          categoryId: product.categoryId || '',
          unit: product.unit || 'Cái',
          quantityChange: -eItem.quantity,
          balanceBefore,
          balanceAfter,
          warehouseLocation: 'FLOOR_1',
          referenceType: 'RETURN_EXCHANGE',
          referenceId: createdRecord._id,
          referenceCode: createdRecord.code,
          performedBy: req.user?.userId || 'SALES',
          performedByName: req.user?.fullName || 'Nhân viên bán hàng',
          note: `Xuất hàng đổi mới cho đơn ${order.orderCode}`,
        });
      }
    }

    // 3. Cập nhật returnedQuantity chính xác theo chỉ số dòng (lineIndex) và trạng thái đơn gốc
    const updatedOrderItems = order.items.map((item, idx) => {
      const returnedInThisTx = calc.allocatedByIdx.get(idx) || 0;
      return {
        ...item,
        returnedQuantity: (Number(item.returnedQuantity) || 0) + returnedInThisTx,
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

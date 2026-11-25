import {
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from "../../repositories";
import type { DebtStatus, IDebtAdjustmentRecord, PaymentMethod } from "../../models/Order";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ok, ServiceResult } from "../../shared/result";
import { filterAndRankBySearch } from "../../shared/search";
import { deepCloneSnapshot, withOrderLock } from "../../shared/orderLock";
import {
  applyFloorDelta,
  deductStockForSale,
  executeUnpackSetToRetail,
  formatProductWithVariant,
  getFloorStocks,
  getVariantFloorStocks,
} from "../inventory";
import { generateNextReturnExchangeCode } from "./returnCode.service";
import { prepareReturnExchangeCalculation } from "./returnCalc.service";

export async function listReturns(query: any): Promise<ServiceResult> {
  const { orderId, type, search } = query || {};
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

    return ok(filtered, { total: filtered.length });
}


export async function createReturnExchange(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const { orderId, orderCode, type, exchangeItems } = body || {};
    if (String(type || '').toUpperCase() === 'RETURN' || !Array.isArray(exchangeItems) || exchangeItems.length === 0) {
      throw new ApiError(
        400,
        'RETURN_DISABLED',
        'Tính năng trả hàng hoàn tiền đã ngừng hỗ trợ. Vui lòng chọn Đổi sang sản phẩm mới.'
      );
    }
    const lookupKey = String(orderId || orderCode || '').trim();
    if (!lookupKey) {
      throw new ApiError(
        400,
        'ORDER_ID_REQUIRED',
        'Vui lòng cung cấp mã đơn hàng gốc (orderId hoặc orderCode)'
      );
    }

    const initialOrder =
      (await orderRepo.findById(lookupKey)) ||
      (await orderRepo.findOne({ orderCode: lookupKey.toUpperCase() }));

    if (!initialOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng gốc cần trả/đổi');
    }

    const txResult = await withOrderLock(String(initialOrder._id), async () => {
      const calc = await prepareReturnExchangeCalculation(body);
      const {
        order,
        priorReturns,
        preparedReturnItems,
        preparedExchangeItems,
        returnSubtotal,
        refundedCardFee,
        returnTotal,
        exchangeTotal,
        netDifference,
        refundAmount,
        additionalCharge,
        debtBefore,
        debtReduction,
        cashRefund,
        debtAfter,
        debtStatusAfter,
      } = calc;

      const isExchange =
        body?.type === 'EXCHANGE' || preparedExchangeItems.length > 0;
      const recordType = isExchange ? 'EXCHANGE' : 'RETURN';

      const validMethods: PaymentMethod[] = ['CASH', 'BANKING', 'CARD', 'OTHER'];
      // BR-13: Nếu cashRefund === 0 thì refundMethod lưu 'CASH'
      const refundMethod: PaymentMethod =
        cashRefund > 0 && validMethods.includes(body?.refundMethod)
          ? body.refundMethod
          : 'CASH';

      // Chụp bản sao trạng thái ban đầu của order và tất cả sản phẩm liên quan để rollback nguyên tử nếu có lỗi
      const orderSnapshot = deepCloneSnapshot({
        items: order.items,
        status: order.status,
        paidAmount: order.paidAmount,
        debtAmount: order.debtAmount,
        initialDebtAmount: order.initialDebtAmount,
        debtStatus: order.debtStatus,
        debtAdjustments: order.debtAdjustments,
      });

      const affectedProductIds = new Set<string>();
      for (const rItem of preparedReturnItems) {
        if (rItem.productId) affectedProductIds.add(String(rItem.productId));
      }
      for (const eItem of preparedExchangeItems) {
        if (eItem.productId) affectedProductIds.add(String(eItem.productId));
      }
      for (const plan of calc.autoUnpackPlans || []) {
        if (plan.retailProduct?._id) affectedProductIds.add(String(plan.retailProduct._id));
        if (plan.parentProduct?._id) affectedProductIds.add(String(plan.parentProduct._id));
      }

      const productSnapshots = new Map<string, Record<string, any>>();
      for (const prodId of affectedProductIds) {
        const prod = await productRepo.findById(prodId);
        if (prod) {
          productSnapshots.set(
            prodId,
            deepCloneSnapshot({
              variants: prod.variants,
              stockFloor1: prod.stockFloor1,
              stockFloor2: prod.stockFloor2,
              stock: prod.stock,
              costPrice: prod.costPrice,
            })
          );
        }
      }

      const existingMovementsBeforeTx = await stockMovementRepo.find({});
      const existingMovementIdSet = new Set(existingMovementsBeforeTx.map((m) => String(m._id)));
      const createdMovementIds: string[] = [];
      let createdReturnId: string | null = null;

      try {
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
          debtBefore,
          debtReduction,
          cashRefund,
          debtAfter,
          refundMethod,
          note: body?.note ? String(body.note).trim() : '',
          performedBy: ctx.user?.userId || 'SALES',
          performedByName: ctx.user?.fullName || 'Nhân viên bán hàng',
        });
        createdReturnId = String(createdRecord._id);

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

              const retMovement = await stockMovementRepo.create({
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
                performedBy: ctx.user?.userId || 'SALES',
                performedByName: ctx.user?.fullName || 'Nhân viên bán hàng',
                note: `Nhận lại hàng (${rItem.condition}) từ đơn ${order.orderCode}`,
              });
              createdMovementIds.push(String(retMovement._id));
            }
          }
        }

        // 1.5. Thực hiện tự động tách Bộ -> Lẻ tại Kho Tầng 1 trước khi xuất hàng đổi mới (nếu có)
        if (Array.isArray(calc.autoUnpackPlans) && calc.autoUnpackPlans.length > 0) {
          for (const plan of calc.autoUnpackPlans) {
            const unpackRes = await executeUnpackSetToRetail({
              retailProductId: String(plan.retailProduct._id),
              setsToUnpack: plan.setsToUnpack,
              warehouse: 'FLOOR_1',
              color: plan.color,
              size: plan.size,
              reason: `Tự động tách bộ khi đổi hàng phiếu ${createdRecord.code} (đơn gốc ${order.orderCode})`,
              actorId: ctx.user?.userId || 'SALES',
              actorName: ctx.user?.fullName || 'Nhân viên bán hàng',
              actorRole: ctx.user?.role || 'SALES',
            });
            if (unpackRes.setMovement?._id) createdMovementIds.push(String(unpackRes.setMovement._id));
            if (unpackRes.retailMovement?._id) createdMovementIds.push(String(unpackRes.retailMovement._id));
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

            const exMovement = await stockMovementRepo.create({
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
              performedBy: ctx.user?.userId || 'SALES',
              performedByName: ctx.user?.fullName || 'Nhân viên bán hàng',
              note: `Xuất hàng đổi mới cho đơn ${order.orderCode}`,
            });
            createdMovementIds.push(String(exMovement._id));
          }
        }

        // 3. Cập nhật returnedQuantity chính xác theo chỉ số dòng (lineIndex), paidAmount và trạng thái đơn gốc
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

        const prevAdjustments: IDebtAdjustmentRecord[] = Array.isArray(order.debtAdjustments)
          ? order.debtAdjustments
          : [];
        const nextAdjustments: IDebtAdjustmentRecord[] =
          debtReduction > 0
            ? [
                ...prevAdjustments,
                {
                  _id: `da_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  type: 'RETURN',
                  returnCode: createdRecord.code,
                  amount: debtReduction,
                  debtBefore,
                  debtAfter,
                  at: new Date(),
                  by: ctx.user?.userId || 'SALES',
                  byName: ctx.user?.fullName || 'Nhân viên bán hàng',
                },
              ]
            : prevAdjustments;

        const totalOrderAmount = Math.max(0, Number(order.totalAmount) || 0);
        const collectedDebtAmount = (
          Array.isArray(order.debtPayments) ? order.debtPayments : []
        ).reduce((s, dp) => s + Math.max(0, Number(dp?.amount) || 0), 0);
        const reducedByReturnAmount = nextAdjustments.reduce(
          (s, da) => s + Math.max(0, Number(da?.amount) || 0),
          0
        );
        const initialDebtAmount = Math.max(
          debtBefore,
          Number(order.initialDebtAmount) || 0,
          debtAfter + collectedDebtAmount + reducedByReturnAmount
        );
        const cashAtPurchase = Math.max(0, totalOrderAmount - initialDebtAmount);
        const priorCashRefunded = (priorReturns || []).reduce((s: number, r: any) => {
          const rDebtRed = Math.max(0, Math.round(Number(r.debtReduction) || 0));
          const rRefundAmt = Math.max(0, Math.round(Number(r.refundAmount) || 0));
          const rCashRef =
            r.cashRefund !== undefined && r.cashRefund !== null
              ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
              : Math.max(0, rRefundAmt - rDebtRed);
          return s + rCashRef;
        }, 0);
        const totalCashRefundedForOrder = priorCashRefunded + cashRefund;
        const nextPaidAmount = Math.max(
          0,
          Math.min(totalOrderAmount, cashAtPurchase + collectedDebtAmount - totalCashRefundedForOrder)
        );

        const updatedOrder = await orderRepo.updateById(order._id, {
          items: updatedOrderItems,
          status: newOrderStatus,
          paidAmount: nextPaidAmount,
          ...(debtReduction > 0
            ? {
                debtAmount: debtAfter,
                debtStatus: debtStatusAfter,
                debtAdjustments: nextAdjustments,
              }
            : {}),
        });

        if (!updatedOrder) {
          throw new ApiError(500, 'ORDER_UPDATE_FAILED', 'Không thể cập nhật trạng thái đơn hàng gốc');
        }

        return {
          returnExchange: createdRecord,
          order: updatedOrder,
          debtBefore,
          debtReduction,
          cashRefund,
          debtAfter,
          debtStatusAfter,
        };
      } catch (txErr) {
        // Rollback toàn bộ bút toán kho, phiếu trả/đổi, tồn kho sản phẩm và đơn hàng gốc
        const currentMovements = await stockMovementRepo.find({}).catch(() => []);
        const movementIdsToDelete = new Set<string>(createdMovementIds);
        for (const m of currentMovements) {
          if (!existingMovementIdSet.has(String(m._id))) {
            movementIdsToDelete.add(String(m._id));
          }
        }
        for (const movId of movementIdsToDelete) {
          await stockMovementRepo.deleteById(movId).catch(() => null);
        }
        if (createdReturnId) {
          await returnExchangeRepo.deleteById(createdReturnId).catch(() => null);
        }
        for (const [prodId, snap] of productSnapshots.entries()) {
          await productRepo.updateById(prodId, snap).catch(() => null);
        }
        await orderRepo.updateById(order._id, orderSnapshot).catch(() => null);
        throw txErr;
      }
    });

    return created(txResult, {});
}


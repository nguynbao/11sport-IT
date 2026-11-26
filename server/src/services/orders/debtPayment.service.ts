import { customerRepo, orderRepo, returnExchangeRepo } from "../../repositories";
import type { DebtStatus, IDebtPaymentRecord, SplitMethod } from "../../models/Order";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";
import { withOrderLock } from "../../shared/orderLock";
import { parseDueDateInput } from "./orderShift.rules";

export async function payOrderDebt(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  if (!['CEO', 'ADMIN', 'ACCOUNTANT'].includes(ctx.user?.role || '')) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Giám đốc (CEO), Quản lý (ADMIN) hoặc Kế toán (ACCOUNTANT) trên CMS mới được phép xác nhận thu nợ / tất toán công nợ'
      );
    }

    const idOrCode = String(id || '').trim();
    const initialLookupOrder =
      (await orderRepo.findById(idOrCode)) ||
      (await orderRepo.findOne({ orderCode: idOrCode.toUpperCase() }));

    if (!initialLookupOrder) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng cần thu nợ');
    }

    const result = await withOrderLock(String(initialLookupOrder._id), async () => {
      const existingOrder = await orderRepo.findById(initialLookupOrder._id);
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

      const rawAmount = body?.amount;
      const payAmount =
        rawAmount === undefined || rawAmount === null || body?.payFull === true
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

      const rawMethod = String(body?.method || 'BANKING').toUpperCase();
      const validMethods: ('CASH' | 'BANKING' | 'CARD')[] = ['CASH', 'BANKING', 'CARD'];
      const method: 'CASH' | 'BANKING' | 'CARD' = validMethods.includes(rawMethod as any)
        ? (rawMethod as 'CASH' | 'BANKING' | 'CARD')
        : 'BANKING';

      const note = String(body?.note || '').trim() || 'Thu công nợ khách hàng';
      const paymentRecord: IDebtPaymentRecord = {
        _id: `dp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount: payAmount,
        method,
        note,
        paidAt: new Date(),
        collectedBy: ctx.user?.userId || 'ADMIN',
        collectedByName: ctx.user?.fullName || 'Quản Trị Viên 11Sport',
      };

      const prevPayments = Array.isArray(existingOrder.debtPayments)
        ? existingOrder.debtPayments
        : [];
      const nextPayments = [...prevPayments, paymentRecord];
      const nextDebtAmount = Math.max(0, currentDebt - payAmount);
      const totalOrderAmount = Math.max(0, Number(existingOrder.totalAmount) || 0);
      const totalCollectedDebt = nextPayments.reduce(
        (s, dp) => s + Math.max(0, Number(dp.amount) || 0),
        0
      );
      const reducedByReturnAmount = (
        Array.isArray(existingOrder.debtAdjustments) ? existingOrder.debtAdjustments : []
      ).reduce((s, da) => s + Math.max(0, Number(da?.amount) || 0), 0);
      const initialDebt = Math.max(
        currentDebt,
        Number(existingOrder.initialDebtAmount) || currentDebt,
        nextDebtAmount + totalCollectedDebt + reducedByReturnAmount
      );
      const cashAtPurchase = Math.max(0, totalOrderAmount - initialDebt);

      const orderReturns = await returnExchangeRepo.find({ orderId: existingOrder._id });
      const totalCashRefundedForOrder = orderReturns.reduce((s, r) => {
        const rDebtRed = Math.max(0, Math.round(Number(r.debtReduction) || 0));
        const rRefundAmt = Math.max(0, Math.round(Number(r.refundAmount) || 0));
        const rCashRef =
          r.cashRefund !== undefined && r.cashRefund !== null
            ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
            : Math.max(0, rRefundAmt - rDebtRed);
        return s + rCashRef;
      }, 0);

      const nextPaidAmount = Math.max(
        0,
        Math.min(totalOrderAmount, cashAtPurchase + totalCollectedDebt - totalCashRefundedForOrder)
      );
      const nextDebtStatus: DebtStatus = nextDebtAmount === 0 ? 'SETTLED' : 'PARTIAL';

      const updatedOrder = await orderRepo.updateById(existingOrder._id, {
        paidAmount: nextPaidAmount,
        debtAmount: nextDebtAmount,
        initialDebtAmount: initialDebt,
        debtStatus: nextDebtStatus,
        debtPayments: nextPayments,
      });

      return {
        updatedOrder,
        payAmount,
        nextDebtAmount,
        nextDebtStatus,
      };
    });

    return ok(result.updatedOrder, {
        collectedAmount: result.payAmount,
        remainingDebt: result.nextDebtAmount,
        debtStatus: result.nextDebtStatus,
      });
}


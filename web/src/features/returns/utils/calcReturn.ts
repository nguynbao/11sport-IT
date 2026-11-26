import type { Order, ReturnReceipt } from "@/shared/types";
import { type ExchangeItemForm, type ReturnItemForm, getExchangeItemPricing } from "../types";

/** Tính local (thuần) tiền trả/đổi/hoàn/cấn trừ nợ — dùng khi server chưa trả kết quả calculate. */
export function calcReturnLocal(
  selectedOrder: Order | null,
  returnRows: ReturnItemForm[],
  exchangeRows: ExchangeItemForm[],
  recentReturns: ReturnReceipt[],
  mode: string
) {
  if (!selectedOrder) {
    return {
      unitRefundPrices: [] as number[],
      lineRefundTotals: [] as number[],
      returnSubtotal: 0,
      refundedCardFee: 0,
      returnTotal: 0,
      exchangeRawSubtotal: 0,
      exchangeDiscountTotal: 0,
      exchangeTotal: 0,
      netDifference: 0,
      refundAmount: 0,
      additionalCharge: 0,
      debtBefore: 0,
      debtReduction: 0,
      cashRefund: 0,
      debtAfter: 0,
    };
  }

  const orderItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
  const orderSubtotalS = Math.max(
    0,
    Number(selectedOrder.subtotal) ||
      orderItems.reduce(
        (sum, it) =>
          sum +
          (Boolean(it.isGift) || it.discountType === "GIFT"
            ? 0
            : Math.max(
                0,
                Number(it.lineTotal) ||
                  Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0)
              )),
        0
      )
  );
  const orderBillDiscB = Math.min(
    orderSubtotalS,
    Math.max(0, Math.round(Number(selectedOrder.billDiscountAmount) || 0))
  );

  const paidLineIndices = orderItems
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => {
      const lTotal =
        Number(it.lineTotal) ||
        Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0);
      return !it.isGift && it.discountType !== "GIFT" && lTotal > 0;
    })
    .map(({ idx }) => idx);
  const lastPaidIdx = paidLineIndices.length > 0 ? paidLineIndices[paidLineIndices.length - 1] : -1;

  const lineNetAmounts: number[] = [];
  let allocatedBillDisc = 0;
  for (let idx = 0; idx < orderItems.length; idx++) {
    const it = orderItems[idx];
    const lineTotal = Math.max(
      0,
      Number(it.lineTotal) ||
        Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0)
    );
    if (it.isGift || it.discountType === "GIFT" || lineTotal <= 0 || orderSubtotalS <= 0 || orderBillDiscB <= 0) {
      lineNetAmounts[idx] = lineTotal;
      continue;
    }
    let bShare = 0;
    if (idx === lastPaidIdx) {
      bShare = Math.max(0, orderBillDiscB - allocatedBillDisc);
    } else {
      bShare = Math.min(
        Math.max(0, orderBillDiscB - allocatedBillDisc),
        Math.round((lineTotal / orderSubtotalS) * orderBillDiscB)
      );
    }
    allocatedBillDisc += bShare;
    lineNetAmounts[idx] = Math.max(0, lineTotal - bShare);
  }

  const orderNetGoods = Math.max(0, orderSubtotalS - orderBillDiscB);
  const unitRefundPrices: number[] = [];
  const lineRefundTotals: number[] = [];
  let calcReturnSubtotal = 0;

  for (let i = 0; i < returnRows.length; i++) {
    const r = returnRows[i];
    const ordItem = orderItems[r.lineIndex];
    const q_i = Math.max(1, Number(ordItem?.quantity || r.maxReturnable || 1));
    const alreadyReturned = Math.min(q_i, Math.max(0, Number(ordItem?.returnedQuantity || 0)));
    const N_i = lineNetAmounts[r.lineIndex] ?? Math.max(0, Math.round(r.unitPrice * q_i));
    const unitRefundPrice = r.isGift ? 0 : Math.max(0, Math.round(N_i / q_i));
    unitRefundPrices[i] = unitRefundPrice;

    if (r.quantity <= 0 || r.isGift) {
      lineRefundTotals[i] = 0;
      continue;
    }
    const alreadyAllocNet =
      alreadyReturned >= q_i
        ? N_i
        : alreadyReturned > 0
          ? Math.round((alreadyReturned / q_i) * N_i)
          : 0;
    const remainingNetForLine = Math.max(0, N_i - alreadyAllocNet);
    const isReturningRemainingAll = alreadyReturned + r.quantity >= q_i;
    const lineRefundTotal = isReturningRemainingAll
      ? remainingNetForLine
      : Math.min(remainingNetForLine, Math.round((r.quantity / q_i) * N_i));
    lineRefundTotals[i] = lineRefundTotal;
    calcReturnSubtotal += lineRefundTotal;
  }

  let calcRefundedCardFee = 0;
  const orderCardFee = Math.max(0, Math.round(Number(selectedOrder.cardFee) || 0));
  if (orderCardFee > 0 && calcReturnSubtotal > 0) {
    const orderReturns: ReturnReceipt[] = Array.isArray((selectedOrder as any).returns)
      ? (selectedOrder as any).returns
      : recentReturns.filter(
          (r) =>
            r.orderId === selectedOrder._id ||
            r.orderCode === (selectedOrder.orderCode || selectedOrder.code)
        );
    const alreadyRefunded = orderReturns.reduce(
      (sum, r) => sum + Math.max(0, Math.round(Number(r.refundedCardFee) || 0)),
      0
    );
    const remainingCardFee = Math.max(0, orderCardFee - alreadyRefunded);

    const allPaidLinesReturned =
      returnRows.some((r) => r.quantity > 0) &&
      returnRows.every((r) => r.unitPrice <= 0 || r.quantity >= r.maxReturnable);

    if (allPaidLinesReturned) {
      calcRefundedCardFee = remainingCardFee;
    } else {
      const baseForFee =
        orderNetGoods > 0 ? orderNetGoods : Math.max(0, Number(selectedOrder.subtotal) || 0);
      calcRefundedCardFee =
        baseForFee > 0
          ? Math.min(remainingCardFee, Math.round((calcReturnSubtotal / baseForFee) * orderCardFee))
          : remainingCardFee;
    }
  }

  const calcReturnTotal = calcReturnSubtotal + calcRefundedCardFee;
  const calcExchangeRawSubtotal =
    mode === "EXCHANGE"
      ? exchangeRows.reduce(
          (sum, r) => sum + getExchangeItemPricing(r).originalUnitPrice * r.quantity,
          0
        )
      : 0;
  const calcExchangeDiscountTotal =
    mode === "EXCHANGE"
      ? exchangeRows.reduce((sum, r) => sum + getExchangeItemPricing(r).discountAmount, 0)
      : 0;
  const calcExchangeTotal =
    mode === "EXCHANGE"
      ? exchangeRows.reduce((sum, r) => sum + getExchangeItemPricing(r).lineTotal, 0)
      : 0;
  const calcNetDifference = calcExchangeTotal - calcReturnTotal;
  const calcRefundAmount = calcNetDifference < 0 ? Math.abs(calcNetDifference) : 0;
  const calcAdditionalCharge = calcNetDifference > 0 ? calcNetDifference : 0;
  const calcDebtBefore = Math.max(0, Math.round(Number(selectedOrder.debtAmount) || 0));
  const calcDebtReduction = Math.min(calcDebtBefore, calcRefundAmount);
  const calcCashRefund = Math.max(0, calcRefundAmount - calcDebtReduction);
  const calcDebtAfter = Math.max(0, calcDebtBefore - calcDebtReduction);

  return {
    unitRefundPrices,
    lineRefundTotals,
    returnSubtotal: calcReturnSubtotal,
    refundedCardFee: calcRefundedCardFee,
    returnTotal: calcReturnTotal,
    exchangeRawSubtotal: calcExchangeRawSubtotal,
    exchangeDiscountTotal: calcExchangeDiscountTotal,
    exchangeTotal: calcExchangeTotal,
    netDifference: calcNetDifference,
    refundAmount: calcRefundAmount,
    additionalCharge: calcAdditionalCharge,
    debtBefore: calcDebtBefore,
    debtReduction: calcDebtReduction,
    cashRefund: calcCashRefund,
    debtAfter: calcDebtAfter,
  };
}

export type LocalReturnCalc = ReturnType<typeof calcReturnLocal>;

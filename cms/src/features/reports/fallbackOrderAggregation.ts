import { extractClientOrderDebtMeta } from "./utils";
import type { Order, Product, ReturnReceipt } from "@/shared/types";

export function aggregateOrdersAndReturns(params: {
  filteredOrders: Order[];
  filteredReturns: ReturnReceipt[];
  prodById: Map<string, Product>;
  prodByCode: Map<string, Product>;
  orderById: Map<string, Order>;
  refundedCashByOrderId: Map<string, number>;
  inRange: (d?: string | Date | null) => boolean;
  ensureProdStat: (pId: string, pCode: string, pName: string, unit: string) => any;
  ensureDay: (d: string | Date) => any;
  ensureHour: (d: string | Date) => any;
  filterCatId: string;
  getProdCatId: (p?: Product) => string;
  fromDate: Date | null;
}) {
  const {
    filteredOrders,
    filteredReturns,
    prodById,
    prodByCode,
    orderById,
    refundedCashByOrderId,
    inRange,
    ensureProdStat,
    ensureDay,
    ensureHour,
    filterCatId,
    getProdCatId,
    fromDate,
  } = params;

  let grossRevenue = 0;
  let itemDiscountTotal = 0;
  let billDiscountTotal = 0;
  let cardFeeCollected = 0;
  let cardFeeRefunded = 0;
  let orderRevenue = 0;
  let totalUnitsSold = 0;
  let totalGiftUnits = 0;
  let salesCogs = 0;
  let giftCogs = 0;
  let giftRetailValue = 0;
  let estimatedCogs = 0;
  let cogsEstimated = false;
  let cashAtPurchase = 0;
  let cashRefunded = 0;
  let debtReducedByReturnInPeriod = 0;
  let returnFromPriorPeriods = 0;
  let outstandingDebtInPeriod = 0;
  let initialDebtInPeriod = 0;
  let debtOrdersInPeriod = 0;

  const paymentStats: Record<string, { method: string; label: string; orders: number; revenue: number }> = {
    CASH: { method: "CASH", label: "Tiền mặt", orders: 0, revenue: 0 },
    BANKING: { method: "BANKING", label: "Chuyển khoản", orders: 0, revenue: 0 },
    CARD: { method: "CARD", label: "Quẹt thẻ", orders: 0, revenue: 0 },
    OTHER: { method: "OTHER", label: "Khác (Tách / Công nợ)", orders: 0, revenue: 0 },
  };

  for (const o of filteredOrders) {
    const day = ensureDay(o.createdAt);
    const hr = ensureHour(o.createdAt);
    day.orders += 1;
    hr.orders += 1;

    const orderSub = Math.max(0, Number(o.subtotal) || 0);
    const orderBillDisc = Math.min(orderSub, Math.max(0, Math.round(Number(o.billDiscountAmount) || 0)));
    const orderAfterBill = Math.max(0, orderSub - orderBillDisc);
    const orderCardFee = Math.max(0, Math.round(Number(o.cardFee) || 0));

    const oItems = o.items || [];
    const paidLineIndices = oItems
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => !it.isGift && it.discountType !== "GIFT" && (Number(it.lineTotal) || 0) > 0)
      .map(({ idx }) => idx);
    const lastPaidIdx = paidLineIndices.length > 0 ? paidLineIndices[paidLineIndices.length - 1] : -1;

    let allocatedBillDisc = 0;
    const billShareByIdx: number[] = [];
    for (let idx = 0; idx < oItems.length; idx++) {
      const it = oItems[idx];
      const lineTotal = Math.max(0, Number(it.lineTotal) || 0);
      if (it.isGift || it.discountType === "GIFT" || lineTotal <= 0 || orderSub <= 0 || orderBillDisc <= 0) {
        billShareByIdx[idx] = 0;
        continue;
      }
      let bShare = 0;
      if (idx === lastPaidIdx) {
        bShare = Math.max(0, orderBillDisc - allocatedBillDisc);
      } else {
        bShare = Math.min(
          Math.max(0, orderBillDisc - allocatedBillDisc),
          Math.round((lineTotal / orderSub) * orderBillDisc)
        );
      }
      allocatedBillDisc += bShare;
      billShareByIdx[idx] = bShare;
    }

    let orderIncludedGross = 0;
    let orderIncludedItemDisc = 0;
    let orderIncludedBillDisc = 0;
    let orderIncludedNetRev = 0;
    let orderIncludedSalesCogs = 0;
    let orderIncludedGiftCogs = 0;
    let orderIncludedGiftRetail = 0;
    let orderIncludedCogs = 0;
    let orderIncludedUnits = 0;

    for (let idx = 0; idx < oItems.length; idx++) {
      const it = oItems[idx];
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;

      const qty = Number(it.quantity) || 0;
      const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
      const origPrice = Number(it.originalUnitPrice ?? it.unitPrice) || 0;
      const lineTotal = Number(it.lineTotal) || 0;
      const itemDisc = Number(it.discountAmount) || 0;
      const hasSavedUnitCost = it.unitCost !== undefined && it.unitCost !== null;
      if (!hasSavedUnitCost && qty > 0) {
        cogsEstimated = true;
      }
      const unitCost = hasSavedUnitCost
        ? Math.max(0, Math.round(Number(it.unitCost) || 0))
        : Math.max(0, Math.round(Number(prod?.costPrice) || 0));

      const billDiscShare = billShareByIdx[idx] || 0;
      const netItemRev = Math.max(0, lineTotal - billDiscShare);
      const itemCogs = qty * unitCost;

      if (isGift) {
        totalGiftUnits += qty;
        orderIncludedGiftCogs += itemCogs;
        orderIncludedGiftRetail += origPrice * qty;
      } else {
        totalUnitsSold += qty;
        orderIncludedUnits += qty;
        orderIncludedGross += origPrice * qty;
        orderIncludedItemDisc += itemDisc;
        orderIncludedBillDisc += billDiscShare;
        orderIncludedNetRev += netItemRev;
        orderIncludedSalesCogs += itemCogs;
      }
      orderIncludedCogs += itemCogs;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      if (isGift) {
        st.giftQty += qty;
      } else {
        st.soldQty += qty;
        st.revenue += netItemRev;
      }
      st.cogs += itemCogs;
      st.orderIds.add(String(o._id));
      if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
        st.lastSoldAt = o.createdAt;
      }
    }

    const effectiveBillDisc = filterCatId ? orderIncludedBillDisc : orderBillDisc;
    const effectiveCardFee = filterCatId ? 0 : orderCardFee;
    const effectiveOrderRev = filterCatId ? orderIncludedNetRev : orderAfterBill;

    grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    itemDiscountTotal += filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0;
    billDiscountTotal += effectiveBillDisc;
    cardFeeCollected += effectiveCardFee;
    orderRevenue += effectiveOrderRev;
    salesCogs += orderIncludedSalesCogs;
    giftCogs += orderIncludedGiftCogs;
    giftRetailValue += orderIncludedGiftRetail;
    estimatedCogs += orderIncludedCogs;

    const dm = extractClientOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);
    const netOrderCashAtPurchase = Math.max(0, dm.cashAtPurchase - orderCardFee);
    const orderCashAtPurchase = filterCatId ? 0 : netOrderCashAtPurchase;
    cashAtPurchase += orderCashAtPurchase;

    if (dm.initialDebtAmount > 0 || dm.debtAmount > 0) {
      debtOrdersInPeriod += 1;
      const ratio =
        filterCatId && orderAfterBill > 0 ? Math.min(1, effectiveOrderRev / orderAfterBill) : 1;
      outstandingDebtInPeriod += Math.round(dm.debtAmount * ratio);
      initialDebtInPeriod += Math.round(dm.initialDebtAmount * ratio);
    }

    day.unitsSold += orderIncludedUnits;
    day.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    day.discountTotal +=
      (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
    day.orderRevenue += effectiveOrderRev;
    day.netRevenue += effectiveOrderRev;
    day.cogs += orderIncludedCogs;
    day.grossProfit = day.netRevenue - day.cogs;
    day.cashCollected += orderCashAtPurchase;

    hr.unitsSold += orderIncludedUnits;
    hr.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    hr.discountTotal +=
      (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
    hr.orderRevenue += effectiveOrderRev;
    hr.netRevenue += effectiveOrderRev;
    hr.cogs += orderIncludedCogs;
    hr.grossProfit = hr.netRevenue - hr.cogs;
    hr.cashCollected += orderCashAtPurchase;

    const pm = paymentStats[o.paymentMethod] || paymentStats.OTHER;
    pm.orders += 1;
    pm.revenue += effectiveOrderRev;
  }

  let returnGoodsTotal = 0;
  let exchangeGoodsTotal = 0;
  let returnTotal = 0;
  let exchangeTotal = 0;
  let netReturnImpact = 0;
  let totalUnitsReturned = 0;

  for (const r of filteredReturns) {
    const day = ensureDay(r.createdAt);
    const hr = ensureHour(r.createdAt);
    let rRetGoods = 0;
    let rExGoods = 0;
    let rSalesCogsImpact = 0;
    let rGiftCogsImpact = 0;
    let rCogsImpact = 0;
    const origOrder = orderById.get(String(r.orderId));
    const origSub = Math.max(0, Number(origOrder?.subtotal) || 0);
    const origBillDisc = Math.min(origSub, Math.max(0, Math.round(Number(origOrder?.billDiscountAmount) || 0)));

    const rRawLinesSum = (r.returnItems || []).reduce(
      (s: number, it: any) => s + (Number(it.lineTotal) || 0),
      0
    );
    const matchingOrigGrossSum = origOrder
      ? (r.returnItems || []).reduce((s: number, it: any) => {
        const matchedOrig = (origOrder.items || []).find(
          (oi) =>
            String(oi.productId) === String(it.productId) ||
            oi.productCode === it.productCode
        );
        const origUnitPrice = Number(matchedOrig?.unitPrice ?? it.unitPrice) || 0;
        return s + origUnitPrice * (Number(it.quantity) || 0);
      }, 0)
      : rRawLinesSum;
    const isAlreadyNetOfBillDisc =
      origBillDisc > 0 && rRawLinesSum > 0 && rRawLinesSum < matchingOrigGrossSum;

    const rRetItems = r.returnItems || [];
    let allocatedRetBillShare = 0;
    const totalExpectedRetBillShare =
      !isAlreadyNetOfBillDisc && origSub > 0 && origBillDisc > 0
        ? Math.round((rRawLinesSum / origSub) * origBillDisc)
        : 0;

    for (let idx = 0; idx < rRetItems.length; idx++) {
      const it = rRetItems[idx];
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const retIsGift = Boolean(it.isGift) || it.discountType === "GIFT" || line <= 0;
      let retBillShare = 0;
      if (!isAlreadyNetOfBillDisc && !retIsGift && origSub > 0 && origBillDisc > 0) {
        if (idx === rRetItems.length - 1) {
          retBillShare = Math.max(0, totalExpectedRetBillShare - allocatedRetBillShare);
        } else {
          retBillShare = Math.min(
            Math.max(0, totalExpectedRetBillShare - allocatedRetBillShare),
            Math.round((line / origSub) * origBillDisc)
          );
        }
        allocatedRetBillShare += retBillShare;
      }
      const netRetLine = Math.max(0, line - retBillShare);

      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;

      let resolvedUnitCost: number | undefined =
        it.unitCost !== undefined && it.unitCost !== null
          ? Math.max(0, Math.round(Number(it.unitCost) || 0))
          : undefined;
      if (resolvedUnitCost === undefined && origOrder) {
        const matchedOrig = (origOrder.items || []).find(
          (oi) =>
            String(oi.productId) === String(it.productId) || oi.productCode === it.productCode
        );
        if (matchedOrig && matchedOrig.unitCost !== undefined && matchedOrig.unitCost !== null) {
          resolvedUnitCost = Math.max(0, Math.round(Number(matchedOrig.unitCost) || 0));
        }
      }
      if (resolvedUnitCost === undefined) {
        if (qty > 0 && (it.condition === "GOOD" || it.restocked)) {
          cogsEstimated = true;
        }
        resolvedUnitCost = Math.max(0, Math.round(Number(prod?.costPrice) || 0));
      }

      totalUnitsReturned += qty;
      rRetGoods += netRetLine;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      st.returnedQty += qty;
      st.revenue -= netRetLine;
      if (it.condition === "GOOD" || it.restocked) {
        const retLineCogs = qty * resolvedUnitCost;
        st.cogs -= retLineCogs;
        rCogsImpact -= retLineCogs;
        if (retIsGift) {
          rGiftCogsImpact -= retLineCogs;
        } else {
          rSalesCogsImpact -= retLineCogs;
        }
      }
    }

    for (const it of r.exchangeItems || []) {
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const hasSavedUnitCost = it.unitCost !== undefined && it.unitCost !== null;
      if (!hasSavedUnitCost && qty > 0) {
        cogsEstimated = true;
      }
      const unitCost = hasSavedUnitCost
        ? Math.max(0, Math.round(Number(it.unitCost) || 0))
        : Math.max(0, Math.round(Number(prod?.costPrice) || 0));
      rExGoods += line;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      st.exchangeOutQty += qty;
      st.revenue += line;
      st.cogs += qty * unitCost;
      rSalesCogsImpact += qty * unitCost;
      rCogsImpact += qty * unitCost;
    }

    const rRefundedFee = filterCatId ? 0 : Math.max(0, Math.round(Number(r.refundedCardFee) || 0));
    cardFeeRefunded += rRefundedFee;
    returnGoodsTotal += rRetGoods;
    exchangeGoodsTotal += rExGoods;

    if (fromDate && origOrder?.createdAt) {
      const origTime = new Date(origOrder.createdAt).getTime();
      if (!isNaN(origTime) && origTime < fromDate.getTime()) {
        returnFromPriorPeriods += rRetGoods;
      }
    }

    const rDebtRed = filterCatId ? 0 : Math.max(0, Math.round(Number(r.debtReduction) || 0));
    const rRefundAmt = Math.max(
      0,
      Math.round(Number(r.refundAmount ?? (r.netDifference < 0 ? Math.abs(r.netDifference) : 0)) || 0)
    );
    const rawCashRef =
      r.cashRefund !== undefined && r.cashRefund !== null
        ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
        : Math.max(0, rRefundAmt - rDebtRed);
    const rCashRef = filterCatId ? 0 : Math.max(0, rawCashRef - rRefundedFee);
    const rAddCharge = filterCatId
      ? 0
      : Math.max(0, Math.round(Number(r.additionalCharge ?? (r.netDifference > 0 ? r.netDifference : 0)) || 0));

    debtReducedByReturnInPeriod += rDebtRed;
    cashRefunded += rCashRef;

    if (rAddCharge > 0) {
      cashAtPurchase += rAddCharge;
    }

    const goodsDiff = rExGoods - rRetGoods;
    returnTotal += filterCatId ? rRetGoods : rRetGoods + rRefundedFee;
    exchangeTotal += rExGoods;
    netReturnImpact += goodsDiff;
    salesCogs += rSalesCogsImpact;
    giftCogs += rGiftCogsImpact;
    estimatedCogs += rCogsImpact;

    const rCashDelta = rAddCharge - rCashRef;

    day.returnImpact += goodsDiff;
    day.netRevenue += goodsDiff;
    day.cogs += rCogsImpact;
    day.grossProfit = day.netRevenue - day.cogs;
    day.cashCollected += rCashDelta;

    hr.returnImpact += goodsDiff;
    hr.netRevenue += goodsDiff;
    hr.cogs += rCogsImpact;
    hr.grossProfit = hr.netRevenue - hr.cogs;
    hr.cashCollected += rCashDelta;
  }


  return {
    paymentStats,
    grossRevenue,
    itemDiscountTotal,
    billDiscountTotal,
    cardFeeCollected,
    cardFeeRefunded,
    orderRevenue,
    totalUnitsSold,
    totalGiftUnits,
    salesCogs,
    giftCogs,
    giftRetailValue,
    estimatedCogs,
    cogsEstimated,
    cashAtPurchase,
    cashRefunded,
    debtReducedByReturnInPeriod,
    returnFromPriorPeriods,
    outstandingDebtInPeriod,
    initialDebtInPeriod,
    debtOrdersInPeriod,
    returnGoodsTotal,
    exchangeGoodsTotal,
    returnTotal,
    exchangeTotal,
    netReturnImpact,
    totalUnitsReturned,
  };
}

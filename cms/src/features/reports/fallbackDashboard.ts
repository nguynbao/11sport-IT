import { parseLocalDateBound, extractClientOrderDebtMeta } from "./utils";
import type {
  RevenueDashboardData,
  ProductSalesAnalysisRow,
  DebtOrderRow,
  DebtCustomerSummary,
  Category,
  Order,
  ServiceOrder,
  ReturnReceipt,
  Product,
} from "@/shared/types";

export function buildClientFallbackDashboard(
  orders: Order[],
  returns: ReturnReceipt[],
  products: Product[],
  categories: Category[],
  filters: { from: string; to: string; categoryId: string; paymentMethod: string },
  serviceOrders: ServiceOrder[] = []
): RevenueDashboardData {
  const fromDate = parseLocalDateBound(filters.from, false);
  const toDate = parseLocalDateBound(filters.to, true);

  const inRange = (d?: string | Date | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    if (isNaN(t)) return false;
    if (fromDate && t < fromDate.getTime()) return false;
    if (toDate && t > toDate.getTime()) return false;
    return true;
  };

  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(String(c._id), c.name));

  const prodById = new Map<string, Product>();
  const prodByCode = new Map<string, Product>();
  products.forEach((p) => {
    prodById.set(String(p._id), p);
    prodByCode.set(String(p.code), p);
  });

  const orderById = new Map<string, Order>();
  orders.forEach((o) => orderById.set(String(o._id), o));

  const refundedCashByOrderId = new Map<string, number>();
  returns.forEach((r) => {
    const oId = String(r.orderId || "");
    if (!oId) return;
    const rDebtRed = Math.max(0, Math.round(Number(r.debtReduction) || 0));
    const rRefundAmt = Math.max(
      0,
      Math.round(Number(r.refundAmount ?? (r.netDifference < 0 ? Math.abs(r.netDifference) : 0)) || 0)
    );
    const rCashRef =
      r.cashRefund !== undefined && r.cashRefund !== null
        ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
        : Math.max(0, rRefundAmt - rDebtRed);
    if (rCashRef > 0) {
      refundedCashByOrderId.set(oId, (refundedCashByOrderId.get(oId) || 0) + rCashRef);
    }
  });

  const filterCatId = filters.categoryId || "";
  const isServiceCatFilter = filterCatId.toUpperCase() === "SERVICE";
  const isProductOnlyCatFilter = Boolean(filterCatId && !isServiceCatFilter);
  const filterPayMethod = filters.paymentMethod ? filters.paymentMethod.toUpperCase() : "";

  const getProdCatId = (p?: Product) => {
    if (!p) return "";
    return typeof p.categoryId === "object" ? String(p.categoryId?._id || "") : String(p.categoryId || "");
  };

  const filteredOrders = orders.filter((o) => {
    if (isServiceCatFilter) return false;
    if (o.status === "DRAFT") return false;
    if (!inRange(o.createdAt)) return false;
    if (filterPayMethod) {
      if (filterPayMethod === "DEBT") {
        const dm = extractClientOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);
        if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) return false;
      } else if (o.paymentMethod !== filterPayMethod) {
        return false;
      }
    }
    if (isProductOnlyCatFilter) {
      const hasCat = (o.items || []).some((it) => {
        const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        return p && getProdCatId(p) === filterCatId;
      });
      if (!hasCat) return false;
    }
    return true;
  });

  const filteredReturns = returns.filter((r) => {
    if (isServiceCatFilter) return false;
    if (!inRange(r.createdAt)) return false;
    if (filterPayMethod) {
      const origO = orderById.get(String(r.orderId));
      if (!origO) return false;
      if (filterPayMethod === "DEBT") {
        const dm = extractClientOrderDebtMeta(origO);
        if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) return false;
      } else if (origO.paymentMethod !== filterPayMethod) {
        return false;
      }
    }
    if (isProductOnlyCatFilter) {
      const hasCat =
        (r.returnItems || []).some((it: any) => {
          const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
          return p && getProdCatId(p) === filterCatId;
        }) ||
        (r.exchangeItems || []).some((it: any) => {
          const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
          return p && getProdCatId(p) === filterCatId;
        });
      if (!hasCat) return false;
    }
    return true;
  });

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

  interface ProdStat {
    productId: string;
    productCode: string;
    productName: string;
    categoryId: string;
    categoryName: string;
    unit: string;
    soldQty: number;
    giftQty: number;
    returnedQty: number;
    exchangeOutQty: number;
    revenue: number;
    cogs: number;
    orderIds: Set<string>;
    lastSoldAt: string | null;
  }

  const prodStats = new Map<string, ProdStat>();
  const ensureProdStat = (pId: string, pCode: string, pName: string, unit: string): ProdStat => {
    const prod = prodById.get(pId) || prodByCode.get(pCode);
    const key = prod ? String(prod._id) : pCode || pId;
    if (!prodStats.has(key)) {
      const cId = getProdCatId(prod);
      prodStats.set(key, {
        productId: prod ? String(prod._id) : pId,
        productCode: prod ? prod.code : pCode,
        productName: prod ? prod.name : pName,
        categoryId: cId,
        categoryName: prod?.categoryName || catMap.get(cId) || "Chưa phân loại",
        unit: prod ? prod.unit : unit || "Cái",
        soldQty: 0,
        giftQty: 0,
        returnedQty: 0,
        exchangeOutQty: 0,
        revenue: 0,
        cogs: 0,
        orderIds: new Set<string>(),
        lastSoldAt: null,
      });
    }
    return prodStats.get(key)!;
  };

  products.forEach((p) => {
    if (filterCatId && getProdCatId(p) !== filterCatId) return;
    ensureProdStat(String(p._id), p.code, p.name, p.unit);
  });

  const dailyMap = new Map<
    string,
    {
      date: string;
      orders: number;
      unitsSold: number;
      grossRevenue: number;
      discountTotal: number;
      orderRevenue: number;
      returnImpact: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
      cashCollected: number;
    }
  >();

  const ensureDay = (d: string | Date) => {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        date: key,
        orders: 0,
        unitsSold: 0,
        grossRevenue: 0,
        discountTotal: 0,
        orderRevenue: 0,
        returnImpact: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashCollected: 0,
      });
    }
    return dailyMap.get(key)!;
  };

  if (fromDate && toDate && toDate.getTime() >= fromDate.getTime()) {
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000));
    if (diffDays <= 62) {
      const cur = new Date(fromDate);
      while (cur.getTime() <= toDate.getTime()) {
        ensureDay(cur);
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const hourlyMap = new Map<
    string,
    {
      hour: string;
      orders: number;
      unitsSold: number;
      grossRevenue: number;
      discountTotal: number;
      orderRevenue: number;
      returnImpact: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
      cashCollected: number;
    }
  >();

  for (let h = 0; h < 24; h++) {
    const key = `${String(h).padStart(2, "0")}:00`;
    hourlyMap.set(key, {
      hour: key,
      orders: 0,
      unitsSold: 0,
      grossRevenue: 0,
      discountTotal: 0,
      orderRevenue: 0,
      returnImpact: 0,
      netRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      cashCollected: 0,
    });
  }

  const ensureHour = (d: string | Date) => {
    const dt = new Date(d);
    const hh = String(dt.getHours()).padStart(2, "0");
    const key = `${hh}:00`;
    if (!hourlyMap.has(key)) {
      hourlyMap.set(key, {
        hour: key,
        orders: 0,
        unitsSold: 0,
        grossRevenue: 0,
        discountTotal: 0,
        orderRevenue: 0,
        returnImpact: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashCollected: 0,
      });
    }
    return hourlyMap.get(key)!;
  };

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

  const productOrderRevenue = orderRevenue;
  const productNetRevenue = productOrderRevenue - returnGoodsTotal + exchangeGoodsTotal;
  const productOrdersCount = filteredOrders.length;

  let serviceOrdersCount = 0;
  let activeServiceOrdersCount = 0;
  let completedServiceOrdersCount = 0;
  let cancelledServiceOrdersCount = 0;
  let totalServiceUnits = 0;
  let serviceGrossRevenue = 0;
  let serviceDiscountTotal = 0;
  let serviceRevenue = 0;
  let serviceCardFeeCollected = 0;
  let serviceCashCollected = 0;
  let servicePendingCollection = 0;
  const serviceTypeStatsMap = new Map<
    string,
    {
      serviceCode: string;
      serviceName: string;
      unit: string;
      quantity: number;
      revenue: number;
      orderIds: Set<string>;
    }
  >();

  if (!isProductOnlyCatFilter) {
    for (const so of serviceOrders) {
      const matchesServicePayFilter =
        !filterPayMethod || (filterPayMethod !== "DEBT" && so.paymentMethod === filterPayMethod);
      if (!matchesServicePayFilter) continue;

      const soItems = so.items || [];
      const calcRaw = soItems.reduce(
        (s, it) => s + Math.max(0, Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1),
        0
      );
      const calcItemDisc = soItems.reduce(
        (s, it) => s + Math.max(0, Number(it.discountAmount) || 0),
        0
      );
      const soGross = Math.max(0, Number(so.rawSubtotal ?? calcRaw) || 0);
      const soItemDisc = Math.max(0, Number(so.itemDiscountTotal ?? calcItemDisc) || 0);
      const soSub = Math.max(0, Number(so.subtotal ?? Math.max(0, soGross - soItemDisc)) || 0);
      const soBillDisc = Math.min(soSub, Math.max(0, Math.round(Number(so.billDiscountAmount) || 0)));
      const soAfterBill = Math.max(0, soSub - soBillDisc);
      const soCardFee = Math.max(0, Math.round(Number(so.cardFee) || 0));
      const soTotal = Math.max(0, Number(so.totalAmount) || soAfterBill + soCardFee);
      const soNetAmt = soAfterBill > 0 ? soAfterBill : Math.max(0, soTotal - soCardFee);
      const soUnits = soItems.reduce((s, it) => s + Math.max(0, Number(it.quantity) || 0), 0);

      if (inRange(so.createdAt)) {
        if (so.status === "CANCELLED") {
          cancelledServiceOrdersCount += 1;
        } else {
          serviceOrdersCount += 1;
          if (so.status === "RETURNED") {
            completedServiceOrdersCount += 1;
          } else {
            activeServiceOrdersCount += 1;
            servicePendingCollection += soNetAmt;
          }
          totalServiceUnits += soUnits;
          serviceGrossRevenue += soGross;
          serviceDiscountTotal += soItemDisc + soBillDisc;
          serviceRevenue += soAfterBill;
          serviceCardFeeCollected += soCardFee;

          grossRevenue += soGross;
          itemDiscountTotal += soItemDisc;
          billDiscountTotal += soBillDisc;
          orderRevenue += soAfterBill;
          cardFeeCollected += soCardFee;

          const day = ensureDay(so.createdAt);
          const hr = ensureHour(so.createdAt);
          day.orders += 1;
          day.grossRevenue += soGross;
          day.discountTotal += soItemDisc + soBillDisc;
          day.orderRevenue += soAfterBill;
          day.netRevenue += soAfterBill;
          day.grossProfit = day.netRevenue - day.cogs;

          hr.orders += 1;
          hr.grossRevenue += soGross;
          hr.discountTotal += soItemDisc + soBillDisc;
          hr.orderRevenue += soAfterBill;
          hr.netRevenue += soAfterBill;
          hr.grossProfit = hr.netRevenue - hr.cogs;

          const pm = paymentStats[so.paymentMethod] || paymentStats.CASH;
          pm.orders += 1;
          pm.revenue += soAfterBill;

          let allocatedSvcBillDisc = 0;
          for (let idx = 0; idx < soItems.length; idx++) {
            const it = soItems[idx];
            const lineTotal = Math.max(0, Number(it.lineTotal) || 0);
            let bShare = 0;
            if (soSub > 0 && soBillDisc > 0 && lineTotal > 0) {
              if (idx === soItems.length - 1) {
                bShare = Math.max(0, soBillDisc - allocatedSvcBillDisc);
              } else {
                bShare = Math.min(
                  Math.max(0, soBillDisc - allocatedSvcBillDisc),
                  Math.round((lineTotal / soSub) * soBillDisc)
                );
              }
              allocatedSvcBillDisc += bShare;
            }
            const netSvcLineRev = Math.max(0, lineTotal - bShare);
            const codeKey = String(it.serviceCode || it.serviceName || "SERVICE").toUpperCase();
            if (!serviceTypeStatsMap.has(codeKey)) {
              serviceTypeStatsMap.set(codeKey, {
                serviceCode: codeKey,
                serviceName: it.serviceName || codeKey,
                unit: it.unit || "Cây",
                quantity: 0,
                revenue: 0,
                orderIds: new Set<string>(),
              });
            }
            const stRow = serviceTypeStatsMap.get(codeKey)!;
            stRow.quantity += Math.max(0, Number(it.quantity) || 0);
            stRow.revenue += netSvcLineRev;
            stRow.orderIds.add(String(so._id));
          }
        }
      }

      if (so.status === "RETURNED") {
        const completedAt = so.returnedAt || so.updatedAt || so.createdAt;
        if (inRange(completedAt)) {
          const collectedAmt = soNetAmt;
          serviceCashCollected += collectedAmt;
          const cDay = ensureDay(completedAt);
          const cHr = ensureHour(completedAt);
          cDay.cashCollected += collectedAmt;
          cHr.cashCollected += collectedAmt;
        }
      }
    }
  }

  const byServiceType = Array.from(serviceTypeStatsMap.values())
    .map((st) => ({
      serviceCode: st.serviceCode,
      serviceName: st.serviceName,
      unit: st.unit,
      orderCount: st.orderIds.size,
      quantity: st.quantity,
      revenue: st.revenue,
      sharePercent:
        serviceRevenue > 0 ? Math.round((st.revenue / serviceRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const netRevenue = orderRevenue - returnGoodsTotal + exchangeGoodsTotal;
  const cardFeeNet = cardFeeCollected - cardFeeRefunded;
  const cardFeeTotal = cardFeeNet;
  const grossProfit = netRevenue - estimatedCogs;
  const grossMarginPercent =
    netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;
  const totalOrders = productOrdersCount + serviceOrdersCount;
  const paidOrders =
    filteredOrders.filter((o) => o.status === "PAID").length + completedServiceOrdersCount;
  const returnedOrders = filteredOrders.filter(
    (o) => o.status === "PARTIALLY_RETURNED" || o.status === "FULLY_RETURNED"
  ).length;
  const avgOrderValue = totalOrders > 0 ? Math.round(orderRevenue / totalOrders) : 0;

  let totalOutstandingDebt = 0;
  let totalInitialDebt = 0;
  let totalCollectedDebt = 0;
  let totalReducedByReturn = 0;
  let activeDebtOrdersCount = 0;
  let settledDebtOrdersCount = 0;
  let overdueDebtAmount = 0;
  let overdueOrdersCount = 0;
  let debtCollectedInPeriod = 0;

  const debtOrders: DebtOrderRow[] = [];
  const customerDebtMap = new Map<string, DebtCustomerSummary>();

  for (const o of orders) {
    if (o.status === "DRAFT") continue;
    const dm = extractClientOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);

    const matchesPaymentFilter =
      !filterPayMethod ||
      (filterPayMethod === "DEBT"
        ? dm.initialDebtAmount > 0 || dm.debtAmount > 0
        : o.paymentMethod === filterPayMethod);

    if (!filterCatId && matchesPaymentFilter) {
      for (const dp of dm.debtPayments) {
        if (inRange(dp.paidAt)) {
          const dpAmt = Math.max(0, Number(dp.amount) || 0);
          debtCollectedInPeriod += dpAmt;
          const dDay = ensureDay(dp.paidAt);
          const dHr = ensureHour(dp.paidAt);
          dDay.cashCollected += dpAmt;
          dHr.cashCollected += dpAmt;
        }
      }
    }

    if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) continue;

    totalOutstandingDebt += dm.debtAmount;
    totalInitialDebt += dm.initialDebtAmount;
    totalCollectedDebt += dm.collectedDebtAmount;
    totalReducedByReturn += dm.reducedByReturnAmount;

    if (dm.debtAmount > 0) {
      activeDebtOrdersCount += 1;
      if (dm.isOverdue) {
        overdueOrdersCount += 1;
        overdueDebtAmount += dm.debtAmount;
      }
    } else {
      settledDebtOrdersCount += 1;
    }

    const row: DebtOrderRow = {
      _id: String(o._id),
      orderCode: o.orderCode,
      customerName: o.customerName || "Khách hàng",
      customerPhone: o.customerPhone || "",
      paymentMethod: o.paymentMethod,
      paymentMethodDetail: o.paymentMethodDetail || "",
      totalAmount: dm.totalAmount,
      paidAmount: dm.paidAmount,
      debtAmount: dm.debtAmount,
      initialDebtAmount: dm.initialDebtAmount,
      collectedDebtAmount: dm.collectedDebtAmount,
      reducedByReturnAmount: dm.reducedByReturnAmount,
      debtStatus: dm.debtStatus,
      debtDueDate: dm.debtDueDate,
      isOverdue: dm.isOverdue,
      daysOverdue: dm.daysOverdue,
      debtPayments: dm.debtPayments,
      debtAdjustments: dm.debtAdjustments,
      createdByName: o.createdByName || "",
      confirmedByName: o.confirmedByName || o.createdByName || "",
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
      items: o.items || [],
      note: o.note || "",
    };
    debtOrders.push(row);

    const normPhone = String(o.customerPhone || "").replace(/\D/g, "") || o.customerPhone || o.customerName || String(o._id);
    if (!customerDebtMap.has(normPhone)) {
      customerDebtMap.set(normPhone, {
        phone: o.customerPhone || normPhone,
        customerName: o.customerName || "Khách hàng",
        totalOrders: 0,
        activeDebtOrders: 0,
        settledDebtOrders: 0,
        overdueOrders: 0,
        totalOrderAmount: 0,
        totalInitialDebt: 0,
        totalPaidAmount: 0,
        totalCollectedDebt: 0,
        totalReducedByReturn: 0,
        totalDebtAmount: 0,
        nearestDueDate: null,
        lastOrderAt: null,
        orders: [],
        paymentHistory: [],
        debtAdjustments: [],
      });
    }
    const cGroup = customerDebtMap.get(normPhone)!;
    if (o.customerName) cGroup.customerName = o.customerName;
    cGroup.totalOrders += 1;
    if (dm.debtAmount > 0) {
      cGroup.activeDebtOrders += 1;
      if (dm.isOverdue) cGroup.overdueOrders += 1;
      if (dm.debtDueDate) {
        if (
          !cGroup.nearestDueDate ||
          new Date(dm.debtDueDate).getTime() < new Date(cGroup.nearestDueDate).getTime()
        ) {
          cGroup.nearestDueDate = dm.debtDueDate;
        }
      }
    } else {
      cGroup.settledDebtOrders += 1;
    }
    cGroup.totalOrderAmount += dm.totalAmount;
    cGroup.totalInitialDebt += dm.initialDebtAmount;
    cGroup.totalPaidAmount += dm.paidAmount;
    cGroup.totalCollectedDebt = (cGroup.totalCollectedDebt || 0) + dm.collectedDebtAmount;
    cGroup.totalReducedByReturn = (cGroup.totalReducedByReturn || 0) + dm.reducedByReturnAmount;
    cGroup.totalDebtAmount += dm.debtAmount;
    if (
      !cGroup.lastOrderAt ||
      new Date(row.createdAt).getTime() > new Date(cGroup.lastOrderAt).getTime()
    ) {
      cGroup.lastOrderAt = row.createdAt;
    }
    cGroup.orders.push(row);

    for (const dp of dm.debtPayments) {
      cGroup.paymentHistory.push({
        _id: String(dp._id || `${o._id}_${dp.paidAt}`),
        orderId: String(o._id),
        orderCode: o.orderCode,
        amount: Number(dp.amount) || 0,
        method: dp.method || "BANKING",
        note: dp.note || "",
        paidAt: dp.paidAt ? new Date(dp.paidAt).toISOString() : row.createdAt,
        collectedByName: dp.collectedByName || "Quản Trị Viên",
      });
    }

    for (const da of dm.debtAdjustments) {
      cGroup.debtAdjustments = cGroup.debtAdjustments || [];
      cGroup.debtAdjustments.push({
        _id: String(da._id || `${o._id}_${da.returnCode}`),
        orderId: String(o._id),
        orderCode: o.orderCode,
        returnCode: da.returnCode || "",
        amount: Number(da.amount) || 0,
        debtBefore: Number(da.debtBefore) || 0,
        debtAfter: Number(da.debtAfter) || 0,
        at: da.at ? new Date(da.at).toISOString() : row.createdAt,
        byName: da.byName || "Nhân viên bán hàng",
      });
    }
  }

  const cashCollected = isProductOnlyCatFilter
    ? null
    : cashAtPurchase + serviceCashCollected + debtCollectedInPeriod - cashRefunded;
  const collectedRevenue = cashCollected ?? Math.max(0, netRevenue - outstandingDebtInPeriod);

  const debtCustomers = Array.from(customerDebtMap.values())
    .map((c) => ({
      ...c,
      paymentHistory: c.paymentHistory.sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      ),
    }))
    .sort((a, b) => {
      if (b.totalDebtAmount !== a.totalDebtAmount) return b.totalDebtAmount - a.totalDebtAmount;
      return b.totalInitialDebt - a.totalInitialDebt;
    });

  const activeDebtCustomersCount = debtCustomers.filter((c) => c.totalDebtAmount > 0).length;

  const byPaymentMethod = Object.values(paymentStats).map((pm) => ({
    ...pm,
    sharePercent: orderRevenue > 0 ? Math.round((pm.revenue / orderRevenue) * 1000) / 10 : 0,
  }));

  const catStatsMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      unitsSold: number;
      revenue: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
    }
  >();

  prodStats.forEach((st) => {
    const netUnits = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
    if (netUnits === 0 && st.revenue === 0 && st.cogs === 0) return;
    const key = st.categoryId || "UNCATEGORIZED";
    if (!catStatsMap.has(key)) {
      catStatsMap.set(key, {
        categoryId: key,
        categoryName: st.categoryName,
        unitsSold: 0,
        revenue: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }
    const cRow = catStatsMap.get(key)!;
    cRow.unitsSold += netUnits;
    cRow.revenue += st.revenue;
    cRow.netRevenue += st.revenue;
    cRow.cogs += st.cogs;
    cRow.grossProfit = cRow.revenue - cRow.cogs;
  });

  if (!isProductOnlyCatFilter && (serviceRevenue > 0 || totalServiceUnits > 0)) {
    catStatsMap.set("SERVICE", {
      categoryId: "SERVICE",
      categoryName: "Dịch vụ (Căng vợt / Sửa chữa)",
      unitsSold: totalServiceUnits,
      revenue: serviceRevenue,
      netRevenue: serviceRevenue,
      cogs: 0,
      grossProfit: serviceRevenue,
    });
  }

  const totalCatRev = Array.from(catStatsMap.values()).reduce((s, c) => s + c.revenue, 0);
  const byCategory = Array.from(catStatsMap.values())
    .map((c) => ({
      ...c,
      sharePercent: totalCatRev > 0 ? Math.round((c.revenue / totalCatRev) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const allProductRows: ProductSalesAnalysisRow[] = Array.from(prodStats.values()).map((st) => {
    const prod = prodById.get(st.productId) || prodByCode.get(st.productCode);
    const stockFloor1 = Number(prod?.stockFloor1 ?? prod?.stock ?? 0);
    const stockFloor2 = Number(prod?.stockFloor2 ?? 0);
    const stock = stockFloor1 + stockFloor2;
    const sellingPrice = Number(prod?.sellingPrice ?? 0);
    const costPrice = Number(prod?.costPrice ?? 0);
    const netSoldQty = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
    const profit = st.revenue - st.cogs;
    const marginPercent = st.revenue > 0 ? Math.round((profit / st.revenue) * 1000) / 10 : 0;
    const inventoryCostValue = stock * costPrice;
    const inventorySellValue = stock * sellingPrice;

    let restockAlert = "";
    if (netSoldQty > 0) {
      if (stock === 0) {
        restockAlert = "Hết hàng toàn kho — Cần nhập thêm gấp";
      } else if (stockFloor1 === 0 && stockFloor2 > 0) {
        restockAlert = `Hết hàng Tầng 1 (Tầng 2 còn ${stockFloor2}) — Cần xuất chuyển tầng xuống Tầng 1`;
      } else if (stockFloor1 <= 2 && stockFloor2 > 0) {
        restockAlert = `Tầng 1 sắp hết (còn ${stockFloor1}, Tầng 2 có ${stockFloor2}) — Nên dời thêm từ Tầng 2`;
      } else if (stock <= 3) {
        restockAlert = `Sắp hết hàng (Tổng tồn còn ${stock}) — Nên nhập bổ sung`;
      }
    }

    const pushReasons: string[] = [];
    let suggestedAction = "";
    let pushScore = 0;

    if (stock > 0) {
      if (sellingPrice <= 0) {
        pushReasons.push("Chưa đặt giá niêm yết (0 VND)");
        suggestedAction = "Cập nhật giá niêm yết trong Quản lý Kho để POS có thể bán";
        pushScore += 100;
      }
      if (stockFloor1 === 0 && stockFloor2 > 0) {
        pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${st.unit})`);
        if (!suggestedAction) {
          suggestedAction = "Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày";
        }
        pushScore += 80 + Math.min(40, stockFloor2 * 2);
      }
      if (netSoldQty === 0) {
        pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${st.unit})`);
        if (!suggestedAction) {
          suggestedAction =
            stock >= 10
              ? "Tồn kho cao chưa phát sinh đơn — Nên chạy khuyến mãi giảm giá % hoặc tặng kèm combo"
              : "Trưng bày nổi bật tại quầy Tầng 1 hoặc tư vấn ưu tiên cho khách";
        }
        pushScore += 50 + Math.min(50, stock * 3);
      } else if (stock >= netSoldQty * 5 && stock >= 6) {
        pushReasons.push(
          `Tồn kho cao gấp ${Math.round(stock / netSoldQty)} lần lượng bán (Tồn ${stock} / Bán ${netSoldQty})`
        );
        if (!suggestedAction) {
          suggestedAction = "Tốc độ tiêu thụ chậm so với lượng tồn — Nên giảm giá nhẹ hoặc đẩy mạnh giới thiệu";
        }
        pushScore += 30 + Math.min(40, stock * 2);
      }

      if (inventoryCostValue >= 3000000 && netSoldQty <= 1) {
        pushReasons.push(
          `Đọng vốn lớn (${Math.round((inventoryCostValue / 1000000) * 10) / 10}tr VND)`
        );
        pushScore += 35;
      }
    }

    return {
      productId: st.productId,
      productCode: st.productCode,
      productName: st.productName,
      categoryId: st.categoryId,
      categoryName: st.categoryName,
      unit: st.unit,
      soldQty: st.soldQty,
      giftQty: st.giftQty,
      returnedQty: st.returnedQty,
      netSoldQty,
      revenue: st.revenue,
      cogs: st.cogs,
      grossProfit: profit,
      marginPercent,
      orderCount: st.orderIds.size,
      lastSoldAt: st.lastSoldAt,
      sellingPrice,
      costPrice,
      stockFloor1,
      stockFloor2,
      stock,
      inventoryCostValue,
      inventorySellValue,
      restockAlert,
      pushScore,
      pushReasons,
      suggestedAction,
    };
  });

  const topSellingProducts = allProductRows
    .filter((r) => r.netSoldQty > 0 || r.soldQty > 0)
    .sort((a, b) => {
      if (b.netSoldQty !== a.netSoldQty) return b.netSoldQty - a.netSoldQty;
      return b.revenue - a.revenue;
    });

  const needsPushProducts = allProductRows
    .filter((r) => r.stock > 0 && r.pushScore > 0)
    .sort((a, b) => {
      if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
      if (b.inventoryCostValue !== a.inventoryCostValue)
        return b.inventoryCostValue - a.inventoryCostValue;
      return b.stock - a.stock;
    });

  if (!fromDate && !toDate) {
    const latestKey = Array.from(dailyMap.keys()).sort().pop();
    const anchor = latestKey ? parseLocalDateBound(latestKey, false) || new Date() : new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      ensureDay(d);
    }
  }

  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const hourlyTrend = Array.from(hourlyMap.values()).sort((a, b) =>
    a.hour.localeCompare(b.hour)
  );

  return {
    summary: {
      grossRevenue,
      itemDiscountTotal,
      billDiscountTotal,
      totalDiscount: itemDiscountTotal + billDiscountTotal,
      cardFeeCollected,
      cardFeeRefunded,
      cardFeeNet,
      cardFeeTotal,
      orderRevenue,
      productOrderRevenue,
      productNetRevenue,
      serviceGrossRevenue,
      serviceDiscountTotal,
      serviceRevenue,
      serviceCardFeeCollected,
      serviceCashCollected,
      servicePendingCollection,
      returnGoodsTotal,
      exchangeGoodsTotal,
      returnTotal,
      exchangeTotal,
      netReturnImpact,
      netReturnRefund: netReturnImpact,
      returnFromPriorPeriods,
      netRevenue,
      cashAtPurchase,
      cashRefunded,
      cashCollected,
      collectedRevenue,
      debtReducedByReturnInPeriod,
      outstandingDebt: outstandingDebtInPeriod,
      outstandingDebtInPeriod,
      initialDebtInPeriod,
      debtCollectedInPeriod,
      debtOrdersInPeriod,
      salesCogs,
      giftCogs,
      giftRetailValue,
      estimatedCogs,
      cogs: estimatedCogs,
      cogsEstimated,
      grossProfit,
      grossMarginPercent,
      totalOrders,
      productOrdersCount,
      serviceOrdersCount,
      activeServiceOrdersCount,
      completedServiceOrdersCount,
      cancelledServiceOrdersCount,
      paidOrders,
      returnedOrders,
      avgOrderValue,
      totalUnitsSold,
      totalServiceUnits,
      totalGiftUnits,
      totalUnitsReturned,
    },
    serviceStats: {
      summary: {
        totalServiceOrders: serviceOrdersCount,
        activeServiceOrders: activeServiceOrdersCount,
        completedServiceOrders: completedServiceOrdersCount,
        cancelledServiceOrders: cancelledServiceOrdersCount,
        totalServiceUnits,
        serviceGrossRevenue,
        serviceDiscountTotal,
        serviceRevenue,
        serviceCardFeeCollected,
        serviceCashCollected,
        servicePendingCollection,
      },
      byServiceType,
    },
    byPaymentMethod,
    byCategory,
    dailyTrend,
    hourlyTrend,
    topSellingProducts,
    needsPushProducts,
    debtManagement: {
      summary: {
        totalOutstandingDebt,
        totalInitialDebt,
        totalCollectedDebt,
        totalReducedByReturn,
        activeDebtOrdersCount,
        settledDebtOrdersCount,
        activeDebtCustomersCount,
        overdueDebtAmount,
        overdueOrdersCount,
        newDebtInPeriod: initialDebtInPeriod,
        collectedInPeriod: debtCollectedInPeriod,
        reducedByReturnInPeriod: debtReducedByReturnInPeriod,
      },
      customers: debtCustomers,
      orders: debtOrders,
    },
  };
}


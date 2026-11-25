import { parseLocalDateBound, extractClientOrderDebtMeta } from "./utils";
import { computeFallbackServiceStats } from "./fallbackServiceStats";
import { computeFallbackDebtStats } from "./fallbackDebtStats";
import { computeFallbackProductAndCategoryStats } from "./fallbackProductCategoryStats";
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


  const {
    serviceOrdersCount,
    activeServiceOrdersCount,
    completedServiceOrdersCount,
    cancelledServiceOrdersCount,
    totalServiceUnits,
    serviceGrossRevenue,
    serviceDiscountTotal,
    serviceRevenue,
    serviceCardFeeCollected,
    serviceCashCollected,
    servicePendingCollection,
    byServiceType,
    grossRevenueDelta,
    orderRevenueDelta,
    cardFeeCollectedDelta,
    cashAtPurchaseDelta,
    itemDiscountDelta,
    billDiscountDelta,
  } = computeFallbackServiceStats({
    serviceOrders,
    isProductOnlyCatFilter,
    filterPayMethod,
    inRange,
    ensureDay,
    ensureHour,
    paymentStats,
  });
  grossRevenue += grossRevenueDelta;
  orderRevenue += orderRevenueDelta;
  cardFeeCollected += cardFeeCollectedDelta;
  cashAtPurchase += cashAtPurchaseDelta;
  itemDiscountTotal += itemDiscountDelta;
  billDiscountTotal += billDiscountDelta;

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


  const {
    totalOutstandingDebt,
    totalInitialDebt,
    totalCollectedDebt,
    totalReducedByReturn,
    activeDebtOrdersCount,
    settledDebtOrdersCount,
    overdueDebtAmount,
    overdueOrdersCount,
    debtCollectedInPeriod,
    debtOrders,
    debtCustomers,
    activeDebtCustomersCount,
    cashCollected,
    collectedRevenue,
  } = computeFallbackDebtStats({
    orders,
    refundedCashByOrderId,
    filterPayMethod,
    filterCatId,
    inRange,
    ensureDay,
    ensureHour,
    isProductOnlyCatFilter,
    cashAtPurchase,
    serviceCashCollected,
    cashRefunded,
    netRevenue,
    outstandingDebtInPeriod,
  });

  const byPaymentMethod = Object.values(paymentStats).map((pm) => ({
    ...pm,
    sharePercent: orderRevenue > 0 ? Math.round((pm.revenue / orderRevenue) * 1000) / 10 : 0,
  }));

  const {
    byCategory,
    topSellingProducts,
    needsPushProducts,
  } = computeFallbackProductAndCategoryStats({
    products,
    prodById,
    prodByCode,
    prodStats,
    catMap,
    getProdCatId,
    isProductOnlyCatFilter,
    serviceRevenue,
    totalServiceUnits,
    fromDate,
    toDate,
    dailyMap,
    ensureDay,
  });

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


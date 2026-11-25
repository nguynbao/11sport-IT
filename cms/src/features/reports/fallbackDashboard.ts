import { parseLocalDateBound, extractClientOrderDebtMeta } from "./utils";
import { computeFallbackServiceStats } from "./fallbackServiceStats";
import { computeFallbackDebtStats } from "./fallbackDebtStats";
import { computeFallbackProductAndCategoryStats } from "./fallbackProductCategoryStats";
import { aggregateOrdersAndReturns } from "./fallbackOrderAggregation";
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

  let {
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
  } = aggregateOrdersAndReturns({
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
  });
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


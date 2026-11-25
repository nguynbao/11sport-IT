import type { ServiceOrder } from "@/shared/types";

export function computeFallbackServiceStats(deps: {
  serviceOrders: ServiceOrder[];
  isProductOnlyCatFilter: boolean;
  filterPayMethod: string;
  inRange: (d?: string | Date | null) => boolean;
  ensureDay: (d: string | Date) => any;
  ensureHour: (d: string | Date) => any;
  paymentStats: Record<string, { method: string; label: string; orders: number; revenue: number }>;
}) {
  const { serviceOrders, isProductOnlyCatFilter, filterPayMethod, inRange, ensureDay, ensureHour, paymentStats } = deps;
  let grossRevenue = 0;
  let orderRevenue = 0;
  let cardFeeCollected = 0;
  let cashAtPurchase = 0;
  let itemDiscountTotal = 0;
  let billDiscountTotal = 0;

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


  return {
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
    grossRevenueDelta: grossRevenue,
    orderRevenueDelta: orderRevenue,
    cardFeeCollectedDelta: cardFeeCollected,
    cashAtPurchaseDelta: cashAtPurchase,
    itemDiscountDelta: itemDiscountTotal,
    billDiscountDelta: billDiscountTotal,
  };
}

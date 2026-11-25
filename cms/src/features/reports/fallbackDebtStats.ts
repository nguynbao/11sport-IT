import { extractClientOrderDebtMeta } from "./utils";
import type { DebtCustomerSummary, DebtOrderRow, Order } from "@/shared/types";

export function computeFallbackDebtStats(deps: {
  orders: Order[];
  refundedCashByOrderId: Map<string, number>;
  filterPayMethod: string;
  filterCatId: string;
  inRange: (d?: string | Date | null) => boolean;
  ensureDay: (d: string | Date) => any;
  ensureHour: (d: string | Date) => any;
  isProductOnlyCatFilter: boolean;
  cashAtPurchase: number;
  serviceCashCollected: number;
  cashRefunded: number;
  netRevenue: number;
  outstandingDebtInPeriod: number;
}) {
  const {
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
  } = deps;

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


  return {
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
  };
}

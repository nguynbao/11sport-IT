import type { UserRole } from "./staff";
import type { DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, OrderItem } from "./orders";

export interface StaffActivitySummary {
  staffId: string;
  code: string;
  fullName: string;
  username: string;
  role: UserRole | "";
  status: "ACTIVE" | "LOCKED" | "";
  sales: { orders: number; revenue: number; units: number; returnsHandled: number; returnTotal: number };
  warehouse: {
    importsCreated: number;
    importsCompleted: number;
    unitsScanned: number;
    rowsChecked: number;
    unitsImported: number;
    adjustments: number;
    transfers?: number;
    unitsTransferred?: number;
  };
  lastActivityAt: string | null;
}

export interface SalesActivity {
  type: "ORDER" | "RETURN" | "EXCHANGE";
  at: string;
  staffId: string;
  staffName: string;
  referenceCode: string;
  customerName: string;
  amount: number;
  units: number;
  paymentMethod: string;
  status: string;
}

export interface WarehouseActivity {
  type:
    | "IMPORT_CREATED"
    | "IMPORT_CHECKED"
    | "IMPORT_COMPLETED"
    | "ADJUSTMENT"
    | "EXPORT_TRANSFER";
  at: string;
  staffId: string;
  staffName: string;
  referenceCode: string;
  quantity: number;
  rows?: number;
  detail: string;
}

export interface StaffActivityReport {
  staff: StaffActivitySummary[];
  sales: SalesActivity[];
  warehouse: WarehouseActivity[];
}

/* ---------------- Dashboard Doanh thu chi tiết & Phân tích Sản phẩm ---------------- */

export interface RevenueDashboardSummary {
  grossRevenue: number;
  itemDiscountTotal: number;
  billDiscountTotal: number;
  totalDiscount: number;
  cardFeeCollected?: number;
  cardFeeRefunded?: number;
  cardFeeNet?: number;
  cardFeeTotal: number;
  orderRevenue: number;
  productOrderRevenue?: number;
  productNetRevenue?: number;
  serviceGrossRevenue?: number;
  serviceDiscountTotal?: number;
  serviceRevenue?: number;
  serviceCardFeeCollected?: number;
  serviceCashCollected?: number;
  servicePendingCollection?: number;
  returnGoodsTotal?: number;
  exchangeGoodsTotal?: number;
  returnTotal: number;
  exchangeTotal: number;
  netReturnImpact: number;
  netReturnRefund?: number;
  returnFromPriorPeriods?: number;
  netRevenue: number;
  systemGrossRevenue?: number;
  actualRevenue?: number;
  deductionsTotal?: number;
  cashAtPurchase?: number;
  cashRefunded?: number;
  cashCollected?: number | null;
  collectedRevenue?: number;
  debtReducedByReturnInPeriod?: number;
  outstandingDebt?: number;
  outstandingDebtInPeriod?: number;
  initialDebtInPeriod?: number;
  debtCollectedInPeriod?: number;
  debtOrdersInPeriod?: number;
  salesCogs?: number;
  giftCogs?: number;
  giftRetailValue?: number;
  estimatedCogs: number;
  cogs?: number;
  cogsEstimated?: boolean;
  grossProfit: number;
  grossMarginPercent: number;
  totalOrders: number;
  productOrdersCount?: number;
  serviceOrdersCount?: number;
  activeServiceOrdersCount?: number;
  completedServiceOrdersCount?: number;
  cancelledServiceOrdersCount?: number;
  paidOrders: number;
  returnedOrders: number;
  avgOrderValue: number;
  totalUnitsSold: number;
  totalServiceUnits?: number;
  totalGiftUnits: number;
  totalUnitsReturned: number;
}

export interface RevenueByServiceType {
  serviceCode: string;
  serviceName: string;
  unit: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  sharePercent: number;
}

export interface ServiceStatsData {
  summary: {
    totalServiceOrders: number;
    activeServiceOrders: number;
    completedServiceOrders: number;
    cancelledServiceOrders: number;
    totalServiceUnits: number;
    serviceGrossRevenue: number;
    serviceDiscountTotal: number;
    serviceRevenue: number;
    serviceCardFeeCollected: number;
    serviceCashCollected: number;
    servicePendingCollection: number;
  };
  byServiceType: RevenueByServiceType[];
}

export interface RevenueByPaymentMethod {
  method: string;
  label: string;
  orders: number;
  revenue: number;
  sharePercent: number;
}

export interface RevenueByCategory {
  categoryId: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
  netRevenue?: number;
  cogs: number;
  grossProfit: number;
  sharePercent: number;
}

export interface DailyRevenueTrend {
  date: string;
  orders: number;
  unitsSold: number;
  grossRevenue: number;
  discountTotal: number;
  giftRetailValue?: number;
  orderRevenue: number;
  returnImpact: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  cashCollected?: number;
}

export interface ProductSalesAnalysisRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  soldQty: number;
  giftQty: number;
  returnedQty: number;
  netSoldQty: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
  lastSoldAt: string | null;
  sellingPrice: number;
  costPrice: number;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  inventoryCostValue: number;
  inventorySellValue: number;
  restockAlert: string;
  pushScore: number;
  pushReasons: string[];
  suggestedAction: string;
}

export interface HourlyRevenueTrend {
  hour: string;
  orders: number;
  unitsSold: number;
  grossRevenue: number;
  discountTotal: number;
  giftRetailValue?: number;
  orderRevenue: number;
  returnImpact: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  cashCollected?: number;
}

export interface DebtOrderRow {
  _id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  paymentMethodDetail: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  initialDebtAmount: number;
  collectedDebtAmount?: number;
  reducedByReturnAmount?: number;
  debtStatus: DebtStatus;
  debtDueDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  debtPayments: DebtPaymentRecord[];
  debtAdjustments?: DebtAdjustmentRecord[];
  createdByName: string;
  confirmedByName: string;
  createdAt: string;
  items: OrderItem[];
  note: string;
}

export interface DebtCustomerSummary {
  phone: string;
  customerName: string;
  totalOrders: number;
  activeDebtOrders: number;
  settledDebtOrders: number;
  overdueOrders: number;
  totalOrderAmount: number;
  totalInitialDebt: number;
  totalPaidAmount: number;
  totalCollectedDebt?: number;
  totalReducedByReturn?: number;
  totalDebtAmount: number;
  nearestDueDate: string | null;
  lastOrderAt: string | null;
  orders: DebtOrderRow[];
  paymentHistory: {
    _id: string;
    orderId: string;
    orderCode: string;
    amount: number;
    method: string;
    note: string;
    paidAt: string;
    collectedByName: string;
  }[];
  debtAdjustments?: {
    _id: string;
    orderId: string;
    orderCode: string;
    returnCode: string;
    amount: number;
    debtBefore: number;
    debtAfter: number;
    at: string;
    byName: string;
  }[];
}

export interface DebtManagementData {
  summary: {
    totalOutstandingDebt: number;
    totalInitialDebt: number;
    totalCollectedDebt: number;
    totalReducedByReturn?: number;
    activeDebtOrdersCount: number;
    settledDebtOrdersCount: number;
    activeDebtCustomersCount: number;
    overdueDebtAmount: number;
    overdueOrdersCount: number;
    newDebtInPeriod: number;
    collectedInPeriod: number;
    reducedByReturnInPeriod?: number;
  };
  customers: DebtCustomerSummary[];
  orders: DebtOrderRow[];
}

export interface RevenueDashboardData {
  summary: RevenueDashboardSummary;
  serviceStats?: ServiceStatsData;
  byPaymentMethod: RevenueByPaymentMethod[];
  byCategory: RevenueByCategory[];
  dailyTrend: DailyRevenueTrend[];
  hourlyTrend?: HourlyRevenueTrend[];
  topSellingProducts: ProductSalesAnalysisRow[];
  needsPushProducts: ProductSalesAnalysisRow[];
  debtManagement?: DebtManagementData;
}


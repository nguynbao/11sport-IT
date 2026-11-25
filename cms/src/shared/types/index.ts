export type UserRole = "CEO" | "ADMIN" | "ACCOUNTANT" | "HR" | "MARKETING" | "SALES";
export type Department = "OFFICE" | "SALES";
/** INTERN = Thực tập, PROBATION = Thử việc, FULLTIME = Chính thức (PARTTIME: giá trị cũ) */
export type ContractType = "INTERN" | "PROBATION" | "FULLTIME" | "PARTTIME";


export interface StaffUser {
  _id: string;
  code: string;
  username: string;
  fullName: string;
  phone?: string;
  email?: string;
  companyEmail?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  citizenId?: string;
  citizenIssueDate?: string;
  citizenIssuePlace?: string;
  address?: string;
  permanentAddress?: string;
  currentAddress?: string;
  school?: string;
  major?: string;
  positionTitle?: string;
  bankAccount?: string;
  role: UserRole;
  department?: Department;
  contractType?: ContractType;
  probationStartDate?: string;
  probationMonths?: number;
  fulltimeStartDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  internContractNumber?: string;
  probationContractNumber?: string;
  officialContractNumber?: string;
  contractFileUrl?: string;
  contractFileName?: string;
  bhxhStartDate?: string;
  bhxhEndDate?: string;
  recordedLeaveDays?: number;
  baseSalary?: number;
  allowance?: number;
  bonus?: number;
  insurance?: number;
  status: "ACTIVE" | "LOCKED";
  createdAt?: string;
}

export interface ParsedStaffImportRow {
  rowIndex: number;
  suggestedUsername: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  citizenId: string;
  citizenIssueDate: string;
  citizenIssuePlace: string;
  permanentAddress: string;
  currentAddress: string;
  school: string;
  major: string;
  positionTitle: string;
  role: Exclude<UserRole, "CEO" | "ADMIN">;
  department: Department;
  contractType: Exclude<ContractType, "PARTTIME">;
  contractStartDate: string;
  contractEndDate: string;
  internContractNumber: string;
  probationContractNumber: string;
  officialContractNumber: string;
  phone: string;
  email: string;
  companyEmail: string;
  bhxhStartDate: string;
  insurance: number;
  bhxhEndDate: string;
  baseSalary: number;
  allowance: number;
  bonus: number;
  recordedLeaveDays: number;
  bankAccount: string;
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  note?: string;
  isSystemVn?: boolean;
  isOfficialDayOff?: boolean;
  lunarDate?: string;
}

export interface LeaveRequest {
  _id: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  type: "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE" | "CHANGE_OFF";
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt?: string;
}

export interface ShiftAssignment {
  _id: string;
  weekStart: string;
  date: string;
  dayOfWeek: number;
  staffId: string;
  staffCode: string;
  staffName: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  preferenceShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  isOffRequested?: boolean;
  assignedBy: "AUTO" | "HR";
  confirmedAt?: string | null;
  seenByStaff?: boolean;
  notes?: string;
}

export interface AttendanceRecord {
  _id: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  date: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH";
  checkInTime: string;
  workStartTime: string;
  checkOutTime?: string;
  checkInType: "STANDARD" | "WFH";
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE" | "COMPLETED";
  lateMinutes: number;
  earlyMinutes: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  lunchPauseMinutes: number;
  totalWorkHours: number;
  notes?: string;
}

export interface Category {
  _id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
  /** Mã ngắn 1–3 ký tự A-Z0-9 dùng làm CateCode trong mã sản phẩm (v5.0) */
  skuCode?: string;
}

/** Thương hiệu (v5.0 — /brands) */
export interface Brand {
  _id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  aliases?: string[];
  categoryIds?: string[];
  isSystem?: boolean;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type WarehouseFloor = "FLOOR_1" | "FLOOR_2";

export interface ProductVariant {
  variantKey?: string;
  color: string;
  /** Danh sách 1 hoặc nhiều mã màu Hex hiển thị trực quan & viền box */
  colorHexes?: string[];
  size: string;
  /** Mã con riêng theo thuộc tính (Màu, Size): [Mã gốc][MÀU][SIZE] (VD: GASIA221401DO38) */
  variantCode?: string;
  barcode?: string;
  /** Mã màu ngắn 2–3 ký tự trong mã con (v5.0) */
  colorCode?: string;
  /** Giá bán riêng của biến thể (0/trống → dùng giá gốc) */
  sellingPrice?: number;
  /** Giá vốn riêng của biến thể (role SALES không nhận) */
  costPrice?: number;
  /** Giá bán hiệu lực do server tính sẵn */
  effectiveSellingPrice?: number;
  legacyVariantCode?: string;
  legacyVariantCodes?: string[];
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface LinkedRetailProductSummary {
  _id: string;
  code: string;
  name: string;
  unit: string;
  packSize: number;
  sellingPrice: number;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
}

export interface Product {
  _id: string;
  code: string;
  name: string;
  brand?: string;
  brandId?: string;
  brandCode?: string;
  brandName?: string;
  versionName?: string;
  versionCode?: string;
  /** Mã cũ trước chuẩn hoá — chỉ dùng tra cứu/quét tem cũ */
  legacyCode?: string;
  legacyCodes?: string[];
  modelName?: string;
  color?: string;
  colorHexes?: string[];
  size?: string;
  categoryId: string | Category;
  categoryCode?: string;
  categoryName?: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — cập nhật khi hoàn thành phiếu nhập kho */
  costPrice?: number;
  barcode?: string;
  variants?: ProductVariant[];
  stockFloor1?: number;
  stockFloor2?: number;
  stock: number;
  /** ID của Sản phẩm Bộ/Hộp/Ống gốc liên kết với sản phẩm lẻ này */
  parentSetProductId?: string;
  /** Số lượng đơn vị lẻ có trong 1 Bộ/Hộp gốc (VD: 12 quả/ống) */
  packSize?: number;
  parentSetProductCode?: string;
  parentSetProductName?: string;
  parentSetUnit?: string;
  parentSetStockFloor1?: number;
  parentSetStockFloor2?: number;
  maxUnpackableFloor1?: number;
  linkedRetailProducts?: LinkedRetailProductSummary[];
  /** Ghi chú sản phẩm */
  note?: string;
}

export interface StockMovement {
  _id: string;
  type: "IMPORT" | "SALE" | "RETURN" | "EXCHANGE_IN" | "EXCHANGE_OUT" | "ADJUSTMENT" | "TRANSFER";
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  quantityChange: number;
  balanceBefore?: number;
  balanceAfter: number;
  warehouseLocation?: WarehouseFloor;
  fromWarehouse?: WarehouseFloor;
  toWarehouse?: WarehouseFloor;
  currentStock?: number;
  costPrice?: number;
  sellingPrice?: number;
  referenceType?: string;
  referenceCode?: string;
  performedBy?: string;
  performedByName?: string;
  performedByRole?: string;
  note?: string;
  createdAt: string;
}

export interface InventoryReportRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryName?: string;
  unit: string;
  costPrice?: number;
  sellingPrice?: number;
  openingStock: number;
  importedQty: number;
  soldQty: number;
  adjustedAndReturnedQty: number;
  closingStock: number;
  stockFloor1?: number;
  stockFloor2?: number;
}

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT" | "GIFT";

export interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  unit: string;
  originalUnitPrice?: number;
  isGift?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  unitPrice: number;
  unitCost?: number;
  quantity: number;
  returnedQuantity?: number;
  lineTotal: number;
}

export type DebtStatus = "NONE" | "UNPAID" | "PARTIAL" | "SETTLED";

export interface SplitPaymentRecord {
  method: "CASH" | "BANKING" | "CARD" | "DEBT";
  amount: number;
}

export interface DebtPaymentRecord {
  _id?: string;
  amount: number;
  method: "CASH" | "BANKING" | "CARD";
  note?: string;
  paidAt: string;
  collectedBy?: string;
  collectedByName?: string;
}

export interface DebtAdjustmentRecord {
  _id?: string;
  type?: "RETURN" | string;
  returnId?: string;
  returnCode?: string;
  amount: number;
  debtBefore?: number;
  debtAfter?: number;
  reason?: string;
  note?: string;
  at?: string;
  adjustedAt?: string;
  by?: string;
  byName?: string;
  performedBy?: string;
  performedByName?: string;
}

export interface Order {
  _id: string;
  orderCode: string;
  code?: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANKING" | "CARD" | "OTHER";
  paymentMethodDetail?: string;
  splitPayments?: SplitPaymentRecord[];
  hasCardFee: boolean;
  cardFeePercent?: number;
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal: number;
  billDiscountType?: DiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  cardFee: number;
  totalAmount: number;
  paidAmount?: number;
  debtAmount?: number;
  initialDebtAmount?: number;
  debtStatus?: DebtStatus;
  debtDueDate?: string | null;
  debtPayments?: DebtPaymentRecord[];
  debtAdjustments?: DebtAdjustmentRecord[];
  note: string;
  status: "DRAFT" | "PAID" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";
  items: OrderItem[];
  soldBy?: string;
  soldByName?: string;
  createdBy?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  createdByName?: string;
  createdAt: string;
}

export type ServiceOrderStatus =
  | "RECEIVED"
  | "IN_PROGRESS"
  | "READY"
  | "RETURNED"
  | "CANCELLED";

export type ServicePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type ServicePaymentMethod = "CASH" | "BANKING" | "CARD";

export interface ServiceType {
  _id: string;
  code: string;
  name: string;
  defaultPrice: number;
  unit: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  orderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ServiceDiscountType = "NONE" | "PERCENT" | "AMOUNT";

export interface ServiceOrderItem {
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  discountType?: ServiceDiscountType;
  discountValue?: number;
  discountAmount?: number;
  lineTotal: number;
  itemNote?: string;
}

export interface ServicePaymentRecord {
  _id?: string;
  amount: number;
  method: ServicePaymentMethod;
  cardFee?: number;
  note?: string;
  paidAt: string;
  collectedBy?: string;
  collectedByName?: string;
}

export interface ServiceOrder {
  _id: string;
  orderCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  receivedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  items: ServiceOrderItem[];
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal?: number;
  billDiscountType?: ServiceDiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  hasCardFee?: boolean;
  cardFeePercent?: number;
  cardFee?: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: ServicePaymentMethod;
  payments?: ServicePaymentRecord[];
  status: ServiceOrderStatus;
  isOverdue?: boolean;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceOrdersMeta {
  totalOrders: number;
  receivedCount: number;
  inProgressCount: number;
  readyCount: number;
  returnedCount: number;
  cancelledCount?: number;
  overdueCount: number;
  unpaidCount: number;
  totalRevenue: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface ReturnReceipt {
  _id: string;
  returnCode: string;
  code?: string;
  orderId: string;
  orderCode: string;
  customerName?: string;
  customerPhone?: string;
  type: "RETURN" | "EXCHANGE";
  refundMethod: "CASH" | "BANKING" | "CARD";
  returnItems: any[];
  exchangeItems: any[];
  returnSubtotal?: number;
  refundedCardFee?: number;
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number;
  refundAmount?: number;
  additionalCharge?: number;
  debtBefore?: number;
  debtReduction?: number;
  cashRefund?: number;
  debtAfter?: number;
  note?: string;
  performedByName?: string;
  createdAt: string;
}

/* ---------------- Báo cáo hoạt động nhân viên (GET /reports/staff-activity) ---------------- */

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

export type PromotionConditionType = "BUY_PRODUCTS" | "BUY_CATEGORY" | "ALL_PRODUCTS";
export type PromotionDiscountType = "NONE" | "PERCENT" | "AMOUNT";
export type EffectivePromotionStatus =
  | "RUNNING_PERMANENT"
  | "RUNNING"
  | "UPCOMING"
  | "EXPIRED"
  | "PAUSED";

export interface PromotionConditionProduct {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  sellingPrice?: number;
  stockFloor1?: number;
}

export interface PromotionConditionCategory {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
}

export interface PromotionGiftItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  sellingPrice?: number;
  stockFloor1?: number;
}

export interface Promotion {
  _id: string;
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "PAUSED";
  isPermanent: boolean;
  startDate?: string | null;
  endDate?: string | null;
  conditionType: PromotionConditionType;
  conditionProductIds: string[];
  conditionProducts: PromotionConditionProduct[];
  conditionCategoryIds: string[];
  conditionCategories: PromotionConditionCategory[];
  minQuantity: number;
  minOrderAmount: number;
  giftItems: PromotionGiftItem[];
  multiplyGiftByConditionQty: boolean;
  itemDiscountType: PromotionDiscountType;
  itemDiscountValue: number;
  billDiscountType: PromotionDiscountType;
  billDiscountValue: number;
  isCurrentlyActive?: boolean;
  effectiveStatus?: EffectivePromotionStatus;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}


/**
 * Tính chính xác số lượng module (dots ở 1x) của chuỗi khi mã hóa Code 128 Auto (B + C).
 */

export interface StaffMonthlyOffStats {
  limit: number;
  primaryMonth: string;
  usedTotal: number;
  usedOutsideWeek: number;
  remainingForWeek: number;
  byMonth?: Record<
    string,
    {
      limit: number;
      usedTotal: number;
      usedOutsideWeek: number;
      remainingForWeek: number;
    }
  >;
}

export interface StaffPaidLeaveStats {
  eligible: boolean;
  entitledInMonth: number;
  remainingAfterMonth: number;
  paidLeaveDatesInWeek: string[];
  formalLeaveDatesInWeek: string[];
}

export interface StaffOffRequestItem {
  date: string;
  type: string;
  status: string;
  reason: string;
}


export interface AttendanceConfig {
  _id?: string;
  key?: string;
  officeName: string;
  office2Name?: string;
  officeLat?: number;
  officeLng?: number;
  maxDistanceMeters?: number;
  allowedIps: string[];
  allowedIps2?: string[];
  office1Domain?: string;
  office2Domain?: string;
  requireGps?: boolean;
  requireIp: boolean;
  branches?: Array<{
    id: number;
    name: string;
    allowedIps: string[];
    domain?: string;
  }>;
  updatedBy?: string;
  updatedAt?: string;
}


export type TimesheetCellCode =
  | "ON_TIME"
  | "LATE"
  | "EARLY"
  | "LATE_EARLY"
  | "WFH"
  | "WORKING"
  | "MISSING_OUT"
  | "LEAVE"
  | "PAID_LEAVE"
  | "ABSENT"
  | "HOLIDAY"
  | "DAY_OFF"
  | "UNSCHEDULED"
  | "FUTURE";

export interface TimesheetCell {
  code: TimesheetCellCode;
  attendanceId?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hours?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  overtimeMinutes?: number;
  checkInType?: "STANDARD" | "WFH";
  isHolidayWork?: boolean;
  /** Ngày lễ chính thức được nghỉ hưởng nguyên lương (tính 1 công) */
  isPaidHoliday?: boolean;
  adjusted?: boolean;
  adjustedByName?: string;
  adjustReason?: string;
  note?: string;
  leaveRequests?: {
    id: string;
    type: string;
    status: string;
    reason?: string;
    reviewNote?: string;
  }[];
}

export interface TimesheetSummary {
  standardDays: number;
  workUnits: number;
  totalHours: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  missingCheckout: number;
  absentDays: number;
  leaveDays: number;
  wfhDays: number;
  holidayWorkDays: number;
  /** Giờ đi làm vào ngày lễ chính thức (trả lương làm thêm >= 300%) */
  holidayWorkHours: number;
  /** Số ngày lễ chính thức được nghỉ hưởng nguyên lương (tính công) */
  holidayPaidDays: number;
  /** Tổng công tính lương = công đi làm + công lễ hưởng lương + phép có lương */
  paidUnits: number;
  overtimeDays?: number;
  overtimeMinutes?: number;
  pendingRequests?: number;
  /** Quỹ ngày nghỉ phép có lương tích lũy đến tháng đang xem */
  paidLeaveEntitled?: number;
  paidLeaveFromProbation?: number;
  paidLeaveTotalEarned?: number;
  paidLeaveUsedTotal?: number;
  paidLeaveUsed?: number;
  paidLeaveRemaining?: number;
  paidLeaveForfeited?: number;
  /** Khối SALES: tối đa 4 ngày nghỉ không lương/tháng */
  salesOffEntitled?: number;
  salesOffUsed?: number;
  salesOffRemaining?: number;
}

export interface TimesheetRow {
  staffId: string;
  staffCode: string;
  staffName: string;
  department: Department;
  role: UserRole;
  contractType?: ContractType;
  standardHours: number;
  cells: Record<string, TimesheetCell>;
  summary: TimesheetSummary;
}

export interface TimesheetDay {
  date: string;
  day: number;
  weekday: number;
  isToday: boolean;
  holiday: { name: string; isOfficialDayOff: boolean } | null;
}

export interface TimesheetMonthMeta {
  daysInMonth: number;
  isLeapYear: boolean;
  sundaysCount: number;
  standardDays: number;
  officialHolidaysCount: number;
  officePaidHolidaysCount: number;
}

export interface TimesheetData {
  month: number;
  year: number;
  days: TimesheetDay[];
  rows: TimesheetRow[];
  monthMeta?: TimesheetMonthMeta;
  overview: {
    totalStaff: number;
    workingNow: number;
    checkedInToday: number;
    lateToday: number;
    notCheckedInToday: number;
    missingCheckoutMonth: number;
    absentMonth: number;
  };
}


export interface ShiftChange {
  staffId: string;
  date: string;
  dayOfWeek?: number;
  /** null = xoá phân ca của nhân viên ngày đó */
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
}

export interface ShiftOffOverride {
  staffId: string;
  staffName: string;
  date: string;
  shiftCode: string;
  leaveType: string;
  leaveStatus: string;
}


export interface ShiftHandoverDiscrepancy {
  productCode: string;
  productName?: string;
  categoryName?: string;
  expected: number;
  actual: number;
  note?: string;
}

export interface ShiftHandoverCategoryCount {
  categoryId?: string;
  categoryName: string;
  expectedTotalQty: number;
  actualTotalQty: number;
  note?: string;
}

export interface ShiftHandoverRecord {
  _id: string;
  date: string;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH";
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  cashBalance: number;
  checkedCategories?: string[];
  totalCheckedProducts?: number;
  categoryCounts?: ShiftHandoverCategoryCount[];
  discrepancies: ShiftHandoverDiscrepancy[];
  status: "DRAFT" | "PENDING" | "ACCEPTED" | "DISCREPANCY_REPORTED" | "STORE_CLOSED";
  notes?: string;
  confirmNote?: string;
  submittedAt?: string;
  lateCheckoutReason?: string;
  lateCheckoutMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyHandoverCategorySummary {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  isPrimaryCategory: boolean;
  productCount: number;
  expectedTotalQty: number;
  unit: string;
}

export interface DailyHandoverCheckData {
  date: string;
  weekday?: number;
  primaryCategory: { _id: string; name: string; slug: string } | null;
  companionCategory: { _id: string; name: string; slug: string } | null;
  checkedCategories: string[];
  checkedCategoryLabel: string;
  totalCheckedProducts: number;
  totalExpectedQty?: number;
  categorySummaries?: DailyHandoverCategorySummary[];
  weeklySchedule?: Record<string, string[]>;
  products: Array<{
    _id: string;
    code: string;
    name: string;
    unit: string;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    isPrimaryCategory: boolean;
    stockQtyFloor1: number;
  }>;
}

export interface HandoverScheduleConfigData {
  weeklySchedule: Record<string, string[]>;
  primaryCategory: any;
  availableCategories: Array<{
    _id: string;
    code?: string;
    name: string;
    slug?: string;
    productCount?: number;
    expectedTotalQty?: number;
    isPrimary?: boolean;
  }>;
}


export type MyCalendarCellCode = TimesheetCellCode;
export type LeaveRequestType = "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE" | "CHANGE_OFF";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyCalendarLeave {
  id: string;
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  reason?: string;
  reviewNote?: string;
}

export interface MyCalendarCell {
  code: MyCalendarCellCode;
  attendanceId?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH" | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hours?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  lateCheckoutMinutes?: number;
  lateCheckoutReason?: string;
  overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  overtimeApprovedMinutes?: number;
  overtimeMinutes?: number;
  isHolidayWork?: boolean;
  isPaidHoliday?: boolean;
  adjusted?: boolean;
  adjustReason?: string;
  earlyApproved?: boolean;
  lateApproved?: boolean;
  leaveRequests?: MyCalendarLeave[];
  note?: string;
}

export type MyCalendarSummary = TimesheetSummary;
export type MyCalendarDay = TimesheetDay;

export interface MyCalendarData {
  month: number;
  year: number;
  days: MyCalendarDay[];
  row: {
    staffId: string;
    staffCode: string;
    staffName: string;
    department: "OFFICE" | "SALES";
    role: UserRole;
    contractType?: ContractType;
    standardHours: number;
    cells: Record<string, MyCalendarCell>;
    summary: MyCalendarSummary;
  } | null;
  rules: {
    shifts: Record<string, string>;
    lateToleranceMinutes: number;
    overtimeMinMinutes: number;
    holidayWorkPayMultiplier?: number;
  };
}

export interface MyLeaveRequest {
  _id: string;
  staffId: string;
  staffCode?: string;
  staffName?: string;
  department?: string;
  type: LeaveRequestType;
  date: string;
  fromDate?: string;
  sourceLeaveId?: string;
  sourceOffType?: "OFF" | "PAID_LEAVE";
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}


export interface PreviewCodeVariant {
  color: string;
  colorCode?: string;
  size: string;
  sizeCode?: string;
  variantCode?: string;
}

export interface PreviewCodeResult {
  categoryCode: string;
  brandCode: string;
  versionCode: string;
  suggestedVersionCode: string;
  code: string;
  variants: PreviewCodeVariant[];
  duplicate: { _id: string; code: string; name: string; versionName?: string } | null;
  conflicts: { type: string; code: string; productId: string; productCode: string }[];
}

export interface ProductLookupResult {
  product: Product;
  variant: ProductVariant | null;
  matchedBy: "CODE" | "VARIANT_CODE" | "LEGACY_CODE" | "LEGACY_VARIANT_CODE" | "COMPACT_BARCODE";
  sellingPrice: number;
}


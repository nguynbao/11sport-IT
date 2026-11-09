const RENDER_API_BASE_URL = "https://one1sport-it.onrender.com/api/v1";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || RENDER_API_BASE_URL;

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") return ENV_API_BASE_URL;
  const host = window.location.hostname;
  const isEnvLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(ENV_API_BASE_URL);
  if (!isEnvLocal) return ENV_API_BASE_URL;

  if (host === "localhost" || host === "127.0.0.1") {
    return ENV_API_BASE_URL;
  }
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return ENV_API_BASE_URL.replace(/localhost|127\.0\.0\.1/i, host);
  }
  return RENDER_API_BASE_URL;
}

export type UserRole = "SALES" | "WAREHOUSE" | "ADMIN" | "HR" | "ACCOUNTANT" | "MARKETING";
export type Department = "OFFICE" | "SALES";
/** INTERN = Thực tập, PROBATION = Thử việc, FULLTIME = Chính thức (PARTTIME: giá trị cũ) */
export type ContractType = "INTERN" | "PROBATION" | "FULLTIME" | "PARTTIME";

export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string; desc: string }[] = [
  { value: "INTERN", label: "Thực tập (Intern)", desc: "Không có ngày phép có lương" },
  { value: "PROBATION", label: "Thử việc", desc: "Không có ngày phép có lương" },
  { value: "FULLTIME", label: "Chính thức", desc: "1 ngày nghỉ phép có lương/tháng" },
];

export function contractTypeLabel(t?: string | null): string {
  if (t === "FULLTIME") return "Chính thức";
  if (t === "PROBATION") return "Thử việc";
  if (t === "INTERN") return "Thực tập";
  if (t === "PARTTIME") return "Bán thời gian (cũ)";
  return "Chưa cập nhật";
}

export interface StaffUser {
  _id: string;
  code: string;
  username: string;
  fullName: string;
  phone?: string;
  email?: string;
  citizenId?: string;
  address?: string;
  role: UserRole;
  department?: Department;
  contractType?: ContractType;
  contractStartDate?: string;
  contractEndDate?: string;
  contractFileUrl?: string;
  contractFileName?: string;
  status: "ACTIVE" | "LOCKED";
  createdAt?: string;
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
  type: "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE";
  date: string;
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
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number;
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
  cardFeeTotal: number;
  orderRevenue: number;
  returnTotal: number;
  exchangeTotal: number;
  netReturnImpact: number;
  netRevenue: number;
  collectedRevenue?: number;
  outstandingDebtInPeriod?: number;
  initialDebtInPeriod?: number;
  debtCollectedInPeriod?: number;
  debtOrdersInPeriod?: number;
  estimatedCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalOrders: number;
  paidOrders: number;
  returnedOrders: number;
  avgOrderValue: number;
  totalUnitsSold: number;
  totalGiftUnits: number;
  totalUnitsReturned: number;
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
  orderRevenue: number;
  returnImpact: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
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
  orderRevenue: number;
  returnImpact: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
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
  debtStatus: DebtStatus;
  debtDueDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  debtPayments: DebtPaymentRecord[];
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
}

export interface DebtManagementData {
  summary: {
    totalOutstandingDebt: number;
    totalInitialDebt: number;
    totalCollectedDebt: number;
    activeDebtOrdersCount: number;
    settledDebtOrdersCount: number;
    activeDebtCustomersCount: number;
    overdueDebtAmount: number;
    overdueOrdersCount: number;
    newDebtInPeriod: number;
    collectedInPeriod: number;
  };
  customers: DebtCustomerSummary[];
  orders: DebtOrderRow[];
}

export interface RevenueDashboardData {
  summary: RevenueDashboardSummary;
  byPaymentMethod: RevenueByPaymentMethod[];
  byCategory: RevenueByCategory[];
  dailyTrend: DailyRevenueTrend[];
  hourlyTrend?: HourlyRevenueTrend[];
  topSellingProducts: ProductSalesAnalysisRow[];
  needsPushProducts: ProductSalesAnalysisRow[];
  debtManagement?: DebtManagementData;
}

const KNOWN_BRANDS_FE: { pattern: RegExp; code: string; display: string }[] = [
  { pattern: /\b(under\s*armour|underarmour)\b/i, code: "UNDERARMOUR", display: "Under Armour" },
  { pattern: /\b(new\s*balance|newbalance)\b/i, code: "NEWBALANCE", display: "New Balance" },
  { pattern: /\b(thuong\s*dinh|thượng\s*đình|thuongdinh)\b/i, code: "THUONGDINH", display: "Thượng Đình" },
  { pattern: /\b(dong\s*luc|động\s*lực|dongluc)\b/i, code: "DONGLUC", display: "Động Lực" },
  { pattern: /\b(pickleballo)\b/i, code: "PICKLEBALLO", display: "Pickleballo" },
  { pattern: /\b(paddletek)\b/i, code: "PADDLETEK", display: "Paddletek" },
  { pattern: /\b(jogabola|jogarbola)\b/i, code: "JOGABOLA", display: "Jogabola" },
  { pattern: /\b(kaitashi)\b/i, code: "KAITASHI", display: "Kaitashi" },
  { pattern: /\b(kawasaki)\b/i, code: "KAWASAKI", display: "Kawasaki" },
  { pattern: /\b(franklin)\b/i, code: "FRANKLIN", display: "Franklin" },
  { pattern: /\b(decathlon)\b/i, code: "DECATHLON", display: "Decathlon" },
  { pattern: /\b(uhlsport)\b/i, code: "UHLSPORT", display: "Uhlsport" },
  { pattern: /\b(converse)\b/i, code: "CONVERSE", display: "Converse" },
  { pattern: /\b(spalding)\b/i, code: "SPALDING", display: "Spalding" },
  { pattern: /\b(six\s*zero|sixzero)\b/i, code: "SIXZERO", display: "Six Zero" },
  { pattern: /\b(goodfit)\b/i, code: "GOODFIT", display: "Goodfit" },
  { pattern: /\b(facolos)\b/i, code: "FACOLOS", display: "Facolos" },
  { pattern: /\b(selkirk)\b/i, code: "SELKIRK", display: "Selkirk" },
  { pattern: /\b(thunder)\b/i, code: "THUNDER", display: "Thunder" },
  { pattern: /\b(babolat)\b/i, code: "BABOLAT", display: "Babolat" },
  { pattern: /\b(gearbox)\b/i, code: "GEARBOX", display: "Gearbox" },
  { pattern: /\b(passion)\b/i, code: "PASSION", display: "Passion" },
  { pattern: /\b(artengo)\b/i, code: "ARTENGO", display: "Artengo" },
  { pattern: /\b(kalenji)\b/i, code: "KALENJI", display: "Kalenji" },
  { pattern: /\b(diadora)\b/i, code: "DIADORA", display: "Diadora" },
  { pattern: /\b(kamito)\b/i, code: "KAMITO", display: "Kamito" },
  { pattern: /\b(mizuno)\b/i, code: "MIZUNO", display: "Mizuno" },
  { pattern: /\b(zocker)\b/i, code: "ZOCKER", display: "Zocker" },
  { pattern: /\b(promax)\b/i, code: "PROMAX", display: "Promax" },
  { pattern: /\b(dalton)\b/i, code: "DALTON", display: "Dalton" },
  { pattern: /\b(ligpro)\b/i, code: "LIGPRO", display: "Ligpro" },
  { pattern: /\b(lippro)\b/i, code: "LIPPRO", display: "Lippro" },
  { pattern: /\b(soxter)\b/i, code: "SOXTER", display: "Soxter" },
  { pattern: /\b(li[\s\-]*ning|lining)\b/i, code: "LINING", display: "Lining" },
  { pattern: /\b(victor)\b/i, code: "VICTOR", display: "Victor" },
  { pattern: /\b(adidas)\b/i, code: "ADIDAS", display: "Adidas" },
  { pattern: /\b(wilson)\b/i, code: "WILSON", display: "Wilson" },
  { pattern: /\b(prince)\b/i, code: "PRINCE", display: "Prince" },
  { pattern: /\b(kumpoo)\b/i, code: "KUMPOO", display: "Kumpoo" },
  { pattern: /\b(proace)\b/i, code: "PROACE", display: "Proace" },
  { pattern: /\b(venson)\b/i, code: "VENSON", display: "Venson" },
  { pattern: /\b(molten)\b/i, code: "MOLTEN", display: "Molten" },
  { pattern: /\b(mikasa)\b/i, code: "MIKASA", display: "Mikasa" },
  { pattern: /\b(kipsta)\b/i, code: "KIPSTA", display: "Kipsta" },
  { pattern: /\b(speedo)\b/i, code: "SPEEDO", display: "Speedo" },
  { pattern: /\b(garmin)\b/i, code: "GARMIN", display: "Garmin" },
  { pattern: /\b(reusch)\b/i, code: "REUSCH", display: "Reusch" },
  { pattern: /\b(select)\b/i, code: "SELECT", display: "Select" },
  { pattern: /\b(beyono)\b/i, code: "BEYONO", display: "Beyono" },
  { pattern: /\b(bulbal)\b/i, code: "BULBAL", display: "Bulbal" },
  { pattern: /\b(reebok)\b/i, code: "REEBOK", display: "Reebok" },
  { pattern: /\b(pikdy)\b/i, code: "PIKDY", display: "Pikdy" },
  { pattern: /\b(sypik)\b/i, code: "SYPIK", display: "Sypik" },
  { pattern: /\b(joola)\b/i, code: "JOOLA", display: "Joola" },
  { pattern: /\b(asics)\b/i, code: "ASICS", display: "Asics" },
  { pattern: /\b(lotto)\b/i, code: "LOTTO", display: "Lotto" },
  { pattern: /\b(picko)\b/i, code: "PICKO", display: "Picko" },
  { pattern: /\b(yonex)\b/i, code: "YONEX", display: "Yonex" },
  { pattern: /\b(fleet)\b/i, code: "FLEET", display: "Fleet" },
  { pattern: /\b(apacs)\b/i, code: "APACS", display: "Apacs" },
  { pattern: /\b(felet)\b/i, code: "FELET", display: "Felet" },
  { pattern: /\b(arena)\b/i, code: "ARENA", display: "Arena" },
  { pattern: /\b(kelme)\b/i, code: "KELME", display: "Kelme" },
  { pattern: /\b(umbro)\b/i, code: "UMBRO", display: "Umbro" },
  { pattern: /\b(kappa)\b/i, code: "KAPPA", display: "Kappa" },
  { pattern: /\b(mitre)\b/i, code: "MITRE", display: "Mitre" },
  { pattern: /\b(bitis|biti's)\b/i, code: "BITIS", display: "Bitis" },
  { pattern: /\b(asia)\b/i, code: "ASIA", display: "Asia" },
  { pattern: /\b(wika)\b/i, code: "WIKA", display: "Wika" },
  { pattern: /\b(pili)\b/i, code: "PILI", display: "Pili" },
  { pattern: /\b(crbn)\b/i, code: "CRBN", display: "CRBN" },
  { pattern: /\b(wiro)\b/i, code: "WIRO", display: "Wiro" },
  { pattern: /\b(nike)\b/i, code: "NIKE", display: "Nike" },
  { pattern: /\b(puma)\b/i, code: "PUMA", display: "Puma" },
  { pattern: /\b(head)\b/i, code: "HEAD", display: "Head" },
  { pattern: /\b(mira)\b/i, code: "MIRA", display: "Mira" },
  { pattern: /\b(egan)\b/i, code: "EGAN", display: "Egan" },
  { pattern: /\b(joma)\b/i, code: "JOMA", display: "Joma" },
  { pattern: /\b(vans)\b/i, code: "VANS", display: "Vans" },
  { pattern: /\b(fila)\b/i, code: "FILA", display: "Fila" },
  { pattern: /\b(anta)\b/i, code: "ANTA", display: "Anta" },
  { pattern: /\b(peak)\b/i, code: "PEAK", display: "Peak" },
  { pattern: /\b(xtep)\b/i, code: "XTEP", display: "Xtep" },
  { pattern: /\b(rpm)\b/i, code: "RPM", display: "RPM" },
  { pattern: /\b(vnb)\b/i, code: "VNB", display: "VNB" },
];

const NO_BRAND_TOKENS_FE = new Set([
  "",
  "NN",
  "NONAME",
  "NO",
  "NONE",
  "NA",
  "KHONGHANG",
  "KHONG",
  "KHONGCO",
  "KHAC",
  "OEM",
  "11SPORT",
]);

function toCompactUpperFE(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function isStandardSixDigitProductCode(code?: string): boolean {
  const clean = toCompactUpperFE(String(code || ""));
  return /^[A-Z]{2,}[0-9]{6}$/.test(clean);
}

function buildCompactColorTokenFE(rawColor: string, maxColorLen: number): string {
  const words = String(rawColor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const filteredWords = words.length > 1 && words[0] === "MAU" ? words.slice(1) : words;
  const fullColor = filteredWords.join("");
  if (!fullColor || fullColor.length <= maxColorLen) return fullColor;

  const digits = filteredWords.filter((w) => /^\d+$/.test(w)).join("");
  const alphaWords = filteredWords.filter((w) => !/^\d+$/.test(w));
  if (alphaWords.length === 0) {
    return fullColor.slice(0, maxColorLen);
  }
  if (alphaWords.length === 1) {
    const take = Math.max(2, maxColorLen - digits.length);
    return alphaWords[0].slice(0, take) + digits;
  }

  const budget = Math.max(4, maxColorLen - digits.length);
  const firstWord = alphaWords[0];
  const lastWord = alphaWords[alphaWords.length - 1];
  const midInitials =
    alphaWords.length > 2
      ? alphaWords
          .slice(1, -1)
          .map((w) => w[0])
          .join("")
      : "";
  const firstPart = firstWord.slice(0, Math.min(2, firstWord.length));
  const remForLast = Math.max(1, budget - firstPart.length - midInitials.length);
  const lastPart = lastWord.slice(0, Math.min(lastWord.length, Math.max(2, remForLast)));
  const combined = (firstPart + midInitials + lastPart).slice(0, budget);
  return combined + digits;
}

/**
 * Sinh Mã con riêng cho từng thuộc tính biến thể (Màu, Size) từ Mã gốc.
 * Công thức: [Mã gốc IN HOA][MÀU BỎ DẤU IN HOA][SIZE IN HOA]
 * Ví dụ: GASIA221401 + Đỏ + 38 -> GASIA221401DO38
 * Tự động rút gọn phần Màu nếu tổng chiều dài > 19 ký tự để vừa khít tem nhiệt 35×20mm (203 DPI).
 */
export function generateVariantProductCode(
  baseCode?: string,
  color?: string,
  size?: string
): string {
  const root = toCompactUpperFE(String(baseCode || ""));
  if (!root) return "";
  const rawColorStr = String(color || "");
  const cleanColor = toCompactUpperFE(rawColorStr);
  const cleanSize = toCompactUpperFE(String(size || ""));
  if (!cleanColor && !cleanSize) return root;
  const fullSuffix = `${cleanColor}${cleanSize}`;
  if (fullSuffix && root.endsWith(fullSuffix) && root.length <= 22) return root;
  const rootBase =
    fullSuffix && root.endsWith(fullSuffix) && root.length > fullSuffix.length
      ? root.slice(0, root.length - fullSuffix.length)
      : root;

  const fullCode = `${rootBase}${fullSuffix}`;
  if (fullCode.length <= 22) return fullCode;

  const maxColorLen = Math.max(4, 20 - rootBase.length - cleanSize.length);
  const shortColor = buildCompactColorTokenFE(rawColorStr, maxColorLen);
  const shortSuffix = `${shortColor}${cleanSize}`;
  if (shortSuffix && rootBase.endsWith(shortSuffix)) return rootBase;
  return `${rootBase}${shortSuffix}`;
}

export function generateSixDigitsFromSeed(seed?: string): string {
  const clean = toCompactUpperFE(String(seed || ""));
  if (!clean) {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = 100000 + (Math.abs(hash) % 900000);
  return String(num).padStart(6, "0");
}

export function resolveCategoryInitial(
  baseName: string,
  categoryCode?: string,
  categoryName?: string
): string {
  const trimmedName = String(baseName || "").trim();

  if (/^(giày|giay)\b/i.test(trimmedName)) return "G";
  if (/^(áo|ao)\b/i.test(trimmedName)) return "A";
  if (/^(quần|quan)\b/i.test(trimmedName) && !/^(quấn\s*cán|quan\s*can)/i.test(trimmedName)) {
    return "Q";
  }
  if (/^(vợt|vot|váy|vay)\b/i.test(trimmedName)) return "V";
  if (/^(bóng|bong)\b/i.test(trimmedName)) return "B";
  if (/^(phụ\s*kiện|phu\s*kien)\b/i.test(trimmedName)) return "P";

  const normCatName = toCompactUpperFE(categoryName || "").replace(/[^A-Z]/g, "");
  if (normCatName.length > 0) return normCatName.charAt(0);

  const normCatCode = toCompactUpperFE(categoryCode || "").replace(/[^A-Z]/g, "");
  if (normCatCode.length > 0) return normCatCode.charAt(0);

  if (/^(balo|ba\s*lô|băng|bang|bộ|bo|bảo\s*vệ|bao\s*ve)\b/i.test(trimmedName)) return "B";
  if (/^(túi|tui|tất|tat)\b/i.test(trimmedName)) return "T";
  if (/^(vớ|vo)\b/i.test(trimmedName)) return "V";
  if (/^(mũ|mu)\b/i.test(trimmedName)) return "M";
  if (/^(nón|non)\b/i.test(trimmedName)) return "N";
  if (/^(dép|dep|dán|dan)\b/i.test(trimmedName)) return "D";
  if (/^(chì|chi|cuốn|cuon|cước|cuoc)\b/i.test(trimmedName)) return "C";

  const normBaseLetters = toCompactUpperFE(trimmedName).replace(/[^A-Z]/g, "");
  return normBaseLetters.charAt(0) || "S";
}

export function resolveBrandInfo(
  rawName: string,
  explicitBrand?: string
): { brandCode: string; brandDisplay: string } {
  const cleanExplicit = String(explicitBrand || "").trim();
  if (cleanExplicit) {
    const compactExplicit = toCompactUpperFE(cleanExplicit).replace(/[^A-Z0-9]/g, "");
    if (NO_BRAND_TOKENS_FE.has(compactExplicit)) {
      return { brandCode: "NN", brandDisplay: "" };
    }
    if (compactExplicit) {
      const matchedKnown = KNOWN_BRANDS_FE.find(
        (b) => b.code.toUpperCase() === compactExplicit || b.pattern.test(cleanExplicit)
      );
      return {
        brandCode: matchedKnown ? matchedKnown.code.toUpperCase() : compactExplicit,
        brandDisplay: matchedKnown ? matchedKnown.display : cleanExplicit,
      };
    }
  }

  const cleanName = String(rawName || "").trim();
  if (cleanName) {
    for (const kb of KNOWN_BRANDS_FE) {
      if (kb.pattern.test(cleanName)) {
        return { brandCode: kb.code.toUpperCase(), brandDisplay: kb.display };
      }
    }
  }

  return { brandCode: "NN", brandDisplay: "" };
}

export interface ProductCodeOptionsFE {
  categoryCode?: string;
  categoryName?: string;
  brand?: string;
  modelName?: string;
  color?: string;
  size?: string;
  sixDigits?: string;
  existingCode?: string;
  seedSuffix?: string;
  keepVariantInCode?: boolean;
}

export function extractVariantFromText(
  rawName: string,
  options?: ProductCodeOptionsFE
): {
  baseName: string;
  code: string;
  variantCode: string;
  brand: string;
  color: string;
  size: string;
  categoryInitial: string;
  brandCode: string;
  sixDigits: string;
} {
  const raw = String(rawName || "").trim();
  const explicitBrand = options?.brand ? String(options.brand).trim() : "";
  if (!raw && !explicitBrand && !options?.modelName) {
    return {
      baseName: "",
      code: "",
      variantCode: "",
      brand: "",
      color: "",
      size: "",
      categoryInitial: "",
      brandCode: "NN",
      sixDigits: "",
    };
  }

  const compactRaw = toCompactUpperFE(raw);
  if (
    !/\s/.test(raw) &&
    /^[A-Z]{2,}[0-9]{6}$/.test(compactRaw) &&
    !options?.categoryCode &&
    !options?.categoryName &&
    !explicitBrand
  ) {
    const sixDigits = compactRaw.slice(-6);
    const catInit = compactRaw.charAt(0);
    const bCode = compactRaw.slice(1, -6) || "NN";
    const c = options?.color || "";
    const s = options?.size || "";
    return {
      baseName: raw,
      code: compactRaw,
      variantCode: generateVariantProductCode(compactRaw, c, s),
      brand: bCode === "NN" ? "" : bCode,
      color: c,
      size: s,
      categoryInitial: catInit,
      brandCode: bCode,
      sixDigits,
    };
  }

  const stripClause = (clause: string) => {
    let working = String(clause || "").trim();
    let size = "";
    let color = "";

    const explicitSize = working.match(
      /(?:[\s\-\/,]+|^)(?:size|sz|cỡ|co|kích\s*cỡ)\s*[:\-]?\s*(XXS|XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|FREESIZE|FREE\s*SIZE|[234][0-9](?:\.[05])?)\b/i
    );
    if (explicitSize) {
      size = explicitSize[1].replace(/\s+/g, "").toUpperCase();
      working = (
        working.slice(0, explicitSize.index) +
        working.slice((explicitSize.index || 0) + explicitSize[0].length)
      ).trim();
    } else {
      const trailingSize = working.match(
        /(?:[\-\/,]\s*|\s+)(FREESIZE|FREE\s*SIZE|XXS|XS|XL|2XL|3XL|4XL|XXL|XXXL)\s*$/i
      );
      if (trailingSize) {
        size = trailingSize[1].replace(/\s+/g, "").toUpperCase();
        working = working.slice(0, trailingSize.index).trim();
      } else {
        const dashSingle = working.match(/(?:[\-\/,]\s*)(S|M|L)\s*$/i);
        if (dashSingle) {
          size = dashSingle[1].toUpperCase();
          working = working.slice(0, dashSingle.index).trim();
        }
      }
    }

    const explicitColor = working.match(
      /(?:[\s\-\/,]+|^)(?:màu|mau|color)\s*[:\-]?\s*([A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)?)\s*$/i
    );
    if (explicitColor) {
      color = explicitColor[1].trim();
      working = working.slice(0, explicitColor.index).trim();
    } else {
      const trailingColor = working.match(
        /(?:[\-\/,]\s*|\s+|^)(xanh\s*dương|xanh\s*duong|xanh\s*lá|xanh\s*la|xanh\s*đen|xanh\s*den|xanh\s*ngọc|xanh\s*ngoc|đỏ|do|đen|den|trắng|trang|xanh|vàng|vang|hồng|hong|tím|tim|xám|xam|ghi|cam|nâu|nau|kem|bạc|bac|red|blue|pink|gray|grey|white|black|green|yellow|purple|orange|navy|silver|gold)\s*$/i
      );
      if (trailingColor) {
        color = trailingColor[1].trim();
        working = working.slice(0, trailingColor.index).trim();
      }
    }

    return {
      cleaned: working.replace(/^[\-\/,:\s]+|[\-\/,:\s]+$/g, "").trim(),
      color,
      size,
    };
  };

  let baseName = raw;
  let color = options?.color ? String(options.color).trim() : "";
  let size = options?.size ? String(options.size).trim().toUpperCase() : "";

  const matches = Array.from(raw.matchAll(/\(([^()]+)\)/g));
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const inside = last[1].trim();
    const before = raw.slice(0, last.index).trim();
    const sIn = stripClause(inside);
    const sBefore = stripClause(before);
    baseName = sBefore.cleaned || sIn.cleaned || before || inside;
    color = color || sIn.color || sBefore.color;
    size = size || sIn.size || sBefore.size;
  } else if (raw) {
    const stripped = stripClause(raw);
    baseName = stripped.cleaned || raw;
    color = color || stripped.color;
    size = size || stripped.size;
  }

  const categoryInitial = resolveCategoryInitial(
    baseName || raw,
    options?.categoryCode,
    options?.categoryName
  );
  const { brandCode, brandDisplay } = resolveBrandInfo(baseName || raw, explicitBrand);

  let sixDigits = "";
  if (options?.sixDigits && /^\d{6}$/.test(options.sixDigits.trim())) {
    sixDigits = options.sixDigits.trim();
  } else if (options?.existingCode) {
    const existingMatch = toCompactUpperFE(options.existingCode).match(/(\d{6})$/);
    if (existingMatch) {
      sixDigits = existingMatch[1];
    }
  }
  if (!sixDigits) {
    const nameSixDigitsMatch = raw.match(/\b(\d{6})\b/) || compactRaw.match(/(\d{6})$/);
    if (nameSixDigitsMatch) {
      sixDigits = nameSixDigitsMatch[1];
    }
  }
  if (!sixDigits) {
    const seedParts = [baseName || raw, options?.modelName || "", options?.seedSuffix || ""]
      .filter(Boolean)
      .join("_");
    sixDigits = generateSixDigitsFromSeed(seedParts);
  }

  const code = `${categoryInitial}${brandCode}${sixDigits}`;
  const variantCode = generateVariantProductCode(code, color, size);

  return {
    baseName,
    code,
    variantCode,
    brand: brandDisplay,
    color,
    size,
    categoryInitial,
    brandCode,
    sixDigits,
  };
}

export function generateProductCode(
  rawName: string,
  options?: ProductCodeOptionsFE
): string {
  if (options?.keepVariantInCode) {
    return toCompactUpperFE(rawName);
  }
  const trimmed = String(rawName || "").trim();
  if (!trimmed) {
    if (options?.brand || options?.modelName || options?.categoryCode || options?.categoryName) {
      return extractVariantFromText("", options).code;
    }
    return "";
  }
  return extractVariantFromText(trimmed, options).code;
}

export function formatVariantLabel(color?: string, size?: string): string {
  const c = String(color || "").trim();
  const s = String(size || "").trim().toUpperCase();
  if (c && s) return `${c} - Size ${s}`;
  if (c) return `Màu ${c}`;
  if (s) return `Size ${s}`;
  return "";
}

export function formatNumberDots(amount: number | undefined | null): string {
  const num = Math.max(0, Math.round(Number(amount || 0)));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseNumberDots(raw: string): number {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  return digits ? Math.max(0, Math.round(Number(digits) || 0)) : 0;
}

export function cleanPhoneDigits(raw: string | undefined | null): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 11);
}

export function formatPhone(raw: string | undefined | null): string {
  const digits = cleanPhoneDigits(raw);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function formatVND(amount: number | undefined | null): string {
  const num = Math.round(Number(amount || 0));
  const sign = num < 0 ? "-" : "";
  const formatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${formatted} VND`;
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("11sport_cms_token");
}

export function getStoredUser(): StaffUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("11sport_cms_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: StaffUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("11sport_cms_token", token);
  localStorage.setItem("11sport_cms_user", JSON.stringify(user));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("11sport_cms_token");
  localStorage.removeItem("11sport_cms_user");
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: any }> {
  const token = getStoredToken();
  const user = getStoredUser();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (user?._id) {
    headers["x-user-id"] = user._id;
  }

  const baseUrl = resolveApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    if (baseUrl !== RENDER_API_BASE_URL) {
      res = await fetch(`${RENDER_API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      throw netErr;
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMessage = json?.message || `Lỗi hệ thống (${res.status})`;
    const error: any = new Error(errMessage);
    error.code = json?.code || "API_ERROR";
    error.fields = json?.fields;
    throw error;
  }
  return json;
}

export {
  useDebounce,
  normalizeVietnamese,
  compactAlphaNum,
  normalizePhoneDigits,
  scoreSearchMatch,
  filterAndRankBySearch,
  type SearchField,
} from "./search";

/* ---------------- Chương trình Khuyến mãi (GET / POST / PATCH / DELETE /promotions) ---------------- */

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
export function estimateCode128Dots(rawText: string): number {
  const text =
    (rawText || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
      .trim()
      .replace(/[^\x20-\x7E]/g, "") || "ITEM";

  const countConsecutiveDigits = (str: string, startIdx: number): number => {
    let count = 0;
    while (startIdx + count < str.length) {
      const ch = str.charCodeAt(startIdx + count);
      if (ch >= 48 && ch <= 57) count++;
      else break;
    }
    return count;
  };

  let symbols = 1;
  let i = 0;
  let mode: "B" | "C" = countConsecutiveDigits(text, 0) >= 4 ? "C" : "B";

  while (i < text.length) {
    if (mode === "C") {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 2) {
        symbols += 1;
        i += 2;
      } else {
        symbols += 1;
        mode = "B";
      }
    } else {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 4) {
        if (dCount % 2 === 1) {
          symbols += 1;
          i += 1;
        }
        symbols += 1;
        mode = "C";
      } else {
        symbols += 1;
        i += 1;
      }
    }
  }

  return (symbols + 2) * 11 + 2;
}

export function compactColorTokenForBarcode(colorPart: string, maxLen: number): string {
  const clean = (colorPart || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean || clean.length <= maxLen) return clean;
  if (maxLen <= 1) return clean.slice(0, 1);

  const knownMap: [RegExp, string][] = [
    [/^TRANGXANH|^TRXANH|^TRXAN|^TRXA/, "TX"],
    [/^TRANGDO|^TRDO/, "TD"],
    [/^TRANGDEN|^TRDEN/, "TDE"],
    [/^TRANGVANG|^TRVA/, "TV"],
    [/^DENDO|^DEDO/, "DD"],
    [/^DENTRANG|^DETR/, "DT"],
    [/^DENVANG|^DEVA/, "DV"],
    [/^XANHDUONG|^XADU/, "XD"],
    [/^XANHDEN|^XADE/, "XDE"],
    [/^XANHLA|^XALA/, "XL"],
    [/^XANHNGOC|^XANGO/, "XN"],
    [/^XANHTRANG|^XATR/, "XT"],
    [/^WHBCOF|^WHBCO/, "WBC"],
    [/^WHBLUE/, "WBL"],
    [/^SOOVKH|^SOOVK/, "SVK"],
    [/^BLGOL/, "BG"],
    [/^GREIGESO|^GRSOO/, "GSO"],
    [/^WHSTGR/, "WSG"],
    [/^WHCAFE/, "WCF"],
  ];

  for (const [re, short] of knownMap) {
    if (re.test(clean)) {
      return short.length <= maxLen ? short : short.slice(0, maxLen);
    }
  }

  if (maxLen === 2) {
    return clean[0] + clean[Math.floor(clean.length / 2)];
  }
  return clean.slice(0, maxLen - 1) + clean[clean.length - 1];
}

/**
 * Chuẩn hóa mã sản phẩm / mã con biến thể sang chuỗi Code 128 gọn (<= 200 dots = 25.0mm ở 203 DPI),
 * đảm bảo lề trắng tĩnh (Quiet Zone) >= 4.0mm mỗi bên trên tem 35x20mm.
 */
export function toCompactBarcode128(rawCode: string, maxDots = 200): string {
  const clean = toCompactUpperFE(rawCode || "");
  if (!clean) return "ITEM";
  if (estimateCode128Dots(clean) <= maxDots) return clean;

  const m = clean.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  if (!m) {
    let trimmed = clean;
    while (trimmed.length > 8 && estimateCode128Dots(trimmed) > maxDots) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
  }

  const [, cat, brand, sixDigits, suffix] = m;
  let colorPart = "";
  let sizePart = "";
  if (suffix) {
    const sm = suffix.match(/^(.*?)(FREESIZE|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234]\d(?:5)?|[2345]U|S|M|L)$/);
    if (sm) {
      colorPart = sm[1] || "";
      sizePart = sm[2] || "";
    } else {
      colorPart = suffix;
    }
  }

  const sizeTokens = sizePart === "FREESIZE" ? ["FREESIZE", "FS"] : [sizePart];

  for (const sz of sizeTokens) {
    if (colorPart) {
      for (const cLen of [3, 2]) {
        const sc = compactColorTokenForBarcode(colorPart, cLen);
        const candidate = `${cat}${brand}${sixDigits}${sc}${sz}`;
        if (estimateCode128Dots(candidate) <= maxDots) {
          return candidate;
        }
      }
    }

    const sc2 = compactColorTokenForBarcode(colorPart, 2);
    for (let bLen = Math.min(brand.length, 5); bLen >= 2; bLen--) {
      const sb = brand.slice(0, bLen);
      for (const cLen of [3, 2]) {
        const sc = compactColorTokenForBarcode(colorPart, cLen);
        const candidate = `${cat}${sb}${sixDigits}${sc}${sz}`;
        if (estimateCode128Dots(candidate) <= maxDots) {
          return candidate;
        }
      }
    }
  }

  const finalSize = sizePart === "FREESIZE" ? "FS" : sizePart;
  const sc1 = compactColorTokenForBarcode(colorPart, 1);
  return `${cat}${brand.slice(0, 2)}${sixDigits}${sc1}${finalSize}`;
}

export function isCompactBarcodeMatchVariant(scannedRaw: string, targetVariantCodeRaw: string): boolean {
  const s = toCompactUpperFE(scannedRaw || "");
  const t = toCompactUpperFE(targetVariantCodeRaw || "");
  if (!s || !t) return false;
  if (s === t) return true;
  if (s === toCompactBarcode128(t, 200) || toCompactBarcode128(s, 200) === toCompactBarcode128(t, 200)) {
    return true;
  }

  const sm = s.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  const tm = t.match(/^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$/);
  if (!sm || !tm) return false;

  const [, sCat, sBrand, sDigits, sSuffix] = sm;
  const [, tCat, tBrand, tDigits, tSuffix] = tm;

  if (sCat !== tCat || sDigits !== tDigits) return false;
  if (!tBrand.startsWith(sBrand) && !sBrand.startsWith(tBrand)) return false;
  if (sSuffix === tSuffix) return true;

  const splitSuffix = (sfx: string) => {
    const m = sfx.match(/^(.*?)(FREESIZE|FS|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234]\d(?:5)?|[2345]U|S|M|L)$/);
    return m ? { color: m[1] || "", size: m[2] === "FS" ? "FREESIZE" : m[2] || "" } : { color: sfx, size: "" };
  };

  const sParts = splitSuffix(sSuffix);
  const tParts = splitSuffix(tSuffix);
  if (sParts.size !== tParts.size) return false;
  if (!sParts.color && !tParts.color) return true;
  if (!sParts.color || !tParts.color) return false;

  for (const cLen of [3, 2, 1]) {
    if (sParts.color === compactColorTokenForBarcode(tParts.color, cLen)) {
      return true;
    }
  }
  return false;
}

// ============================================================
// HRM & Attendance APIs (v4.0)
// ============================================================

export async function fetchHolidays(year?: number): Promise<Holiday[]> {
  const q = year ? `?year=${year}` : "";
  const res = await apiRequest<Holiday[]>(`/holidays${q}`);
  return res.data;
}

export async function syncVietnamHolidaysApi(year: number): Promise<{
  year: number;
  syncedCount: number;
  totalVietnamHolidays: number;
}> {
  const res = await apiRequest<{
    year: number;
    syncedCount: number;
    totalVietnamHolidays: number;
  }>("/holidays/sync-vn", {
    method: "POST",
    body: JSON.stringify({ year }),
  });
  return res.data;
}

export async function createHolidayApi(data: {
  date: string;
  name: string;
  note?: string;
  isOfficialDayOff?: boolean;
}): Promise<Holiday> {
  const res = await apiRequest<Holiday>("/holidays", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteHolidayApi(id: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean }>(`/holidays/${id}`, {
    method: "DELETE",
  });
  return res.data.success;
}

export async function fetchLeaveRequests(params?: { status?: string; type?: string; date?: string; staffId?: string }): Promise<LeaveRequest[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.date) query.set("date", params.date);
  if (params?.staffId) query.set("staffId", params.staffId);
  const qStr = query.toString();
  const res = await apiRequest<LeaveRequest[]>(`/leave-requests${qStr ? `?${qStr}` : ""}`);
  return res.data;
}

export async function reviewLeaveRequestApi(id: string, status: "APPROVED" | "REJECTED", reviewNote?: string): Promise<LeaveRequest> {
  const res = await apiRequest<LeaveRequest>(`/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewNote }),
  });
  return res.data;
}

export async function fetchShiftSchedule(weekStart?: string): Promise<{ assignments: ShiftAssignment[]; staffList: StaffUser[] }> {
  const query = weekStart ? `?weekStart=${weekStart}` : "";
  const res = await apiRequest<{ assignments: ShiftAssignment[]; staffList: StaffUser[] }>(`/shifts/schedule${query}`);
  return res.data;
}

export async function assignShiftApi(data: { staffId: string; date: string; weekStart?: string; dayOfWeek?: number; shiftCode: "SHIFT_1" | "SHIFT_2" | "OFF" }): Promise<ShiftAssignment> {
  const res = await apiRequest<ShiftAssignment>("/shifts/assign", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchAttendanceHistory(params?: { staffId?: string; month?: string; year?: string }): Promise<AttendanceRecord[]> {
  const query = new URLSearchParams();
  if (params?.staffId) query.set("staffId", params.staffId);
  if (params?.month) query.set("month", params.month);
  if (params?.year) query.set("year", params.year);
  const qStr = query.toString();
  const res = await apiRequest<AttendanceRecord[]>(`/attendance/history${qStr ? `?${qStr}` : ""}`);
  return res.data;
}

export interface AttendanceConfig {
  _id?: string;
  key?: string;
  officeName: string;
  officeLat: number;
  officeLng: number;
  maxDistanceMeters: number;
  allowedIps: string[];
  requireGps: boolean;
  requireIp: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export async function fetchAttendanceConfig(): Promise<{
  config: AttendanceConfig;
  detectedClientIp: string;
}> {
  const res = await apiRequest<{ config: AttendanceConfig; detectedClientIp: string }>("/attendance/config");
  return res.data;
}

export async function updateAttendanceConfigApi(
  payload: Partial<AttendanceConfig>
): Promise<{ config: AttendanceConfig; detectedClientIp: string }> {
  const res = await apiRequest<{ config: AttendanceConfig; detectedClientIp: string }>("/attendance/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

// ============================================================
// Bảng công tháng (Timesheet) & Điều chỉnh giờ công (HR)
// ============================================================

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
  /** HĐ Chính thức: 1 ngày nghỉ phép có lương/tháng */
  paidLeaveEntitled?: number;
  paidLeaveUsed?: number;
  /** 1 = tháng đã qua mà không dùng -> mất quyền lợi */
  paidLeaveForfeited?: number;
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

export interface TimesheetData {
  month: number;
  year: number;
  days: TimesheetDay[];
  rows: TimesheetRow[];
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

export async function fetchTimesheetApi(params: {
  month: number;
  year: number;
  department?: Department | "ALL";
}): Promise<TimesheetData> {
  const q = new URLSearchParams({ month: String(params.month), year: String(params.year) });
  if (params.department && params.department !== "ALL") q.set("department", params.department);
  const res = await apiRequest<TimesheetData>(`/attendance/timesheet?${q.toString()}`);
  return res.data;
}

export async function adjustAttendanceApi(
  id: string,
  data: {
    checkIn?: string;
    checkOut?: string;
    shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
    overtimeStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    overtimeApprovedMinutes?: number;
    reason: string;
  }
): Promise<AttendanceRecord> {
  const res = await apiRequest<AttendanceRecord>(`/attendance/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function createManualAttendanceApi(data: {
  staffId: string;
  date: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  checkIn: string;
  checkOut?: string;
  overtimeStatus?: "NONE" | "APPROVED";
  overtimeApprovedMinutes?: number;
  reason: string;
}): Promise<AttendanceRecord> {
  const res = await apiRequest<AttendanceRecord>("/attendance/manual", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export interface ShiftChange {
  staffId: string;
  date: string;
  dayOfWeek?: number;
  /** null = xoá phân ca của nhân viên ngày đó */
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
}

export async function saveShiftChangesApi(
  weekStart: string,
  changes: ShiftChange[],
  confirmWeek?: boolean
): Promise<{ created: number; updated: number; deleted: number; confirmed?: number }> {
  const res = await apiRequest<{ created: number; updated: number; deleted: number; confirmed?: number }>("/shifts/assign/bulk", {
    method: "PUT",
    body: JSON.stringify({ weekStart, changes, confirmWeek }),
  });
  return res.data;
}

const RENDER_API_BASE_URL = "https://one1sport-it.onrender.com/api/v1";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || RENDER_API_BASE_URL;

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") return ENV_API_BASE_URL;
  const host = window.location.hostname;
  const isEnvLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(ENV_API_BASE_URL);
  if (!isEnvLocal) return ENV_API_BASE_URL;

  // Nếu đang mở trên chính máy dev (localhost / 127.0.0.1) -> giữ nguyên localhost:4000
  if (host === "localhost" || host === "127.0.0.1") {
    return ENV_API_BASE_URL;
  }
  // Nếu máy khác trong mạng LAN truy cập qua IP nội bộ (VD: 192.168.1.x:3000) -> tự động trỏ API sang IP máy dev:4000
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return ENV_API_BASE_URL.replace(/localhost|127\.0\.0\.1/i, host);
  }
  // Nếu đang mở trên domain HTTPS công khai (Vercel...) -> dùng Render API
  return RENDER_API_BASE_URL;
}

export type UserRole = "SALES" | "WAREHOUSE" | "ADMIN" | "HR" | "ACCOUNTANT" | "MARKETING";
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
  citizenId?: string;
  address?: string;
  role: UserRole;
  department?: Department;
  contractType?: ContractType;
  contractStartDate?: string;
  contractEndDate?: string;
  contractFileUrl?: string;
  contractFileName?: string;
  baseSalary?: number;
  allowance?: number;
  bonus?: number;
  insurance?: number;
  status: "ACTIVE" | "LOCKED";
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
  /** Giá gốc (giá nhập gần nhất) — server ẩn với role SALES */
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

export interface ImportScanCount {
  userId: string;
  name: string;
  role?: string;
  quantity: number;
}

export interface ImportItem {
  stt: number;
  productCode: string;
  /** Mã con riêng theo thuộc tính (Màu, Size) để in tem & quét kiểm kho */
  variantCode?: string;
  productName: string;
  brand?: string;
  color?: string;
  colorHexes?: string[];
  size?: string;
  categoryId?: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  /** Giá gốc (đơn giá nhập, VND) do thủ kho nhập */
  costPrice?: number;
  sellingPrice?: number;
  /** Số chiếc đã quét tag ở bước kiểm thực tế */
  scannedQuantity?: number;
  checkedBy?: string;
  checkedByName?: string;
  checkedByRole?: string;
  checkedAt?: string;
  scanCounts?: ImportScanCount[];
  /** Mã vạch đã học được khi quét tag (= variantCode) */
  barcode?: string;
  note: string;
  isChecked: boolean;
  isConfirmed: boolean;
  discrepancyNote?: string;
}

export interface ImportReceipt {
  _id: string;
  code: string;
  receiptCode?: string;
  status: "DRAFT" | "CHECKING" | "COMPLETED";
  targetWarehouse?: WarehouseFloor;
  note: string;
  defaultCategoryId?: string;
  items: ImportItem[];
  createdBy?: string | { fullName?: string; username?: string };
  createdByName?: string;
  createdByRole?: string;
  completedBy?: string;
  completedByName?: string;
  completedByRole?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
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
  customerId?: string;
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
  returnItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    unitPrice: number;
    quantity: number;
    condition: "GOOD" | "DAMAGED";
    lineTotal: number;
  }[];
  exchangeItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number;
  note?: string;
  performedByName?: string;
  createdAt: string;
}

/**
 * Công thức tự sinh Mã sản phẩm chuẩn 11Sport (v3.2):
 * - Mã gốc: [Chữ cái đầu tiên của Category] + [Tên Hãng IN HOA (không có hãng = NN)] + [6 chữ số]
 * - Mã con theo thuộc tính: [Mã gốc][MÀU IN HOA BỎ DẤU][SIZE IN HOA] (VD: GASIA221401DO38)
 */
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
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("11sport_token");
}

export function getStoredUser(): StaffUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("11sport_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: StaffUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("11sport_token", token);
  localStorage.setItem("11sport_user", JSON.stringify(user));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("11sport_token");
  localStorage.removeItem("11sport_user");
  try {
    sessionStorage.removeItem("11sport_pos_drafts_v1");
  } catch {
    // ignore
  }
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

/** Chu kỳ đánh thức server chống sleep trên Render Free (8 phút — nằm trong khoảng 5-10 phút) */
export const KEEP_ALIVE_INTERVAL_MS = 8 * 60 * 1000;

export function pingServerHealth(): void {
  const baseUrl = resolveApiBaseUrl();
  fetch(`${baseUrl}/health`, { method: "GET", cache: "no-store" }).catch(() => {});
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

/* ---------------- Chương trình Khuyến mãi (GET /promotions?activeOnly=true) ---------------- */

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
// HRM, Attendance & Shift Handover APIs (v4.0)
// ============================================================

export interface AttendanceData {
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
  totalWorkHours: number;
}

export async function checkInApi(params: {
  latitude?: number;
  longitude?: number;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
}): Promise<{ attendance: AttendanceData; isWfh: boolean; message: string }> {
  const res = await apiRequest<{ attendance: AttendanceData; isWfh: boolean; message: string }>(
    "/attendance/check-in",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return res.data;
}

export async function checkOutApi(params?: {
  forceEarly?: boolean;
  earlyReason?: string;
  lateCheckoutReason?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ attendance: AttendanceData; message: string }> {
  const res = await apiRequest<{ attendance: AttendanceData; message: string }>(
    "/attendance/check-out",
    {
      method: "POST",
      body: JSON.stringify(params || {}),
    }
  );
  return res.data;
}

export async function getTodayAttendanceApi(): Promise<{
  date: string;
  attendance: AttendanceData | null;
  assignedShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
  isWfhToday: boolean;
  isEarlyApprovedToday?: boolean;
  handoverStatus: "PENDING" | "ACCEPTED" | null;
}> {
  const res = await apiRequest<{
    date: string;
    attendance: AttendanceData | null;
    assignedShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF" | null;
    isWfhToday: boolean;
    isEarlyApprovedToday?: boolean;
    handoverStatus: "PENDING" | "ACCEPTED" | null;
  }>("/attendance/today");
  return res.data;
}

export async function createHandoverApi(data: {
  date?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  cashBalance: number;
  discrepancies: Array<{ productCode: string; expected: number; actual: number; note?: string }>;
  notes?: string;
}): Promise<any> {
  const res = await apiRequest("/shifts/handover", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function confirmHandoverApi(id: string, accept: boolean, note?: string): Promise<any> {
  const res = await apiRequest(`/shifts/handover/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ accept, note }),
  });
  return res.data;
}

export async function submitShiftPreferencesApi(data: {
  weekStart: string;
  preferences: Array<{ date: string; dayOfWeek: number; isOffRequested: boolean; preferenceShift: string }>;
}): Promise<any> {
  const res = await apiRequest("/shifts/preferences", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export interface MyShiftAssignmentItem {
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
}

export interface MyShiftScheduleData {
  weekStart: string;
  weekEnd?: string;
  nextMonday?: string;
  currentMonday?: string;
  nextWeekStart: string;
  currentWeekStart: string;
  assignments: MyShiftAssignmentItem[];
  currentWeekAssignments: MyShiftAssignmentItem[];
  isRegistered: boolean;
  isConfirmedByHr: boolean;
  unseenConfirmedCount: number;
  hasUnseenConfirmedSchedule: boolean;
  monthlyOffQuota?: {
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
        usedDatesOutsideWeek: string[];
      }
    >;
  };
}

export async function fetchMyShiftScheduleApi(weekStart?: string): Promise<MyShiftScheduleData> {
  const q = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  const res = await apiRequest<MyShiftScheduleData>(`/shifts/my-schedule${q}`);
  return res.data;
}

export async function markMyShiftScheduleSeenApi(weekStart?: string): Promise<{ markedCount: number }> {
  const res = await apiRequest<{ markedCount: number }>("/shifts/my-schedule/seen", {
    method: "POST",
    body: JSON.stringify(weekStart ? { weekStart } : {}),
  });
  return res.data;
}

// ============================================================
// Lịch công cá nhân (Web) & Đơn từ
// ============================================================

export type MyCalendarCellCode =
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

export type LeaveRequestType = "WFH" | "OFF" | "LATE" | "EARLY" | "PAID_LEAVE";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MyCalendarLeave {
  id: string;
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  reason: string;
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
  checkInType?: "STANDARD" | "WFH";
  isHolidayWork?: boolean;
  isPaidHoliday?: boolean;
  overtimeMinutes?: number;
  earlyApproved?: boolean;
  lateApproved?: boolean;
  leaveRequests?: MyCalendarLeave[];
  adjusted?: boolean;
  adjustedByName?: string;
  adjustReason?: string;
  note?: string;
}

export interface MyCalendarSummary {
  standardDays: number;
  workUnits: number;
  paidUnits: number;
  holidayPaidDays: number;
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
  holidayWorkHours: number;
  overtimeDays: number;
  overtimeMinutes: number;
  pendingRequests: number;
  paidLeaveEntitled: number;
  paidLeaveUsed: number;
  paidLeaveForfeited: number;
  salesOffEntitled?: number;
  salesOffUsed?: number;
  salesOffRemaining?: number;
}

export interface MyCalendarDay {
  date: string;
  day: number;
  weekday: number;
  isToday: boolean;
  holiday: { name: string; isOfficialDayOff: boolean } | null;
}

export interface MyCalendarData {
  month: number;
  year: number;
  days: MyCalendarDay[];
  row: {
    staffId: string;
    staffCode: string;
    staffName: string;
    department: Department;
    contractType?: ContractType;
    standardHours: number;
    cells: Record<string, MyCalendarCell>;
    summary: MyCalendarSummary;
  } | null;
  rules: {
    shifts: { SHIFT_1: string; SHIFT_2: string; BOTH?: string };
    lateToleranceMinutes: number;
    overtimeMinMinutes: number;
    holidayWorkPayMultiplier: number;
  };
}

export async function fetchMyCalendarApi(month: number, year: number): Promise<MyCalendarData> {
  const res = await apiRequest<MyCalendarData>(`/attendance/my-calendar?month=${month}&year=${year}`);
  return res.data;
}

export async function createLeaveRequestApi(data: {
  type: LeaveRequestType;
  date: string;
  reason: string;
}): Promise<any> {
  const res = await apiRequest("/leave-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export interface MyLeaveRequest {
  _id: string;
  type: LeaveRequestType;
  date: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export async function fetchMyLeaveRequestsApi(): Promise<MyLeaveRequest[]> {
  const res = await apiRequest<MyLeaveRequest[]>("/leave-requests");
  return res.data;
}

export async function cancelLeaveRequestApi(id: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean }>(`/leave-requests/${id}`, { method: "DELETE" });
  return res.data.success;
}

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

export type UserRole = "SALES" | "WAREHOUSE" | "ADMIN";

export interface StaffUser {
  _id: string;
  code: string;
  username: string;
  fullName: string;
  phone?: string;
  role: UserRole;
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
  size: string;
  /** Mã con riêng theo thuộc tính (Màu, Size): [Mã gốc][MÀU][SIZE] (VD: GASIA221401DO38) */
  variantCode?: string;
  barcode?: string;
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

export interface Order {
  _id: string;
  orderCode: string;
  code?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANKING" | "CARD" | "OTHER";
  paymentMethodDetail?: string;
  hasCardFee: boolean;
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal: number;
  billDiscountType?: DiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  cardFee: number;
  totalAmount: number;
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

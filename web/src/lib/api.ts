const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://one1sport-it.onrender.com/api/v1";

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

export interface Product {
  _id: string;
  code: string;
  name: string;
  categoryId: string | Category;
  categoryName?: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — server ẩn với role SALES */
  costPrice?: number;
  barcode?: string;
  stockFloor1?: number;
  stockFloor2?: number;
  stock: number;
}

export interface ImportItem {
  stt: number;
  productCode: string;
  productName: string;
  categoryId?: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  /** Giá gốc (đơn giá nhập, VND) do thủ kho nhập */
  costPrice?: number;
  /** Số chiếc đã quét tag ở bước kiểm thực tế */
  scannedQuantity?: number;
  /** Mã vạch đã học được khi quét tag */
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
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT" | "GIFT";

export interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
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
  status: "PAID" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";
  items: OrderItem[];
  soldBy?: string;
  soldByName?: string;
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
 * Công thức tự sinh Mã sản phẩm chuẩn 11Sport (BR-03):
 * - Trích xuất nội dung bên trong cặp ngoặc đơn (...) cuối cùng của Tên hàng hóa.
 * - Fallback: Nếu tên hàng không chứa (), chuẩn hóa toàn bộ chuỗi tên hàng.
 * - Bỏ dấu tiếng Việt (Đ/đ -> D), chuyển IN HOA, thay khoảng trắng/ký tự đặc biệt bằng dấu gạch chân '_',
 *   cắt bỏ '_' ở đầu và cuối.
 */
export function generateProductCode(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";
  const trimmed = rawName.trim();
  if (!trimmed) return "";

  const matches = Array.from(trimmed.matchAll(/\(([^()]+)\)/g));
  let targetText = trimmed;
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1][1].trim();
    if (lastMatch.length > 0) {
      targetText = lastMatch;
    }
  }

  return targetText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  // Xóa các đơn nháp POS (nhiều đơn song song) của phiên đăng nhập hiện tại
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

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

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
  fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" }).catch(() => {});
}

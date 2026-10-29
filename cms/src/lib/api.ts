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
  createdAt?: string;
}

export interface Category {
  _id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
}

export interface Product {
  _id: string;
  code: string;
  name: string;
  categoryId: string | Category;
  categoryName?: string;
  unit: string;
  sellingPrice: number;
  /** Giá gốc (giá nhập gần nhất) — cập nhật khi hoàn thành phiếu nhập kho */
  costPrice?: number;
  stock: number;
}

export interface StockMovement {
  _id: string;
  type: "IMPORT" | "SALE" | "RETURN" | "EXCHANGE_IN" | "EXCHANGE_OUT" | "ADJUSTMENT";
  productId: string;
  productCode: string;
  productName: string;
  quantityChange: number;
  balanceAfter: number;
  referenceType?: string;
  referenceCode?: string;
  performedBy?: string;
  performedByName?: string;
  note?: string;
  createdAt: string;
}

export interface InventoryReportRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryName?: string;
  unit: string;
  openingStock: number;
  importedQty: number;
  soldQty: number;
  adjustedAndReturnedQty: number;
  closingStock: number;
}

export interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  returnedQuantity?: number;
  lineTotal: number;
}

export interface Order {
  _id: string;
  orderCode: string;
  code?: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANKING" | "CARD";
  hasCardFee: boolean;
  subtotal: number;
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
  type: "IMPORT_CREATED" | "IMPORT_CHECKED" | "IMPORT_COMPLETED" | "ADJUSTMENT";
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

export function formatVND(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat("vi-VN").format(Math.round(num)) + " ₫";
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

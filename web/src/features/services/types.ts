import type { ServiceDiscountType, ServiceOrderStatus } from "@/shared/types";
import { parseNumberDots } from "@/shared/utils/format";

export type ServiceDiscountMode = "NONE" | "PERCENT" | "AMOUNT" | "PRICE";

export interface ServiceCartLine {
  key: string;
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  discountMode: ServiceDiscountMode;
  discountInput: string;
  itemNote: string;
}

export function computeServiceLinePricing(line: ServiceCartLine): {
  grossLine: number;
  discountType: ServiceDiscountType;
  discountValue: number;
  discountAmount: number;
  lineTotal: number;
} {
  const grossLine = Math.max(0, line.unitPrice) * Math.max(1, line.quantity);
  if (line.discountMode === "PERCENT") {
    const pct = Math.min(100, Math.max(0, Number(line.discountInput) || 0));
    const discountAmount = Math.round((grossLine * pct) / 100);
    return {
      grossLine,
      discountType: pct > 0 ? "PERCENT" : "NONE",
      discountValue: pct,
      discountAmount,
      lineTotal: Math.max(0, grossLine - discountAmount),
    };
  }
  if (line.discountMode === "AMOUNT") {
    const amt = Math.min(grossLine, parseNumberDots(line.discountInput));
    return {
      grossLine,
      discountType: amt > 0 ? "AMOUNT" : "NONE",
      discountValue: amt,
      discountAmount: amt,
      lineTotal: Math.max(0, grossLine - amt),
    };
  }
  if (line.discountMode === "PRICE") {
    const desired =
      line.discountInput.trim() === ""
        ? grossLine
        : Math.min(grossLine, parseNumberDots(line.discountInput));
    const discountAmount = Math.max(0, grossLine - desired);
    return {
      grossLine,
      discountType: discountAmount > 0 ? "AMOUNT" : "NONE",
      discountValue: discountAmount,
      discountAmount,
      lineTotal: desired,
    };
  }
  return {
    grossLine,
    discountType: "NONE",
    discountValue: 0,
    discountAmount: 0,
    lineTotal: grossLine,
  };
}

export type PaymentTimingMode = "FULL" | "LATER" | "DEPOSIT";

export const STATUS_BADGE_MAP: Record<
  ServiceOrderStatus,
  { label: string; cls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    cls: "bg-blue-50 text-brand-ink border-blue-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    cls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    cls: "bg-blue-50 text-brand-ink border-blue-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    cls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    cls: "bg-red-50 text-red-600 border-red-200",
  },
};

export function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(baseDateStr: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDateStr.trim());
  const dt = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function diffDaysStr(fromStr: string, toStr: string): string {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromStr.trim());
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toStr.trim());
  if (!m1 || !m2) return "";
  const d1 = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3])).getTime();
  const d2 = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])).getTime();
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? String(diff) : "";
}

export function formatShortDate(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


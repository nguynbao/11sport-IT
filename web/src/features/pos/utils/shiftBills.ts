import type { Order } from "@/shared/types";

export function getLocalDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getRecentQuickDates(days = 3): string[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    dates.push(getLocalDateStr(dt));
  }
  return dates;
}

export function formatShortVnDate(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPaymentMethodLabel(ord: Order): string {
  if (ord.paymentMethod === "CASH") return "Tiền mặt";
  if (ord.paymentMethod === "BANKING") return "Chuyển khoản";
  if (ord.paymentMethod === "CARD") {
    return ord.cardFeePercent ? `Quẹt thẻ (${ord.cardFeePercent}%)` : "Quẹt thẻ";
  }
  return ord.paymentMethodDetail || "Tách TT / Khác";
}

export function formatShiftBadge(shiftCode?: string): string {
  if (shiftCode === "SHIFT_1") return "Ca 1 (08:30 - 17:30)";
  if (shiftCode === "SHIFT_2") return "Ca 2 (12:00 - 21:00)";
  if (shiftCode === "BOTH") return "Ca 1 + Ca 2";
  if (shiftCode === "OFF") return "Nghỉ (OFF)";
  return "Trong ngày";
}

import type { Order } from "@/shared/types";

export function parseLocalDateBound(raw: string | undefined | null, isEnd: boolean): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return isEnd
      ? new Date(y, mo, d, 23, 59, 59, 999)
      : new Date(y, mo, d, 0, 0, 0, 0);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  if (isEnd) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
}

export function extractClientOrderDebtMeta(o: Order, refundedCashForOrder = 0) {
  const totalAmount = Math.max(0, Number(o.totalAmount) || 0);
  let debtAmount = Math.max(0, Number(o.debtAmount) || 0);
  let initialDebtAmount = Math.max(debtAmount, Number(o.initialDebtAmount) || 0);

  const debtPayments = Array.isArray(o.debtPayments) ? o.debtPayments : [];
  const debtAdjustments = Array.isArray(o.debtAdjustments) ? o.debtAdjustments : [];
  const collectedDebtAmount = debtPayments.reduce(
    (s, dp) => s + Math.max(0, Number(dp?.amount) || 0),
    0
  );
  const reducedByReturnAmount = debtAdjustments.reduce(
    (s, da) => s + Math.max(0, Number(da?.amount) || 0),
    0
  );

  if (initialDebtAmount < debtAmount + collectedDebtAmount + reducedByReturnAmount) {
    initialDebtAmount = debtAmount + collectedDebtAmount + reducedByReturnAmount;
  }

  if (
    initialDebtAmount === 0 &&
    debtAmount === 0 &&
    o.paymentMethod === "OTHER" &&
    /công\s*nợ|trả\s*sau|debt/i.test(String(o.paymentMethodDetail || ""))
  ) {
    const m = /(?:công\s*nợ|trả\s*sau|debt)[^0-9]*([0-9][0-9.,]*)/i.exec(
      String(o.paymentMethodDetail || "")
    );
    if (m) {
      const parsed = parseInt(m[1].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) {
        debtAmount = Math.min(totalAmount, parsed);
        initialDebtAmount = debtAmount;
      }
    }
  }

  const cashAtPurchase = Math.max(0, totalAmount - initialDebtAmount);
  const paidAmount = Math.max(
    0,
    Math.min(totalAmount, cashAtPurchase + collectedDebtAmount - Math.max(0, refundedCashForOrder))
  );

  const debtStatus: "NONE" | "UNPAID" | "PARTIAL" | "SETTLED" =
    o.debtStatus && o.debtStatus !== "NONE"
      ? o.debtStatus
      : initialDebtAmount <= 0 && debtAmount <= 0
        ? "NONE"
        : debtAmount <= 0
          ? "SETTLED"
          : cashAtPurchase + collectedDebtAmount <= 0 && reducedByReturnAmount <= 0
            ? "UNPAID"
            : "PARTIAL";

  const dueDate = o.debtDueDate ? new Date(o.debtDueDate) : null;
  const validDueDate = dueDate && !isNaN(dueDate.getTime()) ? dueDate : null;
  const nowMs = Date.now();
  const isOverdue = Boolean(debtAmount > 0 && validDueDate && validDueDate.getTime() < nowMs);
  const daysOverdue =
    isOverdue && validDueDate
      ? Math.max(1, Math.ceil((nowMs - validDueDate.getTime()) / (24 * 3600 * 1000)))
      : 0;

  return {
    totalAmount,
    cashAtPurchase,
    paidAmount,
    debtAmount,
    initialDebtAmount,
    collectedDebtAmount,
    reducedByReturnAmount,
    debtStatus,
    debtDueDate: validDueDate ? validDueDate.toISOString() : null,
    isOverdue,
    daysOverdue,
    debtPayments,
    debtAdjustments,
  };
}

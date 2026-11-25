import type { OrderShiftCode } from "../../models/Order";

const ORDER_MANAGER_ROLES = new Set(["CEO", "ADMIN", "ACCOUNTANT", "HR"]);

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function inferShiftCodeFromTime(d = new Date()): 'SHIFT_1' | 'SHIFT_2' {
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  return totalMinutes >= 17 * 60 + 30 ? 'SHIFT_2' : 'SHIFT_1';
}

export function isSalesOnlyUser(
  user?: { role?: string; department?: string } | null
): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (ORDER_MANAGER_ROLES.has(role)) return false;
  return role === 'SALES' || String(user.department || '').toUpperCase() === 'SALES';
}

export function getShiftDisplayLabel(
  shiftCode: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | 'OFF'
): string {
  if (shiftCode === 'SHIFT_1') return 'Ca 1 (08:30 - 17:30)';
  if (shiftCode === 'SHIFT_2') return 'Ca 2 (12:00 - 21:00)';
  if (shiftCode === 'BOTH') return 'Ca 1 + Ca 2 (08:30 - 21:00)';
  return 'Nghỉ (OFF)';
}


export function getOrderEffectiveShiftAndDate(order: any): {
  shiftDate: string;
  shiftCode: OrderShiftCode;
} {
  const refDate =
    order?.status !== 'DRAFT' && order?.confirmedAt
      ? new Date(order.confirmedAt)
      : new Date(order?.createdAt || Date.now());
  const validDate = !isNaN(refDate.getTime()) ? refDate : new Date();

  const shiftDate =
    typeof order?.shiftDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(order.shiftDate.trim())
      ? order.shiftDate.trim()
      : toLocalDateStr(validDate);

  const rawShift = String(order?.shiftCode || '').trim().toUpperCase();
  const shiftCode: OrderShiftCode =
    rawShift === 'SHIFT_1' || rawShift === 'SHIFT_2' || rawShift === 'BOTH'
      ? (rawShift as OrderShiftCode)
      : inferShiftCodeFromTime(validDate);

  return { shiftDate, shiftCode };
}

export const SALES_MAX_BILL_CHECK_DAYS = 3;

export function getSalesAllowedBillDates(
  ref: Date | string = new Date(),
  maxDays: number = SALES_MAX_BILL_CHECK_DAYS
): string[] {
  let baseDate: Date;
  if (typeof ref === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ref.trim())) {
    const [y, m, d] = ref.trim().split('-').map(Number);
    baseDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  } else if (ref instanceof Date && !isNaN(ref.getTime())) {
    baseDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0, 0);
  } else {
    const now = new Date();
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }

  const dates: string[] = [];
  const count = Math.max(1, Math.min(30, Math.floor(maxDays)));
  for (let i = 0; i < count; i++) {
    const dt = new Date(baseDate);
    dt.setDate(baseDate.getDate() - i);
    dates.push(toLocalDateStr(dt));
  }
  return dates;
}

/**
 * Kiểm tra đơn hàng có thuộc phạm vi ngày cho phép kiểm tra Bill của nhân viên Sales hay không:
 * 1. Bỏ ràng buộc theo ca: Sales được xem toàn bộ bill trong ngày của mọi ca (SHIFT_1, SHIFT_2, BOTH), kể cả khi lịch OFF.
 * 2. Giới hạn tối đa 3 ngày gần nhất (Hôm nay, Hôm qua, Hôm kia). Đơn cũ quá 3 ngày không được xem.
 */
export function isOrderInSalesCurrentShift(
  order: any,
  _staffShift?: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | 'OFF',
  todayStr: string = toLocalDateStr(new Date()),
  maxDays: number = SALES_MAX_BILL_CHECK_DAYS
): boolean {
  const { shiftDate } = getOrderEffectiveShiftAndDate(order);
  const allowedDates = getSalesAllowedBillDates(todayStr, maxDays);
  return allowedDates.includes(shiftDate);
}

export function computeShiftOrdersSummary(orders: any[]) {
  let paidOrdersCount = 0;
  let draftOrdersCount = 0;
  let totalRevenue = 0;
  let cashTotal = 0;
  let bankingTotal = 0;
  let cardTotal = 0;
  let debtTotal = 0;

  for (const o of orders) {
    if (o.status === 'DRAFT') {
      draftOrdersCount += 1;
      continue;
    }
    paidOrdersCount += 1;
    const totalAmt = Math.max(0, Number(o.totalAmount) || 0);
    const debtAmt = Math.max(0, Number(o.debtAmount) || 0);
    const paidAmt =
      o.paidAmount !== undefined && o.paidAmount !== null
        ? Math.max(0, Number(o.paidAmount) || 0)
        : Math.max(0, totalAmt - debtAmt);

    totalRevenue += totalAmt;
    debtTotal += debtAmt;

    if (o.paymentMethod === 'CASH') {
      cashTotal += paidAmt;
    } else if (o.paymentMethod === 'BANKING') {
      bankingTotal += paidAmt;
    } else if (o.paymentMethod === 'CARD') {
      cardTotal += paidAmt;
    } else if (o.paymentMethod === 'OTHER') {
      const splits = Array.isArray(o.splitPayments) ? o.splitPayments : [];
      if (splits.length > 0) {
        for (const sp of splits) {
          const spAmt = Math.max(0, Number(sp?.amount) || 0);
          if (sp?.method === 'CASH') cashTotal += spAmt;
          else if (sp?.method === 'BANKING') bankingTotal += spAmt;
          else if (sp?.method === 'CARD') cardTotal += spAmt;
        }
      } else {
        cashTotal += paidAmt;
      }
    }
  }

  return {
    paidOrdersCount,
    draftOrdersCount,
    totalRevenue,
    cashTotal,
    bankingTotal,
    cardTotal,
    debtTotal,
  };
}

export function parseDueDateInput(raw: unknown): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

// GET /api/v1/customers/lookup?phone=...

// GET /api/v1/customers

// GET /api/v1/orders/current-shift — Tra cứu Bill bán hàng theo ngày hoặc toàn bộ lịch sử (không giới hạn ca hay số ngày)

// GET /api/v1/orders

// GET /api/v1/orders/by-code/:code

// GET /api/v1/orders/:id


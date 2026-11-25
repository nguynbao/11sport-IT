import type { ShiftCode } from "../../models/Attendance";
import { ApiError } from "../../shared/errors";

export type { ShiftCode };


// Khung giờ ca (phút trong ngày)
export const SHIFT_RULES: Record<ShiftCode, { start: number; end: number; label: string }> = {
  SHIFT_1: { start: 8 * 60 + 30, end: 17 * 60 + 30, label: 'Ca 1 (08:30-17:30)' },
  SHIFT_2: { start: 12 * 60, end: 21 * 60, label: 'Ca 2 (12:00-21:00)' },
  BOTH: { start: 8 * 60 + 30, end: 21 * 60, label: 'Ca 1 + Ca 2 (08:30-21:00)' },
};

const OFFICE_LATE_TOLERANCE_MINUTES = 5;
const SALES_LATE_TOLERANCE_MINUTES = 0;
const OFFICE_LUNCH_HOURS = 1;

/**
 * Số phút du di khi check-in theo khối:
 * - Khối Bán hàng (SALES): 0 phút (phải check-in đúng giờ 08:30 Ca 1 / 12:00 Ca 2, không du di).
 * - Khối Văn phòng (OFFICE): 5 phút (trễ quá 5 phút mới tính đi trễ).
 */
export function getLateToleranceMinutes(department?: string | null): number {
  return department === 'SALES' ? SALES_LATE_TOLERANCE_MINUTES : OFFICE_LATE_TOLERANCE_MINUTES;
}

export function getStandardHours(department: string): number {
  // OFFICE: 08:30-12:00 & 13:00-17:30 (nghỉ trưa 1h = 8h) ; SALES: ca 9h
  return department === 'OFFICE' ? 8 : 9;
}

export function getOfficeWorkdays(): number[] {
  const raw = process.env.ATTENDANCE_OFFICE_WORKDAYS || '1,2,3,4,5,6';
  const days = raw
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length > 0 ? days : [1, 2, 3, 4, 5, 6];
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toHHmm(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseHHmm(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function combineDateAndMinutes(dateStr: string, minutes: number): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/**
 * Tính lại toàn bộ chỉ số công từ giờ vào/ra (dùng chung cho Điều chỉnh & Chấm công bù).
 */
export function computeAttendanceMetrics(params: {
  date: string;
  department: string;
  shiftCode: ShiftCode;
  checkInMinutes: number;
  checkOutMinutes?: number | null;
}) {
  const rule = SHIFT_RULES[params.shiftCode] || SHIFT_RULES.SHIFT_1;
  const checkInTime = combineDateAndMinutes(params.date, params.checkInMinutes);
  const workStartMinutes = Math.max(params.checkInMinutes, rule.start);
  const workStartTime = combineDateAndMinutes(params.date, workStartMinutes);

  const rawLateMinutes = Math.max(0, params.checkInMinutes - rule.start);
  const isLate = rawLateMinutes > getLateToleranceMinutes(params.department);
  const lateMinutes = isLate ? rawLateMinutes : 0;
  let status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'COMPLETED' =
    isLate ? 'LATE' : 'ON_TIME';

  let checkOutTime: Date | undefined;
  let earlyMinutes = 0;
  let totalWorkHours = 0;
  let lunchPauseMinutes = 0;

  if (params.checkOutMinutes !== undefined && params.checkOutMinutes !== null) {
    if (params.checkOutMinutes <= params.checkInMinutes) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Giờ ra phải sau giờ vào');
    }
    checkOutTime = combineDateAndMinutes(params.date, params.checkOutMinutes);
    earlyMinutes = Math.max(0, rule.end - params.checkOutMinutes);
    let hours = Math.max(0, (params.checkOutMinutes - workStartMinutes) / 60);
    if (params.department === 'OFFICE' && params.shiftCode === 'SHIFT_1') {
      lunchPauseMinutes = OFFICE_LUNCH_HOURS * 60;
      hours = Math.max(0, hours - OFFICE_LUNCH_HOURS);
    }
    totalWorkHours = Number(hours.toFixed(2));
    status = earlyMinutes > 0 ? 'EARLY_LEAVE' : 'COMPLETED';
  }

  return {
    checkInTime,
    workStartTime,
    checkOutTime,
    lateMinutes,
    earlyMinutes,
    totalWorkHours,
    lunchPauseMinutes,
    status,
  };
}

export function requireHr(req: any) {
  const user = req.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (!['CEO', 'ADMIN', 'HR'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Chỉ CEO, HR hoặc ADMIN mới có quyền quản lý bảng công');
  }
  return user;
}

export function getOvertimeMinMinutes(): number {
  const v = Number(process.env.ATTENDANCE_OVERTIME_MIN_MINUTES ?? 30);
  return Number.isFinite(v) && v >= 0 ? v : 30;
}

/**
 * Tính bảng công tháng (dùng chung cho HR xem toàn công ty & nhân viên xem lịch công của mình).
 */

import { Router } from 'express';
import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const leaveRequestsRouter = Router();

/** Độ dài tối đa của lý do trong đơn từ */
const LEAVE_REASON_MAX_LENGTH = 100;

/** Hạn mức nghỉ không lương (OFF) tối đa của nhân viên khối SALES trong 1 tháng */
export const SALES_MAX_UNPAID_OFF_PER_MONTH = 4;

/** Trong mục đăng ký ca tuần, nhân viên Bán hàng chỉ được nghỉ tối đa 2 ngày/tuần (mặc định 1 ngày OFF + 1 ngày phép) */
export const SALES_MAX_OFF_PER_WEEK_SHIFT_REG = 2;
export const SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG = 1;
export const SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG = 1;

/** Số ngày nghỉ phép có lương cộng dồn được dùng liên tiếp tối đa trong 1 đợt / 1 tuần */
export const PAID_LEAVE_MAX_CONSECUTIVE_DAYS = 7;

/** Số ngày báo trước tối thiểu (3 tuần = 21 ngày) khi dùng từ 2 ngày phép trở đi hoặc nghỉ từ 3 ngày/tuần trở đi */
export const ADVANCE_NOTICE_DAYS_REQUIRED = 21;

/** Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng) */
export const PROBATION_MAX_MONTHS = 2;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDateStr(dateStr: string): Date {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const dt = parseLocalDateStr(dateStr);
  dt.setDate(dt.getDate() + daysToAdd);
  return toLocalDateStr(dt);
}

export function diffCalendarDays(fromDateStr: string, toDateStr: string): number {
  const d1 = parseLocalDateStr(fromDateStr);
  const d2 = parseLocalDateStr(toDateStr);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function getMondayOfDateStr(dateStr: string): string {
  const dt = parseLocalDateStr(dateStr);
  const day = dt.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return toLocalDateStr(dt);
}

export function getWeekDatesOfDateStr(dateStr: string): string[] {
  const monday = getMondayOfDateStr(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(monday, i));
}

function toYearMonthStr(val?: Date | string | null): string | null {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}/.test(val.trim())) {
    return val.trim().slice(0, 7);
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function diffMonthsInclusive(startYM: string, endYM: string): number {
  const [y1, m1] = startYM.split('-').map(Number);
  const [y2, m2] = endYM.split('-').map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  const diff = (y2 - y1) * 12 + (m2 - m1);
  return diff < 0 ? 0 : diff + 1;
}

export interface StaffPaidLeaveBalance {
  eligible: boolean;
  contractType: string;
  /** Số ngày phép được cộng từ giai đoạn thử việc (1 hoặc 2 ngày, tối đa 2 tháng thử việc) */
  probationLeaveDays: number;
  /** Số tháng làm việc chính thức tính đến tháng đang xét (mỗi tháng +1 ngày phép) */
  fulltimeMonths: number;
  /** Tổng số ngày phép tích lũy từ đầu (thử việc + chính thức) tính đến hết tháng đang xét */
  totalEarnedUpToMonth: number;
  /** Số ngày phép đã dùng ở các tháng trước tháng đang xét */
  usedBeforeMonth: number;
  /** Số ngày phép đã dùng (hoặc đang chờ duyệt) trong tháng đang xét */
  usedInMonth: number;
  /** Số ngày phép đã đăng ký ở các tháng sau tháng đang xét */
  usedAfterMonth: number;
  /** Tổng số ngày phép đã dùng tính đến hết tháng đang xét */
  usedUpToMonth: number;
  /** Tổng số ngày phép đã dùng trên toàn bộ thời gian */
  usedTotalAllTime: number;
  /** Số ngày phép khả dụng trong tháng đang xét (= totalEarnedUpToMonth - usedBeforeMonth) */
  entitledInMonth: number;
  /** Số ngày phép còn lại để dành sau tháng đang xét (= entitledInMonth - usedInMonth) */
  remainingAfterMonth: number;
  usedInMonthDates: string[];
}

/**
 * Tính toán cẩn thận quỹ ngày nghỉ phép có lương (PAID_LEAVE) tích lũy của nhân viên:
 * - Thử việc (PROBATION) mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng): mỗi tháng thử việc tích lũy 1 ngày phép.
 * - Khi lên Chính thức (FULLTIME): được cộng số ngày phép tương đương với số tháng thử việc (1 hoặc 2 ngày)
 *   VÀ mỗi tháng chính thức có thêm 1 ngày phép.
 * - Ngày phép có lương chưa dùng trong tháng được để dành lại (cộng dồn) sang các tháng tiếp theo, không bị mất.
 */
export function computePaidLeaveBalanceForStaff(
  staff: any,
  allStaffLeaves: any[],
  targetYearMonthOrDate: string,
  options?: {
    excludeLeaveId?: string;
    excludeDates?: Set<string>;
    approvedOnly?: boolean;
  }
): StaffPaidLeaveBalance {
  const targetYM = String(targetYearMonthOrDate || toLocalDateStr()).slice(0, 7);
  const contractType = staff?.contractType || 'PROBATION';
  const approvedOnly = options?.approvedOnly ?? false;
  const excludeId = options?.excludeLeaveId ? String(options.excludeLeaveId) : '';
  const excludeDates = options?.excludeDates;

  const usedBeforeSet = new Set<string>();
  const usedInMonthSet = new Set<string>();
  const usedAfterSet = new Set<string>();

  for (const l of allStaffLeaves || []) {
    if (!l || l.type !== 'PAID_LEAVE') continue;
    if (excludeId && String(l._id) === excludeId) continue;
    const validStatus = approvedOnly
      ? l.status === 'APPROVED'
      : l.status === 'APPROVED' || l.status === 'PENDING';
    if (!validStatus) continue;
    const d = String(l.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (excludeDates && excludeDates.has(d)) continue;
    const ym = d.slice(0, 7);
    if (ym < targetYM) usedBeforeSet.add(d);
    else if (ym === targetYM) usedInMonthSet.add(d);
    else usedAfterSet.add(d);
  }

  // Trường hợp chưa phải hợp đồng Chính thức (PROBATION hoặc INTERN)
  if (contractType !== 'FULLTIME') {
    let probationAccrued = 0;
    if (contractType === 'PROBATION') {
      const probStartYM =
        toYearMonthStr(staff?.probationStartDate || staff?.contractStartDate) || targetYM;
      const maxProbMonths = Math.min(
        PROBATION_MAX_MONTHS,
        Math.max(1, Number(staff?.probationMonths || PROBATION_MAX_MONTHS))
      );
      if (targetYM >= probStartYM) {
        probationAccrued = Math.min(maxProbMonths, diffMonthsInclusive(probStartYM, targetYM));
      }
    }
    return {
      eligible: false,
      contractType,
      probationLeaveDays: probationAccrued,
      fulltimeMonths: 0,
      totalEarnedUpToMonth: 0,
      usedBeforeMonth: usedBeforeSet.size,
      usedInMonth: usedInMonthSet.size,
      usedAfterMonth: usedAfterSet.size,
      usedUpToMonth: usedBeforeSet.size + usedInMonthSet.size,
      usedTotalAllTime: usedBeforeSet.size + usedInMonthSet.size + usedAfterSet.size,
      entitledInMonth: 0,
      remainingAfterMonth: 0,
      usedInMonthDates: Array.from(usedInMonthSet).sort(),
    };
  }

  // Hợp đồng Chính thức (FULLTIME):
  // 1. Số ngày phép được cộng từ giai đoạn thử việc (0, 1 hoặc 2 ngày — tối đa 2 tháng thử việc)
  let probationLeaveDays = 0;
  if (staff?.probationMonths !== undefined && staff?.probationMonths !== null) {
    probationLeaveDays = Math.min(
      PROBATION_MAX_MONTHS,
      Math.max(0, Math.round(Number(staff.probationMonths)))
    );
  } else if (staff?.probationStartDate && (staff?.fulltimeStartDate || staff?.contractStartDate)) {
    const pYM = toYearMonthStr(staff.probationStartDate);
    const fYM = toYearMonthStr(staff.fulltimeStartDate || staff.contractStartDate);
    if (pYM && fYM && fYM > pYM) {
      const [py, pm] = pYM.split('-').map(Number);
      const [fy, fm] = fYM.split('-').map(Number);
      probationLeaveDays = Math.min(PROBATION_MAX_MONTHS, Math.max(1, (fy - py) * 12 + (fm - pm)));
    }
  }

  // 2. Xác định mốc tháng bắt đầu hợp đồng Chính thức (fulltimeStartYM)
  const explicitFtStartYM = toYearMonthStr(
    staff?.fulltimeStartDate || staff?.contractStartDate || staff?.hireDate
  );

  let fulltimeStartYM: string;
  if (explicitFtStartYM) {
    fulltimeStartYM = explicitFtStartYM;
  } else {
    // Với tài khoản chưa cấu hình contractStartDate (VD: dữ liệu seed/test cũ):
    // lấy từ tháng có đơn phép đầu tiên (nếu có trước targetYM) hoặc chính targetYM
    const sortedBefore = Array.from(usedBeforeSet).sort();
    const earliestUsedYM = sortedBefore.length > 0 ? sortedBefore[0].slice(0, 7) : null;
    fulltimeStartYM = earliestUsedYM && earliestUsedYM < targetYM ? earliestUsedYM : targetYM;
  }

  // Nếu tháng đang xem/xét nằm trước khi nhân viên bắt đầu hợp đồng chính thức -> chưa có phép
  if (targetYM < fulltimeStartYM) {
    return {
      eligible: false,
      contractType,
      probationLeaveDays: 0,
      fulltimeMonths: 0,
      totalEarnedUpToMonth: 0,
      usedBeforeMonth: 0,
      usedInMonth: 0,
      usedAfterMonth: usedAfterSet.size,
      usedUpToMonth: 0,
      usedTotalAllTime: usedBeforeSet.size + usedInMonthSet.size + usedAfterSet.size,
      entitledInMonth: 0,
      remainingAfterMonth: 0,
      usedInMonthDates: [],
    };
  }

  const fulltimeMonths = diffMonthsInclusive(fulltimeStartYM, targetYM);
  const totalEarnedUpToMonth = probationLeaveDays + fulltimeMonths;
  const usedBeforeMonth = usedBeforeSet.size;
  const usedInMonth = usedInMonthSet.size;
  const usedAfterMonth = usedAfterSet.size;
  const entitledInMonth = Math.max(0, totalEarnedUpToMonth - usedBeforeMonth);
  const remainingAfterMonth = Math.max(0, entitledInMonth - usedInMonth);

  return {
    eligible: true,
    contractType,
    probationLeaveDays,
    fulltimeMonths,
    totalEarnedUpToMonth,
    usedBeforeMonth,
    usedInMonth,
    usedAfterMonth,
    usedUpToMonth: usedBeforeMonth + usedInMonth,
    usedTotalAllTime: usedBeforeMonth + usedInMonth + usedAfterMonth,
    entitledInMonth,
    remainingAfterMonth,
    usedInMonthDates: Array.from(usedInMonthSet).sort(),
  };
}

export async function getStaffPaidLeaveBalance(
  staffId: string,
  targetYearMonthOrDate: string,
  options?: { excludeLeaveId?: string; approvedOnly?: boolean }
): Promise<StaffPaidLeaveBalance> {
  const [staff, leaves] = await Promise.all([
    staffRepo.findById(staffId),
    leaveRequestRepo.find({ staffId, type: 'PAID_LEAVE' }),
  ]);
  return computePaidLeaveBalanceForStaff(staff, leaves as any[], targetYearMonthOrDate, options);
}

/**
 * Đếm độ dài chuỗi ngày nghỉ phép có lương (PAID_LEAVE) liên tiếp chứa ngày `targetDate`.
 * Với khối Văn phòng (OFFICE), ngày Chủ nhật không làm đứt chuỗi liên tiếp (T7 -> T2 tính là liên tiếp).
 */
export function getConsecutivePaidLeaveCluster(
  paidLeaveDateSet: Set<string>,
  targetDate: string,
  department = 'SALES'
): string[] {
  const allSet = new Set(paidLeaveDateSet);
  allSet.add(targetDate);

  const isStepConnected = (dStr: string, dir: -1 | 1): string | null => {
    const next1 = addDaysToDateStr(dStr, dir);
    if (allSet.has(next1)) return next1;
    // Khối OFFICE nghỉ Chủ nhật: nếu next1 là Chủ nhật và ngày kế tiếp (Thứ 2 / Thứ 7) có PAID_LEAVE thì vẫn tính liên tiếp
    if (department === 'OFFICE' && parseLocalDateStr(next1).getDay() === 0) {
      const next2 = addDaysToDateStr(dStr, dir * 2);
      if (allSet.has(next2)) return next2;
    }
    return null;
  };

  const cluster = new Set<string>([targetDate]);
  let cur = targetDate;
  while (true) {
    const prev = isStepConnected(cur, -1);
    if (!prev || cluster.has(prev)) break;
    cluster.add(prev);
    cur = prev;
  }
  cur = targetDate;
  while (true) {
    const nxt = isStepConnected(cur, 1);
    if (!nxt || cluster.has(nxt)) break;
    cluster.add(nxt);
    cur = nxt;
  }

  return Array.from(cluster).sort();
}

/**
 * Lấy tập hợp các ngày (YYYY-MM-DD) nghỉ không lương (OFF) của nhân viên Sales trong tháng (YYYY-MM).
 * Tính gộp theo ngày phân biệt từ lịch phân ca (shiftCode === 'OFF') và đơn xin nghỉ (type === 'OFF'),
 * không tính các ngày nghỉ phép có lương (PAID_LEAVE đã duyệt hoặc đang chờ duyệt).
 */
export async function getSalesMonthlyUnpaidOffDates(
  staffId: string,
  yearMonthOrDate: string,
  options?: {
    excludeShiftDates?: Set<string>;
    excludeDates?: Set<string>;
    excludeLeaveId?: string;
    includePendingLeave?: boolean;
  }
): Promise<Set<string>> {
  const ym = yearMonthOrDate.slice(0, 7); // YYYY-MM
  const monthPrefix = `${ym}-`;
  const includePending = options?.includePendingLeave ?? false;
  const excludeShiftDates = options?.excludeShiftDates;
  const excludeDates = options?.excludeDates;
  const excludeLeaveId = options?.excludeLeaveId ? String(options.excludeLeaveId) : '';

  const [leaves, shifts] = await Promise.all([
    leaveRequestRepo.find({ staffId }),
    shiftAssignmentRepo.find({ staffId }),
  ]);

  const paidLeaveDates = new Set<string>();
  for (const l of leaves as any[]) {
    const d = String(l.date || '');
    if (excludeDates && excludeDates.has(d)) continue;
    const validPaidStatus = includePending
      ? l.status === 'PENDING' || l.status === 'APPROVED'
      : l.status === 'APPROVED';
    if (d.startsWith(monthPrefix) && l.type === 'PAID_LEAVE' && validPaidStatus) {
      paidLeaveDates.add(d);
    }
  }

  const offDates = new Set<string>();

  for (const s of shifts as any[]) {
    const d = String(s.date || '');
    if (!d.startsWith(monthPrefix)) continue;
    if (excludeDates && excludeDates.has(d)) continue;
    if (excludeShiftDates && excludeShiftDates.has(d)) continue;
    if (s.shiftCode === 'OFF' && !paidLeaveDates.has(d)) {
      offDates.add(d);
    }
  }

  for (const l of leaves as any[]) {
    const d = String(l.date || '');
    if (!d.startsWith(monthPrefix)) continue;
    if (excludeDates && excludeDates.has(d)) continue;
    if (excludeLeaveId && String(l._id) === excludeLeaveId) continue;
    const validStatus = includePending
      ? l.status === 'PENDING' || l.status === 'APPROVED'
      : l.status === 'APPROVED';
    if (l.type === 'OFF' && validStatus && !paidLeaveDates.has(d)) {
      offDates.add(d);
    }
  }

  return offDates;
}

/**
 * Kiểm tra hạn mức nghỉ không lương (OFF) tối đa 4 ngày/tháng cho nhân viên khối SALES.
 */
export async function assertSalesUnpaidOffQuota(
  staffId: string,
  date: string,
  excludeLeaveId?: string,
  approvedOnly = false,
  excludeDates?: Set<string>
) {
  const staff: any = await staffRepo.findById(staffId);
  if (!staff) return;
  const dept = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
  if (dept !== 'SALES') return;

  const targetDate = String(date).trim();
  const ym = targetDate.slice(0, 7);
  const usedDates = await getSalesMonthlyUnpaidOffDates(staffId, ym, {
    excludeLeaveId,
    excludeDates,
    includePendingLeave: !approvedOnly,
  });

  if (!usedDates.has(targetDate) && usedDates.size >= SALES_MAX_UNPAID_OFF_PER_MONTH) {
    throw new ApiError(
      400,
      'SALES_OFF_QUOTA_EXCEEDED',
      `Nhân viên Sales chỉ được nghỉ không lương tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày/tháng. Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} đã dùng hết ${usedDates.size}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày (${Array.from(usedDates).sort().join(', ')}), vui lòng đợi qua tháng mới.`
    );
  }
}

/**
 * Kiểm tra hạn mức nghỉ phép có lương (PAID_LEAVE) theo cơ chế cộng dồn:
 * - Cộng số ngày phép tương ứng với số tháng thử việc (1 hoặc 2 ngày, tối đa 2 tháng) khi lên Chính thức.
 * - Cộng thêm 1 ngày phép cho mỗi tháng Chính thức (có để dành / cộng dồn qua các tháng).
 * - Có thể dùng liên tiếp tối đa 1 tuần (7 ngày).
 * @param approvedOnly khi HR duyệt / chấm công bù: chỉ đếm các đơn ĐÃ DUYỆT khác
 */
export async function assertPaidLeaveQuota(
  staffId: string,
  date: string,
  excludeId?: string,
  approvedOnly = false,
  excludeDates?: Set<string>
) {
  const targetDate = String(date).trim();
  const ym = targetDate.slice(0, 7);
  const [staff, list] = await Promise.all([
    staffRepo.findById(staffId),
    leaveRequestRepo.find({ staffId, type: 'PAID_LEAVE' }),
  ]);

  if (!staff || staff.contractType !== 'FULLTIME') {
    throw new ApiError(
      400,
      'PAID_LEAVE_NOT_ELIGIBLE',
      'Chỉ nhân viên hợp đồng Chính thức mới được sử dụng ngày nghỉ phép có lương (ngày phép ở giai đoạn thử việc sẽ được cộng dồn khi lên Chính thức)'
    );
  }

  const balance = computePaidLeaveBalanceForStaff(staff, list as any[], targetDate, {
    excludeLeaveId: excludeId,
    excludeDates,
    approvedOnly,
  });

  const alreadyCountedThisDate = balance.usedInMonthDates.includes(targetDate);
  if (!alreadyCountedThisDate && balance.remainingAfterMonth <= 0) {
    throw new ApiError(
      400,
      'PAID_LEAVE_QUOTA_EXCEEDED',
      `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} đã dùng hết quỹ ngày nghỉ phép có lương tích lũy (${balance.usedUpToMonth}/${balance.totalEarnedUpToMonth} ngày${
        balance.probationLeaveDays > 0
          ? `, bao gồm ${balance.probationLeaveDays} ngày phép thử việc`
          : ''
      })`
    );
  }

  // Kiểm tra giới hạn dùng liên tiếp tối đa 1 tuần (7 ngày)
  const dept = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
  const validPaidDates = new Set<string>();
  for (const l of list as any[]) {
    if (excludeId && String(l._id) === String(excludeId)) continue;
    if (excludeDates && excludeDates.has(String(l.date))) continue;
    const okStatus = approvedOnly
      ? l.status === 'APPROVED'
      : l.status === 'PENDING' || l.status === 'APPROVED';
    if (okStatus && l.date) validPaidDates.add(String(l.date));
  }
  const cluster = getConsecutivePaidLeaveCluster(validPaidDates, targetDate, dept);
  if (cluster.length > PAID_LEAVE_MAX_CONSECUTIVE_DAYS) {
    throw new ApiError(
      400,
      'PAID_LEAVE_WEEK_LIMIT_EXCEEDED',
      `Chỉ được sử dụng ngày nghỉ phép có lương cộng dồn tối đa 1 tuần (${PAID_LEAVE_MAX_CONSECUTIVE_DAYS} ngày) liên tiếp`
    );
  }
}

/**
 * Kiểm tra điều kiện phải tạo đơn trước tối thiểu 3 tuần (21 ngày):
 * 1. Đối với PAID_LEAVE (Nghỉ phép có lương):
 *    - Dùng 1 ngày phép đơn lẻ trong tuần: không yêu cầu tạo trước 3 tuần.
 *    - Dùng từ 2 ngày phép trở đi (trong cùng 1 tuần hoặc chuỗi liên tiếp, tối đa 1 tuần = 7 ngày):
 *      bắt buộc phải tạo đơn trước tối thiểu 3 tuần (21 ngày).
 * 2. Đối với nhân viên Bán hàng (SALES) khi xin nghỉ (OFF hoặc PAID_LEAVE):
 *    - Trong 1 tuần mặc định chỉ được nghỉ tối đa 2 ngày (1 ngày OFF + 1 ngày phép).
 *    - Từ 3 ngày nghỉ trở đi trong 1 tuần: bắt buộc phải tạo đơn trước tối thiểu 3 tuần (21 ngày).
 */
export async function assertAdvanceNoticeForLeaveRequest(params: {
  staff: any;
  type: string;
  date: string;
  excludeLeaveId?: string;
  excludeDates?: Set<string>;
  referenceTodayStr?: string;
}) {
  const { staff, type, date, excludeLeaveId, excludeDates } = params;
  if (type !== 'PAID_LEAVE' && type !== 'OFF') return;

  const targetDate = String(date).trim();
  const todayStr = params.referenceTodayStr || toLocalDateStr(new Date());
  const daysInAdvance = diffCalendarDays(todayStr, targetDate);
  const staffId = String(staff._id);
  const dept = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
  const excludeId = excludeLeaveId ? String(excludeLeaveId) : '';

  const [allLeaves, allShifts] = await Promise.all([
    leaveRequestRepo.find({ staffId }),
    shiftAssignmentRepo.find({ staffId }),
  ]);

  const weekDates = getWeekDatesOfDateStr(targetDate);
  const weekDateSet = new Set<string>(weekDates);

  // 1. Nếu là PAID_LEAVE: từ 2 ngày phép trở đi (trong cùng tuần hoặc chuỗi liên tiếp) -> phải tạo đơn trước 3 tuần (21 ngày)
  if (type === 'PAID_LEAVE') {
    const paidDates = new Set<string>();
    for (const l of allLeaves as any[]) {
      if (excludeId && String(l._id) === excludeId) continue;
      if (excludeDates && excludeDates.has(String(l.date))) continue;
      if (l.type === 'PAID_LEAVE' && (l.status === 'PENDING' || l.status === 'APPROVED') && l.date) {
        paidDates.add(String(l.date));
      }
    }
    const paidInSameWeek = Array.from(paidDates).filter((d) => weekDateSet.has(d) && d !== targetDate);
    const cluster = getConsecutivePaidLeaveCluster(paidDates, targetDate, dept);
    const totalPaidInGroup = Math.max(paidInSameWeek.length + 1, cluster.length);

    if (totalPaidInGroup > PAID_LEAVE_MAX_CONSECUTIVE_DAYS) {
      throw new ApiError(
        400,
        'PAID_LEAVE_WEEK_LIMIT_EXCEEDED',
        `Chỉ được sử dụng ngày nghỉ phép có lương cộng dồn tối đa 1 tuần (${PAID_LEAVE_MAX_CONSECUTIVE_DAYS} ngày) liên tiếp.`
      );
    }

    if (totalPaidInGroup >= 2 && daysInAdvance < ADVANCE_NOTICE_DAYS_REQUIRED) {
      throw new ApiError(
        400,
        'ADVANCE_NOTICE_REQUIRED',
        `Khi sử dụng từ 2 ngày nghỉ phép có lương trở đi (hiện chọn ${totalPaidInGroup} ngày phép, tối đa liên tiếp 1 tuần), bạn bắt buộc phải tạo đơn trước tối thiểu 3 tuần (${ADVANCE_NOTICE_DAYS_REQUIRED} ngày). Ngày ${targetDate} chỉ cách hôm nay ${daysInAdvance} ngày!`
      );
    }
  }

  // 2. Đối với nhân viên Bán hàng (SALES): trong 1 tuần không cho nghỉ quá 2 ngày khi đăng ký ca;
  // từ 3 ngày nghỉ trở đi trong 1 tuần (OFF + PAID_LEAVE) bắt buộc phải tạo đơn trước tối thiểu 3 tuần (21 ngày)
  if (dept === 'SALES') {
    const offDatesInWeek = new Set<string>([targetDate]);
    for (const l of allLeaves as any[]) {
      if (excludeId && String(l._id) === excludeId) continue;
      if (excludeDates && excludeDates.has(String(l.date))) continue;
      if (
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED') &&
        weekDateSet.has(String(l.date))
      ) {
        offDatesInWeek.add(String(l.date));
      }
    }
    for (const s of allShifts as any[]) {
      if (excludeDates && excludeDates.has(String(s.date))) continue;
      if (s.shiftCode === 'OFF' && weekDateSet.has(String(s.date))) {
        offDatesInWeek.add(String(s.date));
      }
    }

    if (offDatesInWeek.size >= 3 && daysInAdvance < ADVANCE_NOTICE_DAYS_REQUIRED) {
      throw new ApiError(
        400,
        'ADVANCE_NOTICE_REQUIRED',
        `Nhân viên Bán hàng chỉ được đăng ký nghỉ tối đa 2 ngày/tuần (mặc định 1 ngày OFF và 1 ngày phép). Khi xin nghỉ từ 3 ngày trở đi trong tuần (tuần này đã có ${offDatesInWeek.size} ngày nghỉ), bắt buộc phải tạo đơn trước tối thiểu 3 tuần (${ADVANCE_NOTICE_DAYS_REQUIRED} ngày)!`
      );
    }
  }
}

// POST /api/v1/leave-requests
leaveRequestsRouter.post('/leave-requests', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const staff = await staffRepo.findById(user.userId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    const { type, date, fromDate, sourceLeaveId, reason } = req.body || {};
    if (!type || !date || !reason) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng điền đầy đủ loại đơn, ngày và lý do');
    }

    if (String(reason).trim().length > LEAVE_REASON_MAX_LENGTH) {
      throw new ApiError(
        400,
        'REASON_TOO_LONG',
        `Lý do tối đa ${LEAVE_REASON_MAX_LENGTH} ký tự`,
        { reason: `Tối đa ${LEAVE_REASON_MAX_LENGTH} ký tự` }
      );
    }

    if (!['WFH', 'OFF', 'LATE', 'EARLY', 'PAID_LEAVE', 'CHANGE_OFF'].includes(type)) {
      throw new ApiError(400, 'INVALID_TYPE', 'Loại đơn không hợp lệ');
    }

    const cleanDate = String(date).trim();
    const dept = (staff as any).department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');

    // Xử lý riêng cho loại đơn Xin chuyển ngày off (CHANGE_OFF)
    if (type === 'CHANGE_OFF') {
      const cleanFromDate = String(fromDate || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        throw new ApiError(
          400,
          'INVALID_CHANGE_OFF_DATES',
          'Vui lòng chọn đầy đủ ngày off hiện tại (fromDate) và ngày off mới muốn chuyển sang (date)'
        );
      }
      if (cleanFromDate === cleanDate) {
        throw new ApiError(
          400,
          'INVALID_CHANGE_OFF_DATES',
          'Ngày off mới phải khác với ngày off ban đầu'
        );
      }
      if (dept === 'OFFICE' && parseLocalDateStr(cleanDate).getDay() === 0) {
        throw new ApiError(
          400,
          'INVALID_CHANGE_OFF_DATES',
          'Khối Văn phòng nghỉ cố định Chủ nhật, không cần đổi ngày off sang Chủ nhật'
        );
      }

      const [staffLeaves, staffShifts] = await Promise.all([
        leaveRequestRepo.find({ staffId: staff._id }),
        shiftAssignmentRepo.find({ staffId: staff._id }),
      ]);

      // Kiểm tra tại ngày cũ (cleanFromDate) có đơn OFF/PAID_LEAVE hoặc phân ca OFF không
      const fromOffLeaves = (staffLeaves as any[]).filter(
        (l) =>
          String(l.date) === cleanFromDate &&
          (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
          (l.status === 'PENDING' || l.status === 'APPROVED')
      );
      const matchedSourceLeave =
        (sourceLeaveId && fromOffLeaves.find((l) => String(l._id) === String(sourceLeaveId))) ||
        fromOffLeaves.find((l) => l.type === 'PAID_LEAVE') ||
        fromOffLeaves[0] ||
        null;

      const fromShiftOff = (staffShifts as any[]).find(
        (s) => String(s.date) === cleanFromDate && s.shiftCode === 'OFF'
      );

      if (!matchedSourceLeave && !fromShiftOff) {
        throw new ApiError(
          400,
          'SOURCE_OFF_NOT_FOUND',
          `Ngày ${cleanFromDate} bạn chưa có đơn nghỉ (OFF / Nghỉ phép) hoặc lịch ca OFF nào để chuyển đổi`
        );
      }

      // Kiểm tra tại ngày mới (cleanDate) đã có lịch nghỉ hay đơn nghỉ chưa
      const targetAlreadyLeave = (staffLeaves as any[]).some(
        (l) =>
          String(l.date) === cleanDate &&
          (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
          (l.status === 'PENDING' || l.status === 'APPROVED')
      );
      const targetAlreadyShiftOff =
        dept === 'SALES' &&
        (staffShifts as any[]).some((s) => String(s.date) === cleanDate && s.shiftCode === 'OFF');

      if (targetAlreadyLeave || targetAlreadyShiftOff) {
        throw new ApiError(
          400,
          'TARGET_DATE_ALREADY_OFF',
          `Ngày ${cleanDate} bạn đã có lịch nghỉ hoặc đơn xin nghỉ rồi, vui lòng chọn ngày khác`
        );
      }

      // Kiểm tra trùng đơn CHANGE_OFF đang chờ duyệt
      const pendingChangeDup = (staffLeaves as any[]).some(
        (l) =>
          l.type === 'CHANGE_OFF' &&
          l.status === 'PENDING' &&
          (String(l.fromDate) === cleanFromDate || String(l.date) === cleanDate)
      );
      if (pendingChangeDup) {
        throw new ApiError(
          400,
          'DUPLICATE_REQUEST',
          'Bạn đã có đơn xin chuyển ngày off đang chờ HR duyệt cho ngày này'
        );
      }

      const resolvedSourceOffType: 'OFF' | 'PAID_LEAVE' =
        matchedSourceLeave?.type === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF';
      const resolvedSourceLeaveId = matchedSourceLeave ? String(matchedSourceLeave._id) : undefined;
      const excludeDatesSet = new Set<string>([cleanFromDate]);

      if (resolvedSourceOffType === 'PAID_LEAVE') {
        await assertPaidLeaveQuota(
          String(staff._id),
          cleanDate,
          resolvedSourceLeaveId,
          false,
          excludeDatesSet
        );
      } else {
        await assertSalesUnpaidOffQuota(
          String(staff._id),
          cleanDate,
          resolvedSourceLeaveId,
          false,
          excludeDatesSet
        );
      }

      // Kiểm tra điều kiện báo trước tối thiểu 3 tuần (21 ngày) tại ngày đích (loại trừ ngày nguồn cleanFromDate)
      await assertAdvanceNoticeForLeaveRequest({
        staff,
        type: resolvedSourceOffType,
        date: cleanDate,
        excludeLeaveId: resolvedSourceLeaveId,
        excludeDates: excludeDatesSet,
      });

      const createdChange = await leaveRequestRepo.create({
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        department: dept,
        type: 'CHANGE_OFF',
        date: cleanDate,
        fromDate: cleanFromDate,
        sourceLeaveId: resolvedSourceLeaveId,
        sourceOffType: resolvedSourceOffType,
        reason: String(reason).trim(),
        status: 'PENDING',
      });

      return res.status(201).json({
        data: createdChange,
        meta: {},
      });
    }

    const dup = await leaveRequestRepo.find({ staffId: staff._id, date: cleanDate, type });
    if (dup.some((d: any) => d.status === 'PENDING' || d.status === 'APPROVED')) {
      throw new ApiError(400, 'DUPLICATE_REQUEST', 'Bạn đã có đơn cùng loại cho ngày này (đang chờ duyệt hoặc đã duyệt)');
    }

    // Nghỉ phép có lương: chỉ hợp đồng Chính thức, cộng dồn từ thử việc (1-2 tháng) + mỗi tháng chính thức (+1 ngày)
    if (type === 'PAID_LEAVE') {
      if (staff.contractType !== 'FULLTIME') {
        throw new ApiError(
          400,
          'PAID_LEAVE_NOT_ELIGIBLE',
          'Chỉ nhân viên hợp đồng Chính thức mới có ngày nghỉ phép có lương (ngày phép giai đoạn thử việc sẽ được cộng khi lên Chính thức)'
        );
      }
      await assertPaidLeaveQuota(String(staff._id), cleanDate);
    }

    // Nghỉ không lương (OFF): nhân viên khối SALES tối đa 4 ngày/tháng
    if (type === 'OFF') {
      await assertSalesUnpaidOffQuota(String(staff._id), cleanDate, undefined, false);
    }

    // Kiểm tra điều kiện tạo đơn trước tối thiểu 3 tuần (21 ngày) khi dùng >= 2 ngày phép hoặc nghỉ >= 3 ngày/tuần
    await assertAdvanceNoticeForLeaveRequest({
      staff,
      type,
      date: cleanDate,
    });

    const created = await leaveRequestRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department: dept,
      type,
      date: cleanDate,
      reason: String(reason).trim(),
      status: 'PENDING',
    });

    res.status(201).json({
      data: created,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leave-requests
leaveRequestsRouter.get('/leave-requests', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { status, type, date, staffId, mine } = req.query;
    const filter: Record<string, any> = {};

    if (String(mine) === 'true') {
      filter.staffId = user.userId;
      if (status) filter.status = String(status);
      if (type) filter.type = String(type);
      if (date) filter.date = String(date);
    } else if (['CEO', 'ADMIN', 'HR'].includes(user.role)) {
      if (status) filter.status = String(status);
      if (type) filter.type = String(type);
      if (date) filter.date = String(date);
      if (staffId) filter.staffId = String(staffId);
    } else {
      filter.staffId = user.userId;
      if (status) filter.status = String(status);
    }

    const list = await leaveRequestRepo.find(filter);
    list.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    res.json({
      data: list,
      meta: { total: list.length },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/leave-requests/:id (Nhân viên hủy đơn đang chờ duyệt của mình)
leaveRequestsRouter.delete('/leave-requests/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const request: any = await leaveRequestRepo.findById(req.params.id);
    if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
    if (String(request.staffId) !== String(user.userId)) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được hủy đơn của chính mình');
    }
    if (request.status !== 'PENDING') {
      throw new ApiError(400, 'REQUEST_ALREADY_REVIEWED', 'Đơn đã được HR xử lý, không thể hủy');
    }
    await leaveRequestRepo.deleteById(String(request._id));
    res.json({ data: { success: true }, meta: { message: 'Đã hủy đơn' } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/leave-requests/:id (HR / Admin / CEO duyệt)
leaveRequestsRouter.patch('/leave-requests/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['CEO', 'ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ CEO, HR hoặc ADMIN mới có quyền duyệt đơn');
    }

    const { id } = req.params;
    const request = await leaveRequestRepo.findById(id);
    if (!request) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
    }

    const { status, reviewNote = '' } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái duyệt phải là APPROVED hoặc REJECTED');
    }

    const reqDoc: any = request;
    const staffId = String(reqDoc.staffId);
    const targetDate = String(reqDoc.date).trim();
    const reviewerName = user.fullName || user.username || 'HR';

    if (status === 'APPROVED' && reqDoc.type === 'PAID_LEAVE') {
      await assertPaidLeaveQuota(staffId, targetDate, String(id), true);
    }

    if (status === 'APPROVED' && reqDoc.type === 'OFF') {
      await assertSalesUnpaidOffQuota(staffId, targetDate, String(id), true);
    }

    // Khi HR duyệt đơn Xin chuyển ngày off (CHANGE_OFF):
    // Chuyển ngày nghỉ từ fromDate sang targetDate và đồng bộ lịch phân ca (với khối SALES)
    if (status === 'APPROVED' && reqDoc.type === 'CHANGE_OFF') {
      const fromDate = String(reqDoc.fromDate || '').trim();
      const sourceOffType: 'OFF' | 'PAID_LEAVE' =
        reqDoc.sourceOffType === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF';
      const sourceLeaveId = reqDoc.sourceLeaveId ? String(reqDoc.sourceLeaveId) : undefined;
      const excludeDatesSet = new Set<string>(fromDate ? [fromDate] : []);

      if (sourceOffType === 'PAID_LEAVE') {
        await assertPaidLeaveQuota(staffId, targetDate, sourceLeaveId, true, excludeDatesSet);
      } else {
        await assertSalesUnpaidOffQuota(staffId, targetDate, sourceLeaveId, true, excludeDatesSet);
      }

      const [staffLeaves, staffShifts] = await Promise.all([
        leaveRequestRepo.find({ staffId: reqDoc.staffId }),
        shiftAssignmentRepo.find({ staffId: reqDoc.staffId }),
      ]);

      const fromAssign = (staffShifts as any[]).find((s) => String(s.date) === fromDate);
      const targetAssign = (staffShifts as any[]).find((s) => String(s.date) === targetDate);

      // 1. Kiểm tra lại đơn nghỉ gốc ở fromDate và kiểm tra xung đột ở targetDate trước khi duyệt
      const activeFromLeaves = (staffLeaves as any[]).filter(
        (l) =>
          String(l._id) !== String(id) &&
          String(l.date) === fromDate &&
          (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
          (l.status === 'PENDING' || l.status === 'APPROVED')
      );

      const primaryLeave =
        (sourceLeaveId &&
          (staffLeaves as any[]).find(
            (l) =>
              String(l._id) === sourceLeaveId &&
              String(l.date) === fromDate &&
              (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
              (l.status === 'PENDING' || l.status === 'APPROVED')
          )) ||
        activeFromLeaves.find((l) => l.type === sourceOffType) ||
        activeFromLeaves[0] ||
        null;

      if (!primaryLeave && (!fromAssign || fromAssign.shiftCode !== 'OFF')) {
        throw new ApiError(
          400,
          'SOURCE_OFF_NOT_FOUND',
          `Ngày gốc (${fromDate}) hiện không còn lịch nghỉ hoặc đơn xin nghỉ hợp lệ để chuyển.`
        );
      }

      const conflictingTargetLeave = (staffLeaves as any[]).find(
        (l) =>
          String(l._id) !== String(id) &&
          (!primaryLeave || String(l._id) !== String(primaryLeave._id)) &&
          String(l.date) === targetDate &&
          (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
          (l.status === 'PENDING' || l.status === 'APPROVED')
      );

      if (conflictingTargetLeave || (targetAssign && targetAssign.shiftCode === 'OFF')) {
        throw new ApiError(
          400,
          'TARGET_DATE_ALREADY_OFF',
          `Ngày đích (${targetDate}) đã có lịch nghỉ hoặc đơn xin nghỉ khác. Không thể duyệt chuyển ngày off sang ngày này.`
        );
      }

      const staffDoc = (await staffRepo.findById(staffId)) || {
        _id: staffId,
        department: reqDoc.department || 'OFFICE',
        role: reqDoc.department === 'SALES' ? 'SALES' : 'OFFICE',
      };
      const createdDayStr =
        reqDoc.createdAt && !Number.isNaN(new Date(reqDoc.createdAt).getTime())
          ? toLocalDateStr(new Date(reqDoc.createdAt))
          : undefined;

      await assertAdvanceNoticeForLeaveRequest({
        staff: staffDoc,
        type: sourceOffType,
        date: targetDate,
        excludeLeaveId: primaryLeave ? String(primaryLeave._id) : sourceLeaveId,
        excludeDates: excludeDatesSet,
        referenceTodayStr: createdDayStr,
      });

      const noteSuffix = `Đã đổi ngày off từ ${fromDate} sang ${targetDate}`;

      if (primaryLeave) {
        await leaveRequestRepo.updateById(String(primaryLeave._id), {
          date: targetDate,
          type: sourceOffType,
          status: 'APPROVED',
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
          reviewNote: String(reviewNote).trim() || noteSuffix,
        });
        for (const extra of activeFromLeaves) {
          if (String(extra._id) !== String(primaryLeave._id)) {
            await leaveRequestRepo.deleteById(String(extra._id));
          }
        }
      } else {
        await leaveRequestRepo.create({
          staffId: reqDoc.staffId,
          staffCode: reqDoc.staffCode,
          staffName: reqDoc.staffName,
          department: reqDoc.department || 'OFFICE',
          type: sourceOffType,
          date: targetDate,
          reason: `${reqDoc.reason} (${noteSuffix})`.slice(0, LEAVE_REASON_MAX_LENGTH),
          status: 'APPROVED',
          reviewedBy: reviewerName,
          reviewedAt: new Date(),
          reviewNote: String(reviewNote).trim() || noteSuffix,
        });
      }

      // 2. Đồng bộ lịch phân ca (ShiftAssignment) nếu là nhân viên khối SALES hoặc đã có phân ca
      const isSales = reqDoc.department === 'SALES';

      if (isSales || fromAssign || targetAssign) {
        const replacementWorkShift: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' =
          targetAssign &&
          (targetAssign.shiftCode === 'SHIFT_1' ||
            targetAssign.shiftCode === 'SHIFT_2' ||
            targetAssign.shiftCode === 'BOTH')
            ? targetAssign.shiftCode
            : fromAssign &&
                (fromAssign.preferenceShift === 'SHIFT_1' ||
                  fromAssign.preferenceShift === 'SHIFT_2' ||
                  fromAssign.preferenceShift === 'BOTH')
              ? fromAssign.preferenceShift
              : 'SHIFT_1';

        if (fromAssign) {
          await shiftAssignmentRepo.updateById(fromAssign._id, {
            shiftCode: replacementWorkShift,
            preferenceShift: replacementWorkShift,
            isOffRequested: false,
            seenByStaff: false,
          });
        } else if (isSales && fromDate) {
          const fromDow = parseLocalDateStr(fromDate).getDay() || 7;
          await shiftAssignmentRepo.create({
            weekStart: getMondayOfDateStr(fromDate),
            date: fromDate,
            dayOfWeek: fromDow,
            staffId: reqDoc.staffId,
            staffCode: reqDoc.staffCode,
            staffName: reqDoc.staffName,
            shiftCode: replacementWorkShift,
            preferenceShift: replacementWorkShift,
            isOffRequested: false,
            assignedBy: targetAssign?.assignedBy || 'HR',
            confirmedAt: new Date(),
            seenByStaff: false,
          });
        }

        if (targetAssign) {
          await shiftAssignmentRepo.updateById(targetAssign._id, {
            shiftCode: 'OFF',
            preferenceShift: 'OFF',
            isOffRequested: true,
            seenByStaff: false,
          });
        } else if (isSales) {
          const targetDow = parseLocalDateStr(targetDate).getDay() || 7;
          await shiftAssignmentRepo.create({
            weekStart: getMondayOfDateStr(targetDate),
            date: targetDate,
            dayOfWeek: targetDow,
            staffId: reqDoc.staffId,
            staffCode: reqDoc.staffCode,
            staffName: reqDoc.staffName,
            shiftCode: 'OFF',
            preferenceShift: 'OFF',
            isOffRequested: true,
            assignedBy: fromAssign?.assignedBy || 'HR',
            confirmedAt: new Date(),
            seenByStaff: false,
          });
        }
      }
    }

    const updated = await leaveRequestRepo.updateById(id, {
      status,
      reviewNote: String(reviewNote).trim(),
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    });

    res.json({
      data: updated,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

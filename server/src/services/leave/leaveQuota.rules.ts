import {
  addDaysToDateStr,
  diffMonthsInclusive,
  parseLocalDateStr,
  toLocalDateStr,
  toYearMonthStr,
} from "../../shared/date";
import { ApiError } from "../../shared/errors";

export const SALES_MAX_UNPAID_OFF_PER_MONTH = 4;
export const SALES_MAX_OFF_PER_WEEK_SHIFT_REG = 2;
export const SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG = 1;
export const SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG = 1;
export const PAID_LEAVE_MAX_CONSECUTIVE_DAYS = 7;
export const ADVANCE_NOTICE_DAYS_REQUIRED = 21;
export const PROBATION_MAX_MONTHS = 2;

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

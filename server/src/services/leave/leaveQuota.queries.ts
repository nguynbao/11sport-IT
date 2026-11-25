import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from "../../repositories";
import { addDaysToDateStr, diffCalendarDays, getWeekDatesOfDateStr, toLocalDateStr, toYearMonthStr } from "../../shared/date";
import { ApiError } from "../../shared/errors";
import {
  ADVANCE_NOTICE_DAYS_REQUIRED,
  PAID_LEAVE_MAX_CONSECUTIVE_DAYS,
  SALES_MAX_UNPAID_OFF_PER_MONTH,
  computePaidLeaveBalanceForStaff,
  getConsecutivePaidLeaveCluster,
  StaffPaidLeaveBalance,
} from "./leaveQuota.rules";

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


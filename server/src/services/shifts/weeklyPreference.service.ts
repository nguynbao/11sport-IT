import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from '../../repositories';
import { ShiftType } from '../../models/ShiftAssignment';
import { addDaysToDateStr } from '../../shared/date';
import { ApiError } from '../../shared/errors';
import { ServiceContext } from '../../shared/http';
import { ok, ServiceResult } from '../../shared/result';
import {
  ADVANCE_NOTICE_DAYS_REQUIRED,
  assertPaidLeaveQuota,
  getSalesMonthlyUnpaidOffDates,
  getStaffPaidLeaveBalance,
  SALES_MAX_OFF_PER_WEEK_SHIFT_REG,
  SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG,
  SALES_MAX_UNPAID_OFF_PER_MONTH,
  SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG,
} from '../leave';
import {
  getCurrentMondayStr,
  getNextMondayStr,
  SHIFT_REG_PAID_LEAVE_REASON,
} from './schedule.rules';

/**
 * Tự động phân bổ các bản ghi đăng ký 2 ca/ngày (preferenceShift === 'BOTH' & assignedBy === 'AUTO'):
 * - Nếu trong ngày đó có ca bị trống: cho phép làm cả 2 ca ('BOTH').
 * - Nếu cả Ca 1 và Ca 2 đều đã có người trực: random 1 trong 2 ca ('SHIFT_1' hoặc 'SHIFT_2').
 */
async function reconcileAutoShiftPreferencesForWeek(weekStart: string): Promise<void> {
  const allAssign = await shiftAssignmentRepo.find({});
  for (let i = 0; i < 7; i++) {
    const date = addDaysToDateStr(weekStart, i);
    const dayAssigns = (allAssign as any[]).filter((a) => a.date === date);
    const bothAutoAssigns = dayAssigns.filter(
      (a) => a.assignedBy === 'AUTO' && a.preferenceShift === 'BOTH' && a.shiftCode !== 'OFF'
    );
    if (bothAutoAssigns.length === 0) continue;

    const fixedAssigns = dayAssigns.filter(
      (a) => !(a.assignedBy === 'AUTO' && a.preferenceShift === 'BOTH')
    );
    let hasShift1 = fixedAssigns.some((a) => a.shiftCode === 'SHIFT_1' || a.shiftCode === 'BOTH');
    let hasShift2 = fixedAssigns.some((a) => a.shiftCode === 'SHIFT_2' || a.shiftCode === 'BOTH');

    for (const rec of bothAutoAssigns) {
      let targetShift: ShiftType;
      if (!hasShift1 || !hasShift2) {
        targetShift = 'BOTH';
        hasShift1 = true;
        hasShift2 = true;
      } else {
        targetShift =
          rec.shiftCode === 'SHIFT_1' || rec.shiftCode === 'SHIFT_2'
            ? rec.shiftCode
            : Math.random() < 0.5
              ? 'SHIFT_1'
              : 'SHIFT_2';
      }
      if (rec.shiftCode !== targetShift) {
        await shiftAssignmentRepo.updateById(rec._id, { shiftCode: targetShift });
        rec.shiftCode = targetShift;
      }
    }
  }
}

export async function registerWeeklyPreferences(
  ctx: ServiceContext,
  body: any
): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const { weekStart, preferences } = body || {};
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart)) || !Array.isArray(preferences)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu đăng ký ca không hợp lệ');
  }

  const staff = await staffRepo.findById(user.userId);
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

  if (preferences.length !== 7) {
    throw new ApiError(
      400,
      'WEEKLY_OFF_REQUIRED',
      `Vui lòng đăng ký đủ 7 ngày trong tuần (mặc định tối đa ${SALES_MAX_OFF_PER_WEEK_SHIFT_REG} ngày nghỉ/tuần gồm ${SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG} ngày OFF không lương và ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương)`
    );
  }

  const weekEnd = addDaysToDateStr(String(weekStart), 6);
  const allStaffAssign = await shiftAssignmentRepo.find({ staffId: staff._id });
  const weekAssign = allStaffAssign.filter((a: any) => a.date >= String(weekStart) && a.date <= weekEnd);
  if (weekAssign.length === 7 && weekAssign.every((a: any) => a.assignedBy === 'HR')) {
    throw new ApiError(
      400,
      'SCHEDULE_ALREADY_CONFIRMED',
      'Lịch ca tuần này đã được HR xác nhận. Vui lòng liên hệ HR nếu cần điều chỉnh!'
    );
  }

  const weekDateSet = new Set<string>(preferences.map((item: any) => String(item?.date || '')));
  const allStaffLeaves = await leaveRequestRepo.find({ staffId: staff._id });
  const activeWeekLeaves = (allStaffLeaves as any[]).filter(
    (l) =>
      weekDateSet.has(String(l.date || '')) &&
      (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
      (l.status === 'PENDING' || l.status === 'APPROVED')
  );

  const formalLeaveByDate = new Map<string, any>();
  const shiftRegPaidLeaveByDate = new Map<string, any>();
  for (const l of activeWeekLeaves) {
    const d = String(l.date);
    if (l.reason === SHIFT_REG_PAID_LEAVE_REASON && l.type === 'PAID_LEAVE') {
      shiftRegPaidLeaveByDate.set(d, l);
    } else {
      formalLeaveByDate.set(d, l);
    }
  }

  const offItems = preferences.filter(
    (item: any) => Boolean(item?.isOffRequested) || item?.preferenceShift === 'OFF'
  );
  const offCount = offItems.length;
  const regOffItems = offItems.filter((item: any) => !formalLeaveByDate.has(String(item.date)));

  if (offCount > SALES_MAX_OFF_PER_WEEK_SHIFT_REG && regOffItems.length > 0) {
    throw new ApiError(
      400,
      'WEEKLY_OFF_REQUIRED',
      `Trong mục Đăng ký ca tuần, nhân viên Bán hàng không được nghỉ quá ${SALES_MAX_OFF_PER_WEEK_SHIFT_REG} ngày/tuần (mặc định tối đa ${SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG} ngày OFF không lương và ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương). Nếu muốn nghỉ từ 3 ngày trở đi trong tuần, bắt buộc phải Tạo đơn trước tối thiểu 3 tuần (${ADVANCE_NOTICE_DAYS_REQUIRED} ngày)!`
    );
  }

  let explicitUnpaidCount = 0;
  let explicitPaidLeaveCount = 0;
  const regItemResolvedType = new Map<string, 'OFF' | 'PAID_LEAVE'>();

  if (regOffItems.length > 0) {
    for (const item of offItems) {
      const formal = formalLeaveByDate.get(String(item.date));
      if (!formal) continue;
      if (formal.type === 'PAID_LEAVE') explicitPaidLeaveCount++;
      else if (formal.type === 'OFF') explicitUnpaidCount++;
    }
  }

  for (const item of regOffItems) {
    const d = String(item.date);
    if (item.leaveType === 'PAID_LEAVE') {
      regItemResolvedType.set(d, 'PAID_LEAVE');
      explicitPaidLeaveCount++;
    } else if (item.leaveType === 'OFF') {
      regItemResolvedType.set(d, 'OFF');
      explicitUnpaidCount++;
    } else if (shiftRegPaidLeaveByDate.has(d)) {
      regItemResolvedType.set(d, 'PAID_LEAVE');
      explicitPaidLeaveCount++;
    }
  }

  for (const item of regOffItems) {
    const d = String(item.date);
    if (regItemResolvedType.has(d)) continue;
    if (explicitUnpaidCount < SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG) {
      regItemResolvedType.set(d, 'OFF');
      explicitUnpaidCount++;
    } else {
      regItemResolvedType.set(d, 'PAID_LEAVE');
      explicitPaidLeaveCount++;
    }
  }

  if (explicitUnpaidCount > SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG) {
    throw new ApiError(
      400,
      'WEEKLY_OFF_REQUIRED',
      `Đăng ký ca tuần mặc định chỉ được tối đa ${SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG} ngày OFF không lương và ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương. Không thể chọn ${explicitUnpaidCount} ngày OFF không lương trong mục Đăng ký ca!`
    );
  }

  if (explicitPaidLeaveCount > SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG) {
    throw new ApiError(
      400,
      'WEEKLY_OFF_REQUIRED',
      `Đăng ký ca tuần mặc định chỉ được chọn tối đa ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương. Từ 2 ngày phép trở đi bắt buộc phải Tạo đơn trước tối thiểu 3 tuần (${ADVANCE_NOTICE_DAYS_REQUIRED} ngày)!`
    );
  }

  const selectedRegPaidLeaveDates = Array.from(regItemResolvedType.entries())
    .filter(([, t]) => t === 'PAID_LEAVE')
    .map(([d]) => d);

  for (const paidDate of selectedRegPaidLeaveDates) {
    if ((staff as any).contractType !== 'FULLTIME') {
      throw new ApiError(
        400,
        'WEEKLY_OFF_REQUIRED',
        `Đăng ký ca tuần mặc định chỉ được ${SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG} ngày OFF không lương và ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương (dành cho HĐ Chính thức). Nhân viên Thử việc chưa thể dùng ngày phép trong đăng ký ca!`
      );
    }
    const existingAutoLeave = shiftRegPaidLeaveByDate.get(paidDate);
    await assertPaidLeaveQuota(
      String(staff._id),
      paidDate,
      existingAutoLeave ? String(existingAutoLeave._id) : undefined,
      false
    );
  }

  const unpaidOffDatesInWeek = offItems
    .map((item: any) => String(item.date))
    .filter((d) => {
      const formal = formalLeaveByDate.get(d);
      if (formal) return formal.type === 'OFF';
      return regItemResolvedType.get(d) !== 'PAID_LEAVE';
    });

  const monthsInWeek = Array.from(new Set(Array.from(weekDateSet).map((d) => d.slice(0, 7))));
  for (const ym of monthsInWeek) {
    const usedOutsideWeek = await getSalesMonthlyUnpaidOffDates(String(staff._id), ym, {
      excludeShiftDates: weekDateSet,
      includePendingLeave: true,
    });
    const offDatesInMonthThisWeek = unpaidOffDatesInWeek.filter(
      (d: string) => d.startsWith(`${ym}-`) && !usedOutsideWeek.has(d)
    );
    const totalInMonth = usedOutsideWeek.size + offDatesInMonthThisWeek.length;
    if (totalInMonth > SALES_MAX_UNPAID_OFF_PER_MONTH) {
      const remaining = Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - usedOutsideWeek.size);
      throw new ApiError(
        400,
        'SALES_OFF_QUOTA_EXCEEDED',
        remaining === 0
          ? `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} bạn đã dùng hết ${SALES_MAX_UNPAID_OFF_PER_MONTH}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương (OFF). Các tuần còn lại trong tháng không được đăng ký OFF không lương thêm (bạn vẫn có thể dùng 1 ngày phép tích lũy nếu còn)!`
          : `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} chỉ còn ${remaining}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương (đã dùng ${usedOutsideWeek.size} ngày ở tuần khác), nhưng tuần này bạn đang chọn ${offDatesInMonthThisWeek.length} ngày OFF không lương.`
      );
    }
  }

  for (const [oldDate, oldLeave] of shiftRegPaidLeaveByDate.entries()) {
    if (!selectedRegPaidLeaveDates.includes(oldDate) && oldLeave.status === 'PENDING') {
      await leaveRequestRepo.deleteById(String(oldLeave._id));
    }
  }

  const department = (staff as any).department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
  for (const paidDate of selectedRegPaidLeaveDates) {
    if (!shiftRegPaidLeaveByDate.has(paidDate)) {
      await leaveRequestRepo.create({
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        department,
        type: 'PAID_LEAVE',
        date: paidDate,
        reason: SHIFT_REG_PAID_LEAVE_REASON,
        status: 'PENDING',
      });
    }
  }

  const createdRecords = [];
  for (const item of preferences) {
    const { date, dayOfWeek, isOffRequested = false, preferenceShift = 'SHIFT_1' } = item;
    const existing =
      (await shiftAssignmentRepo.findOne({ date, staffId: String(staff._id) })) ||
      (await shiftAssignmentRepo.findOne({ date, staffId: staff._id }));

    const prefShift: ShiftType =
      isOffRequested || preferenceShift === 'OFF'
        ? 'OFF'
        : preferenceShift === 'BOTH'
          ? 'BOTH'
          : preferenceShift === 'SHIFT_2'
            ? 'SHIFT_2'
            : 'SHIFT_1';

    const payload = {
      weekStart: String(weekStart),
      date: String(date),
      dayOfWeek: Number(dayOfWeek) || 1,
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      shiftCode: prefShift === 'BOTH' ? (Math.random() < 0.5 ? 'SHIFT_1' : 'SHIFT_2') : prefShift,
      preferenceShift: prefShift,
      isOffRequested: prefShift === 'OFF',
      assignedBy: 'AUTO' as const,
      seenByStaff: true,
    };

    if (existing) {
      createdRecords.push(await shiftAssignmentRepo.updateById(existing._id, payload));
    } else {
      createdRecords.push(await shiftAssignmentRepo.create(payload));
    }
  }

  await reconcileAutoShiftPreferencesForWeek(String(weekStart));

  const refreshedAll = await shiftAssignmentRepo.find({ staffId: staff._id });
  const finalCreated = refreshedAll
    .filter((a: any) => a.date >= String(weekStart) && a.date <= weekEnd)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  return ok(finalCreated.length ? finalCreated : createdRecords, {
    message: 'Đăng ký ca làm việc tuần tới thành công! Đang chờ HR xác nhận.',
  });
}

export async function getMySchedule(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const nextMonday = getNextMondayStr();
  const currentMonday = getCurrentMondayStr();
  const targetWeekStart =
    typeof query?.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.weekStart)
      ? query.weekStart
      : nextMonday;
  const targetWeekEnd = addDaysToDateStr(targetWeekStart, 6);

  const allAssign = await shiftAssignmentRepo.find({});
  const myAssign = allAssign.filter((a: any) => String(a.staffId) === String(user.userId));

  const weekAssignments = myAssign
    .filter((a: any) => a.date >= targetWeekStart && a.date <= targetWeekEnd)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  const currentWeekEnd = addDaysToDateStr(currentMonday, 6);
  const currentWeekAssignments = myAssign
    .filter((a: any) => a.date >= currentMonday && a.date <= currentWeekEnd)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  const unseenConfirmed = myAssign.filter(
    (a: any) =>
      a.date >= currentMonday && (a.assignedBy === 'HR' || a.overrideOffNotice) && !a.seenByStaff
  );

  const isConfirmedByHr =
    weekAssignments.length === 7 && weekAssignments.every((a: any) => a.assignedBy === 'HR');
  const isRegistered = weekAssignments.length > 0;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(targetWeekStart, i));
  const weekDateSet = new Set<string>(weekDates);
  const monthsInWeek = Array.from(new Set(weekDates.map((d) => d.slice(0, 7))));
  const primaryMonth = targetWeekStart.slice(0, 7);
  const byMonth: Record<
    string,
    {
      limit: number;
      usedTotal: number;
      usedOutsideWeek: number;
      remainingForWeek: number;
      usedDatesOutsideWeek: string[];
    }
  > = {};

  for (const ym of monthsInWeek) {
    const [usedTotalSet, usedOutsideSet] = await Promise.all([
      getSalesMonthlyUnpaidOffDates(String(user.userId), ym, { includePendingLeave: true }),
      getSalesMonthlyUnpaidOffDates(String(user.userId), ym, {
        excludeShiftDates: weekDateSet,
        includePendingLeave: true,
      }),
    ]);
    byMonth[ym] = {
      limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
      usedTotal: usedTotalSet.size,
      usedOutsideWeek: usedOutsideSet.size,
      remainingForWeek: Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - usedOutsideSet.size),
      usedDatesOutsideWeek: Array.from(usedOutsideSet).sort(),
    };
  }

  const primaryStats = byMonth[primaryMonth] || {
    limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
    usedTotal: 0,
    usedOutsideWeek: 0,
    remainingForWeek: SALES_MAX_UNPAID_OFF_PER_MONTH,
    usedDatesOutsideWeek: [],
  };

  const [paidLeaveBalance, staffLeaves] = await Promise.all([
    getStaffPaidLeaveBalance(String(user.userId), primaryMonth, { approvedOnly: false }),
    leaveRequestRepo.find({ staffId: user.userId }),
  ]);

  const activeWeekLeaves = (staffLeaves as any[]).filter(
    (l) =>
      weekDateSet.has(String(l.date || '')) &&
      (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
      (l.status === 'PENDING' || l.status === 'APPROVED')
  );
  const paidLeaveDatesInWeek = activeWeekLeaves
    .filter((l) => l.type === 'PAID_LEAVE')
    .map((l) => String(l.date))
    .sort();
  const formalLeaveDatesInWeek = activeWeekLeaves
    .filter((l) => l.reason !== SHIFT_REG_PAID_LEAVE_REASON)
    .map((l) => String(l.date))
    .sort();
  const activeLeaveByDate = new Map<string, any>();
  for (const l of activeWeekLeaves) {
    const d = String(l.date || '');
    if (!activeLeaveByDate.has(d) || l.status === 'APPROVED') {
      activeLeaveByDate.set(d, l);
    }
  }
  const offOverrideNotices = weekAssignments
    .filter((a: any) => {
      if (a.shiftCode === 'OFF') return false;
      return Boolean(a.overrideOffNotice) || activeLeaveByDate.has(String(a.date || ''));
    })
    .map((a: any) => {
      const lv = activeLeaveByDate.get(String(a.date || ''));
      return {
        date: String(a.date),
        shiftCode: String(a.shiftCode),
        leaveType: lv?.type || 'OFF',
        leaveStatus: lv?.status || 'APPROVED',
      };
    });

  return ok({
    weekStart: targetWeekStart,
    weekEnd: targetWeekEnd,
    nextMonday,
    currentMonday,
    nextWeekStart: nextMonday,
    currentWeekStart: currentMonday,
    assignments: weekAssignments,
    currentWeekAssignments,
    isRegistered,
    isConfirmedByHr,
    unseenConfirmedCount: unseenConfirmed.length,
    hasUnseenConfirmedSchedule: unseenConfirmed.length > 0,
    offOverrideNotices,
    weeklyOffRules: {
      maxOffPerWeek: SALES_MAX_OFF_PER_WEEK_SHIFT_REG,
      maxUnpaidOffPerWeek: SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG,
      maxPaidLeavePerWeek: SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG,
      advanceNoticeDays: ADVANCE_NOTICE_DAYS_REQUIRED,
    },
    paidLeaveQuota: {
      ...paidLeaveBalance,
      paidLeaveDatesInWeek,
      formalLeaveDatesInWeek,
    },
    monthlyOffQuota: {
      limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
      primaryMonth,
      usedTotal: primaryStats.usedTotal,
      usedOutsideWeek: primaryStats.usedOutsideWeek,
      remainingForWeek: primaryStats.remainingForWeek,
      byMonth,
    },
  });
}

export async function markMyScheduleSeen(ctx: ServiceContext): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const allAssign = await shiftAssignmentRepo.find({});
  const unseen = allAssign.filter(
    (a: any) =>
      String(a.staffId) === String(user.userId) &&
      (a.assignedBy === 'HR' || a.overrideOffNotice) &&
      !a.seenByStaff
  );
  await Promise.all(
    unseen.map((a) => shiftAssignmentRepo.updateById(a._id, { seenByStaff: true }))
  );

  return ok({ markedSeen: unseen.length, markedCount: unseen.length });
}

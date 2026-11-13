import { Router } from 'express';
import {
  attendanceConfigRepo,
  attendanceRepo,
  categoryRepo,
  leaveRequestRepo,
  productRepo,
  shiftAssignmentRepo,
  shiftHandoverRepo,
  staffRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { ShiftType } from '../models/ShiftAssignment';
import { getFloorStocks } from '../utils/warehouseFloor';
import { generateVariantProductCode } from '../utils/productCode';
import {
  ADVANCE_NOTICE_DAYS_REQUIRED,
  assertPaidLeaveQuota,
  getSalesMonthlyUnpaidOffDates,
  getStaffPaidLeaveBalance,
  SALES_MAX_OFF_PER_WEEK_SHIFT_REG,
  SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG,
  SALES_MAX_UNPAID_OFF_PER_MONTH,
  SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG,
} from './leaveRequests';

const SHIFT_REG_PAID_LEAVE_REASON = 'Đăng ký nghỉ phép trong lịch đăng ký ca tuần';

export const shiftsRouter = Router();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addDaysStr(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + daysToAdd);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function getNextMondayStr(now = new Date()): string {
  const day = now.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function getCurrentMondayStr(now = new Date()): string {
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * Tự động phân bổ các bản ghi đăng ký 2 ca/ngày (preferenceShift === 'BOTH' & assignedBy === 'AUTO'):
 * - Nếu trong ngày đó có ca bị trống (Ca 1 hoặc Ca 2 chưa có người khác trực): nhân viên được xếp làm cả 2 ca ('BOTH').
 * - Nếu cả Ca 1 và Ca 2 đều đã có người trực (ca không trống): hệ thống random 1 trong 2 ca ('SHIFT_1' hoặc 'SHIFT_2').
 */
async function reconcileAutoShiftPreferencesForWeek(weekStart: string): Promise<void> {
  const allAssign = await shiftAssignmentRepo.find({});
  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(weekStart, i);
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
        // Có ca đang trống -> cho phép 1 nhân viên làm cả 2 ca
        targetShift = 'BOTH';
        hasShift1 = true;
        hasShift2 = true;
      } else {
        // Cả 2 ca đều không trống -> random 1 trong 2 ca
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

// POST /api/v1/shifts/preferences (Nhân viên Bán hàng nộp đăng ký ca tuần tới)
shiftsRouter.post('/shifts/preferences', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { weekStart, preferences } = req.body || {};
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

    // Kiểm tra nếu tuần này đã được HR chốt lịch thì không cho tự ghi đè
    const weekEnd = addDaysStr(String(weekStart), 6);
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

    // Những ngày nghỉ được chọn trực tiếp trong mục Đăng ký ca (chưa có đơn xin nghỉ tạo trước từ mục Tạo đơn)
    const regOffItems = offItems.filter((item: any) => !formalLeaveByDate.has(String(item.date)));

    // Ràng buộc 1: Trong mục đăng ký ca của nhân viên Bán hàng không cho nghỉ quá 2 ngày trong 1 tuần
    // Từ 3 ngày trở đi bắt buộc phải tạo đơn (tối thiểu trước 3 tuần = 21 ngày)
    if (offCount > SALES_MAX_OFF_PER_WEEK_SHIFT_REG && regOffItems.length > 0) {
      throw new ApiError(
        400,
        'WEEKLY_OFF_REQUIRED',
        `Trong mục Đăng ký ca tuần, nhân viên Bán hàng không được nghỉ quá ${SALES_MAX_OFF_PER_WEEK_SHIFT_REG} ngày/tuần (mặc định tối đa ${SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG} ngày OFF không lương và ${SALES_MAX_PAID_LEAVE_PER_WEEK_SHIFT_REG} ngày phép có lương). Nếu muốn nghỉ từ 3 ngày trở đi trong tuần, bắt buộc phải Tạo đơn trước tối thiểu 3 tuần (${ADVANCE_NOTICE_DAYS_REQUIRED} ngày)!`
      );
    }

    // Ràng buộc 2: Trong các ngày nghỉ đăng ký ca (tối đa 2 ngày), mặc định chỉ được 1 ngày OFF (không lương) và 1 ngày phép (PAID_LEAVE)
    let explicitUnpaidCount = 0;
    let explicitPaidLeaveCount = 0;
    const regItemResolvedType = new Map<string, 'OFF' | 'PAID_LEAVE'>();

    if (regOffItems.length > 0) {
      for (const item of offItems) {
        const d = String(item.date);
        const formal = formalLeaveByDate.get(d);
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

    // Gán mặc định cho các ngày chưa truyền leaveType: tối đa 1 ngày OFF không lương + 1 ngày phép có lương
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

    // Kiểm tra điều kiện & hạn mức ngày phép tích lũy nếu có chọn 1 ngày phép trong đăng ký ca
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

    // Kiểm tra hạn mức nghỉ không lương tháng (tối đa 4 ngày OFF không lương/tháng)
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

    // Đồng bộ đơn PAID_LEAVE tự sinh từ đăng ký ca tuần:
    // - Xóa các đơn PAID_LEAVE tự sinh (PENDING) của tuần này không còn được chọn
    for (const [oldDate, oldLeave] of shiftRegPaidLeaveByDate.entries()) {
      if (!selectedRegPaidLeaveDates.includes(oldDate) && oldLeave.status === 'PENDING') {
        await leaveRequestRepo.deleteById(String(oldLeave._id));
      }
    }
    // - Tạo đơn PAID_LEAVE (PENDING) cho ngày phép được chọn trong đăng ký ca nếu chưa có
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

      const prefShift: ShiftType = isOffRequested || preferenceShift === 'OFF'
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
        const updated = await shiftAssignmentRepo.updateById(existing._id, payload);
        createdRecords.push(updated);
      } else {
        const created = await shiftAssignmentRepo.create(payload);
        createdRecords.push(created);
      }
    }

    await reconcileAutoShiftPreferencesForWeek(String(weekStart));

    const refreshedAll = await shiftAssignmentRepo.find({ staffId: staff._id });
    const finalCreated = refreshedAll
      .filter((a: any) => a.date >= String(weekStart) && a.date <= weekEnd)
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    res.json({
      data: finalCreated.length ? finalCreated : createdRecords,
      meta: { message: 'Đăng ký ca làm việc tuần tới thành công! Đang chờ HR xác nhận.' },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/my-schedule (Lịch ca của chính nhân viên + thông báo chấm đỏ khi HR hoàn tất xếp ca)
shiftsRouter.get('/shifts/my-schedule', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const nextMonday = getNextMondayStr();
    const currentMonday = getCurrentMondayStr();
    const targetWeekStart =
      typeof req.query.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)
        ? req.query.weekStart
        : nextMonday;
    const targetWeekEnd = addDaysStr(targetWeekStart, 6);

    const allAssign = await shiftAssignmentRepo.find({});
    const myAssign = allAssign.filter((a: any) => String(a.staffId) === String(user.userId));

    const weekAssignments = myAssign
      .filter((a: any) => a.date >= targetWeekStart && a.date <= targetWeekEnd)
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    const currentWeekEnd = addDaysStr(currentMonday, 6);
    const currentWeekAssignments = myAssign
      .filter((a: any) => a.date >= currentMonday && a.date <= currentWeekEnd)
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    // Đếm các phân ca từ tuần hiện tại trở đi đã được HR xác nhận (assignedBy === 'HR') nhưng nhân viên chưa xem
    const unseenConfirmed = myAssign.filter(
      (a: any) => a.date >= currentMonday && a.assignedBy === 'HR' && !a.seenByStaff
    );

    const isConfirmedByHr =
      weekAssignments.length === 7 && weekAssignments.every((a: any) => a.assignedBy === 'HR');
    const isRegistered = weekAssignments.length > 0;

    // Tính hạn mức nghỉ không lương (tối đa 4 ngày/tháng) cho tuần đang chọn
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysStr(targetWeekStart, i));
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

    res.json({
      data: {
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
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/my-schedule/seen (Nhân viên mở tab Chấm công -> đánh dấu đã xem lịch ca HR vừa chốt)
shiftsRouter.post('/shifts/my-schedule/seen', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const allAssign = await shiftAssignmentRepo.find({});
    const unseen = allAssign.filter(
      (a: any) => String(a.staffId) === String(user.userId) && a.assignedBy === 'HR' && !a.seenByStaff
    );
    for (const a of unseen) {
      await shiftAssignmentRepo.updateById(a._id, { seenByStaff: true });
    }

    res.json({
      data: { markedSeen: unseen.length, markedCount: unseen.length },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/schedule (Xem lịch tuần)
shiftsRouter.get('/shifts/schedule', async (req, res, next) => {
  try {
    const { weekStart } = req.query;
    let assignments = await shiftAssignmentRepo.find({});
    const startStr =
      typeof weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ? String(weekStart)
        : getCurrentMondayStr();
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysStr(startStr, i));
    const endStr = weekDates[6];
    if (weekStart) {
      assignments = assignments.filter((a: any) => a.date >= startStr && a.date <= endStr);
    }
    const allStaff = await staffRepo.find({ status: 'ACTIVE' });

    const weekDateSet = new Set<string>(weekDates);
    const monthsInWeek = Array.from(new Set(weekDates.map((d) => d.slice(0, 7))));
    const primaryMonth = startStr.slice(0, 7);
    const monthlyOffByStaff: Record<
      string,
      {
        limit: number;
        primaryMonth: string;
        usedTotal: number;
        usedOutsideWeek: number;
        remainingForWeek: number;
        byMonth: Record<string, { limit: number; usedTotal: number; usedOutsideWeek: number; remainingForWeek: number }>;
      }
    > = {};

    const allLeaves = await leaveRequestRepo.find({});
    const paidLeaveByStaff: Record<
      string,
      {
        eligible: boolean;
        entitledInMonth: number;
        remainingAfterMonth: number;
        paidLeaveDatesInWeek: string[];
        formalLeaveDatesInWeek: string[];
      }
    > = {};

    for (const s of allStaff as any[]) {
      const dept = s.department || (s.role === 'SALES' ? 'SALES' : 'OFFICE');
      if (dept !== 'SALES') continue;
      const sid = String(s._id);
      const byMonth: Record<string, { limit: number; usedTotal: number; usedOutsideWeek: number; remainingForWeek: number }> = {};
      for (const ym of monthsInWeek) {
        const [usedTotalSet, usedOutsideSet] = await Promise.all([
          getSalesMonthlyUnpaidOffDates(sid, ym, { includePendingLeave: true }),
          getSalesMonthlyUnpaidOffDates(sid, ym, {
            excludeShiftDates: weekDateSet,
            includePendingLeave: true,
          }),
        ]);
        byMonth[ym] = {
          limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
          usedTotal: usedTotalSet.size,
          usedOutsideWeek: usedOutsideSet.size,
          remainingForWeek: Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - usedOutsideSet.size),
        };
      }
      const pStats = byMonth[primaryMonth] || {
        limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
        usedTotal: 0,
        usedOutsideWeek: 0,
        remainingForWeek: SALES_MAX_UNPAID_OFF_PER_MONTH,
      };
      monthlyOffByStaff[sid] = {
        limit: SALES_MAX_UNPAID_OFF_PER_MONTH,
        primaryMonth,
        usedTotal: pStats.usedTotal,
        usedOutsideWeek: pStats.usedOutsideWeek,
        remainingForWeek: pStats.remainingForWeek,
        byMonth,
      };

      const pBalance = await getStaffPaidLeaveBalance(sid, primaryMonth, { approvedOnly: false });
      const stWeekLeaves = (allLeaves as any[]).filter(
        (l) =>
          String(l.staffId) === sid &&
          weekDateSet.has(String(l.date || '')) &&
          (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
          (l.status === 'PENDING' || l.status === 'APPROVED')
      );
      paidLeaveByStaff[sid] = {
        eligible: pBalance.eligible,
        entitledInMonth: pBalance.entitledInMonth,
        remainingAfterMonth: pBalance.remainingAfterMonth,
        paidLeaveDatesInWeek: stWeekLeaves
          .filter((l) => l.type === 'PAID_LEAVE')
          .map((l) => String(l.date))
          .sort(),
        formalLeaveDatesInWeek: stWeekLeaves
          .filter((l) => l.reason !== SHIFT_REG_PAID_LEAVE_REASON)
          .map((l) => String(l.date))
          .sort(),
      };
    }

    res.json({
      data: {
        assignments,
        staffList: allStaff.map((s) => ({
          _id: s._id,
          code: s.code,
          fullName: s.fullName,
          role: s.role,
          department: s.department,
          contractType: (s as any).contractType,
        })),
        monthlyOffByStaff,
        paidLeaveByStaff,
      },
      meta: { total: assignments.length },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/shifts/assign/bulk (HR lưu toàn bộ thay đổi & xác nhận lịch ca tuần một lần)
shiftsRouter.put('/shifts/assign/bulk', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xếp ca');
    }

    const { weekStart, changes = [], confirmWeek = false } = req.body || {};
    if (!Array.isArray(changes) || (changes.length === 0 && !confirmWeek)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Không có thay đổi nào để lưu');
    }
    const validCodes = ['SHIFT_1', 'SHIFT_2', 'BOTH', 'OFF'];
    for (const c of changes) {
      if (!c || !c.staffId || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || ''))) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu phân ca không hợp lệ');
      }
      if (c.shiftCode !== null && !validCodes.includes(c.shiftCode)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Mã ca không hợp lệ: ${c.shiftCode}`);
      }
    }

    // ---- Kiểm tra quy định: Khối Bán hàng xếp đủ 7 ngày/tuần & tối đa 4 ngày nghỉ không lương/tháng ----
    const wsStr = /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart || ''))
      ? String(weekStart)
      : String(changes[0]?.date || getNextMondayStr());
    const [wy, wm, wd] = wsStr.split('-').map(Number);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(wy, wm - 1, wd + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const weekDateSet = new Set<string>(weekDates);
    const monthsInWeek = Array.from(new Set(weekDates.map((d) => d.slice(0, 7))));
    const finalPlan = new Map<string, Map<string, string>>();
    const allAssign = await shiftAssignmentRepo.find({});
    for (const a of allAssign as any[]) {
      if (!weekDates.includes(a.date)) continue;
      const sid = String(a.staffId);
      if (!finalPlan.has(sid)) finalPlan.set(sid, new Map());
      finalPlan.get(sid)!.set(a.date, a.shiftCode);
    }
    for (const c of changes) {
      if (!weekDates.includes(String(c.date))) continue;
      const sid = String(c.staffId);
      if (!finalPlan.has(sid)) finalPlan.set(sid, new Map());
      if (c.shiftCode === null) finalPlan.get(sid)!.delete(String(c.date));
      else finalPlan.get(sid)!.set(String(c.date), c.shiftCode);
    }
    const allLeaves = await leaveRequestRepo.find({});
    const violations: Record<string, string> = {};
    for (const [sid, plan] of finalPlan) {
      if (plan.size === 0) continue;
      const st: any = await staffRepo.findById(sid);
      if (!st) continue;
      const dept = st.department || (st.role === 'SALES' ? 'SALES' : 'OFFICE');
      if (dept !== 'SALES') continue;
      const paidLeaveDatesInWeek = new Set<string>(
        (allLeaves as any[])
          .filter(
            (l) =>
              String(l.staffId) === sid &&
              weekDateSet.has(String(l.date || '')) &&
              l.type === 'PAID_LEAVE' &&
              (l.status === 'PENDING' || l.status === 'APPROVED')
          )
          .map((l) => String(l.date))
      );
      const offDatesInWeek = Array.from(plan.entries())
        .filter(([, v]) => v === 'OFF')
        .map(([d]) => d);
      const unpaidOffDatesInWeek = offDatesInWeek.filter((d) => !paidLeaveDatesInWeek.has(d));
      const unpaidOffCount = unpaidOffDatesInWeek.length;
      const missing = 7 - plan.size;
      const problems: string[] = [];
      if (missing > 0) problems.push(`còn ${missing} ngày chưa xếp`);
      if (unpaidOffCount > SALES_MAX_UNPAID_OFF_PER_MONTH) {
        problems.push(`đang nghỉ không lương ${unpaidOffCount} ngày trong tuần (tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày OFF không lương/tháng)`);
      }
      for (const ym of monthsInWeek) {
        const usedOutside = await getSalesMonthlyUnpaidOffDates(sid, ym, {
          excludeShiftDates: weekDateSet,
          includePendingLeave: true,
        });
        const offInMonthThisWeek = unpaidOffDatesInWeek.filter((d) => d.startsWith(`${ym}-`) && !usedOutside.has(d));
        const totalInMonth = usedOutside.size + offInMonthThisWeek.length;
        if (totalInMonth > SALES_MAX_UNPAID_OFF_PER_MONTH) {
          const remaining = Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - usedOutside.size);
          problems.push(
            remaining === 0
              ? `tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} đã dùng hết ${SALES_MAX_UNPAID_OFF_PER_MONTH}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày OFF ở các tuần trước (tuần này không được nghỉ thêm)`
              : `tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} vượt hạn mức ${totalInMonth}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày OFF (đã dùng ${usedOutside.size} ngày tuần khác, tuần này chỉ còn tối đa ${remaining} ngày)`
          );
        }
      }
      if (problems.length) {
        violations[st.fullName || sid] = `${problems.join(', ')} (quy định: xếp đủ 7 ngày/tuần, tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương/tháng)`;
      }
    }
    if (Object.keys(violations).length > 0) {
      throw new ApiError(
        400,
        'WEEKLY_OFF_REQUIRED',
        `Vi phạm quy định xếp ca khối Bán hàng (đủ 7 ngày/tuần, tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày OFF/tháng): ${Object.entries(violations)
          .map(([n, p]) => `${n} – ${p}`)
          .join('; ')}`,
        violations
      );
    }

    const staffCache = new Map<string, any>();
    let created = 0;
    let updated = 0;
    let deleted = 0;
    const now = new Date();

    for (const c of changes) {
      const staffId = String(c.staffId);
      const date = String(c.date);
      const existing =
        (await shiftAssignmentRepo.findOne({ staffId, date })) ||
        (await shiftAssignmentRepo.findOne({ staffId: c.staffId, date }));

      if (c.shiftCode === null) {
        if (existing) {
          await shiftAssignmentRepo.deleteById(String(existing._id));
          deleted++;
        }
        continue;
      }

      if (existing) {
        await shiftAssignmentRepo.updateById(existing._id, {
          shiftCode: c.shiftCode,
          ...(confirmWeek
            ? {
              assignedBy: 'HR',
              confirmedAt: now,
              seenByStaff: false,
            }
            : {}),
        });
        updated++;
        continue;
      }

      if (!staffCache.has(staffId)) {
        staffCache.set(staffId, await staffRepo.findById(staffId));
      }
      const staff = staffCache.get(staffId);
      if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

      await shiftAssignmentRepo.create({
        weekStart: weekStart || date,
        date,
        dayOfWeek: Number(c.dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode: c.shiftCode,
        assignedBy: confirmWeek ? 'HR' : 'AUTO',
        ...(confirmWeek
          ? {
            confirmedAt: now,
            seenByStaff: false,
          }
          : {
            seenByStaff: true,
          }),
      });
      created++;
    }

    // Chỉ khi HR bấm Xác nhận lịch ca tuần (confirmWeek === true): chuyển toàn bộ bản ghi trong tuần sang assignedBy='HR' & bật thông báo seenByStaff=false
    let confirmed = 0;
    if (confirmWeek) {
      const remainingAssign = await shiftAssignmentRepo.find({});
      const weekOffKeys = new Set<string>();
      for (const a of remainingAssign as any[]) {
        if (!weekDates.includes(a.date)) continue;
        await shiftAssignmentRepo.updateById(a._id, {
          assignedBy: 'HR',
          confirmedAt: now,
          seenByStaff: false,
        });
        if (a.shiftCode === 'OFF') {
          weekOffKeys.add(`${String(a.staffId)}_${String(a.date)}`);
        }
        confirmed++;
      }

      // Đồng bộ đơn PAID_LEAVE đang PENDING trong tuần khi HR xác nhận lịch ca:
      const currentLeaves = await leaveRequestRepo.find({});
      for (const l of currentLeaves as any[]) {
        const d = String(l.date || '');
        if (!weekDateSet.has(d) || l.type !== 'PAID_LEAVE' || l.status !== 'PENDING') continue;
        const key = `${String(l.staffId)}_${d}`;
        if (weekOffKeys.has(key)) {
          await leaveRequestRepo.updateById(String(l._id), {
            status: 'APPROVED',
            reviewNote: 'HR xác nhận lịch phân ca tuần',
            reviewedBy: user.fullName || user.username || 'HR',
            reviewedAt: now,
          });
        } else if (l.reason === SHIFT_REG_PAID_LEAVE_REASON) {
          await leaveRequestRepo.deleteById(String(l._id));
        }
      }
    }

    res.json({
      data: { created, updated, deleted, confirmed },
      meta: {
        message: confirmWeek
          ? 'Đã lưu và xác nhận lịch phân ca tuần! Nhân viên sẽ nhận được thông báo lịch mới.'
          : 'Đã lưu nháp lịch phân ca tuần.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/shifts/assign (HR Kéo - Thả Drag & Drop xếp ca)
shiftsRouter.put('/shifts/assign', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xếp ca');
    }

    const { staffId, date, weekStart, dayOfWeek, shiftCode } = req.body || {};
    if (!staffId || !date || !shiftCode) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu thông tin phân ca');
    }

    const staff = await staffRepo.findById(staffId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    const existing = await shiftAssignmentRepo.findOne({ staffId, date });
    let result;

    if (existing) {
      result = await shiftAssignmentRepo.updateById(existing._id, {
        shiftCode,
        assignedBy: 'HR',
      });
    } else {
      result = await shiftAssignmentRepo.create({
        weekStart: weekStart || date,
        date,
        dayOfWeek: Number(dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode,
        assignedBy: 'HR',
      });
    }

    res.json({
      data: result,
      meta: { message: 'Cập nhật phân ca thành công' },
    });
  } catch (err) {
    next(err);
  }
});

function getTodayLocalStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function stripVnAccents(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function isRacketCategory(code?: string, name?: string): boolean {
  const c = stripVnAccents(code || '');
  const n = stripVnAccents(name || '');
  if (c === 'vot' || c.startsWith('vot_')) return true;
  if (/\b(phu\s*kien|bao\s*ve|dan\s*vien|cuon\s*can|ve\s*sinh|chi\s*dan)\b/.test(n)) {
    return false;
  }
  return /\b(vot|paddle|racket)\b/.test(n);
}

function buildDeterministicPermutation(n: number, cycleSeed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return arr;
  let state = (Math.imul(cycleSeed + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  const nextRand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function pickDailyCompanionIndex(dateStr: string, count: number): number {
  if (count <= 1) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y || 2026, (m || 1) - 1, d || 1) / 86400000);
  const cycle = Math.floor(dayNumber / count);
  const posInCycle = ((dayNumber % count) + count) % count;

  const perm = buildDeterministicPermutation(count, cycle);
  const prevPerm = buildDeterministicPermutation(count, cycle - 1);
  if (perm[0] === prevPerm[count - 1]) {
    const tmp = perm[0];
    perm[0] = perm[1];
    perm[1] = tmp;
  }
  return perm[posInCycle];
}

export interface HandoverCategorySummary {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  isPrimaryCategory: boolean;
  unit: string;
  productCount: number;
  expectedTotalQty: number;
}

const HANDOVER_SCHEDULE_CONFIG_KEY = 'HANDOVER_SCHEDULE_CONFIG';

export async function getStoredHandoverWeeklySchedule(): Promise<Record<string, string[]>> {
  const doc = await attendanceConfigRepo.findOne({ key: HANDOVER_SCHEDULE_CONFIG_KEY });
  if (doc && doc.handoverWeeklySchedule && typeof doc.handoverWeeklySchedule === 'object') {
    return doc.handoverWeeklySchedule as Record<string, string[]>;
  }
  return {};
}

export async function computeDailyHandoverCheck(targetDate?: string) {
  const dateStr =
    targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : getTodayLocalStr();
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(y || 2026, (m || 1) - 1, d || 1).getDay(); // 0: CN, 1: T2 ... 6: T7

  const [categories, allProducts, storedWeeklySchedule] = await Promise.all([
    categoryRepo.find({}),
    productRepo.find({}),
    getStoredHandoverWeeklySchedule(),
  ]);

  const catMap = new Map(categories.map((c: any) => [String(c._id), c]));
  const catByCode = new Map(categories.map((c: any) => [String(c.code || '').toUpperCase(), c]));
  const catByName = new Map(
    categories.map((c: any) => [String(c.name || '').trim().toLowerCase(), c])
  );

  const floor1Products = allProducts
    .filter((p: any) => p.status !== 'INACTIVE')
    .map((p: any) => {
      const cat =
        catMap.get(String(p.categoryId)) ||
        (p.categoryCode ? catByCode.get(String(p.categoryCode).toUpperCase()) : undefined) ||
        (p.categoryName ? catByName.get(String(p.categoryName).trim().toLowerCase()) : undefined);
      const floors = getFloorStocks(p);
      const visibleVariants = floors.variants.map((v: any) => {
        const hasAttr = Boolean(
          (v.color && String(v.color).trim()) || (v.size && String(v.size).trim())
        );
        const vCode = hasAttr
          ? generateVariantProductCode(p.code, v.color, v.size)
          : v.variantCode || p.code;
        return {
          ...v,
          sku: vCode,
          variantCode: vCode,
          barcode: vCode,
          stockFloor1: v.stockFloor1,
          stockQtyFloor1: v.stockFloor1,
        };
      });
      return {
        _id: p._id,
        code: p.code,
        barcode: p.barcode || p.code,
        name: p.name,
        brand: p.brand || '',
        modelName: p.modelName || '',
        unit: p.unit || 'Cái',
        sellingPrice: Number(p.sellingPrice) || 0,
        categoryId: cat?._id ? String(cat._id) : String(p.categoryId || ''),
        categoryCode: cat?.code || p.categoryCode || '',
        categorySlug: String(cat?.code || p.categoryCode || '').toLowerCase(),
        categoryName: cat?.name || p.categoryName || 'Chưa phân loại',
        stockFloor1: floors.stockFloor1,
        stockQtyFloor1: floors.stockFloor1,
        stock: floors.stockFloor1,
        variants: visibleVariants,
      };
    })
    .filter((p: any) => (Number(p.stockFloor1) || 0) > 0);

  const activeCategories = categories.filter((c: any) => c.status !== 'INACTIVE');
  const racketCatDoc = activeCategories.find((c: any) => isRacketCategory(c.code, c.name));

  const primaryProducts = floor1Products
    .filter(
      (p: any) =>
        (racketCatDoc && String(p.categoryId) === String(racketCatDoc._id)) ||
        isRacketCategory(p.categoryCode, p.categoryName)
    )
    .map((p: any) => ({ ...p, isPrimaryCategory: true }));

  const primaryExpectedTotalQty = primaryProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.stockQtyFloor1 ?? p.stockFloor1) || 0),
    0
  );

  const primaryCategory = {
    _id: racketCatDoc ? String(racketCatDoc._id) : 'VOT',
    code: racketCatDoc?.code || 'VOT',
    slug: String(racketCatDoc?.code || 'vot').toLowerCase(),
    name: racketCatDoc?.name || 'Vợt',
    unit: primaryProducts[0]?.unit || 'Cái',
    productCount: primaryProducts.length,
    expectedTotalQty: primaryExpectedTotalQty,
  };

  // Xây dựng danh sách các Category đi kèm (ngoài Vợt)
  const nonRacketCategories = activeCategories
    .filter((c: any) => !isRacketCategory(c.code, c.name))
    .map((c: any) => {
      const catProds = floor1Products.filter(
        (p: any) =>
          String(p.categoryId) === String(c._id) ||
          (c.code && String(p.categoryCode).toUpperCase() === String(c.code).toUpperCase()) ||
          stripVnAccents(p.categoryName) === stripVnAccents(c.name)
      );
      const expectedTotalQty = catProds.reduce(
        (sum: number, p: any) => sum + (Number(p.stockQtyFloor1 ?? p.stockFloor1) || 0),
        0
      );
      return {
        _id: String(c._id),
        code: String(c.code || ''),
        slug: String(c.code || '').toLowerCase(),
        name: String(c.name || ''),
        unit: catProds[0]?.unit || 'Cái',
        productCount: catProds.length,
        expectedTotalQty,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const nonEmptyCompanions = nonRacketCategories.filter((c) => c.productCount > 0);
  const defaultFallbackCompanions = [
    { _id: 'GIAY', code: 'GIAY', slug: 'giay', name: 'Giày', unit: 'Đôi', productCount: 0, expectedTotalQty: 0 },
    { _id: 'BONG_THI_DAU', code: 'BONG_THI_DAU', slug: 'bong_thi_dau', name: 'Bóng thi đấu', unit: 'Hộp', productCount: 0, expectedTotalQty: 0 },
    { _id: 'PHU_KIEN', code: 'PHU_KIEN', slug: 'phu_kien', name: 'Phụ kiện', unit: 'Cái', productCount: 0, expectedTotalQty: 0 },
  ];

  const availableCompanionCategories =
    nonEmptyCompanions.length > 0
      ? nonEmptyCompanions
      : nonRacketCategories.length > 0
        ? nonRacketCategories
        : defaultFallbackCompanions;

  // Xây dựng lịch cố định theo Thứ trong tuần (0..6): ưu tiên cấu hình của Quản lý, nếu chưa có thì phân bổ cố định theo Thứ
  const allCompanionCandidates =
    nonRacketCategories.length > 0 ? nonRacketCategories : defaultFallbackCompanions;

  const resolveCompanionDisplayName = (rawToken: string): string => {
    const token = String(rawToken || '').trim();
    if (!token) return '';
    const upper = token.toUpperCase();
    const norm = stripVnAccents(token);
    const matched =
      allCompanionCandidates.find(
        (c) =>
          String(c._id) === token ||
          String(c.code).toUpperCase() === upper ||
          stripVnAccents(c.name) === norm
      ) || null;
    return matched ? matched.name : token;
  };

  const resolvedWeeklySchedule: Record<string, string[]> = {};
  for (let wd = 0; wd <= 6; wd++) {
    const key = String(wd);
    const customList = Array.isArray(storedWeeklySchedule[key])
      ? storedWeeklySchedule[key]
          .map((x) => resolveCompanionDisplayName(String(x || '')))
          .filter(Boolean)
      : [];
    if (customList.length > 0) {
      resolvedWeeklySchedule[key] = customList;
    } else if (availableCompanionCategories.length > 0) {
      // Lịch cố định mặc định theo thứ (T2=0, T3=1, T4=2, T5=0, T6=1, T7=0, CN=2...)
      const defaultIdx =
        wd === 1 || wd === 4 || wd === 6
          ? 0
          : wd === 2 || wd === 5
            ? 1 % availableCompanionCategories.length
            : 2 % availableCompanionCategories.length;
      const picked = availableCompanionCategories[defaultIdx] || availableCompanionCategories[0];
      resolvedWeeklySchedule[key] = [picked.name || picked.code];
    } else {
      resolvedWeeklySchedule[key] = [];
    }
  }

  const configuredCodesForToday = resolvedWeeklySchedule[String(weekday)] || [];
  let selectedCompanions = configuredCodesForToday
    .map((token) => {
      const upper = token.toUpperCase();
      const norm = stripVnAccents(token);
      return (
        availableCompanionCategories.find(
          (c) =>
            String(c._id) === token ||
            String(c.code).toUpperCase() === upper ||
            stripVnAccents(c.name) === norm
        ) ||
        nonRacketCategories.find(
          (c) =>
            String(c._id) === token ||
            String(c.code).toUpperCase() === upper ||
            stripVnAccents(c.name) === norm
        ) ||
        null
      );
    })
    .filter(Boolean) as typeof availableCompanionCategories;

  if (selectedCompanions.length === 0 && availableCompanionCategories.length > 0) {
    const pickedIdx = pickDailyCompanionIndex(dateStr, availableCompanionCategories.length);
    if (availableCompanionCategories[pickedIdx]) {
      selectedCompanions = [availableCompanionCategories[pickedIdx]];
    }
  }

  const companionCategory = selectedCompanions[0] || null;

  const companionProducts =
    selectedCompanions.length > 0
      ? floor1Products
          .filter(
            (p: any) =>
              !primaryProducts.some((vp: any) => String(vp._id) === String(p._id)) &&
              selectedCompanions.some(
                (comp) =>
                  String(p.categoryId) === String(comp._id) ||
                  (comp.code &&
                    String(p.categoryCode).toUpperCase() === String(comp.code).toUpperCase()) ||
                  stripVnAccents(p.categoryName) === stripVnAccents(comp.name)
              )
          )
          .map((p: any) => ({ ...p, isPrimaryCategory: false }))
      : [];

  const selectedProducts = [...primaryProducts, ...companionProducts];
  const checkedCategories = [
    primaryCategory.name,
    ...selectedCompanions.map((c) => c.name),
  ];
  const categoryLabel = checkedCategories.join(' + ');

  const categorySummaries: HandoverCategorySummary[] = [
    {
      categoryId: primaryCategory._id,
      categoryCode: primaryCategory.code,
      categoryName: primaryCategory.name,
      isPrimaryCategory: true,
      unit: primaryCategory.unit || 'Cái',
      productCount: primaryCategory.productCount,
      expectedTotalQty: primaryCategory.expectedTotalQty,
    },
    ...selectedCompanions.map((comp) => ({
      categoryId: comp._id,
      categoryCode: comp.code || comp.name,
      categoryName: comp.name,
      isPrimaryCategory: false,
      unit: comp.unit || 'Cái',
      productCount: comp.productCount,
      expectedTotalQty: comp.expectedTotalQty,
    })),
  ];

  const totalExpectedQty = categorySummaries.reduce((sum, c) => sum + c.expectedTotalQty, 0);

  return {
    date: dateStr,
    weekday,
    categoryLabel,
    checkedCategoryLabel: categoryLabel,
    checkedCategories,
    totalCheckedProducts: selectedProducts.length,
    totalExpectedQty,
    categorySummaries,
    weeklySchedule: resolvedWeeklySchedule,
    primaryCategory,
    companionCategory,
    availableCompanionCategories:
      nonRacketCategories.length > 0 ? nonRacketCategories : defaultFallbackCompanions,
    products: selectedProducts,
  };
}

export const HANDOVER_MANAGER_ROLES = new Set(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR']);

export function isHandoverManagerRole(role?: string): boolean {
  return Boolean(role && HANDOVER_MANAGER_ROLES.has(String(role).toUpperCase()));
}

export function isSalesStaffUser(user?: { role?: string; department?: string } | null): boolean {
  if (!user) return false;
  return (
    String(user.role || '').toUpperCase() === 'SALES' ||
    String(user.department || '').toUpperCase() === 'SALES'
  );
}

/**
 * Tự động đánh dấu hết hiệu lực chờ ('STORE_CLOSED') cho các phiếu PENDING đã quá hạn (> 1 ngày)
 * hoặc đã bị thay thế bởi phiếu bàn giao của ca mới hơn, tránh tồn đọng phiếu cũ chặn checkout.
 */
export async function expireStalePendingHandovers(todayLocal = getTodayLocalStr()): Promise<any[]> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const todaySet = new Set([todayLocal, todayUtc]);
  const yesterdayLocal = addDaysStr(todayLocal, -1);
  const yesterdayUtc = addDaysStr(todayUtc, -1);
  const minValidDate = yesterdayLocal < yesterdayUtc ? yesterdayLocal : yesterdayUtc;

  const allHandovers = (await shiftHandoverRepo.find({})) as any[];
  const submittedHandoversToday = allHandovers.filter(
    (h) => h.status !== 'DRAFT' && todaySet.has(String(h.date))
  );
  const hasAnyHandoverToday = submittedHandoversToday.length > 0;
  const latestClosingTodayMs = submittedHandoversToday
    .filter((h) => h.shiftCode === 'SHIFT_2' || h.shiftCode === 'BOTH')
    .reduce((maxMs, h) => {
      const t = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
      return t > maxMs ? t : maxMs;
    }, 0);

  for (const h of allHandovers) {
    if (h.status !== 'PENDING') continue;
    const hDate = String(h.date || '');
    const hTimeMs = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
    const isTooOld = !hDate || hDate < minValidDate;
    const isPrevDaySuperseded = !todaySet.has(hDate) && hasAnyHandoverToday;
    const isPrevDayShift1Expired = !todaySet.has(hDate) && h.shiftCode === 'SHIFT_1';
    const isTodayShift1Superseded =
      todaySet.has(hDate) &&
      h.shiftCode === 'SHIFT_1' &&
      latestClosingTodayMs > 0 &&
      latestClosingTodayMs > hTimeMs;

    if (isTooOld || isPrevDaySuperseded || isPrevDayShift1Expired || isTodayShift1Superseded) {
      h.status = 'STORE_CLOSED';
      await shiftHandoverRepo.updateById(h._id, { status: 'STORE_CLOSED' });
      await finalizeAttendanceCheckoutFromHandover(h);
    }
  }

  return allHandovers;
}

/**
 * Tìm đúng phiếu bàn giao ca đang chờ (`PENDING`) áp dụng cho nhân viên `userId` và ca nhận `receivingShiftCode`:
 * - Không lấy phiếu cũ quá ngày hôm qua (`date < yesterday`) hoặc đã bị ca mới hơn thay thế.
 * - Phiếu `SHIFT_1` cùng ngày (`today`) chỉ giao cho nhân viên ca chiều/tối (`SHIFT_2` hoặc `BOTH`).
 * - Phiếu kết ca tối hôm qua (`yesterday`, `SHIFT_2` / `BOTH`) chỉ giao cho nhân viên mở cửa ca sáng hôm nay (`SHIFT_1` hoặc `BOTH`) khi hôm nay chưa có phiếu mới.
 * - Nếu phiếu đã gán `toStaffId` thì chỉ áp dụng cho đúng `toStaffId` đó.
 */
export function resolvePendingIncomingHandoverForSales(params: {
  allHandovers: any[];
  userId: string;
  todayLocal?: string;
  receivingShiftCode?: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | null;
}): any | null {
  const {
    allHandovers,
    userId,
    todayLocal = getTodayLocalStr(),
    receivingShiftCode = null,
  } = params;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const todaySet = new Set([todayLocal, todayUtc]);
  const yesterdayLocal = addDaysStr(todayLocal, -1);
  const yesterdayUtc = addDaysStr(todayUtc, -1);
  const yesterdaySet = new Set([yesterdayLocal, yesterdayUtc]);

  const submittedHandoversToday = allHandovers.filter(
    (h) => h.status !== 'DRAFT' && todaySet.has(String(h.date))
  );
  const hasAnyHandoverToday = submittedHandoversToday.length > 0;
  const latestClosingTodayMs = submittedHandoversToday
    .filter((h) => h.shiftCode === 'SHIFT_2' || h.shiftCode === 'BOTH')
    .reduce((maxMs, h) => {
      const t = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
      return t > maxMs ? t : maxMs;
    }, 0);

  return (
    allHandovers
      .filter((h) => {
        if (h.status !== 'PENDING') return false;
        if (String(h.fromStaffId) === String(userId)) return false;
        if (h.toStaffId && String(h.toStaffId) !== String(userId)) return false;

        const hDate = String(h.date || '');
        const hTimeMs = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();

        // 1. Phiếu lập trong ngày hôm nay: chỉ phiếu Ca 1 (SHIFT_1) giao sang Ca 2 / BOTH
        if (todaySet.has(hDate)) {
          if (h.shiftCode !== 'SHIFT_1') return false;
          if (latestClosingTodayMs > 0 && latestClosingTodayMs > hTimeMs) return false;
          if (receivingShiftCode && receivingShiftCode === 'SHIFT_1') {
            return false;
          }
          return true;
        }

        // 2. Phiếu lập từ tối hôm qua (exact yesterday): chỉ phiếu kết ca tối (SHIFT_2 / BOTH) giao cho Ca 1 / BOTH sáng nay
        if (yesterdaySet.has(hDate)) {
          if (h.shiftCode !== 'SHIFT_2' && h.shiftCode !== 'BOTH') return false;
          if (hasAnyHandoverToday) return false;
          if (receivingShiftCode && receivingShiftCode === 'SHIFT_2') {
            return false;
          }
          return true;
        }

        // 3. Mọi phiếu từ >= 2 ngày trước đều đã hết hạn
        return false;
      })
      .sort((a, b) => {
        const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCmp !== 0) return dateCmp;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })[0] || null
  );
}

export async function finalizeAttendanceCheckoutFromHandover(handover: any): Promise<any | null> {
  if (!handover || handover.status === 'DRAFT' || !handover.fromStaffId || !handover.date) {
    return null;
  }
  const att = await attendanceRepo.findOne({
    staffId: handover.fromStaffId,
    date: String(handover.date),
  });
  if (!att || att.checkOutTime) return att || null;

  const effectiveOutDate = att.pendingCheckOutTime
    ? new Date(att.pendingCheckOutTime)
    : handover.submittedAt
      ? new Date(handover.submittedAt)
      : new Date();

  const assignedShift =
    (await shiftAssignmentRepo.findOne({
      staffId: String(handover.fromStaffId),
      date: String(handover.date),
    })) ||
    (await shiftAssignmentRepo.findOne({
      staffId: handover.fromStaffId,
      date: String(handover.date),
    }));

  const effectiveShiftCode =
    assignedShift &&
    (assignedShift.shiftCode === 'SHIFT_1' ||
      assignedShift.shiftCode === 'SHIFT_2' ||
      assignedShift.shiftCode === 'BOTH')
      ? assignedShift.shiftCode
      : att.shiftCode;

  const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
  const totalMinutesOut = effectiveOutDate.getHours() * 60 + effectiveOutDate.getMinutes();

  let earlyMinutes = Number(att.earlyMinutes || 0);
  if (totalMinutesOut < shiftEndMinutes) {
    earlyMinutes = shiftEndMinutes - totalMinutesOut;
  } else {
    earlyMinutes = 0;
  }

  let lateCheckoutMinutes = Number(att.lateCheckoutMinutes || handover.lateCheckoutMinutes || 0);
  let cleanLateCheckoutReason = String(
    att.lateCheckoutReason || handover.lateCheckoutReason || ''
  ).trim();
  let overtimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
    (att as any).overtimeStatus || 'NONE';
  let overtimeApprovedMinutes = Number((att as any).overtimeApprovedMinutes || 0);

  if (totalMinutesOut > shiftEndMinutes && effectiveShiftCode !== 'BOTH') {
    const diffLate = totalMinutesOut - shiftEndMinutes;
    if (diffLate > 5) {
      lateCheckoutMinutes = diffLate;
      if (overtimeStatus !== 'APPROVED') {
        overtimeStatus = 'PENDING';
        overtimeApprovedMinutes = 0;
      }
    }
  }

  const startMs = new Date(att.workStartTime).getTime();
  const endMs = effectiveOutDate.getTime();
  let rawHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
  let lunchPauseMinutes = 0;
  if (att.department === 'OFFICE' && effectiveShiftCode === 'SHIFT_1') {
    lunchPauseMinutes = 60;
    rawHours = Math.max(0, rawHours - 1);
  }

  const finalStatus = earlyMinutes > 0 ? 'EARLY_LEAVE' : 'COMPLETED';
  const noteParts: string[] = [];
  if (att.notes) noteParts.push(String(att.notes));
  if (
    cleanLateCheckoutReason &&
    !String(att.notes || '').includes(cleanLateCheckoutReason)
  ) {
    noteParts.push(
      `Lý do check-out trễ (${lateCheckoutMinutes}p): ${cleanLateCheckoutReason}`
    );
  }

  return attendanceRepo.updateById(att._id, {
    shiftCode: effectiveShiftCode,
    checkOutTime: effectiveOutDate,
    earlyMinutes,
    lateCheckoutMinutes,
    lateCheckoutReason: cleanLateCheckoutReason,
    overtimeStatus,
    overtimeApprovedMinutes,
    lunchPauseMinutes,
    totalWorkHours: Number(rawHours.toFixed(2)),
    status: finalStatus,
    notes: noteParts.join(' | '),
  });
}

// GET /api/v1/shifts/handover/schedule-config (Lấy cấu hình lịch kiểm hàng cố định theo Thứ trong tuần)
shiftsRouter.get('/shifts/handover/schedule-config', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập cấu hình lịch kiểm hàng');
    }

    const dailyCheck = await computeDailyHandoverCheck();
    res.json({
      data: {
        weeklySchedule: dailyCheck.weeklySchedule,
        primaryCategory: dailyCheck.primaryCategory,
        availableCompanionCategories: dailyCheck.availableCompanionCategories,
        availableCategories: dailyCheck.availableCompanionCategories.map((c: any) => ({
          _id: c._id,
          code: c.code,
          name: c.name,
          slug: c.slug,
          productCount: c.productCount,
          expectedTotalQty: c.expectedTotalQty,
          isPrimary: false,
        })),
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/shifts/handover/schedule-config (Quản lý cấu hình danh mục kiểm hàng cố định theo Thứ: luôn là Vợt + ...)
shiftsRouter.put('/shifts/handover/schedule-config', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    if (!isHandoverManagerRole(user.role)) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Quản lý (Admin / HR / Kế toán) mới được cấu hình lịch kiểm hàng cố định theo ngày'
      );
    }

    const rawSchedule = req.body?.weeklySchedule;
    if (!rawSchedule || typeof rawSchedule !== 'object') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu cấu hình lịch kiểm theo thứ không hợp lệ');
    }

    const normalizedSchedule: Record<string, string[]> = {};
    for (let wd = 0; wd <= 6; wd++) {
      const key = String(wd);
      const val = rawSchedule[key];
      const list = Array.isArray(val)
        ? val.map((x: any) => String(x || '').trim()).filter(Boolean)
        : typeof val === 'string' && val.trim()
          ? [val.trim()]
          : [];
      normalizedSchedule[key] = list;
    }

    const existing = await attendanceConfigRepo.findOne({ key: HANDOVER_SCHEDULE_CONFIG_KEY });
    if (existing) {
      await attendanceConfigRepo.updateById(existing._id, {
        handoverWeeklySchedule: normalizedSchedule,
        updatedBy: user.fullName || user.username,
      });
    } else {
      await attendanceConfigRepo.create({
        key: HANDOVER_SCHEDULE_CONFIG_KEY,
        officeName: 'Cấu hình lịch kiểm hàng bàn giao ca',
        officeLat: 0,
        officeLng: 0,
        maxDistanceMeters: 50,
        allowedIps: [],
        requireGps: false,
        requireIp: true,
        handoverWeeklySchedule: normalizedSchedule,
        updatedBy: user.fullName || user.username,
      });
    }

    const updatedDailyCheck = await computeDailyHandoverCheck();
    res.json({
      data: {
        weeklySchedule: updatedDailyCheck.weeklySchedule,
        primaryCategory: updatedDailyCheck.primaryCategory,
        availableCompanionCategories: updatedDailyCheck.availableCompanionCategories,
        availableCategories: updatedDailyCheck.availableCompanionCategories.map((c: any) => ({
          _id: c._id,
          code: c.code,
          name: c.name,
          slug: c.slug,
          productCount: c.productCount,
          expectedTotalQty: c.expectedTotalQty,
          isPrimary: false,
        })),
      },
      meta: {
        message: 'Đã lưu cấu hình lịch kiểm hàng cố định theo ngày trong tuần!',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/handover/daily-check (Lấy danh mục kiểm kết ca cố định theo ngày: luôn là Vợt + ...)
shiftsRouter.get('/shifts/handover/daily-check', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập danh mục bàn giao ca');
    }

    const dateQuery = typeof req.query.date === 'string' ? req.query.date.trim() : undefined;
    const dailyCheck = await computeDailyHandoverCheck(dateQuery);

    res.json({
      data: dailyCheck,
      meta: {
        totalProducts: dailyCheck.products.length,
        totalExpectedQty: dailyCheck.totalExpectedQty,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/handover (Danh sách các phiếu bàn giao ca cho Sales & Admin CMS)
shiftsRouter.get('/shifts/handover', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const isManager = isHandoverManagerRole(user.role);
    const isSales = isSalesStaffUser(user);
    if (!isManager && !isSales) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Quản lý (Admin/HR/Kế toán) hoặc Nhân viên Bán hàng mới có quyền xem phiếu bàn giao ca'
      );
    }

    const { date, from, to, status, shiftCode, staffId, onlyDiscrepancy, search } = req.query;
    const todayLocal = getTodayLocalStr();
    const allHandovers = await expireStalePendingHandovers(todayLocal);

    // Xác định ca làm việc hôm nay của nhân viên SALES (nếu có) để tìm đúng phiếu bàn giao cần nhận
    let receivingShiftCode: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | null = null;
    if (isSales) {
      const todayAttendance = await attendanceRepo.findOne({
        staffId: user.userId,
        date: todayLocal,
      });
      const todayAssigned =
        (await shiftAssignmentRepo.findOne({ staffId: String(user.userId), date: todayLocal })) ||
        (await shiftAssignmentRepo.findOne({ staffId: user.userId, date: todayLocal }));

      if (
        todayAttendance &&
        (todayAttendance.shiftCode === 'SHIFT_1' ||
          todayAttendance.shiftCode === 'SHIFT_2' ||
          todayAttendance.shiftCode === 'BOTH')
      ) {
        receivingShiftCode = todayAttendance.shiftCode;
      } else if (
        todayAssigned &&
        (todayAssigned.shiftCode === 'SHIFT_1' ||
          todayAssigned.shiftCode === 'SHIFT_2' ||
          todayAssigned.shiftCode === 'BOTH')
      ) {
        receivingShiftCode = todayAssigned.shiftCode;
      }
    }

    const pendingIncomingHandover = isSales
      ? resolvePendingIncomingHandoverForSales({
        allHandovers,
        userId: String(user.userId),
        todayLocal,
        receivingShiftCode,
      })
      : null;

    // Bảo mật phân quyền dữ liệu:
    // - Quản lý (ADMIN / MANAGER / HR / ACCOUNTANT): được xem toàn bộ danh sách phiếu bàn giao
    // - Nhân viên SALES: chỉ được xem các phiếu do chính họ tạo (fromStaffId), do chính họ nhận (toStaffId),
    //   hoặc đúng 1 phiếu pendingIncomingHandover đang chờ ca của họ xác nhận (không lộ cashBalance của người khác)
    let filtered = isManager
      ? [...allHandovers]
      : allHandovers.filter(
        (h) =>
          String(h.fromStaffId) === String(user.userId) ||
          String(h.toStaffId) === String(user.userId) ||
          (pendingIncomingHandover && String(h._id) === String(pendingIncomingHandover._id))
      );

    if (typeof date === 'string' && date.trim()) {
      const d = date.trim();
      filtered = filtered.filter((h) => String(h.date) === d);
    }
    if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from.trim())) {
      filtered = filtered.filter((h) => String(h.date) >= from.trim());
    }
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
      filtered = filtered.filter((h) => String(h.date) <= to.trim());
    }
    if (typeof status === 'string' && status.trim() && status !== 'ALL') {
      filtered = filtered.filter((h) => String(h.status) === status.trim().toUpperCase());
    }
    if (typeof shiftCode === 'string' && shiftCode.trim() && shiftCode !== 'ALL') {
      filtered = filtered.filter((h) => String(h.shiftCode) === shiftCode.trim().toUpperCase());
    }
    if (isManager && typeof staffId === 'string' && staffId.trim()) {
      const sid = staffId.trim();
      filtered = filtered.filter(
        (h) => String(h.fromStaffId) === sid || String(h.toStaffId) === sid
      );
    }
    if (onlyDiscrepancy === 'true' || req.query.hasDiscrepancy === 'true') {
      filtered = filtered.filter(
        (h) =>
          h.status === 'DISCREPANCY_REPORTED' ||
          (Array.isArray(h.discrepancies) && h.discrepancies.some((d: any) => d.actual !== d.expected)) ||
          (Array.isArray(h.categoryCounts) &&
            h.categoryCounts.some((c: any) => Number(c.actualTotalQty) !== Number(c.expectedTotalQty)))
      );
    }
    if (typeof search === 'string' && search.trim()) {
      const q = stripVnAccents(search.trim());
      filtered = filtered.filter((h) => {
        const hay = stripVnAccents(
          [
            h.fromStaffName,
            h.toStaffName,
            h.notes,
            h.confirmNote,
            ...(h.checkedCategories || []),
            ...(h.discrepancies || []).map((d: any) => `${d.productCode} ${d.productName || ''}`),
          ].join(' ')
        );
        return hay.includes(q);
      });
    }

    filtered.sort((a, b) => {
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const draftCount = filtered.filter((h) => h.status === 'DRAFT').length;
    const pendingCount = filtered.filter((h) => h.status === 'PENDING').length;
    const acceptedCount = filtered.filter((h) => h.status === 'ACCEPTED').length;
    const storeClosedCount = filtered.filter((h) => h.status === 'STORE_CLOSED').length;
    const discrepancyHandoverCount = filtered.filter(
      (h) =>
        h.status === 'DISCREPANCY_REPORTED' ||
        (Array.isArray(h.discrepancies) && h.discrepancies.some((d: any) => d.actual !== d.expected)) ||
        (Array.isArray(h.categoryCounts) &&
          h.categoryCounts.some((c: any) => Number(c.actualTotalQty) !== Number(c.expectedTotalQty)))
    ).length;

    res.json({
      data: filtered,
      meta: {
        total: filtered.length,
        draftCount,
        pendingCount,
        acceptedCount,
        storeClosedCount,
        discrepancyHandoverCount,
        pendingIncomingHandover,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/handover (Sales lưu nháp trong ca hoặc xác nhận gửi biên bản kết ca & bàn giao Kho Tầng 1)
shiftsRouter.post('/shifts/handover', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Nhân viên Bán hàng hoặc Quản lý mới được lập phiếu bàn giao ca');
    }

    const {
      date,
      shiftCode = 'SHIFT_1',
      isDraft = false,
      cashBalance = 0,
      checkedCategories,
      totalCheckedProducts,
      categoryCounts,
      discrepancies = [],
      notes = '',
      lateCheckoutReason = '',
    } = req.body || {};

    const effectiveDate =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
        ? date.trim()
        : getTodayLocalStr();

    const dailyCheck = await computeDailyHandoverCheck(effectiveDate);
    const resolvedCheckedCategories =
      Array.isArray(checkedCategories) && checkedCategories.length > 0
        ? checkedCategories.map((c: any) => String(c))
        : dailyCheck.checkedCategories;
    const resolvedTotalChecked =
      typeof totalCheckedProducts === 'number' && totalCheckedProducts >= 0
        ? totalCheckedProducts
        : dailyCheck.totalExpectedQty || dailyCheck.products.length;

    const normalizedCategoryCounts = Array.isArray(categoryCounts) && categoryCounts.length > 0
      ? categoryCounts.map((c: any) => {
          const summaryMatch = dailyCheck.categorySummaries.find(
            (s) =>
              s.categoryCode === c?.categoryCode ||
              stripVnAccents(s.categoryName) === stripVnAccents(c?.categoryName)
          );
          const expectedTotalQty =
            typeof c?.expectedTotalQty === 'number'
              ? Number(c.expectedTotalQty)
              : summaryMatch?.expectedTotalQty ?? 0;
          const actualTotalQty =
            typeof c?.actualTotalQty === 'number'
              ? Math.max(0, Number(c.actualTotalQty))
              : expectedTotalQty;
          return {
            categoryId: String(c?.categoryId || summaryMatch?.categoryId || ''),
            categoryCode: String(c?.categoryCode || summaryMatch?.categoryCode || 'CAT').toUpperCase(),
            categoryName: String(c?.categoryName || summaryMatch?.categoryName || 'Danh mục'),
            expectedTotalQty,
            actualTotalQty,
            unit: String(c?.unit || summaryMatch?.unit || 'Cái'),
            productCount: Number(c?.productCount ?? summaryMatch?.productCount ?? 0),
            note: String(c?.note || '').trim(),
          };
        })
      : dailyCheck.categorySummaries.map((s) => ({
          categoryId: s.categoryId,
          categoryCode: s.categoryCode,
          categoryName: s.categoryName,
          expectedTotalQty: s.expectedTotalQty,
          actualTotalQty: s.expectedTotalQty,
          unit: s.unit,
          productCount: s.productCount,
          note: '',
        }));

    const allProducts = await productRepo.find({});
    const prodByCode = new Map(
      allProducts.map((p: any) => [String(p.code || '').toUpperCase(), p])
    );

    let normalizedDiscrepancies = (Array.isArray(discrepancies) ? discrepancies : []).map(
      (d: any) => {
        const code = String(d?.productCode || '').trim().toUpperCase();
        const prod = prodByCode.get(code);
        const expected = Number(d?.expected) || 0;
        const actual = Number(d?.actual) || 0;
        return {
          productCode: code,
          productName: String(d?.productName || prod?.name || '').trim(),
          categoryName: String(d?.categoryName || prod?.categoryName || '').trim(),
          expected,
          actual,
          note:
            String(d?.note || '').trim() ||
            (actual > expected
              ? `Thừa ${actual - expected}`
              : actual < expected
                ? `Thiếu ${expected - actual}`
                : 'Khớp'),
        };
      }
    );

    // Nếu kiểm theo tổng số lượng danh mục mà có chênh lệch tổng và chưa truyền discrepancies chi tiết -> tự động ghi nhận vào discrepancies
    if (normalizedDiscrepancies.length === 0) {
      normalizedDiscrepancies = normalizedCategoryCounts
        .filter((c) => c.actualTotalQty !== c.expectedTotalQty)
        .map((c) => {
          const diff = c.actualTotalQty - c.expectedTotalQty;
          const defaultNote =
            diff > 0
              ? `Thừa +${diff} ${c.unit || 'Cái'}`
              : `Thiếu ${diff} ${c.unit || 'Cái'}`;
          return {
            productCode: `TONG_${c.categoryCode}`,
            productName: `Tổng ${c.categoryName}`,
            categoryName: c.categoryName,
            expected: c.expectedTotalQty,
            actual: c.actualTotalQty,
            note: c.note ? `${defaultNote} (${c.note})` : defaultNote,
          };
        });
    }

    const now = new Date();
    const targetStatus: 'DRAFT' | 'PENDING' = isDraft ? 'DRAFT' : 'PENDING';
    const cleanLateReason = String(lateCheckoutReason || '').trim();
    let computedLateMinutes = 0;

    // Khi nhân viên xác nhận gửi phiếu bàn giao thật (không phải bản nháp) cho ngày hôm nay:
    // Ghi nhận ngay thời điểm bấm xác nhận gửi (pendingCheckOutTime = now) để tính đúng giờ cho người bấm gửi
    if (!isDraft && effectiveDate === getTodayLocalStr(now)) {
      const todayAtt = await attendanceRepo.findOne({
        staffId: user.userId,
        date: effectiveDate,
      });

      if (todayAtt && !todayAtt.checkOutTime) {
        const effectiveShiftCode = todayAtt.shiftCode || shiftCode;
        const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
        const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
        const diffLateOut = totalMinutesNow - shiftEndMinutes;

        if (diffLateOut > 5 && effectiveShiftCode !== 'BOTH') {
          computedLateMinutes = diffLateOut;
          const finalReason = cleanLateReason || String(todayAtt.lateCheckoutReason || '').trim();
          // Nếu gửi từ giao diện kiểm hàng có truyền checkLateCheckout === true mà chưa có lý do -> yêu cầu nhập lý do
          if (req.body?.requireLateReason && !finalReason) {
            throw new ApiError(
              400,
              'LATE_CHECKOUT_REASON_REQUIRED',
              `Bạn đang gửi bàn giao & check-out trễ ${diffLateOut} phút (quá 5 phút sau giờ kết thúc ca). Vui lòng nhập lý do check-out trễ!`,
              { lateCheckoutMinutes: String(diffLateOut) }
            );
          }
        }

        // Chốt cứng mốc giờ bấm xác nhận gửi bàn giao vào bản ghi chấm công (nếu chưa chốt trước đó)
        const lockedOutTime = todayAtt.pendingCheckOutTime
          ? new Date(todayAtt.pendingCheckOutTime)
          : now;
        await attendanceRepo.updateById(todayAtt._id, {
          pendingCheckOutTime: lockedOutTime,
          ...(computedLateMinutes > 0 ? { lateCheckoutMinutes: computedLateMinutes } : {}),
          ...(cleanLateReason ? { lateCheckoutReason: cleanLateReason } : {}),
        });
      }
    }

    if (!isDraft) {
      // Khi lập phiếu bàn giao chính thức cho effectiveDate, đóng các phiếu PENDING cũ từ những ngày trước (< effectiveDate)
      // hoặc phiếu SHIFT_1 cùng ngày nếu đang lập phiếu kết ca tối (SHIFT_2 / BOTH)
      const prevPendingList = (await shiftHandoverRepo.find({ status: 'PENDING' })) as any[];
      for (const oldPending of prevPendingList) {
        const oldDate = String(oldPending.date || '');
        const shouldExpireOld =
          oldDate < effectiveDate ||
          (oldDate === effectiveDate &&
            oldPending.shiftCode === 'SHIFT_1' &&
            (shiftCode === 'SHIFT_2' || shiftCode === 'BOTH'));
        if (shouldExpireOld) {
          await shiftHandoverRepo.updateById(oldPending._id, { status: 'STORE_CLOSED' });
          await finalizeAttendanceCheckoutFromHandover(oldPending);
        }
      }
    }

    // Tìm phiếu DRAFT hoặc PENDING hiện có của nhân viên trong cùng ngày & ca để cập nhật lên
    const allForStaffToday = (await shiftHandoverRepo.find({
      date: effectiveDate,
      fromStaffId: user.userId,
      shiftCode,
    })) as any[];
    const existing = allForStaffToday.find(
      (h) => h.status === 'DRAFT' || h.status === 'PENDING'
    );

    if (existing && existing.status === 'PENDING' && isDraft) {
      throw new ApiError(
        400,
        'HANDOVER_ALREADY_SUBMITTED',
        'Phiếu bàn giao ca này đã được gửi chính thức (đang chờ ca sau xác nhận), không thể hạ xuống trạng thái Bản nháp!'
      );
    }

    const payload: any = {
      date: effectiveDate,
      shiftCode,
      fromStaffId: user.userId,
      fromStaffName: user.fullName || user.username,
      handoverType: 'TANG_1' as const,
      cashBalance: Number(cashBalance) || 0,
      checkedCategories: resolvedCheckedCategories,
      totalCheckedProducts: resolvedTotalChecked,
      categoryCounts: normalizedCategoryCounts,
      discrepancies: normalizedDiscrepancies,
      status: targetStatus,
      notes: String(notes || '').trim(),
      ...(cleanLateReason ? { lateCheckoutReason: cleanLateReason } : {}),
      ...(computedLateMinutes > 0 ? { lateCheckoutMinutes: computedLateMinutes } : {}),
      ...(!isDraft
        ? { submittedAt: existing?.submittedAt ? existing.submittedAt : now }
        : {}),
    };

    const handover = existing
      ? await shiftHandoverRepo.updateById(existing._id, payload)
      : await shiftHandoverRepo.create(payload);

    res.status(201).json({
      data: handover,
      meta: {
        message: isDraft
          ? 'Đã lưu bản nháp kiểm hàng trong ca! Bạn có thể cập nhật tiếp bất cứ lúc nào trước giờ tan ca.'
          : shiftCode === 'SHIFT_1'
            ? 'Đã chốt giờ gửi bàn giao ca! Khi Ca 2 xác nhận, bạn sẽ hoàn tất Check-out (giờ ra ca vẫn tính đúng lúc bạn bấm gửi).'
            : 'Đã lập phiếu kết ca tối! Ca 1 sáng hôm sau sẽ nhận được thông báo xác nhận bàn giao.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/handover/:id/confirm (Sales ca nhận hoặc Quản lý xác nhận nhận bàn giao ca)
shiftsRouter.post('/shifts/handover/:id/confirm', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const isManager = isHandoverManagerRole(user.role);
    const isSales = isSalesStaffUser(user);
    if (!isManager && !isSales) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xác nhận phiếu bàn giao ca');
    }

    const { id } = req.params;
    const handover = await shiftHandoverRepo.findById(id);
    if (!handover) {
      throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy biên bản bàn giao ca');
    }

    if (handover.status === 'DRAFT') {
      throw new ApiError(
        400,
        'HANDOVER_STILL_DRAFT',
        'Phiếu bàn giao ca này vẫn đang ở trạng thái Bản nháp (nhân viên chưa bấm xác nhận gửi bàn giao), chưa thể xác nhận!'
      );
    }

    if (!isManager) {
      if (String(handover.fromStaffId) === String(user.userId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Người lập phiếu bàn giao không thể tự xác nhận phiếu của chính mình');
      }
      if (handover.toStaffId && String(handover.toStaffId) !== String(user.userId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Phiếu bàn giao này đã được chỉ định cho nhân viên khác');
      }
    }

    const wasPending = handover.status === 'PENDING';
    const { accept = true, note = '' } = req.body || {};
    const cleanNote = String(note || '').trim();

    const updated = await shiftHandoverRepo.updateById(id, {
      toStaffId: user.userId,
      toStaffName: user.fullName || user.username,
      status: accept ? 'ACCEPTED' : 'DISCREPANCY_REPORTED',
      acceptedAt: new Date(),
      confirmNote: cleanNote,
      notes: cleanNote
        ? handover.notes
          ? `${handover.notes} | Xác nhận: ${cleanNote}`
          : `Xác nhận: ${cleanNote}`
        : handover.notes,
    });

    // Chỉ hoàn tất chấm công sau khi xác nhận một phiếu PENDING
    // với thời gian Check-out được giữ nguyên đúng thời điểm nhân viên Ca 1 bấm gửi bàn giao (pendingCheckOutTime / submittedAt)
    const finalizedFromStaffAttendance = wasPending
      ? await finalizeAttendanceCheckoutFromHandover(updated || handover)
      : null;

    res.json({
      data: updated,
      meta: {
        finalizedFromStaffAttendance,
        message: accept
          ? 'Đã xác nhận thông tin bàn giao ca thành công!'
          : 'Đã ghi nhận báo lệch thông tin bàn giao ca.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/shifts/handover/:id (Admin/HR/Kế toán xóa phiếu bàn giao ca trên CMS)
shiftsRouter.delete('/shifts/handover/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !isHandoverManagerRole(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản trị viên / HR / Kế toán mới có quyền xóa phiếu bàn giao ca');
    }

    const { id } = req.params;
    const handover = await shiftHandoverRepo.findById(id);
    if (!handover) {
      throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy phiếu bàn giao ca');
    }

    await shiftHandoverRepo.deleteById(id);
    res.json({
      data: { deleted: true, _id: id },
      meta: { message: 'Đã xóa phiếu bàn giao ca' },
    });
  } catch (err) {
    next(err);
  }
});

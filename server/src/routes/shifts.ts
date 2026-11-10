import { Router } from 'express';
import { shiftAssignmentRepo, shiftHandoverRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';
import { ShiftType } from '../models/ShiftAssignment';
import { getSalesMonthlyUnpaidOffDates, SALES_MAX_UNPAID_OFF_PER_MONTH } from './leaveRequests';

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
        `Vui lòng đăng ký đủ 7 ngày trong tuần (tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương OFF/tháng)`
      );
    }

    const offItems = preferences.filter(
      (item: any) => Boolean(item?.isOffRequested) || item?.preferenceShift === 'OFF'
    );
    const offCount = offItems.length;
    if (offCount > SALES_MAX_UNPAID_OFF_PER_MONTH) {
      throw new ApiError(
        400,
        'WEEKLY_OFF_REQUIRED',
        `Quy định khối Bán hàng: mỗi tháng chỉ được nghỉ không lương tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày (hiện chọn ${offCount} ngày OFF trong tuần)`
      );
    }

    const weekDateSet = new Set<string>(preferences.map((item: any) => String(item?.date || '')));
    const monthsInWeek = Array.from(new Set(Array.from(weekDateSet).map((d) => d.slice(0, 7))));
    for (const ym of monthsInWeek) {
      const usedOutsideWeek = await getSalesMonthlyUnpaidOffDates(String(staff._id), ym, {
        excludeShiftDates: weekDateSet,
      });
      const offDatesInMonthThisWeek = offItems
        .map((item: any) => String(item.date))
        .filter((d: string) => d.startsWith(`${ym}-`) && !usedOutsideWeek.has(d));
      const totalInMonth = usedOutsideWeek.size + offDatesInMonthThisWeek.length;
      if (totalInMonth > SALES_MAX_UNPAID_OFF_PER_MONTH) {
        const remaining = Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - usedOutsideWeek.size);
        throw new ApiError(
          400,
          'SALES_OFF_QUOTA_EXCEEDED',
          remaining === 0
            ? `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} bạn đã dùng hết ${SALES_MAX_UNPAID_OFF_PER_MONTH}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương (OFF). Các tuần còn lại trong tháng không được đăng ký OFF thêm, phải qua tháng mới!`
            : `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} chỉ còn ${remaining}/${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày nghỉ không lương (đã dùng ${usedOutsideWeek.size} ngày ở tuần khác), nhưng tuần này bạn đang chọn ${offDatesInMonthThisWeek.length} ngày OFF.`
        );
      }
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
        getSalesMonthlyUnpaidOffDates(String(user.userId), ym),
        getSalesMonthlyUnpaidOffDates(String(user.userId), ym, { excludeShiftDates: weekDateSet }),
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

    for (const s of allStaff as any[]) {
      const dept = s.department || (s.role === 'SALES' ? 'SALES' : 'OFFICE');
      if (dept !== 'SALES') continue;
      const sid = String(s._id);
      const byMonth: Record<string, { limit: number; usedTotal: number; usedOutsideWeek: number; remainingForWeek: number }> = {};
      for (const ym of monthsInWeek) {
        const [usedTotalSet, usedOutsideSet] = await Promise.all([
          getSalesMonthlyUnpaidOffDates(sid, ym),
          getSalesMonthlyUnpaidOffDates(sid, ym, { excludeShiftDates: weekDateSet }),
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
        })),
        monthlyOffByStaff,
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
    const violations: Record<string, string> = {};
    for (const [sid, plan] of finalPlan) {
      if (plan.size === 0) continue;
      const st: any = await staffRepo.findById(sid);
      if (!st) continue;
      const dept = st.department || (st.role === 'SALES' ? 'SALES' : 'OFFICE');
      if (dept !== 'SALES') continue;
      const offDatesInWeek = Array.from(plan.entries())
        .filter(([, v]) => v === 'OFF')
        .map(([d]) => d);
      const offCount = offDatesInWeek.length;
      const missing = 7 - plan.size;
      const problems: string[] = [];
      if (missing > 0) problems.push(`còn ${missing} ngày chưa xếp`);
      if (offCount > SALES_MAX_UNPAID_OFF_PER_MONTH) {
        problems.push(`đang nghỉ ${offCount} ngày trong tuần (tối đa ${SALES_MAX_UNPAID_OFF_PER_MONTH} ngày/tháng)`);
      }
      for (const ym of monthsInWeek) {
        const usedOutside = await getSalesMonthlyUnpaidOffDates(sid, ym, { excludeShiftDates: weekDateSet });
        const offInMonthThisWeek = offDatesInWeek.filter((d) => d.startsWith(`${ym}-`) && !usedOutside.has(d));
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
      for (const a of remainingAssign as any[]) {
        if (!weekDates.includes(a.date)) continue;
        await shiftAssignmentRepo.updateById(a._id, {
          assignedBy: 'HR',
          confirmedAt: now,
          seenByStaff: false,
        });
        confirmed++;
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

// POST /api/v1/shifts/handover (Sales Ca 1 tạo biên bản bàn giao Kho Tầng 1)
shiftsRouter.post('/shifts/handover', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { date, shiftCode = 'SHIFT_1', cashBalance = 0, discrepancies = [], notes = '' } = req.body || {};

    const handover = await shiftHandoverRepo.create({
      date: date || new Date().toISOString().slice(0, 10),
      shiftCode,
      fromStaffId: user.userId,
      fromStaffName: user.fullName || user.username,
      handoverType: 'TANG_1',
      cashBalance: Number(cashBalance) || 0,
      discrepancies: Array.isArray(discrepancies) ? discrepancies : [],
      status: 'PENDING',
      notes: String(notes).trim(),
    });

    res.status(201).json({
      data: handover,
      meta: { message: 'Biên bản bàn giao Kho Tầng 1 đã được gửi, đang chờ ca sau xác nhận' },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/handover/:id/confirm (Sales Ca 2 xác nhận nhận bàn giao ca)
shiftsRouter.post('/shifts/handover/:id/confirm', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { id } = req.params;
    const handover = await shiftHandoverRepo.findById(id);
    if (!handover) {
      throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy biên bản bàn giao ca');
    }

    const { accept = true, note = '' } = req.body || {};

    const updated = await shiftHandoverRepo.updateById(id, {
      toStaffId: user.userId,
      toStaffName: user.fullName || user.username,
      status: accept ? 'ACCEPTED' : 'PENDING',
      acceptedAt: accept ? new Date() : undefined,
      notes: note ? `${handover.notes} | Xác nhận: ${note}` : handover.notes,
    });

    res.json({
      data: updated,
      meta: {
        message: accept
          ? 'Đã xác nhận nhận bàn giao ca thành công! Nút Check-out của ca trước đã được mở khóa.'
          : 'Đã từ chối bàn giao ca, yêu cầu kiểm đếm lại.',
      },
    });
  } catch (err) {
    next(err);
  }
});

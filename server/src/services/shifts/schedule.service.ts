import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from '../../repositories';
import { addDaysToDateStr } from '../../shared/date';
import { ApiError } from '../../shared/errors';
import { ServiceContext } from '../../shared/http';
import { ok, ServiceResult } from '../../shared/result';
import {
  getSalesMonthlyUnpaidOffDates,
  getStaffPaidLeaveBalance,
  SALES_MAX_UNPAID_OFF_PER_MONTH,
} from '../leaveRequests.service';
import {
  getCurrentMondayStr,
  getNextMondayStr,
  SHIFT_REG_PAID_LEAVE_REASON,
} from './schedule.rules';

export async function getWeeklySchedule(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  if (ctx.user && !ctx.isFallbackUser && !['CEO', 'ADMIN', 'HR'].includes(ctx.user.role)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Giám đốc (CEO), Nhân sự (HR) hoặc Quản trị viên (ADMIN) mới có quyền xem bảng xếp ca toàn công ty'
    );
  }
  const { weekStart } = query || {};
  let assignments = await shiftAssignmentRepo.find({});
  const startStr =
    typeof weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
      ? String(weekStart)
      : getCurrentMondayStr();
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(startStr, i));
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
      byMonth: Record<
        string,
        { limit: number; usedTotal: number; usedOutsideWeek: number; remainingForWeek: number }
      >;
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

  const offRequestsByStaff: Record<
    string,
    { date: string; type: string; status: string; reason: string }[]
  > = {};

  for (const s of allStaff as any[]) {
    const dept = s.department || (s.role === 'SALES' ? 'SALES' : 'OFFICE');
    if (dept !== 'SALES') continue;
    const sid = String(s._id);
    const pBalance = await getStaffPaidLeaveBalance(sid, primaryMonth, { approvedOnly: false });
    const paidLeaveBonus = pBalance.eligible ? Math.max(0, pBalance.entitledInMonth) : 0;
    const combinedLimit = SALES_MAX_UNPAID_OFF_PER_MONTH + paidLeaveBonus;

    const byMonth: Record<
      string,
      { limit: number; usedTotal: number; usedOutsideWeek: number; remainingForWeek: number }
    > = {};
    for (const ym of monthsInWeek) {
      const [usedTotalSet, usedOutsideSet] = await Promise.all([
        getSalesMonthlyUnpaidOffDates(sid, ym, { includePendingLeave: true }),
        getSalesMonthlyUnpaidOffDates(sid, ym, {
          excludeShiftDates: weekDateSet,
          includePendingLeave: true,
        }),
      ]);
      const ymBalance =
        ym === primaryMonth ? pBalance : await getStaffPaidLeaveBalance(sid, ym, { approvedOnly: false });
      const ymBonus = ymBalance.eligible ? Math.max(0, ymBalance.entitledInMonth) : 0;
      const ymLimit = SALES_MAX_UNPAID_OFF_PER_MONTH + ymBonus;
      byMonth[ym] = {
        limit: ymLimit,
        usedTotal: usedTotalSet.size,
        usedOutsideWeek: usedOutsideSet.size,
        remainingForWeek: Math.max(0, ymLimit - usedOutsideSet.size),
      };
    }
    const pStats = byMonth[primaryMonth] || {
      limit: combinedLimit,
      usedTotal: 0,
      usedOutsideWeek: 0,
      remainingForWeek: combinedLimit,
    };
    monthlyOffByStaff[sid] = {
      limit: combinedLimit,
      primaryMonth,
      usedTotal: pStats.usedTotal,
      usedOutsideWeek: pStats.usedOutsideWeek,
      remainingForWeek: pStats.remainingForWeek,
      byMonth,
    };

    const stWeekLeaves = (allLeaves as any[]).filter(
      (l) =>
        String(l.staffId) === sid &&
        weekDateSet.has(String(l.date || '')) &&
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED')
    );
    offRequestsByStaff[sid] = stWeekLeaves
      .filter((l) => l.reason !== SHIFT_REG_PAID_LEAVE_REASON)
      .map((l) => ({
        date: String(l.date),
        type: String(l.type),
        status: String(l.status),
        reason: String(l.reason || ''),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
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

  return ok(
    {
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
      offRequestsByStaff,
    },
    { total: assignments.length }
  );
}

export async function assignWeekBulk(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user || !['CEO', 'ADMIN', 'HR'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Chỉ CEO, HR hoặc ADMIN mới có quyền xếp ca');
  }

  const { weekStart, changes = [], confirmWeek = false } = body || {};
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

  const wsStr = /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart || ''))
    ? String(weekStart)
    : String(changes[0]?.date || getNextMondayStr());
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(wsStr, i));
  const weekDateSet = new Set<string>(weekDates);
  const allLeaves = await leaveRequestRepo.find({});
  const leaveRequestMap = new Map<string, any>();
  for (const l of allLeaves as any[]) {
    const d = String(l.date || '');
    if (!weekDateSet.has(d)) continue;
    if (l.type !== 'OFF' && l.type !== 'PAID_LEAVE') continue;
    if (l.status !== 'PENDING' && l.status !== 'APPROVED') continue;
    if (l.reason === SHIFT_REG_PAID_LEAVE_REASON) continue;
    const k = `${String(l.staffId)}_${d}`;
    if (!leaveRequestMap.has(k) || l.status === 'APPROVED') {
      leaveRequestMap.set(k, l);
    }
  }

  const staffCache = new Map<string, any>();
  let createdCount = 0;
  let updated = 0;
  let deleted = 0;
  const now = new Date();
  const offOverrides: {
    staffId: string;
    staffName: string;
    date: string;
    shiftCode: string;
    leaveType: string;
    leaveStatus: string;
  }[] = [];

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

    const leaveReq = leaveRequestMap.get(`${staffId}_${date}`);
    const isOverrideOff = Boolean(leaveReq && c.shiftCode !== 'OFF');

    if (!staffCache.has(staffId)) {
      staffCache.set(staffId, await staffRepo.findById(staffId));
    }
    const staff = staffCache.get(staffId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    if (isOverrideOff) {
      offOverrides.push({
        staffId,
        staffName: staff.fullName || '',
        date,
        shiftCode: c.shiftCode,
        leaveType: String(leaveReq.type),
        leaveStatus: String(leaveReq.status),
      });
    }

    if (existing) {
      await shiftAssignmentRepo.updateById(existing._id, {
        shiftCode: c.shiftCode,
        overrideOffNotice: isOverrideOff,
        ...(isOverrideOff ? { seenByStaff: false } : {}),
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

    await shiftAssignmentRepo.create({
      weekStart: weekStart || date,
      date,
      dayOfWeek: Number(c.dayOfWeek) || 1,
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      shiftCode: c.shiftCode,
      overrideOffNotice: isOverrideOff,
      assignedBy: confirmWeek ? 'HR' : 'AUTO',
      ...(confirmWeek || isOverrideOff
        ? {
            confirmedAt: confirmWeek ? now : undefined,
            seenByStaff: false,
          }
        : {
            seenByStaff: true,
          }),
    });
    createdCount++;
  }

  let confirmed = 0;
  if (confirmWeek) {
    const remainingAssign = await shiftAssignmentRepo.find({});
    const weekOffKeys = new Set<string>();
    for (const a of remainingAssign as any[]) {
      if (!weekDates.includes(a.date)) continue;
      const lv = leaveRequestMap.get(`${String(a.staffId)}_${String(a.date)}`);
      const isOver = Boolean(lv && a.shiftCode !== 'OFF');
      if (
        isOver &&
        !offOverrides.some((o) => o.staffId === String(a.staffId) && o.date === String(a.date))
      ) {
        offOverrides.push({
          staffId: String(a.staffId),
          staffName: String(a.staffName || ''),
          date: String(a.date),
          shiftCode: String(a.shiftCode),
          leaveType: String(lv.type),
          leaveStatus: String(lv.status),
        });
      }
      await shiftAssignmentRepo.updateById(a._id, {
        assignedBy: 'HR',
        confirmedAt: now,
        seenByStaff: false,
        overrideOffNotice: isOver,
      });
      if (a.shiftCode === 'OFF') {
        weekOffKeys.add(`${String(a.staffId)}_${String(a.date)}`);
      }
      confirmed++;
    }

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

  return ok(
    { created: createdCount, updated, deleted, confirmed, offOverrides },
    {
      message:
        offOverrides.length > 0
          ? `Đã lưu lịch ca và gửi thông báo yêu cầu đi làm ngày OFF tới ${offOverrides.length} lượt Sales!`
          : confirmWeek
            ? 'Đã lưu và xác nhận lịch phân ca tuần! Nhân viên sẽ nhận được thông báo lịch mới.'
            : 'Đã lưu nháp lịch phân ca tuần.',
    }
  );
}

export async function assignSingleShift(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user || !['CEO', 'ADMIN', 'HR'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Chỉ CEO, HR hoặc ADMIN mới có quyền xếp ca');
  }

  const { staffId, date, weekStart, dayOfWeek, shiftCode } = body || {};
  if (!staffId || !date || !shiftCode) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu thông tin phân ca');
  }

  const staff = await staffRepo.findById(staffId);
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

  const existing = await shiftAssignmentRepo.findOne({ staffId, date });
  const result = existing
    ? await shiftAssignmentRepo.updateById(existing._id, { shiftCode, assignedBy: 'HR' })
    : await shiftAssignmentRepo.create({
        weekStart: weekStart || date,
        date,
        dayOfWeek: Number(dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode,
        assignedBy: 'HR',
      });

  return ok(result, { message: 'Cập nhật phân ca thành công' });
}

import { Router } from 'express';
import {
  attendanceRepo,
  leaveRequestRepo,
  shiftAssignmentRepo,
  staffRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { getMergedHolidayMap } from './holidays';

/**
 * Bảng công tháng toàn công ty (Timesheet) + Điều chỉnh giờ công / Chấm công bù cho HR.
 */
export const attendanceTimesheetRouter = Router();

type ShiftCode = 'SHIFT_1' | 'SHIFT_2';

// Khung giờ ca (phút trong ngày)
const SHIFT_RULES: Record<ShiftCode, { start: number; end: number; label: string }> = {
  SHIFT_1: { start: 8 * 60 + 30, end: 17 * 60 + 30, label: 'Ca 1 (08:30-17:30)' },
  SHIFT_2: { start: 12 * 60, end: 21 * 60, label: 'Ca 2 (12:00-21:00)' },
};

const LATE_TOLERANCE_MINUTES = 5;
const OFFICE_LUNCH_HOURS = 1.5;

export function getStandardHours(department: string): number {
  // OFFICE: 08:30-17:30 trừ nghỉ trưa 1.5h = 7.5h ; SALES: ca 9h
  return department === 'OFFICE' ? 7.5 : 9;
}

function getOfficeWorkdays(): number[] {
  const raw = process.env.ATTENDANCE_OFFICE_WORKDAYS || '1,2,3,4,5,6';
  const days = raw
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length > 0 ? days : [1, 2, 3, 4, 5, 6];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toHHmm(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseHHmm(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function combineDateAndMinutes(dateStr: string, minutes: number): Date {
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

  const lateMinutes = Math.max(0, params.checkInMinutes - rule.start);
  let status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'COMPLETED' =
    lateMinutes > LATE_TOLERANCE_MINUTES ? 'LATE' : 'ON_TIME';

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

function requireHr(req: any) {
  const user = req.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (!['ADMIN', 'HR'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền quản lý bảng công');
  }
  return user;
}

// GET /api/v1/attendance/timesheet?month=11&year=2026&department=OFFICE
attendanceTimesheetRouter.get('/attendance/timesheet', async (req, res, next) => {
  try {
    requireHr(req);

    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();
    if (month < 1 || month > 12) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tháng không hợp lệ');
    }
    const departmentFilter =
      req.query.department === 'OFFICE' || req.query.department === 'SALES'
        ? String(req.query.department)
        : null;

    const monthPrefix = `${year}-${pad(month)}-`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = toDateStr(now);
    const officeWorkdays = getOfficeWorkdays();

    const [allStaff, allAttendance, allLeaves, allAssignments, holidayMap] = await Promise.all([
      staffRepo.find({}),
      attendanceRepo.find({}),
      leaveRequestRepo.find({ status: 'APPROVED' }),
      shiftAssignmentRepo.find({}),
      getMergedHolidayMap([year]),
    ]);

    // Danh sách ngày trong tháng
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month - 1, i + 1);
      const date = toDateStr(d);
      const h = holidayMap.get(date);
      return {
        date,
        day: i + 1,
        weekday: d.getDay(),
        isToday: date === todayStr,
        holiday: h ? { name: h.name, isOfficialDayOff: h.isOfficialDayOff !== false } : null,
      };
    });

    const staffList = allStaff
      .filter((s: any) => s.role !== 'ADMIN')
      .filter((s: any) => {
        const dept = s.department || (s.role === 'SALES' ? 'SALES' : 'OFFICE');
        return !departmentFilter || dept === departmentFilter;
      });

    // Index dữ liệu theo nhân viên
    const attByStaff = new Map<string, Map<string, any>>();
    for (const a of allAttendance as any[]) {
      if (!String(a.date || '').startsWith(monthPrefix)) continue;
      const key = String(a.staffId);
      if (!attByStaff.has(key)) attByStaff.set(key, new Map());
      attByStaff.get(key)!.set(a.date, a);
    }
    const leaveByStaff = new Map<string, Map<string, any>>();
    for (const l of allLeaves as any[]) {
      if (!String(l.date || '').startsWith(monthPrefix)) continue;
      const key = String(l.staffId);
      if (!leaveByStaff.has(key)) leaveByStaff.set(key, new Map());
      const existing = leaveByStaff.get(key)!.get(l.date);
      // Ưu tiên đơn OFF (nghỉ cả ngày) khi trùng ngày
      if (!existing || l.type === 'OFF') leaveByStaff.get(key)!.set(l.date, l);
    }
    const assignByStaff = new Map<string, Map<string, any>>();
    for (const sa of allAssignments as any[]) {
      if (!String(sa.date || '').startsWith(monthPrefix)) continue;
      const key = String(sa.staffId);
      if (!assignByStaff.has(key)) assignByStaff.set(key, new Map());
      assignByStaff.get(key)!.set(sa.date, sa);
    }

    let workingNow = 0;
    let checkedInToday = 0;
    let lateToday = 0;
    let notCheckedInToday = 0;
    let missingCheckoutMonth = 0;
    let absentMonth = 0;

    const rows = staffList.map((staff: any) => {
      const staffId = String(staff._id);
      const department = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
      const standardHours = getStandardHours(department);
      const atts = attByStaff.get(staffId) || new Map();
      const leaves = leaveByStaff.get(staffId) || new Map();
      const assigns = assignByStaff.get(staffId) || new Map();
      const joinedStr = staff.createdAt ? toDateStr(new Date(staff.createdAt)) : '1970-01-01';

      const summary = {
        standardDays: 0,
        workUnits: 0,
        totalHours: 0,
        lateCount: 0,
        lateMinutes: 0,
        earlyCount: 0,
        earlyMinutes: 0,
        missingCheckout: 0,
        absentDays: 0,
        leaveDays: 0,
        wfhDays: 0,
        holidayWorkDays: 0,
        holidayWorkHours: 0,
        holidayPaidDays: 0,
        paidUnits: 0,
      };

      const cells: Record<string, any> = {};

      for (const dayInfo of days) {
        const { date, weekday } = dayInfo;
        const att = atts.get(date);
        const leave = leaves.get(date);
        const assign = assigns.get(date);
        const isOfficialHoliday = Boolean(dayInfo.holiday?.isOfficialDayOff);

        // Có phải ngày làm việc theo lịch không?
        let isScheduledWorkday: boolean;
        if (department === 'SALES' && assign) {
          // Sales: có lịch xếp ca -> theo ca (OFF = ngày nghỉ)
          isScheduledWorkday = assign.shiftCode !== 'OFF';
        } else {
          // Văn phòng (và Sales chưa xếp ca): theo ngày làm việc trong tuần (mặc định T2-T7)
          isScheduledWorkday = officeWorkdays.includes(weekday);
        }
        // Ngày lễ chính thức (Điều 112 BLLĐ 2019) rơi vào ngày làm việc trong tuần -> nghỉ & HƯỞNG NGUYÊN LƯƠNG (tính 1 công).
        // Chỉ lễ chính thức (isOfficialDayOff) mới được tính công; lễ sự kiện/kỷ niệm không tính.
        const isPaidHoliday = isOfficialHoliday && officeWorkdays.includes(weekday);
        if (isOfficialHoliday) isScheduledWorkday = false;
        const isBeforeJoin = date < joinedStr;
        // Công chuẩn tháng = ngày làm việc theo lịch + ngày lễ chính thức được hưởng lương (không phụ thuộc ngày tạo tài khoản)
        if (isScheduledWorkday || isPaidHoliday) summary.standardDays += 1;
        // Công lễ hưởng lương: tính khi đã tới ngày đó và nhân viên đã vào làm
        if (isPaidHoliday && !isBeforeJoin && date <= todayStr) summary.holidayPaidDays += 1;

        if (att) {
          const isOpen = !att.checkOutTime;
          const isPastDay = date < todayStr;
          const late = Number(att.lateMinutes || 0) > LATE_TOLERANCE_MINUTES;
          const early = Number(att.earlyMinutes || 0) > 0 && !isOpen;
          let code: string;
          if (isOpen && isPastDay) code = 'MISSING_OUT';
          else if (isOpen) code = 'WORKING';
          else if (late && early) code = 'LATE_EARLY';
          else if (late) code = 'LATE';
          else if (early) code = 'EARLY';
          else if (att.checkInType === 'WFH') code = 'WFH';
          else code = 'ON_TIME';

          const hours = Number(att.totalWorkHours || 0);
          summary.totalHours += hours;
          if (isOfficialHoliday) {
            // Đi làm ngày lễ: đã có công lễ hưởng lương, giờ làm tính riêng để trả lương làm thêm ngày lễ (>= 300%)
            summary.holidayWorkHours += hours;
          } else if (!isOpen) {
            summary.workUnits += Math.min(1, hours / standardHours);
          }
          if (late) {
            summary.lateCount += 1;
            summary.lateMinutes += Number(att.lateMinutes || 0);
          }
          if (early) {
            summary.earlyCount += 1;
            summary.earlyMinutes += Number(att.earlyMinutes || 0);
          }
          if (code === 'MISSING_OUT') {
            summary.missingCheckout += 1;
            missingCheckoutMonth += 1;
          }
          if (att.checkInType === 'WFH') summary.wfhDays += 1;
          if (isOfficialHoliday) summary.holidayWorkDays += 1;

          if (date === todayStr) {
            checkedInToday += 1;
            if (isOpen) workingNow += 1;
            if (late) lateToday += 1;
          }

          cells[date] = {
            code,
            attendanceId: String(att._id),
            shiftCode: att.shiftCode,
            checkIn: toHHmm(att.checkInTime),
            checkOut: toHHmm(att.checkOutTime),
            hours,
            lateMinutes: Number(att.lateMinutes || 0),
            earlyMinutes: Number(att.earlyMinutes || 0),
            checkInType: att.checkInType,
            isHolidayWork: isOfficialHoliday,
            isPaidHoliday,
            adjusted: Boolean(att.adjustedAt),
            adjustedByName: att.adjustedByName || '',
            adjustReason: att.adjustReason || '',
            note: att.notes || '',
          };
          continue;
        }

        // Không có bản ghi chấm công
        let code: string;
        if (isBeforeJoin) code = 'DAY_OFF';
        else if (date > todayStr) code = isOfficialHoliday ? 'HOLIDAY' : isScheduledWorkday ? 'FUTURE' : 'DAY_OFF';
        else if (isOfficialHoliday) code = 'HOLIDAY';
        else if (leave && leave.type === 'OFF') code = 'LEAVE';
        else if (!isScheduledWorkday) code = 'DAY_OFF';
        else if (date === todayStr) code = 'FUTURE';
        else code = 'ABSENT';

        if (code === 'LEAVE') summary.leaveDays += 1;
        if (code === 'ABSENT') {
          summary.absentDays += 1;
          absentMonth += 1;
        }
        if (date === todayStr && isScheduledWorkday && !isOfficialHoliday && !(leave && leave.type === 'OFF')) {
          notCheckedInToday += 1;
        }

        cells[date] = {
          code,
          isPaidHoliday: isPaidHoliday && !isBeforeJoin,
          shiftCode: assign && assign.shiftCode !== 'OFF' ? assign.shiftCode : null,
          note: leave ? leave.reason || '' : '',
        };
      }

      summary.workUnits = Number(summary.workUnits.toFixed(2));
      summary.holidayWorkHours = Number(summary.holidayWorkHours.toFixed(2));
      // Tổng công tính lương = công đi làm thực tế + công nghỉ lễ chính thức hưởng lương
      summary.paidUnits = Number((summary.workUnits + summary.holidayPaidDays).toFixed(2));
      summary.totalHours = Number(summary.totalHours.toFixed(2));

      return {
        staffId,
        staffCode: staff.code,
        staffName: staff.fullName,
        department,
        role: staff.role,
        standardHours,
        cells,
        summary,
      };
    });

    rows.sort((a: any, b: any) => String(a.staffCode).localeCompare(String(b.staffCode)));

    res.json({
      data: {
        month,
        year,
        days,
        rows,
        overview: {
          totalStaff: rows.length,
          workingNow,
          checkedInToday,
          lateToday,
          notCheckedInToday,
          missingCheckoutMonth,
          absentMonth,
        },
      },
      meta: { total: rows.length },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/attendance/:id  (HR điều chỉnh giờ công)
attendanceTimesheetRouter.patch('/attendance/:id', async (req, res, next) => {
  try {
    const user = requireHr(req);
    const { id } = req.params;
    const { checkIn, checkOut, shiftCode, reason } = req.body || {};

    if (!reason || !String(reason).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do điều chỉnh giờ công');
    }

    const att: any = await attendanceRepo.findById(id);
    if (!att) throw new ApiError(404, 'ATTENDANCE_NOT_FOUND', 'Không tìm thấy bản ghi chấm công');

    const finalShift: ShiftCode =
      shiftCode === 'SHIFT_1' || shiftCode === 'SHIFT_2' ? shiftCode : att.shiftCode || 'SHIFT_1';

    const inMinutes =
      checkIn !== undefined ? parseHHmm(checkIn) : parseHHmm(toHHmm(att.checkInTime) || '');
    if (inMinutes === null) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Giờ vào không hợp lệ (định dạng HH:mm)');
    }

    let outMinutes: number | null = null;
    if (checkOut !== undefined && checkOut !== null && checkOut !== '') {
      outMinutes = parseHHmm(checkOut);
      if (outMinutes === null) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Giờ ra không hợp lệ (định dạng HH:mm)');
      }
    } else if (checkOut === undefined && att.checkOutTime) {
      outMinutes = parseHHmm(toHHmm(att.checkOutTime) || '');
    }

    const metrics = computeAttendanceMetrics({
      date: att.date,
      department: att.department,
      shiftCode: finalShift,
      checkInMinutes: inMinutes,
      checkOutMinutes: outMinutes,
    });

    const updated = await attendanceRepo.updateById(id, {
      shiftCode: finalShift,
      checkInTime: metrics.checkInTime,
      workStartTime: metrics.workStartTime,
      checkOutTime: metrics.checkOutTime ?? null,
      lateMinutes: metrics.lateMinutes,
      earlyMinutes: metrics.earlyMinutes,
      totalWorkHours: metrics.totalWorkHours,
      lunchPauseMinutes: metrics.lunchPauseMinutes,
      status: metrics.status,
      adjustedBy: user.userId,
      adjustedByName: user.fullName || user.username || '',
      adjustedAt: new Date(),
      adjustReason: String(reason).trim(),
    } as any);

    res.json({
      data: updated,
      meta: { message: 'Đã điều chỉnh giờ công' },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/attendance/manual  (HR chấm công bù)
attendanceTimesheetRouter.post('/attendance/manual', async (req, res, next) => {
  try {
    const user = requireHr(req);
    const { staffId, date, shiftCode = 'SHIFT_1', checkIn, checkOut, reason } = req.body || {};

    if (!staffId || !date || !checkIn) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu nhân viên, ngày hoặc giờ vào');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày không hợp lệ (YYYY-MM-DD)');
    }
    if (!reason || !String(reason).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do chấm công bù');
    }
    if (String(date) > toDateStr(new Date())) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Không thể chấm công bù cho ngày trong tương lai');
    }

    const staff: any = await staffRepo.findById(String(staffId));
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
    if (staff.role === 'ADMIN') {
      throw new ApiError(400, 'ADMIN_NO_ATTENDANCE', 'Tài khoản Quản trị viên không cần chấm công');
    }

    const existing = await attendanceRepo.findOne({ staffId: String(staff._id), date: String(date) });
    if (existing) {
      throw new ApiError(400, 'ALREADY_CHECKED_IN', 'Ngày này đã có bản ghi chấm công, vui lòng dùng chức năng điều chỉnh');
    }

    const inMinutes = parseHHmm(checkIn);
    if (inMinutes === null) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Giờ vào không hợp lệ (định dạng HH:mm)');
    }
    let outMinutes: number | null = null;
    if (checkOut) {
      outMinutes = parseHHmm(checkOut);
      if (outMinutes === null) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Giờ ra không hợp lệ (định dạng HH:mm)');
      }
    }

    const department = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
    const finalShift: ShiftCode =
      department === 'SALES' && shiftCode === 'SHIFT_2' ? 'SHIFT_2' : 'SHIFT_1';

    const metrics = computeAttendanceMetrics({
      date: String(date),
      department,
      shiftCode: finalShift,
      checkInMinutes: inMinutes,
      checkOutMinutes: outMinutes,
    });

    const created = await attendanceRepo.create({
      staffId: String(staff._id),
      staffCode: staff.code,
      staffName: staff.fullName,
      department,
      date: String(date),
      shiftCode: finalShift,
      checkInTime: metrics.checkInTime,
      workStartTime: metrics.workStartTime,
      checkOutTime: metrics.checkOutTime,
      checkInType: 'STANDARD',
      status: metrics.status,
      lateMinutes: metrics.lateMinutes,
      earlyMinutes: metrics.earlyMinutes,
      lunchPauseMinutes: metrics.lunchPauseMinutes,
      totalWorkHours: metrics.totalWorkHours,
      notes: 'Chấm công bù bởi HR',
      adjustedBy: user.userId,
      adjustedByName: user.fullName || user.username || '',
      adjustedAt: new Date(),
      adjustReason: String(reason).trim(),
    } as any);

    res.status(201).json({
      data: created,
      meta: { message: 'Đã chấm công bù' },
    });
  } catch (err) {
    next(err);
  }
});

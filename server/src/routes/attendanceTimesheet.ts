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
const OFFICE_LUNCH_HOURS = 1;

export function getStandardHours(department: string): number {
  // OFFICE: 08:30-12:00 & 13:00-17:30 (nghỉ trưa 1h = 8h) ; SALES: ca 9h
  return department === 'OFFICE' ? 8 : 9;
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

function getOvertimeMinMinutes(): number {
  const v = Number(process.env.ATTENDANCE_OVERTIME_MIN_MINUTES ?? 30);
  return Number.isFinite(v) && v >= 0 ? v : 30;
}

/**
 * Tính bảng công tháng (dùng chung cho HR xem toàn công ty & nhân viên xem lịch công của mình).
 */
export async function buildTimesheet(params: {
  month: number;
  year: number;
  departmentFilter?: string | null;
  staffIdFilter?: string | null;
}) {
    const { month, year } = params;
    const departmentFilter = params.departmentFilter || null;
    const now = new Date();
    const overtimeMin = getOvertimeMinMinutes();

    const monthPrefix = `${year}-${pad(month)}-`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = toDateStr(now);
    const officeWorkdays = getOfficeWorkdays();

    const [allStaff, allAttendance, allLeaves, allAssignments, holidayMap] = await Promise.all([
      staffRepo.find({}),
      attendanceRepo.find({}),
      leaveRequestRepo.find({}),
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
      .filter((s: any) => !params.staffIdFilter || String(s._id) === String(params.staffIdFilter))
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
    // Đơn từ theo nhân viên/ngày: leaveByStaff = đơn OFF/khác ĐÃ DUYỆT (ưu tiên OFF); allLeavesByStaff = mọi trạng thái
    const leaveByStaff = new Map<string, Map<string, any>>();
    const allLeavesByStaff = new Map<string, Map<string, any[]>>();
    for (const l of allLeaves as any[]) {
      if (!String(l.date || '').startsWith(monthPrefix)) continue;
      const key = String(l.staffId);
      if (!allLeavesByStaff.has(key)) allLeavesByStaff.set(key, new Map());
      const dayList = allLeavesByStaff.get(key)!.get(l.date) || [];
      dayList.push(l);
      allLeavesByStaff.get(key)!.set(l.date, dayList);
      if (l.status !== 'APPROVED') continue;
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
      const allLeavesOfStaff = allLeavesByStaff.get(staffId) || new Map<string, any[]>();
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
        overtimeDays: 0,
        overtimeMinutes: 0,
        pendingRequests: 0,
        paidLeaveEntitled: 0,
        paidLeaveUsed: 0,
        paidLeaveForfeited: 0,
      };
      // Không suy diễn mặc định: chỉ HĐ được ghi rõ FULLTIME mới có ngày phép có lương
      const contractType = staff.contractType || 'UNKNOWN';
      const monthLastDate = days[days.length - 1]?.date || `${monthPrefix}31`;
      // Hợp đồng Chính thức: 1 ngày nghỉ phép có lương/tháng (nếu đã vào làm trong tháng)
      if (contractType === 'FULLTIME' && joinedStr <= monthLastDate) summary.paidLeaveEntitled = 1;

      const cells: Record<string, any> = {};

      for (const dayInfo of days) {
        const { date, weekday } = dayInfo;
        const att = atts.get(date);
        const leave = leaves.get(date);
        const assign = assigns.get(date);
        const isOfficialHoliday = Boolean(dayInfo.holiday?.isOfficialDayOff);
        const dayLeaves: any[] = allLeavesOfStaff.get(date) || [];
        const leaveRequests = dayLeaves.map((l) => ({
          id: String(l._id),
          type: l.type,
          status: l.status,
          reason: l.reason || '',
          reviewNote: l.reviewNote || '',
        }));
        summary.pendingRequests += dayLeaves.filter((l) => l.status === 'PENDING').length;
        const approvedTypes = new Set(dayLeaves.filter((l) => l.status === 'APPROVED').map((l) => l.type));

        // Có phải ngày làm việc theo lịch không?
        //  - VĂN PHÒNG: T2-T7 (nghỉ Chủ nhật bắt buộc); ngày lễ chính thức được nghỉ.
        //  - BÁN HÀNG: MẶC ĐỊNH NGÀY NÀO CŨNG LÀ NGÀY LÀM (kể cả Chủ nhật & ngày lễ).
        //    Chỉ nghỉ khi HR xếp ca OFF (bắt buộc đúng 1 ngày/tuần).
        let isScheduledWorkday: boolean;
        let countsInStandard: boolean;
        if (department === 'SALES') {
          isScheduledWorkday = assign ? assign.shiftCode !== 'OFF' : true;
          // Công chuẩn Sales = 6 ngày/tuần: tuần đã xếp ca -> theo ca; chưa xếp -> tạm trừ 1 ngày/tuần (Chủ nhật) khi đếm
          countsInStandard = assign ? assign.shiftCode !== 'OFF' : weekday !== 0;
        } else {
          isScheduledWorkday = officeWorkdays.includes(weekday);
          countsInStandard = isScheduledWorkday;
        }
        // Quy định ngày lễ CHÍNH THỨC (lễ sự kiện/kỷ niệm = ngày làm việc bình thường, không áp dụng):
        //  - Khối VĂN PHÒNG: được nghỉ & vẫn TÍNH 1 CÔNG (nếu lễ rơi vào T2-T7). Bị yêu cầu đi làm -> lương x4.
        //  - Khối BÁN HÀNG: ngày lễ là NGÀY LÀM BÌNH THƯỜNG (không nghỉ, không cộng công lễ). Đi làm -> lương x4.
        const isPaidHoliday =
          department === 'OFFICE' && isOfficialHoliday && officeWorkdays.includes(weekday);
        const isOfficeHolidayOff = department === 'OFFICE' && isOfficialHoliday;
        if (isOfficeHolidayOff) {
          isScheduledWorkday = false;
          countsInStandard = false;
        }
        const isBeforeJoin = date < joinedStr;
        // Công chuẩn tháng = ngày làm theo lịch + ngày lễ chính thức hưởng lương (VP) (không phụ thuộc ngày tạo tài khoản)
        if (countsInStandard || isPaidHoliday) summary.standardDays += 1;
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

          // Tăng ca: số phút làm sau giờ kết thúc ca (>= ngưỡng ATTENDANCE_OVERTIME_MIN_MINUTES)
          let overtimeMinutes = 0;
          if (att.checkOutTime) {
            const out = new Date(att.checkOutTime);
            const outMin = out.getHours() * 60 + out.getMinutes();
            const rule = SHIFT_RULES[(att.shiftCode as ShiftCode) || 'SHIFT_1'] || SHIFT_RULES.SHIFT_1;
            const ot = outMin - rule.end;
            if (ot >= overtimeMin) overtimeMinutes = ot;
          }
          if (overtimeMinutes > 0) {
            summary.overtimeDays += 1;
            summary.overtimeMinutes += overtimeMinutes;
          }
          if (isOfficialHoliday) summary.holidayWorkHours += hours;
          if (isOfficeHolidayOff) {
            // Văn phòng đi làm ngày lễ: đã có 1 công lễ (holidayPaidDays) -> giờ làm trả lương x4, không cộng thêm công thường
          } else if (!isOpen) {
            // Bán hàng: ngày lễ là ngày làm bình thường -> vẫn tính công; lương ngày đó x4 (holidayWorkDays)
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
            overtimeMinutes,
            earlyApproved: approvedTypes.has('EARLY'),
            lateApproved: approvedTypes.has('LATE'),
            leaveRequests,
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
        else if (date > todayStr) code = isOfficeHolidayOff ? 'HOLIDAY' : isScheduledWorkday ? 'FUTURE' : 'DAY_OFF';
        else if (approvedTypes.has('PAID_LEAVE') && isScheduledWorkday && contractType === 'FULLTIME')
          code = 'PAID_LEAVE';
        else if (isOfficeHolidayOff) code = 'HOLIDAY';
        else if (leave && leave.type === 'OFF') code = 'LEAVE';
        else if (!isScheduledWorkday) code = 'DAY_OFF';
        else if (date === todayStr) code = 'FUTURE';
        else code = 'ABSENT';

        if (code === 'LEAVE') summary.leaveDays += 1;
        if (code === 'PAID_LEAVE') summary.paidLeaveUsed += 1;
        if (code === 'ABSENT') {
          summary.absentDays += 1;
          absentMonth += 1;
        }
        if (
          date === todayStr &&
          isScheduledWorkday &&
          !(leave && leave.type === 'OFF') &&
          !approvedTypes.has('PAID_LEAVE')
        ) {
          notCheckedInToday += 1;
        }

        cells[date] = {
          code,
          isPaidHoliday: isPaidHoliday && !isBeforeJoin,
          shiftCode: assign && assign.shiftCode !== 'OFF' ? assign.shiftCode : null,
          leaveRequests,
          note: leave ? leave.reason || '' : '',
        };
      }

      summary.workUnits = Number(summary.workUnits.toFixed(2));
      summary.holidayWorkHours = Number(summary.holidayWorkHours.toFixed(2));
      // Không dùng ngày phép có lương trong tháng (tháng đã kết thúc) -> mất quyền lợi
      if (summary.paidLeaveEntitled > 0 && summary.paidLeaveUsed === 0 && monthLastDate < todayStr) {
        summary.paidLeaveForfeited = 1;
      }
      // Tổng công tính lương = công đi làm + công lễ hưởng lương (Văn phòng) + ngày phép có lương
      summary.paidUnits = Number(
        (summary.workUnits + summary.holidayPaidDays + Math.min(summary.paidLeaveUsed, 1)).toFixed(2)
      );
      summary.totalHours = Number(summary.totalHours.toFixed(2));

      return {
        staffId,
        staffCode: staff.code,
        staffName: staff.fullName,
        department,
        role: staff.role,
        contractType,
        standardHours,
        cells,
        summary,
      };
    });

    rows.sort((a: any, b: any) => String(a.staffCode).localeCompare(String(b.staffCode)));

    return {
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
    };
}

function parseMonthYear(query: any) {
  const now = new Date();
  const month = Number(query.month) || now.getMonth() + 1;
  const year = Number(query.year) || now.getFullYear();
  if (month < 1 || month > 12) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tháng không hợp lệ');
  }
  return { month, year };
}

// GET /api/v1/attendance/timesheet?month=11&year=2026&department=OFFICE (HR/ADMIN)
attendanceTimesheetRouter.get('/attendance/timesheet', async (req, res, next) => {
  try {
    requireHr(req);
    const { month, year } = parseMonthYear(req.query);
    const departmentFilter =
      req.query.department === 'OFFICE' || req.query.department === 'SALES'
        ? String(req.query.department)
        : null;
    const data = await buildTimesheet({ month, year, departmentFilter });
    res.json({ data, meta: { total: data.rows.length } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/my-calendar?month=11&year=2026 (Nhân viên xem lịch công của chính mình)
attendanceTimesheetRouter.get('/attendance/my-calendar', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    if (user.role === 'ADMIN') {
      throw new ApiError(400, 'ADMIN_NO_ATTENDANCE', 'Tài khoản Quản trị viên (ADMIN) không cần chấm công');
    }
    const { month, year } = parseMonthYear(req.query);
    const data = await buildTimesheet({ month, year, staffIdFilter: String(user.userId) });
    const row = data.rows[0] || null;
    res.json({
      data: {
        month: data.month,
        year: data.year,
        days: data.days,
        row,
        rules: {
          shifts: {
            SHIFT_1: SHIFT_RULES.SHIFT_1.label,
            SHIFT_2: SHIFT_RULES.SHIFT_2.label,
          },
          lateToleranceMinutes: LATE_TOLERANCE_MINUTES,
          overtimeMinMinutes: getOvertimeMinMinutes(),
          holidayWorkPayMultiplier: 4,
        },
      },
      meta: {},
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

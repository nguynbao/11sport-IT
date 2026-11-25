import {
  attendanceRepo,
  holidayRepo,
  leaveRequestRepo,
  shiftAssignmentRepo,
  staffRepo,
} from "../../repositories";
import { ApiError } from "../../shared/errors";
import { getMergedHolidayMap } from "../holidays";
import {
  computePaidLeaveBalanceForStaff,
  getStaffPaidLeaveBalance,
  SALES_MAX_UNPAID_OFF_PER_MONTH,
} from "../leave";
import {
  SHIFT_RULES,
  ShiftCode,
  computeAttendanceMetrics,
  getLateToleranceMinutes,
  getOfficeWorkdays,
  getOvertimeMinMinutes,
  getStandardHours,
  pad,
  requireHr,
  toDateStr,
  toHHmm,
} from "./timesheet.rules";

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
      .filter((s: any) => s.role !== 'ADMIN' && s.role !== 'CEO')
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
    // Đơn từ theo nhân viên/ngày: leaveByStaff = đơn OFF/khác ĐÃ DUYỆT (ưu tiên OFF); allLeavesByStaff = mọi trạng thái trong tháng; allHistoryLeavesByStaff = mọi đơn các tháng
    const leaveByStaff = new Map<string, Map<string, any>>();
    const allLeavesByStaff = new Map<string, Map<string, any[]>>();
    const allHistoryLeavesByStaff = new Map<string, any[]>();
    for (const l of allLeaves as any[]) {
      const key = String(l.staffId);
      if (!allHistoryLeavesByStaff.has(key)) allHistoryLeavesByStaff.set(key, []);
      allHistoryLeavesByStaff.get(key)!.push(l);
      if (String(l.date || '').startsWith(monthPrefix)) {
        if (!allLeavesByStaff.has(key)) allLeavesByStaff.set(key, new Map());
        const dayList = allLeavesByStaff.get(key)!.get(l.date) || [];
        dayList.push(l);
        allLeavesByStaff.get(key)!.set(l.date, dayList);
      }
      if (
        l.type === 'CHANGE_OFF' &&
        l.fromDate &&
        l.fromDate !== l.date &&
        String(l.fromDate).startsWith(monthPrefix)
      ) {
        if (!allLeavesByStaff.has(key)) allLeavesByStaff.set(key, new Map());
        const fromList = allLeavesByStaff.get(key)!.get(l.fromDate) || [];
        fromList.push(l);
        allLeavesByStaff.get(key)!.set(l.fromDate, fromList);
      }
      if (!String(l.date || '').startsWith(monthPrefix)) continue;
      if (l.status !== 'APPROVED') continue;
      if (l.type === 'CHANGE_OFF') continue;
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
      // Chỉ dùng contractStartDate (hoặc hireDate nếu có), không dùng createdAt (ngày tạo/seed DB) để tránh chặn công lễ các tháng trong năm
      const rawStartDate = staff.contractStartDate || staff.hireDate;
      const joinedStr = rawStartDate
        ? typeof rawStartDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawStartDate)
          ? rawStartDate.slice(0, 10)
          : toDateStr(new Date(rawStartDate))
        : '1970-01-01';

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
        paidLeaveFromProbation: 0,
        paidLeaveTotalEarned: 0,
        paidLeaveUsedTotal: 0,
        paidLeaveUsed: 0,
        paidLeaveRemaining: 0,
        paidLeaveForfeited: 0,
        salesOffEntitled: department === 'SALES' ? SALES_MAX_UNPAID_OFF_PER_MONTH : 0,
        salesOffUsed: 0,
        salesOffRemaining: department === 'SALES' ? SALES_MAX_UNPAID_OFF_PER_MONTH : 0,
      };
      // Không suy diễn mặc định: chỉ HĐ được ghi rõ FULLTIME mới được dùng ngày phép có lương.
      // Khi lên Chính thức: cộng số ngày phép tương đương số tháng thử việc (tối đa 2 ngày) + 1 ngày phép mỗi tháng chính thức, cộng dồn qua các tháng.
      const contractType = staff.contractType || 'UNKNOWN';
      const staffAllHistoryLeaves = allHistoryLeavesByStaff.get(staffId) || [];
      const paidLeaveBalance = computePaidLeaveBalanceForStaff(
        staff,
        staffAllHistoryLeaves,
        `${year}-${pad(month)}`,
        { approvedOnly: true }
      );
      summary.paidLeaveEntitled = paidLeaveBalance.entitledInMonth;
      summary.paidLeaveFromProbation = paidLeaveBalance.probationLeaveDays;
      summary.paidLeaveTotalEarned = paidLeaveBalance.totalEarnedUpToMonth;
      const salesUnpaidOffDates = new Set<string>();

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
          date: l.date,
          fromDate: l.fromDate || undefined,
          sourceOffType: l.sourceOffType || undefined,
          reason: l.reason || '',
          reviewNote: l.reviewNote || '',
        }));
        summary.pendingRequests += dayLeaves.filter(
          (l) => l.status === 'PENDING' && String(l.date) === date
        ).length;
        const approvedTypes = new Set(dayLeaves.filter((l) => l.status === 'APPROVED').map((l) => l.type));

        // Có phải ngày làm việc theo lịch không?
        //  - VĂN PHÒNG: T2-T7 (nghỉ Chủ nhật bắt buộc); ngày lễ chính thức được nghỉ.
        //  - BÁN HÀNG: MẶC ĐỊNH NGÀY NÀNG CŨNG LÀ NGÀY LÀM (kể cả Chủ nhật & ngày lễ).
        //    Chỉ nghỉ khi HR xếp ca OFF hoặc có đơn OFF được duyệt (tối đa 4 ngày OFF không lương/tháng).
        //  - Công chuẩn tháng (standardDays): 1 tuần có 6 ngày làm việc -> tính động theo lịch thực tế của tháng:
        //    + Tháng 31 ngày: 27 công (4 CN) hoặc 26 công (5 CN)
        //    + Tháng 30 ngày: 26 công (4 CN) hoặc 25 công (5 CN)
        //    + Tháng 2 năm nhuận (29 ngày): 25 công (4 CN) hoặc 24 công (5 CN)
        //    + Tháng 2 không nhuận (28 ngày): 24 công (4 CN)
        let isScheduledWorkday: boolean;
        let countsInStandard: boolean;
        if (department === 'SALES') {
          isScheduledWorkday = assign ? assign.shiftCode !== 'OFF' : true;
          countsInStandard = officeWorkdays.includes(weekday);
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
        // Công chuẩn tháng = ngày làm theo lịch 6 ngày/tuần + ngày lễ chính thức hưởng lương (VP)
        if (countsInStandard || isPaidHoliday) summary.standardDays += 1;
        // Công lễ hưởng lương (Khối Văn phòng): cộng ngay +1 công cho mọi ngày lễ chính thức rơi vào T2-T7 trong tháng
        if (isPaidHoliday && !isBeforeJoin) summary.holidayPaidDays += 1;

        if (att) {
          const isOpen = !att.checkOutTime;
          const isPastDay = date < todayStr;
          const lateTolerance = getLateToleranceMinutes(department);
          const rawAttLate = Number(att.lateMinutes || 0);
          const late = rawAttLate > lateTolerance;
          const effectiveLateMinutes = late ? rawAttLate : 0;
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

          const effectiveShift: ShiftCode =
            (assign &&
            (assign.shiftCode === 'SHIFT_1' ||
              assign.shiftCode === 'SHIFT_2' ||
              assign.shiftCode === 'BOTH')
              ? (assign.shiftCode as ShiftCode)
              : (att.shiftCode as ShiftCode)) || 'SHIFT_1';

          // Quy định tính Tăng ca:
          // 1. Làm 2 ca (BOTH - Ca 1 + Ca 2 đã ghi trong bảng xếp ca): KHÔNG tính là tăng ca.
          // 2. Khối Bán hàng (SALES) làm 1 ca (SHIFT_1 / SHIFT_2): chỉ khi check-out trễ > 5p có lý do và được HR xem xét duyệt (overtimeStatus === 'APPROVED').
          // 3. Khối Văn phòng (OFFICE): phải được HR yêu cầu (overtimeStatus === 'APPROVED') thì mới có tăng ca.
          let overtimeMinutes = 0;
          const rule = SHIFT_RULES[effectiveShift] || SHIFT_RULES.SHIFT_1;
          let rawLateOut = Number(att.lateCheckoutMinutes || 0);
          if (att.checkOutTime && rawLateOut === 0) {
            const out = new Date(att.checkOutTime);
            const outMin = out.getHours() * 60 + out.getMinutes();
            rawLateOut = Math.max(0, outMin - rule.end);
          }

          const cellOvertimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
            effectiveShift === 'BOTH' ? 'NONE' : (att.overtimeStatus || 'NONE');

          if (effectiveShift !== 'BOTH' && cellOvertimeStatus === 'APPROVED') {
            const approvedMins = Number(att.overtimeApprovedMinutes || 0);
            overtimeMinutes = approvedMins > 0 ? approvedMins : rawLateOut;
          }

          if (cellOvertimeStatus === 'PENDING') {
            summary.pendingRequests += 1;
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
            summary.lateMinutes += effectiveLateMinutes;
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
            shiftCode: effectiveShift,
            checkIn: toHHmm(att.checkInTime),
            checkOut: toHHmm(att.checkOutTime),
            hours,
            lateMinutes: effectiveLateMinutes,
            earlyMinutes: Number(att.earlyMinutes || 0),
            lateCheckoutMinutes: effectiveShift === 'BOTH' ? 0 : rawLateOut,
            lateCheckoutReason: effectiveShift === 'BOTH' ? '' : (att.lateCheckoutReason || ''),
            overtimeStatus: cellOvertimeStatus,
            overtimeApprovedMinutes: effectiveShift === 'BOTH' ? 0 : Number(att.overtimeApprovedMinutes || overtimeMinutes || 0),
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
        else if (isOfficeHolidayOff) code = 'HOLIDAY';
        else if (
          approvedTypes.has('PAID_LEAVE') &&
          (department === 'SALES' || isScheduledWorkday) &&
          contractType === 'FULLTIME'
        )
          code = 'PAID_LEAVE';
        else if (leave && leave.type === 'OFF') code = 'LEAVE';
        else if (!isScheduledWorkday) code = 'DAY_OFF';
        else if (date >= todayStr) code = 'FUTURE';
        else code = 'ABSENT';

        if (code === 'LEAVE') summary.leaveDays += 1;
        if (code === 'PAID_LEAVE') summary.paidLeaveUsed += 1;
        if (
          department === 'SALES' &&
          code !== 'PAID_LEAVE' &&
          (assign?.shiftCode === 'OFF' || (leave && leave.type === 'OFF') || approvedTypes.has('OFF'))
        ) {
          salesUnpaidOffDates.add(date);
        }
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

      if (department === 'SALES') {
        summary.salesOffUsed = salesUnpaidOffDates.size;
        summary.salesOffRemaining = Math.max(0, SALES_MAX_UNPAID_OFF_PER_MONTH - salesUnpaidOffDates.size);
      }

      summary.workUnits = Number(summary.workUnits.toFixed(2));
      summary.holidayWorkHours = Number(summary.holidayWorkHours.toFixed(2));
      // Ngày nghỉ phép có lương được để dành lại và cộng dồn qua các tháng tiếp theo (không bị mất khi hết tháng)
      summary.paidLeaveUsedTotal = paidLeaveBalance.usedBeforeMonth + summary.paidLeaveUsed;
      summary.paidLeaveRemaining = Math.max(0, summary.paidLeaveEntitled - summary.paidLeaveUsed);
      summary.paidLeaveForfeited = 0;
      // Tổng công tính lương = công đi làm + công lễ hưởng lương (Văn phòng) + số ngày phép có lương đã dùng trong tháng
      summary.paidUnits = Number(
        (summary.workUnits + summary.holidayPaidDays + summary.paidLeaveUsed).toFixed(2)
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

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const sundaysCount = days.filter((d) => !officeWorkdays.includes(d.weekday)).length;
    const standardDaysInMonth = days.filter((d) => officeWorkdays.includes(d.weekday)).length;
    const officialHolidaysCount = days.filter((d) => d.holiday?.isOfficialDayOff).length;
    const officePaidHolidaysCount = days.filter(
      (d) => d.holiday?.isOfficialDayOff && officeWorkdays.includes(d.weekday)
    ).length;

    return {
      month,
      year,
      days,
      rows,
      monthMeta: {
        daysInMonth,
        isLeapYear,
        sundaysCount,
        standardDays: standardDaysInMonth,
        officialHolidaysCount,
        officePaidHolidaysCount,
      },
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


export async function getTimesheetReport(user: any, query: any) {
  requireHr({ user } as any);
  const { month, year } = parseMonthYear(query);
  const departmentFilter =
    query?.department === 'OFFICE' || query?.department === 'SALES'
      ? String(query.department)
      : null;
  return buildTimesheet({ month, year, departmentFilter });
}

export async function getMyAttendanceCalendar(user: any, query: any) {
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (user.role === 'ADMIN' || user.role === 'CEO') {
    throw new ApiError(
      400,
      'ADMIN_NO_ATTENDANCE',
      'Tài khoản Quản trị viên (ADMIN/CEO) không cần chấm công'
    );
  }
  const { month, year } = parseMonthYear(query);
  const data = await buildTimesheet({ month, year, staffIdFilter: String(user.userId) });
  const row = data.rows[0] || null;
  const effectiveDepartment = row?.department || (user.role === 'SALES' ? 'SALES' : 'OFFICE');
  return {
    month: data.month,
    year: data.year,
    days: data.days,
    row,
    rules: {
      shifts: {
        SHIFT_1: SHIFT_RULES.SHIFT_1.label,
        SHIFT_2: SHIFT_RULES.SHIFT_2.label,
        BOTH: SHIFT_RULES.BOTH.label,
      },
      lateToleranceMinutes: getLateToleranceMinutes(effectiveDepartment),
      overtimeMinMinutes: getOvertimeMinMinutes(),
      holidayWorkPayMultiplier: 4,
    },
  };
}


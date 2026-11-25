import {
  attendanceRepo,
  leaveRequestRepo,
  shiftAssignmentRepo,
  staffRepo,
} from "../../repositories";
import { ApiError } from "../../shared/errors";
import { assertPaidLeaveQuota, assertSalesUnpaidOffQuota } from "../leave";
import {
  SHIFT_RULES,
  ShiftCode,
  computeAttendanceMetrics,
  getOvertimeMinMinutes,
  pad,
  parseHHmm,
  requireHr,
  toDateStr,
  toHHmm,
} from "./timesheet.rules";

async function applyManualOffForStaffDate(params: {
  staff: any;
  date: string;
  offType?: 'OFF' | 'PAID_LEAVE';
  reason: string;
  reviewerName: string;
}) {
  const { staff, date, reason, reviewerName } = params;
  const targetOffType: 'OFF' | 'PAID_LEAVE' =
    params.offType === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF';
  const staffId = String(staff._id);
  const department = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');

  const existingLeaves = await leaveRequestRepo.find({ staffId, date });
  const existingSameType = (existingLeaves as any[]).find((l) => l.type === targetOffType);

  if (targetOffType === 'PAID_LEAVE') {
    if (staff.contractType !== 'FULLTIME') {
      throw new ApiError(
        400,
        'PAID_LEAVE_NOT_ELIGIBLE',
        'Chỉ nhân viên hợp đồng Chính thức mới được chấm nghỉ phép có lương'
      );
    }
    await assertPaidLeaveQuota(staffId, date, existingSameType?._id, true);
  } else {
    await assertSalesUnpaidOffQuota(staffId, date, existingSameType?._id, true);
  }

  const existingAtts = await attendanceRepo.find({ staffId, date });
  for (const a of existingAtts as any[]) {
    await attendanceRepo.deleteById(String(a._id));
  }

  for (const l of existingLeaves as any[]) {
    if ((l.type === 'OFF' || l.type === 'PAID_LEAVE') && l.type !== targetOffType) {
      await leaveRequestRepo.deleteById(String(l._id));
    }
  }

  let savedLeave: any;
  if (existingSameType) {
    savedLeave = await leaveRequestRepo.updateById(String(existingSameType._id), {
      reason: String(reason).trim(),
      status: 'APPROVED',
      reviewNote: 'HR chấm OFF trên Bảng chấm công',
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    });
  } else {
    savedLeave = await leaveRequestRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department,
      type: targetOffType,
      date,
      reason: String(reason).trim(),
      status: 'APPROVED',
      reviewNote: 'HR chấm OFF trên Bảng chấm công',
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    });
  }

  if (department === 'SALES' && targetOffType === 'OFF') {
    const existingAssign =
      (await shiftAssignmentRepo.findOne({ staffId, date })) ||
      (await shiftAssignmentRepo.findOne({ staffId: staff._id, date }));
    if (existingAssign) {
      await shiftAssignmentRepo.updateById(existingAssign._id, {
        shiftCode: 'OFF',
        isOffRequested: true,
      });
    } else {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      const mondayOffset = dow === 0 ? 6 : dow - 1;
      const mon = new Date(y, m - 1, d - mondayOffset);
      const weekStart = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
      await shiftAssignmentRepo.create({
        weekStart,
        date,
        dayOfWeek: dow === 0 ? 7 : dow,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode: 'OFF',
        preferenceShift: 'OFF',
        isOffRequested: true,
        assignedBy: 'HR',
        seenByStaff: true,
      });
    }
  }

  return {
    offApplied: true,
    offType: targetOffType,
    date,
    staffId,
    leaveRequest: savedLeave,
  };
}

export async function adjustAttendanceRecord(user: any, id: string, body: any) {
  requireHr({ user } as any);
  const {
    checkIn,
    checkOut,
    shiftCode,
    checkInType,
    offType,
    overtimeStatus,
    overtimeApprovedMinutes,
    lateCheckoutReason,
    reason,
  } = body || {};

  if (!reason || !String(reason).trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do điều chỉnh giờ công');
  }

  const att: any = await attendanceRepo.findById(id);
  if (!att) throw new ApiError(404, 'ATTENDANCE_NOT_FOUND', 'Không tìm thấy bản ghi chấm công');

  if (shiftCode === 'OFF') {
    const staff: any = await staffRepo.findById(String(att.staffId));
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
    const result = await applyManualOffForStaffDate({
      staff,
      date: String(att.date),
      offType: offType === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF',
      reason: String(reason).trim(),
      reviewerName: user.fullName || user.username || 'HR',
    });
    return {
      data: result,
      message: 'Đã chuyển ngày công sang trạng thái nghỉ (OFF)',
    };
  }

  const finalShift: ShiftCode =
    shiftCode === 'SHIFT_1' || shiftCode === 'SHIFT_2' || shiftCode === 'BOTH'
      ? shiftCode
      : att.shiftCode || 'SHIFT_1';

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

  const rule = SHIFT_RULES[finalShift] || SHIFT_RULES.SHIFT_1;
  const rawAfterShiftEnd = outMinutes !== null ? Math.max(0, outMinutes - rule.end) : 0;

  let nextOvertimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
    att.overtimeStatus || 'NONE';
  let nextOvertimeApprovedMinutes = Number(att.overtimeApprovedMinutes || 0);
  let nextLateCheckoutMinutes = Number(att.lateCheckoutMinutes || 0);
  const nextLateCheckoutReason =
    lateCheckoutReason !== undefined ? String(lateCheckoutReason).trim() : att.lateCheckoutReason || '';

  if (finalShift === 'BOTH') {
    nextOvertimeStatus = 'NONE';
    nextOvertimeApprovedMinutes = 0;
    nextLateCheckoutMinutes = 0;
  } else {
    nextLateCheckoutMinutes =
      att.department === 'SALES' ? (rawAfterShiftEnd > 5 ? rawAfterShiftEnd : 0) : rawAfterShiftEnd;

    if (
      overtimeStatus === 'NONE' ||
      overtimeStatus === 'PENDING' ||
      overtimeStatus === 'APPROVED' ||
      overtimeStatus === 'REJECTED'
    ) {
      nextOvertimeStatus = overtimeStatus;
      if (overtimeStatus === 'APPROVED') {
        nextOvertimeApprovedMinutes =
          overtimeApprovedMinutes !== undefined
            ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
            : rawAfterShiftEnd > 0
              ? rawAfterShiftEnd
              : nextLateCheckoutMinutes;
      } else {
        nextOvertimeApprovedMinutes = 0;
      }
    } else if (nextOvertimeStatus === 'APPROVED') {
      nextOvertimeApprovedMinutes =
        overtimeApprovedMinutes !== undefined
          ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
          : rawAfterShiftEnd > 0
            ? rawAfterShiftEnd
            : nextOvertimeApprovedMinutes;
    }
  }

  const finalCheckInType: 'STANDARD' | 'WFH' =
    checkInType === 'WFH' || checkInType === 'STANDARD'
      ? checkInType
      : att.checkInType === 'WFH'
        ? 'WFH'
        : 'STANDARD';

  const updated = await attendanceRepo.updateById(id, {
    shiftCode: finalShift,
    checkInType: finalCheckInType,
    checkInTime: metrics.checkInTime,
    workStartTime: metrics.workStartTime,
    checkOutTime: metrics.checkOutTime ?? null,
    lateMinutes: metrics.lateMinutes,
    earlyMinutes: metrics.earlyMinutes,
    lateCheckoutMinutes: nextLateCheckoutMinutes,
    lateCheckoutReason: nextLateCheckoutReason,
    overtimeStatus: nextOvertimeStatus,
    overtimeApprovedMinutes: nextOvertimeApprovedMinutes,
    totalWorkHours: metrics.totalWorkHours,
    lunchPauseMinutes: metrics.lunchPauseMinutes,
    status: metrics.status,
    adjustedBy: user.userId,
    adjustedByName: user.fullName || user.username || '',
    adjustedAt: new Date(),
    adjustReason: String(reason).trim(),
  } as any);

  return { data: updated, message: 'Đã điều chỉnh giờ công' };
}

export async function createManualAttendance(user: any, body: any) {
  requireHr({ user } as any);
  const {
    staffId,
    date,
    shiftCode = 'SHIFT_1',
    checkInType,
    offType,
    checkIn,
    checkOut,
    overtimeStatus,
    overtimeApprovedMinutes,
    reason,
  } = body || {};

  if (!staffId || !date || (shiftCode !== 'OFF' && !checkIn)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu nhân viên, ngày hoặc giờ vào');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày không hợp lệ (YYYY-MM-DD)');
  }
  if (!reason || !String(reason).trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lý do chấm công bù');
  }
  if (shiftCode !== 'OFF' && String(date) > toDateStr(new Date())) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Không thể chấm công bù đi làm cho ngày trong tương lai'
    );
  }

  const staff: any = await staffRepo.findById(String(staffId));
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
  if (staff.role === 'ADMIN' || staff.role === 'CEO') {
    throw new ApiError(400, 'ADMIN_NO_ATTENDANCE', 'Tài khoản Quản trị viên không cần chấm công');
  }

  if (shiftCode === 'OFF') {
    const result = await applyManualOffForStaffDate({
      staff,
      date: String(date),
      offType: offType === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF',
      reason: String(reason).trim(),
      reviewerName: user.fullName || user.username || 'HR',
    });
    return { data: result, message: 'Đã chấm OFF trên bảng chấm công' };
  }

  const existing = await attendanceRepo.findOne({ staffId: String(staff._id), date: String(date) });
  if (existing) {
    throw new ApiError(
      400,
      'ALREADY_CHECKED_IN',
      'Ngày này đã có bản ghi chấm công, vui lòng dùng chức năng điều chỉnh'
    );
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
    department === 'SALES' && (shiftCode === 'SHIFT_2' || shiftCode === 'BOTH')
      ? shiftCode
      : 'SHIFT_1';

  const metrics = computeAttendanceMetrics({
    date: String(date),
    department,
    shiftCode: finalShift,
    checkInMinutes: inMinutes,
    checkOutMinutes: outMinutes,
  });

  const rule = SHIFT_RULES[finalShift] || SHIFT_RULES.SHIFT_1;
  const rawAfterShiftEnd = outMinutes !== null ? Math.max(0, outMinutes - rule.end) : 0;

  let finalOvertimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';
  let finalOvertimeApprovedMinutes = 0;

  if (finalShift !== 'BOTH') {
    if (overtimeStatus === 'APPROVED') {
      finalOvertimeStatus = 'APPROVED';
      finalOvertimeApprovedMinutes =
        overtimeApprovedMinutes !== undefined
          ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
          : rawAfterShiftEnd;
    } else if (
      department === 'OFFICE' &&
      overtimeStatus === undefined &&
      rawAfterShiftEnd >= getOvertimeMinMinutes()
    ) {
      finalOvertimeStatus = 'APPROVED';
      finalOvertimeApprovedMinutes = rawAfterShiftEnd;
    }
  }

  const prevLeaves = await leaveRequestRepo.find({ staffId: String(staff._id), date: String(date) });
  for (const l of prevLeaves as any[]) {
    if (l.type === 'OFF' || l.type === 'PAID_LEAVE') {
      await leaveRequestRepo.deleteById(String(l._id));
    }
  }
  const prevAssign =
    (await shiftAssignmentRepo.findOne({ staffId: String(staff._id), date: String(date) })) ||
    (await shiftAssignmentRepo.findOne({ staffId: staff._id, date: String(date) }));
  if (prevAssign && prevAssign.shiftCode === 'OFF') {
    await shiftAssignmentRepo.updateById(prevAssign._id, {
      shiftCode: finalShift,
      isOffRequested: false,
    });
  }

  const hasApprovedWfh = (prevLeaves as any[]).some(
    (l) => l.type === 'WFH' && l.status === 'APPROVED'
  );
  const finalCheckInType: 'STANDARD' | 'WFH' =
    checkInType === 'WFH'
      ? 'WFH'
      : checkInType === 'STANDARD'
        ? 'STANDARD'
        : hasApprovedWfh
          ? 'WFH'
          : 'STANDARD';

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
    checkInType: finalCheckInType,
    status: metrics.status,
    lateMinutes: metrics.lateMinutes,
    earlyMinutes: metrics.earlyMinutes,
    lateCheckoutMinutes:
      department === 'SALES' && finalShift !== 'BOTH' && rawAfterShiftEnd > 5
        ? rawAfterShiftEnd
        : 0,
    lateCheckoutReason: '',
    overtimeStatus: finalOvertimeStatus,
    overtimeApprovedMinutes: finalOvertimeApprovedMinutes,
    lunchPauseMinutes: metrics.lunchPauseMinutes,
    totalWorkHours: metrics.totalWorkHours,
    notes: 'Chấm công bù bởi HR',
    adjustedBy: user.userId,
    adjustedByName: user.fullName || user.username || '',
    adjustedAt: new Date(),
    adjustReason: String(reason).trim(),
  } as any);

  return { data: created, message: 'Đã chấm công bù' };
}


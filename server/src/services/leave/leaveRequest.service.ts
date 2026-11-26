import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from "../../repositories";
import { getMondayOfDateStr, parseLocalDateStr, toLocalDateStr } from "../../shared/date";
import { ApiError } from "../../shared/errors";
import {
  assertAdvanceNoticeForLeaveRequest,
  assertPaidLeaveQuota,
  assertSalesUnpaidOffQuota,
} from "./leaveQuota.queries";
const LEAVE_REASON_MAX_LENGTH = 100;

export async function createLeaveRequest(user: any, body: any) {
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const staff = await staffRepo.findById(user.userId);
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

  const { type, date, fromDate, sourceLeaveId, reason } = body || {};
  if (!type || !date || !reason) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng điền đầy đủ loại đơn, ngày và lý do');
  }

  if (String(reason).trim().length > LEAVE_REASON_MAX_LENGTH) {
    throw new ApiError(
      400,
      'REASON_TOO_LONG',
      `Lý do tối đa ${LEAVE_REASON_MAX_LENGTH} ký tự`,
      { reason: `Tối đa ${LEAVE_REASON_MAX_LENGTH} ký tự` }
    );
  }

  if (!['WFH', 'OFF', 'LATE', 'EARLY', 'PAID_LEAVE', 'CHANGE_OFF'].includes(type)) {
    throw new ApiError(400, 'INVALID_TYPE', 'Loại đơn không hợp lệ');
  }

  const cleanDate = String(date).trim();
  const dept = (staff as any).department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');

  if (type === 'CHANGE_OFF') {
    const cleanFromDate = String(fromDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new ApiError(
        400,
        'INVALID_CHANGE_OFF_DATES',
        'Vui lòng chọn đầy đủ ngày off hiện tại (fromDate) và ngày off mới muốn chuyển sang (date)'
      );
    }
    if (cleanFromDate === cleanDate) {
      throw new ApiError(
        400,
        'INVALID_CHANGE_OFF_DATES',
        'Ngày off mới phải khác với ngày off ban đầu'
      );
    }
    if (dept === 'OFFICE' && parseLocalDateStr(cleanDate).getDay() === 0) {
      throw new ApiError(
        400,
        'INVALID_CHANGE_OFF_DATES',
        'Khối Văn phòng nghỉ cố định Chủ nhật, không cần đổi ngày off sang Chủ nhật'
      );
    }

    const [staffLeaves, staffShifts] = await Promise.all([
      leaveRequestRepo.find({ staffId: staff._id }),
      shiftAssignmentRepo.find({ staffId: staff._id }),
    ]);

    const fromOffLeaves = (staffLeaves as any[]).filter(
      (l) =>
        String(l.date) === cleanFromDate &&
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED')
    );
    const matchedSourceLeave =
      (sourceLeaveId && fromOffLeaves.find((l) => String(l._id) === String(sourceLeaveId))) ||
      fromOffLeaves.find((l) => l.type === 'PAID_LEAVE') ||
      fromOffLeaves[0] ||
      null;

    const fromShiftOff = (staffShifts as any[]).find(
      (s) => String(s.date) === cleanFromDate && s.shiftCode === 'OFF'
    );

    if (!matchedSourceLeave && !fromShiftOff) {
      throw new ApiError(
        400,
        'SOURCE_OFF_NOT_FOUND',
        `Ngày ${cleanFromDate} bạn chưa có đơn nghỉ (OFF / Nghỉ phép) hoặc lịch ca OFF nào để chuyển đổi`
      );
    }

    const targetAlreadyLeave = (staffLeaves as any[]).some(
      (l) =>
        String(l.date) === cleanDate &&
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED')
    );
    const targetAlreadyShiftOff =
      dept === 'SALES' &&
      (staffShifts as any[]).some((s) => String(s.date) === cleanDate && s.shiftCode === 'OFF');

    if (targetAlreadyLeave || targetAlreadyShiftOff) {
      throw new ApiError(
        400,
        'TARGET_DATE_ALREADY_OFF',
        `Ngày ${cleanDate} bạn đã có lịch nghỉ hoặc đơn xin nghỉ rồi, vui lòng chọn ngày khác`
      );
    }

    const pendingChangeDup = (staffLeaves as any[]).some(
      (l) =>
        l.type === 'CHANGE_OFF' &&
        l.status === 'PENDING' &&
        (String(l.fromDate) === cleanFromDate || String(l.date) === cleanDate)
    );
    if (pendingChangeDup) {
      throw new ApiError(
        400,
        'DUPLICATE_REQUEST',
        'Bạn đã có đơn xin chuyển ngày off đang chờ HR duyệt cho ngày này'
      );
    }

    const resolvedSourceOffType: 'OFF' | 'PAID_LEAVE' =
      matchedSourceLeave?.type === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF';
    const resolvedSourceLeaveId = matchedSourceLeave ? String(matchedSourceLeave._id) : undefined;
    const excludeDatesSet = new Set<string>([cleanFromDate]);

    if (resolvedSourceOffType === 'PAID_LEAVE') {
      await assertPaidLeaveQuota(
        String(staff._id),
        cleanDate,
        resolvedSourceLeaveId,
        false,
        excludeDatesSet
      );
    } else {
      await assertSalesUnpaidOffQuota(
        String(staff._id),
        cleanDate,
        resolvedSourceLeaveId,
        false,
        excludeDatesSet
      );
    }

    await assertAdvanceNoticeForLeaveRequest({
      staff,
      type: resolvedSourceOffType,
      date: cleanDate,
      excludeLeaveId: resolvedSourceLeaveId,
      excludeDates: excludeDatesSet,
    });

    return leaveRequestRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department: dept,
      type: 'CHANGE_OFF',
      date: cleanDate,
      fromDate: cleanFromDate,
      sourceLeaveId: resolvedSourceLeaveId,
      sourceOffType: resolvedSourceOffType,
      reason: String(reason).trim(),
      status: 'PENDING',
    });
  }

  const dup = await leaveRequestRepo.find({ staffId: staff._id, date: cleanDate, type });
  if (dup.some((d: any) => d.status === 'PENDING' || d.status === 'APPROVED')) {
    throw new ApiError(
      400,
      'DUPLICATE_REQUEST',
      'Bạn đã có đơn cùng loại cho ngày này (đang chờ duyệt hoặc đã duyệt)'
    );
  }

  if (type === 'PAID_LEAVE') {
    if (staff.contractType !== 'FULLTIME') {
      throw new ApiError(
        400,
        'PAID_LEAVE_NOT_ELIGIBLE',
        'Chỉ nhân viên hợp đồng Chính thức mới có ngày nghỉ phép có lương (ngày phép giai đoạn thử việc sẽ được cộng khi lên Chính thức)'
      );
    }
    await assertPaidLeaveQuota(String(staff._id), cleanDate);
  }

  if (type === 'OFF') {
    await assertSalesUnpaidOffQuota(String(staff._id), cleanDate, undefined, false);
  }

  await assertAdvanceNoticeForLeaveRequest({
    staff,
    type,
    date: cleanDate,
  });

  return leaveRequestRepo.create({
    staffId: staff._id,
    staffCode: staff.code,
    staffName: staff.fullName,
    department: dept,
    type,
    date: cleanDate,
    reason: String(reason).trim(),
    status: 'PENDING',
  });
}

export async function listLeaveRequests(user: any, query: any) {
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const { status, type, date, staffId, mine } = query || {};
  const filter: Record<string, any> = {};

  if (String(mine) === 'true') {
    filter.staffId = user.userId;
    if (status) filter.status = String(status);
    if (type) filter.type = String(type);
    if (date) filter.date = String(date);
  } else if (['CEO', 'ADMIN', 'HR'].includes(user.role)) {
    if (status) filter.status = String(status);
    if (type) filter.type = String(type);
    if (date) filter.date = String(date);
    if (staffId) filter.staffId = String(staffId);
  } else {
    filter.staffId = user.userId;
    if (status) filter.status = String(status);
  }

  const list = await leaveRequestRepo.find(filter);
  list.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  return list;
}

export async function cancelLeaveRequest(user: any, id: string) {
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  const request: any = await leaveRequestRepo.findById(id);
  if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
  if (String(request.staffId) !== String(user.userId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được hủy đơn của chính mình');
  }
  if (request.status !== 'PENDING') {
    throw new ApiError(400, 'REQUEST_ALREADY_REVIEWED', 'Đơn đã được HR xử lý, không thể hủy');
  }
  await leaveRequestRepo.deleteById(String(request._id));
}

export async function reviewLeaveRequest(user: any, id: string, body: any) {
  if (!user || !['CEO', 'ADMIN', 'HR'].includes(user.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Chỉ CEO, HR hoặc ADMIN mới có quyền duyệt đơn');
  }

  const request = await leaveRequestRepo.findById(id);
  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
  }

  const { status, reviewNote = '' } = body || {};
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái duyệt phải là APPROVED hoặc REJECTED');
  }

  const reqDoc: any = request;
  const staffId = String(reqDoc.staffId);
  const targetDate = String(reqDoc.date).trim();
  const reviewerName = user.fullName || user.username || 'HR';

  if (status === 'APPROVED' && reqDoc.type === 'PAID_LEAVE') {
    await assertPaidLeaveQuota(staffId, targetDate, String(id), true);
  }

  if (status === 'APPROVED' && reqDoc.type === 'OFF') {
    await assertSalesUnpaidOffQuota(staffId, targetDate, String(id), true);
  }

  if (status === 'APPROVED' && reqDoc.type === 'CHANGE_OFF') {
    const fromDate = String(reqDoc.fromDate || '').trim();
    const sourceOffType: 'OFF' | 'PAID_LEAVE' =
      reqDoc.sourceOffType === 'PAID_LEAVE' ? 'PAID_LEAVE' : 'OFF';
    const sourceLeaveId = reqDoc.sourceLeaveId ? String(reqDoc.sourceLeaveId) : undefined;
    const excludeDatesSet = new Set<string>(fromDate ? [fromDate] : []);

    if (sourceOffType === 'PAID_LEAVE') {
      await assertPaidLeaveQuota(staffId, targetDate, sourceLeaveId, true, excludeDatesSet);
    } else {
      await assertSalesUnpaidOffQuota(staffId, targetDate, sourceLeaveId, true, excludeDatesSet);
    }

    const [staffLeaves, staffShifts] = await Promise.all([
      leaveRequestRepo.find({ staffId: reqDoc.staffId }),
      shiftAssignmentRepo.find({ staffId: reqDoc.staffId }),
    ]);

    const fromAssign = (staffShifts as any[]).find((s) => String(s.date) === fromDate);
    const targetAssign = (staffShifts as any[]).find((s) => String(s.date) === targetDate);

    const activeFromLeaves = (staffLeaves as any[]).filter(
      (l) =>
        String(l._id) !== String(id) &&
        String(l.date) === fromDate &&
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED')
    );

    const primaryLeave =
      (sourceLeaveId &&
        (staffLeaves as any[]).find(
          (l) =>
            String(l._id) === sourceLeaveId &&
            String(l.date) === fromDate &&
            (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
            (l.status === 'PENDING' || l.status === 'APPROVED')
        )) ||
      activeFromLeaves.find((l) => l.type === sourceOffType) ||
      activeFromLeaves[0] ||
      null;

    if (!primaryLeave && (!fromAssign || fromAssign.shiftCode !== 'OFF')) {
      throw new ApiError(
        400,
        'SOURCE_OFF_NOT_FOUND',
        `Ngày gốc (${fromDate}) hiện không còn lịch nghỉ hoặc đơn xin nghỉ hợp lệ để chuyển.`
      );
    }

    const conflictingTargetLeave = (staffLeaves as any[]).find(
      (l) =>
        String(l._id) !== String(id) &&
        (!primaryLeave || String(l._id) !== String(primaryLeave._id)) &&
        String(l.date) === targetDate &&
        (l.type === 'OFF' || l.type === 'PAID_LEAVE') &&
        (l.status === 'PENDING' || l.status === 'APPROVED')
    );

    if (conflictingTargetLeave || (targetAssign && targetAssign.shiftCode === 'OFF')) {
      throw new ApiError(
        400,
        'TARGET_DATE_ALREADY_OFF',
        `Ngày đích (${targetDate}) đã có lịch nghỉ hoặc đơn xin nghỉ khác. Không thể duyệt chuyển ngày off sang ngày này.`
      );
    }

    const staffDoc = (await staffRepo.findById(staffId)) || {
      _id: staffId,
      department: reqDoc.department || 'OFFICE',
      role: reqDoc.department === 'SALES' ? 'SALES' : 'OFFICE',
    };
    const createdDayStr =
      reqDoc.createdAt && !Number.isNaN(new Date(reqDoc.createdAt).getTime())
        ? toLocalDateStr(new Date(reqDoc.createdAt))
        : undefined;

    await assertAdvanceNoticeForLeaveRequest({
      staff: staffDoc,
      type: sourceOffType,
      date: targetDate,
      excludeLeaveId: primaryLeave ? String(primaryLeave._id) : sourceLeaveId,
      excludeDates: excludeDatesSet,
      referenceTodayStr: createdDayStr,
    });

    const noteSuffix = `Đã đổi ngày off từ ${fromDate} sang ${targetDate}`;

    if (primaryLeave) {
      await leaveRequestRepo.updateById(String(primaryLeave._id), {
        date: targetDate,
        type: sourceOffType,
        status: 'APPROVED',
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
        reviewNote: String(reviewNote).trim() || noteSuffix,
      });
      for (const extra of activeFromLeaves) {
        if (String(extra._id) !== String(primaryLeave._id)) {
          await leaveRequestRepo.deleteById(String(extra._id));
        }
      }
    } else {
      await leaveRequestRepo.create({
        staffId: reqDoc.staffId,
        staffCode: reqDoc.staffCode,
        staffName: reqDoc.staffName,
        department: reqDoc.department || 'OFFICE',
        type: sourceOffType,
        date: targetDate,
        reason: `${reqDoc.reason} (${noteSuffix})`.slice(0, LEAVE_REASON_MAX_LENGTH),
        status: 'APPROVED',
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
        reviewNote: String(reviewNote).trim() || noteSuffix,
      });
    }

    const isSales = reqDoc.department === 'SALES';
    if (isSales || fromAssign || targetAssign) {
      const replacementWorkShift: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' =
        targetAssign &&
        (targetAssign.shiftCode === 'SHIFT_1' ||
          targetAssign.shiftCode === 'SHIFT_2' ||
          targetAssign.shiftCode === 'BOTH')
          ? targetAssign.shiftCode
          : fromAssign &&
              (fromAssign.preferenceShift === 'SHIFT_1' ||
                fromAssign.preferenceShift === 'SHIFT_2' ||
                fromAssign.preferenceShift === 'BOTH')
            ? fromAssign.preferenceShift
            : 'SHIFT_1';

      if (fromAssign) {
        await shiftAssignmentRepo.updateById(fromAssign._id, {
          shiftCode: replacementWorkShift,
          preferenceShift: replacementWorkShift,
          isOffRequested: false,
          seenByStaff: false,
        });
      } else if (isSales && fromDate) {
        const fromDow = parseLocalDateStr(fromDate).getDay() || 7;
        await shiftAssignmentRepo.create({
          weekStart: getMondayOfDateStr(fromDate),
          date: fromDate,
          dayOfWeek: fromDow,
          staffId: reqDoc.staffId,
          staffCode: reqDoc.staffCode,
          staffName: reqDoc.staffName,
          shiftCode: replacementWorkShift,
          preferenceShift: replacementWorkShift,
          isOffRequested: false,
          assignedBy: targetAssign?.assignedBy || 'HR',
          confirmedAt: new Date(),
          seenByStaff: false,
        });
      }

      if (targetAssign) {
        await shiftAssignmentRepo.updateById(targetAssign._id, {
          shiftCode: 'OFF',
          preferenceShift: 'OFF',
          isOffRequested: true,
          seenByStaff: false,
        });
      } else if (isSales) {
        const targetDow = parseLocalDateStr(targetDate).getDay() || 7;
        await shiftAssignmentRepo.create({
          weekStart: getMondayOfDateStr(targetDate),
          date: targetDate,
          dayOfWeek: targetDow,
          staffId: reqDoc.staffId,
          staffCode: reqDoc.staffCode,
          staffName: reqDoc.staffName,
          shiftCode: 'OFF',
          preferenceShift: 'OFF',
          isOffRequested: true,
          assignedBy: fromAssign?.assignedBy || 'HR',
          confirmedAt: new Date(),
          seenByStaff: false,
        });
      }
    }
  }

  return leaveRequestRepo.updateById(id, {
    status,
    reviewNote: String(reviewNote).trim(),
    reviewedBy: reviewerName,
    reviewedAt: new Date(),
  });
}


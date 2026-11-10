import { Router } from 'express';
import { leaveRequestRepo, shiftAssignmentRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const leaveRequestsRouter = Router();

/** Độ dài tối đa của lý do trong đơn từ */
const LEAVE_REASON_MAX_LENGTH = 100;

/** Hạn mức nghỉ không lương (OFF) tối đa của nhân viên khối SALES trong 1 tháng */
export const SALES_MAX_UNPAID_OFF_PER_MONTH = 4;

/**
 * Lấy tập hợp các ngày (YYYY-MM-DD) nghỉ không lương (OFF) của nhân viên Sales trong tháng (YYYY-MM).
 * Tính gộp theo ngày phân biệt từ lịch phân ca (shiftCode === 'OFF') và đơn xin nghỉ (type === 'OFF'),
 * không tính các ngày nghỉ phép có lương (PAID_LEAVE đã duyệt).
 */
export async function getSalesMonthlyUnpaidOffDates(
  staffId: string,
  yearMonthOrDate: string,
  options?: {
    excludeShiftDates?: Set<string>;
    excludeLeaveId?: string;
    includePendingLeave?: boolean;
  }
): Promise<Set<string>> {
  const ym = yearMonthOrDate.slice(0, 7); // YYYY-MM
  const monthPrefix = `${ym}-`;
  const includePending = options?.includePendingLeave ?? false;
  const excludeShiftDates = options?.excludeShiftDates;
  const excludeLeaveId = options?.excludeLeaveId ? String(options.excludeLeaveId) : '';

  const [leaves, shifts] = await Promise.all([
    leaveRequestRepo.find({ staffId }),
    shiftAssignmentRepo.find({ staffId }),
  ]);

  const paidLeaveDates = new Set<string>();
  for (const l of leaves as any[]) {
    const d = String(l.date || '');
    if (d.startsWith(monthPrefix) && l.type === 'PAID_LEAVE' && l.status === 'APPROVED') {
      paidLeaveDates.add(d);
    }
  }

  const offDates = new Set<string>();

  for (const s of shifts as any[]) {
    const d = String(s.date || '');
    if (!d.startsWith(monthPrefix)) continue;
    if (excludeShiftDates && excludeShiftDates.has(d)) continue;
    if (s.shiftCode === 'OFF' && !paidLeaveDates.has(d)) {
      offDates.add(d);
    }
  }

  for (const l of leaves as any[]) {
    const d = String(l.date || '');
    if (!d.startsWith(monthPrefix)) continue;
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
  approvedOnly = false
) {
  const staff: any = await staffRepo.findById(staffId);
  if (!staff) return;
  const dept = staff.department || (staff.role === 'SALES' ? 'SALES' : 'OFFICE');
  if (dept !== 'SALES') return;

  const targetDate = String(date).trim();
  const ym = targetDate.slice(0, 7);
  const usedDates = await getSalesMonthlyUnpaidOffDates(staffId, ym, {
    excludeLeaveId,
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
 * Hạn mức nghỉ phép có lương: 1 ngày/tháng.
 * @param approvedOnly khi HR duyệt: chỉ đếm các đơn ĐÃ DUYỆT khác trong tháng
 */
export async function assertPaidLeaveQuota(staffId: string, date: string, excludeId?: string, approvedOnly = false) {
  const monthPrefix = date.slice(0, 8); // YYYY-MM-
  const list = await leaveRequestRepo.find({ staffId, type: 'PAID_LEAVE' });
  const used = list.filter(
    (l: any) =>
      String(l.date || '').startsWith(monthPrefix) &&
      String(l._id) !== String(excludeId || '') &&
      (approvedOnly ? l.status === 'APPROVED' : l.status === 'PENDING' || l.status === 'APPROVED')
  );
  if (used.length >= 1) {
    throw new ApiError(
      400,
      'PAID_LEAVE_QUOTA_EXCEEDED',
      `Tháng ${monthPrefix.slice(5, 7)}/${monthPrefix.slice(0, 4)} đã dùng hết 1 ngày nghỉ phép có lương`
    );
  }
}

// POST /api/v1/leave-requests
leaveRequestsRouter.post('/leave-requests', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const staff = await staffRepo.findById(user.userId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    const { type, date, reason } = req.body || {};
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

    if (!['WFH', 'OFF', 'LATE', 'EARLY', 'PAID_LEAVE'].includes(type)) {
      throw new ApiError(400, 'INVALID_TYPE', 'Loại đơn không hợp lệ');
    }

    // Nghỉ phép có lương: chỉ hợp đồng Chính thức, tối đa 1 ngày/tháng (không dùng thì mất)
    if (type === 'PAID_LEAVE') {
      // Chỉ nhân viên có loại hợp đồng được ghi rõ là Chính thức (FULLTIME)
      if (staff.contractType !== 'FULLTIME') {
        throw new ApiError(
          400,
          'PAID_LEAVE_NOT_ELIGIBLE',
          'Chỉ nhân viên hợp đồng Chính thức mới có ngày nghỉ phép có lương'
        );
      }
      await assertPaidLeaveQuota(String(staff._id), String(date).trim());
    }

    // Nghỉ không lương (OFF): nhân viên khối SALES tối đa 4 ngày/tháng
    if (type === 'OFF') {
      await assertSalesUnpaidOffQuota(String(staff._id), String(date).trim(), undefined, false);
    }

    const dup = await leaveRequestRepo.find({ staffId: staff._id, date: String(date).trim(), type });
    if (dup.some((d: any) => d.status === 'PENDING' || d.status === 'APPROVED')) {
      throw new ApiError(400, 'DUPLICATE_REQUEST', 'Bạn đã có đơn cùng loại cho ngày này (đang chờ duyệt hoặc đã duyệt)');
    }

    const created = await leaveRequestRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department: staff.department || 'OFFICE',
      type,
      date: String(date).trim(),
      reason: String(reason).trim(),
      status: 'PENDING',
    });

    res.status(201).json({
      data: created,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leave-requests
leaveRequestsRouter.get('/leave-requests', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { status, type, date, staffId } = req.query;
    const filter: Record<string, any> = {};

    if (['ADMIN', 'HR'].includes(user.role)) {
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
    res.json({
      data: list,
      meta: { total: list.length },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/leave-requests/:id (Nhân viên hủy đơn đang chờ duyệt của mình)
leaveRequestsRouter.delete('/leave-requests/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const request: any = await leaveRequestRepo.findById(req.params.id);
    if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
    if (String(request.staffId) !== String(user.userId)) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được hủy đơn của chính mình');
    }
    if (request.status !== 'PENDING') {
      throw new ApiError(400, 'REQUEST_ALREADY_REVIEWED', 'Đơn đã được HR xử lý, không thể hủy');
    }
    await leaveRequestRepo.deleteById(String(request._id));
    res.json({ data: { success: true }, meta: { message: 'Đã hủy đơn' } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/leave-requests/:id (HR / Admin duyệt)
leaveRequestsRouter.patch('/leave-requests/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền duyệt đơn');
    }

    const { id } = req.params;
    const request = await leaveRequestRepo.findById(id);
    if (!request) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy đơn');
    }

    const { status, reviewNote = '' } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái duyệt phải là APPROVED hoặc REJECTED');
    }

    if (status === 'APPROVED' && (request as any).type === 'PAID_LEAVE') {
      await assertPaidLeaveQuota(String((request as any).staffId), String((request as any).date), String(id), true);
    }

    if (status === 'APPROVED' && (request as any).type === 'OFF') {
      await assertSalesUnpaidOffQuota(String((request as any).staffId), String((request as any).date), String(id), true);
    }

    const updated = await leaveRequestRepo.updateById(id, {
      status,
      reviewNote: String(reviewNote).trim(),
      reviewedBy: user.fullName || user.username,
      reviewedAt: new Date(),
    });

    res.json({
      data: updated,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

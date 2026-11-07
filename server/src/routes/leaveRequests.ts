import { Router } from 'express';
import { leaveRequestRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const leaveRequestsRouter = Router();

/** Độ dài tối đa của lý do trong đơn từ */
const LEAVE_REASON_MAX_LENGTH = 100;

/**
 * Hạn mức nghỉ phép có lương: 1 ngày/tháng.
 * @param approvedOnly khi HR duyệt: chỉ đếm các đơn ĐÃ DUYỆT khác trong tháng
 */
async function assertPaidLeaveQuota(staffId: string, date: string, excludeId?: string, approvedOnly = false) {
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

    // Nghiệp vụ WFH: Chỉ áp dụng cho khối Văn phòng (OFFICE)
    if (type === 'WFH' && staff.department !== 'OFFICE') {
      throw new ApiError(
        400,
        'WFH_NOT_ALLOWED',
        'Hình thức Làm việc từ xa (WFH) chỉ áp dụng cho nhân viên Khối Văn phòng!'
      );
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

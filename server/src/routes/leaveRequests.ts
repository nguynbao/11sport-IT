import { Router } from 'express';
import { leaveRequestRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const leaveRequestsRouter = Router();

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

    if (!['WFH', 'OFF', 'LATE', 'EARLY'].includes(type)) {
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
    res.json({
      data: list,
      meta: { total: list.length },
    });
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

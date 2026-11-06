import { Router } from 'express';
import { holidayRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const holidaysRouter = Router();

// GET /api/v1/holidays
holidaysRouter.get('/holidays', async (_req, res, next) => {
  try {
    const holidays = await holidayRepo.find({});
    // Sắp xếp tăng dần theo ngày
    holidays.sort((a, b) => a.date.localeCompare(b.date));
    res.json({
      data: holidays,
      meta: { total: holidays.length },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/holidays (HR / Admin tạo ngày lễ)
holidaysRouter.post('/holidays', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền tạo ngày lễ');
    }

    const { date, name, note = '' } = req.body || {};
    if (!date || !name) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày lễ và tên ngày lễ bắt buộc nhập');
    }

    const existing = await holidayRepo.findOne({ date: String(date).trim() });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_HOLIDAY', 'Ngày này đã được cấu hình ngày lễ rồi');
    }

    const created = await holidayRepo.create({
      date: String(date).trim(),
      name: String(name).trim(),
      note: String(note).trim(),
    });

    res.status(201).json({
      data: created,
      meta: { message: 'Thêm ngày lễ thành công' },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/holidays/:id
holidaysRouter.delete('/holidays/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xóa ngày lễ');
    }

    const { id } = req.params;
    const deleted = await holidayRepo.deleteById(id);
    if (!deleted) {
      throw new ApiError(404, 'HOLIDAY_NOT_FOUND', 'Không tìm thấy ngày lễ');
    }

    res.json({
      data: { success: true },
      meta: { message: 'Đã xóa ngày lễ' },
    });
  } catch (err) {
    next(err);
  }
});

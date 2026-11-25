import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/errors';
import {
  listHolidays,
  syncVietnamHolidays,
  createHoliday,
  deleteHolidayById,
} from '../services/holidays.service';

const HOLIDAY_MANAGER_ROLES = new Set(['CEO', 'ADMIN', 'HR']);

function assertHolidayManager(role?: string, actionLabel = 'quản lý ngày lễ') {
  if (!role || !HOLIDAY_MANAGER_ROLES.has(role)) {
    throw new ApiError(403, 'FORBIDDEN', `Chỉ CEO, HR hoặc ADMIN mới có quyền ${actionLabel}`);
  }
}

export async function getHolidaysHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { result, requestedYear } = await listHolidays(req.query.year);
    res.json({
      data: result,
      meta: { total: result.length, year: requestedYear },
    });
  } catch (err) {
    next(err);
  }
}

export async function syncVnHolidaysHandler(req: Request, res: Response, next: NextFunction) {
  try {
    assertHolidayManager(req.user?.role, 'đồng bộ ngày lễ');
    const { year, syncedCount, totalVietnamHolidays } = await syncVietnamHolidays(req.body?.year);
    const label = syncedCount > 0 ? `${syncedCount}/${totalVietnamHolidays}` : `${totalVietnamHolidays}`;
    res.json({
      data: { year, syncedCount, totalVietnamHolidays },
      meta: { message: `Đã đồng bộ ${label} ngày lễ Việt Nam năm ${year}` },
    });
  } catch (err) {
    next(err);
  }
}

export async function createHolidayHandler(req: Request, res: Response, next: NextFunction) {
  try {
    assertHolidayManager(req.user?.role, 'tạo ngày lễ');
    const created = await createHoliday(req.body || {});
    res.status(201).json({
      data: created,
      meta: { message: 'Thêm ngày lễ thành công' },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteHolidayHandler(req: Request, res: Response, next: NextFunction) {
  try {
    assertHolidayManager(req.user?.role, 'xóa ngày lễ');
    await deleteHolidayById(req.params.id);
    res.json({
      data: { success: true },
      meta: { message: 'Đã xóa ngày lễ' },
    });
  } catch (err) {
    next(err);
  }
}

import { ApiError } from '../shared/errors';
import { handle } from '../shared/http';
import { created, ok } from '../shared/result';
import {
  listHolidays,
  syncVietnamHolidays,
  createHoliday,
  deleteHolidayById,
} from '../services/holidays';

const HOLIDAY_MANAGER_ROLES = new Set(['CEO', 'ADMIN', 'HR']);

function assertHolidayManager(role?: string, actionLabel = 'quản lý ngày lễ') {
  if (!role || !HOLIDAY_MANAGER_ROLES.has(role)) {
    throw new ApiError(403, 'FORBIDDEN', `Chỉ CEO, HR hoặc ADMIN mới có quyền ${actionLabel}`);
  }
}

export const getHolidaysHandler = handle(async (req) => {
  const { result, requestedYear } = await listHolidays(req.query.year);
  return ok(result, { total: result.length, year: requestedYear });
});

export const syncVnHolidaysHandler = handle(async (req, ctx) => {
  assertHolidayManager(ctx.user?.role, 'đồng bộ ngày lễ');
  const { year, syncedCount, totalVietnamHolidays } = await syncVietnamHolidays(req.body?.year);
  const label = syncedCount > 0 ? `${syncedCount}/${totalVietnamHolidays}` : `${totalVietnamHolidays}`;
  return ok(
    { year, syncedCount, totalVietnamHolidays },
    { message: `Đã đồng bộ ${label} ngày lễ Việt Nam năm ${year}` }
  );
});

export const createHolidayHandler = handle(async (req, ctx) => {
  assertHolidayManager(ctx.user?.role, 'tạo ngày lễ');
  const createdHoliday = await createHoliday(req.body || {});
  return created(createdHoliday, { message: 'Thêm ngày lễ thành công' });
});

export const deleteHolidayHandler = handle(async (req, ctx) => {
  assertHolidayManager(ctx.user?.role, 'xóa ngày lễ');
  await deleteHolidayById(req.params.id);
  return ok({ success: true }, { message: 'Đã xóa ngày lễ' });
});

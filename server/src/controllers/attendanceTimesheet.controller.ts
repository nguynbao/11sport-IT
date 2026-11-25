import { handle } from '../shared/http';
import { created, ok } from '../shared/result';
import {
  getTimesheetReport,
  getMyAttendanceCalendar,
  adjustAttendanceRecord,
  createManualAttendance,
} from '../services/timesheet';

export const getTimesheetHandler = handle(async (req, ctx) => {
  const data = await getTimesheetReport(ctx.user, req.query);
  return ok(data, { total: data.rows.length });
});

export const getMyCalendarHandler = handle(async (req, ctx) => {
  const data = await getMyAttendanceCalendar(ctx.user, req.query);
  return ok(data);
});

export const patchAttendanceHandler = handle(async (req, ctx) => {
  const result = await adjustAttendanceRecord(ctx.user, req.params.id, req.body);
  return ok(result.data, { message: result.message });
});

export const postManualAttendanceHandler = handle(async (req, ctx) => {
  const result = await createManualAttendance(ctx.user, req.body);
  return created(result.data, { message: result.message });
});

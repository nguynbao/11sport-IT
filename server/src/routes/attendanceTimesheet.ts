import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getTimesheetHandler,
  getMyCalendarHandler,
  patchAttendanceHandler,
  postManualAttendanceHandler,
} from '../controllers/attendanceTimesheet.controller';

export const attendanceTimesheetRouter = Router();

attendanceTimesheetRouter.use('/attendance', requireAuth);

attendanceTimesheetRouter.get('/attendance/timesheet', getTimesheetHandler);
attendanceTimesheetRouter.get('/attendance/my-calendar', getMyCalendarHandler);
attendanceTimesheetRouter.patch('/attendance/:id', patchAttendanceHandler);
attendanceTimesheetRouter.post('/attendance/manual', postManualAttendanceHandler);

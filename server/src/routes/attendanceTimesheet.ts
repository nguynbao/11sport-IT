import { Router } from 'express';
import {
  getTimesheetHandler,
  getMyCalendarHandler,
  patchAttendanceHandler,
  postManualAttendanceHandler,
} from '../controllers/attendanceTimesheet.controller';

export const attendanceTimesheetRouter = Router();

attendanceTimesheetRouter.get('/attendance/timesheet', getTimesheetHandler);
attendanceTimesheetRouter.get('/attendance/my-calendar', getMyCalendarHandler);
attendanceTimesheetRouter.patch('/attendance/:id', patchAttendanceHandler);
attendanceTimesheetRouter.post('/attendance/manual', postManualAttendanceHandler);

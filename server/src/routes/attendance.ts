import { Router } from 'express';
import {
  postAttendanceCheckInHandler,
  postAttendanceCheckOutHandler,
  getAttendanceTodayHandler,
  getAttendanceHistoryHandler,
  getAttendanceConfigHandler,
  putAttendanceConfigHandler,
} from '../controllers/attendance.controller';

export const attendanceRouter = Router();

attendanceRouter.post('/attendance/check-in', postAttendanceCheckInHandler);
attendanceRouter.post('/attendance/check-out', postAttendanceCheckOutHandler);
attendanceRouter.get('/attendance/today', getAttendanceTodayHandler);
attendanceRouter.get('/attendance/history', getAttendanceHistoryHandler);
attendanceRouter.get('/attendance/config', getAttendanceConfigHandler);
attendanceRouter.put('/attendance/config', putAttendanceConfigHandler);

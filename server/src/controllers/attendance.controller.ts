import { handle } from '../shared/http';
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceConfig,
  updateAttendanceConfig,
} from '../services/attendance';

export const postAttendanceCheckInHandler = handle((req, ctx) =>
  checkIn(ctx, req.body)
);

export const postAttendanceCheckOutHandler = handle((req, ctx) =>
  checkOut(ctx, req.body)
);

export const getAttendanceTodayHandler = handle((_req, ctx) =>
  getTodayAttendance(ctx)
);

export const getAttendanceHistoryHandler = handle((req, ctx) =>
  getAttendanceHistory(ctx, req.query)
);

export const getAttendanceConfigHandler = handle((_req, ctx) =>
  getAttendanceConfig(ctx)
);

export const putAttendanceConfigHandler = handle((req, ctx) =>
  updateAttendanceConfig(ctx, req.body)
);

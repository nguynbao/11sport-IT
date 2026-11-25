import { handle } from '../shared/http';
import {
  registerWeeklyPreferences,
  getMySchedule,
  markMyScheduleSeen,
  getWeeklySchedule,
  assignWeekBulk,
  assignSingleShift,
} from '../services/shifts';

export const registerWeeklyPreferencesHandler = handle((req, ctx) =>
  registerWeeklyPreferences(ctx, req.body)
);

export const getMyScheduleHandler = handle((req, ctx) =>
  getMySchedule(ctx, req.query)
);

export const markMyScheduleSeenHandler = handle((_req, ctx) =>
  markMyScheduleSeen(ctx)
);

export const getWeeklyScheduleHandler = handle((req, ctx) =>
  getWeeklySchedule(ctx, req.query)
);

export const assignWeekBulkHandler = handle((req, ctx) =>
  assignWeekBulk(ctx, req.body)
);

export const assignSingleShiftHandler = handle((req, ctx) =>
  assignSingleShift(ctx, req.body)
);

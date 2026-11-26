import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  registerWeeklyPreferencesHandler,
  getMyScheduleHandler,
  markMyScheduleSeenHandler,
  getWeeklyScheduleHandler,
  assignWeekBulkHandler,
  assignSingleShiftHandler,
} from '../controllers/shifts.controller';
import {
  getHandoverScheduleConfigHandler,
  putHandoverScheduleConfigHandler,
  getHandoverDailyCheckHandler,
  listHandoversHandler,
  submitHandoverHandler,
  confirmHandoverHandler,
  deleteHandoverHandler,
} from '../controllers/handover.controller';

export const shiftsRouter = Router();

shiftsRouter.use('/shifts', requireAuth);

shiftsRouter.post('/shifts/preferences', registerWeeklyPreferencesHandler);
shiftsRouter.get('/shifts/my-schedule', getMyScheduleHandler);
shiftsRouter.post('/shifts/my-schedule/seen', markMyScheduleSeenHandler);
shiftsRouter.get('/shifts/schedule', getWeeklyScheduleHandler);
shiftsRouter.put('/shifts/assign/bulk', assignWeekBulkHandler);
shiftsRouter.put('/shifts/assign', assignSingleShiftHandler);

shiftsRouter.get('/shifts/handover/schedule-config', getHandoverScheduleConfigHandler);
shiftsRouter.put('/shifts/handover/schedule-config', putHandoverScheduleConfigHandler);
shiftsRouter.get('/shifts/handover/daily-check', getHandoverDailyCheckHandler);
shiftsRouter.get('/shifts/handover', listHandoversHandler);
shiftsRouter.post('/shifts/handover', submitHandoverHandler);
shiftsRouter.post('/shifts/handover/:id/confirm', confirmHandoverHandler);
shiftsRouter.delete('/shifts/handover/:id', deleteHandoverHandler);

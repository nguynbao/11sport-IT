import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  postShiftsPreferencesHandler,
  getShiftsMyScheduleHandler,
  postShiftsMyScheduleSeenHandler,
  getShiftsScheduleHandler,
  putShiftsAssignBulkHandler,
  putShiftsAssignHandler,
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

shiftsRouter.post('/shifts/preferences', postShiftsPreferencesHandler);
shiftsRouter.get('/shifts/my-schedule', getShiftsMyScheduleHandler);
shiftsRouter.post('/shifts/my-schedule/seen', postShiftsMyScheduleSeenHandler);
shiftsRouter.get('/shifts/schedule', getShiftsScheduleHandler);
shiftsRouter.put('/shifts/assign/bulk', putShiftsAssignBulkHandler);
shiftsRouter.put('/shifts/assign', putShiftsAssignHandler);
shiftsRouter.get('/shifts/handover/schedule-config', getHandoverScheduleConfigHandler);
shiftsRouter.put('/shifts/handover/schedule-config', putHandoverScheduleConfigHandler);
shiftsRouter.get('/shifts/handover/daily-check', getHandoverDailyCheckHandler);
shiftsRouter.get('/shifts/handover', listHandoversHandler);
shiftsRouter.post('/shifts/handover', submitHandoverHandler);
shiftsRouter.post('/shifts/handover/:id/confirm', confirmHandoverHandler);
shiftsRouter.delete('/shifts/handover/:id', deleteHandoverHandler);

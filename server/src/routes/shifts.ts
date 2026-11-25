import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  postShiftsPreferencesHandler,
  getShiftsMyScheduleHandler,
  postShiftsMyScheduleSeenHandler,
  getShiftsScheduleHandler,
  putShiftsAssignBulkHandler,
  putShiftsAssignHandler,
  getShiftsHandoverScheduleConfigHandler,
  putShiftsHandoverScheduleConfigHandler,
  getShiftsHandoverDailyCheckHandler,
  getShiftsHandoverHandler,
  postShiftsHandoverHandler,
  postShiftsHandover_ByIdConfirmHandler,
  deleteShiftsHandover_ByIdHandler,
} from '../controllers/shifts.controller';

export const shiftsRouter = Router();

shiftsRouter.use('/shifts', requireAuth);

shiftsRouter.post('/shifts/preferences', postShiftsPreferencesHandler);
shiftsRouter.get('/shifts/my-schedule', getShiftsMyScheduleHandler);
shiftsRouter.post('/shifts/my-schedule/seen', postShiftsMyScheduleSeenHandler);
shiftsRouter.get('/shifts/schedule', getShiftsScheduleHandler);
shiftsRouter.put('/shifts/assign/bulk', putShiftsAssignBulkHandler);
shiftsRouter.put('/shifts/assign', putShiftsAssignHandler);
shiftsRouter.get('/shifts/handover/schedule-config', getShiftsHandoverScheduleConfigHandler);
shiftsRouter.put('/shifts/handover/schedule-config', putShiftsHandoverScheduleConfigHandler);
shiftsRouter.get('/shifts/handover/daily-check', getShiftsHandoverDailyCheckHandler);
shiftsRouter.get('/shifts/handover', getShiftsHandoverHandler);
shiftsRouter.post('/shifts/handover', postShiftsHandoverHandler);
shiftsRouter.post('/shifts/handover/:id/confirm', postShiftsHandover_ByIdConfirmHandler);
shiftsRouter.delete('/shifts/handover/:id', deleteShiftsHandover_ByIdHandler);

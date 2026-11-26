import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getHolidaysHandler,
  syncVnHolidaysHandler,
  createHolidayHandler,
  deleteHolidayHandler,
} from '../controllers/holidays.controller';

export const holidaysRouter = Router();

holidaysRouter.use('/holidays', requireAuth);

holidaysRouter.get('/holidays', getHolidaysHandler);
holidaysRouter.post('/holidays/sync-vn', syncVnHolidaysHandler);
holidaysRouter.post('/holidays', createHolidayHandler);
holidaysRouter.delete('/holidays/:id', deleteHolidayHandler);

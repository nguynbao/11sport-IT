import { Router } from 'express';
import {
  getHolidaysHandler,
  syncVnHolidaysHandler,
  createHolidayHandler,
  deleteHolidayHandler,
} from '../controllers/holidays.controller';

export const holidaysRouter = Router();

holidaysRouter.get('/holidays', getHolidaysHandler);
holidaysRouter.post('/holidays/sync-vn', syncVnHolidaysHandler);
holidaysRouter.post('/holidays', createHolidayHandler);
holidaysRouter.delete('/holidays/:id', deleteHolidayHandler);

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getReportsStaffActivityHandler,
  getReportsRevenueDashboardHandler,
  getReportsPushProductsHandler,
} from '../controllers/reports.controller';

export const reportsRouter = Router();

reportsRouter.use('/reports', requireAuth);

reportsRouter.get('/reports/staff-activity', getReportsStaffActivityHandler);
reportsRouter.get('/reports/revenue-dashboard', getReportsRevenueDashboardHandler);
reportsRouter.get('/reports/push-products', getReportsPushProductsHandler);

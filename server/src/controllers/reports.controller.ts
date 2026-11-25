import { handle } from '../shared/http';
import {
  getReportsStaffActivity,
  getReportsRevenueDashboard,
  getReportsPushProducts,
} from '../services/reports';

export const getReportsStaffActivityHandler = handle((req, ctx) =>
  getReportsStaffActivity(ctx, req.query)
);

export const getReportsRevenueDashboardHandler = handle((req, ctx) =>
  getReportsRevenueDashboard(ctx, req.query)
);

export const getReportsPushProductsHandler = handle((req, ctx) =>
  getReportsPushProducts(ctx, req.query)
);

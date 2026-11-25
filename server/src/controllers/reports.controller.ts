import { Request, Response, NextFunction } from 'express';
import {
  getReportsStaffActivity,
  getReportsRevenueDashboard,
  getReportsPushProducts,
} from '../services/reports.service';

export async function getReportsStaffActivityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getReportsStaffActivity({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getReportsRevenueDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getReportsRevenueDashboard({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getReportsPushProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getReportsPushProducts({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

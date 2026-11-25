import { Request, Response, NextFunction } from 'express';
import {
  getTimesheetReport,
  getMyAttendanceCalendar,
  adjustAttendanceRecord,
  createManualAttendance,
} from '../services/attendanceTimesheet.service';

export async function getTimesheetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getTimesheetReport(req.user, req.query);
    res.json({ data, meta: { total: data.rows.length } });
  } catch (err) {
    next(err);
  }
}

export async function getMyCalendarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMyAttendanceCalendar(req.user, req.query);
    res.json({ data, meta: {} });
  } catch (err) {
    next(err);
  }
}

export async function patchAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adjustAttendanceRecord(req.user, req.params.id, req.body);
    res.json({ data: result.data, meta: { message: result.message } });
  } catch (err) {
    next(err);
  }
}

export async function postManualAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createManualAttendance(req.user, req.body);
    res.status(201).json({ data: result.data, meta: { message: result.message } });
  } catch (err) {
    next(err);
  }
}

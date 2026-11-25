import { Request, Response, NextFunction } from 'express';
import {
  postAttendanceCheckIn,
  postAttendanceCheckOut,
  getAttendanceToday,
  getAttendanceHistory,
  getAttendanceConfig,
  putAttendanceConfig,
} from '../services/attendance.service';

export async function postAttendanceCheckInHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postAttendanceCheckIn({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function postAttendanceCheckOutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postAttendanceCheckOut({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceTodayHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAttendanceToday({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAttendanceHistory({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceConfigHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAttendanceConfig({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function putAttendanceConfigHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putAttendanceConfig({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

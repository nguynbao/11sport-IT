import { Request, Response, NextFunction } from 'express';
import {
  postShiftsPreferences,
  getShiftsMySchedule,
  postShiftsMyScheduleSeen,
  getShiftsSchedule,
  putShiftsAssignBulk,
  putShiftsAssign,
  getShiftsHandoverScheduleConfig,
  putShiftsHandoverScheduleConfig,
  getShiftsHandoverDailyCheck,
  getShiftsHandover,
  postShiftsHandover,
  postShiftsHandover_ByIdConfirm,
  deleteShiftsHandover_ById,
} from '../services/shifts.service';

export async function postShiftsPreferencesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postShiftsPreferences({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getShiftsMyScheduleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getShiftsMySchedule({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function postShiftsMyScheduleSeenHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postShiftsMyScheduleSeen({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getShiftsScheduleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getShiftsSchedule({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function putShiftsAssignBulkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putShiftsAssignBulk({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function putShiftsAssignHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putShiftsAssign({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getShiftsHandoverScheduleConfigHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getShiftsHandoverScheduleConfig({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function putShiftsHandoverScheduleConfigHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putShiftsHandoverScheduleConfig({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getShiftsHandoverDailyCheckHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getShiftsHandoverDailyCheck({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function getShiftsHandoverHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getShiftsHandover({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function postShiftsHandoverHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postShiftsHandover({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function postShiftsHandover_ByIdConfirmHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postShiftsHandover_ByIdConfirm({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

export async function deleteShiftsHandover_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteShiftsHandover_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
}

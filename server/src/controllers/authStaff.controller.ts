import { Request, Response, NextFunction } from 'express';
import {
  postAuthLogin,
  postAuthChangePassword,
  getStaff,
  postStaffParseImportFile,
  postStaff,
  patchStaff_ById,
} from '../services/authStaff.service';

export async function postAuthLoginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postAuthLogin({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postAuthChangePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postAuthChangePassword({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getStaff({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postStaffParseImportFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postStaffParseImportFile({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postStaff({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchStaff_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchStaff_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

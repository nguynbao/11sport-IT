import { Request, Response, NextFunction } from 'express';
import {
  getReturns,
  postReturnsCalculate,
  postReturns,
} from '../services/returns.service';

export async function getReturnsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getReturns({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postReturnsCalculateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postReturnsCalculate({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postReturnsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postReturns({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

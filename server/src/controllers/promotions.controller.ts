import { Request, Response, NextFunction } from 'express';
import {
  getPromotions,
  postPromotions,
  patchPromotions_ById,
  deletePromotions_ById,
  postPromotionsEvaluate,
} from '../services/promotions.service';

export async function getPromotionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getPromotions({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postPromotionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postPromotions({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchPromotions_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchPromotions_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deletePromotions_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deletePromotions_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postPromotionsEvaluateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postPromotionsEvaluate({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

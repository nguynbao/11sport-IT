import { Request, Response, NextFunction } from 'express';
import {
  getCategories,
  postCategories,
  patchCategories_ById,
  deleteCategories_ById,
} from '../services/categories.service';

export async function getCategoriesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getCategories({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postCategoriesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postCategories({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchCategories_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchCategories_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteCategories_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteCategories_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

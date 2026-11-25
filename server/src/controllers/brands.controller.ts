import { Request, Response, NextFunction } from 'express';
import {
  getBrands,
  postBrands,
  patchBrands_ById,
  deleteBrands_ById,
} from '../services/brands.service';

export async function getBrandsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getBrands({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postBrandsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postBrands({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchBrands_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchBrands_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteBrands_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteBrands_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

import { Request, Response, NextFunction } from 'express';
import {
  postProductsGenerateCode,
  postProductsPreviewCode,
  getProductsLookup,
  getProducts,
  postProducts,
  postProducts_ByIdVariants,
  patchProducts_ByIdVariants,
  patchProducts_ById,
  deleteProducts_ById,
  getInventoryMovements,
  getInventoryReport,
  postInventoryAdjustments,
  postInventoryUnpackSet,
  getInventoryTransfers,
  postInventoryTransfers,
} from '../services/productsInventory.service';

export async function postProductsGenerateCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postProductsGenerateCode({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postProductsPreviewCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postProductsPreviewCode({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getProductsLookupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getProductsLookup({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getProducts({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postProducts({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postProducts_ByIdVariantsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postProducts_ByIdVariants({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchProducts_ByIdVariantsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchProducts_ByIdVariants({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchProducts_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchProducts_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteProducts_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteProducts_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getInventoryMovementsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getInventoryMovements({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getInventoryReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getInventoryReport({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postInventoryAdjustmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postInventoryAdjustments({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postInventoryUnpackSetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postInventoryUnpackSet({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getInventoryTransfersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getInventoryTransfers({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postInventoryTransfersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postInventoryTransfers({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

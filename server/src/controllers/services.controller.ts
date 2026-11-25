import { Request, Response, NextFunction } from 'express';
import {
  getServiceTypes,
  postServiceTypes,
  patchServiceTypes_ById,
  deleteServiceTypes_ById,
  getServiceOrders,
  getServiceOrders_ById,
  postServiceOrders,
  patchServiceOrders_ById,
  patchServiceOrders_ByIdStatus,
  postServiceOrders_ByIdPayments,
} from '../services/services.service';

export async function getServiceTypesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getServiceTypes({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postServiceTypesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postServiceTypes({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchServiceTypes_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchServiceTypes_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteServiceTypes_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteServiceTypes_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getServiceOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getServiceOrders({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getServiceOrders_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getServiceOrders_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postServiceOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postServiceOrders({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchServiceOrders_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchServiceOrders_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function patchServiceOrders_ByIdStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await patchServiceOrders_ByIdStatus({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postServiceOrders_ByIdPaymentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postServiceOrders_ByIdPayments({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

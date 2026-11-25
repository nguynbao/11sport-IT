import { Request, Response, NextFunction } from 'express';
import {
  getCustomersLookup,
  getCustomers,
  getOrdersCurrentShift,
  getOrders,
  getOrdersByCode_ByCode,
  getOrders_ById,
  postOrders,
  putOrders_ById,
  postOrders_ByIdConfirm,
  postOrders_ByIdDebtPayment,
  deleteOrders_ById,
} from '../services/ordersCustomers.service';

export async function getCustomersLookupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getCustomersLookup({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getCustomersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getCustomers({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getOrdersCurrentShiftHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOrdersCurrentShift({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOrders({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getOrdersByCode_ByCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOrdersByCode_ByCode({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function getOrders_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOrders_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postOrders({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function putOrders_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await putOrders_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postOrders_ByIdConfirmHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postOrders_ByIdConfirm({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postOrders_ByIdDebtPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postOrders_ByIdDebtPayment({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function deleteOrders_ByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteOrders_ById({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

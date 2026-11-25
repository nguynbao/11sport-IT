import { Request, Response, NextFunction } from 'express';
import {
  getWiseCurrencies,
  postWiseQuote,
} from '../services/wise.service';

export async function getWiseCurrenciesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getWiseCurrencies();
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

export async function postWiseQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await postWiseQuote({ user: req.user, isFallbackUser: req.isFallbackUser, query: req.query, params: req.params, body: req.body, headers: req.headers, ip: req.ip, socket: req.socket });
    res.status(result.status).json(result.payload);
  } catch (err) { next(err); }
}

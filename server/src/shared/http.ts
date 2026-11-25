import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ServiceResult } from './result';

export interface ServiceContext {
  user?: Express.Request['user'];
  isFallbackUser?: boolean;
  ip?: string;
  headers?: Record<string, any>;
  socket?: any;
}

export function buildContext(req: Request): ServiceContext {
  return {
    user: req.user,
    isFallbackUser: req.isFallbackUser,
    ip: req.ip,
    headers: req.headers,
    socket: req.socket,
  };
}

export function handle<T>(
  serviceFn: (req: Request, ctx: ServiceContext) => Promise<ServiceResult<T>> | ServiceResult<T>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceFn(req, buildContext(req));
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v);
        }
      }
      const status = result.status || 200;
      if (result.rawPayload !== undefined) {
        res.status(status).json(result.rawPayload);
        return;
      }
      res.status(status).json({
        data: result.data,
        meta: result.meta ?? {},
      });
    } catch (err) {
      next(err);
    }
  };
}

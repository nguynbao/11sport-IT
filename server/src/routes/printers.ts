import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { getPrintersHandler, printLabelsHandler } from '../controllers/printers.controller';

export const printersRouter = Router();

printersRouter.use('/printers', (req: Request, _res: Response, next: NextFunction) => {
  const remoteIp = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1';
  if (!req.user && !isLoopback) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để sử dụng máy in'));
    return;
  }
  next();
});

printersRouter.get('/printers', getPrintersHandler);
printersRouter.post('/printers/print-labels', printLabelsHandler);

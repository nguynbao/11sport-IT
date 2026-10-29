import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/auth';
import { staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function attachUserContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
        return next();
      }
    }

    const userIdHeader = req.headers['x-user-id'] as string | undefined;
    if (userIdHeader) {
      const staff =
        (await staffRepo.findById(userIdHeader)) ||
        (await staffRepo.findOne({ username: userIdHeader.toLowerCase() })) ||
        (await staffRepo.findOne({ code: userIdHeader.toUpperCase() }));
      if (staff && staff.status === 'ACTIVE') {
        req.user = {
          userId: staff._id,
          username: staff.username,
          fullName: staff.fullName,
          role: staff.role,
          code: staff.code,
        };
        return next();
      }
    }

    // Fallback mặc định trong môi trường nội bộ/demo POS nếu chưa gửi header
    const defaultStaff = await staffRepo.findOne({ username: 'admin' });
    if (defaultStaff) {
      req.user = {
        userId: defaultStaff._id,
        username: defaultStaff.username,
        fullName: defaultStaff.fullName,
        role: defaultStaff.role,
        code: defaultStaff.code,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      fields: err.fields || {},
    });
    return;
  }

  console.error('[API Error]', err);
  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: err?.message || 'Lỗi hệ thống nội bộ',
    fields: {},
  });
}

import { Request, Response, NextFunction } from 'express';
import { staffRepo } from '../config/db';
import { IStaff, StaffRole, StaffDepartment } from '../models/Staff';
import { ApiError } from '../utils/errors';
import { verifyTokenWithStatus, isTestRuntime } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      isFallbackUser?: boolean;
      tokenExpired?: boolean;
      user?: {
        userId: string;
        username: string;
        fullName: string;
        role: StaffRole;
        department?: StaffDepartment;
        code: string;
      };
    }
  }
}

const STAFF_CACHE_TTL_MS = 30 * 1000; // 30 giây cache ngắn giúp giảm query DB liên tục mỗi request
const staffCache = new Map<string, { staff: IStaff; expiresAt: number }>();

/**
 * Xóa cache xác thực nhân viên ngay khi khóa/sửa quyền/đổi mật khẩu/xóa tài khoản.
 */
export function invalidateStaffAuthCache(staffIdOrAll?: string): void {
  if (!staffIdOrAll) {
    staffCache.clear();
    return;
  }
  const target = String(staffIdOrAll);
  for (const [key, entry] of staffCache.entries()) {
    if (key === target || String(entry.staff._id) === target) {
      staffCache.delete(key);
    }
  }
}

async function resolveActiveStaffCached(userId?: string, username?: string): Promise<IStaff | null> {
  // Trong test hay reset DB liên tục nên đọc thẳng DB để không dính dữ liệu giữa các suite
  const bypassCache = isTestRuntime();
  const now = Date.now();
  const cacheKey = userId ? `id:${userId}` : username ? `un:${username.toLowerCase()}` : '';

  if (!bypassCache && cacheKey) {
    const hit = staffCache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.staff;
    }
  }

  const freshStaff =
    (userId && (await staffRepo.findById(userId))) ||
    (username && (await staffRepo.findOne({ username: username.toLowerCase() })));

  if (!bypassCache && freshStaff && freshStaff.status === 'ACTIVE') {
    const expiresAt = now + STAFF_CACHE_TTL_MS;
    staffCache.set(`id:${freshStaff._id}`, { staff: freshStaff, expiresAt });
    if (freshStaff.username) {
      staffCache.set(`un:${freshStaff.username.toLowerCase()}`, { staff: freshStaff, expiresAt });
    }
  }

  return freshStaff || null;
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
      const { payload, expired } = verifyTokenWithStatus(token);
      if (expired) {
        req.tokenExpired = true;
      }
      if (payload) {
        const freshStaff = await resolveActiveStaffCached(payload.userId, payload.username);
        if (freshStaff && freshStaff.status === 'ACTIVE') {
          req.user = {
            userId: String(freshStaff._id),
            username: freshStaff.username,
            fullName: freshStaff.fullName,
            role: freshStaff.role,
            department: freshStaff.department,
            code: freshStaff.code,
          };
          return next();
        }
        if (freshStaff && freshStaff.status !== 'ACTIVE') {
          // Tài khoản đã bị khóa/ngừng hoạt động -> từ chối phiên
          return next();
        }
        // Trường hợp hiếm trong memory/test payload hợp lệ khi user vừa seed
        if (isTestRuntime()) {
          req.user = payload;
        }
        return next();
      }
    }

    // Bảo mật: Header giả danh x-user-id và fallback admin CHỈ được phép trong môi trường unit test
    if (isTestRuntime() && process.env.NODE_ENV !== 'production') {
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
            department: staff.department,
            code: staff.code,
          };
          return next();
        }
      }

      const defaultStaff = await staffRepo.findOne({ username: 'admin' });
      if (defaultStaff) {
        req.isFallbackUser = true;
        req.user = {
          userId: defaultStaff._id,
          username: defaultStaff.username,
          fullName: defaultStaff.fullName,
          role: defaultStaff.role,
          department: defaultStaff.department,
          code: defaultStaff.code,
        };
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    if (req.tokenExpired) {
      next(new ApiError(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
      return;
    }
    next(new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để sử dụng chức năng này'));
    return;
  }
  next();
}

export function requireRoles(
  allowedRoles: StaffRole[],
  forbiddenMessage = 'Bạn không có quyền thực hiện thao tác này'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      if (req.tokenExpired) {
        next(new ApiError(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
        return;
      }
      next(new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để sử dụng chức năng này'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, 'FORBIDDEN', forbiddenMessage));
      return;
    }
    next();
  };
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

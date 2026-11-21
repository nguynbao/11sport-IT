import { Request, Response, NextFunction } from 'express';
import { isTestRuntime } from '../utils/auth';

/**
 * Thiết lập các HTTP security headers cơ bản tương đương helmet mà không cần phụ thuộc ngoài.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

function getRequestIpKey(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  const realIp = req.headers['x-real-ip'];
  const fwd = req.headers['x-forwarded-for'];
  const raw =
    (typeof cfIp === 'string' && cfIp.trim()) ||
    (typeof realIp === 'string' && realIp.trim()) ||
    (typeof fwd === 'string' && fwd.split(',')[0].trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  return String(raw).replace(/^::ffff:/, '');
}

/**
 * Rate limiter in-memory theo cửa sổ cố định, tự dọn bucket hết hạn để tránh rò rỉ bộ nhớ.
 * Bỏ qua khi chạy unit test để không chặn test suite.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, RateBucket>();
  const prefix = options.keyPrefix || 'rl';
  const msg =
    options.message || 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau ít phút.';

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt <= now) {
        buckets.delete(k);
      }
    }
  }, Math.max(30_000, options.windowMs));
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (isTestRuntime()) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${prefix}:${getRequestIpKey(req)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: msg,
        fields: {},
      });
      return;
    }

    next();
  };
}

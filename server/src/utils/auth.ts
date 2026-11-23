import crypto from 'crypto';

import { StaffRole, StaffDepartment } from '../models/Staff';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`11sport_salt_${password}`).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export interface TokenPayload {
  userId: string;
  username: string;
  fullName: string;
  role: StaffRole;
  department?: StaffDepartment;
  code: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_DEV_SECRET = '11sport-secret-key-2026';
export const DEFAULT_JWT_EXPIRES_IN = '15d';
export const DEFAULT_JWT_TTL_SECONDS = 15 * 24 * 60 * 60;

export function isTestRuntime(): boolean {
  return Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === 'test' ||
      process.env.FORCE_MEMORY_DB === 'true'
  );
}

/**
 * Quy đổi chuỗi thời hạn trong env JWT_EXPIRES_IN (VD: "15d", "24h", "30m", "3600s", "86400") thành số giây.
 * Mặc định 15 ngày (1.296.000 giây) nếu không cấu hình hoặc giá trị không hợp lệ.
 */
export function parseTokenTtlSeconds(raw?: string): number {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return DEFAULT_JWT_TTL_SECONDS;
  const match = /^(\d+)\s*([dhms]?)$/.exec(s);
  if (!match) return DEFAULT_JWT_TTL_SECONDS;
  const num = Number(match[1]);
  const unit = match[2] || 's';
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_JWT_TTL_SECONDS;
  if (unit === 'd') return num * 24 * 60 * 60;
  if (unit === 'h') return num * 60 * 60;
  if (unit === 'm') return num * 60;
  return num;
}

export function getJwtExpiresInSeconds(): number {
  return parseTokenTtlSeconds(process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN);
}

/**
 * Kiểm tra cấu hình bảo mật bắt buộc trước khi chạy trên Production.
 * Không cho phép khởi động server ở production nếu thiếu JWT_SECRET hoặc dùng secret mặc định.
 */
export function assertSecurityEnvironment(): void {
  if (process.env.NODE_ENV !== 'production' || isTestRuntime()) return;
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret === DEFAULT_DEV_SECRET || secret.length < 16) {
    throw new Error(
      '[Security] JWT_SECRET không hợp lệ cho môi trường production (phải thiết lập biến môi trường >= 16 ký tự và khác khóa mẫu).'
    );
  }
}

function getJwtSecret(): string {
  const envSecret = String(process.env.JWT_SECRET || '').trim();
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === 'production' && !isTestRuntime()) {
    throw new Error('[Security] Thiếu biến môi trường JWT_SECRET ở production');
  }
  return DEFAULT_DEV_SECRET;
}

export function signToken(payload: TokenPayload, ttlSeconds?: number): string {
  const secret = getJwtSecret();
  const iat = Math.floor(Date.now() / 1000);
  const ttl =
    typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds)
      : getJwtExpiresInSeconds();
  const fullPayload: TokenPayload = {
    ...payload,
    iat,
    exp: iat + ttl,
  };
  const data = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyTokenWithStatus(token: string): {
  payload: TokenPayload | null;
  expired: boolean;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { payload: null, expired: false };
    const [data, sig] = parts;
    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { payload: null, expired: false };
    }
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof decoded.exp === 'number' && Math.floor(Date.now() / 1000) >= decoded.exp) {
      return { payload: null, expired: true };
    }
    return { payload: decoded, expired: false };
  } catch {
    return { payload: null, expired: false };
  }
}

export function verifyToken(token: string): TokenPayload | null {
  return verifyTokenWithStatus(token).payload;
}

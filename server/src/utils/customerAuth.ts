import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errors';
import { isTestRuntime } from './auth';

export interface CustomerTokenPayload {
  customerId: string;
  identifier: string;
  aud: '11sport-customer';
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      customer?: {
        customerId: string;
        identifier: string;
      };
    }
  }
}

const DEFAULT_CUSTOMER_SECRET = '11sport-customer-secret-2026';

function getCustomerJwtSecret(): string {
  const envSecret = String(process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET || '').trim();
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === 'production' && !isTestRuntime()) {
    throw new Error('[Security] Thiếu JWT_SECRET / CUSTOMER_JWT_SECRET ở production');
  }
  return DEFAULT_CUSTOMER_SECRET;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const padStr = mod === 0 ? '' : '='.repeat(4 - mod);
  return Buffer.from(padded + padStr, 'base64').toString('utf8');
}

export function signCustomerToken(customerId: string, identifier: string, ttlSeconds = 30 * 24 * 60 * 60): string {
  const secret = getCustomerJwtSecret();
  const iat = Math.floor(Date.now() / 1000);
  const payload: CustomerTokenPayload = {
    customerId,
    identifier,
    aud: '11sport-customer',
    iat,
    exp: iat + ttlSeconds,
  };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sig] = parts;
    const secret = getCustomerJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    const decoded = JSON.parse(base64UrlDecode(payloadB64)) as CustomerTokenPayload;
    if (decoded.aud !== '11sport-customer' || !decoded.customerId) return null;
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function attachCustomerContext(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyCustomerToken(token);
    if (payload) {
      req.customer = {
        customerId: payload.customerId,
        identifier: payload.identifier,
      };
    }
  }
  next();
}

export function requireCustomerAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.customer) {
    next(new ApiError(401, 'CUSTOMER_UNAUTHORIZED', 'Vui lòng đăng nhập tài khoản khách hàng'));
    return;
  }
  next();
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(identifier: string, otp: string): string {
  const secret = getCustomerJwtSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${identifier.trim().toLowerCase()}:${otp.trim()}`)
    .digest('hex');
}

export async function dispatchCustomerOtp(
  identifier: string,
  otp: string,
  channel: 'EMAIL' | 'SMS'
): Promise<void> {
  // Nếu có cấu hình Resend API key và kênh EMAIL -> gửi email thực tế
  const resendKey = process.env.RESEND_API_KEY;
  if (channel === 'EMAIL' && resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || '11 Sport <no-reply@11sport.vn>',
          to: [identifier],
          subject: `[11 Sport] Mã xác thực OTP của bạn: ${otp}`,
          html: `<p>Mã xác thực OTP đăng nhập 11 Sport của bạn là: <strong>${otp}</strong>. Mã có hiệu lực trong 5 phút.</p>`,
        }),
      });
      return;
    } catch (err) {
      console.error('[CustomerOTP] Resend error, falling back to log:', err);
    }
  }
  if (!isTestRuntime()) {
    console.log(`[CustomerOTP] (${channel}) To: ${identifier} -> OTP: ${otp}`);
  }
}

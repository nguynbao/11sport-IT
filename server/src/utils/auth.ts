import crypto from 'crypto';

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
  role: 'SALES' | 'WAREHOUSE' | 'ADMIN';
  code: string;
}

const SECRET = process.env.JWT_SECRET || '11sport-secret-key-2026';

export function signToken(payload: TokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

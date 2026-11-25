import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';
import { env } from './env';

const DEFAULT_ORIGINS = [
  'https://11sport-it.vercel.app',
  'https://11sport-it-m1ei.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const PRIVATE_LAN_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export const privateNetworkAccessMiddleware: RequestHandler = (req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
};

export function createCorsMiddleware(): RequestHandler {
  const allowedOrigins = Array.from(new Set([...DEFAULT_ORIGINS, ...env.corsOrigins]));

  const options: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(normalized) ||
        normalized.endsWith('.vercel.app') ||
        PRIVATE_LAN_ORIGIN_REGEX.test(normalized)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  };

  return cors(options);
}

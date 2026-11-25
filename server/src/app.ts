// Chấm công tính theo giờ Việt Nam: cố định múi giờ server (Render mặc định UTC sẽ lệch 7 tiếng)
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

import express from 'express';
import { env } from './config/env';
import { createCorsMiddleware, privateNetworkAccessMiddleware } from './config/cors';
import { getDbMode } from './config/database';
import { attachUserContext, errorHandler } from './middleware/auth';
import { securityHeaders, createRateLimiter } from './middleware/security';
import { createApiRouter } from './routes';

function buildHealthPayload() {
  const now = new Date();
  return {
    data: {
      status: 'ok',
      service: '11sport-server',
      dbMode: getDbMode(),
      apiBase: '/api/v1',
      timezone: env.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      localTime: now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }),
      timestamp: now.toISOString(),
    },
    meta: {},
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(securityHeaders);
  app.use(privateNetworkAccessMiddleware);
  app.use(createCorsMiddleware());

  const heavyBodyJson = express.json({ limit: '16mb' });
  const defaultBodyJson = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    const p = req.path || '';
    if (
      p.startsWith('/api/v1/imports') ||
      p === '/api/v1/staff/parse-import-file' ||
      p.startsWith('/api/v1/products')
    ) {
      heavyBodyJson(req, res, next);
      return;
    }
    defaultBodyJson(req, res, next);
  });

  const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyPrefix: 'auth',
    message: 'Thử đăng nhập hoặc đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  });
  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    keyPrefix: 'api',
    message: 'Hệ thống đang nhận quá nhiều yêu cầu, vui lòng thao tác chậm lại.',
  });

  app.use('/api/v1/auth/login', authRateLimiter);
  app.use('/api/v1/auth/change-password', authRateLimiter);
  app.use('/api/v1', apiRateLimiter);
  app.use(attachUserContext);

  // Root & Health check (hỗ trợ Render default health check tại / và /api/v1/health)
  app.get('/', (_req, res) => res.json(buildHealthPayload()));
  app.get('/api/v1/health', (_req, res) => res.json(buildHealthPayload()));

  app.use('/api/v1', createApiRouter());

  app.use((req, res) => {
    res.status(404).json({
      code: 'ENDPOINT_NOT_FOUND',
      message: `Không tìm thấy đường dẫn API: ${req.method} ${req.originalUrl}`,
      fields: {},
    });
  });

  app.use(errorHandler);
  return app;
}

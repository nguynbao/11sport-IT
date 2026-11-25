// Chấm công tính theo giờ Việt Nam: cố định múi giờ server (Render mặc định UTC sẽ lệch 7 tiếng)
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDbMode } from './config/db';
import { attachUserContext, errorHandler } from './middleware/auth';
import { securityHeaders, createRateLimiter } from './middleware/security';
import { authStaffRouter } from './routes/authStaff';
import { categoriesRouter } from './routes/categories';
import { brandsRouter } from './routes/brands';
import { productsInventoryRouter } from './routes/productsInventory';
import { importsRouter } from './routes/imports';
import { ordersCustomersRouter } from './routes/ordersCustomers';
import { returnsRouter } from './routes/returns';
import { reportsRouter } from './routes/reports';
import { wiseRouter } from './routes/wise';
import { promotionsRouter } from './routes/promotions';
import { printersRouter } from './routes/printers';
import { attendanceRouter } from './routes/attendance';
import { attendanceTimesheetRouter } from './routes/attendanceTimesheet';
import { leaveRequestsRouter } from './routes/leaveRequests';
import { shiftsRouter } from './routes/shifts';
import { holidaysRouter } from './routes/holidays';
import { servicesRouter } from './routes/services';
import { publicStorefrontRouter } from './routes/publicStorefront';
import { cmsWebRouter } from './routes/cmsWeb';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(securityHeaders);

  const defaultOrigins = [
    'https://11sport-it.vercel.app',
    'https://11sport-it-m1ei.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  // Hỗ trợ Chrome/Edge Private Network Access khi gọi từ HTTPS (Vercel) về localhost:4000
  app.use((req, res, next) => {
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        const isPrivateLanOrigin =
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(
            normalized
          );
        if (
          allowedOrigins.includes(normalized) ||
          normalized.endsWith('.vercel.app') ||
          isPrivateLanOrigin
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  const heavyBodyJson = express.json({ limit: '16mb' });
  const defaultBodyJson = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    const p = req.path || '';
    if (
      p.startsWith('/api/v1/imports') ||
      p === '/api/v1/staff/parse-import-file' ||
      p.startsWith('/api/v1/products') ||
      p.startsWith('/api/v1/cms/web/upload')
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
  app.use('/api/v1/public/customers/request-otp', authRateLimiter);
  app.use('/api/v1/public/customers/verify-otp', authRateLimiter);
  app.use('/api/v1/public/orders', authRateLimiter);
  app.use('/api/v1/public/reviews', authRateLimiter);
  app.use('/api/v1/public/contact', authRateLimiter);
  app.use('/api/v1', apiRateLimiter);
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use(attachUserContext);

  // Root & Health check (hỗ trợ Render default health check tại / và /api/v1/health)
  app.get('/', (_req, res) => {
    const now = new Date();
    res.json({
      data: {
        status: 'ok',
        service: '11sport-server',
        dbMode: getDbMode(),
        apiBase: '/api/v1',
        timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }),
        timestamp: now.toISOString(),
      },
      meta: {},
    });
  });

  app.get('/api/v1/health', (_req, res) => {
    const now = new Date();
    res.json({
      data: {
        status: 'ok',
        service: '11sport-server',
        dbMode: getDbMode(),
        timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }),
        timestamp: now.toISOString(),
      },
      meta: {},
    });
  });

  // Mount API v1 routers
  app.use('/api/v1', authStaffRouter);
  app.use('/api/v1', categoriesRouter);
  app.use('/api/v1', brandsRouter);
  app.use('/api/v1', productsInventoryRouter);
  app.use('/api/v1', importsRouter);
  app.use('/api/v1', ordersCustomersRouter);
  app.use('/api/v1', returnsRouter);
  app.use('/api/v1', reportsRouter);
  app.use('/api/v1', wiseRouter);
  app.use('/api/v1', promotionsRouter);
  app.use('/api/v1', printersRouter);
  app.use('/api/v1', attendanceRouter);
  app.use('/api/v1', attendanceTimesheetRouter);
  app.use('/api/v1', leaveRequestsRouter);
  app.use('/api/v1', shiftsRouter);
  app.use('/api/v1', holidaysRouter);
  app.use('/api/v1', servicesRouter);
  app.use('/api/v1/public', publicStorefrontRouter);
  app.use('/api/v1/cms/web', cmsWebRouter);

  // 404 Not Found
  app.use((req, res) => {
    res.status(404).json({
      code: 'ENDPOINT_NOT_FOUND',
      message: `Không tìm thấy đường dẫn API: ${req.method} ${req.originalUrl}`,
      fields: {},
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

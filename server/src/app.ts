import express from 'express';
import cors from 'cors';
import { getDbMode } from './config/db';
import { attachUserContext, errorHandler } from './middleware/auth';
import { authStaffRouter } from './routes/authStaff';
import { categoriesRouter } from './routes/categories';
import { productsInventoryRouter } from './routes/productsInventory';
import { importsRouter } from './routes/imports';
import { ordersCustomersRouter } from './routes/ordersCustomers';
import { returnsRouter } from './routes/returns';

export function createApp() {
  const app = express();

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
        if (
          allowedOrigins.includes(normalized) ||
          normalized.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(attachUserContext);

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        service: '11sport-server',
        dbMode: getDbMode(),
        timestamp: new Date().toISOString(),
      },
      meta: {},
    });
  });

  // Mount API v1 routers
  app.use('/api/v1', authStaffRouter);
  app.use('/api/v1', categoriesRouter);
  app.use('/api/v1', productsInventoryRouter);
  app.use('/api/v1', importsRouter);
  app.use('/api/v1', ordersCustomersRouter);
  app.use('/api/v1', returnsRouter);

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

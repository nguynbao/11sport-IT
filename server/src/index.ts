import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase } from './config/db';
import { seedDatabaseIfNeeded } from './config/seed';
import { startKeepAlive } from './utils/keepAlive';

const PORT = Number(process.env.PORT || 4000);

async function bootstrap() {
  await connectDatabase();
  await seedDatabaseIfNeeded();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[11Sport Server] Listening on http://localhost:${PORT}/api/v1`);
    startKeepAlive();
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
  process.exit(1);
});

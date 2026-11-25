/**
 * Đọc biến môi trường tập trung (dùng getter/hàm để phản ánh đúng khi test đổi process.env lúc runtime).
 */
export const env = {
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
  get isTest(): boolean {
    return Boolean(
      process.env.VITEST || this.nodeEnv === 'test' || process.env.FORCE_MEMORY_DB === 'true'
    );
  },
  get port(): number {
    return Number(process.env.PORT || 4000);
  },
  get timezone(): string {
    return process.env.TZ || 'Asia/Ho_Chi_Minh';
  },
  get mongodbUri(): string {
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11sport';
  },
  get forceMemoryDb(): boolean {
    return process.env.FORCE_MEMORY_DB === 'true';
  },
  get corsOrigins(): string[] {
    return (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  },
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  },
  get keepAliveEnabled(): boolean {
    return process.env.KEEP_ALIVE_ENABLED !== 'false';
  },
  get keepAliveUrl(): string {
    return (
      process.env.KEEP_ALIVE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (this.isProduction ? 'https://one1sport-it.onrender.com' : '')
    );
  },
  get keepAliveIntervalMin(): string | undefined {
    return process.env.KEEP_ALIVE_INTERVAL_MIN;
  },
};

/**
 * Chống ngủ (anti-sleep) cho Render Free:
 * Định kỳ mỗi 5–10 phút (mặc định 8 phút) gọi GET /api/v1/health để giữ kết nối ấm,
 * tránh cold-start 15–30s khi nhân viên bắt đầu quét tag kiểm kho.
 */
export function resolveKeepAliveIntervalMs(rawMinutes?: string | number): number {
  const parsed = Number(rawMinutes);
  const minutes = Number.isFinite(parsed) && parsed > 0 ? Math.min(10, Math.max(5, parsed)) : 8;
  return Math.round(minutes * 60 * 1000);
}

export function resolveKeepAliveHealthUrl(): string | null {
  if (process.env.KEEP_ALIVE_ENABLED === 'false') return null;
  const rawBase =
    process.env.KEEP_ALIVE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://one1sport-it.onrender.com' : '');
  const base = String(rawBase || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  if (base.endsWith('/api/v1/health') || base.endsWith('/health')) return base;
  if (base.endsWith('/api/v1')) return `${base}/health`;
  return `${base}/api/v1/health`;
}

export async function pingKeepAliveOnce(healthUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'User-Agent': '11Sport-KeepAlive/1.5' },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function startKeepAlive(): ReturnType<typeof setInterval> | null {
  const healthUrl = resolveKeepAliveHealthUrl();
  if (!healthUrl) return null;

  const intervalMs = resolveKeepAliveIntervalMs(process.env.KEEP_ALIVE_INTERVAL_MIN);
  const minutes = Math.round((intervalMs / 60000) * 10) / 10;
  console.log(`[KeepAlive] Tự động đánh thức server mỗi ${minutes} phút -> ${healthUrl}`);

  const timer = setInterval(() => {
    void pingKeepAliveOnce(healthUrl);
  }, intervalMs);

  // Không giữ event loop khi chạy test hoặc tắt tiến trình
  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
  return timer;
}

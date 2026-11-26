import { ApiError } from "../../shared/errors";

export function isTestEnv(): boolean {
  return Boolean(
    process.env.VITEST ||
    process.env.NODE_ENV === 'test' ||
    process.env.FORCE_MEMORY_DB === 'true'
  );
}

export function isLoopbackOrPrivateIp(value: string): boolean {
  const ip = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, '');
  if (!ip) return true;
  if (ip === 'localhost' || ip === '::1' || ip.startsWith('127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
  return false;
}


export function extractClientIp(req: any, bodyIp?: string): string {
  // Bảo mật: trên production tuyệt đối không nhận bodyIp từ client; chỉ cho phép trong unit test
  const allowBodyIp = isTestEnv() && process.env.NODE_ENV !== 'production';
  const cfIp = req.headers['cf-connecting-ip'];
  const trueClientIp = req.headers['true-client-ip'];
  const realIp = req.headers['x-real-ip'];
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    (allowBodyIp && bodyIp && String(bodyIp).trim()) ||
    (typeof cfIp === 'string' ? cfIp.trim() : '') ||
    (typeof trueClientIp === 'string' ? trueClientIp.trim() : '') ||
    (typeof realIp === 'string' ? realIp.trim() : '') ||
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';
  if (raw === '::1' || raw === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return raw.replace(/^::ffff:/, '');
}

/**
 * Khi chạy trên localhost / mạng LAN nội bộ, socket IP chỉ là 127.0.0.1 hoặc 192.168.x.x
 * nên không phản ánh đúng mạng Wi-Fi đang kết nối. Hàm này tự động lấy IP Public (WAN IP)
 * thực tế của kết nối mạng hiện tại để kiểm tra chính xác khi đổi Wi-Fi / phát 4G.
 */

export function sanitizeAllowedIps(rawList: string[]): string[] {
  const cleaned = rawList.map((ip) => ip.trim()).filter(Boolean);
  if (isTestEnv()) {
    return cleaned;
  }
  // Loại bỏ hoàn toàn localhost / 127.0.0.1 / ::1 / 192.168.x.x / 10.x.x.x để bắt buộc khớp đúng IP Public Wi-Fi công ty
  return cleaned.filter((ip) => !isLoopbackOrPrivateIp(ip));
}


export function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) return false;
  const normalized = clientIp.trim().toLowerCase();
  if (!normalized) return false;
  if (!isTestEnv() && isLoopbackOrPrivateIp(normalized)) {
    return false;
  }
  return allowedIps.some((rule) => {
    const cleanRule = String(rule || '').trim().toLowerCase();
    if (!cleanRule) return false;
    if (cleanRule === normalized) return true;
    // Cho phép khớp theo prefix dải IPv4/IPv6 nếu có (VD: "113.22.236." hoặc "2402:800:")
    if ((cleanRule.endsWith('.') || cleanRule.endsWith(':')) && normalized.startsWith(cleanRule)) {
      return true;
    }
    if (cleanRule.endsWith('*') && normalized.startsWith(cleanRule.slice(0, -1))) return true;
    return false;
  });
}

interface AttendanceConfig {
  requireIp: boolean;
  branches: Array<{ name: string; allowedIps: string[] }>;
  [key: string]: any;
}

/**
 * Kiểm tra IP mạng của nhân viên thuộc Mạng Cơ sở 1 hoặc Mạng Cơ sở 2.
 * (Đã loại bỏ hoàn toàn kiểm tra tọa độ GPS do sai số thiết bị).
 */
export function verifyBranchNetwork(
  detectedIp: string,
  config: AttendanceConfig
) {
  if (!config.requireIp) {
    return config.branches[0];
  }

  const matched = config.branches.find((branch) =>
    isIpAllowed(detectedIp, branch.allowedIps || [])
  );
  if (matched) {
    return matched;
  }

  throw new ApiError(
    400,
    'WIFI_IP_NOT_ALLOWED',
    `IP mạng hiện tại (${detectedIp}) không thuộc mạng Wi-Fi công ty (Cơ sở 1 hoặc Cơ sở 2). Vui lòng kết nối đúng Wi-Fi công ty để chấm công!`
  );
}

export function getTodayString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/v1/attendance/check-in

// POST /api/v1/attendance/check-out

// GET /api/v1/attendance/today

// GET /api/v1/attendance/history

// GET /api/v1/attendance/config (Đọc từ DB nếu có, fallback từ .env)

// PUT /api/v1/attendance/config (Role HR, ADMIN, CEO cấu hình IP cả 2 cơ sở)


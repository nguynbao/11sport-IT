import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { promises as dnsPromises } from "dns";
import { attendanceConfigRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { verifyToken } from "../../shared/auth";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";
import {
  extractClientIp,
  isIpAllowed,
  isLoopbackOrPrivateIp,
  isTestEnv,
  sanitizeAllowedIps,
} from "./attendance.rules";

// DNS & Public WAN IP cache – tự động resolve DDNS (cả IPv4 + IPv6) & cache WAN IP
// ---------------------------------------------------------------------------
const _dnsCache: Record<string, { ips: string[]; expiresAt: number }> = {};
const DNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
let _wanIpCache: { ip: string; expiresAt: number } | null = null;
const WAN_IP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

async function resolveDomainAllIps(domain: string): Promise<string[]> {
  const now = Date.now();
  const cached = _dnsCache[domain];
  if (cached && cached.expiresAt > now) {
    return cached.ips;
  }
  const found: string[] = [];
  try {
    const [v4, v6] = await Promise.all([
      dnsPromises.resolve4(domain).catch(() => [] as string[]),
      dnsPromises.resolve6(domain).catch(() => [] as string[]),
    ]);
    for (const ip of [...v4, ...v6]) {
      const clean = String(ip || '').trim();
      if (clean && !found.includes(clean)) found.push(clean);
    }
    if (found.length === 0) {
      const looked = await dnsPromises.lookup(domain, { all: true }).catch(() => [] as any[]);
      for (const item of looked) {
        const clean = String(item?.address || '').trim();
        if (clean && !found.includes(clean)) found.push(clean);
      }
    }
    if (found.length > 0) {
      _dnsCache[domain] = { ips: found, expiresAt: now + DNS_CACHE_TTL_MS };
      return found;
    }
  } catch (err) {
    console.error(`[DDNS] Lỗi resolve domain "${domain}":`, err);
  }
  if (cached) return cached.ips;
  return [];
}


function readAttendanceEnv(): Record<string, string | undefined> {
  if (isTestEnv()) {
    return process.env;
  }
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envFile of candidates) {
    try {
      if (fs.existsSync(envFile)) {
        const parsed = dotenv.parse(fs.readFileSync(envFile, 'utf8'));
        return { ...process.env, ...parsed };
      }
    } catch {
      // ignore read errors and fallback to process.env
    }
  }
  return process.env;
}


async function fetchCurrentPublicWanIp(): Promise<string | null> {
  const now = Date.now();
  if (_wanIpCache && _wanIpCache.expiresAt > now) {
    return _wanIpCache.ip;
  }

  const endpoints = [
    'https://api.ipify.org',
    'https://checkip.amazonaws.com',
    'https://icanhazip.com',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const ip = (await res.text()).trim();
      if (ip && ip.length <= 64 && !isLoopbackOrPrivateIp(ip)) {
        _wanIpCache = { ip, expiresAt: now + WAN_IP_CACHE_TTL_MS };
        return ip;
      }
    } catch {
      // thử endpoint tiếp theo
    }
  }
  return _wanIpCache?.ip || null;
}

export async function resolveEffectiveClientIp(req: any, bodyIp?: string): Promise<string> {
  const rawIp = extractClientIp(req, bodyIp);
  if (isTestEnv()) {
    return rawIp;
  }
  if (!isLoopbackOrPrivateIp(rawIp)) {
    return rawIp;
  }
  const publicWanIp = await fetchCurrentPublicWanIp();
  return publicWanIp || rawIp;
}


async function resolveDomains(domainCsv: string): Promise<string[]> {
  const domains = String(domainCsv || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  const resolvedIps: string[] = [];
  for (const domain of domains) {
    const ips = await resolveDomainAllIps(domain);
    for (const ip of ips) {
      if (ip && !resolvedIps.includes(ip)) {
        resolvedIps.push(ip);
      }
    }
  }
  return resolvedIps;
}

async function getEnvAttendanceConfig() {
  const env = readAttendanceEnv();

  // --- Cơ sở 1 (Mạng Wi-Fi 1) ---
  const officeName =
    env.ATTENDANCE_OFFICE_NAME ||
    env.ATTENDANCE_OFFICE_1_NAME ||
    'Cơ sở 1: Showroom 11Sport - 24 Tố Hữu, Hoà Cường, Đà Nẵng';

  const rawAllowedIps = (
    env.ATTENDANCE_ALLOWED_IPS ||
    env.ATTENDANCE_OFFICE_1_ALLOWED_IPS ||
    (isTestEnv() ? '127.0.0.1,::1,localhost,192.168.1.' : '113.22.236.87,113.22.236.6')
  ).split(',');
  let allowedIps = sanitizeAllowedIps(rawAllowedIps);

  const office1Domain =
    env.ATTENDANCE_OFFICE_1_DOMAIN ||
    env.ATTENDANCE_DDNS_DOMAIN ||
    (isTestEnv() ? '' : '11sport2.myddns.me');
  if (office1Domain && !isTestEnv()) {
    const resolvedList = await resolveDomains(office1Domain);
    if (resolvedList.length > 0) {
      allowedIps = Array.from(new Set([...resolvedList, ...allowedIps]));
    }
  }

  // --- Cơ sở 2 (Mạng Wi-Fi 2) ---
  const office2Name =
    env.ATTENDANCE_OFFICE_2_NAME ||
    'Cơ sở 2: Văn phòng 11Sport - 89 Lê Thanh Nghị, Hòa Cường, Đà Nẵng';

  const rawAllowedIps2 = (
    env.ATTENDANCE_ALLOWED_IPS_2 ||
    env.ATTENDANCE_OFFICE_2_ALLOWED_IPS ||
    (isTestEnv()
      ? '116.110.151.140,192.168.2.,127.0.0.1,::1,localhost'
      : '171.231.188.171,116.110.151.140')
  ).split(',');
  let allowedIps2 = sanitizeAllowedIps(rawAllowedIps2);

  const office2Domain =
    env.ATTENDANCE_OFFICE_2_DOMAIN ||
    (isTestEnv() ? '' : '11sport.myddns.me');
  if (office2Domain && !isTestEnv()) {
    const resolvedList2 = await resolveDomains(office2Domain);
    if (resolvedList2.length > 0) {
      allowedIps2 = Array.from(new Set([...resolvedList2, ...allowedIps2]));
    }
  }

  // Luôn bật kiểm tra IP mạng trên Dev & Production (chỉ cho phép tắt trong unit test nếu test cấu hình rõ)
  const requireIp = isTestEnv() ? env.ATTENDANCE_REQUIRE_IP !== 'false' : true;

  const branches = [
    {
      id: 1,
      name: officeName,
      allowedIps,
      domain: office1Domain || '',
    },
    {
      id: 2,
      name: office2Name,
      allowedIps: allowedIps2,
      domain: office2Domain || '',
    },
  ];

  return {
    officeName,
    allowedIps,
    office2Name,
    allowedIps2,
    office1Domain,
    office2Domain,
    requireGps: false,
    requireIp,
    branches,
  };
}

/**
 * Lấy cấu hình chấm công kết hợp: ưu tiên bản ghi do HR / Admin / CEO cấu hình trong Database,
 * và tự động fallback về biến môi trường .env nếu hệ thống chưa có cấu hình trong DB.
 */
export async function getEffectiveAttendanceConfig() {
  const envConfig = await getEnvAttendanceConfig();
  const dbDoc = await attendanceConfigRepo.findOne({ key: 'DEFAULT' });

  if (!dbDoc) {
    return envConfig;
  }

  const officeName = dbDoc.officeName || envConfig.officeName;
  const office2Name = dbDoc.office2Name || envConfig.office2Name;

  let allowedIps = Array.isArray(dbDoc.allowedIps)
    ? sanitizeAllowedIps(dbDoc.allowedIps)
    : envConfig.allowedIps;

  const office1Domain =
    typeof dbDoc.office1Domain === 'string' && dbDoc.office1Domain.trim()
      ? dbDoc.office1Domain.trim()
      : allowedIps.length === 0
        ? (readAttendanceEnv().ATTENDANCE_OFFICE_1_DOMAIN ||
          readAttendanceEnv().ATTENDANCE_DDNS_DOMAIN ||
          (isTestEnv() ? '' : '11sport2.myddns.me'))
        : '';
  if (office1Domain && !isTestEnv()) {
    const resolvedList = await resolveDomains(office1Domain);
    if (resolvedList.length > 0) {
      allowedIps = Array.from(new Set([...resolvedList, ...allowedIps]));
    }
  }

  let allowedIps2 = Array.isArray(dbDoc.allowedIps2)
    ? sanitizeAllowedIps(dbDoc.allowedIps2)
    : envConfig.allowedIps2;

  const office2Domain =
    typeof dbDoc.office2Domain === 'string' && dbDoc.office2Domain.trim()
      ? dbDoc.office2Domain.trim()
      : allowedIps2.length === 0
        ? (readAttendanceEnv().ATTENDANCE_OFFICE_2_DOMAIN ||
          (isTestEnv() ? '' : '11sport.myddns.me'))
        : '';
  if (office2Domain && !isTestEnv()) {
    const resolvedList2 = await resolveDomains(office2Domain);
    if (resolvedList2.length > 0) {
      allowedIps2 = Array.from(new Set([...resolvedList2, ...allowedIps2]));
    }
  }

  let requireIp = typeof dbDoc.requireIp === 'boolean' ? dbDoc.requireIp : envConfig.requireIp;
  if (isTestEnv() && process.env.ATTENDANCE_REQUIRE_IP !== undefined) {
    requireIp = process.env.ATTENDANCE_REQUIRE_IP !== 'false';
  }

  const branches = [
    {
      id: 1,
      name: officeName,
      allowedIps,
      domain: office1Domain || '',
    },
    {
      id: 2,
      name: office2Name,
      allowedIps: allowedIps2,
      domain: office2Domain || '',
    },
  ];

  return {
    _id: (dbDoc as any)._id,
    key: dbDoc.key,
    officeName,
    allowedIps,
    office2Name,
    allowedIps2,
    office1Domain,
    office2Domain,
    requireGps: false,
    requireIp,
    branches,
    updatedBy: dbDoc.updatedBy || '',
    updatedAt: dbDoc.updatedAt,
  };
}


export async function getAttendanceConfig(ctx: ServiceContext): Promise<ServiceResult> {
  const config = await getEffectiveAttendanceConfig();
    const detectedClientIp = await resolveEffectiveClientIp(ctx);
    const isCurrentIpAllowed =
      !config.requireIp ||
      config.branches.some((branch) => isIpAllowed(detectedClientIp, branch.allowedIps || []));
    return ok({
        config,
        detectedClientIp,
        isCurrentIpAllowed,
      }, {});
}

export async function updateAttendanceConfig(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const authHeader = ctx.headers?.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const user = bearerToken ? verifyToken(bearerToken) : null;
    if (!user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để cấu hình IP chấm công');
    }
    if (!['CEO', 'ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ HR, Quản trị viên (ADMIN) hoặc CEO mới có quyền cấu hình IP chấm công'
      );
    }

    const {
      officeName,
      office2Name,
      allowedIps,
      allowedIps2,
      office1Domain,
      office2Domain,
      requireIp,
    } = body || {};

    const parseIps = (val: any): string[] => {
      if (Array.isArray(val)) {
        return val.map((x) => String(x || '').trim()).filter(Boolean);
      }
      if (typeof val === 'string') {
        return val
          .split(/[\n,]+/)
          .map((x) => x.trim())
          .filter(Boolean);
      }
      return [];
    };

    const updateData: any = {
      updatedBy: user.fullName || user.username || user.userId,
    };

    if (officeName !== undefined) updateData.officeName = String(officeName).trim();
    if (office2Name !== undefined) updateData.office2Name = String(office2Name).trim();
    if (allowedIps !== undefined) updateData.allowedIps = parseIps(allowedIps);
    if (allowedIps2 !== undefined) updateData.allowedIps2 = parseIps(allowedIps2);
    if (office1Domain !== undefined) updateData.office1Domain = String(office1Domain).trim();
    if (office2Domain !== undefined) updateData.office2Domain = String(office2Domain).trim();
    if (typeof requireIp === 'boolean') updateData.requireIp = requireIp;

    const existing = await attendanceConfigRepo.findOne({ key: 'DEFAULT' });
    if (existing) {
      await attendanceConfigRepo.updateById(existing._id, updateData);
    } else {
      const envConfig = await getEnvAttendanceConfig();
      await attendanceConfigRepo.create({
        key: 'DEFAULT',
        officeName: updateData.officeName || envConfig.officeName,
        office2Name: updateData.office2Name || envConfig.office2Name,
        allowedIps:
          updateData.allowedIps !== undefined
            ? updateData.allowedIps
            : envConfig.allowedIps,
        allowedIps2:
          updateData.allowedIps2 !== undefined
            ? updateData.allowedIps2
            : envConfig.allowedIps2,
        office1Domain: updateData.office1Domain !== undefined ? updateData.office1Domain : '',
        office2Domain: updateData.office2Domain !== undefined ? updateData.office2Domain : '',
        requireGps: false,
        requireIp:
          typeof updateData.requireIp === 'boolean'
            ? updateData.requireIp
            : envConfig.requireIp,
        updatedBy: updateData.updatedBy,
      });
    }

    const config = await getEffectiveAttendanceConfig();
    const detectedClientIp = await resolveEffectiveClientIp(ctx);
    const isCurrentIpAllowed =
      !config.requireIp ||
      config.branches.some((branch) => isIpAllowed(detectedClientIp, branch.allowedIps || []));

    return ok({
        config,
        detectedClientIp,
        isCurrentIpAllowed,
        message: 'Cập nhật cấu hình IP chấm công thành công',
      }, {});
}


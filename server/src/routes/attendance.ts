import { Router, Request } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  attendanceRepo,
  attendanceConfigRepo,
  leaveRequestRepo,
  shiftAssignmentRepo,
  shiftHandoverRepo,
  staffRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { ShiftCode } from '../models/Attendance';
import { getLateToleranceMinutes } from './attendanceTimesheet';
import {
  expireStalePendingHandovers,
  isSalesStaffUser,
  resolvePendingIncomingHandoverForSales,
} from './shifts';

export const attendanceRouter = Router();

function isTestEnv(): boolean {
  return Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === 'test' ||
      process.env.FORCE_MEMORY_DB === 'true'
  );
}

function isLoopbackOrPrivateIp(value: string): boolean {
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

function extractClientIp(req: Request, bodyIp?: string): string {
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
async function fetchCurrentPublicWanIp(): Promise<string | null> {
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
        return ip;
      }
    } catch {
      // thử endpoint tiếp theo
    }
  }
  return null;
}

async function resolveEffectiveClientIp(req: Request, bodyIp?: string): Promise<string> {
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

function sanitizeAllowedIps(rawList: string[]): string[] {
  const cleaned = rawList.map((ip) => ip.trim()).filter(Boolean);
  if (isTestEnv()) {
    return cleaned;
  }
  // Loại bỏ hoàn toàn localhost / 127.0.0.1 / ::1 / 192.168.x.x / 10.x.x.x để bắt buộc khớp đúng IP Public Wi-Fi công ty
  return cleaned.filter((ip) => !isLoopbackOrPrivateIp(ip));
}

function getEnvAttendanceConfig() {
  const env = readAttendanceEnv();

  // --- Cơ sở 1 (Mạng Wi-Fi 1) ---
  const officeName =
    env.ATTENDANCE_OFFICE_NAME ||
    env.ATTENDANCE_OFFICE_1_NAME ||
    'Cơ sở 1: Showroom 11Sport - 24 Tố Hữu, Hoà Cường, Đà Nẵng';
  const rawAllowedIps = (
    env.ATTENDANCE_ALLOWED_IPS ||
    env.ATTENDANCE_OFFICE_1_ALLOWED_IPS ||
    (isTestEnv() ? '127.0.0.1,::1,localhost,192.168.1.' : '113.22.236.6')
  ).split(',');
  const allowedIps = sanitizeAllowedIps(rawAllowedIps);

  // --- Cơ sở 2 (Mạng Wi-Fi 2) ---
  const office2Name =
    env.ATTENDANCE_OFFICE_2_NAME ||
    'Cơ sở 2: Văn phòng 11Sport - 89 Lê Thanh Nghị, Hòa Cường, Đà Nẵng';
  const rawAllowedIps2 = (
    env.ATTENDANCE_ALLOWED_IPS_2 ||
    env.ATTENDANCE_OFFICE_2_ALLOWED_IPS ||
    (isTestEnv() ? '116.110.151.140,192.168.2.,127.0.0.1,::1,localhost' : '116.110.151.140')
  ).split(',');
  const allowedIps2 = sanitizeAllowedIps(rawAllowedIps2);

  // Luôn bật kiểm tra IP mạng trên Dev & Production (chỉ cho phép tắt trong unit test nếu test cấu hình rõ)
  const requireIp = isTestEnv() ? env.ATTENDANCE_REQUIRE_IP !== 'false' : true;

  const branches = [
    {
      id: 1,
      name: officeName,
      allowedIps,
    },
    {
      id: 2,
      name: office2Name,
      allowedIps: allowedIps2,
    },
  ];

  return {
    officeName,
    allowedIps,
    office2Name,
    allowedIps2,
    requireGps: false,
    requireIp,
    branches,
  };
}

function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) return false;
  const normalized = clientIp.trim();
  if (!normalized) return false;
  if (!isTestEnv() && isLoopbackOrPrivateIp(normalized)) {
    return false;
  }
  return allowedIps.some((rule) => {
    const cleanRule = String(rule || '').trim();
    if (!cleanRule) return false;
    if (cleanRule === normalized) return true;
    // Cho phép khớp theo prefix dải IP Public nếu có (VD: "113.22.236.")
    if (cleanRule.endsWith('.') && normalized.startsWith(cleanRule)) return true;
    if (cleanRule.endsWith('*') && normalized.startsWith(cleanRule.slice(0, -1))) return true;
    return false;
  });
}

/**
 * Kiểm tra IP mạng của nhân viên thuộc Mạng Cơ sở 1 hoặc Mạng Cơ sở 2.
 * (Đã loại bỏ hoàn toàn kiểm tra tọa độ GPS do sai số thiết bị).
 */
function verifyBranchNetwork(
  detectedIp: string,
  config: ReturnType<typeof getEnvAttendanceConfig>
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

function getTodayString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/v1/attendance/check-in
attendanceRouter.post('/attendance/check-in', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để chấm công');

    const staff = await staffRepo.findById(user.userId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
    if (staff.role === 'ADMIN') {
      throw new ApiError(400, 'ADMIN_NO_ATTENDANCE', 'Tài khoản Quản trị viên (ADMIN) không cần chấm công');
    }

    const todayStr = getTodayString();
    const existing = await attendanceRepo.findOne({ staffId: staff._id, date: todayStr });
    if (existing) {
      throw new ApiError(400, 'ALREADY_CHECKED_IN', 'Hôm nay bạn đã chấm công check-in rồi');
    }

    const { clientIp, shiftCode } = req.body || {};

    // 1. Kiểm tra đơn WFH đã duyệt hôm nay (Áp dụng cho cả khối OFFICE và SALES) — xác minh hoàn toàn phía server
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: staff._id,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });

    const isWfh = Boolean(approvedWfh);
    const config = getEnvAttendanceConfig();
    const detectedIp = await resolveEffectiveClientIp(req, clientIp);

    // 2. Nếu không phải WFH (đã xác minh server-side) -> Kiểm tra IP mạng thuộc Cơ sở 1 hoặc Cơ sở 2
    if (!isWfh) {
      verifyBranchNetwork(detectedIp, config);
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const totalMinutesNow = currentHours * 60 + currentMinutes;

    // 3. Đối chiếu lịch phân ca (ShiftAssignment) trong ngày (nếu HR đã xếp lịch)
    const assignedShift =
      (await shiftAssignmentRepo.findOne({ staffId: String(staff._id), date: todayStr })) ||
      (await shiftAssignmentRepo.findOne({ staffId: staff._id, date: todayStr }));

    if (assignedShift?.shiftCode === 'OFF') {
      throw new ApiError(
        400,
        'SCHEDULED_DAY_OFF',
        'Hôm nay là ngày nghỉ (OFF) theo lịch phân ca của bạn, không thể chấm công vào ca!'
      );
    }

    if (
      assignedShift &&
      (assignedShift.shiftCode === 'SHIFT_1' ||
        assignedShift.shiftCode === 'SHIFT_2' ||
        assignedShift.shiftCode === 'BOTH') &&
      shiftCode &&
      (shiftCode === 'SHIFT_1' || shiftCode === 'SHIFT_2' || shiftCode === 'BOTH') &&
      shiftCode !== assignedShift.shiftCode
    ) {
      const assignedLabel =
        assignedShift.shiftCode === 'BOTH'
          ? 'Ca 1 + Ca 2 (08:30 - 21:00)'
          : assignedShift.shiftCode === 'SHIFT_2'
            ? 'Ca 2 (12:00 - 21:00)'
            : 'Ca 1 (08:30 - 17:30)';
      throw new ApiError(
        400,
        'SHIFT_MISMATCH',
        `Hôm nay bạn được phân công ${assignedLabel}, không thể chấm công vào ca khác!`
      );
    }

    // Quy định giờ các ca:
    // Ca 1 (SHIFT_1): 08:30 (510 phút) -> 17:30 (1050 phút)
    // Ca 2 (SHIFT_2): 12:00 (720 phút) -> 21:00 (1260 phút)
    // Ca 1 + Ca 2 (BOTH): 08:30 (510 phút) -> 21:00 (1260 phút)
    // Ưu tiên lấy theo lịch phân ca đã lưu; chỉ khi chưa xếp ca mới tự nhận diện theo shiftCode hoặc giờ hiện tại
    const isSalesStaff = staff.department === 'SALES' || staff.role === 'SALES';
    const effectiveDepartment = isSalesStaff ? 'SALES' : staff.department || 'OFFICE';
    const selectedShift: ShiftCode =
      assignedShift &&
      (assignedShift.shiftCode === 'SHIFT_1' ||
        assignedShift.shiftCode === 'SHIFT_2' ||
        assignedShift.shiftCode === 'BOTH')
        ? assignedShift.shiftCode
        : !isSalesStaff
          ? 'SHIFT_1'
          : shiftCode === 'SHIFT_1' || shiftCode === 'SHIFT_2' || shiftCode === 'BOTH'
            ? shiftCode
            : totalMinutesNow >= 11 * 60 + 30
              ? 'SHIFT_2'
              : 'SHIFT_1';
    const shiftStartMinutes = selectedShift === 'SHIFT_2' ? 12 * 60 : 8 * 60 + 30;
    const lateToleranceMinutes = getLateToleranceMinutes(effectiveDepartment);

    let lateMinutes = 0;
    let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
    const workStartTime = new Date(now);

    if (totalMinutesNow <= shiftStartMinutes) {
      // Check-in sớm hoặc đúng giờ bắt đầu ca: Quy mốc tính công về đúng giờ bắt đầu ca
      const [targetH, targetM] = selectedShift === 'SHIFT_2' ? [12, 0] : [8, 30];
      workStartTime.setHours(targetH, targetM, 0, 0);
    } else {
      // Đi trễ: Khối Bán hàng không có du di (0p); Khối Văn phòng du di 5p
      const diffLate = totalMinutesNow - shiftStartMinutes;
      if (diffLate > lateToleranceMinutes) {
        status = 'LATE';
        lateMinutes = diffLate;
      }
    }

    const attendance = await attendanceRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department: effectiveDepartment,
      date: todayStr,
      shiftCode: selectedShift,
      checkInTime: now,
      workStartTime,
      checkInType: isWfh ? 'WFH' : 'STANDARD',
      clientIp: detectedIp,
      status,
      lateMinutes,
      earlyMinutes: 0,
      lunchPauseMinutes: 0,
      totalWorkHours: 0,
    });

    res.status(201).json({
      data: {
        attendance,
        isWfh,
        message: status === 'LATE' ? `Đi trễ ${lateMinutes} phút` : 'Chấm công vào ca thành công',
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/attendance/check-out
attendanceRouter.post('/attendance/check-out', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const todayStr = getTodayString();
    const attendance = await attendanceRepo.findOne({ staffId: user.userId, date: todayStr });
    if (!attendance) {
      throw new ApiError(400, 'NOT_CHECKED_IN', 'Hôm nay bạn chưa bấm check-in vào ca');
    }
    if (attendance.checkOutTime) {
      throw new ApiError(400, 'ALREADY_CHECKED_OUT', 'Bạn đã bấm check-out hôm nay rồi');
    }

    const {
      forceEarly = false,
      earlyReason = '',
      lateCheckoutReason = '',
      clientIp,
    } = req.body || {};

    // Kiểm tra IP mạng (Cơ sở 1 hoặc Cơ sở 2) nếu không phải ca WFH (xác minh server-side)
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });
    const isWfh = attendance.checkInType === 'WFH' || Boolean(approvedWfh);
    if (!isWfh) {
      const config = getEnvAttendanceConfig();
      const detectedIp = await resolveEffectiveClientIp(req, clientIp);
      verifyBranchNetwork(detectedIp, config);
    }

    const assignedShift =
      (await shiftAssignmentRepo.findOne({ staffId: String(user.userId), date: todayStr })) ||
      (await shiftAssignmentRepo.findOne({ staffId: user.userId, date: todayStr }));

    const effectiveShiftCode: ShiftCode =
      assignedShift &&
      (assignedShift.shiftCode === 'SHIFT_1' ||
        assignedShift.shiftCode === 'SHIFT_2' ||
        assignedShift.shiftCode === 'BOTH')
        ? assignedShift.shiftCode
        : attendance.shiftCode;

    // 1. Kiểm tra bàn giao ca cho nhân viên SALES khi bấm Check-out (bỏ qua nếu hôm nay làm việc từ xa WFH)
    let matchedHandover: any = null;
    if (attendance.department === 'SALES' && !isWfh) {
      const utcTodayStr = new Date().toISOString().slice(0, 10);
      const todayCandidates = new Set([todayStr, utcTodayStr]);
      const allHandovers = await expireStalePendingHandovers(todayStr);

      // Bắt buộc xác nhận đúng phiếu bàn giao ca đang chờ của ca liền trước (khớp ca/người nhận, không lấy phiếu cũ quá hạn)
      const pendingIncoming = resolvePendingIncomingHandoverForSales({
        allHandovers,
        userId: String(user.userId),
        todayLocal: todayStr,
        receivingShiftCode: effectiveShiftCode,
      });

      if (pendingIncoming) {
        const isFromPrevDay = !todayCandidates.has(String(pendingIncoming.date));
        throw new ApiError(
          400,
          'INCOMING_HANDOVER_CONFIRM_REQUIRED',
          isFromPrevDay
            ? `Bạn chưa xác nhận phiếu bàn giao ca tối ngày ${pendingIncoming.date} từ ${pendingIncoming.fromStaffName}. Vui lòng xác nhận thông tin bàn giao trước khi kết ca!`
            : `Bạn chưa xác nhận phiếu bàn giao ca từ ${pendingIncoming.fromStaffName}. Vui lòng xác nhận thông tin bàn giao trước khi kết ca!`,
          { pendingHandoverId: String(pendingIncoming._id) }
        );
      }

      matchedHandover = (allHandovers as any[]).find(
        (h) =>
          h.status !== 'DRAFT' &&
          todayCandidates.has(String(h.date)) &&
          String(h.fromStaffId) === String(user.userId) &&
          (h.shiftCode === effectiveShiftCode || h.shiftCode === attendance.shiftCode)
      );

      if (!matchedHandover) {
        throw new ApiError(
          400,
          'HANDOVER_REQUIRED',
          'Vui lòng xác nhận gửi biên bản bàn giao Kho Tầng 1 trước khi Check-out kết ca!'
        );
      }
    }

    const approvedEarly = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'EARLY',
      status: 'APPROVED',
    });

    const now = new Date();
    // Tính giờ Check-out theo đúng thời điểm nhân viên bấm xác nhận gửi bàn giao ca (nếu đã gửi phiếu trước đó)
    // Cho dù nhân viên ca sau đếm lại trễ 15 phút thì giờ của người bấm gửi vẫn giữ nguyên
    const effectiveOutTime = attendance.pendingCheckOutTime
      ? new Date(attendance.pendingCheckOutTime)
      : matchedHandover?.submittedAt
        ? new Date(matchedHandover.submittedAt)
        : now;

    const currentHours = effectiveOutTime.getHours();
    const currentMinutes = effectiveOutTime.getMinutes();
    const totalMinutesNow = currentHours * 60 + currentMinutes;

    // Giờ kết thúc ca:
    // Ca 1 (SHIFT_1): 17:30 (1050 phút)
    // Ca 2 (SHIFT_2) & Ca 1 + Ca 2 (BOTH): 21:00 (1260 phút)
    const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
    let earlyMinutes = 0;
    let lateCheckoutMinutes = 0;
    let overtimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
      (attendance as any).overtimeStatus || 'NONE';
    let overtimeApprovedMinutes = Number((attendance as any).overtimeApprovedMinutes || 0);
    let cleanLateCheckoutReason = String(
      lateCheckoutReason || attendance.lateCheckoutReason || matchedHandover?.lateCheckoutReason || ''
    ).trim();

    if (totalMinutesNow < shiftEndMinutes) {
      earlyMinutes = shiftEndMinutes - totalMinutesNow;
      if (!forceEarly && !approvedEarly) {
        throw new ApiError(
          400,
          'EARLY_LEAVE_WARNING',
          `Chưa đủ giờ kết thúc ca (còn ${earlyMinutes} phút). Chưa thể Check-out!`,
          { earlyMinutes: String(earlyMinutes) }
        );
      }
    } else if (totalMinutesNow > shiftEndMinutes) {
      const diffLateOut = totalMinutesNow - shiftEndMinutes;
      if (attendance.department === 'SALES') {
        if (effectiveShiftCode === 'BOTH') {
          // Làm 2 ca (BOTH) là ca đã ghi trong bảng xếp ca -> không tính là tăng ca
          lateCheckoutMinutes = 0;
          overtimeStatus = 'NONE';
          overtimeApprovedMinutes = 0;
          cleanLateCheckoutReason = '';
        } else {
          // Nhân viên Bán hàng làm 1 ca (SHIFT_1 hoặc SHIFT_2):
          // Check-out trễ tối đa 5 phút; nếu sau 5 phút phải nhập lý do để HR xem xét có tính tăng ca hay không
          if (diffLateOut > 5) {
            if (!cleanLateCheckoutReason) {
              throw new ApiError(
                400,
                'LATE_CHECKOUT_REASON_REQUIRED',
                `Bạn đang check-out trễ ${diffLateOut} phút (quá 5 phút sau giờ kết thúc ca). Vui lòng nhập lý do check-out trễ để HR xem xét!`,
                { lateCheckoutMinutes: String(diffLateOut) }
              );
            }
            lateCheckoutMinutes = diffLateOut;
            if (overtimeStatus !== 'APPROVED') {
              overtimeStatus = 'PENDING';
              overtimeApprovedMinutes = 0;
            }
          } else {
            lateCheckoutMinutes = 0;
            overtimeStatus = 'NONE';
            overtimeApprovedMinutes = 0;
            cleanLateCheckoutReason = '';
          }
        }
      } else {
        // Khối Văn phòng (OFFICE): phải được HR yêu cầu (overtimeStatus === 'APPROVED') thì mới có tăng ca
        if (overtimeStatus === 'APPROVED') {
          overtimeApprovedMinutes = overtimeApprovedMinutes > 0 ? overtimeApprovedMinutes : diffLateOut;
        } else {
          overtimeStatus = 'NONE';
          overtimeApprovedMinutes = 0;
        }
      }
    }

    // Nếu là Ca 1 (SHIFT_1) vừa gửi bàn giao sang Ca 2 và đang chờ Ca 2 xác nhận (khi gọi từ giao diện với requireConfirmation = true):
    // Ghi nhận ngay mốc giờ bấm gửi (pendingCheckOutTime = effectiveOutTime), chỉ hoàn tất checkOutTime khi Ca 2 bấm xác nhận!
    if (
      req.body?.requireConfirmation === true &&
      attendance.department === 'SALES' &&
      !isWfh &&
      effectiveShiftCode === 'SHIFT_1' &&
      matchedHandover &&
      matchedHandover.status === 'PENDING'
    ) {
      const pendingUpdated = await attendanceRepo.updateById(attendance._id, {
        shiftCode: effectiveShiftCode,
        pendingCheckOutTime: effectiveOutTime,
        earlyMinutes,
        lateCheckoutMinutes,
        lateCheckoutReason: cleanLateCheckoutReason,
        overtimeStatus,
        overtimeApprovedMinutes,
      });

      res.json({
        data: {
          attendance: pendingUpdated,
          awaitingHandoverConfirm: true,
          waitingConfirmation: true,
          message:
            'Đã chốt giờ ra ca lúc gửi bàn giao! Khi nhân viên Ca 2 xác nhận, bạn sẽ được hoàn tất Check-out (giờ ra ca vẫn tính đúng lúc bạn bấm gửi).',
        },
        meta: {},
      });
      return;
    }

    // 2. Tính toán tổng giờ làm việc thực tế (tính đến đúng thời điểm bấm xác nhận gửi bàn giao effectiveOutTime)
    const startMs = new Date(attendance.workStartTime).getTime();
    const endMs = effectiveOutTime.getTime();
    let rawHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));

    // 3. Tự động trừ giờ nghỉ trưa (12:00 - 13:00 = 1 giờ; sáng 08:30-12:00, chiều 13:00-17:30) cho khối OFFICE
    let lunchPauseMinutes = 0;
    if (attendance.department === 'OFFICE' && effectiveShiftCode === 'SHIFT_1') {
      lunchPauseMinutes = 60; // 1 tiếng
      rawHours = Math.max(0, rawHours - 1);
    }

    const finalStatus = earlyMinutes > 0 ? 'EARLY_LEAVE' : 'COMPLETED';
    const noteParts: string[] = [];
    if (earlyReason) noteParts.push(`Lý do về sớm: ${earlyReason}`);
    if (cleanLateCheckoutReason) noteParts.push(`Lý do check-out trễ (${lateCheckoutMinutes}p): ${cleanLateCheckoutReason}`);

    const updated = await attendanceRepo.updateById(attendance._id, {
      shiftCode: effectiveShiftCode,
      checkOutTime: effectiveOutTime,
      pendingCheckOutTime: effectiveOutTime,
      earlyMinutes,
      lateCheckoutMinutes,
      lateCheckoutReason: cleanLateCheckoutReason,
      overtimeStatus,
      overtimeApprovedMinutes,
      lunchPauseMinutes,
      totalWorkHours: Number(rawHours.toFixed(2)),
      status: finalStatus,
      notes: noteParts.length > 0 ? noteParts.join(' | ') : attendance.notes || '',
    });

    res.json({
      data: {
        attendance: updated,
        message: 'Hoàn tất Check-out ra ca',
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/today
attendanceRouter.get('/attendance/today', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const todayStr = getTodayString();
    const attendance = await attendanceRepo.findOne({ staffId: user.userId, date: todayStr });

    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });

    const approvedEarly = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'EARLY',
      status: 'APPROVED',
    });

    const assignedShift =
      (await shiftAssignmentRepo.findOne({ staffId: String(user.userId), date: todayStr })) ||
      (await shiftAssignmentRepo.findOne({ staffId: user.userId, date: todayStr }));

    const utcTodayStr = new Date().toISOString().slice(0, 10);
    const todayCandidates = new Set([todayStr, utcTodayStr]);
    const isSales = isSalesStaffUser(user) || attendance?.department === 'SALES';
    const allHandovers = isSales ? await expireStalePendingHandovers(todayStr) : [];

    const activeShiftCode: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | null = attendance
      ? attendance.shiftCode
      : assignedShift && assignedShift.shiftCode !== 'OFF'
        ? assignedShift.shiftCode
        : null;

    const targetShiftCode = activeShiftCode || 'SHIFT_1';

    const handover = isSales
      ? (allHandovers as any[]).find(
          (h) =>
            todayCandidates.has(String(h.date)) &&
            String(h.fromStaffId) === String(user.userId) &&
            h.shiftCode === targetShiftCode
        )
      : null;

    const pendingIncomingHandover = isSales
      ? resolvePendingIncomingHandoverForSales({
          allHandovers,
          userId: String(user.userId),
          todayLocal: todayStr,
          receivingShiftCode: activeShiftCode,
        })
      : null;

    res.json({
      data: {
        date: todayStr,
        attendance: attendance || null,
        assignedShift: assignedShift ? assignedShift.shiftCode : null,
        isWfhToday: Boolean(approvedWfh),
        isEarlyApprovedToday: Boolean(approvedEarly),
        handoverStatus: handover ? handover.status : null,
        currentShiftHandover: handover || null,
        pendingIncomingHandover,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/history
attendanceRouter.get('/attendance/history', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { staffId, month, year } = req.query;

    const filter: Record<string, any> = {};
    if (['ADMIN', 'HR'].includes(user.role)) {
      if (staffId) filter.staffId = String(staffId);
    } else {
      filter.staffId = user.userId;
    }

    let records = await attendanceRepo.find(filter);
    // Lọc theo tháng/năm nếu có truyền (date dạng YYYY-MM-DD)
    if (year || month) {
      const y = Number(year) || new Date().getFullYear();
      const prefix = month ? `${y}-${String(Number(month)).padStart(2, '0')}-` : `${y}-`;
      records = records.filter((r: any) => String(r.date || '').startsWith(prefix));
    }
    records.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    res.json({
      data: records,
      meta: { total: records.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/config (Chỉ đọc từ biến môi trường .env)
attendanceRouter.get('/attendance/config', async (req, res, next) => {
  try {
    const config = getEnvAttendanceConfig();
    const detectedClientIp = await resolveEffectiveClientIp(req);
    const isCurrentIpAllowed =
      !config.requireIp ||
      config.branches.some((branch) => isIpAllowed(detectedClientIp, branch.allowedIps || []));
    res.json({
      data: {
        config,
        detectedClientIp,
        isCurrentIpAllowed,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/attendance/config -> Chặn hoàn toàn vì chỉ cho phép cấu hình trong file .env
attendanceRouter.put('/attendance/config', async (_req, _res, next) => {
  next(
    new ApiError(
      403,
      'CONFIG_MANAGED_BY_ENV',
      'Cấu hình IP Wi-Fi chấm công chỉ được thiết lập trong file .env của Server, không cho phép chỉnh sửa trên hệ thống'
    )
  );
});

import { Router, Request } from 'express';
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

export const attendanceRouter = Router();

// Tọa độ mặc định Cơ sở 1 & Cơ sở 2 11Sport
const DEFAULT_SHOWROOM_LAT = 16.0352;
const DEFAULT_SHOWROOM_LNG = 108.2185;
const DEFAULT_SHOWROOM_2_LAT = 16.0678;
const DEFAULT_SHOWROOM_2_LNG = 108.2208;
const DEFAULT_MAX_DISTANCE_METERS = 50;

function extractClientIp(req: Request, bodyIp?: string): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    (bodyIp && String(bodyIp).trim()) ||
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';
  if (raw === '::1' || raw === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return raw.replace(/^::ffff:/, '');
}

function getEnvAttendanceConfig() {
  // --- Cơ sở 1 (Location 1 + Mạng 1) ---
  const officeName =
    process.env.ATTENDANCE_OFFICE_NAME ||
    process.env.ATTENDANCE_OFFICE_1_NAME ||
    'Cơ sở 1: Showroom & Văn phòng 11Sport - 24 Tố Hữu, Đà Nẵng';
  const officeLat = Number(
    process.env.ATTENDANCE_OFFICE_LAT ??
      process.env.ATTENDANCE_OFFICE_1_LAT ??
      DEFAULT_SHOWROOM_LAT
  );
  const officeLng = Number(
    process.env.ATTENDANCE_OFFICE_LNG ??
      process.env.ATTENDANCE_OFFICE_1_LNG ??
      DEFAULT_SHOWROOM_LNG
  );
  const allowedIps = (
    process.env.ATTENDANCE_ALLOWED_IPS ||
    process.env.ATTENDANCE_OFFICE_1_ALLOWED_IPS ||
    '127.0.0.1,::1,localhost,192.168.1.'
  )
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  // --- Cơ sở 2 (Location 2 + Mạng 2) ---
  const office2Name =
    process.env.ATTENDANCE_OFFICE_2_NAME ||
    'Cơ sở 2: Chi nhánh 11Sport Cơ sở 2';
  const office2Lat = Number(
    process.env.ATTENDANCE_OFFICE_2_LAT ?? DEFAULT_SHOWROOM_2_LAT
  );
  const office2Lng = Number(
    process.env.ATTENDANCE_OFFICE_2_LNG ?? DEFAULT_SHOWROOM_2_LNG
  );
  const allowedIps2 = (
    process.env.ATTENDANCE_ALLOWED_IPS_2 ||
    process.env.ATTENDANCE_OFFICE_2_ALLOWED_IPS ||
    '127.0.0.1,::1,localhost,192.168.2.'
  )
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  const maxDistanceMeters = Number(
    process.env.ATTENDANCE_MAX_DISTANCE_METERS ?? DEFAULT_MAX_DISTANCE_METERS
  );
  const requireGps = process.env.ATTENDANCE_REQUIRE_GPS !== 'false';
  const requireIp = process.env.ATTENDANCE_REQUIRE_IP === 'true';

  const branches = [
    {
      id: 1,
      name: officeName,
      lat: officeLat,
      lng: officeLng,
      allowedIps,
    },
    {
      id: 2,
      name: office2Name,
      lat: office2Lat,
      lng: office2Lng,
      allowedIps: allowedIps2,
    },
  ];

  return {
    officeName,
    officeLat,
    officeLng,
    allowedIps,
    office2Name,
    office2Lat,
    office2Lng,
    allowedIps2,
    maxDistanceMeters,
    requireGps,
    requireIp,
    branches,
  };
}

function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;
  const normalized = clientIp.trim();
  return allowedIps.some((rule) => {
    const cleanRule = String(rule || '').trim();
    if (!cleanRule) return false;
    if (cleanRule === normalized) return true;
    // Cho phép khớp theo prefix dải mạng LAN/Wi-Fi (VD: "192.168.1." hoặc "113.160.")
    if (cleanRule.endsWith('.') && normalized.startsWith(cleanRule)) return true;
    if (cleanRule.endsWith('*') && normalized.startsWith(cleanRule.slice(0, -1))) return true;
    return false;
  });
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Kiểm tra cặp (Location 1 + Mạng 1) hoặc (Location 2 + Mạng 2).
 * Nhân viên phải đứng ở Cơ sở 1 và dùng Mạng 1, HOẶC đứng ở Cơ sở 2 và dùng Mạng 2.
 */
function verifyBranchLocationAndNetwork(
  latitude: unknown,
  longitude: unknown,
  detectedIp: string,
  config: ReturnType<typeof getEnvAttendanceConfig>
) {
  const maxDist = Number(config.maxDistanceMeters ?? DEFAULT_MAX_DISTANCE_METERS);

  if (config.requireGps && (latitude === undefined || longitude === undefined || latitude === null || longitude === null)) {
    throw new ApiError(400, 'LOCATION_REQUIRED', 'Vui lòng bật định vị GPS để chấm công');
  }

  const hasCoords = latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null;
  const latNum = Number(latitude);
  const lngNum = Number(longitude);

  const evaluations = config.branches.map((branch) => {
    const dist = hasCoords
      ? calculateDistanceMeters(latNum, lngNum, Number(branch.lat), Number(branch.lng))
      : 0;
    const gpsOk = !config.requireGps || (hasCoords && dist <= maxDist);
    const ipOk = !config.requireIp || isIpAllowed(detectedIp, branch.allowedIps || []);
    return {
      branch,
      dist,
      gpsOk,
      ipOk,
      matchedBoth: gpsOk && ipOk,
    };
  });

  // Thành công nếu khớp trọn vẹn cặp (Location + Mạng) của Cơ sở 1 hoặc Cơ sở 2
  const matched = evaluations.find((e) => e.matchedBoth);
  if (matched) {
    return matched.branch;
  }

  // Nếu có cơ sở khớp GPS nhưng không khớp IP mạng của chính cơ sở đó (VD: đứng ở Location 1 nhưng nối Mạng 2)
  const gpsMatched = evaluations.find((e) => e.gpsOk);
  if (gpsMatched && !gpsMatched.ipOk) {
    throw new ApiError(
      400,
      'WIFI_IP_NOT_ALLOWED',
      `Bạn đang ở ${gpsMatched.branch.name} nhưng IP mạng hiện tại (${detectedIp}) không thuộc mạng Wi-Fi của cơ sở này (Location 1 phải đi với Mạng 1, Location 2 phải đi với Mạng 2)`
    );
  }

  // Không khớp vị trí GPS của cả 2 cơ sở
  throw new ApiError(
    400,
    'LOCATION_OUT_OF_RANGE',
    'Vị trí của bạn không thuộc Cơ sở 1 hay Cơ sở 2 của công ty'
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

    const { latitude, longitude, clientIp, shiftCode, bypassNetwork = false } = req.body || {};

    // 1. Kiểm tra đơn WFH đã duyệt hôm nay (Chỉ dành cho khối OFFICE)
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: staff._id,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });

    const isWfh = Boolean(approvedWfh && staff.department === 'OFFICE');
    const config = getEnvAttendanceConfig();
    const detectedIp = extractClientIp(req, clientIp);

    // 2. Nếu không phải WFH và không bypass -> Kiểm tra cặp (Location 1 + Mạng 1) hoặc (Location 2 + Mạng 2)
    if (!isWfh && !bypassNetwork) {
      verifyBranchLocationAndNetwork(latitude, longitude, detectedIp, config);
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const totalMinutesNow = currentHours * 60 + currentMinutes;

    // Quy định giờ 2 ca:
    // Ca 1 (SHIFT_1): 08:30 (510 phút) -> 17:30 (1050 phút)
    // Ca 2 (SHIFT_2): 12:00 (720 phút) -> 21:00 (1260 phút)
    // Tự động nhận diện ca theo khung giờ Check-in nếu không truyền shiftCode (Sales check-in từ 11:30 trở đi tính là Ca 2)
    const isSalesStaff = staff.department === 'SALES' || staff.role === 'SALES';
    const selectedShift: ShiftCode = !isSalesStaff
      ? 'SHIFT_1'
      : shiftCode === 'SHIFT_1' || shiftCode === 'SHIFT_2'
      ? shiftCode
      : totalMinutesNow >= 11 * 60 + 30
      ? 'SHIFT_2'
      : 'SHIFT_1';
    const shiftStartMinutes = selectedShift === 'SHIFT_1' ? 8 * 60 + 30 : 12 * 60;

    let lateMinutes = 0;
    let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
    const workStartTime = new Date(now);

    if (totalMinutesNow < shiftStartMinutes) {
      // Check-in sớm: Quy mốc tính công về đúng giờ bắt đầu ca
      const [targetH, targetM] = selectedShift === 'SHIFT_1' ? [8, 30] : [12, 0];
      workStartTime.setHours(targetH, targetM, 0, 0);
    } else {
      // Đi trễ
      lateMinutes = totalMinutesNow - shiftStartMinutes;
      if (lateMinutes > 5) {
        status = 'LATE';
      }
    }

    const attendance = await attendanceRepo.create({
      staffId: staff._id,
      staffCode: staff.code,
      staffName: staff.fullName,
      department: staff.department || 'OFFICE',
      date: todayStr,
      shiftCode: selectedShift,
      checkInTime: now,
      workStartTime,
      checkInType: isWfh ? 'WFH' : 'STANDARD',
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      clientIp: clientIp || req.ip || '',
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
      latitude,
      longitude,
      clientIp,
      bypassNetwork = false,
    } = req.body || {};

    // Kiểm tra vị trí & mạng (Location 1 đi với Mạng 1, Location 2 đi với Mạng 2) nếu không phải ca WFH
    const isWfh = attendance.checkInType === 'WFH';
    if (!isWfh && !bypassNetwork) {
      const config = getEnvAttendanceConfig();
      const detectedIp = extractClientIp(req, clientIp);
      const checkLat = latitude !== undefined ? latitude : attendance.latitude;
      const checkLng = longitude !== undefined ? longitude : attendance.longitude;
      verifyBranchLocationAndNetwork(checkLat, checkLng, detectedIp, config);
    }

    // 1. Kiểm tra bàn giao ca cho nhân viên SALES khi bấm Check-out
    if (attendance.department === 'SALES') {
      const handover = await shiftHandoverRepo.findOne({
        date: todayStr,
        fromStaffId: user.userId,
        shiftCode: attendance.shiftCode,
      });

      if (!handover) {
        throw new ApiError(
          400,
          'HANDOVER_REQUIRED',
          'Vui lòng lập biên bản bàn giao Kho Tầng 1 trước khi Check-out kết ca!'
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
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const totalMinutesNow = currentHours * 60 + currentMinutes;

    // Giờ kết thúc ca:
    // Ca 1: 17:30 (1050 phút)
    // Ca 2: 21:00 (1260 phút)
    const shiftEndMinutes = attendance.shiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
    let earlyMinutes = 0;

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
    }

    // 2. Tính toán tổng giờ làm việc thực tế
    const startMs = new Date(attendance.workStartTime).getTime();
    const endMs = now.getTime();
    let rawHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));

    // 3. Tự động trừ giờ nghỉ trưa (12:00 - 13:30 = 1.5 giờ) cho khối OFFICE
    let lunchPauseMinutes = 0;
    if (attendance.department === 'OFFICE' && attendance.shiftCode === 'SHIFT_1') {
      lunchPauseMinutes = 90; // 1.5 tiếng
      rawHours = Math.max(0, rawHours - 1.5);
    }

    const finalStatus = earlyMinutes > 0 ? 'EARLY_LEAVE' : 'COMPLETED';

    const updated = await attendanceRepo.updateById(attendance._id, {
      checkOutTime: now,
      earlyMinutes,
      lunchPauseMinutes,
      totalWorkHours: Number(rawHours.toFixed(2)),
      status: finalStatus,
      notes: earlyReason ? `Lý do về sớm: ${earlyReason}` : attendance.notes || '',
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

    const handover = await shiftHandoverRepo.findOne({
      date: todayStr,
      fromStaffId: user.userId,
      shiftCode: attendance ? attendance.shiftCode : 'SHIFT_1',
    });

    res.json({
      data: {
        date: todayStr,
        attendance: attendance || null,
        isWfhToday: Boolean(approvedWfh),
        isEarlyApprovedToday: Boolean(approvedEarly),
        handoverStatus: handover ? handover.status : null,
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

    const records = await attendanceRepo.find(filter);
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
    const detectedClientIp = extractClientIp(req);
    res.json({
      data: {
        config,
        detectedClientIp,
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
      'Cấu hình vị trí GPS và IP Wi-Fi chỉ được thiết lập trong file .env của Server, không cho phép chỉnh sửa trên hệ thống'
    )
  );
});

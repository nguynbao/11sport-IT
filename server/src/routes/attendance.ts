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

// Tọa độ mặc định Cơ sở 1 & Cơ sở 2 11Sport (89 Lê Thanh Nghị, Hòa Cường, Đà Nẵng)
const DEFAULT_SHOWROOM_LAT = 16.0352;
const DEFAULT_SHOWROOM_LNG = 108.2185;
const DEFAULT_SHOWROOM_2_LAT = 16.0414246;
const DEFAULT_SHOWROOM_2_LNG = 108.2179426;
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
    'Cơ sở 1: Showroom 11Sport - 24 Tố Hữu, Hoà Cường, Đà Nẵng';
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
    'Cơ sở 2: Văn phòng 11Sport - 89 Lê Thanh Nghị, Hòa Cường, Đà Nẵng';
  const office2Lat = Number(
    process.env.ATTENDANCE_OFFICE_2_LAT ?? DEFAULT_SHOWROOM_2_LAT
  );
  const office2Lng = Number(
    process.env.ATTENDANCE_OFFICE_2_LNG ?? DEFAULT_SHOWROOM_2_LNG
  );
  const allowedIps2 = (
    process.env.ATTENDANCE_ALLOWED_IPS_2 ||
    process.env.ATTENDANCE_OFFICE_2_ALLOWED_IPS ||
    '116.110.151.140,192.168.2.207,192.168.2.,127.0.0.1,::1,localhost'
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

    const { latitude, longitude, clientIp, shiftCode } = req.body || {};

    // 1. Kiểm tra đơn WFH đã duyệt hôm nay (Áp dụng cho cả khối OFFICE và SALES) — xác minh hoàn toàn phía server
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: staff._id,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });

    const isWfh = Boolean(approvedWfh);
    const config = getEnvAttendanceConfig();
    const detectedIp = extractClientIp(req, clientIp);

    // 2. Nếu không phải WFH (đã xác minh server-side) -> Kiểm tra cặp (Location 1 + Mạng 1) hoặc (Location 2 + Mạng 2)
    if (!isWfh) {
      verifyBranchLocationAndNetwork(latitude, longitude, detectedIp, config);
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

    let lateMinutes = 0;
    let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
    const workStartTime = new Date(now);

    if (totalMinutesNow < shiftStartMinutes) {
      // Check-in sớm: Quy mốc tính công về đúng giờ bắt đầu ca
      const [targetH, targetM] = selectedShift === 'SHIFT_2' ? [12, 0] : [8, 30];
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
      lateCheckoutReason = '',
      latitude,
      longitude,
      clientIp,
    } = req.body || {};

    // Kiểm tra vị trí & mạng (Location 1 đi với Mạng 1, Location 2 đi với Mạng 2) nếu không phải ca WFH (xác minh server-side)
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });
    const isWfh = attendance.checkInType === 'WFH' || Boolean(approvedWfh);
    if (!isWfh) {
      const config = getEnvAttendanceConfig();
      const detectedIp = extractClientIp(req, clientIp);
      const checkLat = latitude !== undefined ? latitude : attendance.latitude;
      const checkLng = longitude !== undefined ? longitude : attendance.longitude;
      verifyBranchLocationAndNetwork(checkLat, checkLng, detectedIp, config);
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
    if (attendance.department === 'SALES' && !isWfh) {
      const handover =
        (await shiftHandoverRepo.findOne({
          date: todayStr,
          fromStaffId: user.userId,
          shiftCode: effectiveShiftCode,
        })) ||
        (await shiftHandoverRepo.findOne({
          date: todayStr,
          fromStaffId: user.userId,
          shiftCode: attendance.shiftCode,
        }));

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
    // Ca 1 (SHIFT_1): 17:30 (1050 phút)
    // Ca 2 (SHIFT_2) & Ca 1 + Ca 2 (BOTH): 21:00 (1260 phút)
    const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
    let earlyMinutes = 0;
    let lateCheckoutMinutes = 0;
    let overtimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
      (attendance as any).overtimeStatus || 'NONE';
    let overtimeApprovedMinutes = Number((attendance as any).overtimeApprovedMinutes || 0);
    let cleanLateCheckoutReason = String(lateCheckoutReason || '').trim();

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

    // 2. Tính toán tổng giờ làm việc thực tế
    const startMs = new Date(attendance.workStartTime).getTime();
    const endMs = now.getTime();
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
      checkOutTime: now,
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

    const handover = await shiftHandoverRepo.findOne({
      date: todayStr,
      fromStaffId: user.userId,
      shiftCode: attendance
        ? attendance.shiftCode
        : assignedShift && assignedShift.shiftCode !== 'OFF'
          ? assignedShift.shiftCode
          : 'SHIFT_1',
    });

    res.json({
      data: {
        date: todayStr,
        attendance: attendance || null,
        assignedShift: assignedShift ? assignedShift.shiftCode : null,
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

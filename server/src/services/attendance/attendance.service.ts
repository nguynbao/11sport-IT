import {
  attendanceRepo,
  leaveRequestRepo,
  shiftAssignmentRepo,
  shiftHandoverRepo,
  staffRepo,
} from "../../repositories";
import { ShiftCode } from "../../models/Attendance";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ok, ServiceResult } from "../../shared/result";
import {
  expireStalePendingHandovers,
  isSalesStaffUser,
  resolvePendingIncomingHandoverForSales,
} from "../handover";
import { getLateToleranceMinutes } from "../timesheet";
import {
  getTodayString,
  verifyBranchNetwork,
} from "./attendance.rules";
import {
  getEffectiveAttendanceConfig,
  resolveEffectiveClientIp,
} from "./attendanceConfig.service";

export async function checkIn(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const user = ctx.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để chấm công');

    const staff = await staffRepo.findById(user.userId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
    if (staff.role === 'ADMIN' || staff.role === 'CEO') {
      throw new ApiError(400, 'ADMIN_NO_ATTENDANCE', 'Tài khoản Quản trị viên (ADMIN/CEO) không cần chấm công');
    }

    const todayStr = getTodayString();
    const existing = await attendanceRepo.findOne({ staffId: staff._id, date: todayStr });
    if (existing) {
      throw new ApiError(400, 'ALREADY_CHECKED_IN', 'Hôm nay bạn đã chấm công check-in rồi');
    }

    const { clientIp, shiftCode } = body || {};

    // 1. Kiểm tra đơn WFH đã duyệt hôm nay (Áp dụng cho cả khối OFFICE và SALES) — xác minh hoàn toàn phía server
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: staff._id,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });

    const isWfh = Boolean(approvedWfh);
    const config = await getEffectiveAttendanceConfig();
    const detectedIp = await resolveEffectiveClientIp(ctx, clientIp);

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

    return created({
        attendance,
        isWfh,
        message: status === 'LATE' ? `Đi trễ ${lateMinutes} phút` : 'Chấm công vào ca thành công',
      }, {});
}

export async function checkOut(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const user = ctx.user;
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
    } = body || {};

    // Kiểm tra IP mạng (Cơ sở 1 hoặc Cơ sở 2) nếu không phải ca WFH (xác minh server-side)
    const approvedWfh = await leaveRequestRepo.findOne({
      staffId: user.userId,
      date: todayStr,
      type: 'WFH',
      status: 'APPROVED',
    });
    const isWfh = attendance.checkInType === 'WFH' || Boolean(approvedWfh);
    if (!isWfh) {
      const config = await getEffectiveAttendanceConfig();
      const detectedIp = await resolveEffectiveClientIp(ctx, clientIp);
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
      body?.requireConfirmation === true &&
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

      return ok({
          attendance: pendingUpdated,
          awaitingHandoverConfirm: true,
          waitingConfirmation: true,
          message:
            'Đã chốt giờ ra ca lúc gửi bàn giao! Khi nhân viên Ca 2 xác nhận, bạn sẽ được hoàn tất Check-out (giờ ra ca vẫn tính đúng lúc bạn bấm gửi).',
        }, {});
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

    return ok({
        attendance: updated,
        message: 'Hoàn tất Check-out ra ca',
      }, {});
}

export async function getTodayAttendance(ctx: ServiceContext): Promise<ServiceResult> {
  const user = ctx.user;
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

    return ok({
        date: todayStr,
        attendance: attendance || null,
        assignedShift: assignedShift ? assignedShift.shiftCode : null,
        isWfhToday: Boolean(approvedWfh),
        isEarlyApprovedToday: Boolean(approvedEarly),
        handoverStatus: handover ? handover.status : null,
        currentShiftHandover: handover || null,
        pendingIncomingHandover,
      }, {});
}

export async function getAttendanceHistory(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const user = ctx.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { staffId, month, year } = query || {};

    const filter: Record<string, any> = {};
    if (['CEO', 'ADMIN', 'HR'].includes(user.role)) {
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
    return ok(records, { total: records.length });
}


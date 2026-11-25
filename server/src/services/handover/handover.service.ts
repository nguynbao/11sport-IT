import {
  attendanceConfigRepo,
  attendanceRepo,
  productRepo,
  shiftAssignmentRepo,
  shiftHandoverRepo,
} from '../../repositories';
import { addDaysToDateStr, toLocalDateStr } from '../../shared/date';
import { ApiError } from '../../shared/errors';
import { ServiceContext } from '../../shared/http';
import { created, ok, ServiceResult } from '../../shared/result';
import {
  HANDOVER_SCHEDULE_CONFIG_KEY,
  computeDailyHandoverCheck,
} from './handover.queries';
import {
  isHandoverManagerRole,
  isSalesStaffUser,
  resolvePendingIncomingHandoverForSales,
  stripVnAccents,
} from './handover.rules';

/**
 * Tự động đánh dấu hết hiệu lực chờ ('STORE_CLOSED') cho các phiếu PENDING đã quá hạn (> 1 ngày)
 * hoặc đã bị thay thế bởi phiếu bàn giao của ca mới hơn, tránh tồn đọng phiếu cũ chặn checkout.
 */
export async function expireStalePendingHandovers(todayLocal = toLocalDateStr()): Promise<any[]> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const todaySet = new Set([todayLocal, todayUtc]);
  const yesterdayLocal = addDaysToDateStr(todayLocal, -1);
  const yesterdayUtc = addDaysToDateStr(todayUtc, -1);
  const minValidDate = yesterdayLocal < yesterdayUtc ? yesterdayLocal : yesterdayUtc;

  const allHandovers = (await shiftHandoverRepo.find({})) as any[];
  const submittedHandoversToday = allHandovers.filter(
    (h) => h.status !== 'DRAFT' && todaySet.has(String(h.date))
  );
  const hasAnyHandoverToday = submittedHandoversToday.length > 0;
  const latestClosingTodayMs = submittedHandoversToday
    .filter((h) => h.shiftCode === 'SHIFT_2' || h.shiftCode === 'BOTH')
    .reduce((maxMs, h) => {
      const t = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
      return t > maxMs ? t : maxMs;
    }, 0);

  for (const h of allHandovers) {
    if (h.status !== 'PENDING') continue;
    const hDate = String(h.date || '');
    const hTimeMs = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
    const isTooOld = !hDate || hDate < minValidDate;
    const isPrevDaySuperseded = !todaySet.has(hDate) && hasAnyHandoverToday;
    const isPrevDayShift1Expired = !todaySet.has(hDate) && h.shiftCode === 'SHIFT_1';
    const isTodayShift1Superseded =
      todaySet.has(hDate) &&
      h.shiftCode === 'SHIFT_1' &&
      latestClosingTodayMs > 0 &&
      latestClosingTodayMs > hTimeMs;

    if (isTooOld || isPrevDaySuperseded || isPrevDayShift1Expired || isTodayShift1Superseded) {
      h.status = 'STORE_CLOSED';
      await shiftHandoverRepo.updateById(h._id, { status: 'STORE_CLOSED' });
      await finalizeAttendanceCheckoutFromHandover(h);
    }
  }

  return allHandovers;
}

export async function finalizeAttendanceCheckoutFromHandover(handover: any): Promise<any | null> {
  if (!handover || handover.status === 'DRAFT' || !handover.fromStaffId || !handover.date) {
    return null;
  }
  const att = await attendanceRepo.findOne({
    staffId: handover.fromStaffId,
    date: String(handover.date),
  });
  if (!att || att.checkOutTime) return att || null;

  const effectiveOutDate = att.pendingCheckOutTime
    ? new Date(att.pendingCheckOutTime)
    : handover.submittedAt
      ? new Date(handover.submittedAt)
      : new Date();

  const assignedShift =
    (await shiftAssignmentRepo.findOne({
      staffId: String(handover.fromStaffId),
      date: String(handover.date),
    })) ||
    (await shiftAssignmentRepo.findOne({
      staffId: handover.fromStaffId,
      date: String(handover.date),
    }));

  const effectiveShiftCode =
    assignedShift &&
    (assignedShift.shiftCode === 'SHIFT_1' ||
      assignedShift.shiftCode === 'SHIFT_2' ||
      assignedShift.shiftCode === 'BOTH')
      ? assignedShift.shiftCode
      : att.shiftCode;

  const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
  const totalMinutesOut = effectiveOutDate.getHours() * 60 + effectiveOutDate.getMinutes();

  const earlyMinutes = totalMinutesOut < shiftEndMinutes ? shiftEndMinutes - totalMinutesOut : 0;

  let lateCheckoutMinutes = Number(att.lateCheckoutMinutes || handover.lateCheckoutMinutes || 0);
  const cleanLateCheckoutReason = String(
    att.lateCheckoutReason || handover.lateCheckoutReason || ''
  ).trim();
  let overtimeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' =
    (att as any).overtimeStatus || 'NONE';
  let overtimeApprovedMinutes = Number((att as any).overtimeApprovedMinutes || 0);

  if (totalMinutesOut > shiftEndMinutes && effectiveShiftCode !== 'BOTH') {
    const diffLate = totalMinutesOut - shiftEndMinutes;
    if (diffLate > 5) {
      lateCheckoutMinutes = diffLate;
      if (overtimeStatus !== 'APPROVED') {
        overtimeStatus = 'PENDING';
        overtimeApprovedMinutes = 0;
      }
    }
  }

  const startMs = new Date(att.workStartTime).getTime();
  const endMs = effectiveOutDate.getTime();
  let rawHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
  let lunchPauseMinutes = 0;
  if (att.department === 'OFFICE' && effectiveShiftCode === 'SHIFT_1') {
    lunchPauseMinutes = 60;
    rawHours = Math.max(0, rawHours - 1);
  }

  const finalStatus = earlyMinutes > 0 ? 'EARLY_LEAVE' : 'COMPLETED';
  const noteParts: string[] = [];
  if (att.notes) noteParts.push(String(att.notes));
  if (
    cleanLateCheckoutReason &&
    !String(att.notes || '').includes(cleanLateCheckoutReason)
  ) {
    noteParts.push(
      `Lý do check-out trễ (${lateCheckoutMinutes}p): ${cleanLateCheckoutReason}`
    );
  }

  return attendanceRepo.updateById(att._id, {
    shiftCode: effectiveShiftCode,
    checkOutTime: effectiveOutDate,
    earlyMinutes,
    lateCheckoutMinutes,
    lateCheckoutReason: cleanLateCheckoutReason,
    overtimeStatus,
    overtimeApprovedMinutes,
    lunchPauseMinutes,
    totalWorkHours: Number(rawHours.toFixed(2)),
    status: finalStatus,
    notes: noteParts.join(' | '),
  });
}

function mapScheduleConfigResponse(dailyCheck: Awaited<ReturnType<typeof computeDailyHandoverCheck>>) {
  return {
    weeklySchedule: dailyCheck.weeklySchedule,
    primaryCategory: dailyCheck.primaryCategory,
    availableCompanionCategories: dailyCheck.availableCompanionCategories,
    availableCategories: dailyCheck.availableCompanionCategories.map((c: any) => ({
      _id: c._id,
      code: c.code,
      name: c.name,
      slug: c.slug,
      productCount: c.productCount,
      expectedTotalQty: c.expectedTotalQty,
      isPrimary: false,
    })),
  };
}

export async function getHandoverScheduleConfig(ctx: ServiceContext): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập cấu hình lịch kiểm hàng');
  }
  const dailyCheck = await computeDailyHandoverCheck();
  return ok(mapScheduleConfigResponse(dailyCheck));
}

export async function updateHandoverScheduleConfig(
  ctx: ServiceContext,
  body: any
): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (
    !isHandoverManagerRole(user.role) ||
    String(user.role || '').toUpperCase() === 'ACCOUNTANT'
  ) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Quản lý (CEO / Admin / HR) mới được cấu hình lịch kiểm hàng cố định theo ngày; Kế toán chỉ có quyền xem.'
    );
  }

  const rawSchedule = body?.weeklySchedule;
  if (!rawSchedule || typeof rawSchedule !== 'object') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu cấu hình lịch kiểm theo thứ không hợp lệ');
  }

  const normalizedSchedule: Record<string, string[]> = {};
  for (let wd = 0; wd <= 6; wd++) {
    const key = String(wd);
    const val = rawSchedule[key];
    const list = Array.isArray(val)
      ? val.map((x: any) => String(x || '').trim()).filter(Boolean)
      : typeof val === 'string' && val.trim()
        ? [val.trim()]
        : [];
    normalizedSchedule[key] = list;
  }

  const existing = await attendanceConfigRepo.findOne({ key: HANDOVER_SCHEDULE_CONFIG_KEY });
  if (existing) {
    await attendanceConfigRepo.updateById(existing._id, {
      handoverWeeklySchedule: normalizedSchedule,
      updatedBy: user.fullName || user.username,
    });
  } else {
    await attendanceConfigRepo.create({
      key: HANDOVER_SCHEDULE_CONFIG_KEY,
      officeName: 'Cấu hình lịch kiểm hàng bàn giao ca',
      officeLat: 0,
      officeLng: 0,
      maxDistanceMeters: 50,
      allowedIps: [],
      requireGps: false,
      requireIp: true,
      handoverWeeklySchedule: normalizedSchedule,
      updatedBy: user.fullName || user.username,
    });
  }

  const updatedDailyCheck = await computeDailyHandoverCheck();
  return ok(mapScheduleConfigResponse(updatedDailyCheck), {
    message: 'Đã lưu cấu hình lịch kiểm hàng cố định theo ngày trong tuần!',
  });
}

export async function getDailyHandoverCheck(
  ctx: ServiceContext,
  query: any
): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập danh mục bàn giao ca');
  }

  const dateQuery = typeof query?.date === 'string' ? query.date.trim() : undefined;
  const dailyCheck = await computeDailyHandoverCheck(dateQuery);
  return ok(dailyCheck, {
    totalProducts: dailyCheck.products.length,
    totalExpectedQty: dailyCheck.totalExpectedQty,
  });
}

export async function listHandovers(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const isManager = isHandoverManagerRole(user.role);
  const isSales = isSalesStaffUser(user);
  if (!isManager && !isSales) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Quản lý (Admin/HR/Kế toán) hoặc Nhân viên Bán hàng mới có quyền xem phiếu bàn giao ca'
    );
  }

  const { date, from, to, status, shiftCode, staffId, onlyDiscrepancy, hasDiscrepancy, search } =
    query || {};
  const todayLocal = toLocalDateStr();
  const allHandovers = await expireStalePendingHandovers(todayLocal);

  let receivingShiftCode: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | null = null;
  if (isSales) {
    const todayAttendance = await attendanceRepo.findOne({
      staffId: user.userId,
      date: todayLocal,
    });
    const todayAssigned =
      (await shiftAssignmentRepo.findOne({ staffId: String(user.userId), date: todayLocal })) ||
      (await shiftAssignmentRepo.findOne({ staffId: user.userId, date: todayLocal }));

    if (
      todayAttendance &&
      (todayAttendance.shiftCode === 'SHIFT_1' ||
        todayAttendance.shiftCode === 'SHIFT_2' ||
        todayAttendance.shiftCode === 'BOTH')
    ) {
      receivingShiftCode = todayAttendance.shiftCode;
    } else if (
      todayAssigned &&
      (todayAssigned.shiftCode === 'SHIFT_1' ||
        todayAssigned.shiftCode === 'SHIFT_2' ||
        todayAssigned.shiftCode === 'BOTH')
    ) {
      receivingShiftCode = todayAssigned.shiftCode;
    }
  }

  const pendingIncomingHandover = isSales
    ? resolvePendingIncomingHandoverForSales({
        allHandovers,
        userId: String(user.userId),
        todayLocal,
        receivingShiftCode,
      })
    : null;

  let filtered = isManager
    ? [...allHandovers]
    : allHandovers.filter(
        (h) =>
          String(h.fromStaffId) === String(user.userId) ||
          String(h.toStaffId) === String(user.userId) ||
          (pendingIncomingHandover && String(h._id) === String(pendingIncomingHandover._id))
      );

  if (typeof date === 'string' && date.trim()) {
    const d = date.trim();
    filtered = filtered.filter((h) => String(h.date) === d);
  }
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from.trim())) {
    filtered = filtered.filter((h) => String(h.date) >= from.trim());
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
    filtered = filtered.filter((h) => String(h.date) <= to.trim());
  }
  if (typeof status === 'string' && status.trim() && status !== 'ALL') {
    filtered = filtered.filter((h) => String(h.status) === status.trim().toUpperCase());
  }
  if (typeof shiftCode === 'string' && shiftCode.trim() && shiftCode !== 'ALL') {
    filtered = filtered.filter((h) => String(h.shiftCode) === shiftCode.trim().toUpperCase());
  }
  if (isManager && typeof staffId === 'string' && staffId.trim()) {
    const sid = staffId.trim();
    filtered = filtered.filter(
      (h) => String(h.fromStaffId) === sid || String(h.toStaffId) === sid
    );
  }
  if (onlyDiscrepancy === 'true' || hasDiscrepancy === 'true') {
    filtered = filtered.filter(
      (h) =>
        h.status === 'DISCREPANCY_REPORTED' ||
        (Array.isArray(h.discrepancies) && h.discrepancies.some((d: any) => d.actual !== d.expected)) ||
        (Array.isArray(h.categoryCounts) &&
          h.categoryCounts.some((c: any) => Number(c.actualTotalQty) !== Number(c.expectedTotalQty)))
    );
  }
  if (typeof search === 'string' && search.trim()) {
    const q = stripVnAccents(search.trim());
    filtered = filtered.filter((h) => {
      const hay = stripVnAccents(
        [
          h.fromStaffName,
          h.toStaffName,
          h.notes,
          h.confirmNote,
          ...(h.checkedCategories || []),
          ...(h.discrepancies || []).map((d: any) => `${d.productCode} ${d.productName || ''}`),
        ].join(' ')
      );
      return hay.includes(q);
    });
  }

  filtered.sort((a, b) => {
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const draftCount = filtered.filter((h) => h.status === 'DRAFT').length;
  const pendingCount = filtered.filter((h) => h.status === 'PENDING').length;
  const acceptedCount = filtered.filter((h) => h.status === 'ACCEPTED').length;
  const storeClosedCount = filtered.filter((h) => h.status === 'STORE_CLOSED').length;
  const discrepancyHandoverCount = filtered.filter(
    (h) =>
      h.status === 'DISCREPANCY_REPORTED' ||
      (Array.isArray(h.discrepancies) && h.discrepancies.some((d: any) => d.actual !== d.expected)) ||
      (Array.isArray(h.categoryCounts) &&
        h.categoryCounts.some((c: any) => Number(c.actualTotalQty) !== Number(c.expectedTotalQty)))
  ).length;

  return ok(filtered, {
    total: filtered.length,
    draftCount,
    pendingCount,
    acceptedCount,
    storeClosedCount,
    discrepancyHandoverCount,
    pendingIncomingHandover,
  });
}

export async function submitHandover(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
  if (!isHandoverManagerRole(user.role) && !isSalesStaffUser(user)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Nhân viên Bán hàng hoặc Quản lý mới được lập phiếu bàn giao ca'
    );
  }

  const {
    date,
    shiftCode = 'SHIFT_1',
    isDraft = false,
    cashBalance = 0,
    checkedCategories,
    totalCheckedProducts,
    categoryCounts,
    discrepancies = [],
    notes = '',
    lateCheckoutReason = '',
    requireLateReason,
  } = body || {};

  const effectiveDate =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : toLocalDateStr();

  const dailyCheck = await computeDailyHandoverCheck(effectiveDate);
  const resolvedCheckedCategories =
    Array.isArray(checkedCategories) && checkedCategories.length > 0
      ? checkedCategories.map((c: any) => String(c))
      : dailyCheck.checkedCategories;
  const resolvedTotalChecked =
    typeof totalCheckedProducts === 'number' && totalCheckedProducts >= 0
      ? totalCheckedProducts
      : dailyCheck.totalExpectedQty || dailyCheck.products.length;

  const normalizedCategoryCounts =
    Array.isArray(categoryCounts) && categoryCounts.length > 0
      ? categoryCounts.map((c: any) => {
          const summaryMatch = dailyCheck.categorySummaries.find(
            (s) =>
              s.categoryCode === c?.categoryCode ||
              stripVnAccents(s.categoryName) === stripVnAccents(c?.categoryName)
          );
          const expectedTotalQty =
            typeof c?.expectedTotalQty === 'number'
              ? Number(c.expectedTotalQty)
              : summaryMatch?.expectedTotalQty ?? 0;
          const actualTotalQty =
            typeof c?.actualTotalQty === 'number'
              ? Math.max(0, Number(c.actualTotalQty))
              : expectedTotalQty;
          return {
            categoryId: String(c?.categoryId || summaryMatch?.categoryId || ''),
            categoryCode: String(c?.categoryCode || summaryMatch?.categoryCode || 'CAT').toUpperCase(),
            categoryName: String(c?.categoryName || summaryMatch?.categoryName || 'Danh mục'),
            expectedTotalQty,
            actualTotalQty,
            unit: String(c?.unit || summaryMatch?.unit || 'Cái'),
            productCount: Number(c?.productCount ?? summaryMatch?.productCount ?? 0),
            note: String(c?.note || '').trim(),
          };
        })
      : dailyCheck.categorySummaries.map((s) => ({
          categoryId: s.categoryId,
          categoryCode: s.categoryCode,
          categoryName: s.categoryName,
          expectedTotalQty: s.expectedTotalQty,
          actualTotalQty: s.expectedTotalQty,
          unit: s.unit,
          productCount: s.productCount,
          note: '',
        }));

  const allProducts = await productRepo.find({});
  const prodByCode = new Map(allProducts.map((p: any) => [String(p.code || '').toUpperCase(), p]));

  let normalizedDiscrepancies = (Array.isArray(discrepancies) ? discrepancies : []).map((d: any) => {
    const code = String(d?.productCode || '').trim().toUpperCase();
    const prod = prodByCode.get(code);
    const expected = Number(d?.expected) || 0;
    const actual = Number(d?.actual) || 0;
    return {
      productCode: code,
      productName: String(d?.productName || prod?.name || '').trim(),
      categoryName: String(d?.categoryName || prod?.categoryName || '').trim(),
      expected,
      actual,
      note:
        String(d?.note || '').trim() ||
        (actual > expected
          ? `Thừa ${actual - expected}`
          : actual < expected
            ? `Thiếu ${expected - actual}`
            : 'Khớp'),
    };
  });

  if (normalizedDiscrepancies.length === 0) {
    normalizedDiscrepancies = normalizedCategoryCounts
      .filter((c) => c.actualTotalQty !== c.expectedTotalQty)
      .map((c) => {
        const diff = c.actualTotalQty - c.expectedTotalQty;
        const defaultNote =
          diff > 0 ? `Thừa +${diff} ${c.unit || 'Cái'}` : `Thiếu ${diff} ${c.unit || 'Cái'}`;
        return {
          productCode: `TONG_${c.categoryCode}`,
          productName: `Tổng ${c.categoryName}`,
          categoryName: c.categoryName,
          expected: c.expectedTotalQty,
          actual: c.actualTotalQty,
          note: c.note ? `${defaultNote} (${c.note})` : defaultNote,
        };
      });
  }

  const now = new Date();
  const targetStatus: 'DRAFT' | 'PENDING' = isDraft ? 'DRAFT' : 'PENDING';
  const cleanLateReason = String(lateCheckoutReason || '').trim();
  let computedLateMinutes = 0;

  if (!isDraft && effectiveDate === toLocalDateStr(now)) {
    const todayAtt = await attendanceRepo.findOne({
      staffId: user.userId,
      date: effectiveDate,
    });

    if (todayAtt && !todayAtt.checkOutTime) {
      const effectiveShiftCode = todayAtt.shiftCode || shiftCode;
      const shiftEndMinutes = effectiveShiftCode === 'SHIFT_1' ? 17 * 60 + 30 : 21 * 60;
      const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
      const diffLateOut = totalMinutesNow - shiftEndMinutes;

      if (diffLateOut > 5 && effectiveShiftCode !== 'BOTH') {
        computedLateMinutes = diffLateOut;
        const finalReason = cleanLateReason || String(todayAtt.lateCheckoutReason || '').trim();
        if (requireLateReason && !finalReason) {
          throw new ApiError(
            400,
            'LATE_CHECKOUT_REASON_REQUIRED',
            `Bạn đang gửi bàn giao & check-out trễ ${diffLateOut} phút (quá 5 phút sau giờ kết thúc ca). Vui lòng nhập lý do check-out trễ!`,
            { lateCheckoutMinutes: String(diffLateOut) }
          );
        }
      }

      const lockedOutTime = todayAtt.pendingCheckOutTime
        ? new Date(todayAtt.pendingCheckOutTime)
        : now;
      await attendanceRepo.updateById(todayAtt._id, {
        pendingCheckOutTime: lockedOutTime,
        ...(computedLateMinutes > 0 ? { lateCheckoutMinutes: computedLateMinutes } : {}),
        ...(cleanLateReason ? { lateCheckoutReason: cleanLateReason } : {}),
      });
    }
  }

  if (!isDraft) {
    const prevPendingList = (await shiftHandoverRepo.find({ status: 'PENDING' })) as any[];
    for (const oldPending of prevPendingList) {
      const oldDate = String(oldPending.date || '');
      const shouldExpireOld =
        oldDate < effectiveDate ||
        (oldDate === effectiveDate &&
          oldPending.shiftCode === 'SHIFT_1' &&
          (shiftCode === 'SHIFT_2' || shiftCode === 'BOTH'));
      if (shouldExpireOld) {
        await shiftHandoverRepo.updateById(oldPending._id, { status: 'STORE_CLOSED' });
        await finalizeAttendanceCheckoutFromHandover(oldPending);
      }
    }
  }

  const allForStaffToday = (await shiftHandoverRepo.find({
    date: effectiveDate,
    fromStaffId: user.userId,
    shiftCode,
  })) as any[];
  const existing = allForStaffToday.find((h) => h.status === 'DRAFT' || h.status === 'PENDING');

  if (existing && existing.status === 'PENDING' && isDraft) {
    throw new ApiError(
      400,
      'HANDOVER_ALREADY_SUBMITTED',
      'Phiếu bàn giao ca này đã được gửi chính thức (đang chờ ca sau xác nhận), không thể hạ xuống trạng thái Bản nháp!'
    );
  }

  const payload: any = {
    date: effectiveDate,
    shiftCode,
    fromStaffId: user.userId,
    fromStaffName: user.fullName || user.username,
    handoverType: 'TANG_1' as const,
    cashBalance: Number(cashBalance) || 0,
    checkedCategories: resolvedCheckedCategories,
    totalCheckedProducts: resolvedTotalChecked,
    categoryCounts: normalizedCategoryCounts,
    discrepancies: normalizedDiscrepancies,
    status: targetStatus,
    notes: String(notes || '').trim(),
    ...(cleanLateReason ? { lateCheckoutReason: cleanLateReason } : {}),
    ...(computedLateMinutes > 0 ? { lateCheckoutMinutes: computedLateMinutes } : {}),
    ...(!isDraft ? { submittedAt: existing?.submittedAt ? existing.submittedAt : now } : {}),
  };

  const handover = existing
    ? await shiftHandoverRepo.updateById(existing._id, payload)
    : await shiftHandoverRepo.create(payload);

  const message = isDraft
    ? 'Đã lưu bản nháp kiểm hàng trong ca! Bạn có thể cập nhật tiếp bất cứ lúc nào trước giờ tan ca.'
    : shiftCode === 'SHIFT_1'
      ? 'Đã chốt giờ gửi bàn giao ca! Khi Ca 2 xác nhận, bạn sẽ hoàn tất Check-out (giờ ra ca vẫn tính đúng lúc bạn bấm gửi).'
      : 'Đã lập phiếu kết ca tối! Ca 1 sáng hôm sau sẽ nhận được thông báo xác nhận bàn giao.';

  return created(handover, { message });
}

export async function confirmHandover(
  ctx: ServiceContext,
  id: string,
  body: any
): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

  const isManager = isHandoverManagerRole(user.role);
  const isSales = isSalesStaffUser(user);
  if (!isManager && !isSales) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xác nhận phiếu bàn giao ca');
  }

  const handover = await shiftHandoverRepo.findById(id);
  if (!handover) {
    throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy biên bản bàn giao ca');
  }

  if (handover.status === 'DRAFT') {
    throw new ApiError(
      400,
      'HANDOVER_STILL_DRAFT',
      'Phiếu bàn giao ca này vẫn đang ở trạng thái Bản nháp (nhân viên chưa bấm xác nhận gửi bàn giao), chưa thể xác nhận!'
    );
  }

  if (!isManager) {
    if (String(handover.fromStaffId) === String(user.userId)) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Người lập phiếu bàn giao không thể tự xác nhận phiếu của chính mình'
      );
    }
    if (handover.toStaffId && String(handover.toStaffId) !== String(user.userId)) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Phiếu bàn giao này đã được chỉ định cho nhân viên khác'
      );
    }
  }

  const wasPending = handover.status === 'PENDING';
  const { accept = true, note = '' } = body || {};
  const cleanNote = String(note || '').trim();

  const updated = await shiftHandoverRepo.updateById(id, {
    toStaffId: user.userId,
    toStaffName: user.fullName || user.username,
    status: accept ? 'ACCEPTED' : 'DISCREPANCY_REPORTED',
    acceptedAt: new Date(),
    confirmNote: cleanNote,
    notes: cleanNote
      ? handover.notes
        ? `${handover.notes} | Xác nhận: ${cleanNote}`
        : `Xác nhận: ${cleanNote}`
      : handover.notes,
  });

  const finalizedFromStaffAttendance = wasPending
    ? await finalizeAttendanceCheckoutFromHandover(updated || handover)
    : null;

  return ok(updated, {
    finalizedFromStaffAttendance,
    message: accept
      ? 'Đã xác nhận thông tin bàn giao ca thành công!'
      : 'Đã ghi nhận báo lệch thông tin bàn giao ca.',
  });
}

export async function deleteHandover(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  const user = ctx.user;
  if (!user || !isHandoverManagerRole(user.role)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Chỉ Quản trị viên / HR / Kế toán mới có quyền xóa phiếu bàn giao ca'
    );
  }

  const handover = await shiftHandoverRepo.findById(id);
  if (!handover) {
    throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy phiếu bàn giao ca');
  }

  await shiftHandoverRepo.deleteById(id);
  return ok({ deleted: true, _id: id }, { message: 'Đã xóa phiếu bàn giao ca' });
}

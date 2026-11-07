import { Router } from 'express';
import { shiftAssignmentRepo, shiftHandoverRepo, staffRepo } from '../config/db';
import { ApiError } from '../utils/errors';
import { ShiftType } from '../models/ShiftAssignment';

export const shiftsRouter = Router();

// POST /api/v1/shifts/preferences (Nhân viên nộp đăng ký ca Thứ 6)
shiftsRouter.post('/shifts/preferences', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { weekStart, preferences } = req.body || {};
    if (!weekStart || !Array.isArray(preferences)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu đăng ký ca không hợp lệ');
    }

    const staff = await staffRepo.findById(user.userId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    const createdRecords = [];
    for (const item of preferences) {
      const { date, dayOfWeek, isOffRequested = false, preferenceShift = 'SHIFT_1' } = item;
      const existing = await shiftAssignmentRepo.findOne({ date, staffId: staff._id });

      const payload = {
        weekStart,
        date,
        dayOfWeek: Number(dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode: (isOffRequested ? 'OFF' : preferenceShift) as ShiftType,
        preferenceShift: (isOffRequested ? 'OFF' : preferenceShift) as ShiftType,
        isOffRequested: Boolean(isOffRequested),
        assignedBy: 'AUTO' as const,
      };

      if (existing) {
        const updated = await shiftAssignmentRepo.updateById(existing._id, payload);
        createdRecords.push(updated);
      } else {
        const created = await shiftAssignmentRepo.create(payload);
        createdRecords.push(created);
      }
    }

    res.json({
      data: createdRecords,
      meta: { message: 'Đăng ký ca làm việc tuần tới thành công' },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/schedule (Xem lịch tuần)
shiftsRouter.get('/shifts/schedule', async (req, res, next) => {
  try {
    const { weekStart } = req.query;
    let assignments = await shiftAssignmentRepo.find({});
    if (weekStart) {
      // Lấy theo khoảng ngày của tuần (tránh sót phân ca lưu với weekStart khác)
      const startStr = String(weekStart);
      const [y, m, d] = startStr.split('-').map(Number);
      const end = new Date(y, m - 1, d + 6);
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      assignments = assignments.filter((a: any) => a.date >= startStr && a.date <= endStr);
    }
    const allStaff = await staffRepo.find({ status: 'ACTIVE' });

    res.json({
      data: {
        assignments,
        staffList: allStaff.map((s) => ({
          _id: s._id,
          code: s.code,
          fullName: s.fullName,
          role: s.role,
          department: s.department,
        })),
      },
      meta: { total: assignments.length },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/shifts/assign/bulk (HR lưu toàn bộ thay đổi lịch ca tuần một lần)
shiftsRouter.put('/shifts/assign/bulk', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xếp ca');
    }

    const { weekStart, changes } = req.body || {};
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Không có thay đổi nào để lưu');
    }
    const validCodes = ['SHIFT_1', 'SHIFT_2', 'OFF'];
    for (const c of changes) {
      if (!c || !c.staffId || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || ''))) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu phân ca không hợp lệ');
      }
      if (c.shiftCode !== null && !validCodes.includes(c.shiftCode)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Mã ca không hợp lệ: ${c.shiftCode}`);
      }
    }

    // ---- Kiểm tra quy định: Khối Bán hàng làm 6 ngày + nghỉ ĐÚNG 1 ngày/tuần ----
    const wsStr = /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart || ''))
      ? String(weekStart)
      : String(changes[0].date);
    const [wy, wm, wd] = wsStr.split('-').map(Number);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(wy, wm - 1, wd + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const finalPlan = new Map<string, Map<string, string>>();
    const allAssign = await shiftAssignmentRepo.find({});
    for (const a of allAssign as any[]) {
      if (!weekDates.includes(a.date)) continue;
      const sid = String(a.staffId);
      if (!finalPlan.has(sid)) finalPlan.set(sid, new Map());
      finalPlan.get(sid)!.set(a.date, a.shiftCode);
    }
    for (const c of changes) {
      if (!weekDates.includes(String(c.date))) continue;
      const sid = String(c.staffId);
      if (!finalPlan.has(sid)) finalPlan.set(sid, new Map());
      if (c.shiftCode === null) finalPlan.get(sid)!.delete(String(c.date));
      else finalPlan.get(sid)!.set(String(c.date), c.shiftCode);
    }
    const violations: Record<string, string> = {};
    for (const [sid, plan] of finalPlan) {
      if (plan.size === 0) continue;
      const st: any = await staffRepo.findById(sid);
      if (!st) continue;
      const dept = st.department || (st.role === 'SALES' ? 'SALES' : 'OFFICE');
      if (dept !== 'SALES') continue;
      const offCount = Array.from(plan.values()).filter((v) => v === 'OFF').length;
      const missing = 7 - plan.size;
      const problems: string[] = [];
      if (missing > 0) problems.push(`còn ${missing} ngày chưa xếp`);
      if (offCount === 0) problems.push('chưa có ngày nghỉ');
      if (offCount > 1) problems.push(`đang nghỉ ${offCount} ngày`);
      if (problems.length) violations[st.fullName || sid] = `${problems.join(', ')} (quy định: 6 ngày làm + 1 ngày nghỉ)`;
    }
    if (Object.keys(violations).length > 0) {
      throw new ApiError(
        400,
        'WEEKLY_OFF_REQUIRED',
        `Mỗi nhân viên Bán hàng phải làm 6 ngày và nghỉ đúng 1 ngày/tuần: ${Object.entries(violations)
          .map(([n, p]) => `${n} – ${p}`)
          .join('; ')}`,
        violations
      );
    }

    const staffCache = new Map<string, any>();
    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const c of changes) {
      const staffId = String(c.staffId);
      const date = String(c.date);
      const existing = await shiftAssignmentRepo.findOne({ staffId, date });

      if (c.shiftCode === null) {
        if (existing) {
          await shiftAssignmentRepo.deleteById(String(existing._id));
          deleted++;
        }
        continue;
      }

      if (existing) {
        await shiftAssignmentRepo.updateById(existing._id, {
          shiftCode: c.shiftCode,
          assignedBy: 'HR',
        });
        updated++;
        continue;
      }

      if (!staffCache.has(staffId)) {
        staffCache.set(staffId, await staffRepo.findById(staffId));
      }
      const staff = staffCache.get(staffId);
      if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

      await shiftAssignmentRepo.create({
        weekStart: weekStart || date,
        date,
        dayOfWeek: Number(c.dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode: c.shiftCode,
        assignedBy: 'HR',
      });
      created++;
    }

    res.json({
      data: { created, updated, deleted },
      meta: { message: 'Đã lưu lịch ca' },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/shifts/assign (HR Kéo - Thả Drag & Drop xếp ca)
shiftsRouter.put('/shifts/assign', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xếp ca');
    }

    const { staffId, date, weekStart, dayOfWeek, shiftCode } = req.body || {};
    if (!staffId || !date || !shiftCode) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu thông tin phân ca');
    }

    const staff = await staffRepo.findById(staffId);
    if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');

    const existing = await shiftAssignmentRepo.findOne({ staffId, date });
    let result;

    if (existing) {
      result = await shiftAssignmentRepo.updateById(existing._id, {
        shiftCode,
        assignedBy: 'HR',
      });
    } else {
      result = await shiftAssignmentRepo.create({
        weekStart: weekStart || date,
        date,
        dayOfWeek: Number(dayOfWeek) || 1,
        staffId: staff._id,
        staffCode: staff.code,
        staffName: staff.fullName,
        shiftCode,
        assignedBy: 'HR',
      });
    }

    res.json({
      data: result,
      meta: { message: 'Cập nhật phân ca thành công' },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/handover (Sales Ca 1 tạo biên bản bàn giao Kho Tầng 1)
shiftsRouter.post('/shifts/handover', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { date, shiftCode = 'SHIFT_1', cashBalance = 0, discrepancies = [], notes = '' } = req.body || {};

    const handover = await shiftHandoverRepo.create({
      date: date || new Date().toISOString().slice(0, 10),
      shiftCode,
      fromStaffId: user.userId,
      fromStaffName: user.fullName || user.username,
      handoverType: 'TANG_1',
      cashBalance: Number(cashBalance) || 0,
      discrepancies: Array.isArray(discrepancies) ? discrepancies : [],
      status: 'PENDING',
      notes: String(notes).trim(),
    });

    res.status(201).json({
      data: handover,
      meta: { message: 'Biên bản bàn giao Kho Tầng 1 đã được gửi, đang chờ ca sau xác nhận' },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/handover/:id/confirm (Sales Ca 2 xác nhận nhận bàn giao ca)
shiftsRouter.post('/shifts/handover/:id/confirm', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');

    const { id } = req.params;
    const handover = await shiftHandoverRepo.findById(id);
    if (!handover) {
      throw new ApiError(404, 'HANDOVER_NOT_FOUND', 'Không tìm thấy biên bản bàn giao ca');
    }

    const { accept = true, note = '' } = req.body || {};

    const updated = await shiftHandoverRepo.updateById(id, {
      toStaffId: user.userId,
      toStaffName: user.fullName || user.username,
      status: accept ? 'ACCEPTED' : 'PENDING',
      acceptedAt: accept ? new Date() : undefined,
      notes: note ? `${handover.notes} | Xác nhận: ${note}` : handover.notes,
    });

    res.json({
      data: updated,
      meta: {
        message: accept
          ? 'Đã xác nhận nhận bàn giao ca thành công! Nút Check-out của ca trước đã được mở khóa.'
          : 'Đã từ chối bàn giao ca, yêu cầu kiểm đếm lại.',
      },
    });
  } catch (err) {
    next(err);
  }
});

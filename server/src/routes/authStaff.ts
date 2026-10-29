import { Router } from 'express';
import { staffRepo } from '../config/db';
import { hashPassword, verifyPassword, signToken } from '../utils/auth';
import { ApiError } from '../utils/errors';

export const authStaffRouter = Router();

// POST /api/v1/auth/login
authStaffRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tên đăng nhập và mật khẩu', {
        username: !username ? 'Bắt buộc' : '',
        password: !password ? 'Bắt buộc' : '',
      });
    }

    const staff = await staffRepo.findOne({ username: String(username).trim().toLowerCase() });
    if (!staff || !verifyPassword(String(password), staff.passwordHash)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
    }

    if (staff.status === 'LOCKED') {
      throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản nhân viên đã bị khóa');
    }

    const token = signToken({
      userId: staff._id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      code: staff.code,
    });

    res.json({
      data: {
        token,
        user: {
          _id: staff._id,
          code: staff.code,
          username: staff.username,
          fullName: staff.fullName,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
        },
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/staff
authStaffRouter.get('/staff', async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const allStaff = await staffRepo.find({}, { createdAt: 1 });

    const filtered = allStaff
      .filter((s) => {
        if (role && s.role !== role) return false;
        if (status && s.status !== status) return false;
        if (search) {
          const q = String(search).toLowerCase();
          const match =
            s.username.toLowerCase().includes(q) ||
            s.fullName.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            (s.phone || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .map(({ passwordHash, ...rest }) => rest);

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/staff
authStaffRouter.post('/staff', async (req, res, next) => {
  try {
    const { username, password, fullName, phone, role } = req.body || {};
    if (!username || !password || !fullName) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu thông tin bắt buộc của nhân viên', {
        username: !username ? 'Tên đăng nhập bắt buộc' : '',
        password: !password ? 'Mật khẩu bắt buộc' : '',
        fullName: !fullName ? 'Họ tên bắt buộc' : '',
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await staffRepo.findOne({ username: cleanUsername });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_USERNAME', 'Tên đăng nhập đã tồn tại', {
        username: 'Đã tồn tại',
      });
    }

    const validRoles = ['SALES', 'WAREHOUSE', 'ADMIN'];
    const staffRole = validRoles.includes(role) ? role : 'SALES';

    const count = await staffRepo.countDocuments({});
    const code = `NV${String(count + 1).padStart(3, '0')}`;

    const created = await staffRepo.create({
      code,
      username: cleanUsername,
      passwordHash: hashPassword(String(password)),
      fullName: String(fullName).trim(),
      phone: phone ? String(phone).trim() : '',
      role: staffRole,
      status: 'ACTIVE',
    });

    const { passwordHash, ...safeStaff } = created;
    res.status(201).json({
      data: safeStaff,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/staff/:id
authStaffRouter.patch('/staff/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const staff = await staffRepo.findById(id);
    if (!staff) {
      throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên');
    }

    const { fullName, phone, role, status, password } = req.body || {};
    const updateData: Record<string, any> = {};

    if (fullName !== undefined) updateData.fullName = String(fullName).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (role !== undefined) {
      if (!['SALES', 'WAREHOUSE', 'ADMIN'].includes(role)) {
        throw new ApiError(400, 'INVALID_ROLE', 'Vai trò không hợp lệ');
      }
      updateData.role = role;
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'LOCKED'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái không hợp lệ');
      }
      updateData.status = status;
    }
    if (password) {
      updateData.passwordHash = hashPassword(String(password));
    }

    const updated = await staffRepo.updateById(id, updateData);
    const { passwordHash, ...safeStaff } = updated!;
    res.json({
      data: safeStaff,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

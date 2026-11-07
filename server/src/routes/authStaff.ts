import { Router } from 'express';
import { staffRepo } from '../config/db';
import { hashPassword, verifyPassword, signToken } from '../utils/auth';
import { ApiError } from '../utils/errors';
import { filterAndRankBySearch } from '../utils/search';

/** Loại hợp đồng được phép chọn khi tạo/cập nhật: Thực tập, Thử việc, Chính thức */
const VALID_CONTRACT_TYPES = ['INTERN', 'PROBATION', 'FULLTIME'];

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
      department: staff.department || (['HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staff.role) ? 'OFFICE' : 'SALES'),
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
          phone: staff.phone || '',
          email: staff.email || '',
          role: staff.role,
          department: staff.department || (['HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staff.role) ? 'OFFICE' : 'SALES'),
          contractType: staff.contractType || 'PROBATION',
          citizenId: staff.citizenId || '',
          address: staff.address || '',
          contractStartDate: staff.contractStartDate,
          contractEndDate: staff.contractEndDate,
          contractFileUrl: staff.contractFileUrl || '',
          contractFileName: staff.contractFileName || '',
          status: staff.status,
        },
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/change-password
authStaffRouter.post('/auth/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword, username } = req.body || {};
    if (!currentPassword || !newPassword) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới',
        {
          currentPassword: !currentPassword ? 'Bắt buộc' : '',
          newPassword: !newPassword ? 'Bắt buộc' : '',
        }
      );
    }

    const cleanNewPassword = String(newPassword).trim();
    if (cleanNewPassword.length < 4) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Mật khẩu mới phải có ít nhất 4 ký tự',
        { newPassword: 'Tối thiểu 4 ký tự' }
      );
    }

    let staff = null;
    if (req.user?.userId) {
      staff = await staffRepo.findById(req.user.userId);
    }
    if (!staff && username) {
      staff = await staffRepo.findOne({
        username: String(username).trim().toLowerCase(),
      });
    }
    if (!staff && req.user?.username) {
      staff = await staffRepo.findOne({
        username: String(req.user.username).trim().toLowerCase(),
      });
    }

    if (!staff) {
      throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy tài khoản cần đổi mật khẩu');
    }

    if (!verifyPassword(String(currentPassword), staff.passwordHash)) {
      throw new ApiError(
        400,
        'INVALID_CURRENT_PASSWORD',
        'Mật khẩu hiện tại không chính xác',
        { currentPassword: 'Không chính xác' }
      );
    }

    await staffRepo.updateById(staff._id, {
      passwordHash: hashPassword(cleanNewPassword),
    });

    res.json({
      data: {
        changed: true,
        _id: staff._id,
        username: staff.username,
        fullName: staff.fullName,
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

    const baseFiltered = allStaff
      .filter((s) => {
        if (role && s.role !== role) return false;
        if (status && s.status !== status) return false;
        return true;
      })
      .map(({ passwordHash, ...rest }) => rest);

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (s) => [
          { text: s.code, weight: 1.5 },
          { text: s.username, weight: 1.4 },
          { text: s.fullName, weight: 1.3 },
          { text: s.phone, weight: 1.3 },
          { text: s.role, weight: 0.8 },
        ])
      : baseFiltered;

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
    const {
      username,
      password,
      fullName,
      phone,
      email,
      role = 'SALES',
      department,
      contractType = 'PROBATION',
      citizenId,
      address,
      contractStartDate,
      contractEndDate,
      contractFileUrl,
      contractFileName,
    } = req.body || {};

    if (!username || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu thông tin bắt buộc của nhân viên', {
        username: !username ? 'Tên đăng nhập bắt buộc' : '',
        password: !password ? 'Mật khẩu bắt buộc' : '',
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanFullName = fullName && String(fullName).trim() ? String(fullName).trim() : cleanUsername;
    const existing = await staffRepo.findOne({ username: cleanUsername });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_USERNAME', 'Tên đăng nhập đã tồn tại', {
        username: 'Đã tồn tại',
      });
    }

    if (!VALID_CONTRACT_TYPES.includes(contractType)) {
      throw new ApiError(400, 'INVALID_CONTRACT_TYPE', 'Loại hợp đồng phải là Thực tập, Thử việc hoặc Chính thức');
    }

    const validRoles = ['SALES', 'WAREHOUSE', 'ADMIN', 'HR', 'ACCOUNTANT', 'MARKETING'];
    const staffRole = validRoles.includes(role) ? role : 'SALES';
    if (staffRole === 'ADMIN' && req.user && req.user.role !== 'ADMIN') {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'HR không được phép tạo tài khoản có quyền Quản trị viên (ADMIN)'
      );
    }
    const staffDept = department || (['HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staffRole) ? 'OFFICE' : 'SALES');

    const count = await staffRepo.countDocuments({});
    const code = `NV${String(count + 1).padStart(3, '0')}`;

    const created = await staffRepo.create({
      code,
      username: cleanUsername,
      passwordHash: hashPassword(String(password)),
      fullName: cleanFullName,
      phone: phone ? String(phone).trim() : '',
      email: email ? String(email).trim() : '',
      role: staffRole,
      department: staffDept,
      contractType,
      citizenId: citizenId ? String(citizenId).trim() : '',
      address: address ? String(address).trim() : '',
      contractStartDate: contractStartDate ? new Date(contractStartDate) : undefined,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
      contractFileUrl: contractFileUrl ? String(contractFileUrl) : '',
      contractFileName: contractFileName ? String(contractFileName).trim() : '',
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

    const {
      fullName,
      phone,
      email,
      role,
      department,
      contractType,
      citizenId,
      address,
      contractStartDate,
      contractEndDate,
      contractFileUrl,
      contractFileName,
      status,
      password,
    } = req.body || {};
    const updateData: Record<string, any> = {};

    if (req.user && req.user.role !== 'ADMIN') {
      if (staff.role === 'ADMIN') {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'HR không được phép chỉnh sửa tài khoản Quản trị viên (ADMIN)'
        );
      }
      if (role === 'ADMIN') {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'HR không được phép cấp quyền Quản trị viên (ADMIN) cho nhân sự'
        );
      }
    }

    if (fullName !== undefined) updateData.fullName = String(fullName).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (email !== undefined) updateData.email = String(email).trim();
    if (role !== undefined) {
      if (!['SALES', 'WAREHOUSE', 'ADMIN', 'HR', 'ACCOUNTANT', 'MARKETING'].includes(role)) {
        throw new ApiError(400, 'INVALID_ROLE', 'Vai trò không hợp lệ');
      }
      updateData.role = role;
    }
    if (department !== undefined) {
      if (!['OFFICE', 'SALES'].includes(department)) {
        throw new ApiError(400, 'INVALID_DEPARTMENT', 'Phòng ban không hợp lệ');
      }
      updateData.department = department;
    }
    if (contractType !== undefined) {
      if (!VALID_CONTRACT_TYPES.includes(contractType) && contractType !== 'PARTTIME') {
        throw new ApiError(400, 'INVALID_CONTRACT_TYPE', 'Loại hợp đồng phải là Thực tập, Thử việc hoặc Chính thức');
      }
      updateData.contractType = contractType;
    }
    if (citizenId !== undefined) updateData.citizenId = String(citizenId).trim();
    if (address !== undefined) updateData.address = String(address).trim();
    if (contractStartDate !== undefined) updateData.contractStartDate = contractStartDate ? new Date(contractStartDate) : undefined;
    if (contractEndDate !== undefined) updateData.contractEndDate = contractEndDate ? new Date(contractEndDate) : undefined;
    if (contractFileUrl !== undefined || contractFileName !== undefined) {
      if (req.user && !['HR', 'ADMIN'].includes(req.user.role)) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Chỉ Nhân sự (HR) mới được phép tải lên, chỉnh sửa hoặc xóa file hợp đồng'
        );
      }
      if (contractFileUrl !== undefined) updateData.contractFileUrl = String(contractFileUrl);
      if (contractFileName !== undefined) updateData.contractFileName = String(contractFileName).trim();
    }
    if (status !== undefined) {
      if (req.user && req.user.role !== 'ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản trị viên (ADMIN) mới được phép khóa hoặc mở khóa tài khoản');
      }
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

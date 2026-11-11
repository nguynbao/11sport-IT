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
          companyEmail: staff.companyEmail || '',
          role: staff.role,
          department: staff.department || (['HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staff.role) ? 'OFFICE' : 'SALES'),
          contractType: staff.contractType || 'PROBATION',
          citizenId: staff.citizenId || '',
          address: staff.address || '',
          contractStartDate: staff.contractStartDate,
          contractEndDate: staff.contractEndDate,
          probationStartDate: (staff as any).probationStartDate,
          probationMonths: Number((staff as any).probationMonths ?? (staff.contractType === 'PROBATION' ? 2 : 0)),
          fulltimeStartDate: (staff as any).fulltimeStartDate,
          contractFileUrl: staff.contractFileUrl || '',
          contractFileName: staff.contractFileName || '',
          baseSalary: Number(staff.baseSalary || 0),
          allowance: Number(staff.allowance || 0),
          bonus: Number(staff.bonus || 0),
          insurance: Number(staff.insurance || 0),
          mustChangePassword: Boolean(staff.mustChangePassword),
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
      mustChangePassword: false,
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
    const { role, department, contractType, status, search, sortBy, sortOrder } = req.query;
    const allStaff = await staffRepo.find({}, { createdAt: 1 });
    const canViewAllSalaries =
      !req.user || ['HR', 'ADMIN', 'ACCOUNTANT'].includes(req.user.role);

    const baseFiltered = allStaff
      .filter((s) => {
        if (role && s.role !== role) return false;
        if (department && s.department !== department) return false;
        if (contractType && s.contractType !== contractType) return false;
        if (status && s.status !== status) return false;
        return true;
      })
      .map(({ passwordHash, ...rest }) => {
        const isSelf = req.user && String(rest._id) === String(req.user.userId);
        const showSalary = canViewAllSalaries || isSelf;
        return {
          ...rest,
          baseSalary: showSalary ? Number(rest.baseSalary || 0) : 0,
          allowance: showSalary ? Number(rest.allowance || 0) : 0,
          bonus: showSalary ? Number(rest.bonus || 0) : 0,
          insurance: showSalary ? Number(rest.insurance || 0) : 0,
        };
      });

    let result = search
      ? filterAndRankBySearch(baseFiltered, String(search), (s) => [
          { text: s.code, weight: 1.5 },
          { text: s.username, weight: 1.4 },
          { text: s.fullName, weight: 1.3 },
          { text: s.phone, weight: 1.3 },
          { text: s.citizenId || '', weight: 1.2 },
          { text: s.email || '', weight: 1.0 },
          { text: s.companyEmail || '', weight: 1.0 },
          { text: s.role, weight: 0.8 },
        ])
      : baseFiltered;

    if (sortBy) {
      const dir = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;
      const field = String(sortBy);
      result = [...result].sort((a: any, b: any) => {
        if (['baseSalary', 'allowance', 'bonus', 'insurance'].includes(field)) {
          return (Number(a[field] || 0) - Number(b[field] || 0)) * dir;
        }
        if (field === 'createdAt') {
          return (
            (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * dir
          );
        }
        return String(a[field] || '').localeCompare(String(b[field] || ''), 'vi') * dir;
      });
    }

    res.json({
      data: result,
      meta: { total: result.length },
    });
  } catch (err) {
    next(err);
  }
});

function parseSalaryField(val: any, fieldLabel: string): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldLabel} phải là số không âm`);
  }
  return Math.round(num);
}

// POST /api/v1/staff
authStaffRouter.post('/staff', async (req, res, next) => {
  try {
    const {
      username,
      password,
      fullName,
      phone,
      email,
      companyEmail,
      role = 'SALES',
      department,
      contractType = 'PROBATION',
      citizenId,
      address,
      contractStartDate,
      contractEndDate,
      probationStartDate,
      probationMonths,
      fulltimeStartDate,
      contractFileUrl,
      contractFileName,
      baseSalary,
      allowance,
      bonus,
      insurance,
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

    if (probationMonths !== undefined && probationMonths !== null && probationMonths !== '') {
      const pm = Number(probationMonths);
      if (!Number.isFinite(pm) || pm < 0 || pm > 2) {
        throw new ApiError(
          400,
          'PROBATION_MAX_2_MONTHS',
          'Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng)'
        );
      }
    }

    const parsedStart = contractStartDate ? new Date(contractStartDate) : undefined;
    let parsedEnd = contractEndDate ? new Date(contractEndDate) : undefined;
    let parsedProbStart = probationStartDate ? new Date(probationStartDate) : undefined;
    let parsedFulltimeStart = fulltimeStartDate ? new Date(fulltimeStartDate) : undefined;
    let resolvedProbMonths = 0;

    if (contractType === 'PROBATION') {
      parsedProbStart = parsedProbStart || parsedStart;
      if (probationMonths !== undefined && probationMonths !== null && probationMonths !== '') {
        resolvedProbMonths = Math.min(2, Math.max(1, Math.round(Number(probationMonths))));
      } else if (parsedStart && parsedEnd) {
        const diffDays = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / 86400000);
        if (diffDays > 65) {
          throw new ApiError(
            400,
            'PROBATION_MAX_2_MONTHS',
            'Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng)'
          );
        }
        resolvedProbMonths = diffDays <= 35 ? 1 : 2;
      } else {
        // Mặc định thử việc là 2 tháng (tối đa 2 tháng, có thể ký chính thức sau 1 tháng)
        resolvedProbMonths = 2;
      }
      if (parsedStart && !parsedEnd) {
        const autoEnd = new Date(parsedStart);
        autoEnd.setMonth(autoEnd.getMonth() + resolvedProbMonths);
        parsedEnd = autoEnd;
      } else if (parsedStart && parsedEnd) {
        const diffDays = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / 86400000);
        if (diffDays > 65) {
          throw new ApiError(
            400,
            'PROBATION_MAX_2_MONTHS',
            'Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng)'
          );
        }
      }
    } else if (contractType === 'FULLTIME') {
      parsedFulltimeStart = parsedFulltimeStart || parsedStart;
      if (probationMonths !== undefined && probationMonths !== null && probationMonths !== '') {
        resolvedProbMonths = Math.min(2, Math.max(0, Math.round(Number(probationMonths))));
      } else if (parsedProbStart && parsedFulltimeStart && parsedFulltimeStart > parsedProbStart) {
        const mDiff =
          (parsedFulltimeStart.getFullYear() - parsedProbStart.getFullYear()) * 12 +
          (parsedFulltimeStart.getMonth() - parsedProbStart.getMonth());
        resolvedProbMonths = Math.min(2, Math.max(1, mDiff || 1));
      } else {
        resolvedProbMonths = 0;
      }
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

    const hasSalaryFields =
      baseSalary !== undefined ||
      allowance !== undefined ||
      bonus !== undefined ||
      insurance !== undefined;
    if (hasSalaryFields && req.user && req.user.role !== 'HR') {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Nhân sự (HR) mới được phép chỉnh sửa lương cơ bản, trợ cấp, thưởng và bảo hiểm'
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
      companyEmail: companyEmail ? String(companyEmail).trim() : '',
      role: staffRole,
      department: staffDept,
      contractType,
      citizenId: citizenId ? String(citizenId).trim() : '',
      address: address ? String(address).trim() : '',
      contractStartDate: parsedStart,
      contractEndDate: parsedEnd,
      probationStartDate: parsedProbStart,
      probationMonths: resolvedProbMonths,
      fulltimeStartDate: parsedFulltimeStart,
      contractFileUrl: contractFileUrl ? String(contractFileUrl) : '',
      contractFileName: contractFileName ? String(contractFileName).trim() : '',
      baseSalary: baseSalary !== undefined ? parseSalaryField(baseSalary, 'Lương cơ bản') : 0,
      allowance: allowance !== undefined ? parseSalaryField(allowance, 'Trợ cấp') : 0,
      bonus: bonus !== undefined ? parseSalaryField(bonus, 'Thưởng') : 0,
      insurance: insurance !== undefined ? parseSalaryField(insurance, 'Bảo hiểm') : 0,
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
      companyEmail,
      role,
      department,
      contractType,
      citizenId,
      address,
      contractStartDate,
      contractEndDate,
      probationStartDate,
      probationMonths,
      fulltimeStartDate,
      contractFileUrl,
      contractFileName,
      baseSalary,
      allowance,
      bonus,
      insurance,
      status,
      password,
    } = req.body || {};
    const updateData: Record<string, any> = {};

    if (probationMonths !== undefined && probationMonths !== null && probationMonths !== '') {
      const pm = Number(probationMonths);
      if (!Number.isFinite(pm) || pm < 0 || pm > 2) {
        throw new ApiError(
          400,
          'PROBATION_MAX_2_MONTHS',
          'Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng)'
        );
      }
      updateData.probationMonths = Math.min(2, Math.max(0, Math.round(pm)));
    }

    const hasSalaryFields =
      baseSalary !== undefined ||
      allowance !== undefined ||
      bonus !== undefined ||
      insurance !== undefined;
    if (hasSalaryFields) {
      if (!req.user || req.user.role !== 'HR') {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Chỉ Nhân sự (HR) mới được phép chỉnh sửa lương cơ bản, trợ cấp, thưởng và bảo hiểm'
        );
      }
      if (baseSalary !== undefined) updateData.baseSalary = parseSalaryField(baseSalary, 'Lương cơ bản');
      if (allowance !== undefined) updateData.allowance = parseSalaryField(allowance, 'Trợ cấp');
      if (bonus !== undefined) updateData.bonus = parseSalaryField(bonus, 'Thưởng');
      if (insurance !== undefined) updateData.insurance = parseSalaryField(insurance, 'Bảo hiểm');
    }

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
    if (companyEmail !== undefined) updateData.companyEmail = String(companyEmail).trim();
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
    if (probationStartDate !== undefined) updateData.probationStartDate = probationStartDate ? new Date(probationStartDate) : undefined;
    if (fulltimeStartDate !== undefined) updateData.fulltimeStartDate = fulltimeStartDate ? new Date(fulltimeStartDate) : undefined;

    const nextContractType = contractType ?? staff.contractType;
    if (nextContractType === 'PROBATION') {
      const pStart = updateData.contractStartDate ?? staff.contractStartDate;
      const pEnd = updateData.contractEndDate ?? staff.contractEndDate;
      if (pStart && pEnd) {
        const diffDays = Math.round((new Date(pEnd).getTime() - new Date(pStart).getTime()) / 86400000);
        if (diffDays > 65) {
          throw new ApiError(
            400,
            'PROBATION_MAX_2_MONTHS',
            'Thời gian thử việc mặc định tối đa 2 tháng (có thể ký chính thức sau 1 tháng)'
          );
        }
        if (
          updateData.probationMonths === undefined &&
          (contractStartDate !== undefined || contractEndDate !== undefined)
        ) {
          updateData.probationMonths = diffDays <= 35 ? 1 : 2;
        }
      }
      if (updateData.probationMonths === undefined && !(staff as any).probationMonths) {
        updateData.probationMonths = 2;
      }
      if (pStart && !updateData.probationStartDate && !(staff as any).probationStartDate) {
        updateData.probationStartDate = new Date(pStart);
      }
    } else if (staff.contractType === 'PROBATION' && contractType === 'FULLTIME') {
      // Khi chuyển từ hợp đồng Thử việc lên hợp đồng Chính thức:
      // Bảo lưu ngày phép giai đoạn thử việc (1 hoặc 2 tháng, mặc định 2 tháng)
      const prevProbStart =
        updateData.probationStartDate || (staff as any).probationStartDate || staff.contractStartDate;
      if (prevProbStart) {
        updateData.probationStartDate = new Date(prevProbStart);
      }
      const prevProbEnd = updateData.contractEndDate ?? staff.contractEndDate;
      const nextFtStart =
        updateData.fulltimeStartDate ||
        (contractStartDate ? new Date(contractStartDate) : undefined);

      if (updateData.probationMonths === undefined) {
        const existingProbMonths = Number((staff as any).probationMonths || 0);
        if (prevProbStart && nextFtStart && new Date(nextFtStart) > new Date(prevProbStart)) {
          const mDiff =
            (new Date(nextFtStart).getFullYear() - new Date(prevProbStart).getFullYear()) * 12 +
            (new Date(nextFtStart).getMonth() - new Date(prevProbStart).getMonth());
          updateData.probationMonths =
            mDiff >= 1
              ? Math.min(2, Math.max(1, mDiff))
              : existingProbMonths >= 1 && existingProbMonths <= 2
                ? existingProbMonths
                : 2;
        } else if (prevProbStart && prevProbEnd && new Date(prevProbEnd) > new Date(prevProbStart)) {
          const diffDays = Math.round(
            (new Date(prevProbEnd).getTime() - new Date(prevProbStart).getTime()) / 86400000
          );
          updateData.probationMonths = diffDays <= 35 ? 1 : 2;
        } else {
          updateData.probationMonths =
            existingProbMonths >= 1 && existingProbMonths <= 2 ? existingProbMonths : 2;
        }
      }

      if (nextFtStart) {
        updateData.fulltimeStartDate = new Date(nextFtStart);
      } else if (prevProbStart) {
        const autoFt = new Date(prevProbStart);
        autoFt.setMonth(autoFt.getMonth() + Number(updateData.probationMonths || 2));
        const now = new Date();
        updateData.fulltimeStartDate = autoFt > now ? now : autoFt;
      }
    } else if (nextContractType === 'FULLTIME' && contractStartDate !== undefined && fulltimeStartDate === undefined) {
      updateData.fulltimeStartDate = contractStartDate ? new Date(contractStartDate) : undefined;
    }
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
      updateData.mustChangePassword = false;
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

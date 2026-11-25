import { staffRepo } from "../../repositories";
import { hashPassword, signToken, verifyPassword } from "../../shared/auth";
import { invalidateStaffAuthCache } from "../../middleware/auth";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";

export async function login(body: any): Promise<ServiceResult> {
  const { username, password } = body || {};
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
      department: staff.department || (['CEO', 'HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staff.role) ? 'OFFICE' : 'SALES'),
      code: staff.code,
    });

    return ok({
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
          department: staff.department || (['CEO', 'HR', 'ACCOUNTANT', 'MARKETING', 'ADMIN'].includes(staff.role) ? 'OFFICE' : 'SALES'),
          positionTitle: (staff as any).positionTitle || '',
          contractType: staff.contractType || 'PROBATION',
          dateOfBirth: (staff as any).dateOfBirth,
          gender: (staff as any).gender || '',
          nationality: (staff as any).nationality || '',
          citizenId: staff.citizenId || '',
          citizenIssueDate: (staff as any).citizenIssueDate,
          citizenIssuePlace: (staff as any).citizenIssuePlace || '',
          address: staff.address || (staff as any).permanentAddress || (staff as any).currentAddress || '',
          permanentAddress: (staff as any).permanentAddress || staff.address || '',
          currentAddress: (staff as any).currentAddress || '',
          school: (staff as any).school || '',
          major: (staff as any).major || '',
          bankAccount: (staff as any).bankAccount || '',
          contractStartDate: staff.contractStartDate,
          contractEndDate: staff.contractEndDate,
          internContractNumber: (staff as any).internContractNumber || '',
          probationContractNumber: (staff as any).probationContractNumber || '',
          officialContractNumber: (staff as any).officialContractNumber || '',
          probationStartDate: (staff as any).probationStartDate,
          probationMonths: Number((staff as any).probationMonths ?? (staff.contractType === 'PROBATION' ? 2 : 0)),
          fulltimeStartDate: (staff as any).fulltimeStartDate,
          contractFileUrl: staff.contractFileUrl || '',
          contractFileName: staff.contractFileName || '',
          bhxhStartDate: (staff as any).bhxhStartDate,
          bhxhEndDate: (staff as any).bhxhEndDate,
          recordedLeaveDays: Number((staff as any).recordedLeaveDays || 0),
          baseSalary: Number(staff.baseSalary || 0),
          allowance: Number(staff.allowance || 0),
          bonus: Number(staff.bonus || 0),
          insurance: Number(staff.insurance || 0),
          mustChangePassword: Boolean(staff.mustChangePassword),
          status: staff.status,
        },
      }, {});
}

export async function changePassword(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const { currentPassword, newPassword, username } = body || {};
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
    if (ctx.user?.userId) {
      staff = await staffRepo.findById(ctx.user.userId);
    }
    if (!staff && username) {
      staff = await staffRepo.findOne({
        username: String(username).trim().toLowerCase(),
      });
    }
    if (!staff && ctx.user?.username) {
      staff = await staffRepo.findOne({
        username: String(ctx.user.username).trim().toLowerCase(),
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
    invalidateStaffAuthCache(String(staff._id));

    return ok({
        changed: true,
        _id: staff._id,
        username: staff.username,
        fullName: staff.fullName,
      }, {});
}


import { serviceOrderRepo, serviceTypeRepo, staffRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { TokenPayload, verifyToken } from "../../shared/auth";
import { ServiceContext } from "../../shared/http";
import { created as createdResult, ok, ServiceResult } from "../../shared/result";
import { filterAndRankBySearch } from "../../shared/search";
import {
  normalizeServiceCode,
  SERVICE_ORDER_ALLOWED_ROLES,
  SERVICE_TYPE_MANAGE_ROLES,
} from "./serviceOrder.rules";

export async function requireServiceRoles(
  ctx: ServiceContext,
  allowedRoles: string[]
): Promise<TokenPayload> {
  const authHeader = ctx.headers?.authorization;
  const userIdHeader = ctx.headers?.['x-user-id'] as string | undefined;

  const hasBearer = Boolean(authHeader && authHeader.startsWith('Bearer '));
  const hasUserIdHeader = Boolean(userIdHeader && String(userIdHeader).trim());

  if (!hasBearer && !hasUserIdHeader) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để thực hiện thao tác này');
  }

  let resolvedUser: TokenPayload | undefined;

  if (hasBearer) {
    const token = authHeader!.slice(7).trim();
    const payload = verifyToken(token);
    if (!payload) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    resolvedUser = payload;
  } else if (hasUserIdHeader) {
    const rawId = String(userIdHeader).trim();
    const staff =
      (await staffRepo.findById(rawId)) ||
      (await staffRepo.findOne({ username: rawId.toLowerCase() })) ||
      (await staffRepo.findOne({ code: rawId.toUpperCase() }));
    if (!staff) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Không tìm thấy thông tin người dùng xác thực');
    }
    if (staff.status === 'LOCKED') {
      throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản nhân viên đã bị khóa');
    }
    resolvedUser = {
      userId: staff._id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
      department: staff.department,
      code: staff.code,
    };
  }

  if (!resolvedUser) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để thực hiện thao tác này');
  }

  const dbStaff = await staffRepo.findById(resolvedUser.userId);
  if (dbStaff && dbStaff.status === 'LOCKED') {
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản nhân viên đã bị khóa');
  }

  const effectiveRole = dbStaff?.role || resolvedUser.role;
  if (!allowedRoles.includes(effectiveRole)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      `Tài khoản vai trò "${effectiveRole}" không có quyền thực hiện thao tác này`
    );
  }

  const finalUser: TokenPayload = {
    ...resolvedUser,
    role: effectiveRole,
    fullName: dbStaff?.fullName || resolvedUser.fullName,
  };
  ctx.user = finalUser;
  return finalUser;
}


export async function listServiceTypes(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_ORDER_ALLOWED_ROLES);
    const { status, search } = query || {};
    const filter: Record<string, any> = {};
    if (status) {
      filter.status = String(status).toUpperCase();
    }

    const types = await serviceTypeRepo.find(filter, { createdAt: 1 });
    const allOrders = await serviceOrderRepo.find({});

    const mapped = types.map((st) => {
      const orderCount = allOrders.filter((ord) =>
        (ord.items || []).some(
          (it: any) =>
            String(it.serviceTypeId) === String(st._id) ||
            String(it.serviceCode) === String(st.code)
        )
      ).length;
      return {
        ...st,
        orderCount,
      };
    });

    const data = search
      ? filterAndRankBySearch(mapped, String(search), (st) => [
          { text: st.code, weight: 1.5 },
          { text: st.name, weight: 1.4 },
          { text: st.description || '', weight: 0.9 },
        ])
      : mapped;

    return ok(data, { total: data.length });
}

export async function createServiceType(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_TYPE_MANAGE_ROLES);
    const { code, name, defaultPrice, unit, description, status } = body || {};
    if (!name || !String(name).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên loại dịch vụ là bắt buộc', {
        name: 'Bắt buộc',
      });
    }

    const rawCode = code && String(code).trim() ? String(code).trim() : `DV_${String(name).trim()}`;
    const normalizedCode = normalizeServiceCode(rawCode);
    if (!normalizedCode) {
      throw new ApiError(400, 'INVALID_SERVICE_CODE', 'Mã loại dịch vụ không hợp lệ');
    }

    const existing = await serviceTypeRepo.findOne({ code: normalizedCode });
    if (existing) {
      throw new ApiError(
        400,
        'DUPLICATE_SERVICE_CODE',
        `Mã loại dịch vụ "${normalizedCode}" đã tồn tại`,
        { code: 'Mã đã tồn tại' }
      );
    }

    const parsedPrice = Math.max(0, Math.round(Number(defaultPrice) || 0));

    const created = await serviceTypeRepo.create({
      code: normalizedCode,
      name: String(name).trim(),
      defaultPrice: parsedPrice,
      unit: unit && String(unit).trim() ? String(unit).trim() : 'Cây',
      description: description ? String(description).trim() : '',
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

    return createdResult({ ...created, orderCount: 0 }, {});
}

export async function updateServiceType(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_TYPE_MANAGE_ROLES);
        const serviceType = await serviceTypeRepo.findById(id);
    if (!serviceType) {
      throw new ApiError(404, 'SERVICE_TYPE_NOT_FOUND', 'Không tìm thấy loại dịch vụ');
    }

    const { name, defaultPrice, unit, description, status } = body || {};
    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Tên loại dịch vụ không được để trống');
      }
      updateData.name = String(name).trim();
    }
    if (defaultPrice !== undefined) {
      const parsed = Math.round(Number(defaultPrice));
      if (isNaN(parsed) || parsed < 0) {
        throw new ApiError(400, 'INVALID_PRICE', 'Giá dịch vụ phải là số nguyên >= 0');
      }
      updateData.defaultPrice = parsed;
    }
    if (unit !== undefined) {
      updateData.unit = String(unit).trim() || 'Cây';
    }
    if (description !== undefined) {
      updateData.description = String(description).trim();
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái phải là ACTIVE hoặc INACTIVE');
      }
      updateData.status = status;
    }

    const updated = await serviceTypeRepo.updateById(id, updateData);
    const allOrders = await serviceOrderRepo.find({});
    const orderCount = allOrders.filter((ord) =>
      (ord.items || []).some(
        (it: any) =>
          String(it.serviceTypeId) === String(id) ||
          String(it.serviceCode) === String(serviceType.code)
      )
    ).length;

    return ok({ ...updated, orderCount }, {});
}

export async function deleteServiceType(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_TYPE_MANAGE_ROLES);
        const serviceType = await serviceTypeRepo.findById(id);
    if (!serviceType) {
      throw new ApiError(404, 'SERVICE_TYPE_NOT_FOUND', 'Không tìm thấy loại dịch vụ');
    }

    const allOrders = await serviceOrderRepo.find({});
    const orderCount = allOrders.filter((ord) =>
      (ord.items || []).some(
        (it: any) =>
          String(it.serviceTypeId) === String(id) ||
          String(it.serviceCode) === String(serviceType.code)
      )
    ).length;

    if (orderCount > 0) {
      throw new ApiError(
        400,
        'SERVICE_TYPE_IN_USE',
        'Không thể xóa loại dịch vụ đã phát sinh đơn; chỉ được chuyển sang Ngừng sử dụng',
        { serviceTypeId: `Đang có ${orderCount} đơn dịch vụ` }
      );
    }

    await serviceTypeRepo.deleteById(id);
    return ok({ deleted: true, _id: id, code: serviceType.code, name: serviceType.name }, {});
}


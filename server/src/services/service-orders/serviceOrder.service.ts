import { customerRepo, serviceOrderRepo, serviceTypeRepo } from "../../repositories";
import type {
  IServiceOrderItem,
  IServicePaymentRecord,
  ServiceDiscountType,
  ServiceOrderStatus,
  ServicePaymentMethod,
} from "../../models/ServiceOrder";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created as createdResult, ok, ServiceResult } from "../../shared/result";
import { withPagination } from "../../shared/pagination";
import { filterAndRankBySearch, normalizePhoneDigits } from "../../shared/search";
import {
  computePaymentStatus,
  enrichServiceOrder,
  normalizeServiceCode,
  parseDateTimeInput,
  SERVICE_ORDER_ALLOWED_ROLES,
  SERVICE_ORDER_MUTATE_ROLES,
  SERVICE_TYPE_MANAGE_ROLES,
} from "./serviceOrder.rules";
import { requireServiceRoles } from "./serviceType.service";

async function generateNextServiceOrderCode(): Promise<string> {
  const all = await serviceOrderRepo.find({});
  let maxNum = 0;
  for (const o of all) {
    const m = /^DV-(\d+)$/i.exec(String(o.orderCode || '').trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `DV-${String(maxNum + 1).padStart(4, '0')}`;
}


async function upsertCustomerFromServiceOrder(
  customerPhone: string,
  customerName: string
): Promise<string> {
  const cleanPhone = String(customerPhone || '').replace(/\s+/g, '').trim();
  const cleanName = String(customerName || '').trim();
  if (!cleanPhone) return '';

  const normPhone = normalizePhoneDigits(cleanPhone);
  const allCustomers = await customerRepo.find({});
  const existing =
    (await customerRepo.findOne({ phone: cleanPhone })) ||
    (normPhone
      ? allCustomers.find((c) => normalizePhoneDigits(c.phone) === normPhone) || null
      : null);

  if (existing) {
    if (cleanName && cleanName !== existing.name) {
      await customerRepo.updateById(existing._id, { name: cleanName });
    }
    return String(existing._id);
  }

  const created = await customerRepo.create({
    phone: normPhone || cleanPhone,
    name: cleanName || 'Khách dịch vụ',
    totalOrders: 0,
    totalSpent: 0,
    lastOrderAt: new Date(),
  });
  return String(created._id);
}

// ==========================================
// A. DANH MỤC LOẠI DỊCH VỤ (/service-types)
// ==========================================

// GET /api/v1/service-types

// POST /api/v1/service-types

// PATCH /api/v1/service-types/:id

// DELETE /api/v1/service-types/:id

// ==========================================
// B. QUẢN LÝ ĐƠN DỊCH VỤ (/service-orders)
// ==========================================

// GET /api/v1/service-orders

// GET /api/v1/service-orders/:id

async function normalizeAndPriceServiceItems(
  rawItems: any[],
  options?: {
    billDiscountType?: string;
    billDiscountValue?: number;
    paymentMethod?: string;
    hasCardFee?: boolean;
    cardFeePercent?: number;
  }
) {
  const normalizedItems: IServiceOrderItem[] = [];
  let rawSubtotal = 0;
  let itemDiscountTotal = 0;
  let subtotal = 0;

  for (const rawItem of rawItems) {
    let st = null;
    if (rawItem.serviceTypeId) {
      st = await serviceTypeRepo.findById(String(rawItem.serviceTypeId));
    }
    const serviceName = String(rawItem.serviceName || st?.name || '').trim();
    if (!serviceName) {
      throw new ApiError(400, 'INVALID_SERVICE_ITEM', 'Tên dịch vụ không được để trống');
    }
    const serviceCode = String(
      rawItem.serviceCode || st?.code || normalizeServiceCode(`DV_${serviceName}`)
    ).trim();
    const unit = String(rawItem.unit || st?.unit || 'Cây').trim();
    const defaultPrice = Math.max(
      0,
      Math.round(Number(rawItem.defaultPrice ?? st?.defaultPrice ?? 0))
    );
    const unitPrice =
      rawItem.unitPrice !== undefined && rawItem.unitPrice !== null && rawItem.unitPrice !== ''
        ? Math.max(0, Math.round(Number(rawItem.unitPrice) || 0))
        : defaultPrice;
    const quantity = Math.max(1, Math.round(Number(rawItem.quantity) || 1));
    const grossLine = unitPrice * quantity;

    const discountType: ServiceDiscountType = ['NONE', 'PERCENT', 'AMOUNT'].includes(
      String(rawItem.discountType || '').toUpperCase()
    )
      ? (String(rawItem.discountType).toUpperCase() as ServiceDiscountType)
      : 'NONE';
    const discountValue = Math.max(0, Number(rawItem.discountValue) || 0);
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = Math.min(
        grossLine,
        Math.round((grossLine * Math.min(100, discountValue)) / 100)
      );
    } else if (discountType === 'AMOUNT') {
      discountAmount = Math.min(grossLine, Math.round(discountValue));
    }
    const lineTotal = Math.max(0, grossLine - discountAmount);

    rawSubtotal += grossLine;
    itemDiscountTotal += discountAmount;
    subtotal += lineTotal;

    normalizedItems.push({
      serviceTypeId: st ? String(st._id) : String(rawItem.serviceTypeId || ''),
      serviceCode,
      serviceName,
      unit,
      defaultPrice,
      unitPrice,
      quantity,
      discountType,
      discountValue,
      discountAmount,
      lineTotal,
      itemNote: String(rawItem.itemNote || '').trim(),
    });
  }

  const billDiscountType: ServiceDiscountType = ['NONE', 'PERCENT', 'AMOUNT'].includes(
    String(options?.billDiscountType || '').toUpperCase()
  )
    ? (String(options?.billDiscountType).toUpperCase() as ServiceDiscountType)
    : 'NONE';
  const billDiscountValue = Math.max(0, Number(options?.billDiscountValue) || 0);
  let billDiscountAmount = 0;
  if (billDiscountType === 'PERCENT') {
    billDiscountAmount = Math.min(
      subtotal,
      Math.round((subtotal * Math.min(100, billDiscountValue)) / 100)
    );
  } else if (billDiscountType === 'AMOUNT') {
    billDiscountAmount = Math.min(subtotal, Math.round(billDiscountValue));
  }
  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);

  const isCard = String(options?.paymentMethod || '').toUpperCase() === 'CARD';
  const hasCardFee = Boolean(options?.hasCardFee && isCard);
  const cardFeePercent = hasCardFee
    ? options?.cardFeePercent !== undefined && options?.cardFeePercent !== null
      ? Math.max(0, Number(options.cardFeePercent) || 0)
      : 1.8
    : 0;
  const cardFee = hasCardFee ? Math.round((afterBillDiscount * cardFeePercent) / 100) : 0;
  const totalAmount = afterBillDiscount + cardFee;

  return {
    normalizedItems,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountType,
    billDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    hasCardFee,
    cardFeePercent,
    cardFee,
    totalAmount,
  };
}

// POST /api/v1/service-orders

// PATCH /api/v1/service-orders/:id

// PATCH /api/v1/service-orders/:id/status
// - CEO / ADMIN: được chuyển mọi trạng thái xử lý (RECEIVED -> IN_PROGRESS -> READY -> RETURNED / CANCELLED)
// - SALES: chỉ được xác nhận lấy tiền & trả đồ (RETURNED) khi đơn đã được Admin xác nhận làm xong (existing.status === 'READY')
// - ACCOUNTANT: chỉ có quyền xem đơn dịch vụ, không được đổi trạng thái hay thu tiền

// POST /api/v1/service-orders/:id/payments


export async function listServiceOrders(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_ORDER_ALLOWED_ROLES);
    const {
      status,
      paymentStatus,
      overdueOnly,
      search,
      from,
      to,
      dueFrom,
      dueTo,
    } = query || {};

    const allOrdersRaw = await serviceOrderRepo.find({}, { createdAt: -1 });
    const nowMs = Date.now();
    const allOrders = allOrdersRaw.map((o) => enrichServiceOrder(o, nowMs));

    // Tính thống kê tổng quan trước khi lọc trạng thái đơn lẻ (nhưng sau khi lọc theo ngày nếu có)
    let dateFiltered = allOrders;

    if (from) {
      const fromDt = new Date(`${String(from)}T00:00:00.000+07:00`);
      if (!isNaN(fromDt.getTime())) {
        dateFiltered = dateFiltered.filter(
          (o) => new Date(o.receivedAt || o.createdAt).getTime() >= fromDt.getTime()
        );
      }
    }
    if (to) {
      const toDt = new Date(`${String(to)}T23:59:59.999+07:00`);
      if (!isNaN(toDt.getTime())) {
        dateFiltered = dateFiltered.filter(
          (o) => new Date(o.receivedAt || o.createdAt).getTime() <= toDt.getTime()
        );
      }
    }
    if (dueFrom) {
      const dueFromDt = new Date(`${String(dueFrom)}T00:00:00.000+07:00`);
      if (!isNaN(dueFromDt.getTime())) {
        dateFiltered = dateFiltered.filter(
          (o) => o.dueAt && new Date(o.dueAt).getTime() >= dueFromDt.getTime()
        );
      }
    }
    if (dueTo) {
      const dueToDt = new Date(`${String(dueTo)}T23:59:59.999+07:00`);
      if (!isNaN(dueToDt.getTime())) {
        dateFiltered = dateFiltered.filter(
          (o) => o.dueAt && new Date(o.dueAt).getTime() <= dueToDt.getTime()
        );
      }
    }

    const validOrders = dateFiltered.filter((o) => o.status !== 'CANCELLED');
    const meta = {
      totalOrders: dateFiltered.length,
      receivedCount: dateFiltered.filter((o) => o.status === 'RECEIVED').length,
      inProgressCount: dateFiltered.filter((o) => o.status === 'IN_PROGRESS').length,
      readyCount: dateFiltered.filter((o) => o.status === 'READY').length,
      returnedCount: dateFiltered.filter((o) => o.status === 'RETURNED').length,
      cancelledCount: dateFiltered.filter((o) => o.status === 'CANCELLED').length,
      overdueCount: dateFiltered.filter((o) => o.isOverdue).length,
      unpaidCount: validOrders.filter((o) => o.paymentStatus !== 'PAID').length,
      totalRevenue: validOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0),
      totalPaid: validOrders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0),
      totalRemaining: validOrders.reduce((s, o) => s + (Number(o.remainingAmount) || 0), 0),
    };

    let filtered = dateFiltered;
    if (status && String(status).toUpperCase() !== 'ALL') {
      const st = String(status).toUpperCase();
      filtered = filtered.filter((o) => o.status === st);
    }
    if (paymentStatus && String(paymentStatus).toUpperCase() !== 'ALL') {
      const pst = String(paymentStatus).toUpperCase();
      filtered = filtered.filter((o) => o.paymentStatus === pst);
    }
    if (String(overdueOnly) === 'true') {
      filtered = filtered.filter((o) => o.isOverdue);
    }

    if (search && String(search).trim()) {
      filtered = filterAndRankBySearch(filtered, String(search), (o) => [
        { text: o.orderCode, weight: 1.6 },
        { text: o.customerPhone, weight: 1.5 },
        { text: o.customerName, weight: 1.4 },
        {
          text: (o.items || []).map((i: any) => `${i.serviceName} ${i.itemNote || ''}`).join(' '),
          weight: 1.1,
        },
        { text: o.note || '', weight: 0.9 },
      ]);
    }

    return withPagination(filtered, query, meta);
}

export async function getServiceOrderById(ctx: ServiceContext, id: string): Promise<ServiceResult> {
  await requireServiceRoles(ctx, SERVICE_ORDER_ALLOWED_ROLES);
    const order = await serviceOrderRepo.findById(id);
    if (!order) {
      throw new ApiError(404, 'SERVICE_ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ');
    }
    return ok(enrichServiceOrder(order));
}

export async function createServiceOrder(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const actor = await requireServiceRoles(ctx, SERVICE_ORDER_MUTATE_ROLES);
    const {
      customerName,
      customerPhone,
      receivedAt,
      dueAt,
      items,
      billDiscountType,
      billDiscountValue,
      hasCardFee,
      cardFeePercent,
      paidAmount,
      paymentMethod,
      note,
    } = body || {};

    const cleanName = String(customerName || '').trim();
    const cleanPhone = normalizePhoneDigits(String(customerPhone || '')) || String(customerPhone || '').trim();

    if (!cleanName || !cleanPhone) {
      throw new ApiError(
        400,
        'CUSTOMER_REQUIRED',
        'Vui lòng nhập đầy đủ Tên khách hàng và Số điện thoại cho đơn dịch vụ',
        {
          customerName: !cleanName ? 'Bắt buộc nhập tên khách hàng' : '',
          customerPhone: !cleanPhone ? 'Bắt buộc nhập số điện thoại' : '',
        }
      );
    }

    const parsedReceivedAt = parseDateTimeInput(receivedAt) || new Date();
    const parsedDueAt = parseDateTimeInput(dueAt);
    if (!parsedDueAt) {
      throw new ApiError(
        400,
        'DUE_DATE_REQUIRED',
        'Vui lòng chọn Ngày hẹn trả khách',
        { dueAt: 'Bắt buộc chọn ngày hẹn trả' }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(
        400,
        'ITEMS_REQUIRED',
        'Vui lòng chọn ít nhất 1 dịch vụ trong phiếu',
        { items: 'Chưa có dịch vụ nào' }
      );
    }

    const method: ServicePaymentMethod = ['CASH', 'BANKING', 'CARD'].includes(paymentMethod)
      ? paymentMethod
      : 'CASH';

    const pricing = await normalizeAndPriceServiceItems(items, {
      billDiscountType,
      billDiscountValue,
      paymentMethod: method,
      hasCardFee: method === 'CARD' ? (hasCardFee !== undefined ? Boolean(hasCardFee) : false) : false,
      cardFeePercent,
    });

    const {
      normalizedItems,
      rawSubtotal,
      itemDiscountTotal,
      subtotal,
      billDiscountType: resolvedBillDiscountType,
      billDiscountValue: resolvedBillDiscountValue,
      billDiscountAmount,
      hasCardFee: resolvedHasCardFee,
      cardFeePercent: resolvedCardFeePercent,
      cardFee,
      totalAmount,
    } = pricing;

    const requestedPaid =
      paidAmount !== undefined && paidAmount !== null
        ? Math.max(0, Math.round(Number(paidAmount) || 0))
        : 0;
    const finalPaid = Math.min(totalAmount, requestedPaid);
    const remainingAmount = Math.max(0, totalAmount - finalPaid);
    const paymentStatus = computePaymentStatus(totalAmount, finalPaid);

    const actorId = actor.userId;
    const actorName = actor.fullName;

    const payments: IServicePaymentRecord[] = [];
    if (finalPaid > 0) {
      payments.push({
        _id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount: finalPaid,
        method,
        cardFee: finalPaid >= totalAmount ? cardFee : 0,
        note: finalPaid >= totalAmount ? 'Thanh toán đủ lúc gửi đồ' : 'Đặt cọc lúc gửi đồ',
        paidAt: new Date(),
        collectedBy: actorId,
        collectedByName: actorName,
      });
    }

    const customerId = await upsertCustomerFromServiceOrder(cleanPhone, cleanName);
    const orderCode = await generateNextServiceOrderCode();

    const created = await serviceOrderRepo.create({
      orderCode,
      customerId,
      customerName: cleanName,
      customerPhone: cleanPhone,
      receivedAt: parsedReceivedAt,
      dueAt: parsedDueAt,
      returnedAt: null,
      items: normalizedItems,
      rawSubtotal,
      itemDiscountTotal,
      subtotal,
      billDiscountType: resolvedBillDiscountType,
      billDiscountValue: resolvedBillDiscountValue,
      billDiscountAmount,
      hasCardFee: resolvedHasCardFee,
      cardFeePercent: resolvedCardFeePercent,
      cardFee,
      totalAmount,
      paidAmount: finalPaid,
      remainingAmount,
      paymentStatus,
      paymentMethod: method,
      payments,
      status: 'RECEIVED',
      note: String(note || '').trim(),
      createdBy: actorId,
      createdByName: actorName,
      updatedBy: actorId,
      updatedByName: actorName,
    });

    return createdResult(enrichServiceOrder(created), {});
}

export async function updateServiceOrder(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const actor = await requireServiceRoles(ctx, SERVICE_TYPE_MANAGE_ROLES);
        const existing = await serviceOrderRepo.findById(id);
    if (!existing) {
      throw new ApiError(404, 'SERVICE_ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ');
    }

    const {
      customerName,
      customerPhone,
      receivedAt,
      dueAt,
      items,
      billDiscountType,
      billDiscountValue,
      hasCardFee,
      cardFeePercent,
      paymentMethod,
      note,
      status,
    } = body || {};

    const updateData: Record<string, any> = {};

    if (customerName !== undefined) {
      const cleanName = String(customerName).trim();
      if (!cleanName) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Tên khách hàng không được để trống');
      }
      updateData.customerName = cleanName;
    }

    if (customerPhone !== undefined) {
      const cleanPhone =
        normalizePhoneDigits(String(customerPhone)) || String(customerPhone).trim();
      if (!cleanPhone) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Số điện thoại không được để trống');
      }
      updateData.customerPhone = cleanPhone;
    }

    if (updateData.customerPhone || updateData.customerName) {
      const customerId = await upsertCustomerFromServiceOrder(
        updateData.customerPhone || existing.customerPhone,
        updateData.customerName || existing.customerName
      );
      if (customerId) updateData.customerId = customerId;
    }

    if (receivedAt !== undefined) {
      const dt = parseDateTimeInput(receivedAt);
      if (!dt) throw new ApiError(400, 'INVALID_RECEIVED_DATE', 'Ngày gửi không hợp lệ');
      updateData.receivedAt = dt;
    }

    if (dueAt !== undefined) {
      const dt = parseDateTimeInput(dueAt);
      if (!dt) throw new ApiError(400, 'INVALID_DUE_DATE', 'Ngày hẹn trả không hợp lệ');
      updateData.dueAt = dt;
    }

    if (note !== undefined) {
      updateData.note = String(note).trim();
    }

    if (status !== undefined) {
      const validStatuses: ServiceOrderStatus[] = [
        'RECEIVED',
        'IN_PROGRESS',
        'READY',
        'RETURNED',
        'CANCELLED',
      ];
      if (!validStatuses.includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái đơn dịch vụ không hợp lệ');
      }
      updateData.status = status;
      if (status === 'RETURNED' && !existing.returnedAt) {
        updateData.returnedAt = new Date();
      }
    }

    const shouldReprice =
      (Array.isArray(items) && items.length > 0) ||
      billDiscountType !== undefined ||
      billDiscountValue !== undefined ||
      hasCardFee !== undefined ||
      cardFeePercent !== undefined;

    if (shouldReprice) {
      const sourceItems =
        Array.isArray(items) && items.length > 0 ? items : existing.items || [];
      const effectiveMethod: ServicePaymentMethod = ['CASH', 'BANKING', 'CARD'].includes(
        paymentMethod
      )
        ? paymentMethod
        : existing.paymentMethod || 'CASH';

      const pricing = await normalizeAndPriceServiceItems(sourceItems, {
        billDiscountType:
          billDiscountType !== undefined ? billDiscountType : existing.billDiscountType,
        billDiscountValue:
          billDiscountValue !== undefined ? billDiscountValue : existing.billDiscountValue,
        paymentMethod: effectiveMethod,
        hasCardFee:
          hasCardFee !== undefined ? Boolean(hasCardFee) : Boolean(existing.hasCardFee),
        cardFeePercent:
          cardFeePercent !== undefined ? cardFeePercent : existing.cardFeePercent,
      });

      const currentPaid = Number(existing.paidAmount) || 0;
      if (pricing.totalAmount < currentPaid) {
        throw new ApiError(
          400,
          'TOTAL_BELOW_PAID_AMOUNT',
          `Tổng tiền mới (${pricing.totalAmount.toLocaleString('vi-VN')} VND) không được nhỏ hơn số tiền khách đã thanh toán (${currentPaid.toLocaleString('vi-VN')} VND)`,
          {
            totalAmount: 'Không được nhỏ hơn số tiền đã thu',
          }
        );
      }
      const remainingAmount = Math.max(0, pricing.totalAmount - currentPaid);
      updateData.items = pricing.normalizedItems;
      updateData.rawSubtotal = pricing.rawSubtotal;
      updateData.itemDiscountTotal = pricing.itemDiscountTotal;
      updateData.subtotal = pricing.subtotal;
      updateData.billDiscountType = pricing.billDiscountType;
      updateData.billDiscountValue = pricing.billDiscountValue;
      updateData.billDiscountAmount = pricing.billDiscountAmount;
      updateData.hasCardFee = pricing.hasCardFee;
      updateData.cardFeePercent = pricing.cardFeePercent;
      updateData.cardFee = pricing.cardFee;
      updateData.totalAmount = pricing.totalAmount;
      updateData.remainingAmount = remainingAmount;
      updateData.paymentStatus = computePaymentStatus(pricing.totalAmount, currentPaid);
      if (paymentMethod && ['CASH', 'BANKING', 'CARD'].includes(paymentMethod)) {
        updateData.paymentMethod = paymentMethod;
      }
    }

    updateData.updatedBy = actor.userId;
    updateData.updatedByName = actor.fullName;

    const updated = await serviceOrderRepo.updateById(id, updateData);
    return ok(enrichServiceOrder(updated), {});
}

export async function updateServiceOrderStatus(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const actor = await requireServiceRoles(ctx, SERVICE_ORDER_MUTATE_ROLES);
        const existing = await serviceOrderRepo.findById(id);
    if (!existing) {
      throw new ApiError(404, 'SERVICE_ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ');
    }

    const {
      status,
      collectAmount,
      paymentMethod,
      hasCardFee,
      cardFeePercent,
      paymentNote,
    } = body || {};
    const validStatuses: ServiceOrderStatus[] = [
      'RECEIVED',
      'IN_PROGRESS',
      'READY',
      'RETURNED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái xử lý không hợp lệ');
    }

    const isAdminOrAccountant = SERVICE_TYPE_MANAGE_ROLES.includes(actor.role);
    if (!isAdminOrAccountant) {
      if (existing.status !== 'READY' || status !== 'RETURNED') {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Chỉ Quản lý (Admin) mới được cập nhật tiến độ xử lý. Nhân viên bán hàng chỉ được xác nhận lấy tiền & trả đồ khi đơn hàng đã làm xong.'
        );
      }
    }

    const actorId = actor.userId;
    const actorName = actor.fullName;

    const updateData: Record<string, any> = {
      status,
      updatedBy: actorId,
      updatedByName: actorName,
    };

    if (status === 'RETURNED') {
      updateData.returnedAt = existing.returnedAt || new Date();
    }

    const parsedCollect =
      collectAmount !== undefined && collectAmount !== null
        ? Math.max(0, Math.round(Number(collectAmount) || 0))
        : status === 'RETURNED'
          ? Math.max(0, Math.round(Number(existing.remainingAmount) || 0))
          : 0;
    if (parsedCollect > 0) {
      const currentRemaining = Math.max(0, Number(existing.remainingAmount) || 0);
      const actualCollect = Math.min(currentRemaining, parsedCollect);
      if (actualCollect > 0) {
        const method: ServicePaymentMethod = ['CASH', 'BANKING', 'CARD'].includes(paymentMethod)
          ? paymentMethod
          : existing.paymentMethod || 'CASH';

        const applyExtraCardFee =
          method === 'CARD' && Boolean(hasCardFee);
        const pct = applyExtraCardFee
          ? cardFeePercent !== undefined
            ? Math.max(0, Number(cardFeePercent) || 0)
            : 1.8
          : 0;
        const extraCardFee = applyExtraCardFee ? Math.round((actualCollect * pct) / 100) : 0;

        const totalAmount = (Number(existing.totalAmount) || 0) + extraCardFee;
        const paidThisTime = actualCollect + extraCardFee;
        const nextPaid = (Number(existing.paidAmount) || 0) + paidThisTime;
        const nextRemaining = Math.max(0, totalAmount - nextPaid);
        const nextPayments: IServicePaymentRecord[] = [
          ...(existing.payments || []),
          {
            _id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            amount: paidThisTime,
            method,
            cardFee: extraCardFee,
            note: String(paymentNote || 'Thu tiền khi trả đồ cho khách').trim(),
            paidAt: new Date(),
            collectedBy: actorId,
            collectedByName: actorName,
          },
        ];

        if (extraCardFee > 0) {
          updateData.hasCardFee = true;
          updateData.cardFeePercent = pct;
          updateData.cardFee = (Number(existing.cardFee) || 0) + extraCardFee;
          updateData.totalAmount = totalAmount;
        }
        updateData.paidAmount = nextPaid;
        updateData.remainingAmount = nextRemaining;
        updateData.paymentStatus = computePaymentStatus(totalAmount, nextPaid);
        updateData.paymentMethod = method;
        updateData.payments = nextPayments;
      }
    }

    const updated = await serviceOrderRepo.updateById(id, updateData);
    return ok(enrichServiceOrder(updated), {});
}

export async function recordServiceOrderPayment(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const actor = await requireServiceRoles(ctx, SERVICE_ORDER_MUTATE_ROLES);
        const existing = await serviceOrderRepo.findById(id);
    if (!existing) {
      throw new ApiError(404, 'SERVICE_ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ');
    }

    const { amount, method, hasCardFee, cardFeePercent, markReturned, note } = body || {};
    const parsedAmount = Math.round(Number(amount) || 0);
    if (parsedAmount <= 0) {
      throw new ApiError(400, 'INVALID_PAYMENT_AMOUNT', 'Số tiền thu phải lớn hơn 0');
    }

    const currentRemaining = Math.max(0, Number(existing.remainingAmount) || 0);
    if (currentRemaining <= 0) {
      throw new ApiError(400, 'ALREADY_PAID', 'Đơn dịch vụ này đã được thanh toán đủ');
    }

    const collectAmount = Math.min(currentRemaining, parsedAmount);
    const payMethod: ServicePaymentMethod = ['CASH', 'BANKING', 'CARD'].includes(method)
      ? method
      : 'CASH';

    const applyExtraCardFee =
      payMethod === 'CARD' && Boolean(hasCardFee);
    const pct = applyExtraCardFee
      ? cardFeePercent !== undefined
        ? Math.max(0, Number(cardFeePercent) || 0)
        : 1.8
      : 0;
    const extraCardFee = applyExtraCardFee ? Math.round((collectAmount * pct) / 100) : 0;

    const actorId = actor.userId;
    const actorName = actor.fullName;

    const totalAmount = (Number(existing.totalAmount) || 0) + extraCardFee;
    const paidThisTime = collectAmount + extraCardFee;
    const nextPaid = (Number(existing.paidAmount) || 0) + paidThisTime;
    const nextRemaining = Math.max(0, totalAmount - nextPaid);
    const nextPaymentStatus = computePaymentStatus(totalAmount, nextPaid);

    const nextPayments: IServicePaymentRecord[] = [
      ...(existing.payments || []),
      {
        _id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount: paidThisTime,
        method: payMethod,
        cardFee: extraCardFee,
        note: String(note || 'Thu tiền đơn dịch vụ').trim(),
        paidAt: new Date(),
        collectedBy: actorId,
        collectedByName: actorName,
      },
    ];

    const patchFields: Record<string, any> = {
      paidAmount: nextPaid,
      remainingAmount: nextRemaining,
      paymentStatus: nextPaymentStatus,
      paymentMethod: payMethod,
      payments: nextPayments,
      updatedBy: actorId,
      updatedByName: actorName,
    };
    if (Boolean(markReturned) && existing.status === 'READY') {
      patchFields.status = 'RETURNED';
      patchFields.returnedAt = existing.returnedAt || new Date();
    }
    if (extraCardFee > 0) {
      patchFields.hasCardFee = true;
      patchFields.cardFeePercent = pct;
      patchFields.cardFee = (Number(existing.cardFee) || 0) + extraCardFee;
      patchFields.totalAmount = totalAmount;
    }

    const updated = await serviceOrderRepo.updateById(id, patchFields);

    return ok(enrichServiceOrder(updated), {});
}


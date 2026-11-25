import { customerRepo, orderRepo, returnExchangeRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { ok, ServiceResult } from "../../shared/result";
import { filterAndRankBySearch, normalizePhoneDigits } from "../../shared/search";

export async function lookupCustomer(query: any): Promise<ServiceResult> {
  const rawPhone = String(query?.phone || '').replace(/\s+/g, '').trim();
    const normPhone = normalizePhoneDigits(rawPhone);
    if (!rawPhone) {
      throw new ApiError(400, 'PHONE_REQUIRED', 'Vui lòng nhập số điện thoại để tra cứu', {
        phone: 'Bắt buộc',
      });
    }

    const allCustomers = await customerRepo.find({});
    const customer =
      (await customerRepo.findOne({ phone: rawPhone })) ||
      (normPhone
        ? allCustomers.find((c) => normalizePhoneDigits(c.phone) === normPhone) || null
        : null);

    const targetPhone = customer?.phone || normPhone || rawPhone;
    const allOrders = await orderRepo.find({}, { createdAt: -1 });
    const allCustomerOrders = allOrders.filter(
      (o) =>
        o.customerPhone === targetPhone ||
        (normPhone && normalizePhoneDigits(o.customerPhone) === normPhone)
    );
    const allReturns = await returnExchangeRepo.find({}, { createdAt: -1 });
    const allCustomerReturns = allReturns.filter(
      (r) =>
        r.customerPhone === targetPhone ||
        (normPhone && normalizePhoneDigits(r.customerPhone) === normPhone)
    );

    const nowMs = Date.now();
    let totalDebtAmount = 0;
    let unpaidOrdersCount = 0;
    let overdueOrdersCount = 0;

    for (const o of allCustomerOrders) {
      if (o.status === 'DRAFT') continue;
      const debt = Math.max(0, Number(o.debtAmount) || 0);
      if (debt > 0) {
        totalDebtAmount += debt;
        unpaidOrdersCount += 1;
        if (o.debtDueDate && new Date(o.debtDueDate).getTime() < nowMs) {
          overdueOrdersCount += 1;
        }
      }
    }

    // Tra cứu lịch sử khách hàng: trả về toàn bộ đơn hàng và phiếu trả/đổi (không giới hạn ca hay số ngày).
    const orders = allCustomerOrders;
    const returns = allCustomerReturns;

    return ok({
        found: !!customer,
        customer: customer || null,
        orders,
        returns,
        debtSummary: {
          totalDebtAmount,
          unpaidOrdersCount,
          overdueOrdersCount,
        },
      }, {
        orderCount: orders.length,
        returnCount: returns.length,
        totalDebtAmount,
        unpaidOrdersCount,
        overdueOrdersCount,
      });
}

export async function listCustomers(query: any): Promise<ServiceResult> {
  const { search } = query || {};
    const allCustomers = await customerRepo.find({}, { lastOrderAt: -1 });

    const filtered = search
      ? filterAndRankBySearch(allCustomers, String(search), (c) => [
          { text: c.phone, weight: 1.5 },
          { text: c.name, weight: 1.3 },
        ])
      : allCustomers;

    return ok(filtered, { total: filtered.length });
}


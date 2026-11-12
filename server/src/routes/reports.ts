import { Router } from 'express';
import {
  staffRepo,
  orderRepo,
  returnExchangeRepo,
  importReceiptRepo,
  stockMovementRepo,
  productRepo,
  categoryRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { floorLabel, getFloorStocks } from '../utils/warehouseFloor';
import { normalizePhoneDigits } from '../utils/search';

export const reportsRouter = Router();

function extractOrderDebtMeta(o: any, refundedCashForOrder = 0) {
  const totalAmount = Math.max(0, Number(o.totalAmount) || 0);
  let debtAmount = Math.max(0, Number(o.debtAmount) || 0);
  let initialDebtAmount = Math.max(debtAmount, Number(o.initialDebtAmount) || 0);

  const debtPayments = Array.isArray(o.debtPayments) ? o.debtPayments : [];
  const debtAdjustments = Array.isArray(o.debtAdjustments) ? o.debtAdjustments : [];
  const collectedDebtAmount = debtPayments.reduce(
    (s: number, dp: any) => s + Math.max(0, Number(dp?.amount) || 0),
    0
  );
  const reducedByReturnAmount = debtAdjustments.reduce(
    (s: number, da: any) => s + Math.max(0, Number(da?.amount) || 0),
    0
  );

  if (initialDebtAmount < debtAmount + collectedDebtAmount + reducedByReturnAmount) {
    initialDebtAmount = debtAmount + collectedDebtAmount + reducedByReturnAmount;
  }

  if (
    initialDebtAmount === 0 &&
    debtAmount === 0 &&
    o.paymentMethod === 'OTHER' &&
    /công\s*nợ|trả\s*sau|debt/i.test(String(o.paymentMethodDetail || ''))
  ) {
    const m = /(?:công\s*nợ|trả\s*sau|debt)[^0-9]*([0-9][0-9.,]*)/i.exec(
      String(o.paymentMethodDetail || '')
    );
    if (m) {
      const parsed = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        debtAmount = Math.min(totalAmount, parsed);
        initialDebtAmount = debtAmount;
      }
    }
  }

  const cashAtPurchase = Math.max(0, totalAmount - initialDebtAmount);
  const refundedCash = Math.max(0, Math.round(Number(refundedCashForOrder) || 0));
  const paidAmount = Math.max(
    0,
    Math.min(totalAmount, cashAtPurchase + collectedDebtAmount - refundedCash)
  );

  const debtStatus: 'NONE' | 'UNPAID' | 'PARTIAL' | 'SETTLED' =
    o.debtStatus && o.debtStatus !== 'NONE'
      ? o.debtStatus
      : initialDebtAmount <= 0 && debtAmount <= 0
      ? 'NONE'
      : debtAmount <= 0
      ? 'SETTLED'
      : cashAtPurchase + collectedDebtAmount <= 0 && reducedByReturnAmount <= 0
      ? 'UNPAID'
      : 'PARTIAL';

  const dueDate = o.debtDueDate ? new Date(o.debtDueDate) : null;
  const validDueDate = dueDate && !isNaN(dueDate.getTime()) ? dueDate : null;
  const nowMs = Date.now();
  const isOverdue = Boolean(debtAmount > 0 && validDueDate && validDueDate.getTime() < nowMs);
  const daysOverdue =
    isOverdue && validDueDate
      ? Math.max(1, Math.ceil((nowMs - validDueDate.getTime()) / (24 * 3600 * 1000)))
      : 0;

  return {
    totalAmount,
    cashAtPurchase,
    paidAmount,
    debtAmount,
    initialDebtAmount,
    collectedDebtAmount,
    reducedByReturnAmount,
    debtStatus,
    debtDueDate: validDueDate ? validDueDate.toISOString() : null,
    isOverdue,
    daysOverdue,
    debtPayments,
    debtAdjustments,
  };
}

type SalesType = 'ORDER' | 'RETURN' | 'EXCHANGE';
type WarehouseType =
  | 'IMPORT_CREATED'
  | 'IMPORT_CHECKED'
  | 'IMPORT_COMPLETED'
  | 'ADJUSTMENT'
  | 'EXPORT_TRANSFER';

interface SalesActivity {
  type: SalesType;
  at: Date;
  staffId: string;
  staffName: string;
  referenceCode: string;
  customerName: string;
  amount: number;
  units: number;
  paymentMethod: string;
  status: string;
}

interface WarehouseActivity {
  type: WarehouseType;
  at: Date;
  staffId: string;
  staffName: string;
  referenceCode: string;
  quantity: number;
  /** Số dòng hàng (chỉ với IMPORT_CHECKED) */
  rows?: number;
  detail: string;
}

const emptySales = () => ({ orders: 0, revenue: 0, units: 0, returnsHandled: 0, returnTotal: 0 });
const emptyWarehouse = () => ({
  importsCreated: 0,
  importsCompleted: 0,
  unitsScanned: 0,
  rowsChecked: 0,
  unitsImported: 0,
  adjustments: 0,
  transfers: 0,
  unitsTransferred: 0,
});

function parseLocalDateBound(raw: unknown, isEnd: boolean): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return isEnd
      ? new Date(y, mo, d, 23, 59, 59, 999)
      : new Date(y, mo, d, 0, 0, 0, 0);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  if (isEnd) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
}

// GET /api/v1/reports/staff-activity — Quản lý xem nhân viên nào bán hàng / kiểm kho
reportsRouter.get('/reports/staff-activity', async (req, res, next) => {
  try {
    if (!['ADMIN', 'ACCOUNTANT', 'HR'].includes(req.user?.role || '')) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý (ADMIN), Kế toán (ACCOUNTANT) hoặc Nhân sự (HR) được xem báo cáo hoạt động nhân viên');
    }

    const { from, to, staffId } = req.query;
    const fromDate = parseLocalDateBound(from, false);
    const toDate = parseLocalDateBound(to, true);
    const inRange = (d?: Date | string | null) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      if (isNaN(t)) return false;
      if (fromDate && t < fromDate.getTime()) return false;
      if (toDate && t > toDate.getTime()) return false;
      return true;
    };

    const [staffList, orders, returns, imports, movements, transferMovements] = await Promise.all([
      staffRepo.find({}, { createdAt: 1 }),
      orderRepo.find({}, { createdAt: -1 }),
      returnExchangeRepo.find({}, { createdAt: -1 }),
      importReceiptRepo.find({}, { createdAt: -1 }),
      stockMovementRepo.find({ type: 'ADJUSTMENT' }, { createdAt: -1 }),
      stockMovementRepo.find({ type: 'TRANSFER' }, { createdAt: -1 }),
    ]);

    const knownIds = new Set(staffList.map((s) => String(s._id)));
    // Thao tác không gắn với nhân viên nào (dữ liệu cũ / fallback) => staffId = ''
    const norm = (id?: string) => (id && knownIds.has(String(id)) ? String(id) : '');

    const sales: SalesActivity[] = [];
    const warehouse: WarehouseActivity[] = [];

    for (const o of orders) {
      if (o.status === 'DRAFT') continue;
      if (!inRange(o.createdAt)) continue;
      sales.push({
        type: 'ORDER',
        at: o.createdAt,
        staffId: norm(o.createdBy),
        staffName: o.createdByName || 'Không xác định',
        referenceCode: o.orderCode,
        customerName: o.customerName,
        amount: Number(o.totalAmount) || 0,
        units: (o.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
        paymentMethod: o.paymentMethod,
        status: o.status,
      });
    }

    for (const r of returns) {
      if (!inRange(r.createdAt)) continue;
      sales.push({
        type: r.type === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
        at: r.createdAt,
        staffId: norm(r.performedBy),
        staffName: r.performedByName || 'Không xác định',
        referenceCode: r.code,
        customerName: r.customerName,
        amount: Number(r.netDifference) || 0,
        units: (r.returnItems || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0),
        paymentMethod: r.refundMethod,
        status: r.orderCode,
      });
    }

    for (const rc of imports) {
      const targetFloorText = floorLabel(rc.targetWarehouse);
      if (inRange(rc.createdAt)) {
        warehouse.push({
          type: 'IMPORT_CREATED',
          at: rc.createdAt,
          staffId: norm(rc.createdBy),
          staffName: rc.createdByName || 'Không xác định',
          referenceCode: rc.code,
          quantity: (rc.items || []).reduce((s, i) => s + (Number(i.expectedQuantity) || 0), 0),
          detail: `[${targetFloorText}] Lập phiếu ${rc.items?.length || 0} dòng hàng${rc.note ? ` — ${rc.note}` : ''}`,
        });
      }

      // Quét kiểm: gom theo nhân viên trên từng phiếu
      const perChecker = new Map<string, { name: string; units: number; rows: number; lastAt?: Date }>();
      for (const it of rc.items || []) {
        for (const sc of it.scanCounts || []) {
          if (!sc.quantity) continue;
          const key = norm(sc.userId) || `?${sc.name}`;
          const cur = perChecker.get(key) || { name: sc.name, units: 0, rows: 0, lastAt: undefined };
          cur.units += sc.quantity;
          cur.rows += 1;
          if (it.checkedAt && it.checkedBy === sc.userId) {
            const t = new Date(it.checkedAt);
            if (!cur.lastAt || t > cur.lastAt) cur.lastAt = t;
          }
          perChecker.set(key, cur);
        }
      }
      for (const [key, v] of perChecker) {
        const at = v.lastAt || rc.completedAt || rc.updatedAt || rc.createdAt;
        if (!inRange(at)) continue;
        warehouse.push({
          type: 'IMPORT_CHECKED',
          at,
          staffId: key.startsWith('?') ? '' : key,
          staffName: v.name || 'Không xác định',
          referenceCode: rc.code,
          quantity: v.units,
          rows: v.rows,
          detail: `[${targetFloorText}] Quét kiểm ${v.units} chiếc / ${v.rows} dòng`,
        });
      }

      if (rc.status === 'COMPLETED' && inRange(rc.completedAt)) {
        const confirmed = (rc.items || []).filter((i) => i.isConfirmed);
        warehouse.push({
          type: 'IMPORT_COMPLETED',
          at: rc.completedAt as Date,
          staffId: norm(rc.completedBy),
          staffName: rc.completedByName || 'Không xác định',
          referenceCode: rc.code,
          quantity: confirmed.reduce((s, i) => s + (Number(i.actualQuantity) || 0), 0),
          detail: `[${targetFloorText}] Hoàn thành nhập kho ${confirmed.length} dòng`,
        });
      }
    }

    for (const m of movements) {
      if (!inRange(m.createdAt)) continue;
      warehouse.push({
        type: 'ADJUSTMENT',
        at: m.createdAt,
        staffId: norm(m.performedBy),
        staffName: m.performedByName || 'Không xác định',
        referenceCode: m.referenceCode,
        quantity: m.quantityChange,
        detail: `${m.productName}: ${m.quantityChange > 0 ? '+' : ''}${m.quantityChange} — ${m.note || ''}`,
      });
    }

    // Gộp các bút toán TRANSFER theo mã phiếu xuất kho (PXK-...) để 1 phiếu nhiều SP tính là 1 lần xuất chuyển tầng
    const transferGroups = new Map<string, any[]>();
    for (const m of transferMovements) {
      if (!inRange(m.createdAt)) continue;
      const code = m.referenceCode || String(m._id);
      const list = transferGroups.get(code) || [];
      list.push(m);
      transferGroups.set(code, list);
    }

    for (const [refCode, grp] of transferGroups.entries()) {
      const first = grp[0];
      const fromText = floorLabel(first.fromWarehouse || 'FLOOR_1');
      const toText = floorLabel(first.toWarehouse || 'FLOOR_2');
      const totalQty = grp.reduce((s, m) => s + Math.abs(Number(m.quantityChange) || 0), 0);
      const prodSummary = grp
        .map((m) => `${m.productName} (×${Math.abs(Number(m.quantityChange) || 0)})`)
        .join(', ');
      warehouse.push({
        type: 'EXPORT_TRANSFER',
        at: first.createdAt,
        staffId: norm(first.performedBy),
        staffName: first.performedByName || 'Không xác định',
        referenceCode: refCode,
        quantity: totalQty,
        rows: grp.length,
        detail: `Xuất kho chuyển tầng (${fromText} → ${toText}): ${prodSummary}${first.note ? ` — ${first.note}` : ''}`,
      });
    }

    // Tổng hợp theo nhân viên
    const summary = new Map<string, any>();
    const ensure = (id: string) => {
      if (!summary.has(id)) {
        const st = staffList.find((s) => String(s._id) === id);
        summary.set(id, {
          staffId: id,
          code: st?.code || '',
          fullName: st?.fullName || 'Không xác định',
          username: st?.username || '',
          role: st?.role || '',
          status: st?.status || '',
          sales: emptySales(),
          warehouse: emptyWarehouse(),
          lastActivityAt: null as Date | null,
        });
      }
      return summary.get(id);
    };
    staffList.forEach((s) => ensure(String(s._id)));
    const touch = (row: any, at: Date) => {
      if (!row.lastActivityAt || new Date(at) > new Date(row.lastActivityAt)) row.lastActivityAt = at;
    };

    for (const a of sales) {
      const row = ensure(a.staffId);
      if (a.type === 'ORDER') {
        row.sales.orders += 1;
        row.sales.revenue += a.amount;
        row.sales.units += a.units;
      } else {
        row.sales.returnsHandled += 1;
        row.sales.returnTotal += Math.abs(a.amount);
      }
      touch(row, a.at);
    }
    for (const a of warehouse) {
      const row = ensure(a.staffId);
      if (a.type === 'IMPORT_CREATED') row.warehouse.importsCreated += 1;
      if (a.type === 'IMPORT_COMPLETED') {
        row.warehouse.importsCompleted += 1;
        row.warehouse.unitsImported += a.quantity;
      }
      if (a.type === 'IMPORT_CHECKED') {
        row.warehouse.unitsScanned += a.quantity;
        row.warehouse.rowsChecked += a.rows || 0;
      }
      if (a.type === 'ADJUSTMENT') row.warehouse.adjustments += 1;
      if (a.type === 'EXPORT_TRANSFER') {
        row.warehouse.transfers += 1;
        row.warehouse.unitsTransferred += a.quantity;
      }
      touch(row, a.at);
    }

    // Bỏ dòng "Không xác định" nếu không có hoạt động
    let staffRows = Array.from(summary.values()).filter(
      (r) => r.staffId !== '' || r.lastActivityAt !== null
    );
    let salesOut = sales;
    let warehouseOut = warehouse;
    if (staffId !== undefined && staffId !== null && String(staffId) !== 'ALL') {
      const sid = String(staffId);
      staffRows = staffRows.filter((r) => r.staffId === sid);
      salesOut = sales.filter((a) => a.staffId === sid);
      warehouseOut = warehouse.filter((a) => a.staffId === sid);
    }

    const byTimeDesc = (a: { at: Date }, b: { at: Date }) =>
      new Date(b.at).getTime() - new Date(a.at).getTime();

    res.json({
      data: {
        staff: staffRows,
        sales: salesOut.sort(byTimeDesc),
        warehouse: warehouseOut.sort(byTimeDesc),
      },
      meta: { from: from || null, to: to || null },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/revenue-dashboard — Báo cáo Doanh thu chi tiết & Phân tích Sản phẩm bán chạy / cần đẩy mạnh + Quản lý Công nợ
reportsRouter.get('/reports/revenue-dashboard', async (req, res, next) => {
  try {
    if (!['ADMIN', 'ACCOUNTANT'].includes(req.user?.role || '')) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý (ADMIN) hoặc Kế toán (ACCOUNTANT) được xem báo cáo doanh thu chi tiết');
    }

    const { from, to, categoryId, paymentMethod } = req.query;
    const fromDate = parseLocalDateBound(from, false);
    const toDate = parseLocalDateBound(to, true);

    const inRange = (d?: Date | string | null) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      if (isNaN(t)) return false;
      if (fromDate && t < fromDate.getTime()) return false;
      if (toDate && t > toDate.getTime()) return false;
      return true;
    };

    const [orders, returns, products, categories] = await Promise.all([
      orderRepo.find({}, { createdAt: -1 }),
      returnExchangeRepo.find({}, { createdAt: -1 }),
      productRepo.find({}, { createdAt: -1 }),
      categoryRepo.find({}, { createdAt: 1 }),
    ]);

    const catMap = new Map<string, string>();
    categories.forEach((c) => catMap.set(String(c._id), c.name));

    const prodById = new Map<string, any>();
    const prodByCode = new Map<string, any>();
    products.forEach((p) => {
      prodById.set(String(p._id), p);
      prodByCode.set(String(p.code), p);
    });

    const orderById = new Map<string, any>();
    orders.forEach((o) => orderById.set(String(o._id), o));

    const refundedCashByOrderId = new Map<string, number>();
    for (const r of returns) {
      const oid = String(r.orderId || '');
      if (!oid) continue;
      const rDebtRed = Math.max(0, Math.round(Number(r.debtReduction) || 0));
      const rRefundAmt = Math.max(0, Math.round(Number(r.refundAmount) || 0));
      const rCashRef =
        r.cashRefund !== undefined && r.cashRefund !== null
          ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
          : Math.max(0, rRefundAmt - rDebtRed);
      if (rCashRef > 0) {
        refundedCashByOrderId.set(oid, (refundedCashByOrderId.get(oid) || 0) + rCashRef);
      }
    }

    const filterCatId = categoryId ? String(categoryId) : '';
    const filterPayMethod = paymentMethod ? String(paymentMethod).toUpperCase() : '';

    const filteredOrders = orders.filter((o) => {
      if (o.status === 'DRAFT') return false;
      if (!inRange(o.createdAt)) return false;
      if (filterPayMethod) {
        if (filterPayMethod === 'DEBT') {
          const dm = extractOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);
          if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) return false;
        } else if (o.paymentMethod !== filterPayMethod) {
          return false;
        }
      }
      if (filterCatId) {
        const hasCat = (o.items || []).some((it) => {
          const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
          return p && String(p.categoryId) === filterCatId;
        });
        if (!hasCat) return false;
      }
      return true;
    });

    const filteredReturns = returns.filter((r) => {
      if (!inRange(r.createdAt)) return false;
      if (filterPayMethod) {
        const origO = orderById.get(String(r.orderId));
        if (!origO) return false;
        if (filterPayMethod === 'DEBT') {
          const dm = extractOrderDebtMeta(origO, refundedCashByOrderId.get(String(origO._id)) || 0);
          if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) return false;
        } else if (origO.paymentMethod !== filterPayMethod) {
          return false;
        }
      }
      if (filterCatId) {
        const hasCat =
          (r.returnItems || []).some((it: any) => {
            const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
            return p && String(p.categoryId) === filterCatId;
          }) ||
          (r.exchangeItems || []).some((it: any) => {
            const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
            return p && String(p.categoryId) === filterCatId;
          });
        if (!hasCat) return false;
      }
      return true;
    });

    let grossRevenue = 0;
    let itemDiscountTotal = 0;
    let billDiscountTotal = 0;
    let cardFeeCollected = 0;
    let cardFeeRefunded = 0;
    let orderRevenue = 0;
    let totalUnitsSold = 0;
    let totalGiftUnits = 0;
    let estimatedCogs = 0;
    let cogsEstimated = false;
    let cashAtPurchase = 0;
    let cashRefunded = 0;
    let debtReducedByReturnInPeriod = 0;
    let returnFromPriorPeriods = 0;
    let outstandingDebtInPeriod = 0;
    let initialDebtInPeriod = 0;
    let debtOrdersInPeriod = 0;

    // Theo dõi thống kê từng sản phẩm
    interface ProdStat {
      productId: string;
      productCode: string;
      productName: string;
      categoryId: string;
      categoryName: string;
      unit: string;
      soldQty: number;
      giftQty: number;
      returnedQty: number;
      exchangeOutQty: number;
      revenue: number;
      cogs: number;
      orderIds: Set<string>;
      lastSoldAt: Date | null;
    }

    const prodStats = new Map<string, ProdStat>();
    const ensureProdStat = (
      pId: string,
      pCode: string,
      pName: string,
      unit: string
    ): ProdStat => {
      const prod = prodById.get(pId) || prodByCode.get(pCode);
      const key = prod ? String(prod._id) : pCode || pId;
      if (!prodStats.has(key)) {
        const cId = prod ? String(prod.categoryId || '') : '';
        prodStats.set(key, {
          productId: prod ? String(prod._id) : pId,
          productCode: prod ? prod.code : pCode,
          productName: prod ? prod.name : pName,
          categoryId: cId,
          categoryName: catMap.get(cId) || 'Chưa phân loại',
          unit: prod ? prod.unit : unit || 'Cái',
          soldQty: 0,
          giftQty: 0,
          returnedQty: 0,
          exchangeOutQty: 0,
          revenue: 0,
          cogs: 0,
          orderIds: new Set<string>(),
          lastSoldAt: null,
        });
      }
      return prodStats.get(key)!;
    };

    // Khởi tạo toàn bộ sản phẩm trong kho vào prodStats
    products.forEach((p) => {
      if (filterCatId && String(p.categoryId) !== filterCatId) return;
      ensureProdStat(String(p._id), p.code, p.name, p.unit);
    });

    // Thống kê theo ngày
    const dailyMap = new Map<
      string,
      {
        date: string;
        orders: number;
        unitsSold: number;
        grossRevenue: number;
        discountTotal: number;
        orderRevenue: number;
        returnImpact: number;
        netRevenue: number;
        cogs: number;
        grossProfit: number;
        cashCollected: number;
      }
    >();

    const ensureDay = (d: Date | string) => {
      const dt = new Date(d);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: key,
          orders: 0,
          unitsSold: 0,
          grossRevenue: 0,
          discountTotal: 0,
          orderRevenue: 0,
          returnImpact: 0,
          netRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          cashCollected: 0,
        });
      }
      return dailyMap.get(key)!;
    };

    // Điền sẵn các ngày trong khoảng lọc (tối đa 62 ngày) để biểu đồ luôn hiển thị đầy đủ trục thời gian
    if (fromDate && toDate && toDate.getTime() >= fromDate.getTime()) {
      const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000));
      if (diffDays <= 62) {
        const cur = new Date(fromDate);
        while (cur.getTime() <= toDate.getTime()) {
          ensureDay(cur);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    // Thống kê theo khung giờ (00:00 - 23:00)
    const hourlyMap = new Map<
      string,
      {
        hour: string;
        orders: number;
        unitsSold: number;
        grossRevenue: number;
        discountTotal: number;
        orderRevenue: number;
        returnImpact: number;
        netRevenue: number;
        cogs: number;
        grossProfit: number;
        cashCollected: number;
      }
    >();

    for (let h = 0; h < 24; h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      hourlyMap.set(key, {
        hour: key,
        orders: 0,
        unitsSold: 0,
        grossRevenue: 0,
        discountTotal: 0,
        orderRevenue: 0,
        returnImpact: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashCollected: 0,
      });
    }

    const ensureHour = (d: Date | string) => {
      const dt = new Date(d);
      const hh = String(dt.getHours()).padStart(2, '0');
      const key = `${hh}:00`;
      if (!hourlyMap.has(key)) {
        hourlyMap.set(key, {
          hour: key,
          orders: 0,
          unitsSold: 0,
          grossRevenue: 0,
          discountTotal: 0,
          orderRevenue: 0,
          returnImpact: 0,
          netRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          cashCollected: 0,
        });
      }
      return hourlyMap.get(key)!;
    };

    // Phương thức thanh toán
    const paymentStats: Record<string, { method: string; label: string; orders: number; revenue: number }> = {
      CASH: { method: 'CASH', label: 'Tiền mặt', orders: 0, revenue: 0 },
      BANKING: { method: 'BANKING', label: 'Chuyển khoản', orders: 0, revenue: 0 },
      CARD: { method: 'CARD', label: 'Quẹt thẻ', orders: 0, revenue: 0 },
      OTHER: { method: 'OTHER', label: 'Khác (Tách / Công nợ)', orders: 0, revenue: 0 },
    };

    for (const o of filteredOrders) {
      const day = ensureDay(o.createdAt);
      const hr = ensureHour(o.createdAt);
      day.orders += 1;
      hr.orders += 1;

      const orderSub = Math.max(0, Number(o.subtotal) || 0);
      const orderBillDisc = Math.min(orderSub, Math.max(0, Math.round(Number(o.billDiscountAmount) || 0)));
      const orderAfterBill = Math.max(0, orderSub - orderBillDisc);
      const orderCardFee = Math.max(0, Math.round(Number(o.cardFee) || 0));
      const orderTotal = Math.max(0, Number(o.totalAmount) || orderAfterBill + orderCardFee);

      // Phân bổ giảm giá bill theo từng dòng (dòng có giá trị cuối nhận phần dư để ΣB_i = B)
      const oItems = o.items || [];
      const paidLineIndices = oItems
        .map((it: any, idx: number) => ({ it, idx }))
        .filter(({ it }: any) => !it.isGift && it.discountType !== 'GIFT' && (Number(it.lineTotal) || 0) > 0)
        .map(({ idx }: any) => idx);
      const lastPaidIdx = paidLineIndices.length > 0 ? paidLineIndices[paidLineIndices.length - 1] : -1;

      let allocatedBillDisc = 0;
      const billShareByIdx: number[] = [];
      for (let idx = 0; idx < oItems.length; idx++) {
        const it = oItems[idx];
        const lineTotal = Math.max(0, Number(it.lineTotal) || 0);
        if (it.isGift || it.discountType === 'GIFT' || lineTotal <= 0 || orderSub <= 0 || orderBillDisc <= 0) {
          billShareByIdx[idx] = 0;
          continue;
        }
        let bShare = 0;
        if (idx === lastPaidIdx) {
          bShare = Math.max(0, orderBillDisc - allocatedBillDisc);
        } else {
          bShare = Math.min(
            Math.max(0, orderBillDisc - allocatedBillDisc),
            Math.round((lineTotal / orderSub) * orderBillDisc)
          );
        }
        allocatedBillDisc += bShare;
        billShareByIdx[idx] = bShare;
      }

      // Nếu lọc theo categoryId thì tính tỷ trọng của category đó trong đơn
      let orderIncludedGross = 0;
      let orderIncludedItemDisc = 0;
      let orderIncludedLineTotal = 0;
      let orderIncludedBillDisc = 0;
      let orderIncludedNetRev = 0;
      let orderIncludedCogs = 0;
      let orderIncludedUnits = 0;

      for (let idx = 0; idx < oItems.length; idx++) {
        const it = oItems[idx];
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) {
          continue;
        }
        const qty = Number(it.quantity) || 0;
        const isGift = Boolean(it.isGift) || it.discountType === 'GIFT';
        const origPrice = Number(it.originalUnitPrice ?? it.unitPrice) || 0;
        const lineTotal = Number(it.lineTotal) || 0;
        const itemDisc = Number(it.discountAmount) || 0;
        const hasSavedUnitCost = it.unitCost !== undefined && it.unitCost !== null;
        if (!hasSavedUnitCost && qty > 0) {
          cogsEstimated = true;
        }
        const unitCost = hasSavedUnitCost
          ? Math.max(0, Math.round(Number(it.unitCost) || 0))
          : Math.max(0, Math.round(Number(prod?.costPrice) || 0));

        const billDiscShare = billShareByIdx[idx] || 0;
        const netItemRev = Math.max(0, lineTotal - billDiscShare);
        const itemCogs = qty * unitCost;

        if (isGift) {
          totalGiftUnits += qty;
        } else {
          totalUnitsSold += qty;
          orderIncludedUnits += qty;
          orderIncludedGross += origPrice * qty;
          orderIncludedItemDisc += itemDisc;
          orderIncludedLineTotal += lineTotal;
          orderIncludedBillDisc += billDiscShare;
          orderIncludedNetRev += netItemRev;
        }
        orderIncludedCogs += itemCogs;

        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        if (isGift) {
          st.giftQty += qty;
        } else {
          st.soldQty += qty;
          st.revenue += netItemRev;
        }
        st.cogs += itemCogs;
        st.orderIds.add(String(o._id));
        if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
          st.lastSoldAt = new Date(o.createdAt);
        }
      }

      // D1: orderRevenue = tiền hàng sau giảm SP & giảm bill (S - B), KHÔNG gồm cardFee
      const effectiveBillDisc = filterCatId ? orderIncludedBillDisc : orderBillDisc;
      const effectiveCardFee = filterCatId ? 0 : orderCardFee;
      const effectiveOrderRev = filterCatId ? orderIncludedNetRev : orderAfterBill;

      grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
      itemDiscountTotal += filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0;
      billDiscountTotal += effectiveBillDisc;
      cardFeeCollected += effectiveCardFee;
      orderRevenue += effectiveOrderRev;
      estimatedCogs += orderIncludedCogs;

      const dm = extractOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);
      const orderCashAtPurchase = filterCatId ? 0 : dm.cashAtPurchase;
      cashAtPurchase += orderCashAtPurchase;

      if (dm.initialDebtAmount > 0 || dm.debtAmount > 0) {
        debtOrdersInPeriod += 1;
        const ratio =
          filterCatId && orderAfterBill > 0 ? Math.min(1, effectiveOrderRev / orderAfterBill) : 1;
        outstandingDebtInPeriod += Math.round(dm.debtAmount * ratio);
        initialDebtInPeriod += Math.round(dm.initialDebtAmount * ratio);
      }

      day.unitsSold += orderIncludedUnits;
      day.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
      day.discountTotal += (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
      day.orderRevenue += effectiveOrderRev;
      day.netRevenue += effectiveOrderRev;
      day.cogs += orderIncludedCogs;
      day.grossProfit = day.netRevenue - day.cogs;
      day.cashCollected += orderCashAtPurchase;

      hr.unitsSold += orderIncludedUnits;
      hr.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
      hr.discountTotal += (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
      hr.orderRevenue += effectiveOrderRev;
      hr.netRevenue += effectiveOrderRev;
      hr.cogs += orderIncludedCogs;
      hr.grossProfit = hr.netRevenue - hr.cogs;
      hr.cashCollected += orderCashAtPurchase;

      const pm = paymentStats[o.paymentMethod] || paymentStats.OTHER;
      pm.orders += 1;
      pm.revenue += effectiveOrderRev;
    }

    let returnGoodsTotal = 0;
    let exchangeGoodsTotal = 0;
    let returnTotal = 0;
    let exchangeTotal = 0;
    let netReturnImpact = 0; // Giá trị chênh lệch hàng đổi - hàng trả (không tính phí thẻ)
    let totalUnitsReturned = 0;

    for (const r of filteredReturns) {
      const day = ensureDay(r.createdAt);
      const hr = ensureHour(r.createdAt);
      let rRetGoods = 0;
      let rExGoods = 0;
      let rCogsImpact = 0;
      const origOrder = orderById.get(String(r.orderId));
      const origSub = Math.max(0, Number(origOrder?.subtotal) || 0);
      const origBillDisc = Math.min(origSub, Math.max(0, Math.round(Number(origOrder?.billDiscountAmount) || 0)));

      // Kiểm tra xem phiếu trả đã phân bổ sẵn giảm giá bill vào returnSubtotal/lineTotal chưa (phiếu mới v4.1)
      // Với phiếu cũ (lineTotal = unitPrice gốc chưa trừ giảm bill), ta phân bổ giảm bill tại đây.
      const rRawLinesSum = (r.returnItems || []).reduce(
        (s: number, it: any) => s + (Number(it.lineTotal) || 0),
        0
      );
      const matchingOrigGrossSum = origOrder
        ? (r.returnItems || []).reduce((s: number, it: any) => {
            const matchedOrig = (origOrder.items || []).find(
              (oi: any) =>
                String(oi.productId) === String(it.productId) ||
                oi.productCode === it.productCode
            );
            const origUnitPrice = Number(matchedOrig?.unitPrice ?? it.unitPrice) || 0;
            return s + origUnitPrice * (Number(it.quantity) || 0);
          }, 0)
        : rRawLinesSum;
      const isAlreadyNetOfBillDisc =
        origBillDisc > 0 && rRawLinesSum > 0 && rRawLinesSum < matchingOrigGrossSum;

      const rRetItems = r.returnItems || [];
      let allocatedRetBillShare = 0;
      const totalExpectedRetBillShare =
        !isAlreadyNetOfBillDisc && origSub > 0 && origBillDisc > 0
          ? Math.round((rRawLinesSum / origSub) * origBillDisc)
          : 0;

      for (let idx = 0; idx < rRetItems.length; idx++) {
        const it = rRetItems[idx];
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const retIsGift = Boolean((it as any).isGift) || (it as any).discountType === 'GIFT' || line <= 0;
        let retBillShare = 0;
        if (!isAlreadyNetOfBillDisc && !retIsGift && origSub > 0 && origBillDisc > 0) {
          if (idx === rRetItems.length - 1) {
            retBillShare = Math.max(0, totalExpectedRetBillShare - allocatedRetBillShare);
          } else {
            retBillShare = Math.min(
              Math.max(0, totalExpectedRetBillShare - allocatedRetBillShare),
              Math.round((line / origSub) * origBillDisc)
            );
          }
          allocatedRetBillShare += retBillShare;
        }
        const netRetLine = Math.max(0, line - retBillShare);

        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;

        let resolvedUnitCost: number | undefined =
          it.unitCost !== undefined && it.unitCost !== null
            ? Math.max(0, Math.round(Number(it.unitCost) || 0))
            : undefined;
        if (resolvedUnitCost === undefined && origOrder) {
          const matchedOrig = (origOrder.items || []).find(
            (oi: any) =>
              String(oi.productId) === String(it.productId) || oi.productCode === it.productCode
          );
          if (matchedOrig && matchedOrig.unitCost !== undefined && matchedOrig.unitCost !== null) {
            resolvedUnitCost = Math.max(0, Math.round(Number(matchedOrig.unitCost) || 0));
          }
        }
        if (resolvedUnitCost === undefined) {
          if (qty > 0 && (it.condition === 'GOOD' || it.restocked)) {
            cogsEstimated = true;
          }
          resolvedUnitCost = Math.max(0, Math.round(Number(prod?.costPrice) || 0));
        }

        totalUnitsReturned += qty;
        rRetGoods += netRetLine;

        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.returnedQty += qty;
        st.revenue -= netRetLine;
        if (it.condition === 'GOOD' || it.restocked) {
          st.cogs -= qty * resolvedUnitCost;
          rCogsImpact -= qty * resolvedUnitCost;
        }
      }

      for (const it of r.exchangeItems || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const hasSavedUnitCost = it.unitCost !== undefined && it.unitCost !== null;
        if (!hasSavedUnitCost && qty > 0) {
          cogsEstimated = true;
        }
        const unitCost = hasSavedUnitCost
          ? Math.max(0, Math.round(Number(it.unitCost) || 0))
          : Math.max(0, Math.round(Number(prod?.costPrice) || 0));
        rExGoods += line;

        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.exchangeOutQty += qty;
        st.revenue += line;
        st.cogs += qty * unitCost;
        rCogsImpact += qty * unitCost;
      }

      const rRefundedFee = filterCatId ? 0 : Math.max(0, Math.round(Number(r.refundedCardFee) || 0));
      cardFeeRefunded += rRefundedFee;
      returnGoodsTotal += rRetGoods;
      exchangeGoodsTotal += rExGoods;

      if (fromDate && origOrder?.createdAt) {
        const origTime = new Date(origOrder.createdAt).getTime();
        if (!isNaN(origTime) && origTime < fromDate.getTime()) {
          returnFromPriorPeriods += rRetGoods;
        }
      }

      const rDebtRed = filterCatId ? 0 : Math.max(0, Math.round(Number(r.debtReduction) || 0));
      const rRefundAmt = Math.max(0, Math.round(Number(r.refundAmount) || 0));
      const rCashRef = filterCatId
        ? 0
        : r.cashRefund !== undefined && r.cashRefund !== null
        ? Math.max(0, Math.round(Number(r.cashRefund) || 0))
        : Math.max(0, rRefundAmt - rDebtRed);
      const rAddCharge = filterCatId ? 0 : Math.max(0, Math.round(Number(r.additionalCharge) || 0));

      debtReducedByReturnInPeriod += rDebtRed;
      cashRefunded += rCashRef;

      // Phụ thu đổi hàng (additionalCharge > 0) khách trả ngay tại quầy -> cộng vào cashAtPurchase
      if (rAddCharge > 0) {
        cashAtPurchase += rAddCharge;
      }

      const goodsDiff = rExGoods - rRetGoods;
      returnTotal += filterCatId ? rRetGoods : rRetGoods + rRefundedFee;
      exchangeTotal += rExGoods;
      netReturnImpact += goodsDiff;
      estimatedCogs += rCogsImpact;

      const rCashDelta = rAddCharge - rCashRef;

      day.returnImpact += goodsDiff;
      day.netRevenue += goodsDiff;
      day.cogs += rCogsImpact;
      day.grossProfit = day.netRevenue - day.cogs;
      day.cashCollected += rCashDelta;

      hr.returnImpact += goodsDiff;
      hr.netRevenue += goodsDiff;
      hr.cogs += rCogsImpact;
      hr.grossProfit = hr.netRevenue - hr.cogs;
      hr.cashCollected += rCashDelta;
    }

    const netRevenue = orderRevenue - returnGoodsTotal + exchangeGoodsTotal;
    const cardFeeNet = cardFeeCollected - cardFeeRefunded;
    const cardFeeTotal = cardFeeNet;
    const grossProfit = netRevenue - estimatedCogs;
    const grossMarginPercent =
      netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;
    const totalOrders = filteredOrders.length;
    const paidOrders = filteredOrders.filter((o) => o.status === 'PAID').length;
    const returnedOrders = filteredOrders.filter((o) => o.status === 'PARTIALLY_RETURNED' || o.status === 'FULLY_RETURNED').length;
    const avgOrderValue = totalOrders > 0 ? Math.round(orderRevenue / totalOrders) : 0;

    // ===== TỔNG HỢP QUẢN LÝ CÔNG NỢ (MUA TRƯỚC TRẢ SAU) =====
    let totalOutstandingDebt = 0;
    let totalInitialDebt = 0;
    let totalCollectedDebt = 0;
    let totalReducedByReturn = 0;
    let activeDebtOrdersCount = 0;
    let settledDebtOrdersCount = 0;
    let overdueDebtAmount = 0;
    let overdueOrdersCount = 0;
    let debtCollectedInPeriod = 0;

    interface DebtOrderRow {
      _id: string;
      orderCode: string;
      customerName: string;
      customerPhone: string;
      paymentMethod: string;
      paymentMethodDetail: string;
      totalAmount: number;
      paidAmount: number;
      debtAmount: number;
      initialDebtAmount: number;
      collectedDebtAmount: number;
      reducedByReturnAmount: number;
      debtStatus: 'NONE' | 'UNPAID' | 'PARTIAL' | 'SETTLED';
      debtDueDate: string | null;
      isOverdue: boolean;
      daysOverdue: number;
      debtPayments: any[];
      debtAdjustments: any[];
      createdByName: string;
      confirmedByName: string;
      createdAt: string;
      items: any[];
      note: string;
    }

    const debtOrders: DebtOrderRow[] = [];
    const customerDebtMap = new Map<
      string,
      {
        phone: string;
        customerName: string;
        totalOrders: number;
        activeDebtOrders: number;
        settledDebtOrders: number;
        overdueOrders: number;
        totalOrderAmount: number;
        totalInitialDebt: number;
        totalPaidAmount: number;
        totalCollectedDebt: number;
        totalReducedByReturn: number;
        totalDebtAmount: number;
        nearestDueDate: string | null;
        lastOrderAt: string | null;
        orders: DebtOrderRow[];
        paymentHistory: {
          _id: string;
          orderId: string;
          orderCode: string;
          amount: number;
          method: string;
          note: string;
          paidAt: string;
          collectedByName: string;
        }[];
        debtAdjustments: {
          _id: string;
          orderId: string;
          orderCode: string;
          returnCode: string;
          amount: number;
          debtBefore: number;
          debtAfter: number;
          at: string;
          byName: string;
        }[];
      }
    >();

    for (const o of orders) {
      if (o.status === 'DRAFT') continue;
      const dm = extractOrderDebtMeta(o, refundedCashByOrderId.get(String(o._id)) || 0);

      const matchesPaymentFilter =
        !filterPayMethod ||
        (filterPayMethod === 'DEBT'
          ? dm.initialDebtAmount > 0 || dm.debtAmount > 0
          : o.paymentMethod === filterPayMethod);

      if (!filterCatId && matchesPaymentFilter) {
        for (const dp of dm.debtPayments) {
          if (inRange(dp.paidAt)) {
            const dpAmt = Math.max(0, Number(dp.amount) || 0);
            debtCollectedInPeriod += dpAmt;
            const dDay = ensureDay(dp.paidAt);
            const dHr = ensureHour(dp.paidAt);
            dDay.cashCollected += dpAmt;
            dHr.cashCollected += dpAmt;
          }
        }
      }

      if (dm.initialDebtAmount <= 0 && dm.debtAmount <= 0) continue;

      totalOutstandingDebt += dm.debtAmount;
      totalInitialDebt += dm.initialDebtAmount;
      totalCollectedDebt += dm.collectedDebtAmount;
      totalReducedByReturn += dm.reducedByReturnAmount;

      if (dm.debtAmount > 0) {
        activeDebtOrdersCount += 1;
        if (dm.isOverdue) {
          overdueOrdersCount += 1;
          overdueDebtAmount += dm.debtAmount;
        }
      } else {
        settledDebtOrdersCount += 1;
      }

      const row: DebtOrderRow = {
        _id: String(o._id),
        orderCode: o.orderCode,
        customerName: o.customerName || 'Khách hàng',
        customerPhone: o.customerPhone || '',
        paymentMethod: o.paymentMethod,
        paymentMethodDetail: o.paymentMethodDetail || '',
        totalAmount: dm.totalAmount,
        paidAmount: dm.paidAmount,
        debtAmount: dm.debtAmount,
        initialDebtAmount: dm.initialDebtAmount,
        collectedDebtAmount: dm.collectedDebtAmount,
        reducedByReturnAmount: dm.reducedByReturnAmount,
        debtStatus: dm.debtStatus,
        debtDueDate: dm.debtDueDate,
        isOverdue: dm.isOverdue,
        daysOverdue: dm.daysOverdue,
        debtPayments: dm.debtPayments,
        debtAdjustments: dm.debtAdjustments,
        createdByName: o.createdByName || '',
        confirmedByName: o.confirmedByName || o.createdByName || '',
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
        items: o.items || [],
        note: o.note || '',
      };
      debtOrders.push(row);

      const normPhone = normalizePhoneDigits(o.customerPhone || '') || o.customerPhone || o.customerName || String(o._id);
      if (!customerDebtMap.has(normPhone)) {
        customerDebtMap.set(normPhone, {
          phone: o.customerPhone || normPhone,
          customerName: o.customerName || 'Khách hàng',
          totalOrders: 0,
          activeDebtOrders: 0,
          settledDebtOrders: 0,
          overdueOrders: 0,
          totalOrderAmount: 0,
          totalInitialDebt: 0,
          totalPaidAmount: 0,
          totalCollectedDebt: 0,
          totalReducedByReturn: 0,
          totalDebtAmount: 0,
          nearestDueDate: null,
          lastOrderAt: null,
          orders: [],
          paymentHistory: [],
          debtAdjustments: [],
        });
      }
      const cGroup = customerDebtMap.get(normPhone)!;
      if (o.customerName) cGroup.customerName = o.customerName;
      cGroup.totalOrders += 1;
      if (dm.debtAmount > 0) {
        cGroup.activeDebtOrders += 1;
        if (dm.isOverdue) cGroup.overdueOrders += 1;
        if (dm.debtDueDate) {
          if (
            !cGroup.nearestDueDate ||
            new Date(dm.debtDueDate).getTime() < new Date(cGroup.nearestDueDate).getTime()
          ) {
            cGroup.nearestDueDate = dm.debtDueDate;
          }
        }
      } else {
        cGroup.settledDebtOrders += 1;
      }
      cGroup.totalOrderAmount += dm.totalAmount;
      cGroup.totalInitialDebt += dm.initialDebtAmount;
      cGroup.totalPaidAmount += dm.paidAmount;
      cGroup.totalCollectedDebt += dm.collectedDebtAmount;
      cGroup.totalReducedByReturn += dm.reducedByReturnAmount;
      cGroup.totalDebtAmount += dm.debtAmount;
      if (
        !cGroup.lastOrderAt ||
        new Date(row.createdAt).getTime() > new Date(cGroup.lastOrderAt).getTime()
      ) {
        cGroup.lastOrderAt = row.createdAt;
      }
      cGroup.orders.push(row);

      for (const dp of dm.debtPayments) {
        cGroup.paymentHistory.push({
          _id: String(dp._id || `${o._id}_${dp.paidAt}`),
          orderId: String(o._id),
          orderCode: o.orderCode,
          amount: Number(dp.amount) || 0,
          method: dp.method || 'BANKING',
          note: dp.note || '',
          paidAt: dp.paidAt ? new Date(dp.paidAt).toISOString() : row.createdAt,
          collectedByName: dp.collectedByName || 'Quản Trị Viên',
        });
      }

      for (const da of dm.debtAdjustments) {
        cGroup.debtAdjustments.push({
          _id: String(da._id || `${o._id}_${da.returnCode}`),
          orderId: String(o._id),
          orderCode: o.orderCode,
          returnCode: da.returnCode || '',
          amount: Number(da.amount) || 0,
          debtBefore: Number(da.debtBefore) || 0,
          debtAfter: Number(da.debtAfter) || 0,
          at: da.at ? new Date(da.at).toISOString() : row.createdAt,
          byName: da.byName || 'Nhân viên bán hàng',
        });
      }
    }

    const cashCollected = filterCatId ? null : cashAtPurchase + debtCollectedInPeriod - cashRefunded;
    const collectedRevenue = cashCollected ?? Math.max(0, netRevenue - outstandingDebtInPeriod);

    const debtCustomers = Array.from(customerDebtMap.values())
      .map((c) => ({
        ...c,
        paymentHistory: c.paymentHistory.sort(
          (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
        ),
      }))
      .sort((a, b) => {
        if (b.totalDebtAmount !== a.totalDebtAmount) return b.totalDebtAmount - a.totalDebtAmount;
        return b.totalInitialDebt - a.totalInitialDebt;
      });

    const activeDebtCustomersCount = debtCustomers.filter((c) => c.totalDebtAmount > 0).length;

    // Cơ cấu phương thức thanh toán
    const byPaymentMethod = Object.values(paymentStats).map((pm) => ({
      ...pm,
      sharePercent:
        orderRevenue > 0 ? Math.round((pm.revenue / orderRevenue) * 1000) / 10 : 0,
    }));

    // Cơ cấu theo Category
    const catStatsMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        unitsSold: number;
        revenue: number;
        netRevenue: number;
        cogs: number;
        grossProfit: number;
      }
    >();
    prodStats.forEach((st) => {
      const netUnits = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
      if (netUnits === 0 && st.revenue === 0 && st.cogs === 0) return;
      const key = st.categoryId || 'UNCATEGORIZED';
      if (!catStatsMap.has(key)) {
        catStatsMap.set(key, {
          categoryId: key,
          categoryName: st.categoryName,
          unitsSold: 0,
          revenue: 0,
          netRevenue: 0,
          cogs: 0,
          grossProfit: 0,
        });
      }
      const cRow = catStatsMap.get(key)!;
      cRow.unitsSold += netUnits;
      cRow.revenue += st.revenue;
      cRow.netRevenue += st.revenue;
      cRow.cogs += st.cogs;
      cRow.grossProfit = cRow.revenue - cRow.cogs;
    });

    const totalCatRev = Array.from(catStatsMap.values()).reduce((s, c) => s + c.revenue, 0);
    const byCategory = Array.from(catStatsMap.values())
      .map((c) => ({
        ...c,
        sharePercent: totalCatRev > 0 ? Math.round((c.revenue / totalCatRev) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Xếp hạng sản phẩm bán chạy (Best Sellers) & Sản phẩm cần đẩy mạnh (Needs Push)
    const allProductRows = Array.from(prodStats.values()).map((st) => {
      const prod = prodById.get(st.productId) || prodByCode.get(st.productCode);
      const floors = prod ? getFloorStocks(prod) : { stockFloor1: 0, stockFloor2: 0, stock: 0 };
      const stockFloor1 = floors.stockFloor1;
      const stockFloor2 = floors.stockFloor2;
      const stock = floors.stock;
      const sellingPrice = Number(prod?.sellingPrice ?? 0);
      const costPrice = Number(prod?.costPrice ?? 0);
      const netSoldQty = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
      const profit = st.revenue - st.cogs;
      const marginPercent = st.revenue > 0 ? Math.round((profit / st.revenue) * 1000) / 10 : 0;
      const inventoryCostValue = stock * costPrice;
      const inventorySellValue = stock * sellingPrice;

      // Cảnh báo tồn kho cho hàng bán chạy
      let restockAlert = '';
      if (netSoldQty > 0) {
        if (stock === 0) {
          restockAlert = 'Hết hàng toàn kho — Cần nhập thêm gấp';
        } else if (stockFloor1 === 0 && stockFloor2 > 0) {
          restockAlert = `Hết hàng Tầng 1 (Tầng 2 còn ${stockFloor2}) — Cần xuất chuyển tầng xuống Tầng 1`;
        } else if (stockFloor1 <= 2 && stockFloor2 > 0) {
          restockAlert = `Tầng 1 sắp hết (còn ${stockFloor1}, Tầng 2 có ${stockFloor2}) — Nên dời thêm từ Tầng 2`;
        } else if (stock <= 3) {
          restockAlert = `Sắp hết hàng (Tổng tồn còn ${stock}) — Nên nhập bổ sung`;
        }
      }

      // Phân tích sản phẩm cần đẩy mạnh (tồn kho > 0 nhưng bán chậm / chưa bán được / đọng vốn / nằm ở Tầng 2)
      const pushReasons: string[] = [];
      let suggestedAction = '';
      let pushScore = 0;

      if (stock > 0) {
        if (sellingPrice <= 0) {
          pushReasons.push('Chưa đặt giá bán (0 VND)');
          suggestedAction = 'Cập nhật giá bán lẻ trong Quản lý Kho để POS có thể bán';
          pushScore += 100;
        }
        if (stockFloor1 === 0 && stockFloor2 > 0) {
          pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction = 'Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày';
          }
          pushScore += 80 + Math.min(40, stockFloor2 * 2);
        }
        if (netSoldQty === 0) {
          pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction =
              stock >= 10
                ? 'Tồn kho cao chưa phát sinh đơn — Nên chạy khuyến mãi giảm giá % hoặc tặng kèm combo'
                : 'Trưng bày nổi bật tại quầy Tầng 1 hoặc tư vấn ưu tiên cho khách';
          }
          pushScore += 50 + Math.min(50, stock * 3);
        } else if (stock >= netSoldQty * 5 && stock >= 6) {
          pushReasons.push(
            `Tồn kho cao gấp ${Math.round(stock / netSoldQty)} lần lượng bán (Tồn ${stock} / Bán ${netSoldQty})`
          );
          if (!suggestedAction) {
            suggestedAction = 'Tốc độ tiêu thụ chậm so với lượng tồn — Nên giảm giá nhẹ hoặc đẩy mạnh giới thiệu';
          }
          pushScore += 30 + Math.min(40, stock * 2);
        }

        if (inventoryCostValue >= 3000000 && netSoldQty <= 1) {
          pushReasons.push(`Đọng vốn lớn (${Math.round(inventoryCostValue / 1000000 * 10) / 10}tr VND)`);
          pushScore += 35;
        }
      }

      return {
        productId: st.productId,
        productCode: st.productCode,
        productName: st.productName,
        categoryId: st.categoryId,
        categoryName: st.categoryName,
        unit: st.unit,
        soldQty: st.soldQty,
        giftQty: st.giftQty,
        returnedQty: st.returnedQty,
        netSoldQty,
        revenue: st.revenue,
        cogs: st.cogs,
        grossProfit: profit,
        marginPercent,
        orderCount: st.orderIds.size,
        lastSoldAt: st.lastSoldAt,
        sellingPrice,
        costPrice,
        stockFloor1,
        stockFloor2,
        stock,
        inventoryCostValue,
        inventorySellValue,
        restockAlert,
        pushScore,
        pushReasons,
        suggestedAction,
      };
    });

    const topSellingProducts = allProductRows
      .filter((r) => r.netSoldQty > 0 || r.soldQty > 0)
      .sort((a, b) => {
        if (b.netSoldQty !== a.netSoldQty) return b.netSoldQty - a.netSoldQty;
        return b.revenue - a.revenue;
      });

    const needsPushProducts = allProductRows
      .filter((r) => r.stock > 0 && r.pushScore > 0)
      .sort((a, b) => {
        if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
        if (b.inventoryCostValue !== a.inventoryCostValue)
          return b.inventoryCostValue - a.inventoryCostValue;
        return b.stock - a.stock;
      });

    if (!fromDate && !toDate) {
      const latestKey = Array.from(dailyMap.keys()).sort().pop();
      const anchor = latestKey ? parseLocalDateBound(latestKey, false) || new Date() : new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - i);
        ensureDay(d);
      }
    }

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const hourlyTrend = Array.from(hourlyMap.values()).sort((a, b) =>
      a.hour.localeCompare(b.hour)
    );

    res.json({
      data: {
        summary: {
          grossRevenue,
          itemDiscountTotal,
          billDiscountTotal,
          totalDiscount: itemDiscountTotal + billDiscountTotal,
          cardFeeCollected,
          cardFeeRefunded,
          cardFeeNet,
          cardFeeTotal,
          orderRevenue,
          returnGoodsTotal,
          exchangeGoodsTotal,
          returnTotal,
          exchangeTotal,
          netReturnImpact,
          netReturnRefund: netReturnImpact,
          returnFromPriorPeriods,
          netRevenue,
          cashAtPurchase,
          cashRefunded,
          cashCollected,
          collectedRevenue,
          debtReducedByReturnInPeriod,
          outstandingDebt: outstandingDebtInPeriod,
          outstandingDebtInPeriod,
          initialDebtInPeriod,
          debtCollectedInPeriod,
          debtOrdersInPeriod,
          estimatedCogs,
          cogs: estimatedCogs,
          cogsEstimated,
          grossProfit,
          grossMarginPercent,
          totalOrders,
          paidOrders,
          returnedOrders,
          avgOrderValue,
          totalUnitsSold,
          totalGiftUnits,
          totalUnitsReturned,
        },
        byPaymentMethod,
        byCategory,
        dailyTrend,
        hourlyTrend,
        topSellingProducts,
        needsPushProducts,
        debtManagement: {
          summary: {
            totalOutstandingDebt,
            totalInitialDebt,
            totalCollectedDebt,
            totalReducedByReturn,
            activeDebtOrdersCount,
            settledDebtOrdersCount,
            activeDebtCustomersCount,
            overdueDebtAmount,
            overdueOrdersCount,
            newDebtInPeriod: initialDebtInPeriod,
            collectedInPeriod: debtCollectedInPeriod,
            reducedByReturnInPeriod: debtReducedByReturnInPeriod,
          },
          customers: debtCustomers,
          orders: debtOrders,
        },
      },
      meta: {
        from: from || null,
        to: to || null,
        categoryId: categoryId || null,
        paymentMethod: paymentMethod || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/push-products — Danh sách Các Sản Phẩm Đang Cần Đẩy Mạnh (Mở cho Marketing quan sát)
reportsRouter.get('/reports/push-products', async (req, res, next) => {
  try {
    if (!['MARKETING', 'ADMIN', 'ACCOUNTANT'].includes(req.user?.role || '')) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ bộ phận Marketing (MARKETING), Quản lý (ADMIN) hoặc Kế toán (ACCOUNTANT) được xem danh sách sản phẩm cần đẩy mạnh'
      );
    }

    const { from, to, categoryId } = req.query;
    const fromDate = parseLocalDateBound(from, false);
    const toDate = parseLocalDateBound(to, true);

    const inRange = (d?: Date | string | null) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      if (isNaN(t)) return false;
      if (fromDate && t < fromDate.getTime()) return false;
      if (toDate && t > toDate.getTime()) return false;
      return true;
    };

    const [orders, returns, products, categories] = await Promise.all([
      orderRepo.find({}, { createdAt: -1 }),
      returnExchangeRepo.find({}, { createdAt: -1 }),
      productRepo.find({}, { createdAt: -1 }),
      categoryRepo.find({}, { createdAt: 1 }),
    ]);

    const catMap = new Map<string, string>();
    categories.forEach((c) => catMap.set(String(c._id), c.name));

    const prodById = new Map<string, any>();
    const prodByCode = new Map<string, any>();
    products.forEach((p) => {
      prodById.set(String(p._id), p);
      prodByCode.set(String(p.code), p);
    });

    const filterCatId = categoryId ? String(categoryId) : '';

    interface PushProdStat {
      productId: string;
      productCode: string;
      productName: string;
      categoryId: string;
      categoryName: string;
      unit: string;
      soldQty: number;
      giftQty: number;
      returnedQty: number;
      exchangeOutQty: number;
      revenue: number;
      cogs: number;
      orderIds: Set<string>;
      lastSoldAt: Date | null;
    }

    const prodStats = new Map<string, PushProdStat>();
    const ensureProdStat = (
      pId: string,
      pCode: string,
      pName: string,
      unit: string
    ): PushProdStat => {
      const prod = prodById.get(pId) || prodByCode.get(pCode);
      const key = prod ? String(prod._id) : pCode || pId;
      if (!prodStats.has(key)) {
        const cId = prod ? String(prod.categoryId || '') : '';
        prodStats.set(key, {
          productId: prod ? String(prod._id) : pId,
          productCode: prod ? prod.code : pCode,
          productName: prod ? prod.name : pName,
          categoryId: cId,
          categoryName: catMap.get(cId) || 'Chưa phân loại',
          unit: prod ? prod.unit : unit || 'Cái',
          soldQty: 0,
          giftQty: 0,
          returnedQty: 0,
          exchangeOutQty: 0,
          revenue: 0,
          cogs: 0,
          orderIds: new Set<string>(),
          lastSoldAt: null,
        });
      }
      return prodStats.get(key)!;
    };

    products.forEach((p) => {
      if (filterCatId && String(p.categoryId) !== filterCatId) return;
      ensureProdStat(String(p._id), p.code, p.name, p.unit);
    });

    for (const o of orders) {
      if (o.status === 'DRAFT' || !inRange(o.createdAt)) continue;
      const orderSub = Number(o.subtotal) || 0;
      const orderBillDisc = Number(o.billDiscountAmount) || 0;

      for (const it of o.items || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const isGift = Boolean(it.isGift) || it.discountType === 'GIFT';
        const lineTotal = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const billDiscShare =
          !isGift && orderSub > 0 ? Math.round((lineTotal / orderSub) * orderBillDisc) : 0;
        const netItemRev = Math.max(0, lineTotal - billDiscShare);

        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        if (isGift) {
          st.giftQty += qty;
        } else {
          st.soldQty += qty;
          st.revenue += netItemRev;
        }
        st.cogs += qty * unitCost;
        st.orderIds.add(String(o._id));
        if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
          st.lastSoldAt = new Date(o.createdAt);
        }
      }
    }

    for (const r of returns) {
      if (!inRange(r.createdAt)) continue;
      for (const it of r.returnItems || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.returnedQty += qty;
        st.revenue = Math.max(0, st.revenue - line);
        if (it.condition === 'GOOD' || it.restocked) {
          st.cogs = Math.max(0, st.cogs - qty * unitCost);
        }
      }
      for (const it of r.exchangeItems || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.exchangeOutQty += qty;
        st.revenue += line;
        st.cogs += qty * unitCost;
      }
    }

    const allProductRows = Array.from(prodStats.values()).map((st) => {
      const prod = prodById.get(st.productId) || prodByCode.get(st.productCode);
      const floors = prod ? getFloorStocks(prod) : { stockFloor1: 0, stockFloor2: 0, stock: 0 };
      const stockFloor1 = floors.stockFloor1;
      const stockFloor2 = floors.stockFloor2;
      const stock = floors.stock;
      const sellingPrice = Number(prod?.sellingPrice ?? 0);
      const costPrice = Number(prod?.costPrice ?? 0);
      const netSoldQty = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
      const profit = st.revenue - st.cogs;
      const marginPercent = st.revenue > 0 ? Math.round((profit / st.revenue) * 1000) / 10 : 0;
      const inventoryCostValue = stock * costPrice;
      const inventorySellValue = stock * sellingPrice;

      const pushReasons: string[] = [];
      let suggestedAction = '';
      let pushScore = 0;

      if (stock > 0) {
        if (sellingPrice <= 0) {
          pushReasons.push('Chưa đặt giá bán (0 VND)');
          suggestedAction = 'Cập nhật giá bán lẻ trong Quản lý Kho để POS có thể bán';
          pushScore += 100;
        }
        if (stockFloor1 === 0 && stockFloor2 > 0) {
          pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction = 'Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày';
          }
          pushScore += 80 + Math.min(40, stockFloor2 * 2);
        }
        if (netSoldQty === 0) {
          pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction =
              stock >= 10
                ? 'Tồn kho cao chưa phát sinh đơn — Nên chạy khuyến mãi giảm giá % hoặc tặng kèm combo'
                : 'Trưng bày nổi bật tại quầy Tầng 1 hoặc tư vấn ưu tiên cho khách';
          }
          pushScore += 50 + Math.min(50, stock * 3);
        } else if (stock >= netSoldQty * 5 && stock >= 6) {
          pushReasons.push(
            `Tồn kho cao gấp ${Math.round(stock / netSoldQty)} lần lượng bán (Tồn ${stock} / Bán ${netSoldQty})`
          );
          if (!suggestedAction) {
            suggestedAction = 'Tốc độ tiêu thụ chậm so với lượng tồn — Nên giảm giá nhẹ hoặc đẩy mạnh giới thiệu';
          }
          pushScore += 30 + Math.min(40, stock * 2);
        }

        if (inventoryCostValue >= 3000000 && netSoldQty <= 1) {
          pushReasons.push(`Đọng vốn lớn (${Math.round((inventoryCostValue / 1000000) * 10) / 10}tr VND)`);
          pushScore += 35;
        }
      }

      return {
        productId: st.productId,
        productCode: st.productCode,
        productName: st.productName,
        categoryId: st.categoryId,
        categoryName: st.categoryName,
        unit: st.unit,
        soldQty: st.soldQty,
        giftQty: st.giftQty,
        returnedQty: st.returnedQty,
        netSoldQty,
        revenue: st.revenue,
        cogs: st.cogs,
        grossProfit: profit,
        marginPercent,
        orderCount: st.orderIds.size,
        lastSoldAt: st.lastSoldAt,
        sellingPrice,
        costPrice,
        stockFloor1,
        stockFloor2,
        stock,
        inventoryCostValue,
        inventorySellValue,
        restockAlert: '',
        pushScore,
        pushReasons,
        suggestedAction,
      };
    });

    const needsPushProducts = allProductRows
      .filter((r) => r.stock > 0 && r.pushScore > 0)
      .sort((a, b) => {
        if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
        if (b.inventoryCostValue !== a.inventoryCostValue)
          return b.inventoryCostValue - a.inventoryCostValue;
        return b.stock - a.stock;
      });

    const summary = {
      totalPushProducts: needsPushProducts.length,
      zeroSalesCount: needsPushProducts.filter((p) => p.netSoldQty === 0).length,
      highCapitalCount: needsPushProducts.filter((p) => p.inventoryCostValue >= 2000000).length,
      floor2OnlyCount: needsPushProducts.filter((p) => p.stockFloor1 === 0 && p.stockFloor2 > 0).length,
      noPriceCount: needsPushProducts.filter((p) => p.sellingPrice <= 0).length,
      totalPushStock: needsPushProducts.reduce((s, p) => s + p.stock, 0),
      totalPushCapitalValue: needsPushProducts.reduce((s, p) => s + p.inventoryCostValue, 0),
    };

    res.json({
      data: {
        summary,
        needsPushProducts,
        categories,
      },
      meta: {
        from: from || null,
        to: to || null,
        categoryId: categoryId || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

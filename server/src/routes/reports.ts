import { Router } from 'express';
import {
  staffRepo,
  orderRepo,
  returnExchangeRepo,
  importReceiptRepo,
  stockMovementRepo,
} from '../config/db';
import { ApiError } from '../utils/errors';
import { floorLabel } from '../utils/warehouseFloor';

export const reportsRouter = Router();

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

// GET /api/v1/reports/staff-activity — Quản lý xem nhân viên nào bán hàng / kiểm kho
reportsRouter.get('/reports/staff-activity', async (req, res, next) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý (ADMIN) được xem báo cáo hoạt động nhân viên');
    }

    const { from, to, staffId } = req.query;
    const fromDate = from ? new Date(String(from)) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);
    const toDate = to ? new Date(String(to)) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);
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

    for (const m of transferMovements) {
      if (!inRange(m.createdAt)) continue;
      const fromText = floorLabel(m.fromWarehouse || 'FLOOR_1');
      const toText = floorLabel(m.toWarehouse || 'FLOOR_2');
      const qty = Math.abs(Number(m.quantityChange) || 0);
      warehouse.push({
        type: 'EXPORT_TRANSFER',
        at: m.createdAt,
        staffId: norm(m.performedBy),
        staffName: m.performedByName || 'Không xác định',
        referenceCode: m.referenceCode,
        quantity: qty,
        detail: `Xuất kho chuyển tầng: ${m.productName} (${fromText} → ${toText})${m.note ? ` — ${m.note}` : ''}`,
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

import type { Migration } from '../types';

const NAME = '20261113000002-backfill-order-debt-fields';

/**
 * Đơn hàng tạo trước khi có module công nợ có thể thiếu các trường:
 * debtAmount, initialDebtAmount, debtStatus, debtPayments, debtAdjustments.
 * Migration suy ra số nợ từ splitPayments (method=DEBT) hoặc paymentMethodDetail ("Công nợ ...: 1.000.000").
 * Chỉ chạm document THIẾU trường, đánh dấu __migratedBy để có thể hoàn tác.
 */
function deriveDebt(o: any): number {
  const total = Math.max(0, Number(o.totalAmount) || 0);
  const splits = Array.isArray(o.splitPayments) ? o.splitPayments : [];
  const fromSplit = splits
    .filter((s: any) => s?.method === 'DEBT')
    .reduce((s: number, x: any) => s + Math.max(0, Number(x.amount) || 0), 0);
  if (fromSplit > 0) return Math.min(total, fromSplit);
  if (o.paymentMethod === 'OTHER') {
    const m = /(?:công\s*nợ|trả\s*sau|debt)[^0-9]*([0-9][0-9.,]*)/i.exec(String(o.paymentMethodDetail || ''));
    if (m) {
      const n = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
      if (n > 0) return Math.min(total, n);
    }
  }
  return 0;
}

const migration: Migration = {
  description: 'Bổ sung các trường công nợ còn thiếu cho đơn hàng cũ',

  async up({ db, log, write }) {
    const col = db.collection('orders');
    const cursor = col.find({
      $or: [
        { debtAmount: { $exists: false } },
        { initialDebtAmount: { $exists: false } },
        { debtStatus: { $exists: false } },
        { debtPayments: { $exists: false } },
        { debtAdjustments: { $exists: false } },
      ],
    });
    let n = 0;
    for await (const o of cursor) {
      const set: Record<string, unknown> = {};
      const debt = o.debtAmount === undefined ? deriveDebt(o) : Math.max(0, Number(o.debtAmount) || 0);
      if (o.debtAmount === undefined) set.debtAmount = debt;
      if (o.initialDebtAmount === undefined) set.initialDebtAmount = debt;
      if (o.debtStatus === undefined) {
        const paid = Math.max(0, Number(o.totalAmount) || 0) - debt;
        set.debtStatus = debt <= 0 ? 'NONE' : paid <= 0 ? 'UNPAID' : 'PARTIAL';
      }
      if (o.debtPayments === undefined) set.debtPayments = [];
      if (o.debtAdjustments === undefined) set.debtAdjustments = [];
      if (o.debtAmount === undefined && debt > 0) log(`${o.orderCode}: suy ra công nợ ${debt.toLocaleString('vi-VN')}`);
      n++;
      await write(`${o.orderCode} set ${Object.keys(set).join(',')}`, () =>
        col.updateOne(
          { _id: o._id },
          { $set: { ...set, [`__migratedBy.${NAME}`]: Object.keys(set) } }
        )
      );
    }
    log(`Tổng số đơn được bổ sung: ${n}`);
  },

  async down({ db, write }) {
    const col = db.collection('orders');
    const cursor = col.find({ [`__migratedBy.${NAME}`]: { $exists: true } });
    for await (const o of cursor) {
      const fields: string[] = o.__migratedBy?.[NAME] || [];
      const unset: Record<string, ''> = { [`__migratedBy.${NAME}`]: '' };
      fields.forEach((f) => (unset[f] = ''));
      await write(`${o.orderCode} unset ${fields.join(',')}`, () =>
        col.updateOne({ _id: o._id }, { $unset: unset })
      );
    }
  },
};

export default migration;

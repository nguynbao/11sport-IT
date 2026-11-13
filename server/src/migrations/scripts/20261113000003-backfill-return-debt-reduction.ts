import type { Migration } from '../types';

const NAME = '20261113000003-backfill-return-debt-reduction';
const ADJ_PREFIX = 'da_mig_';

/**
 * Phiếu trả/đổi tạo bằng code cũ (trước 12/11/2026 15:04) không cấn trừ công nợ
 * => đơn gốc đã trả hàng nhưng vẫn còn nợ (vd HD-0181 / TH-0010).
 * Migration xử lý tuần tự theo thời gian tạo phiếu:
 *   debtReduction = min(dư nợ đơn hiện tại, refundAmount); cashRefund = phần còn lại.
 * Ghi lịch sử debtAdjustments (type RETURN) cho đơn, đánh dấu __migratedBy để hoàn tác.
 * Không sửa refundAmount/returnTotal (số tiền thực tế đã giao dịch phải đối soát tay).
 */
const migration: Migration = {
  description: 'Cấn trừ công nợ cho các phiếu trả hàng cũ chưa trừ nợ',

  async up({ db, log, write }) {
    const returns = db.collection('returnexchanges');
    const orders = db.collection('orders');
    const pending = await returns
      .find({ debtReduction: { $exists: false } })
      .sort({ createdAt: 1 })
      .toArray();
    log(`Phiếu chưa có debtReduction: ${pending.length}`);

    const debtState = new Map<string, number>(); // giữ dư nợ đang mô phỏng (cho cả dry-run)
    let fixed = 0;

    for (const r of pending) {
      const order =
        (r.orderId && (await orders.findOne({ _id: toObjectId(r.orderId) }))) ||
        (await orders.findOne({ orderCode: r.orderCode }));
      if (!order) {
        log(`⚠ ${r.code}: không tìm thấy đơn gốc ${r.orderCode}, bỏ qua`);
        continue;
      }
      const key = String(order._id);
      const debtBefore = debtState.has(key)
        ? debtState.get(key)!
        : Math.max(0, Math.round(Number(order.debtAmount) || 0));
      const refund = Math.max(0, Math.round(Number(r.refundAmount) || 0));
      const reduction = Math.min(debtBefore, refund);
      const debtAfter = debtBefore - reduction;
      const cashRefund = refund - reduction;
      debtState.set(key, debtAfter);

      await write(
        `${r.code}: debtBefore=${debtBefore} debtReduction=${reduction} debtAfter=${debtAfter} cashRefund=${cashRefund}`,
        () =>
          returns.updateOne(
            { _id: r._id },
            {
              $set: {
                debtBefore,
                debtReduction: reduction,
                debtAfter,
                cashRefund,
                [`__migratedBy.${NAME}`]: true,
              },
            }
          )
      );

      if (reduction > 0) {
        fixed++;
        if (cashRefund > 0) {
          log(`⚠ ${r.code}: còn hoàn tiền mặt ${cashRefund.toLocaleString('vi-VN')} — cần đối soát với cửa hàng`);
        }
        await write(`${order.orderCode}: debtAmount ${debtBefore} -> ${debtAfter}`, () =>
          orders.updateOne(
            { _id: order._id },
            {
              $set: { debtAmount: debtAfter, debtStatus: debtAfter === 0 ? 'SETTLED' : 'PARTIAL' },
              $push: {
                debtAdjustments: {
                  _id: `${ADJ_PREFIX}${r.code}`,
                  type: 'RETURN',
                  returnCode: r.code,
                  amount: reduction,
                  debtBefore,
                  debtAfter,
                  at: r.createdAt || new Date(),
                  by: 'MIGRATION',
                  byName: `Migration ${NAME}`,
                },
              } as any,
            }
          )
        );
      }
    }
    log(`Số đơn được cấn trừ nợ: ${fixed}`);
  },

  async down({ db, write }) {
    const returns = db.collection('returnexchanges');
    const orders = db.collection('orders');
    const affectedOrders = orders.find({ 'debtAdjustments._id': { $regex: `^${ADJ_PREFIX}` } });
    for await (const o of affectedOrders) {
      const mine = (o.debtAdjustments || []).filter((a: any) => String(a._id).startsWith(ADJ_PREFIX));
      const restore = mine.reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
      const debt = Math.max(0, Number(o.debtAmount) || 0) + restore;
      const status = debt <= 0 ? 'NONE' : debt >= (Number(o.initialDebtAmount) || 0) ? 'UNPAID' : 'PARTIAL';
      await write(`${o.orderCode}: hoàn lại nợ +${restore}`, () =>
        orders.updateOne(
          { _id: o._id },
          {
            $set: { debtAmount: debt, debtStatus: status },
            $pull: { debtAdjustments: { _id: { $regex: `^${ADJ_PREFIX}` } } } as any,
          }
        )
      );
    }
    await write('unset trường nợ trên phiếu trả do migration thêm', () =>
      returns.updateMany(
        { [`__migratedBy.${NAME}`]: true },
        { $unset: { debtBefore: '', debtReduction: '', debtAfter: '', cashRefund: '', [`__migratedBy.${NAME}`]: '' } }
      )
    );
  },
};

function toObjectId(id: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ObjectId } = require('mongodb');
  try {
    return new ObjectId(String(id));
  } catch {
    return id;
  }
}

export default migration;

import type { Migration } from '../types';

const NAME = '20261113000003-backfill-return-debt-reduction';
const ADJ_PREFIX = 'da_mig_';

/**
 * Phiếu trả/đổi tạo bằng code cũ (trước 12/11/2026 15:04) không cấn trừ công nợ
 * => đơn gốc đã trả hàng nhưng vẫn còn nợ (vd HD-0181 / TH-0010).
 * Migration xử lý tuần tự theo thời gian tạo phiếu:
 *   debtReduction = min(dư nợ đơn hiện tại, refundAmount); cashRefund = phần còn lại.
 * Ghi lịch sử debtAdjustments (type RETURN) cho đơn, đánh dấu __migratedBy để hoàn tác.
 * Thứ tự ghi: ĐƠN trước (filter chống trừ 2 lần) -> PHIẾU sau. Chết giữa chừng thì chạy lại an toàn.
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
      const adjId = `${ADJ_PREFIX}${r.code}`;
      const refund = Math.max(0, Math.round(Number(r.refundAmount) || 0));

      // Idempotent: nếu lần chạy trước đã ghi xong phía ĐƠN (có adjustment adjId) nhưng chết trước khi
      // ghi phiếu trả => dùng lại đúng số liệu đã ghi, KHÔNG trừ nợ lần nữa, chỉ hoàn tất phía phiếu.
      const existingAdj = (Array.isArray(order.debtAdjustments) ? order.debtAdjustments : []).find(
        (a: any) => a?._id === adjId
      );

      let debtBefore: number;
      let reduction: number;
      let debtAfter: number;
      if (existingAdj) {
        debtBefore = Math.max(0, Number(existingAdj.debtBefore) || 0);
        reduction = Math.max(0, Number(existingAdj.amount) || 0);
        debtAfter = Math.max(0, Number(existingAdj.debtAfter) || 0);
        debtState.set(key, Math.max(0, Math.round(Number(order.debtAmount) || 0)));
        log(`↻ ${r.code}: đơn ${order.orderCode} đã được trừ nợ ở lần chạy trước, chỉ hoàn tất phiếu trả`);
      } else {
        debtBefore = debtState.has(key)
          ? debtState.get(key)!
          : Math.max(0, Math.round(Number(order.debtAmount) || 0));
        reduction = Math.min(debtBefore, refund);
        debtAfter = debtBefore - reduction;
        debtState.set(key, debtAfter);
      }
      const cashRefund = Math.max(0, refund - reduction);

      // BƯỚC 1: ghi phía ĐƠN trước. Filter loại trừ adjId => chạy lại không bao giờ trừ nợ 2 lần.
      if (!existingAdj && reduction > 0) {
        fixed++;
        if (cashRefund > 0) {
          log(`⚠ ${r.code}: còn hoàn tiền mặt ${cashRefund.toLocaleString('vi-VN')} — cần đối soát với cửa hàng`);
        }
        await write(`${order.orderCode}: debtAmount ${debtBefore} -> ${debtAfter}`, async () => {
          const res = await orders.updateOne(
            { _id: order._id, 'debtAdjustments._id': { $ne: adjId } },
            {
              $set: { debtAmount: debtAfter, debtStatus: debtAfter === 0 ? 'SETTLED' : 'PARTIAL' },
              $push: {
                debtAdjustments: {
                  _id: adjId,
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
          );
          if (res.matchedCount !== 1) {
            throw new Error(`${order.orderCode}: cập nhật đơn thất bại/đã bị thay đổi đồng thời — dừng để chạy lại`);
          }
          return res;
        });
      }

      // BƯỚC 2: ghi phía PHIẾU sau cùng. Phiếu chỉ được đánh dấu xong khi đơn đã cập nhật.
      await write(
        `${r.code}: debtBefore=${debtBefore} debtReduction=${reduction} debtAfter=${debtAfter} cashRefund=${cashRefund}`,
        () =>
          returns.updateOne(
            { _id: r._id, debtReduction: { $exists: false } },
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

import type { ReturnReceipt } from "@/shared/types";
import { formatVND, formatDateTime } from "@/shared/utils/format";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { PaginationBar } from "@/shared/ui/PaginationBar";

type Props = { recentReturns: ReturnReceipt[] };

export default function RecentReturnsTable({ recentReturns }: Props) {
  const {
    page: returnsPage,
    pageSize: returnsPageSize,
    total: returnsTotal,
    totalPages: returnsTotalPages,
    items: pagedReturns,
    setPage: setReturnsPage,
    setPageSize: setReturnsPageSize,
  } = useClientPagination(recentReturns, 10);

  if (recentReturns.length === 0) return null;

  return (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
    <h3 className="font-bold text-slate-900 text-sm mb-3">
      Lịch sử Phiếu Trả / Đổi Hàng gần đây
    </h3>
    <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
      <table className="w-full min-w-[760px] text-xs text-left">
        <thead className="bg-slate-100 text-slate-700 uppercase">
          <tr>
            <th className="py-2.5 px-3">Mã Phiếu</th>
            <th className="py-2.5 px-3">Đơn gốc</th>
            <th className="py-2.5 px-3">Loại</th>
            <th className="py-2.5 px-3 text-right">Tiền hàng trả</th>
            <th className="py-2.5 px-3 text-right">Tiền hàng đổi</th>
            <th className="py-2.5 px-3 text-right">Chênh lệch / Hoàn trả</th>
            <th className="py-2.5 px-3">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {pagedReturns.map((r) => (
            <tr key={r._id}>
              <td className="py-2.5 px-3 font-mono font-bold">
                {r.returnCode || r.code}
              </td>
              <td className="py-2.5 px-3 font-mono">{r.orderCode}</td>
              <td className="py-2.5 px-3 font-bold">
                {r.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}
              </td>
              <td className="py-2.5 px-3 text-right font-mono">
                <div>{formatVND(r.returnTotal)}</div>
                {Number(r.refundedCardFee) > 0 && (
                  <div className="text-[10px] text-brand-ink font-sans font-semibold">
                    (gồm phí thẻ {formatVND(Number(r.refundedCardFee))})
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 text-right font-mono">
                {formatVND(r.exchangeTotal)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                <div>
                  {r.netDifference < 0
                    ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                    : r.netDifference > 0
                      ? `Thu thêm ${formatVND(r.netDifference)}`
                      : "0 ₫"}
                </div>
                {r.netDifference < 0 && Number(r.debtReduction) > 0 && (
                  <div className="text-[10px] font-sans font-semibold text-purple-700 mt-0.5 space-y-0.5">
                    <div>
                      • Cấn trừ nợ: -{formatVND(Number(r.debtReduction))}
                      {r.debtAfter !== undefined
                        ? ` (Còn nợ: ${formatVND(Number(r.debtAfter))})`
                        : ""}
                    </div>
                    <div className="text-brand-ink">
                      • Thực hoàn tiền: {formatVND(Number(r.cashRefund ?? 0))}
                    </div>
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                {formatDateTime(r.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <PaginationBar
      totalItems={returnsTotal}
      page={returnsPage}
      totalPages={returnsTotalPages}
      pageSize={returnsPageSize}
      onPageChange={setReturnsPage}
      onPageSizeChange={setReturnsPageSize}
      itemLabel="phiếu đổi trả"
    />
  </div>
  );
}

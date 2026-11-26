"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { ReturnReceipt } from "@/shared/types";
import { formatVND, formatDateTime } from "@/shared/utils/format";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import ReturnDetailModal from "./ReturnDetailModal";

type Props = { recentReturns: ReturnReceipt[] };

export default function RecentReturnsTable({ recentReturns }: Props) {
  const [selectedReturn, setSelectedReturn] = useState<ReturnReceipt | null>(null);
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-slate-900 text-sm">
          Lịch sử Phiếu Trả / Đổi Hàng gần đây
        </h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Bấm vào dòng để xem chi tiết
        </span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {pagedReturns.map((r) => (
          <button
            key={r._id}
            type="button"
            onClick={() => setSelectedReturn(r)}
            className="w-full text-left rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-3 space-y-2 transition cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs font-extrabold text-slate-900">
                  {r.returnCode || r.code}
                </span>
                <span className="text-[11px] text-slate-400">•</span>
                <span className="font-mono text-[11px] font-semibold text-brand-ink">
                  {r.orderCode}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-brand-ink shrink-0">
                {r.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Tiền hàng trả</div>
                <div className="font-mono font-bold text-amber-700">{formatVND(r.returnTotal)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Tiền hàng đổi</div>
                <div className="font-mono font-bold text-brand-ink">{formatVND(r.exchangeTotal)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
              <span className="text-[11px] font-mono font-bold text-slate-800">
                {r.netDifference < 0
                  ? `Hoàn ${formatVND(Math.abs(r.netDifference))}`
                  : r.netDifference > 0
                    ? `Thu thêm ${formatVND(r.netDifference)}`
                    : "0 ₫"}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-ink">
                <Eye className="w-3.5 h-3.5" />
                Chi tiết
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl max-w-full">
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
              <th className="py-2.5 px-3 text-center">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pagedReturns.map((r) => (
              <tr
                key={r._id}
                onClick={() => setSelectedReturn(r)}
                className="hover:bg-blue-50/40 transition cursor-pointer"
              >
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
                <td className="py-2.5 px-3 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReturn(r);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-brand-ink font-bold text-[11px] transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem
                  </button>
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

      <ReturnDetailModal
        returnReceipt={selectedReturn}
        onClose={() => setSelectedReturn(null)}
      />
    </div>
  );
}

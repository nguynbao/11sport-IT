"use client";

import React from "react";
import { ReturnReceipt } from "@/shared/types";
import { formatVND, formatDateTime } from "@/shared/utils/format";
import { Printer, RotateCcw, Eye } from "lucide-react";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { exportReturns } from "../exports";

interface ReturnsTableSectionProps {
  displayedReturns: ReturnReceipt[];
  returnTypeFilter: string;
  setReturnTypeFilter: (v: string) => void;
  retPage: number;
  retPageSize: number;
  retTotal: number;
  retTotalPages: number;
  setRetPage: (p: number) => void;
  setRetPageSize: (s: number) => void;
  onSelectReturn: (r: ReturnReceipt) => void;
  onPrintReturn: (r: ReturnReceipt) => void;
}

export function ReturnsTableSection({
  displayedReturns,
  returnTypeFilter,
  setReturnTypeFilter,
  retPage,
  retPageSize,
  retTotal,
  retTotalPages,
  setRetPage,
  setRetPageSize,
  onSelectReturn: setSelectedReturn,
  onPrintReturn: setPrintableReturn,
}: ReturnsTableSectionProps) {
  return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Danh sách Phiếu Trả / Đổi Hàng ({displayedReturns.length})
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={returnTypeFilter}
              onChange={(e) => setReturnTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="">Tất cả loại phiếu</option>
              <option value="RETURN">Trả hàng hoàn tiền</option>
              <option value="EXCHANGE">Đổi hàng</option>
            </select>
            <ExportExcelButton onExport={() => exportReturns(displayedReturns)} disabled={displayedReturns.length === 0} />
          </div>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table data-cards data-no-detail className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3">Mã Phiếu</th>
                <th className="py-3 px-3">Đơn hàng gốc</th>
                <th className="py-3 px-3">Loại</th>
                <th className="py-3 px-3 text-right">Tiền hàng trả</th>
                <th className="py-3 px-3 text-right">Tiền hàng đổi</th>
                <th className="py-3 px-3 text-right">Chênh lệch</th>
                <th className="py-3 px-3">NV xử lý</th>
                <th className="py-3 px-3">Ghi chú</th>
                <th className="py-3 px-3">Ngày tạo</th>
                <th className="py-3 px-3 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedReturns.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => setSelectedReturn(r)}
                  className="hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="py-3 px-3 font-mono font-bold">
                    {r.returnCode || r.code}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-brand-ink">
                    {r.orderCode}
                  </td>
                  <td className="py-3 px-3 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        r.type === "RETURN"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-teal-100 text-brand-ink"
                      }`}
                    >
                      {r.type === "RETURN" ? "Trả hàng" : "Đổi hàng"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    <div>{formatVND(r.returnTotal)}</div>
                    {Number(r.refundedCardFee) > 0 && (
                      <div className="text-[10px] text-brand-ink font-sans font-semibold">
                        (gồm phí thẻ {formatVND(Number(r.refundedCardFee))})
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatVND(r.exchangeTotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    <div>
                      {r.netDifference < 0
                        ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                        : r.netDifference > 0
                          ? `Thu thêm ${formatVND(r.netDifference)}`
                          : "0 ₫"}
                    </div>
                    {r.netDifference < 0 && Number(r.debtReduction) > 0 && (
                      <div className="text-[10px] font-sans font-semibold text-purple-700 mt-0.5 space-y-0.5">
                        <div>• Cấn trừ nợ: -{formatVND(Number(r.debtReduction))}</div>
                        <div className="text-brand-ink">
                          • Thực hoàn tiền: {formatVND(Number(r.cashRefund ?? 0))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    {r.performedByName || "-"}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{r.note || "-"}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReturn(r);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          totalItems={retTotal}
          page={retPage}
          totalPages={retTotalPages}
          pageSize={retPageSize}
          onPageChange={setRetPage}
          onPageSizeChange={setRetPageSize}
          itemLabel="phiếu trả/đổi"
        />
      </div>
  );
}

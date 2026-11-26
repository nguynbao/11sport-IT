"use client";

import type { ReturnReceipt } from "@/shared/types";
import { ResponsiveModal } from "@/shared/ui/ResponsiveModal";
import { formatDateTime, formatVND } from "@/shared/utils/format";

interface Props {
  returnReceipt: ReturnReceipt | null;
  onClose: () => void;
}

export default function ReturnDetailModal({ returnReceipt, onClose }: Props) {
  if (!returnReceipt) return null;

  const r = returnReceipt;
  const code = r.returnCode || r.code || r._id;

  return (
    <ResponsiveModal
      open={Boolean(returnReceipt)}
      onClose={onClose}
      title={`Phiếu ${r.type === "EXCHANGE" ? "Đổi Hàng" : "Trả Hàng"}: ${code}`}
      subtitle={`Đơn gốc ${r.orderCode} • ${formatDateTime(r.createdAt)}`}
      maxWidthClass="max-w-2xl"
      headerClassName="bg-blue-600 text-slate-900"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-slate-900 font-extrabold text-sm cursor-pointer"
        >
          Đóng
        </button>
      }
    >
      <div className="space-y-4">
        {/* Thông tin chung */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Khách hàng</div>
            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
              {r.customerName || "Khách lẻ"}
            </div>
            {r.customerPhone && (
              <div className="text-[11px] font-mono text-slate-500">{r.customerPhone}</div>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Nhân viên xử lý</div>
            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
              {r.performedByName || "Nhân viên"}
            </div>
            <div className="text-[11px] text-slate-500">{r.refundMethod || "CASH"}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Chênh lệch</div>
            <div className="text-xs font-extrabold font-mono text-brand-ink mt-0.5">
              {r.netDifference < 0
                ? `Hoàn ${formatVND(Math.abs(r.netDifference))}`
                : r.netDifference > 0
                  ? `Thu thêm ${formatVND(r.netDifference)}`
                  : "Ngang giá (0 ₫)"}
            </div>
          </div>
        </div>

        {/* Hàng khách trả */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            1. Hàng khách trả lại ({r.returnItems?.length || 0} dòng)
          </h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
            {(r.returnItems || []).map((it, idx) => (
              <div key={idx} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold text-slate-900 leading-snug">
                    {it.productName}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-mono font-semibold text-slate-600">
                      {it.productCode}
                    </span>
                    {(it.color || it.size) && (
                      <span>
                        • {[it.color, it.size].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        it.condition === "GOOD"
                          ? "bg-teal-50 text-brand-ink border border-teal-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {it.condition === "GOOD" ? "Còn bán được" : "Hư hỏng"}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-extrabold text-amber-700">
                    {formatVND(it.lineTotal)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    SL: {it.quantity} × {formatVND(it.unitPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hàng xuất đổi */}
        {Array.isArray(r.exchangeItems) && r.exchangeItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-ink">
              2. Hàng mới xuất đổi ({r.exchangeItems.length} dòng)
            </h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-blue-200 overflow-hidden bg-blue-50/30">
              {r.exchangeItems.map((it, idx) => (
                <div key={idx} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-slate-900 leading-snug">
                      {it.productName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-mono font-semibold text-slate-600">
                        {it.productCode}
                      </span>
                      {(it.color || it.size) && (
                        <span>
                          • {[it.color, it.size].filter(Boolean).join(" / ")}
                        </span>
                      )}
                      {Number(it.discountAmount) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px]">
                          Giảm {formatVND(Number(it.discountAmount))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-extrabold text-brand-ink">
                      {formatVND(it.lineTotal)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      SL: {it.quantity} × {formatVND(it.unitPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tổng kết tiền */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Tiền hàng trả lại:</span>
            <span className="font-mono font-bold text-amber-700">
              {formatVND(r.returnTotal)}
            </span>
          </div>
          {Number(r.refundedCardFee) > 0 && (
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>• Trong đó phí thẻ hoàn lại:</span>
              <span className="font-mono">{formatVND(Number(r.refundedCardFee))}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Tiền hàng đổi mới:</span>
            <span className="font-mono font-bold text-brand-ink">
              {formatVND(r.exchangeTotal)}
            </span>
          </div>
          {Number(r.debtReduction) > 0 && (
            <div className="flex justify-between text-purple-700 font-semibold">
              <span>Cấn trừ công nợ:</span>
              <span className="font-mono">-{formatVND(Number(r.debtReduction))}</span>
            </div>
          )}
          {r.note && (
            <div className="pt-1.5 border-t border-slate-200 text-slate-600">
              <span className="font-bold text-slate-700">Ghi chú: </span>
              {r.note}
            </div>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}

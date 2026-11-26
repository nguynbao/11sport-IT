"use client";

import { Printer, RotateCcw } from "lucide-react";
import type { Order, ReturnReceipt } from "@/shared/types";
import { ResponsiveModal } from "@/shared/ui/ResponsiveModal";
import { formatDateTime, formatPhone, formatVND } from "@/shared/utils/format";

interface Props {
  order: Order | null;
  relatedReturns: ReturnReceipt[];
  canReturn?: boolean;
  onClose: () => void;
  onOpenInvoice: (order: Order) => void;
  onOpenReturn?: (order: Order) => void;
  onSelectReturn: (r: ReturnReceipt) => void;
}

export default function OrderDetailModal({
  order,
  relatedReturns,
  canReturn,
  onClose,
  onOpenInvoice,
  onOpenReturn,
  onSelectReturn,
}: Props) {
  if (!order) return null;

  const ord = order;
  const totalDisc =
    (Number(ord.itemDiscountTotal) || 0) + (Number(ord.billDiscountAmount) || 0);
  const isReturnableStatus =
    ord.status === "PAID" || ord.status === "PARTIALLY_RETURNED";

  return (
    <ResponsiveModal
      open={Boolean(order)}
      onClose={onClose}
      title={`Chi tiết đơn hàng: ${ord.orderCode || ord.code}`}
      subtitle={`${formatDateTime(ord.createdAt)} • ${ord.status}`}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center gap-2">
          {canReturn && isReturnableStatus && onOpenReturn && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReturn(ord);
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Trả hàng
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenInvoice(ord)}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            PDF (K80/A4)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm cursor-pointer"
          >
            Đóng
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Thông tin chung */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Khách hàng</div>
            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
              {ord.customerName || "Khách lẻ"}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              {formatPhone(ord.customerPhone) || "-"}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Nhân viên</div>
            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
              Tạo: {ord.createdByName || ord.soldByName || "-"}
            </div>
            <div className="text-[11px] text-brand-ink truncate">
              {ord.status !== "DRAFT"
                ? `Chốt: ${ord.confirmedByName || ord.createdByName || "-"}`
                : "(Chưa chốt TT)"}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Thanh toán</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {ord.paymentMethod}
              {ord.paymentMethod === "OTHER" && ord.paymentMethodDetail
                ? ` (${ord.paymentMethodDetail})`
                : ""}
            </div>
            {Number(ord.debtAmount || 0) > 0 && (
              <div className="text-[11px] font-extrabold text-amber-700">
                Còn nợ: {formatVND(ord.debtAmount || 0)}
              </div>
            )}
          </div>
        </div>

        {/* Danh sách sản phẩm */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Sản phẩm mua ({ord.items?.length || 0} dòng)
          </h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
            {(ord.items || []).map((it, idx) => {
              const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
              return (
                <div key={idx} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-slate-900 leading-snug flex flex-wrap items-center gap-1.5">
                      <span>{it.productName}</span>
                      {isGift && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          🎁 Hàng tặng
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {it.productCode && (
                        <span className="font-mono font-semibold text-slate-600">
                          {it.productCode}
                        </span>
                      )}
                      {Number(it.returnedQuantity || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px]">
                          Đã trả: {it.returnedQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-extrabold text-brand-ink">
                      {isGift ? "0 ₫" : formatVND(it.lineTotal)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      SL: {it.quantity} × {isGift ? "0 ₫" : formatVND(it.unitPrice)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tổng kết tiền */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Tiền hàng:</span>
            <span className="font-mono font-bold text-slate-900">
              {formatVND(ord.rawSubtotal || ord.subtotal)}
            </span>
          </div>
          {totalDisc > 0 && (
            <div className="flex justify-between text-rose-700">
              <span>Giảm giá:</span>
              <span className="font-mono font-bold">-{formatVND(totalDisc)}</span>
            </div>
          )}
          {Number(ord.cardFee || 0) > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Phí thẻ:</span>
              <span className="font-mono font-bold">{formatVND(ord.cardFee)}</span>
            </div>
          )}
          <div className="pt-1.5 border-t border-slate-200 flex justify-between text-sm font-extrabold">
            <span className="text-slate-900">Tổng thu:</span>
            <span className="font-mono text-brand-ink">{formatVND(ord.totalAmount)}</span>
          </div>
          {ord.note && (
            <div className="pt-1.5 border-t border-slate-200 text-slate-600">
              <span className="font-bold text-slate-700">Ghi chú: </span>
              {ord.note}
            </div>
          )}
        </div>

        {/* Phiếu đổi trả liên quan */}
        {relatedReturns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
              Phiếu Trả / Đổi liên quan ({relatedReturns.length})
            </h4>
            <div className="space-y-1.5">
              {relatedReturns.map((r) => (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => onSelectReturn(r)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 flex items-center justify-between gap-2 text-xs cursor-pointer transition"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {r.returnCode || r.code}
                    </span>
                    <span className="ml-2 text-slate-500">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <span className="font-mono font-bold text-brand-ink">
                    {r.netDifference > 0
                      ? `Thu thêm ${formatVND(r.netDifference)}`
                      : r.netDifference < 0
                        ? `Hoàn ${formatVND(Math.abs(r.netDifference))}`
                        : "0 ₫"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

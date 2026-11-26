import { ArrowLeftRight } from "lucide-react";
import type { Order } from "@/shared/types";
import { formatVND, formatDateTime, formatPhone } from "@/shared/utils/format";

type Props = { selectedOrder: Order };

export default function OrderInfoHeader({ selectedOrder }: Props) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase text-slate-500">
          Đơn hàng gốc đang chọn
        </div>
        <div className="text-base sm:text-lg font-mono font-extrabold text-slate-900 break-words">
          {selectedOrder.orderCode || selectedOrder.code} — {selectedOrder.customerName}
          {selectedOrder.customerPhone ? ` (${formatPhone(selectedOrder.customerPhone)})` : ""}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Ngày mua: {formatDateTime(selectedOrder.createdAt)} · Tiền hàng:{" "}
            <strong className="font-mono">{formatVND(selectedOrder.subtotal)}</strong>
          </span>
          {Number(selectedOrder.billDiscountAmount) > 0 && (
            <span className="text-amber-700 font-semibold">
              · Giảm giá Bill:{" "}
              <strong className="font-mono">
                -{formatVND(Number(selectedOrder.billDiscountAmount))}
              </strong>
            </span>
          )}
          <span>
            · Giá Bill thực thu:{" "}
            <strong className="font-mono text-brand-ink">
              {formatVND(Number(selectedOrder.totalAmount) || Math.max(0, Number(selectedOrder.subtotal || 0) - Number(selectedOrder.billDiscountAmount || 0)))}
            </strong>
          </span>
          <span>
            · Phí thẻ:{" "}
            <strong className="font-mono">{formatVND(selectedOrder.cardFee)}</strong>{" "}
            {Number(selectedOrder.cardFee) > 0 ? (
              <span className="text-brand-ink font-semibold">
                (Có hoàn lại phí thẻ cho khách khi trả/đổi)
              </span>
            ) : (
              <span>(Không thu phí thẻ)</span>
            )}
          </span>
          {Number(selectedOrder.debtAmount) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold">
              Đang còn công nợ: {formatVND(Number(selectedOrder.debtAmount))} (Sẽ ưu tiên cấn trừ vào nợ khi hoàn trả)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:shrink-0">
        <span className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow">
          <ArrowLeftRight className="w-4 h-4" /> ĐỔI SANG SẢN PHẨM MỚI
        </span>
      </div>
    </div>
  );
}

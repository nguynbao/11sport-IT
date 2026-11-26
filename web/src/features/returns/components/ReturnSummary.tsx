import type { Order } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import type { ReturnCtx } from "./returnCtx";

type Props = Pick<ReturnCtx, "refundMethod" | "setRefundMethod" | "note" | "setNote" | "returnSubtotal" | "refundedCardFee" | "returnTotal" | "mode" | "exchangeDiscountTotal" | "exchangeRawSubtotal" | "exchangeTotal" | "netDifference" | "debtBefore" | "debtReduction" | "refundAmount" | "debtAfter" | "cashRefund" | "submitting"> & { selectedOrder: Order };

export default function ReturnSummary({ refundMethod, setRefundMethod, note, setNote, returnSubtotal, refundedCardFee, returnTotal, mode, exchangeDiscountTotal, exchangeRawSubtotal, exchangeTotal, netDifference, debtBefore, debtReduction, refundAmount, debtAfter, cashRefund, submitting, selectedOrder }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
            Hình thức thanh toán hoàn / thu thêm
          </label>
          <select
            value={refundMethod}
            onChange={(e) =>
              setRefundMethod(e.target.value as "CASH" | "BANKING" | "CARD")
            }
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-semibold"
          >
            <option value="CASH">Tiền mặt (CASH)</option>
            <option value="BANKING">Chuyển khoản (BANKING)</option>
            <option value="CARD">Thẻ (CARD)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
            Ghi chú lý do Trả / Đổi
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="VD: Đổi size rộng hơn / Hàng lỗi đường may..."
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
      </div>

      <div className="bg-blue-50/70 border border-blue-200 text-slate-800 p-4 sm:p-5 rounded-xl space-y-2">
        <div className="flex justify-between gap-2 text-xs text-slate-600">
          <span>
            Tiền hàng trả lại
            {Number(selectedOrder.billDiscountAmount) > 0
              ? " (đã phân bổ giảm giá Bill)"
              : ""}
            :
          </span>
          <span className="font-mono font-bold text-amber-700">
            {formatVND(returnSubtotal)}
          </span>
        </div>
        {Number(selectedOrder.cardFee) > 0 && (
          <div className="flex justify-between gap-2 text-xs text-brand-ink">
            <span>
              Hoàn lại phí quẹt thẻ
              {selectedOrder.cardFeePercent ? ` (${selectedOrder.cardFeePercent}%)` : ""}:
            </span>
            <span className="font-mono font-bold">
              +{formatVND(refundedCardFee)}
            </span>
          </div>
        )}
        {refundedCardFee > 0 && (
          <div className="flex justify-between gap-2 text-xs text-slate-700">
            <span>Tổng giá trị hoàn từ đơn cũ:</span>
            <span className="font-mono font-bold text-amber-700">
              {formatVND(returnTotal)}
            </span>
          </div>
        )}
        {mode === "EXCHANGE" && (
          <>
            {exchangeDiscountTotal > 0 && (
              <div className="flex justify-between gap-2 text-xs text-rose-600 font-semibold">
                <span>
                  Giảm giá hàng đổi mới (Giá niêm yết: {formatVND(exchangeRawSubtotal)}):
                </span>
                <span className="font-mono font-bold">
                  −{formatVND(exchangeDiscountTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 text-xs text-slate-700">
              <span>Tổng giá trị hàng đổi mới (sau giảm):</span>
              <span className="font-mono font-bold text-brand-ink">
                {formatVND(exchangeTotal)}
              </span>
            </div>
          </>
        )}
        <div className="pt-2 border-t border-blue-200 flex flex-wrap justify-between items-center gap-x-2 gap-y-1">
          <span className="text-sm font-extrabold uppercase text-slate-900">
            {netDifference > 0
              ? "Khách cần trả thêm:"
              : netDifference < 0
                ? "Tổng tiền hoàn trả (refundAmount):"
                : "Chênh lệch thanh toán:"}
          </span>
          <span
            className={`font-mono text-xl font-extrabold ${netDifference > 0 ? "text-brand-ink" : "text-amber-700"
              }`}
          >
            {formatVND(Math.abs(netDifference))}
          </span>
        </div>

        {/* Hiển thị chi tiết cấn trừ công nợ & tiền thực hoàn cho khách khi đơn gốc có nợ */}
        {(debtBefore > 0 || debtReduction > 0) && netDifference < 0 && (
          <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
            <div className="font-bold text-amber-800 uppercase text-[11px]">
              Phân bổ hoàn trả cho đơn đang có công nợ ({formatVND(debtBefore)}):
            </div>
            <div className="flex justify-between gap-2 text-slate-700">
              <span>1. Tổng tiền hoàn trả (refundAmount):</span>
              <span className="font-mono font-bold text-amber-700">
                {formatVND(refundAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-purple-700">
              <span>
                2. Cấn trừ vào công nợ đơn gốc (Nợ còn lại: {formatVND(debtAfter)}):
              </span>
              <span className="font-mono font-extrabold">
                -{formatVND(debtReduction)}
              </span>
            </div>
            <div className="pt-1 border-t border-amber-200 flex justify-between gap-2 text-brand-ink text-sm">
              <span className="font-extrabold">
                3. Thực hoàn tiền mặt/CK cho khách (cashRefund):
              </span>
              <span className="font-mono font-extrabold text-brand-ink">
                {formatVND(cashRefund)}
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] mt-3 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg"
        >
          {submitting
            ? "Đang xử lý..."
            : mode === "EXCHANGE"
              ? "XÁC NHẬN PHIẾU ĐỔI HÀNG"
              : debtReduction > 0 && cashRefund === 0
                ? "XÁC NHẬN TRẢ HÀNG & CẤN TRỪ CÔNG NỢ"
                : "XÁC NHẬN PHIẾU TRẢ HÀNG & HOÀN TIỀN"}
        </button>
      </div>
    </div>
  );
}

import { type PaymentMethodType } from "../types";
import type { PosCtx } from "../hooks/usePosTab";
import { SplitPaymentPanel } from "./SplitPaymentPanel";

type CheckoutPaymentSectionProps = Pick<
  PosCtx,
  "paymentMethod" | "setPaymentMethod" | "cardFeePercent" | "setHasCardFee"
  | "setCardFeePercent" | "splitPayments" | "setSplitPayments" | "setShowSplitDropdown"
  | "showSplitDropdown" | "totalAmount" | "setDebtDueDate" | "debtDueDate"
> & {
};

export function CheckoutPaymentSection({
  paymentMethod,
  setPaymentMethod,
  cardFeePercent,
  setHasCardFee,
  setCardFeePercent,
  splitPayments,
  setSplitPayments,
  setShowSplitDropdown,
  showSplitDropdown,
  totalAmount,
  setDebtDueDate,
  debtDueDate,
}: CheckoutPaymentSectionProps) {
  return (
    <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            {[
              { id: "CASH", label: "Tiền mặt" },
              { id: "BANKING", label: "Chuyển khoản" },
              { id: "CARD", label: "Thẻ" },
              { id: "OTHER", label: "Khác / Nợ" },
            ].map((pm) => {
              const active = paymentMethod === pm.id;
              return (
                <label
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as PaymentMethodType)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer select-none"
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                      active
                        ? "border-blue-600 bg-blue-600"
                        : "border-slate-400 bg-white"
                    }`}
                  >
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span>{pm.label}</span>
                </label>
              );
            })}
          </div>

          {/* Tùy chọn phí quẹt thẻ (BR-12) */}
          {paymentMethod === "CARD" && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
              <div className="font-bold text-amber-900">Mức phí quẹt thẻ:</div>
              <div className="grid grid-cols-2 gap-1.5">
                <label
                  className={`flex items-center gap-1.5 p-1.5 rounded border cursor-pointer text-[11px] font-semibold ${
                    cardFeePercent !== 4
                      ? "border-amber-600 bg-white text-amber-900"
                      : "border-amber-200 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cardFeePercent !== 4}
                    onChange={() => {
                      setHasCardFee(true);
                      setCardFeePercent(1.8);
                    }}
                  />
                  Khách Việt 1.8%
                </label>
                <label
                  className={`flex items-center gap-1.5 p-1.5 rounded border cursor-pointer text-[11px] font-semibold ${
                    cardFeePercent === 4
                      ? "border-amber-600 bg-white text-amber-900"
                      : "border-amber-200 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cardFeePercent === 4}
                    onChange={() => {
                      setHasCardFee(true);
                      setCardFeePercent(4);
                    }}
                  />
                  Nước ngoài 4%
                </label>
              </div>
            </div>
          )}

          {/* Tách thanh toán nhiều phương thức / Ghi công nợ */}
          <SplitPaymentPanel
            paymentMethod={paymentMethod}
            splitPayments={splitPayments}
            setSplitPayments={setSplitPayments}
            setShowSplitDropdown={setShowSplitDropdown}
            showSplitDropdown={showSplitDropdown}
            totalAmount={totalAmount}
            setDebtDueDate={setDebtDueDate}
            debtDueDate={debtDueDate}
          />
        </div>
  );
}

import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import type { PosCtx } from "../hooks/usePosTab";

type CheckoutTotalsSectionProps = Pick<
  PosCtx,
  "rawSubtotal" | "itemDiscountTotal" | "setBillDiscountType"
  | "setBillDiscountInputMode" | "setBillCustomPriceText" | "setIsManualBillDiscount"
  | "billDiscountInputMode" | "billDiscountType" | "setBillDiscountValue" | "subtotal"
  | "billPriceInputRef" | "billDiscountValue" | "billCustomPriceText"
  | "billDiscountAmount" | "paymentMethod" | "cardFeePercent" | "cardFee"
  | "totalAmount"
> & {
  totalCartUnits: number;
};

export function CheckoutTotalsSection({
  totalCartUnits,
  rawSubtotal,
  itemDiscountTotal,
  setBillDiscountType,
  setBillDiscountInputMode,
  setBillCustomPriceText,
  setIsManualBillDiscount,
  billDiscountInputMode,
  billDiscountType,
  setBillDiscountValue,
  subtotal,
  billPriceInputRef,
  billDiscountValue,
  billCustomPriceText,
  billDiscountAmount,
  paymentMethod,
  cardFeePercent,
  cardFee,
  totalAmount,
}: CheckoutTotalsSectionProps) {
  return (
    <div className="pt-3 border-t border-slate-100 space-y-3 text-xs sm:text-sm">
          {/* Tổng tiền hàng + Badge tổng số lượng */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-medium">Tổng tiền hàng</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold">
                {totalCartUnits}
              </span>
            </div>
            <span className="font-mono font-black text-base text-slate-900">
              {formatNumberDots(rawSubtotal)}
            </span>
          </div>

          {/* Giảm giá trên từng sản phẩm (nếu có) */}
          {itemDiscountTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-rose-600">
              <span>Giảm giá sản phẩm</span>
              <span className="font-mono font-bold">
                −{formatNumberDots(itemDiscountTotal)}
              </span>
            </div>
          )}

          {/* Dòng Giảm giá Bill */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-medium">Giảm giá</span>
                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[11px] font-extrabold">
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("AMOUNT");
                      setBillDiscountInputMode("AMOUNT");
                      setBillCustomPriceText("");
                      setIsManualBillDiscount(true);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode !== "PERCENT" &&
                      billDiscountInputMode !== "PRICE" &&
                      billDiscountType !== "PERCENT"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    VND
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("PERCENT");
                      setBillDiscountValue(0);
                      setBillDiscountInputMode("PERCENT");
                      setBillCustomPriceText("");
                      setIsManualBillDiscount(true);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode === "PERCENT" ||
                      (billDiscountType === "PERCENT" &&
                        billDiscountInputMode !== "PRICE")
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("AMOUNT");
                      setBillDiscountValue(0);
                      setBillDiscountInputMode("PRICE");
                      setBillCustomPriceText(
                        subtotal > 0 ? formatNumberDots(subtotal) : ""
                      );
                      setTimeout(() => {
                        billPriceInputRef.current?.focus();
                        billPriceInputRef.current?.select();
                      }, 0);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode === "PRICE"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                    title="Nhập tổng tiền muốn thu của khách"
                  >
                    Giá bán
                  </button>
                </div>
              </div>

              {billDiscountInputMode === "PERCENT" ||
              (billDiscountType === "PERCENT" &&
                billDiscountInputMode !== "PRICE") ? (
                <div className="relative w-36">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={billDiscountValue || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      setIsManualBillDiscount(true);
                      setBillDiscountType("PERCENT");
                      setBillDiscountInputMode("PERCENT");
                      setBillDiscountValue(
                        Math.min(100, Math.max(0, Number(e.target.value)))
                      );
                    }}
                    placeholder="0"
                    className="w-full pr-7 pl-2.5 py-1 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm bg-white focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-500 pointer-events-none">
                    %
                  </span>
                </div>
              ) : billDiscountInputMode === "PRICE" ? (
                <div className="relative w-36">
                  <input
                    ref={billPriceInputRef}
                    type="text"
                    inputMode="numeric"
                    value={billCustomPriceText}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      if (!digits) {
                        setBillDiscountType("NONE");
                        setBillDiscountInputMode("PRICE");
                        setBillCustomPriceText("");
                        setBillDiscountValue(0);
                        setIsManualBillDiscount(false);
                        return;
                      }
                      const enteredPrice = Math.min(
                        subtotal,
                        Math.max(0, Number(digits) || 0)
                      );
                      const computedDiscount = Math.max(
                        0,
                        subtotal - enteredPrice
                      );
                      setIsManualBillDiscount(true);
                      setBillDiscountType(
                        computedDiscount > 0 ? "AMOUNT" : "NONE"
                      );
                      setBillDiscountInputMode("PRICE");
                      setBillCustomPriceText(formatNumberDots(enteredPrice));
                      setBillDiscountValue(computedDiscount);
                    }}
                    placeholder="Nhập giá thu"
                    className="w-full px-2.5 py-1 rounded-lg border border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-brand-ink text-xs sm:text-sm bg-blue-50/40 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="relative w-36">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      billDiscountAmount > 0
                        ? formatNumberDots(billDiscountAmount)
                        : ""
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const val = parseNumberDots(e.target.value);
                      setIsManualBillDiscount(val > 0);
                      setBillDiscountType(val > 0 ? "AMOUNT" : "NONE");
                      setBillDiscountInputMode(val > 0 ? "AMOUNT" : "NONE");
                      setBillCustomPriceText("");
                      setBillDiscountValue(val);
                    }}
                    placeholder="0"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {billDiscountAmount > 0 && (
              <div className="flex items-center justify-end text-[11px] font-mono font-bold text-rose-600">
                Đã giảm: −{formatNumberDots(billDiscountAmount)} đ
              </div>
            )}
          </div>

          {/* Phí quẹt thẻ (nếu chọn Quẹt Thẻ) */}
          {paymentMethod === "CARD" && (
            <div className="flex items-center justify-between text-xs text-amber-700">
              <span>Phí quẹt thẻ ({cardFeePercent}%)</span>
              <span className="font-mono font-bold">
                +{formatNumberDots(cardFee)}
              </span>
            </div>
          )}

          {/* KHÁCH CẦN TRẢ (Số liệu đen bự dễ đọc) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="font-extrabold text-sm text-slate-900">Khách cần trả</span>
            <span className="font-mono font-black text-2xl text-slate-900">
              {formatNumberDots(totalAmount)}
            </span>
          </div>
        </div>
  );
}

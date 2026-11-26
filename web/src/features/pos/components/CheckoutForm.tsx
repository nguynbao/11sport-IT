import { CheckCircle2, AlertCircle, X, Save, User } from "lucide-react";
import type { Order } from "@/shared/types";
import type { PosCtx } from "../hooks/usePosTab";
import { CheckoutCustomerSection } from "./CheckoutCustomerSection";
import { CheckoutTotalsSection } from "./CheckoutTotalsSection";
import { CheckoutPaymentSection } from "./CheckoutPaymentSection";

type CheckoutFormProps = Pick<
  PosCtx,
  "handleCreateOrder" | "nowClock" | "setShowCheckoutDrawer" | "customerName"
  | "customerPhone" | "errorMsg" | "successMsg" | "editingServerDraftOrder"
  | "removeDraft" | "activeDraftId" | "phoneTypedByUserRef" | "setCustomerPhone"
  | "setIsExistingCustomer" | "setCustomerOrders" | "setCustomerDebtSummary"
  | "setCustomerName" | "lookingUp" | "isExistingCustomer" | "customerOrders"
  | "customerDebtSummary" | "rawSubtotal" | "itemDiscountTotal" | "setBillDiscountType"
  | "setBillDiscountInputMode" | "setBillCustomPriceText" | "setIsManualBillDiscount"
  | "billDiscountInputMode" | "billDiscountType" | "setBillDiscountValue" | "subtotal"
  | "billPriceInputRef" | "billDiscountValue" | "billCustomPriceText"
  | "billDiscountAmount" | "paymentMethod" | "cardFeePercent" | "cardFee"
  | "totalAmount" | "setPaymentMethod" | "setHasCardFee" | "setCardFeePercent"
  | "splitPayments" | "setSplitPayments" | "setShowSplitDropdown" | "showSplitDropdown"
  | "setDebtDueDate" | "debtDueDate" | "submitting" | "cart" | "giftCart"
  | "savingDraft" | "handleSaveOrderAsDraft"
> & {
  inDrawer: boolean;
  staffName: string;
  onOpenInvoice: (order: Order) => void;
  totalCartUnits: number;
};

export function CheckoutForm({
  inDrawer,
  handleCreateOrder,
  staffName,
  nowClock,
  setShowCheckoutDrawer,
  customerName,
  customerPhone,
  errorMsg,
  successMsg,
  editingServerDraftOrder,
  removeDraft,
  activeDraftId,
  phoneTypedByUserRef,
  setCustomerPhone,
  setIsExistingCustomer,
  setCustomerOrders,
  setCustomerDebtSummary,
  setCustomerName,
  lookingUp,
  isExistingCustomer,
  customerOrders,
  customerDebtSummary,
  onOpenInvoice,
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
  setPaymentMethod,
  setHasCardFee,
  setCardFeePercent,
  splitPayments,
  setSplitPayments,
  setShowSplitDropdown,
  showSplitDropdown,
  setDebtDueDate,
  debtDueDate,
  submitting,
  cart,
  giftCart,
  savingDraft,
  handleSaveOrderAsDraft,
}: CheckoutFormProps) {
  return (
    <form
      onSubmit={handleCreateOrder}
      className={`flex-1 min-h-0 bg-white flex flex-col justify-between gap-2 ${
        inDrawer
          ? "h-full p-4 sm:p-5 overflow-hidden"
          : "rounded-xl shadow-xs border border-slate-200 p-3.5 sm:p-4 overflow-hidden"
      }`}
    >
      {/* Khối thông tin phía trên của Panel thanh toán (cho phép cuộn nội bộ nếu màn hình nhỏ) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3">
        {/* Dòng 1: Tên nhân viên bán hàng & Ngày giờ hiện tại (+ Nút đóng X nếu là Drawer Bán thường) */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-700 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <User className="w-3.5 h-3.5 text-brand-ink" />
            <span>{staffName}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>{nowClock}</span>
            {inDrawer && (
              <button
                type="button"
                onClick={() => setShowCheckoutDrawer(false)}
                className="ml-1 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
                title="Đóng bảng thanh toán"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Nếu mở trong Drawer (Bán thường): Hiển thị tên khách hàng nổi bật giống ảnh 2 */}
        {inDrawer && (
          <div className="text-sm font-extrabold text-slate-900">
            {customerName.trim()
              ? `${customerName.trim()} ${customerPhone ? `(${customerPhone})` : ""}`
              : "Khách lẻ"}
          </div>
        )}

        {/* Thông báo lỗi / thành công / đang sửa nháp */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-brand-ink text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {editingServerDraftOrder && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-extrabold">
                Đang sửa nháp:{" "}
                {editingServerDraftOrder.orderCode ||
                  editingServerDraftOrder.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeDraft(activeDraftId)}
              className="px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[11px] shrink-0"
            >
              Thoát
            </button>
          </div>
        )}

        {/* Ô Tìm khách hàng (SĐT + Tên khách hàng) */}
        <CheckoutCustomerSection
          customerPhone={customerPhone}
          phoneTypedByUserRef={phoneTypedByUserRef}
          setCustomerPhone={setCustomerPhone}
          setIsExistingCustomer={setIsExistingCustomer}
          setCustomerOrders={setCustomerOrders}
          setCustomerDebtSummary={setCustomerDebtSummary}
          customerName={customerName}
          setCustomerName={setCustomerName}
          lookingUp={lookingUp}
          isExistingCustomer={isExistingCustomer}
          customerOrders={customerOrders}
          customerDebtSummary={customerDebtSummary}
          onOpenInvoice={onOpenInvoice}
        />

        {/* ==================== BẢNG TÍNH TIỀN KIOTVIET ==================== */}
        <CheckoutTotalsSection
          totalCartUnits={totalCartUnits}
          rawSubtotal={rawSubtotal}
          itemDiscountTotal={itemDiscountTotal}
          setBillDiscountType={setBillDiscountType}
          setBillDiscountInputMode={setBillDiscountInputMode}
          setBillCustomPriceText={setBillCustomPriceText}
          setIsManualBillDiscount={setIsManualBillDiscount}
          billDiscountInputMode={billDiscountInputMode}
          billDiscountType={billDiscountType}
          setBillDiscountValue={setBillDiscountValue}
          subtotal={subtotal}
          billPriceInputRef={billPriceInputRef}
          billDiscountValue={billDiscountValue}
          billCustomPriceText={billCustomPriceText}
          billDiscountAmount={billDiscountAmount}
          paymentMethod={paymentMethod}
          cardFeePercent={cardFeePercent}
          cardFee={cardFee}
          totalAmount={totalAmount}
        />

        {/* ==================== PHƯƠNG THỨC THANH TOÁN (RADIO STYLE GIỐNG ẢNH 2) ==================== */}
        <CheckoutPaymentSection
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cardFeePercent={cardFeePercent}
          setHasCardFee={setHasCardFee}
          setCardFeePercent={setCardFeePercent}
          splitPayments={splitPayments}
          setSplitPayments={setSplitPayments}
          setShowSplitDropdown={setShowSplitDropdown}
          showSplitDropdown={showSplitDropdown}
          totalAmount={totalAmount}
          setDebtDueDate={setDebtDueDate}
          debtDueDate={debtDueDate}
        />
      </div>

      {/* Khối nút bấm dưới đáy Panel phải: THANH TOÁN (Nút xanh lá lớn chủ đạo) & LƯU NHÁP */}
      <div className="space-y-2 pt-2">
        <button
          type="submit"
          disabled={submitting || (cart.length === 0 && giftCart.length === 0)}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-base tracking-wide uppercase flex items-center justify-center gap-2 shadow-md transition"
        >
          {submitting ? "Đang xử lý..." : "THANH TOÁN"}
        </button>

        <button
          type="button"
          disabled={
            submitting ||
            savingDraft ||
            (cart.length === 0 && giftCart.length === 0)
          }
          onClick={handleSaveOrderAsDraft}
          className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 disabled:opacity-50 text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Save className="w-3.5 h-3.5" />
          {savingDraft
            ? "Đang lưu nháp..."
            : editingServerDraftOrder
              ? `Cập nhật nháp ${editingServerDraftOrder.orderCode || editingServerDraftOrder.code}`
              : "Lưu hóa đơn nháp"}
        </button>
      </div>
    </form>
  );
}

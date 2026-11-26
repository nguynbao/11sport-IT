import { formatVND, formatPhone, cleanPhoneDigits } from "@/shared/utils/format";
import { Search, UserCheck, Plus, Printer, AlertCircle, History } from "lucide-react";
import type { Order } from "@/shared/types";
import type { PosCtx } from "../hooks/usePosTab";

type CheckoutCustomerSectionProps = Pick<
  PosCtx,
  "customerPhone" | "phoneTypedByUserRef" | "setCustomerPhone"
  | "setIsExistingCustomer" | "setCustomerOrders" | "setCustomerDebtSummary"
  | "customerName" | "setCustomerName" | "lookingUp" | "isExistingCustomer"
  | "customerOrders" | "customerDebtSummary"
> & {
  onOpenInvoice: (order: Order) => void;
};

export function CheckoutCustomerSection({
  customerPhone,
  phoneTypedByUserRef,
  setCustomerPhone,
  setIsExistingCustomer,
  setCustomerOrders,
  setCustomerDebtSummary,
  customerName,
  setCustomerName,
  lookingUp,
  isExistingCustomer,
  customerOrders,
  customerDebtSummary,
  onOpenInvoice,
}: CheckoutCustomerSectionProps) {
  return (
    <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => {
                phoneTypedByUserRef.current = true;
                const formatted = formatPhone(e.target.value);
                setCustomerPhone(formatted);
                if (cleanPhoneDigits(formatted).length < 9) {
                  setIsExistingCustomer(false);
                  setCustomerOrders([]);
                  setCustomerDebtSummary(null);
                }
              }}
              placeholder="Tìm khách hàng - Nhập SĐT (F4) *"
              className="w-full h-9 pl-8 pr-8 rounded-lg bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 font-mono text-xs sm:text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition"
            />
            <span className="absolute right-2.5 top-2 text-slate-400">
              <Plus className="w-4 h-4" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                lookingUp
                  ? "Đang tra cứu khách hàng..."
                  : "Họ tên khách hàng *"
              }
              className="w-full h-9 px-3 rounded-lg bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition"
            />
            {isExistingCustomer && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-brand-ink px-2 py-1 rounded-full">
                <UserCheck className="w-3 h-3" /> Khách quen (
                {customerOrders.length})
              </span>
            )}
          </div>

          {/* Cảnh báo công nợ của khách (nếu có) */}
          {(() => {
            const unpaidOrders = customerOrders.filter(
              (o) => o.status !== "DRAFT" && (Number(o.debtAmount) || 0) > 0
            );
            const totalDebt =
              customerDebtSummary && customerDebtSummary.totalDebtAmount > 0
                ? customerDebtSummary.totalDebtAmount
                : unpaidOrders.reduce(
                    (sum, o) => sum + (Number(o.debtAmount) || 0),
                    0
                  );
            const unpaidCount =
              customerDebtSummary && customerDebtSummary.unpaidOrdersCount > 0
                ? customerDebtSummary.unpaidOrdersCount
                : unpaidOrders.length;
            if (unpaidCount === 0 || totalDebt <= 0) return null;
            const nowMs = Date.now();
            const overdueCount =
              customerDebtSummary && customerDebtSummary.overdueOrdersCount > 0
                ? customerDebtSummary.overdueOrdersCount
                : unpaidOrders.filter(
                    (o) =>
                      o.debtDueDate &&
                      new Date(o.debtDueDate).getTime() < nowMs
                  ).length;

            return (
              <div
                className={`p-2.5 rounded-lg border space-y-1 text-xs ${
                  overdueCount > 0
                    ? "bg-red-50 border-red-300 text-red-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-extrabold">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Nợ {unpaidCount} đơn:
                  </span>
                  <span className="font-mono text-red-600">
                    {formatVND(totalDebt)}
                  </span>
                </div>
                {unpaidOrders.slice(0, 2).map((ord) => (
                  <div
                    key={ord._id}
                    className="flex items-center justify-between text-[11px] bg-white/80 px-2 py-0.5 rounded"
                  >
                    <span className="font-mono font-semibold">
                      {ord.orderCode || ord.code}
                    </span>
                    <span className="font-mono text-red-600">
                      {formatVND(Number(ord.debtAmount) || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(ord)}
                      className="text-brand-ink hover:underline font-bold"
                    >
                      Xem
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Lịch sử đơn gần đây của khách */}
          {customerOrders.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <History className="w-3 h-3 text-brand-ink" />
                Đơn mua gần đây ({customerOrders.length}):
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {customerOrders.slice(0, 3).map((ord) => (
                  <div
                    key={ord._id}
                    className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200/80"
                  >
                    <span className="font-mono font-semibold text-slate-800">
                      {ord.orderCode || ord.code}
                    </span>
                    <span className="font-mono font-bold text-brand-ink">
                      {formatVND(ord.totalAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(ord)}
                      className="text-brand-ink hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Printer className="w-3 h-3" /> Bill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  );
}

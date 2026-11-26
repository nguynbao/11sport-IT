"use client";

import { formatNumberDots,formatPhone,formatVND,parseNumberDots } from "@/shared/utils/format";
import {
X
} from "lucide-react";

import { DebtManagementViewModel } from "../hooks/useDebtManagement";

export function DebtPaymentModal({ vm }: { vm: DebtManagementViewModel }) {
  const {
    debtPayModalOrder,
    setDebtPayModalOrder,
    debtPayAmount,
    setDebtPayAmount,
    debtPayMethod,
    setDebtPayMethod,
    debtPayNote,
    setDebtPayNote,
    debtPaySaving,
    debtPayError,
    handleConfirmDebtPayment,
    s,
  } = vm;

  return (
    <>
      {/* MODAL THU NỢ / TẤT TOÁN CÔNG NỢ (DÀNH CHO ADMIN) */}
      {debtPayModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-amber-600">
                  Xác nhận thu hồi công nợ (Admin)
                </span>
                <h4 className="text-base font-black text-slate-900 mt-0.5">
                  Đơn hàng {debtPayModalOrder.orderCode}
                </h4>
                <p className="text-xs text-slate-500">
                  Khách hàng: <strong>{debtPayModalOrder.customerName}</strong> ·{" "}
                  <span className="font-mono">{formatPhone(debtPayModalOrder.customerPhone)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDebtPayModalOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Tổng giá trị đơn hàng:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatVND(debtPayModalOrder.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Đã thanh toán trước đó:</span>
                <span className="font-mono font-bold text-brand-ink">
                  {formatVND(debtPayModalOrder.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-amber-200/80 text-sm">
                <span className="font-extrabold text-amber-900">Dư nợ còn phải thu:</span>
                <span className="font-mono font-black text-amber-700">
                  {formatVND(debtPayModalOrder.debtAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Số tiền khách trả đợt này (VND) *
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDebtPayAmount(String(Math.round(debtPayModalOrder.debtAmount / 2)))
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
                    >
                      Thu 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtPayAmount(String(debtPayModalOrder.debtAmount))}
                      className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-[10px] font-extrabold text-amber-800"
                    >
                      Tất toán 100%
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(Number(debtPayAmount) || 0)}
                  onChange={(e) => setDebtPayAmount(String(parseNumberDots(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900"
                  placeholder="Nhập số tiền thu..."
                />
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Còn nợ sau đợt thu này:</span>
                  <span className="font-mono font-extrabold text-amber-700">
                    {formatVND(
                      Math.max(0, debtPayModalOrder.debtAmount - (Number(debtPayAmount) || 0))
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hình thức khách thanh toán nợ *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "BANKING", label: "Chuyển khoản" },
                      { id: "CASH", label: "Tiền mặt" },
                      { id: "CARD", label: "Quẹt thẻ" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDebtPayMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        debtPayMethod === m.id
                          ? "bg-teal-600 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú đợt thu nợ (tùy chọn)
                </label>
                <input
                  type="text"
                  value={debtPayNote}
                  onChange={(e) => setDebtPayNote(e.target.value)}
                  placeholder="VD: Khách CK Vietcombank tất toán công nợ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>

            {debtPayError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs font-bold text-red-700">
                {debtPayError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDebtPayModalOrder(null)}
                disabled={debtPaySaving}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDebtPayment}
                disabled={debtPaySaving}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold shadow-sm disabled:opacity-50"
              >
                {debtPaySaving ? "Đang lưu..." : "Xác nhận Thu Nợ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

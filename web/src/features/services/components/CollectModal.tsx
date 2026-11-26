"use client";

import React from "react";
import type { ServicePaymentMethod } from "@/shared/types";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatNumberDots, parseNumberDots, formatPhone } from "@/shared/utils/format";
import { X } from "lucide-react";

export default function CollectModal({ s }: { s: PosServiceState }) {
  const {
    collectAmountInput,
    collectCardFeePercent,
    collectMethod,
    collectModalOrder,
    collectNote,
    customerName,
    customerPhone,
    handleConfirmCollectAndReturn,
    setCollectAmountInput,
    setCollectCardFeePercent,
    setCollectMethod,
    setCollectModalOrder,
    setCollectNote,
    submittingCollect,
    totalAmount,
  } = s;

  return (
    <>
      {collectModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Xác Nhận Lấy Tiền &amp; Trả Đồ ({collectModalOrder.orderCode})
              </h3>
              <button
                type="button"
                onClick={() => setCollectModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCollectAndReturn} className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  Khách hàng: <strong>{collectModalOrder.customerName}</strong> (
                  {formatPhone(collectModalOrder.customerPhone)})
                </div>
                <div>
                  Tổng tiền:{" "}
                  <strong className="font-mono">
                    {formatVND(collectModalOrder.totalAmount)}
                  </strong>{" "}
                  • Đã thu:{" "}
                  <strong className="font-mono text-brand-ink">
                    {formatVND(collectModalOrder.paidAmount)}
                  </strong>
                </div>
                <div className="text-sm font-extrabold text-rose-600 pt-1">
                  Còn phải thu: {formatVND(collectModalOrder.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thu khi khách nhận đồ (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(collectAmountInput)}
                  onChange={(e) =>
                    setCollectAmountInput(
                      Math.min(
                        collectModalOrder.remainingAmount,
                        parseNumberDots(e.target.value)
                      )
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-extrabold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Tiền mặt" },
                    { id: "BANKING", label: "Chuyển khoản" },
                    { id: "CARD", label: "Quẹt thẻ" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setCollectMethod(pm.id as ServicePaymentMethod)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border ${collectMethod === pm.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-300"
                        }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {collectMethod === "CARD" && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-900">
                    Phí quẹt thẻ (tính trên {formatVND(collectAmountInput)}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${collectCardFeePercent === 4
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="posReadyCollectCardFeeType"
                        checked={collectCardFeePercent === 4}
                        onChange={() => setCollectCardFeePercent(4)}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách nước ngoài 4% (+
                        {formatVND(Math.round(collectAmountInput * 0.04))})
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${collectCardFeePercent !== 4
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="posReadyCollectCardFeeType"
                        checked={collectCardFeePercent !== 4}
                        onChange={() => setCollectCardFeePercent(1.8)}
                        className="accent-amber-600"
                      />
                      <span>
                        Khách Việt 1.8% (+
                        {formatVND(Math.round(collectAmountInput * 0.018))})
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-between text-amber-800 pt-0.5">
                    <span>
                      Phí thẻ (+{collectCardFeePercent}%): +
                      {formatVND(
                        Math.round((collectAmountInput * collectCardFeePercent) / 100)
                      )}
                    </span>
                    <strong className="font-mono">
                      Tổng quẹt:{" "}
                      {formatVND(
                        collectAmountInput +
                        Math.round((collectAmountInput * collectCardFeePercent) / 100)
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú thu tiền
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectModalOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submittingCollect}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
                >
                  {submittingCollect ? "Đang xử lý..." : "Xác nhận Thu tiền & Trả đồ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

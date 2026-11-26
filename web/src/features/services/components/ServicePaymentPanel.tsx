"use client";

import React from "react";
import type { ServicePaymentMethod } from "@/shared/types";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { Banknote, Landmark, CreditCard } from "lucide-react";
import {
  type PaymentTimingMode,
} from "../types";

export default function ServicePaymentPanel({ s }: { s: PosServiceState }) {
  const {
    afterBillDiscount,
    cardFeePercent,
    computedPaidAmount,
    computedRemainingAmount,
    depositAmount,
    handleSelectPaymentMethod,
    note,
    paymentMethod,
    paymentTiming,
    setCardFeePercent,
    setDepositAmount,
    setNote,
    setPaymentTiming,
    totalAmount,
  } = s;

  return (
    <>
          {/* 3. THỜI ĐIỂM & HÌNH THỨC THANH TOÁN */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "LATER", label: "Trả khi nhận" },
                { id: "FULL", label: "Trả đủ ngay" },
                { id: "DEPOSIT", label: "Đặt cọc" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentTiming(opt.id as PaymentTimingMode)}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition text-center ${paymentTiming === opt.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {paymentTiming === "DEPOSIT" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Số tiền khách đặt cọc trước (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(depositAmount)}
                  onChange={(e) =>
                    setDepositAmount(
                      Math.min(totalAmount, parseNumberDots(e.target.value))
                    )
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "CASH", label: "Tiền mặt", icon: Banknote },
                { id: "BANKING", label: "Chuyển khoản", icon: Landmark },
                { id: "CARD", label: "Quẹt thẻ", icon: CreditCard },
              ].map((pm) => {
                const Icon = pm.icon;
                const active = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() =>
                      handleSelectPaymentMethod(pm.id as ServicePaymentMethod)
                    }
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition ${active
                      ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === "CARD" && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-900">
                  Phí quẹt thẻ (trên {formatVND(afterBillDiscount)}):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[11px] font-semibold transition ${cardFeePercent === 4
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="servicePosCardFeeType"
                      checked={cardFeePercent === 4}
                      onChange={() => setCardFeePercent(4)}
                      className="accent-amber-600"
                    />
                    <span>Nước ngoài 4%</span>
                  </label>
                  <label
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[11px] font-semibold transition ${cardFeePercent !== 4
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                      }`}
                  >
                    <input
                      type="radio"
                      name="servicePosCardFeeType"
                      checked={cardFeePercent !== 4}
                      onChange={() => setCardFeePercent(1.8)}
                      className="accent-amber-600"
                    />
                    <span>Khách Việt 1.8%</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600">
                Thu ngay:{" "}
                <strong className="font-mono text-brand-ink">
                  {formatVND(computedPaidAmount)}
                </strong>
              </span>
              <span className="text-slate-600">
                Còn thu:{" "}
                <strong className="font-mono text-rose-600">
                  {formatVND(computedRemainingAmount)}
                </strong>
              </span>
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú chung của phiếu dịch vụ..."
              className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-lg outline-none transition"
            />
          </div>
    </>
  );
}

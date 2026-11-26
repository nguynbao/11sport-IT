"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { Tag } from "lucide-react";

export default function ServiceTotals({ s }: { s: PosServiceState }) {
  const {
    billDiscountAmount,
    billDiscountInput,
    billDiscountMode,
    cardFee,
    cardFeePercent,
    itemDiscountTotal,
    rawSubtotal,
    serviceCart,
    setBillDiscountInput,
    setBillDiscountMode,
    totalAmount,
  } = s;

  return (
    <>
          {/* 2. TỔNG TIỀN, GIẢM GIÁ & KHÁCH CẦN TRẢ */}
          <div className="pt-2.5 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span>Tổng tiền dịch vụ ({serviceCart.length} dòng)</span>
              <span className="font-mono font-bold text-slate-900">
                {formatVND(rawSubtotal)}
              </span>
            </div>

            {itemDiscountTotal > 0 && (
              <div className="flex items-center justify-between text-amber-700">
                <span>Giảm giá từng dòng</span>
                <span className="font-mono font-bold">-{formatVND(itemDiscountTotal)}</span>
              </div>
            )}

            {/* Giảm giá tổng phiếu */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-600 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Giảm tổng phiếu
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                  {(
                    [
                      { id: "NONE", label: "0" },
                      { id: "PERCENT", label: "%" },
                      { id: "AMOUNT", label: "VND" },
                      { id: "PRICE", label: "Giá chốt" },
                    ] as const
                  ).map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      onClick={() => {
                        setBillDiscountMode(bm.id);
                        setBillDiscountInput("");
                      }}
                      className={`px-2 py-0.5 rounded-md transition ${billDiscountMode === bm.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-brand-ink"
                        }`}
                    >
                      {bm.label}
                    </button>
                  ))}
                </div>
              </div>

              {billDiscountMode !== "NONE" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      billDiscountMode === "PERCENT"
                        ? billDiscountInput
                        : billDiscountInput
                          ? formatNumberDots(parseNumberDots(billDiscountInput))
                          : ""
                    }
                    onChange={(e) => {
                      if (billDiscountMode === "PERCENT") {
                        setBillDiscountInput(e.target.value.replace(/[^0-9.]/g, ""));
                      } else {
                        const num = parseNumberDots(e.target.value);
                        setBillDiscountInput(num > 0 ? String(num) : "");
                      }
                    }}
                    placeholder={
                      billDiscountMode === "PERCENT"
                        ? "Nhập % giảm (VD: 10)..."
                        : billDiscountMode === "AMOUNT"
                          ? "Số tiền giảm thêm..."
                          : "Tổng tiền chốt sau giảm..."
                    }
                    className="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-amber-50/40 border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                  {billDiscountAmount > 0 && (
                    <span className="font-mono font-bold text-amber-700 shrink-0">
                      -{formatVND(billDiscountAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {cardFee > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span>
                  Phí quẹt thẻ ({cardFeePercent === 4 ? "4%" : "1.8%"})
                </span>
                <span className="font-mono font-bold">+{formatVND(cardFee)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="font-extrabold text-slate-900 text-sm">Khách cần trả</span>
              <span className="font-mono font-extrabold text-lg sm:text-xl text-brand-ink">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>
    </>
  );
}

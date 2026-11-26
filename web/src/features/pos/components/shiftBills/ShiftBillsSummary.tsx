import React from "react";
import type { CurrentShiftOrdersMeta } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { FileText, Banknote, Landmark, CreditCard, ShoppingBag } from "lucide-react";

interface Props {
  summary: CurrentShiftOrdersMeta["summary"];
  dateFilter: string;
}

export default function ShiftBillsSummary({ summary, dateFilter }: Props) {
  return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Số Bill đã thanh toán</span>
            <ShoppingBag className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-mono font-black text-slate-900">
              {summary.paidOrdersCount}
            </span>
            <span className="text-xs text-slate-500 font-semibold">bill</span>
            {summary.draftOrdersCount > 0 && (
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                +{summary.draftOrdersCount} nháp
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-brand-ink font-semibold">
            <span>{dateFilter === "ALL" ? "Tổng tiền Bill (Tất cả)" : "Tổng tiền Bill trong ngày"}</span>
            <FileText className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-brand-ink break-all">
            {formatVND(summary.totalRevenue)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Thực thu Tiền mặt (Tất cả)" : "Thực thu Tiền mặt trong ngày"}</span>
            <Banknote className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-amber-700 break-all">
            {formatVND(summary.cashTotal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-indigo-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Chuyển khoản (Tất cả)" : "Chuyển khoản trong ngày"}</span>
            <Landmark className="w-4 h-4 text-brand-ink" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-brand-ink break-all">
            {formatVND(summary.bankingTotal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-purple-900 font-semibold">
            <span>{dateFilter === "ALL" ? "Quẹt thẻ (Tất cả)" : "Quẹt thẻ trong ngày"}</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-black text-purple-700 break-all">
            {formatVND(summary.cardTotal)}
          </div>
        </div>
      </div>
  );
}

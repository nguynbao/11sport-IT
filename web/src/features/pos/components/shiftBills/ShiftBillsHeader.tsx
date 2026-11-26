import React from "react";
import type { CurrentShiftOrdersMeta } from "@/shared/types";
import { Clock, ShieldAlert, RefreshCw } from "lucide-react";
import { formatShortVnDate, getLocalDateStr } from "../../utils/shiftBills";

interface Props {
  meta: CurrentShiftOrdersMeta | null;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  quickDates: string[];
  loading: boolean;
  loadShiftBills: () => void;
}

export default function ShiftBillsHeader({
  meta,
  dateFilter,
  setDateFilter,
  quickDates,
  loading,
  loadShiftBills,
}: Props) {
  return (
      <div className="bg-white text-slate-900 rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-brand-ink text-xs font-extrabold">
              <Clock className="w-3.5 h-3.5" />
              {meta?.shiftLabel || "Cả ngày (Mọi ca)"}
            </span>
            <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {dateFilter === "ALL"
                ? "Tất cả các ngày"
                : `Ngày: ${formatShortVnDate(dateFilter || meta?.date || getLocalDateStr())}`}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
            Lịch sử Hoá đơn (Tra cứu Bill mọi ngày &amp; mọi ca)
          </h2>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-brand-ink shrink-0" />
            <span>
              Tra cứu toàn bộ đơn hàng, Chọn ngày bất kỳ hoặc bấm <strong>Tất cả</strong> để xem toàn bộ lịch sử bill.
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {quickDates.map((dStr, idx) => {
            const label =
              idx === 0
                ? `Hôm nay (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`
                : idx === 1
                  ? `Hôm qua (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`
                  : `2 ngày trước (${dStr.slice(8, 10)}/${dStr.slice(5, 7)})`;
            const active = dateFilter === dStr;
            return (
              <button
                key={dStr}
                type="button"
                onClick={() => setDateFilter(dStr)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${active
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDateFilter("ALL")}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${dateFilter === "ALL"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={loadShiftBills}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>
  );
}

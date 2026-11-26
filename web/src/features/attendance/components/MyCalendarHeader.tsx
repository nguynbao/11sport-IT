"use client";

import React from "react";
import type { StaffUser, MyCalendarData } from "@/shared/types";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Send, RefreshCw, CalendarPlus } from "lucide-react";

interface Props {
  currentUser: StaffUser;
  data: MyCalendarData | null;
  month: number;
  year: number;
  loading: boolean;
  isSalesStaff: boolean;
  isThisMonth: boolean;
  onBack?: () => void;
  onShiftReg: () => void;
  onCreate: () => void;
  onThisMonth: () => void;
  goPrev: () => void;
  goNext: () => void;
  load: () => void;
}

export default function MyCalendarHeader({
  currentUser, data, month, year, loading, isSalesStaff, isThisMonth,
  onBack, onShiftReg, onCreate, onThisMonth, goPrev, goNext, load,
}: Props) {
  return (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-brand-ink" />
                  Lịch công của tôi
                </h2>
                <p className="text-[11px] text-slate-500">
                  {currentUser.fullName} • {data?.row?.department === "SALES" ? "Khối Bán hàng" : "Khối Văn phòng"}
                  {data?.row ? ` • chuẩn ${data.row.standardHours}h/ngày` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSalesStaff && (
                <button
                  type="button"
                  onClick={onShiftReg}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Đăng ký ca tuần sau
                </button>
              )}
              <button
                type="button"
                onClick={onCreate}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Tạo đơn (Nghỉ / WFH / Trễ / Về sớm)
              </button>
              {!isThisMonth && (
                <button
                  type="button"
                  onClick={onThisMonth}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  Tháng này
                </button>
              )}
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button type="button" onClick={goPrev} className="p-1.5 rounded-lg hover:bg-white text-slate-600" title="Tháng trước">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-sm font-extrabold text-slate-900 min-w-[112px] text-center">
                  Tháng {month}, {year}
                </span>
                <button type="button" onClick={goNext} className="p-1.5 rounded-lg hover:bg-white text-slate-600" title="Tháng sau">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={load}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Tải lại"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
  );
}

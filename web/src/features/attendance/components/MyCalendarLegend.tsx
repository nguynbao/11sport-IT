"use client";

import React from "react";
import type { MyCalendarData } from "@/shared/types";

interface Props {
  data: MyCalendarData | null;
  multiplier: number;
}

export default function MyCalendarLegend({ data, multiplier }: Props) {
  return (
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-3 shadow-sm space-y-2.5">
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
              Chú thích:
            </div>

            <div className="flex flex-col gap-1.5 text-[11px] text-slate-700">
              {/* Đúng giờ */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] text-[11px] font-black inline-flex items-center justify-center">
                  ✓
                </span>
                <span className="font-medium truncate">Đúng giờ</span>
              </div>

              {/* Đang làm */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#BFDBFE]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#3B82F6] text-white animate-pulse text-[9px] font-black inline-flex items-center justify-center">
                  ●
                </span>
                <span className="font-medium truncate">Đang làm</span>
              </div>

              {/* Làm từ xa (WFH) */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#A5F3FC]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#0891B2] text-white text-[9px] font-black inline-flex items-center justify-center">
                  W
                </span>
                <span className="font-medium truncate">Làm từ xa (WFH)</span>
              </div>

              {/* Tăng ca (đã duyệt) */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#C7D2FE]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#4F46E5] text-white text-[8px] font-black inline-flex items-center justify-center">
                  TC
                </span>
                <span className="font-medium truncate">Tăng ca (đã duyệt)</span>
              </div>

              {/* Đi trễ / Về sớm */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#FBBF24] text-[#451A03] text-[8px] font-black inline-flex items-center justify-center">
                  T/S
                </span>
                <span className="font-medium truncate" title="Đi trễ (T) / Về sớm (S) / Cả hai (TS)">
                  Đi trễ (T) / Về sớm (S) / Cả hai (TS)
                </span>
              </div>

              {/* Quên check-out */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECACA]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#DC2626] text-white text-[9px] font-black inline-flex items-center justify-center">
                  !
                </span>
                <span className="font-medium truncate">Quên check-out</span>
              </div>

              {/* Vắng không phép */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECDD3]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185] text-[9px] font-black inline-flex items-center justify-center">
                  V
                </span>
                <span className="font-medium truncate">Vắng không phép</span>
              </div>

              {/* Nghỉ OFF không lương */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                <span className="w-4 h-4 shrink-0 rounded bg-slate-200 text-slate-700 border border-slate-300 text-[9px] font-black inline-flex items-center justify-center">
                  P
                </span>
                <span className="font-medium truncate">Nghỉ OFF không lương</span>
              </div>

              {/* Phép có lương (+1 công) */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[8px] font-black inline-flex items-center justify-center">
                  PL
                </span>
                <span className="font-medium truncate">Phép có lương (+1 công)</span>
              </div>

              {/* Nghỉ lễ (+1 công VP) */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                  L
                </span>
                <span className="font-medium truncate">Nghỉ lễ (+1 công VP)</span>
              </div>

              {/* Đi làm lễ (lương x4) */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
                  ★
                </span>
                <span className="font-medium truncate">Đi làm lễ (lương x{multiplier})</span>
              </div>
            </div>

            {data && (
              <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px] leading-relaxed text-slate-600">
                <div className="font-extrabold text-slate-800 uppercase">Quy định</div>
                <p>
                  • Tuần làm 6 ngày (
                  {data.row?.department === "SALES" ? "nghỉ đúng 1 ngày OFF theo lịch xếp ca" : "nghỉ Chủ nhật"}).
                </p>
                <p>
                  • {data.rules.shifts.SHIFT_1}; {data.rules.shifts.SHIFT_2}. Làm 2 ca (Ca 1 + Ca 2) theo bảng xếp ca không tính là tăng ca.
                </p>
                <p>
                  •{" "}
                  {data.row?.department === "SALES" || data.rules.lateToleranceMinutes <= 0
                    ? "Check-in đúng giờ (Ca 1: 08:30; Ca 2: 12:00)"
                    : `Trễ quá ${data.rules.lateToleranceMinutes}p tính đi trễ.`}{" "}
                  {data.row?.department === "SALES"
                    ? "Khối Bán hàng (1 ca): check-out trễ tối đa 5p; sau 5p phải nhập lý do để HR xem xét có tính tăng ca hay không."
                    : "Khối Văn phòng: chỉ tính tăng ca khi được HR yêu cầu."}
                </p>
                <p>
                  •{" "}
                  {data.row?.department === "SALES"
                    ? `Khối Bán hàng: không có ngày nghỉ mặc định (kể cả CN & lễ) – nghỉ theo ngày OFF xếp ca; làm ngày lễ lương x${multiplier}.`
                    : `Khối Văn phòng: nghỉ lễ chính thức hưởng +1 công; đi làm ngày lễ lương x${multiplier}.`}
                </p>
              </div>
            )}
          </div>
  );
}

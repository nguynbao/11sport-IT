"use client";

import React from "react";
import type { MyCalendarCell, MyCalendarDay } from "@/shared/types";
import { STATUS, fmtMinutes } from "../myCalendar.constants";

export function DayCell({
  day,
  cell,
  department,
  multiplier,
  onClick,
}: {
  day: MyCalendarDay;
  cell: MyCalendarCell;
  department: string;
  multiplier: number;
  onClick: () => void;
}) {
  const isUnpaidHoliday = cell.code === "HOLIDAY" && !cell.isPaidHoliday;
  const st = isUnpaidHoliday ? STATUS.DAY_OFF : STATUS[cell.code];
  const hasPending = (cell.leaveRequests || []).some((l) => l.status === "PENDING");
  const eventHoliday = day.holiday && !day.holiday.isOfficialDayOff ? day.holiday : null;
  const officialHoliday = day.holiday && day.holiday.isOfficialDayOff ? day.holiday : null;
  const shiftLabel =
    cell.shiftCode === "BOTH"
      ? "Ca 1 + Ca 2"
      : cell.shiftCode === "SHIFT_2"
        ? "Ca 2"
        : cell.shiftCode === "SHIFT_1"
          ? "Ca 1"
          : null;

  let statusText = st.short;
  if (cell.code === "EARLY" || cell.code === "LATE_EARLY") {
    statusText = cell.earlyApproved ? "Xin về sớm" : st.short;
  }
  if (cell.code === "LATE" && cell.lateApproved) statusText = "Trễ (có đơn)";
  if (cell.code === "FUTURE" && shiftLabel) statusText = shiftLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden text-left rounded-xl border-2 p-1.5 sm:p-2 min-h-[78px] sm:min-h-[104px] flex flex-col transition hover:shadow-md hover:-translate-y-0.5 ${st.box} ${day.isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""
        }`}
    >
      {/* Ruy băng chéo góc phải: x4 lương khi đi làm ngày lễ */}
      {cell.isHolidayWork && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-rose-600 text-white text-[9px] font-black text-center py-[1px] shadow">
          x{multiplier} lương
        </span>
      )}
      {/* Nhãn sự kiện (lễ kỷ niệm) */}
      {!cell.isHolidayWork && eventHoliday && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-amber-500 text-white text-[8px] font-black text-center py-[1px]">
          Sự kiện
        </span>
      )}
      {!cell.isHolidayWork && officialHoliday && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-rose-600 text-white text-[8px] font-black text-center py-[1px]">
          {department === "SALES" ? `LỄ • x${multiplier}` : "LỄ"}
        </span>
      )}

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs sm:text-sm font-black ${day.isToday ? "bg-blue-600 text-white" : st.dayNum
              }`}
          >
            {day.day}
          </span>
          {hasPending && <span className="w-2 h-2 rounded-full bg-amber-500" title="Có đơn chờ duyệt" />}
          {cell.adjusted && <span className="w-1.5 h-1.5 rounded-full bg-[#171717] ring-1 ring-white/80" title="HR đã điều chỉnh" />}
        </div>
        {cell.isHolidayWork ? (
          <span className="w-4 h-4 shrink-0 rounded bg-blue-500 text-white ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
            ★
          </span>
        ) : st.badge ? (
          <span className={`w-4 h-4 shrink-0 rounded text-[9px] font-black inline-flex items-center justify-center ${st.badgeCls}`}>
            {st.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-auto space-y-0.5 min-w-0">
        {statusText && (
          <div className={`text-[10px] sm:text-[11px] font-extrabold truncate ${st.dayNum}`}>{statusText}</div>
        )}
        {cell.checkIn && (
          <div className="hidden sm:block text-[10px] font-mono text-slate-600 truncate">
            {cell.checkIn}–{cell.checkOut || "--:--"}
          </div>
        )}
        {(officialHoliday || eventHoliday) && (
          <div className="hidden sm:block text-[9px] text-slate-500 truncate" title={day.holiday!.name}>
            {day.holiday!.name}
          </div>
        )}
        <div className="flex flex-wrap gap-0.5">
          {!!cell.overtimeMinutes && (
            <span className="px-1 rounded bg-[#4F46E5] text-white text-[9px] font-black">
              TC {fmtMinutes(cell.overtimeMinutes)}
            </span>
          )}
          {!cell.overtimeMinutes && cell.overtimeStatus === "PENDING" && !!cell.lateCheckoutMinutes && (
            <span className="px-1 rounded bg-[#FCE7F3] text-[#BE185D] text-[9px] font-bold">
              ⏳ Chờ duyệt TC ({fmtMinutes(cell.lateCheckoutMinutes)})
            </span>
          )}
          {cell.isPaidHoliday && cell.code === "HOLIDAY" && (
            <span className="px-1 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">+1 công</span>
          )}
        </div>
      </div>
    </button>
  );
}

"use client";

import React from "react";
import type { MyCalendarCell, MyCalendarData, MyCalendarDay } from "@/shared/types";
import { WEEK_HEADERS } from "../myCalendar.constants";
import { DayCell } from "./MyCalendarDayCell";

interface Props {
  loading: boolean;
  data: MyCalendarData | null;
  grid: (MyCalendarDay | null)[];
  multiplier: number;
  onSelect: (day: MyCalendarDay, cell: MyCalendarCell) => void;
}

export default function MyCalendarGrid({ loading, data, grid, multiplier, onSelect }: Props) {
  return (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-2">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
              {WEEK_HEADERS.map((h, i) => (
                <div
                  key={h}
                  className={`py-1 text-[11px] sm:text-xs font-extrabold uppercase ${i === 0 ? "text-rose-600" : "text-slate-500"
                    }`}
                >
                  {h}
                </div>
              ))}
            </div>

            {loading && !data ? (
              <div className="py-20 text-center text-slate-400 text-sm">Đang tải lịch công...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {grid.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} className="rounded-xl bg-slate-50/40 min-h-[78px] sm:min-h-[104px]" />;
                  const cell = data?.row?.cells[day.date];
                  if (!cell) return <div key={day.date} className="rounded-xl border border-slate-200 min-h-[78px]" />;
                  return (
                    <DayCell
                      key={day.date}
                      day={day}
                      cell={cell}
                      department={data?.row?.department || "OFFICE"}
                      multiplier={multiplier}
                      onClick={() => onSelect(day, cell)}
                    />
                  );
                })}
              </div>
            )}
          </div>
  );
}

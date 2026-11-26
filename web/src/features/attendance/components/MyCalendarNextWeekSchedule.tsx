"use client";

import React from "react";
import type { MyShiftScheduleData } from "@/shared/types";
import { SHIFT_WEEK_DAY_NAMES, getNextMondayFallbackStr, addLocalDaysStr } from "../myCalendar.constants";
import { CheckCircle2, Clock } from "lucide-react";

interface Props {
  myShiftSchedule: MyShiftScheduleData;
  justSawConfirmedSchedule: boolean;
  onRegister: () => void;
}

export default function MyCalendarNextWeekSchedule({ myShiftSchedule, justSawConfirmedSchedule, onRegister }: Props) {
  const ws =
              myShiftSchedule.nextWeekStart ||
              myShiftSchedule.nextMonday ||
              myShiftSchedule.weekStart ||
              getNextMondayFallbackStr();
            const we = addLocalDaysStr(ws, 6);
            const [, wsM, wsD] = ws.split("-");
            const [weY, weM, weD] = we.split("-");
            const byDate = new Map((myShiftSchedule.assignments || []).map((a) => [a.date, a]));


            return (
              <div
                className={`bg-white rounded-2xl border p-3.5 sm:p-4 shadow-sm space-y-3 ${myShiftSchedule.isConfirmedByHr
                  ? "border-blue-300 ring-1 ring-blue-200"
                  : myShiftSchedule.isRegistered
                    ? "border-indigo-200"
                    : "border-amber-200"
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-ink" />
                      Lịch làm việc tuần sau ({wsD}/{wsM} – {weD}/{weM}/{weY})
                    </h3>
                    {myShiftSchedule.isConfirmedByHr ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-brand-ink text-[11px] font-extrabold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-ink" />
                        HR đã xác nhận lịch làm việc
                        {justSawConfirmedSchedule && (
                          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase">
                            Mới
                          </span>
                        )}
                      </span>
                    ) : myShiftSchedule.isRegistered ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-brand-ink text-[11px] font-bold">
                        ⏳ Đã gửi đăng ký – Chờ HR xác nhận
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Chưa đăng ký ca tuần sau
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onRegister}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    {myShiftSchedule.isConfirmedByHr
                      ? "Xem đăng ký"
                      : myShiftSchedule.isRegistered
                        ? "Sửa đăng ký ca"
                        : "Đăng ký ngay"}
                  </button>
                </div>

                {myShiftSchedule.offOverrideNotices && myShiftSchedule.offOverrideNotices.length > 0 && (
                  <div className="rounded-xl border border-[#F9A8D4] bg-[#FCE7F3] px-3 py-2 text-xs text-[#BE185D] font-semibold flex flex-wrap items-center gap-1.5">
                    <span>📢</span>
                    <span>
                      HR yêu cầu bạn đi làm vào ngày bạn đã xin OFF:{" "}
                      {myShiftSchedule.offOverrideNotices
                        .map((o) => {
                          const [, om, od] = o.date.split("-");
                          const sc =
                            o.shiftCode === "BOTH" ? "Ca 1 + Ca 2" : o.shiftCode === "SHIFT_1" ? "Ca 1" : "Ca 2";
                          return `${od}/${om} (${sc})`;
                        })
                        .join(", ")}
                    </span>
                  </div>
                )}

                {myShiftSchedule.isRegistered ? (
                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    {Array.from({ length: 7 }, (_, i) => {
                      const dStr = addLocalDaysStr(ws, i);
                      const [, m, d] = dStr.split("-");
                      const item = byDate.get(dStr);
                      const code = item?.shiftCode;
                      const prefDiffers =
                        item?.preferenceShift &&
                        item.preferenceShift !== item.shiftCode &&
                        item.assignedBy === "HR";
                      return (
                        <div
                          key={dStr}
                          className={`rounded-xl border p-2 text-center space-y-1 ${code === "SHIFT_1" || code === "SHIFT_2" || code === "BOTH"
                            ? "bg-indigo-50/70 border-indigo-300 text-indigo-900"
                            : "bg-rose-50/60 border-rose-200 text-rose-700"
                            }`}
                        >
                          <div className="text-[11px] font-extrabold">{SHIFT_WEEK_DAY_NAMES[i]}</div>
                          <div className="text-[10px] font-mono opacity-75">
                            {d}/{m}
                          </div>
                          <div className="text-xs font-black">
                            {code === "BOTH"
                              ? "Ca 1 + Ca 2"
                              : code === "SHIFT_1"
                                ? "Ca 1"
                                : code === "SHIFT_2"
                                  ? "Ca 2"
                                  : code === "OFF"
                                    ? "Nghỉ OFF"
                                    : "Chưa xếp"}
                          </div>
                          <div className="text-[9px] font-mono opacity-80">
                            {code === "BOTH"
                              ? "08:30–21:00"
                              : code === "SHIFT_1"
                                ? "08:30–17:30"
                                : code === "SHIFT_2"
                                  ? "12:00–21:00"
                                  : "Ngày nghỉ"}
                          </div>
                          {item?.preferenceShift === "BOTH" &&
                            (code === "SHIFT_1" || code === "SHIFT_2") &&
                            item.assignedBy === "AUTO" && (
                              <div className="text-[9px] font-semibold text-brand-ink">
                                (ĐK 2 ca • Random 1 ca)
                              </div>
                            )}
                          {prefDiffers && (
                            <div className="text-[9px] font-semibold text-rose-600">
                              (HR đã điều chỉnh)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Bạn chưa đăng ký ca cho tuần sau. Hãy bấm <b>&ldquo;Đăng ký ca tuần sau&rdquo;</b> để chọn 6 ca làm việc và 1 ngày OFF gửi cho HR.
                  </div>
                )}
              </div>
            );
}

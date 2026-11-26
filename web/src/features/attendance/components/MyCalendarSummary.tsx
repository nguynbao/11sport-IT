"use client";

import React from "react";
import type { MyCalendarData } from "@/shared/types";
import { CONTRACT_LABEL } from "@/features/leave";
import { fmtMinutes } from "../myCalendar.constants";
import { Hourglass } from "lucide-react";

interface Props {
  data: MyCalendarData | null;
  month: number;
  year: number;
  isSalesStaff: boolean;
  multiplier: number;
  onRegisterPaidLeave: () => void;
}

export default function MyCalendarSummary({ data, month, year, isSalesStaff, multiplier, onRegisterPaidLeave }: Props) {
  const s = data?.row?.summary;
  const pct = s && s.standardDays > 0 ? Math.min(100, (s.paidUnits / s.standardDays) * 100) : 0;

  return (
    <>
          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Tổng công tính lương</div>
                <div className="flex items-end gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-900">{s.paidUnits.toFixed(2)}</span>
                  <span className="text-sm font-bold text-slate-400 mb-0.5">/ {s.standardDays}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${pct >= 95 ? "bg-blue-500" : pct >= 80 ? "bg-yellow-400" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Đi làm {s.workUnits.toFixed(2)}
                  {s.holidayPaidDays > 0 && <span className="text-rose-600 font-semibold"> + Lễ {s.holidayPaidDays}</span>}
                  {s.paidLeaveUsed > 0 && <span className="text-brand-ink font-semibold"> + Phép {s.paidLeaveUsed}</span>}
                </div>
              </div>
              <StatCard label="Tổng giờ làm" value={`${s.totalHours.toFixed(1)}h`} tone="slate" />
              <StatCard label="Đi trễ" value={`${s.lateCount} lần`} sub={fmtMinutes(s.lateMinutes)} tone="yellow" />
              <StatCard label="Về sớm" value={`${s.earlyCount} lần`} sub={fmtMinutes(s.earlyMinutes)} tone="pink" />
              <StatCard
                label="Vắng / Quên ra ca"
                value={`${s.absentDays} / ${s.missingCheckout}`}
                tone="red"
              />
              <StatCard
                label="Tăng ca"
                value={fmtMinutes(s.overtimeMinutes)}
                sub={`${s.overtimeDays} ngày`}
                tone="indigo"
              />
              <StatCard
                label={`Làm ngày lễ (x${multiplier})`}
                value={`${s.holidayWorkDays} ngày`}
                sub={s.holidayWorkHours ? `${s.holidayWorkHours}h` : undefined}
                tone="rose"
              />
            </div>
          )}

          {s && s.pendingRequests > 0 && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Hourglass className="w-4 h-4" />
              Bạn có {s.pendingRequests} đơn đang chờ HR duyệt trong tháng này.
            </div>
          )}

          {s && (
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${data?.row?.contractType !== "FULLTIME"
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : (s.paidLeaveRemaining ?? Math.max(0, s.paidLeaveEntitled - s.paidLeaveUsed)) > 0
                  ? "bg-teal-50 border-teal-200 text-teal-900"
                  : "bg-slate-100 border-slate-300 text-slate-700"
                }`}
            >
              <span>
                <b>Quỹ nghỉ phép có lương (tích lũy đến tháng {month}/{year}):</b>{" "}
                {data?.row?.contractType !== "FULLTIME" ? (
                  <>
                    Đang ở giai đoạn{" "}
                    <b>{CONTRACT_LABEL[data?.row?.contractType || ""] || "Chưa cập nhật"}</b>
                    {data?.row?.contractType === "PROBATION" && (s.paidLeaveFromProbation ?? 0) > 0
                      ? ` • Đã tích lũy ${s.paidLeaveFromProbation} ngày phép thử việc – sẽ được cộng vào quỹ phép ngay khi ký HĐ Chính thức.`
                      : " – khi lên HĐ Chính thức sẽ được cộng số ngày phép tương ứng tháng thử việc (tối đa 2 ngày) + 1 ngày phép mỗi tháng chính thức."}
                  </>
                ) : (
                  <>
                    Có thể dùng <b>{s.paidLeaveEntitled} ngày</b>
                    {(s.paidLeaveFromProbation ?? 0) > 0 ? ` (gồm +${s.paidLeaveFromProbation} ngày từ thử việc)` : ""} • Đã dùng trong tháng:{" "}
                    <b>{s.paidLeaveUsed} ngày</b> • Còn để dành cộng dồn:{" "}
                    <b>{s.paidLeaveRemaining ?? Math.max(0, s.paidLeaveEntitled - s.paidLeaveUsed)} ngày</b> (dùng liên tiếp tối đa 1 tuần; từ 2 ngày phép trở đi phải tạo đơn trước 3 tuần).
                  </>
                )}
              </span>
              {data?.row?.contractType === "FULLTIME" &&
                (s.paidLeaveRemaining ?? Math.max(0, s.paidLeaveEntitled - s.paidLeaveUsed)) > 0 && (
                  <button
                    type="button"
                    onClick={() => onRegisterPaidLeave()}
                    className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold"
                  >
                    Đăng ký nghỉ phép
                  </button>
                )}
            </div>
          )}

          {s && isSalesStaff && (
            <div className="px-3 py-2 rounded-xl border bg-purple-50 border-purple-200 text-purple-900 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
              <span>
                Hạn mức nghỉ không lương (OFF) tháng {month}/{year} (Khối Bán hàng):{" "}
                <b>
                  Đã dùng {s.salesOffUsed ?? s.leaveDays}/{s.salesOffEntitled ?? 4} ngày
                </b>{" "}
                (Còn lại: <b>{s.salesOffRemaining ?? Math.max(0, 4 - (s.salesOffUsed ?? s.leaveDays))} ngày</b> — Đăng ký ca tuần mặc định tối đa 2 ngày nghỉ/tuần gồm 1 ngày OFF + 1 ngày phép; từ 3 ngày trở đi phải tạo đơn trước 3 tuần).
              </span>
            </div>
          )}
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "slate" | "yellow" | "pink" | "red" | "indigo" | "rose";
}) {
  const tones = {
    slate: "border-slate-200",
    yellow: "border-yellow-300 bg-yellow-50/50",
    pink: "border-pink-300 bg-pink-50/50",
    red: "border-red-300 bg-red-50/50",
    indigo: "border-indigo-300 bg-indigo-50/50",
    rose: "border-rose-300 bg-rose-50/50",
  } as const;
  return (
    <div className={`bg-white rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold text-slate-500 truncate">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

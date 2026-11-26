"use client";
import { TimesheetRow } from "@/shared/types";
import {
formatMinutes
} from "../timesheet.constants";

export function SummaryView({ rows }: { rows: TimesheetRow[] }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh]">
      <table data-cards className="w-full text-xs text-slate-700">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold">
          <tr>
            <th className="px-3 py-2 text-left">Nhân viên</th>
            <th className="px-2 py-2 text-center">Tổng công / chuẩn</th>
            <th className="px-2 py-2 text-center">Tổng giờ</th>
            <th className="px-2 py-2 text-center">Tăng ca</th>
            <th className="px-2 py-2 text-center">Đi trễ</th>
            <th className="px-2 py-2 text-center">Về sớm</th>
            <th className="px-2 py-2 text-center">Quên ra ca</th>
            <th className="px-2 py-2 text-center">Vắng KP</th>
            <th className="px-2 py-2 text-center">Nghỉ không lương</th>
            <th className="px-2 py-2 text-center">Phép có lương</th>
            <th className="px-2 py-2 text-center">WFH</th>
            <th className="px-2 py-2 text-center">Làm ngày lễ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const s = r.summary;
            const pct = s.standardDays > 0 ? s.paidUnits / s.standardDays : 0;
            return (
              <tr key={r.staffId} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="font-bold text-slate-900">{r.staffName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {r.staffCode} • {r.department === "OFFICE" ? "Văn phòng" : "Bán hàng"} • chuẩn {r.standardHours}h/ngày
                  </div>
                </td>
                <td className="px-2 py-2 min-w-[150px]">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-900">{s.paidUnits.toFixed(2)}</span>
                    <span className="text-slate-400">/ {s.standardDays}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Đi làm {s.workUnits.toFixed(2)}
                    {s.holidayPaidDays > 0 && (
                      <span className="text-fuchsia-700 font-semibold"> + Lễ {s.holidayPaidDays}</span>
                    )}
                    {(s.paidLeaveUsed || 0) > 0 && (
                      <span className="text-brand-ink font-semibold"> + Phép {s.paidLeaveUsed}</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0.95 ? "bg-teal-500" : pct >= 0.8 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-bold text-brand-ink">{s.totalHours.toFixed(1)}h</td>
                <td className="px-2 py-2 text-center">
                  {(s.overtimeMinutes || 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-[#E0E7FF] text-[#3730A3] font-bold">
                      {s.overtimeDays || 1} ngày • {formatMinutes(s.overtimeMinutes || 0)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.lateCount > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      {s.lateCount} lần • {formatMinutes(s.lateMinutes)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.earlyCount > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">
                      {s.earlyCount} lần • {formatMinutes(s.earlyMinutes)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.missingCheckout > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">{s.missingCheckout}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.absentDays > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">{s.absentDays}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{s.leaveDays || <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-2 text-center">
                  {r.contractType !== "FULLTIME" ? (
                    <span
                      className="text-[10px] text-slate-400"
                      title="Chỉ nhân viên HĐ Chính thức được dùng phép có lương; phép thử việc được cộng khi lên Chính thức"
                    >
                      {r.contractType === "PROBATION" && (s.paidLeaveFromProbation || 0) > 0
                        ? `Tích lũy +${s.paidLeaveFromProbation} (TV)`
                        : "Không áp dụng"}
                    </span>
                  ) : (
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          (s.paidLeaveUsed || 0) > 0
                            ? "bg-teal-100 text-brand-ink"
                            : (s.paidLeaveRemaining ?? (s.paidLeaveEntitled || 0)) > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Dùng {s.paidLeaveUsed || 0}/{s.paidLeaveEntitled || 0} • Còn{" "}
                        {s.paidLeaveRemaining ?? Math.max(0, (s.paidLeaveEntitled || 0) - (s.paidLeaveUsed || 0))}
                      </span>
                      {(s.paidLeaveFromProbation || 0) > 0 && (
                        <span className="text-[9px] text-brand-ink font-semibold">
                          (Gồm +{s.paidLeaveFromProbation} ngày TV)
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{s.wfhDays || <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-2 text-center">
                  {s.holidayWorkDays > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                      {s.holidayWorkDays} ngày • {s.holidayWorkHours}h
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


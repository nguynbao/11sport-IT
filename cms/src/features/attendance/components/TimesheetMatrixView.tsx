"use client";
import { TimesheetCell,TimesheetData,TimesheetDay,TimesheetRow } from "@/shared/types";
import {
AlertTriangle
} from "lucide-react";
import {
CELL_STYLE,
formatMinutes,
hasIssue,
WEEKDAY_SHORT
} from "../timesheet.constants";

export function MatrixView({
  data,
  rows,
  onCellClick,
}: {
  data: TimesheetData;
  rows: TimesheetRow[];
  onCellClick: (row: TimesheetRow, day: TimesheetDay, cell: TimesheetCell) => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh]">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b border-r border-slate-200 px-2.5 sm:px-3 py-2 text-left font-bold text-slate-700 min-w-[130px] sm:min-w-[190px]">
              Nhân viên
            </th>
            {data.days.map((d) => {
              const isSun = d.weekday === 0;
              const officialHoliday = d.holiday?.isOfficialDayOff;
              return (
                <th
                  key={d.date}
                  title={d.holiday ? d.holiday.name : undefined}
                  className={`sticky top-0 z-20 border-b border-slate-200 px-0 py-1.5 w-8 min-w-[32px] text-center font-semibold ${d.isToday
                    ? "bg-teal-600 text-white"
                    : officialHoliday
                      ? "bg-rose-100 text-rose-700"
                      : isSun
                        ? "bg-slate-200/70 text-rose-600"
                        : "bg-slate-100 text-slate-600"
                    }`}
                >
                  <div className="text-[12px] font-extrabold leading-none">{d.day}</div>
                  <div className="text-[9px] leading-none mt-0.5 opacity-80">{WEEKDAY_SHORT[d.weekday]}</div>
                </th>
              );
            })}
            <th className="sticky top-0 right-[60px] z-30 bg-teal-50 border-b border-l border-slate-200 px-2 py-1.5 text-center font-bold text-brand-ink min-w-[70px]">
              <div>Công</div>
              <div className="text-[9px] font-semibold text-brand-ink leading-none mt-0.5">
                /{rows[0]?.summary.standardDays ?? (data.monthMeta?.standardDays || 26)} chuẩn
              </div>
            </th>
            <th className="sticky top-0 right-0 z-30 bg-teal-50 border-b border-slate-200 px-2 py-1.5 text-center font-bold text-brand-ink min-w-[60px]">
              <div>Giờ</div>
              <div className="text-[9px] font-semibold text-brand-ink leading-none mt-0.5">&amp; TC</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = row.summary.standardDays > 0 ? row.summary.paidUnits / row.summary.standardDays : 0;
            return (
              <tr key={row.staffId} className="group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 px-3 py-1.5">
                  <div className="font-bold text-slate-900 truncate max-w-[170px]">{row.staffName}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="font-mono">{row.staffCode}</span>
                    <span
                      className={`px-1.5 rounded font-semibold ${row.department === "OFFICE" ? "bg-indigo-50 text-brand-ink" : "bg-amber-50 text-amber-700"
                        }`}
                    >
                      {row.department === "OFFICE" ? "VP" : "BH"}
                    </span>
                    {hasIssue(row) && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                  </div>
                </td>
                {data.days.map((d) => {
                  const cell = row.cells[d.date];
                  if (!cell) return <td key={d.date} className="border-b border-slate-100" />;
                  const baseStyle = CELL_STYLE[cell.code];
                  const hasApprovedOvertime = Boolean(cell.overtimeMinutes && cell.overtimeMinutes > 0);
                  // Lễ không được cộng công (Khối Bán hàng, hoặc lễ trùng Chủ nhật) -> hiển thị nhạt
                  const style =
                    cell.code === "HOLIDAY" && !cell.isPaidHoliday
                      ? {
                        ...baseStyle,
                        className: "bg-fuchsia-50 text-fuchsia-400 border border-fuchsia-200",
                        label:
                          row.department === "SALES"
                            ? "Ngày lễ – Khối Bán hàng không cộng công (đi làm hưởng x4)"
                            : "Ngày lễ trùng ngày nghỉ tuần",
                      }
                      : hasApprovedOvertime && (cell.code === "ON_TIME" || cell.code === "WFH")
                      ? {
                        ...baseStyle,
                        symbol: "TC",
                        className: "bg-[#4F46E5] text-white",
                        label: `${baseStyle.label} + Tăng ca (${cell.overtimeMinutes}p)`,
                      }
                      : baseStyle;
                  const clickable = cell.code !== "FUTURE";
                  const title = [
                    `${row.staffName} • ${d.day}/${data.month}`,
                    style.label,
                    cell.checkIn ? `Vào ${cell.checkIn}${cell.checkOut ? ` – Ra ${cell.checkOut}` : ""}` : "",
                    cell.hours ? `${cell.hours}h` : "",
                    cell.lateMinutes ? `Trễ ${cell.lateMinutes}p` : "",
                    cell.earlyMinutes ? `Về sớm ${cell.earlyMinutes}p` : "",
                    cell.overtimeStatus === "PENDING" && cell.lateCheckoutMinutes
                      ? `⏳ Check-out trễ ${cell.lateCheckoutMinutes}p – Chờ HR xét duyệt tăng ca${cell.lateCheckoutReason ? ` (Lý do: ${cell.lateCheckoutReason})` : ""}`
                      : "",
                    cell.overtimeMinutes ? `Tăng ca (đã duyệt): ${cell.overtimeMinutes}p` : "",
                    cell.isPaidHoliday ? "Nghỉ lễ hưởng nguyên lương: +1 công" : "",
                    cell.isHolidayWork ? "Đi làm ngày lễ chính thức – lương x4" : "",
                    cell.adjusted ? `Đã điều chỉnh bởi ${cell.adjustedByName}: ${cell.adjustReason}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <td
                      key={d.date}
                      className={`border-b border-slate-100 p-[3px] text-center ${d.isToday ? "bg-teal-50/60" : ""}`}
                    >
                      <button
                        type="button"
                        title={title}
                        disabled={!clickable}
                        onClick={() => onCellClick(row, d, cell)}
                        className={`relative w-[26px] h-[26px] rounded-md text-[10px] font-black inline-flex items-center justify-center transition ${style.className
                          } ${cell.isHolidayWork ? "ring-2 ring-yellow-400 ring-offset-1" : ""} ${hasApprovedOvertime && cell.code !== "ON_TIME" && cell.code !== "WFH" ? "ring-2 ring-[#4F46E5] ring-offset-1" : ""} ${cell.overtimeStatus === "PENDING" ? "ring-2 ring-[#4F46E5] ring-offset-1" : ""} ${clickable ? "hover:scale-110 hover:shadow-md cursor-pointer" : "cursor-default"
                          }`}
                      >
                        {style.symbol}
                        {hasApprovedOvertime && cell.code !== "ON_TIME" && cell.code !== "WFH" && (
                          <span className="absolute -bottom-1 -right-1 px-0.5 rounded bg-[#4F46E5] text-white text-[7px] font-black leading-tight border border-white">
                            TC
                          </span>
                        )}
                        {cell.overtimeStatus === "PENDING" && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#EC4899] border border-white" />
                        )}
                        {cell.adjusted && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#171717] ring-1 ring-white/80" />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="sticky right-[60px] z-10 bg-white group-hover:bg-slate-50 border-b border-l border-slate-200 px-2 py-1.5 text-center min-w-[70px]">
                  <div
                    className="font-extrabold text-slate-900 leading-tight"
                    title={`Đi làm: ${row.summary.workUnits} công | Nghỉ lễ hưởng lương: ${row.summary.holidayPaidDays} công | Phép có lương: ${row.summary.paidLeaveUsed || 0} công | Công chuẩn tháng: ${row.summary.standardDays} công`}
                  >
                    {row.summary.paidUnits.toFixed(1)}
                    <span className="text-[10px] font-semibold text-slate-400">/{row.summary.standardDays}</span>
                  </div>
                  {(row.summary.holidayPaidDays > 0 || (row.summary.paidLeaveUsed || 0) > 0) && (
                    <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                      {row.summary.holidayPaidDays > 0 && (
                        <span className="px-1 rounded bg-fuchsia-100 text-fuchsia-700 text-[8px] font-bold leading-tight">
                          +{row.summary.holidayPaidDays}L
                        </span>
                      )}
                      {(row.summary.paidLeaveUsed || 0) > 0 && (
                        <span className="px-1 rounded bg-fuchsia-100 text-fuchsia-700 text-[8px] font-bold leading-tight">
                          +{row.summary.paidLeaveUsed}PL
                        </span>
                      )}
                    </div>
                  )}
                  <div className="h-1 rounded bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0.95 ? "bg-teal-500" : pct >= 0.8 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-b border-slate-200 px-2 py-1.5 text-center min-w-[60px]">
                  <div className="font-bold text-brand-ink leading-tight">{row.summary.totalHours.toFixed(1)}</div>
                  {(row.summary.overtimeMinutes || 0) > 0 && (
                    <div
                      className="mt-0.5 px-1 rounded bg-[#E0E7FF] text-[#3730A3] text-[8px] font-bold leading-tight inline-block"
                      title={`Tăng ca đã duyệt: ${row.summary.overtimeMinutes} phút (${row.summary.overtimeDays || 1} ngày)`}
                    >
                      +{formatMinutes(row.summary.overtimeMinutes || 0)} TC
                    </div>
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

// ---------------------------------------------------------------------------
// Bảng tổng hợp công theo nhân viên
// ---------------------------------------------------------------------------

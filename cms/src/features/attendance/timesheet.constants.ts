import type { Department, TimesheetCell, TimesheetCellCode, TimesheetDay, TimesheetRow } from "@/shared/types";

export const CELL_STYLE: Record<
  TimesheetCellCode,
  { symbol: string; label: string; className: string; excel: string }
> = {
  ON_TIME: { symbol: "✓", label: "Đúng giờ", className: "bg-transparent text-[#10B981]", excel: "X" },
  WFH: { symbol: "W", label: "Làm từ xa (WFH)", className: "bg-[#0891B2] text-white", excel: "W" },
  WORKING: {
    symbol: "●",
    label: "Đang làm",
    className: "bg-[#3B82F6] text-white animate-pulse",
    excel: "●",
  },
  LATE: { symbol: "T", label: "Đi trễ", className: "bg-amber-400 text-amber-950", excel: "T" },
  EARLY: { symbol: "S", label: "Về sớm", className: "bg-amber-400 text-amber-950", excel: "S" },
  LATE_EARLY: { symbol: "TS", label: "Trễ & về sớm", className: "bg-amber-500 text-amber-950", excel: "TS" },
  MISSING_OUT: { symbol: "!", label: "Quên check-out", className: "bg-[#DC2626] text-white", excel: "!" },
  ABSENT: {
    symbol: "V",
    label: "Vắng không phép",
    className: "bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185]",
    excel: "V",
  },
  LEAVE: {
    symbol: "P",
    label: "Nghỉ OFF không lương",
    className: "bg-slate-200 text-slate-700 border border-slate-300",
    excel: "P",
  },
  PAID_LEAVE: {
    symbol: "PL",
    label: "Nghỉ phép có lương (+1 công)",
    className: "bg-fuchsia-600 text-white",
    excel: "PL",
  },
  HOLIDAY: {
    symbol: "L",
    label: "Nghỉ lễ chính thức (VP hưởng lương, +1 công)",
    className: "bg-fuchsia-600 text-white",
    excel: "L",
  },
  DAY_OFF: { symbol: "", label: "Ngày nghỉ / không có ca", className: "bg-slate-50 text-slate-300", excel: "" },
  UNSCHEDULED: {
    symbol: "?",
    label: "Sales chưa được xếp ca",
    className: "bg-white text-slate-400 border border-dashed border-slate-400",
    excel: "?",
  },
  FUTURE: {
    symbol: "",
    label: "Chưa tới",
    className: "bg-white text-slate-300 border border-dashed border-slate-200",
    excel: "",
  },
};

export const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export type ViewMode = "MATRIX" | "SUMMARY";
export type IssueFilter = "ALL" | "ISSUES";

export interface EditTarget {
  row: TimesheetRow;
  day: TimesheetDay;
  cell: TimesheetCell;
}

export function formatMinutes(min: number): string {
  if (!min) return "0p";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}p` : ""}` : `${m}p`;
}

export function hasIssue(row: TimesheetRow): boolean {
  const s = row.summary;
  return s.lateCount > 0 || s.earlyCount > 0 || s.missingCheckout > 0 || s.absentDays > 0;
}

export const SHIFT_DEFAULT_TIMES: Record<"SHIFT_1" | "SHIFT_2" | "BOTH", { checkIn: string; checkOut: string; label: string }> = {
  SHIFT_1: { checkIn: "08:30", checkOut: "17:30", label: "Ca 1 (08:30–17:30)" },
  SHIFT_2: { checkIn: "12:00", checkOut: "21:00", label: "Ca 2 (12:00–21:00)" },
  BOTH: { checkIn: "08:30", checkOut: "21:00", label: "Ca 1+2 (08:30–21:00)" },
};

export const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Bộ chọn giờ định dạng 24h (00:00 – 23:59), không hiển thị AM/PM trên mọi trình duyệt.
 */

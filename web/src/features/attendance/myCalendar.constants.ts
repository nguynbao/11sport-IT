import type { LeaveRequestType, MyCalendarCellCode } from "@/shared/types";

// ---------------------------------------------------------------------------
// Màu & nhãn cho từng trạng thái ngày công
// ---------------------------------------------------------------------------
export const STATUS: Record<
  MyCalendarCellCode,
  { label: string; short: string; badge: string; badgeCls: string; box: string; dayNum: string; dot: string }
> = {
  ON_TIME: {
    label: "Đúng giờ",
    short: "Đúng giờ",
    badge: "✓",
    badgeCls: "bg-transparent text-[#10B981]",
    box: "bg-transparent border-[#6EE7B7]",
    dayNum: "text-[#047857]",
    dot: "bg-[#10B981]",
  },
  LATE: {
    label: "Đi trễ (T)",
    short: "Đi trễ",
    badge: "T",
    badgeCls: "bg-amber-400 text-amber-950",
    box: "bg-amber-50 border-amber-400",
    dayNum: "text-amber-800",
    dot: "bg-amber-400",
  },
  EARLY: {
    label: "Về sớm (S)",
    short: "Về sớm",
    badge: "S",
    badgeCls: "bg-amber-400 text-amber-950",
    box: "bg-amber-50 border-amber-400",
    dayNum: "text-amber-800",
    dot: "bg-amber-400",
  },
  LATE_EARLY: {
    label: "Đi trễ & về sớm (TS)",
    short: "Trễ + sớm",
    badge: "TS",
    badgeCls: "bg-amber-500 text-white",
    box: "bg-amber-50 border-amber-500",
    dayNum: "text-amber-900",
    dot: "bg-amber-500",
  },
  WFH: {
    label: "Làm từ xa (WFH)",
    short: "WFH",
    badge: "W",
    badgeCls: "bg-[#0891B2] text-white",
    box: "bg-[#ECFEFF] border-[#22D3EE]",
    dayNum: "text-[#0E7490]",
    dot: "bg-[#0891B2]",
  },
  WORKING: {
    label: "Đang làm",
    short: "Đang làm",
    badge: "●",
    badgeCls: "bg-[#3B82F6] text-white animate-pulse",
    box: "bg-[#EFF6FF] border-[#60A5FA]",
    dayNum: "text-[#1D4ED8]",
    dot: "bg-[#3B82F6]",
  },
  MISSING_OUT: {
    label: "Quên check-out",
    short: "Quên ra ca",
    badge: "!",
    badgeCls: "bg-[#DC2626] text-white",
    box: "bg-[#FEF2F2] border-[#EF4444] border-dashed",
    dayNum: "text-[#B91C1C]",
    dot: "bg-[#DC2626]",
  },
  PAID_LEAVE: {
    label: "Phép có lương (+1 công)",
    short: "Phép có lương",
    badge: "PL",
    badgeCls: "bg-fuchsia-600 text-white",
    box: "bg-fuchsia-50 border-fuchsia-400",
    dayNum: "text-fuchsia-700",
    dot: "bg-fuchsia-600",
  },
  LEAVE: {
    label: "Nghỉ OFF không lương",
    short: "Nghỉ OFF",
    badge: "P",
    badgeCls: "bg-slate-200 text-slate-700 border border-slate-300",
    box: "bg-slate-100 border-slate-300",
    dayNum: "text-slate-600",
    dot: "bg-slate-400",
  },
  ABSENT: {
    label: "Vắng không phép",
    short: "Vắng",
    badge: "V",
    badgeCls: "bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185]",
    box: "bg-[#FFF1F2] border-[#FB7185]",
    dayNum: "text-[#BE123C]",
    dot: "bg-[#F43F5E]",
  },
  HOLIDAY: {
    label: "Nghỉ lễ (+1 công VP)",
    short: "Nghỉ lễ",
    badge: "L",
    badgeCls: "bg-fuchsia-600 text-white",
    box: "bg-fuchsia-50 border-fuchsia-400",
    dayNum: "text-fuchsia-700",
    dot: "bg-fuchsia-600",
  },
  DAY_OFF: {
    label: "Nghỉ OFF không lương",
    short: "OFF",
    badge: "P",
    badgeCls: "bg-slate-200 text-slate-700 border border-slate-300",
    box: "bg-slate-100 border-slate-300",
    dayNum: "text-slate-500",
    dot: "bg-slate-400",
  },
  UNSCHEDULED: {
    label: "Chưa được xếp ca",
    short: "Chưa xếp ca",
    badge: "?",
    badgeCls: "bg-slate-100 text-slate-500 border border-dashed border-slate-300",
    box: "bg-white border-slate-300 border-dashed",
    dayNum: "text-slate-500",
    dot: "bg-white border border-dashed border-slate-400",
  },
  FUTURE: {
    label: "Chưa tới",
    short: "",
    badge: "",
    badgeCls: "",
    box: "bg-white border-slate-300",
    dayNum: "text-slate-700",
    dot: "bg-white border border-slate-300",
  },
};

export const LEGEND: MyCalendarCellCode[] = [
  "ON_TIME",
  "LATE",
  "EARLY",
  "WFH",
  "ABSENT",
  "DAY_OFF",
  "PAID_LEAVE",
  "LEAVE",
  "HOLIDAY",
  "MISSING_OUT",
  "WORKING",
];

export const LEAVE_TYPE_LABEL: Record<LeaveRequestType, string> = {
  PAID_LEAVE: "Nghỉ phép có lương",
  OFF: "Xin off",
  CHANGE_OFF: "Xin chuyển ngày off",
  LATE: "Xin đi trễ",
  EARLY: "Xin về sớm",
  WFH: "Làm từ xa (WFH)",
};
export const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-blue-100 text-brand-ink" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-700" },
};

export const WEEK_HEADERS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function fmtMinutes(min?: number): string {
  if (!min) return "0p";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}p`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export const SHIFT_WEEK_DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export function getNextMondayFallbackStr(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const offsetToCurrentMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offsetToCurrentMonday + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addLocalDaysStr(dateStr: string | undefined, days: number): string {
  const safeStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getNextMondayFallbackStr();
  const [y, m, d] = safeStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

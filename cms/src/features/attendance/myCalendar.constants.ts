import type { LeaveRequestType, MyCalendarCellCode } from "@/shared/types";

export const WEEK_HEADERS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const LEAVE_TYPE_LABEL: Record<LeaveRequestType, string> = {
  PAID_LEAVE: "Nghỉ phép (có lương)",
  OFF: "Xin nghỉ (OFF không lương)",
  CHANGE_OFF: "Xin chuyển ngày off",
  WFH: "Làm từ xa (WFH)",
  LATE: "Xin đi trễ",
  EARLY: "Xin về sớm",
};

export const CONTRACT_LABEL: Record<string, string> = {
  INTERN: "Thực tập",
  PROBATION: "Thử việc",
  FULLTIME: "Chính thức",
  PARTTIME: "Bán thời gian (cũ)",
};

export const isPaidLeaveEligible = (contractType?: string | null) => contractType === "FULLTIME";

export const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ HR duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-teal-100 text-brand-ink" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-800" },
};

export const STATUS: Record<
  MyCalendarCellCode,
  {
    short: string;
    label: string;
    box: string;
    dot: string;
    dayNum: string;
    badge?: string;
    badgeCls?: string;
  }
> = {
  ON_TIME: {
    short: "Đúng giờ",
    label: "Đi làm đúng giờ",
    box: "bg-transparent border-[#6EE7B7]",
    dot: "bg-[#10B981]",
    dayNum: "text-[#047857]",
    badge: "✓",
    badgeCls: "bg-transparent text-[#10B981]",
  },
  WORKING: {
    short: "Đang làm",
    label: "Đang trong ca",
    box: "bg-[#EFF6FF] border-[#60A5FA]",
    dot: "bg-[#3B82F6] animate-pulse",
    dayNum: "text-[#1D4ED8]",
    badge: "●",
    badgeCls: "bg-[#3B82F6] text-white animate-pulse",
  },
  WFH: {
    short: "WFH",
    label: "Làm việc từ xa (WFH)",
    box: "bg-[#ECFEFF] border-[#22D3EE]",
    dot: "bg-[#0891B2]",
    dayNum: "text-[#0E7490]",
    badge: "W",
    badgeCls: "bg-[#0891B2] text-white",
  },
  LATE: {
    short: "Đi trễ",
    label: "Đi trễ",
    box: "bg-amber-50 border-amber-300",
    dot: "bg-amber-500",
    dayNum: "text-amber-900",
    badge: "T",
    badgeCls: "bg-amber-400 text-amber-950",
  },
  EARLY: {
    short: "Về sớm",
    label: "Về sớm",
    box: "bg-amber-50 border-amber-300",
    dot: "bg-amber-500",
    dayNum: "text-amber-900",
    badge: "S",
    badgeCls: "bg-amber-400 text-amber-950",
  },
  LATE_EARLY: {
    short: "Trễ & sớm",
    label: "Đi trễ & về sớm",
    box: "bg-amber-100/80 border-amber-400",
    dot: "bg-amber-500",
    dayNum: "text-amber-950",
    badge: "TS",
    badgeCls: "bg-amber-500 text-white",
  },
  MISSING_OUT: {
    short: "Quên ra ca",
    label: "Chưa check-out",
    box: "bg-[#FEF2F2] border-[#EF4444]",
    dot: "bg-[#DC2626]",
    dayNum: "text-[#B91C1C]",
    badge: "!",
    badgeCls: "bg-[#DC2626] text-white",
  },
  ABSENT: {
    short: "Vắng",
    label: "Vắng không phép",
    box: "bg-[#FFF1F2] border-[#FB7185]",
    dot: "bg-[#F43F5E]",
    dayNum: "text-[#BE123C]",
    badge: "V",
    badgeCls: "bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185]",
  },
  LEAVE: {
    short: "Nghỉ OFF",
    label: "Nghỉ OFF (không lương)",
    box: "bg-slate-100 border-slate-300",
    dot: "bg-slate-400",
    dayNum: "text-slate-700",
    badge: "P",
    badgeCls: "bg-slate-200 text-slate-700 border border-slate-300",
  },
  PAID_LEAVE: {
    short: "Phép (+1c)",
    label: "Nghỉ phép có lương (+1 công)",
    box: "bg-fuchsia-50 border-fuchsia-300",
    dot: "bg-fuchsia-600",
    dayNum: "text-fuchsia-700",
    badge: "PL",
    badgeCls: "bg-fuchsia-600 text-white",
  },
  HOLIDAY: {
    short: "Nghỉ lễ",
    label: "Nghỉ lễ hưởng lương (+1 công)",
    box: "bg-fuchsia-50 border-fuchsia-300",
    dot: "bg-fuchsia-600",
    dayNum: "text-fuchsia-900",
    badge: "L",
    badgeCls: "bg-fuchsia-600 text-white",
  },
  DAY_OFF: {
    short: "Nghỉ tuần",
    label: "Ngày nghỉ hàng tuần",
    box: "bg-slate-50 border-slate-200",
    dot: "bg-slate-300",
    dayNum: "text-slate-400",
  },
  UNSCHEDULED: {
    short: "Chưa xếp ca",
    label: "Chưa được xếp ca",
    box: "bg-slate-50 border-dashed border-slate-300",
    dot: "bg-slate-300",
    dayNum: "text-slate-400",
  },
  FUTURE: {
    short: "",
    label: "Chưa tới",
    box: "bg-white border-slate-200",
    dot: "bg-slate-200",
    dayNum: "text-slate-700",
  },
};

export function fmtMinutes(m?: number) {
  if (!m) return "0p";
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${r}p` : `${h}h`;
}


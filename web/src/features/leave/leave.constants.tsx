import React from "react";
import type { LeaveRequestType } from "@/shared/types";
import {
  CalendarOff, Home, Clock3, LogOut as LogOutIcon, BadgeCheck, ArrowLeftRight,
} from "lucide-react";

export const CONTRACT_LABEL: Record<string, string> = {
  FULLTIME: "Chính thức",
  PROBATION: "Thử việc",
  INTERN: "Thực tập",
  PARTTIME: "Bán thời gian (cũ)",
};

/** Độ dài tối đa của lý do trong đơn từ (khớp server) */
export const LEAVE_REASON_MAX = 100;

/** Chỉ nhân viên hợp đồng Chính thức mới được dùng ngày nghỉ phép có lương */
export function isPaidLeaveEligible(contractType?: string | null): boolean {
  return contractType === "FULLTIME";
}

export const LEAVE_TYPE_META: Record<
  LeaveRequestType,
  { label: string; desc: string; cls: string; icon: React.ReactNode }
> = {
  PAID_LEAVE: {
    label: "Nghỉ phép có lương",
    desc: "Cộng dồn phép • Hưởng nguyên lương",
    cls: "bg-teal-100 text-brand-ink border-teal-300",
    icon: <BadgeCheck className="w-4 h-4" />,
  },
  OFF: {
    label: "Xin off",
    desc: "Nghỉ cả ngày, không tính công",
    cls: "bg-blue-100 text-brand-ink border-blue-300",
    icon: <CalendarOff className="w-4 h-4" />,
  },
  CHANGE_OFF: {
    label: "Xin chuyển ngày off",
    desc: "Đổi ngày nghỉ đã xin • Cần HR duyệt",
    cls: "bg-indigo-100 text-brand-ink border-indigo-300",
    icon: <ArrowLeftRight className="w-4 h-4" />,
  },
  WFH: {
    label: "Làm từ xa (WFH)",
    desc: "Làm việc online, chấm công từ xa",
    cls: "bg-purple-100 text-purple-800 border-purple-300",
    icon: <Home className="w-4 h-4" />,
  },
  LATE: {
    label: "Xin đi trễ",
    desc: "Đến muộn có lý do",
    cls: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: <Clock3 className="w-4 h-4" />,
  },
  EARLY: {
    label: "Xin về sớm",
    desc: "Về trước giờ kết ca",
    cls: "bg-pink-100 text-pink-800 border-pink-300",
    icon: <LogOutIcon className="w-4 h-4" />,
  },
};

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-blue-100 text-brand-ink" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-700" },
};

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDate(s?: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

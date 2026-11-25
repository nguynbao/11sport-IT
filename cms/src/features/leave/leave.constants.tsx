import type { LeaveRequestStatus,LeaveRequestType } from "@/shared/types";
import { ArrowLeftRight,CalendarOff,Clock,Home,LogOut,Palmtree } from "lucide-react";
import React from "react";

export const LEAVE_REASON_MAX = 100;

export const LEAVE_TYPE_META: Record<
  LeaveRequestType,
  { label: string; desc: string; cls: string; icon: React.ReactNode }
> = {
  PAID_LEAVE: {
    label: "Nghỉ phép có lương",
    desc: "Tích lũy 1–2 ngày phép thử việc + 1 ngày phép/tháng chính thức, được để dành cộng dồn (vẫn tính +1 công)",
    cls: "bg-teal-100 text-brand-ink border-teal-200",
    icon: <Palmtree className="w-3.5 h-3.5" />,
  },
  OFF: {
    label: "Xin nghỉ (OFF không lương)",
    desc: "Nghỉ nguyên ngày không tính công (từ 3 ngày/tuần trở đi phải tạo đơn trước tối thiểu 3 tuần)",
    cls: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <CalendarOff className="w-3.5 h-3.5" />,
  },
  CHANGE_OFF: {
    label: "Xin chuyển ngày off",
    desc: "Đổi ngày nghỉ đã đăng ký / đã được duyệt sang một ngày khác khi có việc đột xuất (chờ HR duyệt)",
    cls: "bg-indigo-100 text-brand-ink border-indigo-200",
    icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
  },
  WFH: {
    label: "Làm việc từ xa (WFH)",
    desc: "Không kiểm tra IP mạng khi chấm công ngày được duyệt",
    cls: "bg-teal-100 text-brand-ink border-teal-200",
    icon: <Home className="w-3.5 h-3.5" />,
  },
  LATE: {
    label: "Xin đi trễ",
    desc: "Báo trước lý do vào ca muộn để HR xét duyệt",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  EARLY: {
    label: "Xin về sớm",
    desc: "Khi được HR duyệt, được check-out sớm không cần xác nhận lại",
    cls: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <LogOut className="w-3.5 h-3.5" />,
  },
};

export interface AvailableOffDayOption {
  date: string;
  offType: "OFF" | "PAID_LEAVE";
  sourceLeaveId?: string;
  label: string;
}

export const STATUS_META: Record<LeaveRequestStatus, { label: string; cls: string }> = {
  PENDING: { label: "Chờ HR duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-teal-100 text-brand-ink" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-800" },
};

export const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDaysIso = (dateStr: string, deltaDays: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};


"use client";

import React from "react";
import { StaffUser } from "@/shared/types";
import { Play, Pause, CheckCircle2, AlertTriangle, Home, Clock, CalendarDays } from "lucide-react";
import { useHeaderAttendanceBar } from "../hooks/useHeaderAttendanceBar";

interface Props {
  currentUser: StaffUser | null;
  onOpenMyAttendance?: () => void;
}

export default function HeaderAttendanceBar({ currentUser, onOpenMyAttendance }: Props) {
  const {
    attendance,
    isWfhToday,
    loading,
    actionLoading,
    elapsedText,
    isLunchPaused,
    feedback,
    isWorking,
    isCompleted,
    handlePlayCheckIn,
    handlePauseCheckOut,
  } = useHeaderAttendanceBar(currentUser);

  if (!currentUser || currentUser.role === "ADMIN" || currentUser.role === "CEO") return null;

  return (
    <div className="relative w-full md:w-auto max-w-full flex items-center justify-center">
      <div className="w-full md:w-auto max-w-full grid grid-cols-[auto_1fr_auto] sm:flex sm:flex-nowrap items-center justify-between md:justify-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-2xs text-slate-800">
        {isWfhToday && (
          <span
            title="Hôm nay được duyệt làm việc từ xa (WFH)"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 border border-purple-200 text-purple-700 text-[11px] font-bold"
          >
            <Home className="w-3 h-3" />
            WFH
          </span>
        )}

        {/* Chưa Check-in: Nút PLAY + Đồng hồ 00:00:00 */}
        {!attendance && !loading && (
          <button
            type="button"
            onClick={handlePlayCheckIn}
            disabled={actionLoading}
            title="Bấm Play để bắt đầu tính giờ chấm công"
            className={`${onOpenMyAttendance ? "col-span-2 sm:col-span-1 justify-self-start" : "col-span-3 sm:col-span-1 justify-self-center"} px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="font-mono text-sm tracking-wider">00:00:00</span>
          </button>
        )}

        {/* Đang trong ca: Nút PAUSE + Đồng hồ đếm giờ HH:MM:SS */}
        {isWorking && (
          <>
            <button
              type="button"
              onClick={() => handlePauseCheckOut(false)}
              disabled={actionLoading}
              title="Bấm Pause để kết thúc ca (Check-out)"
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow-xs transition cursor-pointer shrink-0"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-1.5 py-0.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLunchPaused ? "bg-amber-500" : "bg-teal-600 animate-pulse"
                }`}
              />
              <span className="font-mono font-black text-sm sm:text-base text-brand-ink tracking-wider">
                {elapsedText}
              </span>
            </div>
          </>
        )}

        {/* Đã Check-out hoàn tất trong ngày: Chỉ hiện icon hoàn tất + Đồng hồ tổng giờ */}
        {isCompleted && (
          <div className={`${onOpenMyAttendance ? "col-span-2 sm:col-span-1 justify-self-center" : "col-span-3 sm:col-span-1 justify-self-center"} flex items-center gap-2 px-2 py-0.5 text-xs`}>
            <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
            <span className="font-mono font-black text-sm sm:text-base text-brand-ink tracking-wider">
              {elapsedText}
            </span>
          </div>
        )}

        {loading && (
          <div className={`${onOpenMyAttendance ? "col-span-2 sm:col-span-1" : "col-span-3 sm:col-span-1"} flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-slate-500 font-mono`}>
            <Clock className="w-3.5 h-3.5 animate-spin text-brand-ink" />
            <span>--:--:--</span>
          </div>
        )}

        {onOpenMyAttendance && (
          <button
            type="button"
            onClick={onOpenMyAttendance}
            title="Xem lịch chấm công cá nhân & gửi đơn từ"
            className="justify-self-end sm:ml-1 px-2.5 py-1 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-teal-300 hover:text-white border border-slate-600 text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <CalendarDays className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">Lịch chấm công</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`absolute top-full mt-1.5 z-50 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 border ${
            feedback.type === "ok"
              ? "bg-teal-950/95 text-teal-300 border-teal-700"
              : "bg-rose-950/95 text-rose-300 border-rose-700"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  );
}

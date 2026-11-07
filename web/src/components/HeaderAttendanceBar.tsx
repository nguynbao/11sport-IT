"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StaffUser,
  AttendanceData,
  checkInApi,
  checkOutApi,
  getTodayAttendanceApi,
  confirmHandoverApi,
  apiRequest,
} from "@/lib/api";
import { Play, Pause, CheckCircle2, AlertTriangle, Home, Clock } from "lucide-react";
import ShiftHandoverModal from "./ShiftHandoverModal";
import FridayShiftRegistrationModal from "./FridayShiftRegistrationModal";

/** Ngày hiện tại theo giờ máy (YYYY-MM-DD) */
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  currentUser: StaffUser | null;
}

export default function HeaderAttendanceBar({ currentUser }: Props) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [isEarlyApprovedToday, setIsEarlyApprovedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Đồng hồ đếm giờ làm việc trực tiếp trên Header
  const [elapsedText, setElapsedText] = useState<string>("00:00:00");
  const [isLunchPaused, setIsLunchPaused] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Cấu hình tọa độ từ server
  const [officeLat, setOfficeLat] = useState<number>(16.0352);
  const [officeLng, setOfficeLng] = useState<number>(108.2185);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Bàn giao ca cho Sales (chỉ hiện khi cần thiết)
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showFridayModal, setShowFridayModal] = useState(false);
  const [pendingHandoverToConfirm, setPendingHandoverToConfirm] = useState<any | null>(null);

  const showNotice = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role === "ADMIN") return;
    setLoading(true);
    try {
      const [todayRes, cfgRes] = await Promise.all([
        getTodayAttendanceApi(),
        apiRequest<{ config: any; detectedClientIp: string }>("/attendance/config").catch(() => null),
      ]);
      setAttendance(todayRes.attendance);
      setIsWfhToday(todayRes.isWfhToday);
      setIsEarlyApprovedToday(Boolean(todayRes.isEarlyApprovedToday));

      if (cfgRes?.data?.config) {
        setOfficeLat(Number(cfgRes.data.config.officeLat ?? 16.0352));
        setOfficeLng(Number(cfgRes.data.config.officeLng ?? 108.2185));
      }

      if (todayRes.attendance && currentUser.role === "SALES") {
        const res = await apiRequest<any[]>("/shifts/handover").catch(() => null);
        const pending = Array.isArray(res?.data)
          ? res!.data.find((h: any) => h.status === "PENDING")
          : null;
        if (pending && pending.fromStaffId !== currentUser._id) {
          setPendingHandoverToConfirm(pending);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [loadData]);

  // Qua 00:00 sang ngày mới: reset đồng hồ & tải lại trạng thái chấm công của ngày mới
  // (ca hôm trước quên check-out sẽ được ghi nhận "Quên check-out" trên bảng công, không đếm tiếp)
  const dayRef = useRef<string>(localDateStr());
  useEffect(() => {
    const watcher = setInterval(() => {
      const today = localDateStr();
      if (today !== dayRef.current) {
        dayRef.current = today;
        setAttendance(null);
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        loadData();
      }
    }, 15000);
    return () => clearInterval(watcher);
  }, [loadData]);

  // Tính toán đồng hồ chạy trực tiếp mỗi giây khi đã Check-in
  useEffect(() => {
    if (!attendance?.checkInTime) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      return;
    }

    // Bản ghi không phải của hôm nay (quên check-out từ hôm trước) -> không đếm tiếp, reset về 00:00:00
    if (attendance.date && attendance.date !== localDateStr()) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      setAttendance(null);
      return;
    }

    const computeElapsed = () => {
      // Đồng hồ đang chạy mà vừa qua 00:00 -> dừng & reset ngay
      if (!attendance.checkOutTime && attendance.date && attendance.date !== localDateStr()) {
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        setAttendance(null);
        return;
      }
      const startRaw = attendance.workStartTime || attendance.checkInTime;
      const startTime = new Date(startRaw);
      const endTime = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();

      const isOffice =
        currentUser?.department === "OFFICE" ||
        (currentUser?.role && currentUser.role !== "SALES");

      // Kiểm tra giờ nghỉ trưa 12:00 - 13:30 đối với khối Văn phòng
      const lunchStart = new Date(endTime);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(endTime);
      lunchEnd.setHours(13, 30, 0, 0);

      let pausedNow = false;
      let effectiveEnd = endTime;
      let deductMs = 0;

      if (isOffice) {
        if (!attendance.checkOutTime && endTime >= lunchStart && endTime < lunchEnd) {
          pausedNow = true;
          effectiveEnd = lunchStart;
        } else if (endTime >= lunchEnd && startTime < lunchEnd) {
          const overlapStart = startTime > lunchStart ? startTime : lunchStart;
          if (overlapStart < lunchEnd) {
            deductMs = lunchEnd.getTime() - overlapStart.getTime();
          }
        }
      }

      setIsLunchPaused(pausedNow);

      const diffMs = Math.max(0, effectiveEnd.getTime() - startTime.getTime() - deductMs);
      const totalSeconds = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;

      setElapsedText(
        `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };

    computeElapsed();
    if (!attendance.checkOutTime) {
      const timer = setInterval(computeElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [attendance, currentUser]);

  // Bấm nút PLAY -> Check-in trực tiếp trên Header (Tự động nhận diện Ca 1 / Ca 2 theo giờ bấm)
  const handlePlayCheckIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await checkInApi({
        latitude: coords ? coords.lat : officeLat,
        longitude: coords ? coords.lng : officeLng,
      });
      setAttendance(res.attendance);
      showNotice("ok", "Đã bắt đầu tính giờ ca làm việc!");
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể chấm công vào ca");
    } finally {
      setActionLoading(false);
    }
  };

  // Bấm nút PAUSE -> Check-out trực tiếp trên Header
  const handlePauseCheckOut = async (forceEarly = false, earlyReason = "") => {
    if (actionLoading) return;

    // Kiểm tra đã đủ giờ kết thúc ca chưa (Ca 1: 17:30, Ca 2: 21:00)
    const now = new Date();
    const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
    const isShift2 = attendance?.shiftCode === "SHIFT_2";
    const shiftEndMinutes = isShift2 ? 21 * 60 : 17 * 60 + 30;
    const shiftEndLabel = isShift2 ? "21:00" : "17:30";

    if (totalMinutesNow < shiftEndMinutes && !isEarlyApprovedToday && !forceEarly) {
      const remain = shiftEndMinutes - totalMinutesNow;
      const rHours = Math.floor(remain / 60);
      const rMins = remain % 60;
      const remainStr = rHours > 0 ? `${rHours} giờ ${rMins} phút` : `${rMins} phút`;
      showNotice(
        "err",
        `Chưa đủ giờ kết thúc ca (${shiftEndLabel} - còn ${remainStr}), chưa thể bàn giao ca & Check-out!`
      );
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await checkOutApi({
        forceEarly: forceEarly || isEarlyApprovedToday,
        earlyReason: earlyReason || (isEarlyApprovedToday ? "Đã được HR duyệt về sớm" : ""),
        latitude: coords ? coords.lat : officeLat,
        longitude: coords ? coords.lng : officeLng,
      });
      setAttendance(res.attendance);
      showNotice("ok", `Đã kết thúc ca (${res.attendance.totalWorkHours}h)!`);

      const today = new Date();
      if (today.getDay() === 5 && currentUser?.role === "SALES") {
        setShowFridayModal(true);
      }
    } catch (err: any) {
      if (err.code === "HANDOVER_REQUIRED") {
        setShowHandoverModal(true);
      } else {
        showNotice("err", err?.message || "Không thể kết ca");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmIncomingHandover = async (accept: boolean) => {
    if (!pendingHandoverToConfirm) return;
    try {
      await confirmHandoverApi(pendingHandoverToConfirm._id, accept);
      showNotice("ok", accept ? "Đã nhận bàn giao Kho Tầng 1!" : "Đã từ chối bàn giao");
      setPendingHandoverToConfirm(null);
    } catch (err: any) {
      showNotice("err", err?.message || "Lỗi xác nhận bàn giao");
    }
  };

  if (!currentUser || currentUser.role === "ADMIN") return null;

  const isWorking = Boolean(attendance && !attendance.checkOutTime);
  const isCompleted = Boolean(attendance && attendance.checkOutTime);

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex items-center gap-2 bg-slate-800/95 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-inner">
        {/* Badge WFH nếu có */}
        {isWfhToday && (
          <span
            title="Hôm nay được duyệt làm việc từ xa (WFH)"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] font-bold"
          >
            <Home className="w-3 h-3" />
            WFH
          </span>
        )}

        {/* Chưa Check-in: Nút PLAY + Đồng hồ 00:00:00 (Tự động nhận Ca theo giờ Check-in) */}
        {!attendance && !loading && (
          <button
            type="button"
            onClick={handlePlayCheckIn}
            disabled={actionLoading}
            title="Bấm Play để bắt đầu tính giờ chấm công"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
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
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow-md transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLunchPaused ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span className="font-mono font-black text-sm sm:text-base text-emerald-400 tracking-wider">
                {elapsedText}
              </span>
            </div>
          </>
        )}

        {/* Đã Check-out hoàn tất trong ngày: Chỉ hiện icon hoàn tất + Đồng hồ tổng giờ */}
        {isCompleted && (
          <div className="flex items-center gap-2 px-2 py-0.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono font-black text-sm sm:text-base text-emerald-300 tracking-wider">
              {elapsedText}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>--:--:--</span>
          </div>
        )}

        {/* Nếu Sales Ca 2 có bàn giao từ Ca 1 đang chờ xác nhận */}
        {pendingHandoverToConfirm && (
          <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
            <button
              type="button"
              onClick={() => handleConfirmIncomingHandover(true)}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
              title={`Nhận bàn giao Kho Tầng 1 từ ${pendingHandoverToConfirm.fromStaffName}`}
            >
              ✓ Nhận ca K1
            </button>
          </div>
        )}
      </div>

      {/* Thông báo nhỏ gọn ngay dưới thanh Header (không mở popup) */}
      {feedback && (
        <div
          className={`absolute top-full mt-1.5 z-50 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 border ${
            feedback.type === "ok"
              ? "bg-emerald-950/95 text-emerald-300 border-emerald-700"
              : "bg-rose-950/95 text-rose-300 border-rose-700"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {showHandoverModal && (
        <ShiftHandoverModal
          currentUser={currentUser}
          shiftCode={attendance?.shiftCode || "SHIFT_1"}
          onClose={() => setShowHandoverModal(false)}
          onSuccess={async () => {
            setShowHandoverModal(false);
            showNotice("ok", "Đã gửi biên bản bàn giao Kho Tầng 1!");
            await handlePauseCheckOut(false);
          }}
        />
      )}

      {showFridayModal && (
        <FridayShiftRegistrationModal
          onClose={() => setShowFridayModal(false)}
          onSuccess={() => {
            setShowFridayModal(false);
            showNotice("ok", "Đã gửi đăng ký lịch ca tuần sau cho HR!");
          }}
        />
      )}
    </div>
  );
}

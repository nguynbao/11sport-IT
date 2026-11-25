import { useState, useEffect, useCallback, useRef } from "react";
import { StaffUser, AttendanceRecord } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useHeaderAttendanceBar(currentUser: StaffUser | null) {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [isEarlyApprovedToday, setIsEarlyApprovedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Đồng hồ đếm giờ làm việc trực tiếp trên Header
  const [elapsedText, setElapsedText] = useState<string>("00:00:00");
  const [isLunchPaused, setIsLunchPaused] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const showNotice = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role === "ADMIN" || currentUser.role === "CEO") return;
    setLoading(true);
    try {
      const todayRes = await apiRequest<{
        date: string;
        attendance: AttendanceRecord | null;
        isWfhToday: boolean;
        isEarlyApprovedToday?: boolean;
      }>("/attendance/today");
      setAttendance(todayRes.data.attendance);
      setIsWfhToday(Boolean(todayRes.data.isWfhToday));
      setIsEarlyApprovedToday(Boolean(todayRes.data.isEarlyApprovedToday));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
    const onChanged = () => loadData();
    window.addEventListener("attendance-changed", onChanged);
    return () => window.removeEventListener("attendance-changed", onChanged);
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

      // Kiểm tra giờ nghỉ trưa 12:00 - 13:00 (1 tiếng: sáng 08:30-12:00, chiều 13:00-17:30) đối với khối Văn phòng
      const lunchStart = new Date(endTime);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(endTime);
      lunchEnd.setHours(13, 0, 0, 0);

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

  const handlePlayCheckIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ attendance: AttendanceRecord; message: string }>(
        "/attendance/check-in",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      setAttendance(res.data.attendance);
      showNotice("ok", "Đã bắt đầu tính giờ ca làm việc!");
      window.dispatchEvent(new Event("attendance-changed"));
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể chấm công vào ca");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseCheckOut = async (forceEarly = false, earlyReason = "") => {
    if (actionLoading) return;

    const now = new Date();
    const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
    const isEnd21 = attendance?.shiftCode === "SHIFT_2" || attendance?.shiftCode === "BOTH";
    const shiftEndMinutes = isEnd21 ? 21 * 60 : 17 * 60 + 30;
    const shiftEndLabel = isEnd21 ? "21:00" : "17:30";

    if (totalMinutesNow < shiftEndMinutes && !isEarlyApprovedToday && !forceEarly) {
      const remain = shiftEndMinutes - totalMinutesNow;
      const rHours = Math.floor(remain / 60);
      const rMins = remain % 60;
      const remainStr = rHours > 0 ? `${rHours} giờ ${rMins} phút` : `${rMins} phút`;
      showNotice(
        "err",
        `Chưa đủ giờ kết thúc ca (${shiftEndLabel} - còn ${remainStr}), chưa thể Check-out!`
      );
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ attendance: AttendanceRecord; message: string }>(
        "/attendance/check-out",
        {
          method: "POST",
          body: JSON.stringify({
            forceEarly: forceEarly || isEarlyApprovedToday,
            earlyReason: earlyReason || (isEarlyApprovedToday ? "Đã được HR duyệt về sớm" : ""),
          }),
        }
      );
      setAttendance(res.data.attendance);
      showNotice("ok", `Đã kết thúc ca (${res.data.attendance.totalWorkHours}h)!`);
      window.dispatchEvent(new Event("attendance-changed"));
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể kết ca");
    } finally {
      setActionLoading(false);
    }
  };


  const isWorking = Boolean(attendance && !attendance.checkOutTime);
  const isCompleted = Boolean(attendance && attendance.checkOutTime);

  return {
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
  };
}

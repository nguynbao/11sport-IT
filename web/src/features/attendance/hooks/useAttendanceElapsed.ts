import { useState, useEffect } from "react";
import type { AttendanceData, StaffUser } from "@/shared/types";
import { localDateStr } from "../utils/localDate";

export function useAttendanceElapsed({
  attendance,
  setAttendance,
  currentUser,
}: {
  attendance: AttendanceData | null;
  setAttendance: (a: AttendanceData | null) => void;
  currentUser: StaffUser | null;
}) {
  const [elapsedText, setElapsedText] = useState<string>("00:00:00");
  const [isLunchPaused, setIsLunchPaused] = useState<boolean>(false);

  // Tính toán đồng hồ chạy trực tiếp mỗi giây khi đã Check-in
  // Khi nhân viên đã bấm xác nhận gửi bàn giao ca (pendingCheckOutTime đã ghi nhận), đồng hồ dừng đúng tại mốc bấm gửi!
  useEffect(() => {
    if (!attendance?.checkInTime) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      return;
    }

    if (attendance.date && attendance.date !== localDateStr()) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      setAttendance(null);
      return;
    }

    const computeElapsed = () => {
      if (!attendance.checkOutTime && attendance.date && attendance.date !== localDateStr()) {
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        setAttendance(null);
        return;
      }
      const startRaw = attendance.workStartTime || attendance.checkInTime;
      const startTime = new Date(startRaw);
      const lockedOutRaw = attendance.checkOutTime || attendance.pendingCheckOutTime;
      const endTime = lockedOutRaw ? new Date(lockedOutRaw) : new Date();

      const isOffice =
        currentUser?.department === "OFFICE" ||
        (currentUser?.role && currentUser.role !== "SALES");

      const lunchStart = new Date(endTime);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(endTime);
      lunchEnd.setHours(13, 0, 0, 0);

      let pausedNow = false;
      let effectiveEnd = endTime;
      let deductMs = 0;

      if (isOffice) {
        if (!lockedOutRaw && endTime >= lunchStart && endTime < lunchEnd) {
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
    if (!attendance.checkOutTime && !attendance.pendingCheckOutTime) {
      const timer = setInterval(computeElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [attendance, currentUser]);
  return { elapsedText, setElapsedText, isLunchPaused, setIsLunchPaused };
}

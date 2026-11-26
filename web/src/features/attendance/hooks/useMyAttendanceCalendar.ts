import { useState, useEffect, useCallback, useMemo } from "react";
import type { StaffUser, LeaveRequestType, MyCalendarCell, MyCalendarData, MyCalendarDay, MyShiftScheduleData } from "@/shared/types";
import { fetchMyCalendarApi, fetchMyShiftScheduleApi, markMyShiftScheduleSeenApi } from "../api";

export function useMyAttendanceCalendar({
  currentUser,
  onScheduleSeen,
}: {
  currentUser: StaffUser;
  onScheduleSeen?: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<MyCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ day: MyCalendarDay; cell: MyCalendarCell } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [leaveModal, setLeaveModal] = useState<{
    date?: string;
    fromDate?: string;
    sourceLeaveId?: string;
    type?: LeaveRequestType;
  } | null>(null);
  const [leaveReloadKey, setLeaveReloadKey] = useState(0);
  const [showShiftRegModal, setShowShiftRegModal] = useState(false);
  const [myShiftSchedule, setMyShiftSchedule] = useState<MyShiftScheduleData | null>(null);
  const [justSawConfirmedSchedule, setJustSawConfirmedSchedule] = useState(false);

  const isSalesStaff = currentUser.role === "SALES" || data?.row?.department === "SALES";

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const afterLeaveChange = (msg: string) => {
    notify(msg);
    setLeaveReloadKey((k) => k + 1);
    load();
  };

  const loadShiftSchedule = useCallback(async () => {
    if (currentUser.role !== "SALES") return;
    try {
      const sched = await fetchMyShiftScheduleApi();
      setMyShiftSchedule(sched);
      if (sched.hasUnseenConfirmedSchedule) {
        setJustSawConfirmedSchedule(true);
        await markMyShiftScheduleSeenApi();
        onScheduleSeen?.();
      }
    } catch {
      // ignore
    }
  }, [currentUser.role, onScheduleSeen]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMyCalendarApi(month, year));
    } catch (e: any) {
      setError(e?.message || "Không tải được lịch công");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (currentUser.role !== "ADMIN" && currentUser.role !== "CEO") {
      load();
      loadShiftSchedule();
    }
  }, [load, loadShiftSchedule, currentUser.role]);

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const isThisMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Lưới 6 tuần, bắt đầu từ Chủ nhật
  const grid = useMemo(() => {
    if (!data) return [];
    const first = new Date(year, month - 1, 1);
    const lead = first.getDay();
    const cells: (MyCalendarDay | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (const d of data.days) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [data, month, year]);

  const goThisMonth = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  return {
    month, year, data, loading, error, selected, setSelected, toast, notify,
    leaveModal, setLeaveModal, leaveReloadKey, showShiftRegModal, setShowShiftRegModal,
    myShiftSchedule, justSawConfirmedSchedule, isSalesStaff, afterLeaveChange,
    loadShiftSchedule, load, goPrev, goNext, goThisMonth, isThisMonth, grid,
  };
}

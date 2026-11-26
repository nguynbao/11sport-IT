
import { fetchLeaveRequests,reviewLeaveRequestApi } from "@/features/leave";
import { fetchShiftSchedule } from "@/features/shifts";
import { Holiday,LeaveRequest,StaffUser } from "@/shared/types";
import React,{ useEffect,useState } from "react";
import { createHolidayApi,deleteHolidayApi,fetchHolidays,syncVietnamHolidaysApi } from "../api";



type SubTab = "CALENDAR" | "LEAVE_REQUESTS" | "SHIFTS" | "ATTENDANCE_LOG" | "STAFF_ACCOUNTS";

export function useHrmAttendance({ currentUser }: { currentUser: StaffUser | null }) {
  const [activeTab, setActiveTab] = useState<SubTab>("CALENDAR");

  // Tab 1: Holidays & Monthly Calendar
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayNote, setHolidayNote] = useState("");
  const [holidayIsOfficial, setHolidayIsOfficial] = useState<boolean>(true);
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [syncingVn, setSyncingVn] = useState(false);

  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth()); // 0..11

  // Tab 2: Leave Requests
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reqFilterStatus, setReqFilterStatus] = useState<string>("ALL");
  const [reqFilterType, setReqFilterType] = useState<string>("ALL");
  const [reviewNoteInput, setReviewNoteInput] = useState<{ [id: string]: string }>({});


  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Số đơn đang chờ duyệt -> hiển thị chấm đỏ trên tab "Duyệt Đơn Từ & WFH"
  const [pendingCount, setPendingCount] = useState<number>(0);
  // Số nhân viên đã đăng ký ca tuần sau chờ HR xác nhận -> hiển thị chấm đỏ trên tab "Xếp Ca Tuần"
  const [pendingShiftStaffCount, setPendingShiftStaffCount] = useState<number>(0);

  const getNextMondayStr = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const refreshPendingCount = async () => {
    try {
      const list = await fetchLeaveRequests({ status: "PENDING" });
      setPendingCount(Array.isArray(list) ? list.length : 0);
    } catch {
      // bỏ qua lỗi mạng tạm thời
    }
    try {
      const nextMonday = getNextMondayStr();
      const sched = await fetchShiftSchedule(nextMonday);
      const staffIds = new Set(
        (sched.assignments || []).filter((a) => a.assignedBy === "AUTO").map((a) => String(a.staffId))
      );
      setPendingShiftStaffCount(staffIds.size);
    } catch {
      // bỏ qua lỗi mạng tạm thời
    }
  };
  useEffect(() => {
    refreshPendingCount();
    const timer = setInterval(refreshPendingCount, 60000);
    return () => clearInterval(timer);
  }, []);

  // Load data based on tab
  useEffect(() => {
    if (activeTab === "CALENDAR") {
      loadHolidays(calendarYear);
    } else if (activeTab === "LEAVE_REQUESTS") {
      loadRequests();
    }
  }, [activeTab, calendarYear, reqFilterStatus, reqFilterType]);

  const loadHolidays = async (yearParam = calendarYear) => {
    setLoading(true);
    try {
      const data = await fetchHolidays(yearParam);
      setHolidays(data);
    } catch (e: any) {
      showToast("Lỗi tải danh sách ngày lễ");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncVietnamHolidays = async () => {
    setSyncingVn(true);
    try {
      const res = await syncVietnamHolidaysApi(calendarYear);
      showToast(`Đã đồng bộ ${res.totalVietnamHolidays} ngày lễ Việt Nam năm ${calendarYear}`);
      await loadHolidays(calendarYear);
    } catch (err: any) {
      alert(err.message || "Lỗi đồng bộ ngày lễ Việt Nam");
    } finally {
      setSyncingVn(false);
    }
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName) return;
    setHolidayLoading(true);
    try {
      await createHolidayApi({
        date: holidayDate,
        name: holidayName,
        note: holidayNote,
        isOfficialDayOff: holidayIsOfficial,
      });
      showToast("Đã thêm ngày lễ mới thành công");
      setShowAddHolidayModal(false);
      setHolidayDate("");
      setHolidayName("");
      setHolidayNote("");
      setHolidayIsOfficial(true);
      loadHolidays(calendarYear);
    } catch (err: any) {
      alert(err.message || "Lỗi tạo ngày lễ");
    } finally {
      setHolidayLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa ngày lễ này?")) return;
    try {
      await deleteHolidayApi(id);
      showToast("Đã xóa ngày lễ");
      loadHolidays(calendarYear);
    } catch (err: any) {
      alert(err.message || "Lỗi xóa");
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (reqFilterStatus !== "ALL") params.status = reqFilterStatus;
      if (reqFilterType !== "ALL") params.type = reqFilterType;
      const data = await fetchLeaveRequests(params);
      setRequests(data);
      refreshPendingCount();
    } catch (e) {
      showToast("Lỗi tải danh sách đơn từ");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const note = reviewNoteInput[id] || "";
      await reviewLeaveRequestApi(id, status, note);
      showToast(status === "APPROVED" ? "Đã duyệt đơn" : "Đã từ chối đơn");
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Lỗi xử lý đơn");
    }
  };


  // Lưới lịch theo tháng (42 ô vuông bo cạnh: 6 hàng x 7 cột từ Chủ Nhật -> Thứ Bảy)
  const holidayMap = React.useMemo(() => {
    const m = new Map<string, Holiday>();
    for (const h of holidays) {
      if (h?.date) m.set(h.date, h);
    }
    return m;
  }, [holidays]);

  const calendarCells = React.useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 (Cn) -> 6 (T7)
    const gridStartDate = new Date(calendarYear, calendarMonth, 1 - startWeekday);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    return Array.from({ length: 42 }, (_, idx) => {
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + idx);
      const y = cellDate.getFullYear();
      const m = cellDate.getMonth() + 1;
      const d = cellDate.getDate();
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isCurrentMonth = cellDate.getMonth() === calendarMonth && y === calendarYear;
      const isToday = dateStr === todayStr;
      const weekday = cellDate.getDay();
      const holiday = holidayMap.get(dateStr);

      return {
        dateStr,
        dayNumber: d,
        monthNumber: m,
        yearNumber: y,
        isCurrentMonth,
        isToday,
        weekday,
        holiday,
      };
    });
  }, [calendarYear, calendarMonth, holidayMap]);

  const currentMonthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-`;
  const currentMonthHolidays = React.useMemo(
    () => holidays.filter((h) => h.date.startsWith(currentMonthPrefix)),
    [holidays, currentMonthPrefix]
  );
  const currentYearHolidays = React.useMemo(
    () => holidays.filter((h) => h.date.startsWith(`${calendarYear}-`)),
    [holidays, calendarYear]
  );

  // Kiểm tra chính xác Ngày Nghỉ Lễ Chính Thức (được tăng lương) vs Lễ Sự Kiện / Kỷ Niệm (không tăng lương)
  const checkIsOfficialHoliday = (h?: Holiday): boolean => {
    if (!h) return false;
    const mmdd = h.date.slice(5);
    const eventMmdd = ["03-08", "06-01", "10-20", "11-20", "12-24", "12-25", "02-14"];
    if (eventMmdd.includes(mmdd)) return false;
    if (/nguyên tiêu|vu lan|trung thu|phụ nữ|nhà giáo|thiếu nhi|giáng sinh|noel/i.test(h.name)) {
      return false;
    }
    if (typeof h.isOfficialDayOff === "boolean") {
      return h.isOfficialDayOff;
    }
    return true;
  };

  const officialCountInYear = React.useMemo(
    () => currentYearHolidays.filter((h) => checkIsOfficialHoliday(h)).length,
    [currentYearHolidays]
  );
  const eventCountInYear = currentYearHolidays.length - officialCountInYear;


  return {
    currentUser,
    activeTab,
    setActiveTab,
    holidayDate,
    setHolidayDate,
    holidayName,
    setHolidayName,
    holidayNote,
    setHolidayNote,
    holidayIsOfficial,
    setHolidayIsOfficial,
    showAddHolidayModal,
    setShowAddHolidayModal,
    holidayLoading,
    syncingVn,
    calendarYear,
    setCalendarYear,
    calendarMonth,
    setCalendarMonth,
    requests,
    reqFilterStatus,
    setReqFilterStatus,
    reqFilterType,
    setReqFilterType,
    loading,
    toastMessage,
    pendingCount,
    pendingShiftStaffCount,
    refreshPendingCount,
    handleSyncVietnamHolidays,
    handlePrevMonth,
    handleNextMonth,
    handleGoToday,
    handleCreateHoliday,
    handleDeleteHoliday,
    handleReviewRequest,
    calendarCells,
    currentMonthHolidays,
    currentYearHolidays,
    checkIsOfficialHoliday,
    officialCountInYear,
    eventCountInYear,
  };
}

export type HrmAttendanceViewModel = ReturnType<typeof useHrmAttendance>;

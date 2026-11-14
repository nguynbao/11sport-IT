"use client";

import React, { useState, useEffect } from "react";
import {
  Holiday,
  LeaveRequest,
  StaffUser,
  fetchHolidays,
  syncVietnamHolidaysApi,
  createHolidayApi,
  deleteHolidayApi,
  fetchLeaveRequests,
  reviewLeaveRequestApi,
  fetchShiftSchedule,
} from "@/lib/api";
import StaffModule from "./StaffModule";
import AttendanceTimesheetModule from "./AttendanceTimesheetModule";
import ShiftScheduleModule from "./ShiftScheduleModule";
import MyAttendanceCalendar from "./MyAttendanceCalendar";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  FileText,
  Plus,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  Home,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  CalendarCheck,
} from "lucide-react";

type SubTab = "CALENDAR" | "LEAVE_REQUESTS" | "SHIFTS" | "ATTENDANCE_LOG" | "STAFF_ACCOUNTS" | "MY_CALENDAR";

export default function HrmAttendanceModule({ currentUser }: { currentUser: StaffUser | null }) {
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

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("CALENDAR")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "CALENDAR"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Lịch Công ty & Ngày Lễ
        </button>

        <button
          onClick={() => setActiveTab("LEAVE_REQUESTS")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "LEAVE_REQUESTS"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <FileText className="w-4 h-4" />
          Duyệt Đơn Từ & WFH
          {pendingCount > 0 && (
            <span
              title={`${pendingCount} đơn đang chờ duyệt`}
              className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black leading-none shadow"
            >
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative">{pendingCount > 99 ? "99+" : pendingCount}</span>
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("SHIFTS")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "SHIFTS"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <Users className="w-4 h-4" />
          Xếp Ca Tuần
          {pendingShiftStaffCount > 0 && (
            <span
              title={`${pendingShiftStaffCount} nhân viên đã đăng ký ca tuần sau chờ HR xác nhận`}
              className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black leading-none shadow"
            >
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative">{pendingShiftStaffCount > 99 ? "99+" : pendingShiftStaffCount}</span>
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ATTENDANCE_LOG")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "ATTENDANCE_LOG"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <Clock className="w-4 h-4" />
          Bảng Chấm Công Toàn Cty
        </button>

        <button
          onClick={() => setActiveTab("STAFF_ACCOUNTS")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "STAFF_ACCOUNTS"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <UserPlus className="w-4 h-4" />
          Tạo Tài Khoản & Hồ Sơ NV
        </button>

        {currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "CEO" && (
          <button
            onClick={() => setActiveTab("MY_CALENDAR")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "MY_CALENDAR"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
              }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Lịch Chấm Công Của Tôi
          </button>
        )}
      </div>

      {/* ================= TAB 1: CALENDAR & HOLIDAYS ================= */}
      {activeTab === "CALENDAR" && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
          {/* Header gọn gàng */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Lịch Công Ty & Ngày Lễ
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncVietnamHolidays}
                disabled={syncingVn}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {syncingVn ? "Đang đồng bộ..." : `Đồng bộ Lễ VN ${calendarYear}`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setHolidayDate(
                    `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-01`
                  );
                  setHolidayName("");
                  setHolidayNote("");
                  setShowAddHolidayModal(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Ngày Lễ
              </button>
            </div>
          </div>

          {/* Bố cục 2 cột: Bên trái là Cuốn lịch tháng thu gọn, Bên phải là Danh sách ngày lễ trong năm */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* CỘT TRÁI (7/12): CUỐN LỊCH THEO THÁNG NHỎ GỌN */}
            <div className="lg:col-span-7 xl:col-span-8 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
              {/* Thanh điều hướng Tháng / Năm */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Tháng {calendarMonth + 1}, {calendarYear}
                  </h3>
                  {currentMonthHolidays.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
                      {currentMonthHolidays.length} lễ
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGoToday}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Hôm nay
                  </button>

                  <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      title="Tháng trước"
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      title="Tháng sau"
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Hàng thứ: Cn T2 T3 T4 T5 T6 T7 */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {["Cn", "T2", "T3", "T4", "T5", "T6", "T7"].map((dayLabel, idx) => (
                  <div
                    key={dayLabel}
                    className={`py-1 text-[11px] font-bold uppercase tracking-wider ${idx === 0
                      ? "text-rose-600"
                      : idx === 6
                        ? "text-amber-700"
                        : "text-slate-500"
                      }`}
                  >
                    {dayLabel}
                  </div>
                ))}
              </div>

              {/* Lưới 42 ô vuông bo cạnh thu gọn */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell) => {
                  const hasHoliday = Boolean(cell.holiday);
                  const isOfficial = checkIsOfficialHoliday(cell.holiday);

                  return (
                    <div
                      key={cell.dateStr}
                      title={
                        hasHoliday && cell.holiday
                          ? `${cell.holiday.name} (${isOfficial
                            ? "Nghỉ lễ chính thức - Được tính tăng lương"
                            : "Lễ sự kiện / Kỷ niệm - Không tăng lương"
                          })`
                          : `Ngày ${cell.dayNumber}/${cell.monthNumber}/${cell.yearNumber}`
                      }
                      onClick={() => {
                        if (!hasHoliday) {
                          setHolidayDate(cell.dateStr);
                          setHolidayName("");
                          setHolidayNote("");
                          setHolidayIsOfficial(true);
                          setShowAddHolidayModal(true);
                        }
                      }}
                      className={`group relative overflow-hidden rounded-xl p-1.5 sm:p-2 h-[66px] sm:h-[76px] flex flex-col justify-between transition ${!cell.isCurrentMonth
                        ? "bg-slate-100/40 border border-slate-200/80 text-slate-300 opacity-65"
                        : hasHoliday
                          ? isOfficial
                            ? "bg-rose-50 border-2 border-rose-400 hover:border-rose-500 shadow-2xs"
                            : "bg-amber-50/85 border-2 border-amber-400 hover:border-amber-500 shadow-2xs"
                          : cell.isToday
                            ? "bg-blue-50/80 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                            : "bg-white border-2 border-slate-300 hover:border-emerald-500 shadow-2xs cursor-pointer"
                        }`}
                    >
                      {/* Label chéo góc trên phải rõ nét: phân biệt LỄ (Đỏ) vs SỰ KIỆN (Vàng cam) */}
                      {hasHoliday && (
                        <div
                          className={`pointer-events-none absolute top-[7px] -right-[22px] w-[76px] text-center py-[1.5px] text-[7px] leading-tight font-black uppercase tracking-tight text-white rotate-45 shadow-2xs ${isOfficial ? "bg-rose-600" : "bg-amber-500"
                            }`}
                        >
                          {isOfficial ? "Lễ" : "Sự kiện"}
                        </div>
                      )}

                      {/* Số ngày Dương lịch */}
                      <div className="flex items-center justify-between z-10">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cell.isToday
                            ? "bg-blue-600 text-white shadow-2xs"
                            : !cell.isCurrentMonth
                              ? "text-slate-300 font-medium"
                              : hasHoliday
                                ? isOfficial
                                  ? "text-rose-700 font-extrabold"
                                  : "text-amber-800 font-extrabold"
                                : cell.weekday === 0
                                  ? "text-rose-600"
                                  : "text-slate-700"
                            }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {hasHoliday && cell.holiday && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHoliday(cell.holiday!._id);
                            }}
                            title="Xóa ngày lễ"
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-white/90 text-slate-400 hover:text-rose-600 transition z-20 mr-3 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Tên ngày lễ gọn 1 dòng */}
                      <div className="z-10">
                        {hasHoliday && cell.holiday ? (
                          <div
                            className={`text-[10px] font-bold truncate leading-tight ${isOfficial ? "text-rose-800" : "text-amber-900"
                              }`}
                          >
                            {cell.holiday.name}
                          </div>
                        ) : cell.isToday ? (
                          <div className="text-[9px] font-bold text-blue-600 truncate">
                            Hôm nay
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chú thích nhỏ dưới chân lịch */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                    Nghỉ lễ chính thức
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    Lễ sự kiện / Kỷ niệm
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Hôm nay
                  </span>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (5/12): DANH SÁCH NGÀY LỄ TRONG NĂM THU GỌN */}
            <div className="lg:col-span-5 xl:col-span-4 border border-slate-200/90 rounded-2xl bg-white overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                  Ngày lễ năm {calendarYear}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                    {officialCountInYear} lễ chính thức
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {eventCountInYear} sự kiện
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  Đang tải lịch ngày lễ...
                </div>
              ) : currentYearHolidays.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  Chưa có ngày lễ nào trong năm {calendarYear}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                  {currentYearHolidays.map((h) => {
                    const [yStr, mStr, dStr] = h.date.split("-");
                    const hMonth = Number(mStr) - 1;
                    const isSelectedMonth = hMonth === calendarMonth;
                    const isOfficial = checkIsOfficialHoliday(h);

                    return (
                      <div
                        key={h._id}
                        onClick={() => {
                          setCalendarYear(Number(yStr));
                          setCalendarMonth(hMonth);
                        }}
                        className={`group px-3.5 py-2.5 flex items-center justify-between gap-2 transition cursor-pointer ${isSelectedMonth
                          ? isOfficial
                            ? "bg-rose-50/40 hover:bg-rose-50/80"
                            : "bg-amber-50/40 hover:bg-amber-50/80"
                          : "hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`shrink-0 w-11 py-1 text-center text-[11px] font-extrabold rounded-lg border ${isOfficial
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                          >
                            {dStr}/{mStr}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {h.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${isOfficial
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-800"
                                  }`}
                              >
                                {isOfficial ? "Chính thức" : "Sự kiện"}
                              </span>
                              {h.lunarDate && (
                                <span className="text-slate-400 font-medium">{h.lunarDate}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHoliday(h._id);
                          }}
                          title="Xóa ngày lễ"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Thêm ngày lễ */}
          {showAddHolidayModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Thêm Ngày Lễ Mới</h3>
                  <button
                    onClick={() => setShowAddHolidayModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateHoliday} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày áp dụng (YYYY-MM-DD) *
                    </label>
                    <input
                      type="date"
                      required
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phân loại ngày lễ *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHolidayIsOfficial(true)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${holidayIsOfficial
                          ? "bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500/30"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                          Nghỉ lễ chính thức
                        </div>
                        <div className="text-[10px] text-rose-700 mt-0.5 font-medium">
                          Được tính tăng lương
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHolidayIsOfficial(false)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${!holidayIsOfficial
                          ? "bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500/30"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                          Lễ sự kiện / Kỷ niệm
                        </div>
                        <div className="text-[10px] text-amber-800 mt-0.5 font-medium">
                          Không tính tăng lương
                        </div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên ngày lễ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nghỉ Du Lịch Công Ty, Tết Dương Lịch..."
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú</label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú thêm về ngày nghỉ..."
                      value={holidayNote}
                      onChange={(e) => setHolidayNote(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddHolidayModal(false)}
                      className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={holidayLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                    >
                      {holidayLoading ? "Đang lưu..." : "Lưu Ngày Lễ"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: LEAVE REQUESTS ================= */}
      {activeTab === "LEAVE_REQUESTS" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-600" />
                Phê Duyệt Đơn Từ (WFH, Nghỉ phép, Đổi ngày off, Đi trễ/Về sớm)
              </h2>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={reqFilterType}
                onChange={(e) => setReqFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
              >
                <option value="ALL">Tất cả loại đơn</option>
                <option value="WFH">Làm việc từ xa (WFH)</option>
                <option value="OFF">Xin nghỉ (OFF)</option>
                <option value="PAID_LEAVE">Nghỉ phép có lương</option>
                <option value="CHANGE_OFF">Xin chuyển ngày off</option>
                <option value="LATE">Xin đi trễ</option>
                <option value="EARLY">Xin về sớm</option>
              </select>

              <select
                value={reqFilterStatus}
                onChange={(e) => setReqFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải danh sách đơn từ...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Không có đơn nào phù hợp bộ lọc.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Ngày xin</th>
                    <th className="py-3 px-4">Nhân viên</th>
                    <th className="py-3 px-4">Khối</th>
                    <th className="py-3 px-4">Loại đơn</th>
                    <th className="py-3 px-4">Lý do</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {r.type === "CHANGE_OFF" && r.fromDate ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-slate-500">
                              Từ: <span className="line-through">{r.fromDate}</span>
                            </div>
                            <div className="text-indigo-700 font-bold">
                              → Sang: {r.date}
                            </div>
                          </div>
                        ) : (
                          r.date
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{r.staffName}</div>
                        <div className="text-xs text-slate-400 font-mono">{r.staffCode}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.department === "OFFICE"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-amber-50 text-amber-700"
                            }`}
                        >
                          {r.department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${r.type === "WFH"
                            ? "bg-purple-100 text-purple-800"
                            : r.type === "PAID_LEAVE"
                              ? "bg-teal-100 text-teal-800"
                              : r.type === "CHANGE_OFF"
                                ? "bg-indigo-100 text-indigo-800"
                                : r.type === "OFF"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {r.type === "WFH"
                            ? "🏠 Làm việc từ xa (WFH)"
                            : r.type === "PAID_LEAVE"
                              ? "Nghỉ phép có lương"
                              : r.type === "CHANGE_OFF"
                                ? `🔄 Xin chuyển ngày off (${r.sourceOffType === "PAID_LEAVE" ? "Phép" : "OFF"})`
                                : r.type === "OFF"
                                  ? "Xin nghỉ không lương"
                                  : r.type === "LATE"
                                    ? "Đi trễ"
                                    : "Về sớm"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 w-[260px] max-w-[260px]">
                        <p className="line-clamp-2 break-all text-slate-700" title={r.reason}>
                          {r.reason}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {r.status === "APPROVED"
                            ? "✓ Đã duyệt"
                            : r.status === "REJECTED"
                              ? "✕ Từ chối"
                              : "⏳ Chờ duyệt"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {r.status === "PENDING" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleReviewRequest(r._id, "APPROVED")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" /> Duyệt
                            </button>
                            <button
                              onClick={() => handleReviewRequest(r._id, "REJECTED")}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" /> Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {r.reviewedBy ? `Duyệt bởi: ${r.reviewedBy}` : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: XẾP CA TUẦN (Sửa / Lưu) ================= */}
      {activeTab === "SHIFTS" && <ShiftScheduleModule onScheduleUpdated={refreshPendingCount} />}

      {/* ================= TAB 4: BẢNG CHẤM CÔNG THÁNG TOÀN CÔNG TY ================= */}
      {activeTab === "ATTENDANCE_LOG" && <AttendanceTimesheetModule />}

      {/* ================= TAB 4.5: QUẢN LÝ PHIẾU BÀN GIAO CA ================= */}

      {/* ================= TAB 5: TẠO TÀI KHOẢN & QUẢN LÝ NHÂN SỰ ================= */}
      {activeTab === "STAFF_ACCOUNTS" && <StaffModule mode="HR_FULL" currentUser={currentUser} />}

      {/* ================= TAB 6: LỊCH CHẤM CÔNG CÁ NHÂN CỦA TÔI (DÀNH CHO HR) ================= */}
      {activeTab === "MY_CALENDAR" && currentUser && <MyAttendanceCalendar currentUser={currentUser} />}
    </div>
  );
}

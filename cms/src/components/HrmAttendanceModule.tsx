"use client";

import React, { useState, useEffect } from "react";
import {
  Holiday,
  LeaveRequest,
  ShiftAssignment,
  AttendanceRecord,
  StaffUser,
  fetchHolidays,
  createHolidayApi,
  deleteHolidayApi,
  fetchLeaveRequests,
  reviewLeaveRequestApi,
  fetchShiftSchedule,
  assignShiftApi,
  fetchAttendanceHistory,
} from "@/lib/api";
import StaffModule from "./StaffModule";
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
} from "lucide-react";

type SubTab = "CALENDAR" | "LEAVE_REQUESTS" | "SHIFTS" | "ATTENDANCE_LOG" | "STAFF_ACCOUNTS";

export default function HrmAttendanceModule({ currentUser }: { currentUser: StaffUser | null }) {
  const [activeTab, setActiveTab] = useState<SubTab>("CALENDAR");

  // Tab 1: Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayNote, setHolidayNote] = useState("");
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);

  // Tab 2: Leave Requests
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reqFilterStatus, setReqFilterStatus] = useState<string>("ALL");
  const [reqFilterType, setReqFilterType] = useState<string>("ALL");
  const [reviewNoteInput, setReviewNoteInput] = useState<{ [id: string]: string }>({});

  // Tab 3: Shift Scheduling
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Thứ Hai tuần này
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().slice(0, 10);
  });
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [salesStaffList, setSalesStaffList] = useState<StaffUser[]>([]);
  const [draggedStaff, setDraggedStaff] = useState<StaffUser | null>(null);

  // Tab 4: Attendance Log
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [logFilterDate, setLogFilterDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load data based on tab
  useEffect(() => {
    if (activeTab === "CALENDAR") {
      loadHolidays();
    } else if (activeTab === "LEAVE_REQUESTS") {
      loadRequests();
    } else if (activeTab === "SHIFTS") {
      loadShifts();
    } else if (activeTab === "ATTENDANCE_LOG") {
      loadAttendance();
    }
  }, [activeTab, weekStart]);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await fetchHolidays();
      setHolidays(data);
    } catch (e: any) {
      showToast("Lỗi tải danh sách ngày lễ");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName) return;
    setHolidayLoading(true);
    try {
      await createHolidayApi({ date: holidayDate, name: holidayName, note: holidayNote });
      showToast("Đã thêm ngày lễ mới thành công");
      setShowAddHolidayModal(false);
      setHolidayDate("");
      setHolidayName("");
      setHolidayNote("");
      loadHolidays();
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
      loadHolidays();
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

  const loadShifts = async () => {
    setLoading(true);
    try {
      const res = await fetchShiftSchedule(weekStart);
      setAssignments(res.assignments);
      setSalesStaffList(res.staffList.filter((s) => s.role === "SALES" || s.department === "SALES"));
    } catch (e) {
      showToast("Lỗi tải lịch làm việc");
    } finally {
      setLoading(false);
    }
  };

  const handleDropShift = async (dateStr: string, dayOfWeek: number, shiftCode: "SHIFT_1" | "SHIFT_2" | "OFF") => {
    if (!draggedStaff) return;
    try {
      await assignShiftApi({
        staffId: draggedStaff._id,
        date: dateStr,
        weekStart,
        dayOfWeek,
        shiftCode,
      });
      showToast(`Đã phân ${draggedStaff.fullName} vào ${shiftCode === "SHIFT_1" ? "Ca 1" : shiftCode === "SHIFT_2" ? "Ca 2" : "Nghỉ"}`);
      loadShifts();
    } catch (err: any) {
      alert(err.message || "Lỗi phân ca");
    } finally {
      setDraggedStaff(null);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const data = await fetchAttendanceHistory();
      setAttendanceLogs(data);
    } catch (e) {
      showToast("Lỗi tải lịch sử chấm công");
    } finally {
      setLoading(false);
    }
  };

  // Tạo 7 ngày trong tuần từ weekStart
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const base = new Date(weekStart);
    base.setDate(base.getDate() + i);
    const dateStr = base.toISOString().slice(0, 10);
    const dayNames = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
    return {
      index: i + 1,
      name: dayNames[i],
      dateStr,
      displayDate: `${base.getDate()}/${base.getMonth() + 1}`,
    };
  });

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
      </div>

      {/* ================= TAB 1: CALENDAR & HOLIDAYS ================= */}
      {activeTab === "CALENDAR" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-emerald-600" />
                Cấu Hình Lịch Ngày Lễ & Ghi Chú
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Các ngày lễ được cấu hình ở đây sẽ hiển thị tên ngày lễ ghi chú bên dưới trên lịch toàn công ty.
              </p>
            </div>
            <button
              onClick={() => setShowAddHolidayModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm Ngày Lễ Mới
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải danh sách ngày lễ...</div>
          ) : holidays.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Chưa có ngày lễ nào được cấu hình trong năm.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidays.map((h) => (
                <div
                  key={h._id}
                  className="p-5 rounded-2xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 transition relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg uppercase tracking-wide">
                        {h.date}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-2.5">{h.name}</h3>
                      {h.note && <p className="text-xs text-slate-500 mt-1">{h.note}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h._id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 rounded-lg transition"
                      title="Xóa ngày lễ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                      Tên ngày lễ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Tết Dương Lịch, Quốc Khánh 2/9..."
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
                Phê Duyệt Đơn Từ (WFH, Nghỉ phép, Đi trễ/Về sớm)
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Khi đơn WFH được HR duyệt, nhân viên khối Văn phòng sẽ được phép chấm công từ xa mà không bị chặn GPS/LAN.
              </p>
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
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{r.date}</td>
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${r.type === "WFH"
                            ? "bg-purple-100 text-purple-800"
                            : r.type === "OFF"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {r.type === "WFH"
                            ? "🏠 Làm việc từ xa (WFH)"
                            : r.type === "OFF"
                              ? "Xin nghỉ (OFF)"
                              : r.type === "LATE"
                                ? "Đi trễ"
                                : "Về sớm"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">{r.reason}</td>
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

      {/* ================= TAB 3: DRAG & DROP SHIFTS ================= */}
      {activeTab === "SHIFTS" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                Xếp Ca Tuần Cho Khối Bán Hàng
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Kéo thẻ nhân viên từ cột danh sách bên phải thả vào ô Ca 1 hoặc Ca 2 để phân ca trực showroom.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Tuần bắt đầu:</span>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Ma trận 7 ngày (3 cột đầu) */}
            <div className="lg:col-span-3 overflow-x-auto">
              <div className="min-w-[700px] border border-slate-200 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-100 text-slate-800 text-center font-bold text-xs py-3 border-b border-slate-200">
                  {daysOfWeek.map((d) => (
                    <div key={d.dateStr}>
                      <div>{d.name}</div>
                      <div className="text-slate-400 font-normal font-mono">{d.displayDate}</div>
                    </div>
                  ))}
                </div>

                {/* Hàng Ca 1 */}
                <div className="border-b border-slate-200 bg-amber-50/20">
                  <div className="p-2 text-xs font-bold text-amber-800 bg-amber-100/60 uppercase tracking-wider">
                    Ca 1: 08:30 - 17:30
                  </div>
                  <div className="grid grid-cols-7 min-h-[110px] divide-x divide-slate-200">
                    {daysOfWeek.map((d) => {
                      const assignedHere = assignments.filter(
                        (a) => a.date === d.dateStr && a.shiftCode === "SHIFT_1"
                      );
                      return (
                        <div
                          key={`ca1-${d.dateStr}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropShift(d.dateStr, d.index, "SHIFT_1")}
                          className="p-2 space-y-1.5 hover:bg-amber-100/30 transition flex flex-col items-center justify-start"
                        >
                          {assignedHere.map((a) => (
                            <div
                              key={a._id}
                              className="w-full bg-white border border-amber-200 rounded-lg p-1.5 text-center shadow-xs text-xs font-semibold text-slate-800"
                            >
                              {a.staffName}
                            </div>
                          ))}
                          <div className="text-[10px] text-slate-300 italic pointer-events-none mt-auto">
                            + Kéo thả vào đây
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hàng Ca 2 */}
                <div className="bg-indigo-50/20">
                  <div className="p-2 text-xs font-bold text-indigo-800 bg-indigo-100/60 uppercase tracking-wider">
                    Ca 2: 12:00 - 21:00
                  </div>
                  <div className="grid grid-cols-7 min-h-[110px] divide-x divide-slate-200">
                    {daysOfWeek.map((d) => {
                      const assignedHere = assignments.filter(
                        (a) => a.date === d.dateStr && a.shiftCode === "SHIFT_2"
                      );
                      return (
                        <div
                          key={`ca2-${d.dateStr}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropShift(d.dateStr, d.index, "SHIFT_2")}
                          className="p-2 space-y-1.5 hover:bg-indigo-100/30 transition flex flex-col items-center justify-start"
                        >
                          {assignedHere.map((a) => (
                            <div
                              key={a._id}
                              className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-center shadow-xs text-xs font-semibold text-slate-800"
                            >
                              {a.staffName}
                            </div>
                          ))}
                          <div className="text-[10px] text-slate-300 italic pointer-events-none mt-auto">
                            + Kéo thả vào đây
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar danh sách nhân sự kéo thả */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Nhân Sự Showroom
              </h3>
              <p className="text-xs text-slate-500">Giữ chuột và kéo nhân viên vào các ô ca trong bảng tuần.</p>

              <div className="space-y-2">
                {salesStaffList.map((s) => (
                  <div
                    key={s._id}
                    draggable
                    onDragStart={() => setDraggedStaff(s)}
                    className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs cursor-grab active:cursor-grabbing hover:border-emerald-500 hover:shadow-md transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{s.fullName}</div>
                      <div className="text-xs text-slate-400 font-mono">{s.code}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                      Sales
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: ATTENDANCE LOG ================= */}
      {activeTab === "ATTENDANCE_LOG" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-emerald-600" />
                Nhật Ký Chấm Công Toàn Công Ty
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Theo dõi thời gian vào/ra, tính toán giờ làm việc tự động trừ nghỉ trưa và trạng thái WFH.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Đang tải nhật ký chấm công...</div>
          ) : attendanceLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Chưa có dữ liệu chấm công.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Ngày</th>
                    <th className="py-3 px-4">Nhân viên</th>
                    <th className="py-3 px-4">Phòng ban</th>
                    <th className="py-3 px-4">Ca</th>
                    <th className="py-3 px-4">Giờ vào</th>
                    <th className="py-3 px-4">Giờ ra</th>
                    <th className="py-3 px-4">Tổng giờ</th>
                    <th className="py-3 px-4">Hình thức</th>
                    <th className="py-3 px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceLogs.map((log) => {
                    const inTime = log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "-";
                    const outTime = log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Chưa ra";
                    return (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{log.date}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{log.staffName}</div>
                          <div className="text-xs text-slate-400 font-mono">{log.staffCode}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${log.department === "OFFICE"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-amber-50 text-amber-700"
                              }`}
                          >
                            {log.department === "OFFICE" ? "Văn phòng" : "Bán hàng"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {log.shiftCode === "SHIFT_1" ? "Ca 1 (8h30-17h30)" : "Ca 2 (12h-21h)"}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{inTime}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{outTime}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                          {log.totalWorkHours > 0 ? `${log.totalWorkHours}h` : "-"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${log.checkInType === "WFH"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {log.checkInType === "WFH" ? "🏠 WFH" : "Showroom/LAN"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${log.status === "ON_TIME" || log.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {log.status === "ON_TIME"
                              ? "Đúng giờ"
                              : log.status === "LATE"
                                ? `Trễ ${log.lateMinutes}p`
                                : log.status === "EARLY_LEAVE"
                                  ? `Về sớm ${log.earlyMinutes}p`
                                  : "Hoàn tất"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: TẠO TÀI KHOẢN & QUẢN LÝ NHÂN SỰ ================= */}
      {activeTab === "STAFF_ACCOUNTS" && <StaffModule />}
    </div>
  );
}

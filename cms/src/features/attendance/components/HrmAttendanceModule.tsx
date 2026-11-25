"use client";


import { ShiftScheduleModule } from "@/features/shifts";
import { StaffModule } from "@/features/staff";
import { StaffUser } from "@/shared/types";
import {
Calendar as CalendarIcon,
Check,
CheckCircle2,
Clock,
FileText,
UserPlus,
Users,
X
} from "lucide-react";
import { useHrmAttendance } from "../hooks/useHrmAttendance";
import AttendanceTimesheetModule from "./AttendanceTimesheetModule";
import { HrmHolidaysTab } from "./HrmHolidaysTab";

export default function HrmAttendanceModule(props: { currentUser: StaffUser | null }) {
  const vm = useHrmAttendance(props);
  const {
    currentUser,
    activeTab,
    setActiveTab,
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
    handleReviewRequest,
  } = vm;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-teal-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("CALENDAR")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "CALENDAR"
            ? "bg-teal-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Lịch Công ty & Ngày Lễ
        </button>

        <button
          onClick={() => setActiveTab("LEAVE_REQUESTS")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "LEAVE_REQUESTS"
            ? "bg-teal-600 text-white shadow-md"
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
            ? "bg-teal-600 text-white shadow-md"
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
            ? "bg-teal-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <Clock className="w-4 h-4" />
          Bảng Chấm Công Toàn Cty
        </button>

        <button
          onClick={() => setActiveTab("STAFF_ACCOUNTS")}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${activeTab === "STAFF_ACCOUNTS"
            ? "bg-teal-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
            }`}
        >
          <UserPlus className="w-4 h-4" />
          Tạo Tài Khoản & Hồ Sơ NV
        </button>
      </div>

      <HrmHolidaysTab vm={vm} />
      {/* ================= TAB 2: LEAVE REQUESTS ================= */}
      {activeTab === "LEAVE_REQUESTS" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-brand-ink" />
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
                            <div className="text-brand-ink font-bold">
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
                            ? "bg-indigo-50 text-brand-ink"
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
                              ? "bg-teal-100 text-brand-ink"
                              : r.type === "CHANGE_OFF"
                                ? "bg-indigo-100 text-brand-ink"
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
                            ? "bg-teal-100 text-brand-ink"
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
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
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
    </div>
  );
}


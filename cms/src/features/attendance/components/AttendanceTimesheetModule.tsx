"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import {
Activity,
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronLeft,
ChevronRight,
Clock,
LayoutGrid,
ListChecks,
LogOut,
Plus,
RefreshCw,
Search,
Users,
UserX
} from "lucide-react";
import { useAttendanceTimesheet } from "../hooks/useAttendanceTimesheet";
import {
formatMinutes
} from "../timesheet.constants";
import { ManualAttendanceModal } from "./ManualAttendanceModal";
import { CellDetailModal } from "./TimesheetCellDetailModal";
import { KpiCard } from "./TimesheetKpiCard";
import { MatrixView } from "./TimesheetMatrixView";
import { SummaryView } from "./TimesheetSummaryView";
import { PaginationBar } from "@/shared/ui/PaginationBar";


export default function AttendanceTimesheetModule() {
  const vm = useAttendanceTimesheet();
  const {
    month,
    year,
    department,
    setDepartment,
    search,
    setSearch,
    issueFilter,
    setIssueFilter,
    view,
    setView,
    data,
    loading,
    error,
    toast,
    editTarget,
    setEditTarget,
    showManual,
    setShowManual,
    exportScope,
    setExportScope,
    showToast,
    load,
    goPrev,
    goNext,
    goThisMonth,
    filteredRows,
    totals,
    monthInfo,
    handleExport,
    overview,
    isCurrentMonth,
  } = vm;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-400" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-brand-ink" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Bảng Chấm Công Toàn Công Ty</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Chấm công bù
          </button>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <div className="relative">
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                title="Chọn chế độ xuất Excel Bảng chấm công"
              >
                <option value="ALL">Xuất Tổng + Từng người (Đầy đủ)</option>
                <option value="SUMMARY">Chỉ xuất Tổng (Tổng hợp & Ma trận)</option>
                <option value="INDIVIDUAL_ALL">Chỉ xuất Từng người (Toàn bộ NV)</option>
                {filteredRows.map((r) => (
                  <option key={r.staffId} value={`STAFF:${r.staffId}`}>
                    Từng người: {r.staffCode} – {r.staffName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <ExportExcelButton onExport={handleExport} disabled={!data || filteredRows.length === 0} />
          </div>
        </div>
      </div>

      {/* KPI hôm nay & tháng */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Tổng nhân sự"
          value={overview?.totalStaff ?? "-"}
          tone="slate"
        />
        <KpiCard
          icon={<Activity className="w-4 h-4" />}
          label="Đang làm việc"
          value={isCurrentMonth ? overview?.workingNow ?? "-" : "-"}
          sub={isCurrentMonth ? `${overview?.checkedInToday ?? 0} đã check-in hôm nay` : "Chỉ áp dụng tháng hiện tại"}
          tone="blue"
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="Đi trễ hôm nay"
          value={isCurrentMonth ? overview?.lateToday ?? "-" : "-"}
          tone="amber"
        />
        <KpiCard
          icon={<UserX className="w-4 h-4" />}
          label="Chưa check-in hôm nay"
          value={isCurrentMonth ? overview?.notCheckedInToday ?? "-" : "-"}
          tone="rose"
        />
        <KpiCard
          icon={<LogOut className="w-4 h-4" />}
          label="Quên check-out (tháng)"
          value={overview?.missingCheckoutMonth ?? "-"}
          sub="Cần HR điều chỉnh"
          tone="red"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Vắng không phép (tháng)"
          value={overview?.absentMonth ?? "-"}
          tone="rose"
        />
      </div>

      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Chọn tháng */}
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={goPrev}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-extrabold text-slate-900 min-w-[110px] text-center">
              Tháng {month}/{year}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goThisMonth}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Tháng này
            </button>
          )}
          {monthInfo && (
            <div
              className="px-2.5 py-1.5 rounded-lg bg-teal-50/80 border border-teal-200 text-[11px] font-semibold text-teal-900 flex flex-wrap items-center gap-1.5"
              title="1 tuần làm việc 6 ngày (nghỉ 1 ngày/tuần). Tổng số công chuẩn thay đổi theo số ngày của tháng (28, 29, 30, 31 ngày) và số Chủ nhật (4 hoặc 5 CN) trong tháng."
            >
              <span>
                Chuẩn tháng: <b>{monthInfo.standardDays} công</b>
              </span>
              <span className="text-brand-ink font-normal">
                ({monthInfo.daysInMonth} ngày
                {month === 2 ? (monthInfo.isLeapYear ? " • Năm nhuận" : " • Không nhuận") : ""} −{" "}
                {monthInfo.sundaysCount} CN)
              </span>
              {monthInfo.officePaidHolidaysCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-bold">
                  VP +{monthInfo.officePaidHolidaysCount} công lễ
                </span>
              )}
            </div>
          )}

          {/* Khối */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
            {(
              [
                ["ALL", "Tất cả"],
                ["OFFICE", "Văn phòng"],
                ["SALES", "Bán hàng"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDepartment(val)}
                className={`px-2.5 py-1.5 rounded-md transition cursor-pointer ${department === val ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lọc vấn đề */}
          <button
            type="button"
            onClick={() => setIssueFilter((f) => (f === "ALL" ? "ISSUES" : "ALL"))}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${issueFilter === "ISSUES"
              ? "bg-rose-50 border-rose-300 text-rose-700"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Chỉ NV có vi phạm
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên / mã NV..."
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={load}
            title="Tải lại"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Chế độ xem */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("MATRIX")}
            className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${view === "MATRIX" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Bảng công tháng
          </button>
          <button
            type="button"
            onClick={() => setView("SUMMARY")}
            className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${view === "SUMMARY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Tổng hợp công
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-slate-400 text-sm">Đang tải bảng công...</div>
      ) : !data || filteredRows.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Không có nhân sự phù hợp bộ lọc.</div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              {view === "MATRIX" ? (
                <MatrixView
                  data={data}
                  rows={vm.timesheetPagination.items}
                  onCellClick={(row, day, cell) => setEditTarget({ row, day, cell })}
                />
              ) : (
                <SummaryView rows={vm.timesheetPagination.items} />
              )}
              <PaginationBar
                totalItems={vm.timesheetPagination.total}
                page={vm.timesheetPagination.page}
                totalPages={vm.timesheetPagination.totalPages}
                pageSize={vm.timesheetPagination.pageSize}
                onPageChange={vm.timesheetPagination.setPage}
                onPageSizeChange={vm.timesheetPagination.setPageSize}
                itemLabel="nhân viên"
              />
            </div>

            {/* Chú thích bên phải xếp thành hàng dọc */}
            <aside className="w-full xl:w-[248px] shrink-0 bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] px-1 pb-2 border-b border-slate-200/80 mb-2">
                  Chú thích
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-1.5 text-[11px] text-slate-700">
                  {/* Đúng giờ */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] text-[11px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span className="font-medium truncate">Đúng giờ</span>
                  </div>

                  {/* Đang làm */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#BFDBFE]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#3B82F6] text-white animate-pulse text-[9px] font-black inline-flex items-center justify-center">
                      ●
                    </span>
                    <span className="font-medium truncate">Đang làm</span>
                  </div>

                  {/* Làm từ xa (WFH) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#A5F3FC]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#0891B2] text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span className="font-medium truncate">Làm từ xa (WFH)</span>
                  </div>

                  {/* Tăng ca (đã duyệt) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#C7D2FE]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#4F46E5] text-white text-[8px] font-black inline-flex items-center justify-center">
                      TC
                    </span>
                    <span className="font-medium truncate">Tăng ca (đã duyệt)</span>
                  </div>

                  {/* Đi trễ / Về sớm (giữ chung) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#FBBF24] text-[#451A03] text-[8px] font-black inline-flex items-center justify-center">
                      T/S
                    </span>
                    <span className="font-medium truncate" title="Đi trễ (T) / Về sớm (S) / Cả hai (TS)">
                      Đi trễ (T) / Về sớm (S) / Cả hai (TS)
                    </span>
                  </div>

                  {/* Quên check-out */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECACA]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#DC2626] text-white text-[9px] font-black inline-flex items-center justify-center">
                      !
                    </span>
                    <span className="font-medium truncate">Quên check-out</span>
                  </div>

                  {/* Vắng không phép */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECDD3]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185] text-[9px] font-black inline-flex items-center justify-center">
                      V
                    </span>
                    <span className="font-medium truncate">Vắng không phép</span>
                  </div>

                  {/* Nghỉ OFF không lương */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <span className="w-4 h-4 shrink-0 rounded bg-slate-200 text-slate-700 border border-slate-300 text-[9px] font-black inline-flex items-center justify-center">
                      P
                    </span>
                    <span className="font-medium truncate">Nghỉ OFF không lương</span>
                  </div>

                  {/* Phép có lương (+1 công) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[8px] font-black inline-flex items-center justify-center">
                      PL
                    </span>
                    <span className="font-medium truncate">Phép có lương (+1 công)</span>
                  </div>

                  {/* Nghỉ lễ (+1 công VP) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      L
                    </span>
                    <span className="font-medium truncate">Nghỉ lễ (+1 công VP)</span>
                  </div>

                  {/* Đi làm lễ (lương x4) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                    <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
                      ★
                    </span>
                    <span className="font-medium truncate">Đi làm lễ (lương x4)</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center justify-end gap-3 font-semibold pt-0.5">
            <span>
              Tổng công tính lương: <b className="text-slate-900">{totals.workUnits.toFixed(2)}</b>
            </span>
            {totals.holidayPaidDays > 0 && (
              <span>
                Công nghỉ lễ (VP): <b className="text-fuchsia-700">+{totals.holidayPaidDays}</b>
              </span>
            )}
            <span>
              Tổng giờ: <b className="text-slate-900">{totals.totalHours.toFixed(1)}h</b>
            </span>
            {totals.overtimeMinutes > 0 && (
              <span>
                Tăng ca duyệt: <b className="text-brand-ink">{formatMinutes(totals.overtimeMinutes)}</b>
              </span>
            )}
            <span>
              Lượt trễ: <b className="text-amber-700">{totals.lateCount}</b>
            </span>
            <span>
              Quên ra ca: <b className="text-red-600">{totals.missing}</b>
            </span>
            <span>
              Vắng: <b className="text-rose-700">{totals.absent}</b>
            </span>
            <span>
              Làm ngày lễ: <b className="text-fuchsia-700">{totals.holidayWork}</b>
            </span>
          </div>
        </div>
      )}

      {editTarget && (
        <CellDetailModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(msg) => {
            setEditTarget(null);
            showToast(msg);
            load();
          }}
        />
      )}

      {showManual && data && (
        <ManualAttendanceModal
          rows={data.rows}
          onClose={() => setShowManual(false)}
          onSaved={(msg) => {
            setShowManual(false);
            showToast(msg);
            load();
          }}
        />
      )}
    </div>
  );
}


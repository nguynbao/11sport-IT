"use client";


import React, { useState, useEffect } from "react";
import { Holiday, LeaveRequest, StaffUser } from "@/shared/types";
import { fetchHolidays, syncVietnamHolidaysApi, createHolidayApi, deleteHolidayApi } from "../api";
import { fetchLeaveRequests, reviewLeaveRequestApi } from "@/features/leave";
import { fetchShiftSchedule } from "@/features/shifts";
import { StaffModule } from "@/features/staff";
import AttendanceTimesheetModule from "./AttendanceTimesheetModule";
import { ShiftScheduleModule } from "@/features/shifts";
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
import { HrmAttendanceViewModel } from "../hooks/useHrmAttendance";

export function HrmHolidaysTab({ vm }: { vm: HrmAttendanceViewModel }) {
  const {
    activeTab,
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
    loading,
    handleSyncVietnamHolidays,
    handlePrevMonth,
    handleNextMonth,
    handleGoToday,
    handleCreateHoliday,
    handleDeleteHoliday,
    calendarCells,
    currentMonthHolidays,
    currentYearHolidays,
    checkIsOfficialHoliday,
    officialCountInYear,
    eventCountInYear,
  } = vm;

  return (
    <>
      {/* ================= TAB 1: CALENDAR & HOLIDAYS ================= */}
      {activeTab === "CALENDAR" && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
          {/* Header gọn gàng */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-brand-ink" />
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
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
                            ? "bg-rose-50 border-2 border-rose-400 hover:border-rose-500 shadow-2xs dark:!bg-[#86198F] dark:!border-[#F0ABFC] dark:hover:!border-white dark:ring-2 dark:ring-[#E879F9]/50"
                            : "bg-[#ECFEFF] border-2 border-[#22D3EE] hover:border-[#06B6D4] shadow-2xs dark:!bg-[#0E7490] dark:!border-[#22D3EE] dark:hover:!border-[#67E8F9]"
                          : cell.isToday
                            ? "bg-teal-50/80 border-2 border-teal-500 ring-2 ring-teal-500/20 shadow-xs"
                            : "bg-white border-2 border-slate-300 hover:border-teal-500 shadow-2xs cursor-pointer"
                        }`}
                    >
                      {/* Label chéo góc trên phải rõ nét: phân biệt LỄ vs SỰ KIỆN */}
                      {hasHoliday && (
                        <div
                          className={`pointer-events-none absolute top-[7px] -right-[22px] w-[76px] text-center py-[1.5px] text-[7px] leading-tight font-black uppercase tracking-tight text-white rotate-45 shadow-2xs ${isOfficial ? "bg-rose-600 dark:!bg-[#F0ABFC] dark:!text-[#4A044E]" : "bg-[#0891B2] dark:!bg-[#22D3EE] dark:!text-[#083344]"
                            }`}
                        >
                          {isOfficial ? "Lễ" : "Sự kiện"}
                        </div>
                      )}

                      {/* Số ngày Dương lịch */}
                      <div className="flex items-center justify-between z-10">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cell.isToday
                            ? "bg-teal-600 text-white shadow-2xs"
                            : !cell.isCurrentMonth
                              ? "text-slate-300 font-medium"
                              : hasHoliday
                                ? isOfficial
                                  ? "text-rose-700 font-extrabold dark:!text-white"
                                  : "text-[#0E7490] font-extrabold dark:!text-[#ECFEFF]"
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
                            className={`text-[10px] font-bold truncate leading-tight ${isOfficial ? "text-rose-800 dark:!text-white" : "text-[#155E75] dark:!text-[#ECFEFF]"
                              }`}
                          >
                            {cell.holiday.name}
                          </div>
                        ) : cell.isToday ? (
                          <div className="text-[9px] font-bold text-brand-ink truncate">
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
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:!text-[#F5D0FE]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 dark:!bg-[#E879F9] inline-block" />
                    Nghỉ lễ chính thức
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0E7490] dark:!text-[#67E8F9]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0891B2] dark:!bg-[#22D3EE] inline-block" />
                    Lễ sự kiện / Kỷ niệm
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
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
                            ? "bg-rose-50/40 hover:bg-rose-50/80 dark:!bg-[#701A75]/60 dark:hover:!bg-[#86198F]/70"
                            : "bg-[#ECFEFF]/60 hover:bg-[#ECFEFF] dark:!bg-[#155E75]/60 dark:hover:!bg-[#0E7490]/70"
                          : "hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`shrink-0 w-11 py-1 text-center text-[11px] font-extrabold rounded-lg border ${isOfficial
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:!bg-[#86198F] dark:!text-white dark:!border-[#F0ABFC]"
                              : "bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC] dark:!bg-[#0E7490] dark:!text-[#ECFEFF] dark:!border-[#22D3EE]"
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
                                  ? "bg-rose-100 text-rose-700 dark:!bg-[#A21CAF] dark:!text-[#FDF4FF]"
                                  : "bg-[#CFFAFE] text-[#0E7490] dark:!bg-[#0891B2] dark:!text-white"
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
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
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
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú</label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú thêm về ngày nghỉ..."
                      value={holidayNote}
                      onChange={(e) => setHolidayNote(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
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
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
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

    </>
  );
}

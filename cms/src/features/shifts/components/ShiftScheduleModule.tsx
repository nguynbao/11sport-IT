"use client";


import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ShiftAssignment, StaffUser, ShiftChange, StaffMonthlyOffStats, StaffPaidLeaveStats, StaffOffRequestItem } from "@/shared/types";
import { fetchShiftSchedule, saveShiftChangesApi } from "../api";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
  Plus,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useShiftSchedule, isStaffInRow, ROWS, addDays, keyOf } from "../hooks/useShiftSchedule";
import { ShiftStaffSidebar } from "./ShiftStaffSidebar";


export default function ShiftScheduleModule({ onScheduleUpdated }: { onScheduleUpdated?: () => void } = {}) {
  const vm = useShiftSchedule({ onScheduleUpdated });
  const {
    wsD, wsM, weD, weM, weY, pendingChanges,
    currentMonday,
    nextMonday,
    weekStart,
    staffList,
    nextWeekPendingStaffCount,
    loading,
    saving,
    editMode,
    setDrag,
    dropTarget,
    setDropTarget,
    addMenu,
    setAddMenu,
    toast,
    days,
    assignmentRecordMap,
    effectiveCode,
    staffRegistrationStatus,
    pendingConfirmStaffList,
    confirmedStaffList,
    offConflictsByDay,
    emptyShifts,
    offRequestByStaffDate,
    offRequestsSummary,
    offOverrideWarnings,
    weekCheck,
    blockingViolations,
    unscheduled,
    totalScheduledStaff,
    isChanged,
    setCode,
    changeWeek,
    startEdit,
    cancelEdit,
    handleSave,
    copyPreviousWeek,
    handleDrop,
  } = vm;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium ${toast.type === "ok" ? "bg-teal-600 text-white" : "bg-rose-600 text-white"
            }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="w-5 h-5 text-teal-400" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-ink" />
            Xếp Ca Tuần – Khối Bán Hàng
            {weekStart === nextMonday && (
              <span className="px-2 py-0.5 rounded-full bg-[#E0E7FF] text-[#4338CA] text-[11px] font-bold">
                Tuần sau
              </span>
            )}
            {weekStart === currentMonday && (
              <span className="px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#047857] text-[11px] font-bold">
                Tuần này
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {editMode
              ? "Đang sửa: kéo nhân viên vào ô ca, kéo thẻ để đổi ca/ngày, bấm × để bỏ phân ca. Sau khi kiểm tra trùng ca, bấm Xác nhận & Hoàn tất."
              : "Hiển thị lịch đăng ký ca của nhân viên Bán hàng. Nếu bị trùng ca/ngày nghỉ, bấm “Sửa lịch ca” để chỉnh tay rồi bấm “Xác nhận & Hoàn tất lịch ca”."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chọn tuần */}
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => changeWeek(addDays(weekStart, -7))}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-extrabold text-slate-900 min-w-[150px] text-center">
              {wsD}/{wsM} – {weD}/{weM}/{weY}
            </span>
            <button
              type="button"
              onClick={() => changeWeek(addDays(weekStart, 7))}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeWeek(currentMonday)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
              weekStart === currentMonday
                ? "border-teal-600 bg-teal-50 text-brand-ink"
                : "border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            Tuần này
          </button>

          <button
            type="button"
            onClick={() => changeWeek(nextMonday)}
            className={`relative px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              weekStart === nextMonday
                ? "border-indigo-600 bg-indigo-50 text-brand-ink"
                : "border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            Tuần sau (Đăng ký ca)
            {nextWeekPendingStaffCount > 0 && (
              <span
                title={`${nextWeekPendingStaffCount} nhân viên vừa đăng ký ca tuần sau chờ HR xác nhận`}
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none"
              >
                {nextWeekPendingStaffCount}
              </span>
            )}
          </button>

          {!editMode ? (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={loading}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Sửa lịch ca
              </button>
              {totalScheduledStaff > 0 && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || loading}
                  title="Chốt lịch ca tuần này và gửi thông báo chấm đỏ cho nhân viên Bán hàng"
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saving
                    ? "Đang xác nhận..."
                    : pendingConfirmStaffList.length > 0
                    ? `Xác nhận & Hoàn tất (${pendingConfirmStaffList.length} ĐK mới)`
                    : "Xác nhận lại & Gửi thông báo"}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={copyPreviousWeek}
                className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Chép tuần trước
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-3 py-2 bg-slate-800 hover:bg-teal-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Đang lưu..." : `Lưu nháp${pendingChanges.length ? ` (${pendingChanges.length})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                title="Lưu thay đổi, chốt lịch tuần và gửi thông báo chấm đỏ tới nhân viên Bán hàng"
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saving ? "Đang xác nhận..." : "Lưu & Xác nhận hoàn tất"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Trạng thái đăng ký ca của nhân viên & cảnh báo trùng lịch */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {pendingConfirmStaffList.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-pulse" />
            NV đã đăng ký chờ HR xác nhận ({pendingConfirmStaffList.length}):{" "}
            {pendingConfirmStaffList.map((st) => st.fullName).join(", ")}
          </span>
        )}
        {confirmedStaffList.length > 0 && pendingConfirmStaffList.length === 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
            HR đã xác nhận lịch tuần cho {confirmedStaffList.length}/{staffList.length} nhân viên
          </span>
        )}
        {offConflictsByDay.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Trùng ngày nghỉ OFF:{" "}
            {offConflictsByDay.map((c) => `${c.dayLabel}: ${c.names.join(" & ")}`).join(" | ")} — HR có thể bấm &ldquo;Sửa lịch ca&rdquo; để chỉnh tay
          </span>
        )}
        {offRequestsSummary.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-[#ECFEFF] border border-[#A5F3FC] text-[#0E7490] font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#0891B2] shrink-0" />
            <span>
              NV đã xin OFF/Phép tuần này:{" "}
              {offRequestsSummary.map((x) => `${x.staffName} (${x.items.join(", ")})`).join(" | ")}
            </span>
          </span>
        )}
        {offOverrideWarnings.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-[#FCE7F3] border border-[#F9A8D4] text-[#BE185D] font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#EC4899] shrink-0" />
            <span>
              Đang xếp đi làm vào ngày NV đã xin OFF ({offOverrideWarnings.join(", ")}) — Khi lưu sẽ gửi thông báo cho Sales!
            </span>
          </span>
        )}
        {emptyShifts.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Lưu ý: có {emptyShifts.length} ca chưa có người trực (
              <b>
                {emptyShifts
                  .map((e) => `${e.dayLabel} - ${e.shiftTitle}`)
                  .join(", ")}
              </b>
              ) — HR vẫn có thể lưu hoặc bấm &ldquo;Sửa lịch ca&rdquo; để bổ sung.
            </span>
          </span>
        )}
        {editMode && blockingViolations.length > 0 && (
          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Tham khảo: {blockingViolations.map((st) => `${st.fullName} (${weekCheck.get(st._id)?.message})`).join("; ")}
          </span>
        )}
        {unscheduled.length > 0 && (
          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
            Chưa đăng ký / chưa xếp lịch: {unscheduled.map((st) => st.fullName).join(", ")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bảng tuần */}
        <div className="lg:col-span-3 overflow-x-auto">
          <div
            className={`min-w-[760px] rounded-xl overflow-hidden border-2 ${editMode ? "border-teal-400" : "border-slate-200"
              }`}
          >
            {/* Header ngày – cố định độ rộng 7 cột bằng minmax(0,1fr) */}
            <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] bg-slate-100 border-b border-slate-200 text-center text-xs font-bold text-slate-700">
              <div className="py-2.5 border-r border-slate-200" />
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`min-w-0 py-2 border-r last:border-r-0 border-slate-200 ${d.isToday ? "bg-teal-600 text-white" : d.index === 7 ? "text-rose-600" : ""
                    }`}
                >
                  <div>{d.name}</div>
                  <div className={`font-mono font-normal ${d.isToday ? "text-teal-100" : "text-slate-400"}`}>{d.display}</div>
                </div>
              ))}
            </div>

            {ROWS.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] border-b last:border-b-0 border-slate-200"
              >
                <div className={`px-2 py-2 border-r border-slate-200 flex flex-col justify-center ${row.header}`}>
                  <div className="text-xs font-extrabold uppercase">{row.title}</div>
                  <div className="text-[10px] font-mono opacity-80">{row.time}</div>
                </div>

                {days.map((d) => {
                  const cellKey = `${row.code}|${d.date}`;
                  const staffInCell = staffList.filter((s) => isStaffInRow(effectiveCode(s._id, d.date), row.code));
                  const unassigned = staffList.filter((s) => !isStaffInRow(effectiveCode(s._id, d.date), row.code));
                  const isShift = row.code !== "OFF";
                  const empty = isShift && staffInCell.length === 0;
                  const isOffConflict = row.code === "OFF" && staffList.length > 1 && staffInCell.length >= 2;

                  return (
                    <div
                      key={cellKey}
                      onDragOver={(e) => {
                        if (!editMode) return;
                        e.preventDefault();
                        setDropTarget(cellKey);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === cellKey ? null : t))}
                      onDrop={() => handleDrop(d.date, row.code)}
                      className={`relative min-w-0 p-1.5 min-h-[96px] border-r last:border-r-0 border-slate-200 flex flex-col gap-1 transition ${dropTarget === cellKey ? "bg-teal-100 ring-2 ring-inset ring-teal-500" : editMode ? row.cellHover : ""
                        } ${d.isToday ? "bg-teal-50/40" : ""} ${isOffConflict ? "bg-amber-50/70" : ""} ${empty ? "bg-rose-50/50" : ""}`}
                    >
                      {staffInCell.map((s) => {
                        const changed = isChanged(s._id, d.date);
                        const curCode = effectiveCode(s._id, d.date);
                        const rec = assignmentRecordMap.get(keyOf(s._id, d.date));
                        const isStaffRegistered = rec?.assignedBy === "AUTO" && !changed;
                        const isWorkingBoth = curCode === "BOTH";
                        const isRandomFromBoth =
                          rec?.preferenceShift === "BOTH" && (curCode === "SHIFT_1" || curCode === "SHIFT_2");
                        const prefDiffers =
                          rec?.preferenceShift &&
                          rec.preferenceShift !== "BOTH" &&
                          rec.preferenceShift !== curCode;
                        const prefLabel =
                          rec?.preferenceShift === "BOTH"
                            ? "Ca 1 + Ca 2"
                            : rec?.preferenceShift === "SHIFT_1"
                            ? "Ca 1"
                            : rec?.preferenceShift === "SHIFT_2"
                            ? "Ca 2"
                            : rec?.preferenceShift === "OFF"
                            ? "OFF"
                            : null;

                        return (
                          <div
                            key={s._id}
                            draggable={editMode}
                            onDragStart={() => setDrag({ staffId: s._id, sourceRow: row.code })}
                            onDragEnd={() => {
                              setDrag(null);
                              setDropTarget(null);
                            }}
                            title={
                              prefLabel
                                ? `${s.fullName} — NV đăng ký: ${prefLabel}`
                                : s.fullName
                            }
                            className={`group/chip relative w-full rounded-md border px-1.5 py-1 text-[11px] font-semibold text-slate-800 shadow-2xs ${row.chip} ${editMode ? "cursor-grab active:cursor-grabbing" : ""
                              } ${changed ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-1 pr-3">
                              <span className="truncate">{s.fullName}</span>
                              {isWorkingBoth ? (
                                <span
                                  title="Nhân viên làm cả 2 ca trong ngày (Ca 1 + Ca 2)"
                                  className="shrink-0 px-1 py-0.2 rounded bg-[#D1FAE5] text-[#065F46] text-[9px] font-extrabold"
                                >
                                  {isStaffRegistered ? "ĐK 2 ca" : "2 ca"}
                                </span>
                              ) : isStaffRegistered ? (
                                <span
                                  title="Nhân viên tự đăng ký, chờ HR xác nhận"
                                  className="shrink-0 px-1 py-0.2 rounded bg-[#E0E7FF] text-[#4338CA] text-[9px] font-extrabold"
                                >
                                  ĐK
                                </span>
                              ) : null}
                            </div>
                            {isRandomFromBoth && (
                              <div className="text-[9px] font-medium text-[#4F46E5] truncate">
                                ĐK 2 ca • Random 1 ca
                              </div>
                            )}
                            {prefDiffers && prefLabel && (
                              <div className="text-[9px] font-medium text-amber-700 truncate">
                                ĐK gốc: {prefLabel}
                              </div>
                            )}
                            {row.code !== "OFF" && offRequestByStaffDate.has(keyOf(s._id, d.date)) && (
                              <div
                                title="Nhân viên đã xin OFF/Phép ngày này — Lưu sẽ báo cho Sales"
                                className="text-[9px] font-bold text-[#BE185D] bg-[#FCE7F3] px-1 rounded mt-0.5 truncate"
                              >
                                ⚠ Đã xin OFF (báo Sales)
                              </div>
                            )}
                            {editMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (curCode === "BOTH") {
                                    setCode(s._id, d.date, row.code === "SHIFT_1" ? "SHIFT_2" : "SHIFT_1");
                                  } else {
                                    setCode(s._id, d.date, null);
                                  }
                                }}
                                title={curCode === "BOTH" ? `Bỏ ${row.title} (giữ ca còn lại)` : "Bỏ phân ca"}
                                className="absolute top-0.5 right-0.5 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Thêm nhanh không cần kéo thả */}
                      {editMode && unassigned.length > 0 && (
                        <div className="relative mt-auto">
                          <button
                            type="button"
                            onClick={() => setAddMenu((m) => (m === cellKey ? null : cellKey))}
                            className="w-full py-0.5 rounded-md border border-dashed border-slate-300 text-[10px] font-semibold text-slate-400 hover:text-brand-ink hover:border-teal-400 flex items-center justify-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            Thêm
                          </button>
                          {addMenu === cellKey && (
                            <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1 min-w-[165px]">
                              {unassigned.map((s) => {
                                const cur = effectiveCode(s._id, d.date);
                                const canWorkBoth =
                                  (row.code === "SHIFT_1" && cur === "SHIFT_2") ||
                                  (row.code === "SHIFT_2" && cur === "SHIFT_1");
                                return (
                                  <div
                                    key={s._id}
                                    className="px-2 py-1.5 text-[11px] hover:bg-slate-50 border-b last:border-b-0 border-slate-100 space-y-1"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCode(s._id, d.date, row.code);
                                        setAddMenu(null);
                                      }}
                                      className="w-full text-left flex items-center justify-between gap-2 cursor-pointer"
                                    >
                                      <span className="font-semibold text-slate-800 truncate">{s.fullName}</span>
                                      {cur && (
                                        <span className="text-[9px] text-slate-400 shrink-0">
                                          {cur === "SHIFT_1" ? "đang Ca 1" : cur === "SHIFT_2" ? "đang Ca 2" : "đang Nghỉ"}
                                        </span>
                                      )}
                                    </button>
                                    {canWorkBoth && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCode(s._id, d.date, "BOTH");
                                          setAddMenu(null);
                                        }}
                                        className="w-full px-1.5 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-brand-ink font-bold text-[10px] text-center cursor-pointer"
                                      >
                                        + Gộp làm cả 2 ca (Ca 1 + Ca 2)
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {empty && (
                        <div className="m-auto text-[10px] font-bold text-rose-600 bg-rose-100/80 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-1 text-center">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Ca trống (Chưa có ai ĐK)</span>
                        </div>
                      )}
                      {isOffConflict && (
                        <div className="mt-auto text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded text-center">
                          ⚠ Trùng ngày OFF
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {loading && <div className="text-xs text-slate-400 mt-2">Đang tải lịch ca...</div>}
        </div>

        <ShiftStaffSidebar vm={vm} />
      </div>
    </div>
  );
}


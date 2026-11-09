"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShiftAssignment,
  StaffUser,
  ShiftChange,
  fetchShiftSchedule,
  saveShiftChangesApi,
} from "@/lib/api";
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

type ShiftCode = "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
type RowShiftCode = "SHIFT_1" | "SHIFT_2" | "OFF";

function isStaffInRow(code: ShiftCode | null, rowCode: RowShiftCode): boolean {
  if (!code) return false;
  if (rowCode === "SHIFT_1") return code === "SHIFT_1" || code === "BOTH";
  if (rowCode === "SHIFT_2") return code === "SHIFT_2" || code === "BOTH";
  return code === "OFF";
}

const ROWS: { code: RowShiftCode; title: string; time: string; header: string; chip: string; cellHover: string }[] = [
  {
    code: "SHIFT_1",
    title: "Ca 1",
    time: "08:30 – 17:30",
    header: "bg-amber-100/70 text-amber-900",
    chip: "border-amber-300 bg-white",
    cellHover: "hover:bg-amber-50",
  },
  {
    code: "SHIFT_2",
    title: "Ca 2",
    time: "12:00 – 21:00",
    header: "bg-indigo-100/70 text-indigo-900",
    chip: "border-indigo-300 bg-white",
    cellHover: "hover:bg-indigo-50",
  },
  {
    code: "OFF",
    title: "Nghỉ",
    time: "Ngày OFF",
    header: "bg-slate-200/70 text-slate-700",
    chip: "border-slate-300 bg-slate-50 text-slate-500",
    cellHover: "hover:bg-slate-100",
  },
];

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}
function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toDateStr(d);
}
const keyOf = (staffId: string, date: string) => `${staffId}|${date}`;

interface DragPayload {
  staffId: string;
  sourceRow?: RowShiftCode;
}

export default function ShiftScheduleModule({ onScheduleUpdated }: { onScheduleUpdated?: () => void } = {}) {
  const currentMonday = useMemo(() => mondayOf(new Date()), []);
  const nextMonday = useMemo(() => addDays(currentMonday, 7), [currentMonday]);

  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [nextWeekPendingStaffCount, setNextWeekPendingStaffCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  /** Các thay đổi chưa lưu: key staffId|date -> mã ca mới (null = bỏ phân ca) */
  const [draft, setDraft] = useState<Map<string, ShiftCode | null>>(new Map());
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [addMenu, setAddMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshNextWeekBadge = useCallback(async () => {
    try {
      const res = await fetchShiftSchedule(nextMonday);
      const pendingStaffIds = new Set(
        res.assignments.filter((a) => a.assignedBy === "AUTO").map((a) => String(a.staffId))
      );
      setNextWeekPendingStaffCount(pendingStaffIds.size);
    } catch {
      // ignore
    }
  }, [nextMonday]);

  const load = useCallback(async (ws: string) => {
    setLoading(true);
    try {
      const res = await fetchShiftSchedule(ws);
      setAssignments(res.assignments);
      setStaffList(res.staffList.filter((s) => s.role === "SALES" || s.department === "SALES"));
      refreshNextWeekBadge();
    } catch (e: any) {
      showToast("err", e?.message || "Lỗi tải lịch ca");
    } finally {
      setLoading(false);
    }
  }, [refreshNextWeekBadge]);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const [, m, d] = date.split("-");
        return { date, index: i + 1, name: DAY_NAMES[i], display: `${d}/${m}`, isToday: date === toDateStr(new Date()) };
      }),
    [weekStart]
  );

  // Ca đã lưu trên server & thông tin bản ghi gốc (để biết nguyện vọng NV đăng ký)
  const savedMap = useMemo(() => {
    const m = new Map<string, ShiftCode>();
    for (const a of assignments) m.set(keyOf(String(a.staffId), a.date), a.shiftCode as ShiftCode);
    return m;
  }, [assignments]);

  const assignmentRecordMap = useMemo(() => {
    const m = new Map<string, ShiftAssignment>();
    for (const a of assignments) m.set(keyOf(String(a.staffId), a.date), a);
    return m;
  }, [assignments]);

  const effectiveCode = useCallback(
    (staffId: string, date: string): ShiftCode | null => {
      const k = keyOf(staffId, date);
      if (draft.has(k)) return draft.get(k) ?? null;
      return savedMap.get(k) ?? null;
    },
    [draft, savedMap]
  );

  const staffById = useMemo(() => new Map(staffList.map((s) => [s._id, s])), [staffList]);

  // Danh sách thay đổi thực sự (khác với dữ liệu đã lưu)
  const pendingChanges: ShiftChange[] = useMemo(() => {
    const list: ShiftChange[] = [];
    draft.forEach((code, k) => {
      const saved = savedMap.get(k) ?? null;
      if (saved === code) return;
      const [staffId, date] = k.split("|");
      const idx = days.findIndex((d) => d.date === date);
      list.push({ staffId, date, dayOfWeek: idx >= 0 ? idx + 1 : undefined, shiftCode: code });
    });
    return list;
  }, [draft, savedMap, days]);

  // Trạng thái đăng ký / xác nhận của từng nhân viên trong tuần đang xem
  const staffRegistrationStatus = useMemo(() => {
    const m = new Map<string, "UNREGISTERED" | "PENDING_HR" | "CONFIRMED_HR">();
    for (const st of staffList) {
      const stAssigns = assignments.filter((a) => String(a.staffId) === st._id);
      if (stAssigns.length === 0) {
        m.set(st._id, "UNREGISTERED");
      } else if (stAssigns.some((a) => a.assignedBy === "AUTO")) {
        m.set(st._id, "PENDING_HR");
      } else {
        m.set(st._id, "CONFIRMED_HR");
      }
    }
    return m;
  }, [staffList, assignments]);

  const pendingConfirmStaffList = useMemo(
    () => staffList.filter((st) => staffRegistrationStatus.get(st._id) === "PENDING_HR"),
    [staffList, staffRegistrationStatus]
  );

  const confirmedStaffList = useMemo(
    () => staffList.filter((st) => staffRegistrationStatus.get(st._id) === "CONFIRMED_HR"),
    [staffList, staffRegistrationStatus]
  );

  // Phát hiện trùng ngày OFF (nhiều nhân viên cùng xin OFF 1 ngày) để báo HR chỉnh tay
  const offConflictsByDay = useMemo(() => {
    const conflicts: { dayLabel: string; date: string; names: string[] }[] = [];
    if (staffList.length <= 1) return conflicts;
    for (const d of days) {
      const offStaff = staffList.filter((s) => effectiveCode(s._id, d.date) === "OFF");
      if (offStaff.length >= 2) {
        conflicts.push({
          dayLabel: `${d.name} (${d.display})`,
          date: d.date,
          names: offStaff.map((s) => s.fullName),
        });
      }
    }
    return conflicts;
  }, [days, staffList, effectiveCode]);

  // Phát hiện các ca làm việc (Ca 1, Ca 2) bị trống (không có ai đăng ký / trực)
  const emptyShifts = useMemo(() => {
    const list: { date: string; dayLabel: string; shiftCode: "SHIFT_1" | "SHIFT_2"; shiftTitle: string }[] = [];
    for (const d of days) {
      for (const sc of ["SHIFT_1", "SHIFT_2"] as const) {
        const count = staffList.filter((s) => isStaffInRow(effectiveCode(s._id, d.date), sc)).length;
        if (count === 0) {
          list.push({
            date: d.date,
            dayLabel: `${d.name} (${d.display})`,
            shiftCode: sc,
            shiftTitle: sc === "SHIFT_1" ? "Ca 1" : "Ca 2",
          });
        }
      }
    }
    return list;
  }, [days, staffList, effectiveCode]);

  // Quy định: Khối Bán hàng làm 6 ngày + nghỉ ĐÚNG 1 ngày/tuần
  const weekCheck = useMemo(() => {
    const result = new Map<string, { assigned: number; off: number; ok: boolean; message: string }>();
    for (const st of staffList) {
      const codes = days.map((d) => effectiveCode(st._id, d.date));
      const assigned = codes.filter((c) => c !== null).length;
      const off = codes.filter((c) => c === "OFF").length;
      let message = "";
      if (assigned === 0) message = "Chưa xếp lịch tuần này";
      else {
        const problems: string[] = [];
        if (assigned < 7) problems.push(`còn ${7 - assigned} ngày chưa xếp`);
        if (off === 0) problems.push("chưa có ngày nghỉ");
        if (off > 1) problems.push(`đang nghỉ ${off} ngày`);
        message = problems.join(", ");
      }
      result.set(st._id, { assigned, off, ok: assigned === 7 && off === 1, message });
    }
    return result;
  }, [staffList, days, effectiveCode]);

  const blockingViolations = staffList.filter((st) => {
    const c = weekCheck.get(st._id);
    return c && c.assigned > 0 && !c.ok;
  });
  const unscheduled = staffList.filter((st) => weekCheck.get(st._id)?.assigned === 0);
  const totalScheduledStaff = staffList.length - unscheduled.length;

  const isChanged = (staffId: string, date: string) => {
    const k = keyOf(staffId, date);
    return draft.has(k) && (draft.get(k) ?? null) !== (savedMap.get(k) ?? null);
  };

  const setCode = (staffId: string, date: string, code: ShiftCode | null) => {
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(keyOf(staffId, date), code);
      return next;
    });
  };

  const confirmDiscard = () =>
    pendingChanges.length === 0 || confirm(`Bạn có ${pendingChanges.length} thay đổi chưa lưu. Bỏ các thay đổi này?`);

  const changeWeek = (ws: string) => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setWeekStart(ws);
  };

  const startEdit = () => {
    setDraft(new Map());
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (!confirmDiscard()) return;
    setDraft(new Map());
    setEditMode(false);
    setAddMenu(null);
  };

  const handleSave = async (confirmWeek = false) => {
    if (confirmWeek && emptyShifts.length > 0) {
      showToast(
        "err",
        `Không được để ca bị trống! Đang có ${emptyShifts.length} ca chưa có người trực (${emptyShifts
          .slice(0, 3)
          .map((e) => `${e.dayLabel} ${e.shiftTitle}`)
          .join(", ")}${emptyShifts.length > 3 ? "..." : ""}). Vui lòng xếp đủ người trước khi xác nhận.`
      );
      return;
    }
    if (!confirmWeek && pendingChanges.length === 0) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      const res = await saveShiftChangesApi(weekStart, pendingChanges, confirmWeek);
      if (confirmWeek) {
        showToast(
          "ok",
          `Đã xác nhận & hoàn tất lịch ca tuần (${wsD}/${wsM} – ${weD}/${weM}). Đã gửi thông báo lịch mới tới nhân viên Bán hàng!`
        );
      } else {
        showToast("ok", `Đã lưu lịch ca (${res.created} mới, ${res.updated} sửa, ${res.deleted} xoá)`);
      }
      setDraft(new Map());
      setEditMode(false);
      setAddMenu(null);
      await load(weekStart);
      onScheduleUpdated?.();
    } catch (e: any) {
      showToast("err", e?.message || "Không lưu được lịch ca");
    } finally {
      setSaving(false);
    }
  };

  const copyPreviousWeek = async () => {
    try {
      const prevStart = addDays(weekStart, -7);
      const res = await fetchShiftSchedule(prevStart);
      if (!res.assignments.length) {
        showToast("err", "Tuần trước chưa có lịch ca để sao chép");
        return;
      }
      setDraft((prev) => {
        const next = new Map(prev);
        for (const a of res.assignments) {
          const newDate = addDays(a.date, 7);
          if (newDate < weekStart || newDate > addDays(weekStart, 6)) continue;
          next.set(keyOf(String(a.staffId), newDate), a.shiftCode as ShiftCode);
        }
        return next;
      });
      showToast("ok", "Đã sao chép lịch tuần trước — kiểm tra rồi bấm Lưu");
    } catch (e: any) {
      showToast("err", e?.message || "Không sao chép được");
    }
  };

  // Kéo - thả
  const handleDrop = (date: string, code: RowShiftCode) => {
    setDropTarget(null);
    if (!editMode || !drag) return;
    const cur = effectiveCode(drag.staffId, date);
    // Nếu kéo từ thanh nhân sự bên phải vào Ca 1/Ca 2 khi đang ở ca còn lại -> gộp làm 2 ca ('BOTH')
    if (
      !drag.sourceRow &&
      ((cur === "SHIFT_1" && code === "SHIFT_2") || (cur === "SHIFT_2" && code === "SHIFT_1"))
    ) {
      setCode(drag.staffId, date, "BOTH");
    } else {
      setCode(drag.staffId, date, code);
    }
    setDrag(null);
  };

  const weekEnd = addDays(weekStart, 6);
  const [, wsM, wsD] = weekStart.split("-");
  const [weY, weM, weD] = weekEnd.split("-");

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium ${toast.type === "ok" ? "bg-slate-900 text-white" : "bg-rose-600 text-white"
            }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Xếp Ca Tuần – Khối Bán Hàng
            {weekStart === nextMonday && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                Tuần sau
              </span>
            )}
            {weekStart === currentMonday && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
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
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
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
                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
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
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Sửa lịch ca
              </button>
              {totalScheduledStaff > 0 && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || loading || blockingViolations.length > 0 || emptyShifts.length > 0}
                  title={
                    blockingViolations.length > 0
                      ? "Mỗi nhân viên phải có 6 ngày làm + đúng 1 ngày nghỉ trong tuần trước khi xác nhận"
                      : emptyShifts.length > 0
                      ? `Không được để ca bị trống (${emptyShifts.length} ca chưa có người đăng ký)`
                      : "Chốt lịch ca tuần này và gửi thông báo chấm đỏ cho nhân viên Bán hàng"
                  }
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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
                disabled={saving || blockingViolations.length > 0}
                title={
                  blockingViolations.length > 0
                    ? "Mỗi nhân viên phải có 6 ngày làm + đúng 1 ngày nghỉ trong tuần"
                    : undefined
                }
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Đang lưu..." : `Lưu nháp${pendingChanges.length ? ` (${pendingChanges.length})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || blockingViolations.length > 0 || emptyShifts.length > 0}
                title={
                  blockingViolations.length > 0
                    ? "Mỗi nhân viên phải có 6 ngày làm + đúng 1 ngày nghỉ trong tuần"
                    : emptyShifts.length > 0
                    ? `Không được để ca bị trống (${emptyShifts.length} ca chưa có người đăng ký)`
                    : "Lưu thay đổi, chốt lịch tuần và gửi thông báo chấm đỏ tới nhân viên Bán hàng"
                }
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            NV đã đăng ký chờ HR xác nhận ({pendingConfirmStaffList.length}):{" "}
            {pendingConfirmStaffList.map((st) => st.fullName).join(", ")}
          </span>
        )}
        {confirmedStaffList.length > 0 && pendingConfirmStaffList.length === 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
        {emptyShifts.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              Không được để ca bị trống ({emptyShifts.length} ca chưa có ai đăng ký):{" "}
              <b>
                {emptyShifts
                  .map((e) => `${e.dayLabel} - ${e.shiftTitle}`)
                  .join(", ")}
              </b>{" "}
              — Vui lòng bấm &ldquo;Sửa lịch ca&rdquo; để phân công đủ người trước khi xác nhận!
            </span>
          </span>
        )}
        {editMode && blockingViolations.length > 0 && (
          <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Chưa thể lưu: {blockingViolations.map((st) => `${st.fullName} (${weekCheck.get(st._id)?.message})`).join("; ")}
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
            className={`min-w-[760px] rounded-xl overflow-hidden border-2 ${editMode ? "border-emerald-400" : "border-slate-200"
              }`}
          >
            {/* Header ngày – cố định độ rộng 7 cột bằng minmax(0,1fr) */}
            <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] bg-slate-100 border-b border-slate-200 text-center text-xs font-bold text-slate-700">
              <div className="py-2.5 border-r border-slate-200" />
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`min-w-0 py-2 border-r last:border-r-0 border-slate-200 ${d.isToday ? "bg-blue-600 text-white" : d.index === 7 ? "text-rose-600" : ""
                    }`}
                >
                  <div>{d.name}</div>
                  <div className={`font-mono font-normal ${d.isToday ? "text-blue-100" : "text-slate-400"}`}>{d.display}</div>
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
                      className={`relative min-w-0 p-1.5 min-h-[96px] border-r last:border-r-0 border-slate-200 flex flex-col gap-1 transition ${dropTarget === cellKey ? "bg-emerald-100 ring-2 ring-inset ring-emerald-500" : editMode ? row.cellHover : ""
                        } ${d.isToday ? "bg-blue-50/40" : ""} ${isOffConflict ? "bg-amber-50/70" : ""} ${empty ? "bg-rose-50/50" : ""}`}
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
                              } ${changed ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-1 pr-3">
                              <span className="truncate">{s.fullName}</span>
                              {isWorkingBoth ? (
                                <span
                                  title="Nhân viên làm cả 2 ca trong ngày (Ca 1 + Ca 2)"
                                  className="shrink-0 px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold"
                                >
                                  {isStaffRegistered ? "ĐK 2 ca" : "2 ca"}
                                </span>
                              ) : isStaffRegistered ? (
                                <span
                                  title="Nhân viên tự đăng ký, chờ HR xác nhận"
                                  className="shrink-0 px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-extrabold"
                                >
                                  ĐK
                                </span>
                              ) : null}
                            </div>
                            {isRandomFromBoth && (
                              <div className="text-[9px] font-medium text-indigo-600 truncate">
                                ĐK 2 ca • Random 1 ca
                              </div>
                            )}
                            {prefDiffers && prefLabel && (
                              <div className="text-[9px] font-medium text-amber-700 truncate">
                                ĐK gốc: {prefLabel}
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
                            className="w-full py-0.5 rounded-md border border-dashed border-slate-300 text-[10px] font-semibold text-slate-400 hover:text-emerald-700 hover:border-emerald-400 flex items-center justify-center gap-0.5 cursor-pointer"
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
                                        className="w-full px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] text-center cursor-pointer"
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

        {/* Danh sách nhân sự */}
        <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Nhân sự showroom
            </h3>
            <span className="text-[11px] font-bold text-slate-500">{staffList.length} người</span>
          </div>

          {!editMode && (
            <div className="text-[11px] text-slate-500 flex items-start gap-1.5 bg-white border border-slate-200 rounded-lg p-2">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Bấm <b>“Sửa lịch ca”</b> nếu cần chỉnh tay ca bị trùng, sau đó bấm <b>“Xác nhận & Hoàn tất”</b> để gửi lịch cho Sales.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {staffList.map((s) => {
              const shifts = days.map((d) => effectiveCode(s._id, d.date));
              const workDays = shifts.filter((c) => c === "SHIFT_1" || c === "SHIFT_2" || c === "BOTH").length;
              const totalShiftUnits = shifts.reduce(
                (acc, c) => acc + (c === "BOTH" ? 2 : c === "SHIFT_1" || c === "SHIFT_2" ? 1 : 0),
                0
              );
              const offDays = shifts.filter((c) => c === "OFF").length;
              const regStatus = staffRegistrationStatus.get(s._id);
              return (
                <div
                  key={s._id}
                  draggable={editMode}
                  onDragStart={() => setDrag({ staffId: s._id })}
                  onDragEnd={() => {
                    setDrag(null);
                    setDropTarget(null);
                  }}
                  className={`p-2.5 bg-white border border-slate-200 rounded-lg transition flex items-center justify-between gap-2 ${editMode ? "cursor-grab active:cursor-grabbing hover:border-emerald-500 hover:shadow-md" : "opacity-90"
                    }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-bold text-xs text-slate-900 truncate">{s.fullName}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                      {regStatus === "PENDING_HR" && (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">
                          Đã ĐK • Chờ duyệt
                        </span>
                      )}
                      {regStatus === "CONFIRMED_HR" && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                          ✓ HR đã chốt
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-extrabold text-emerald-700">
                      {totalShiftUnits > workDays
                        ? `${workDays} ngày (${totalShiftUnits} ca) • ${offDays} nghỉ`
                        : `${workDays} ca • ${offDays} nghỉ`}
                    </div>
                    {(() => {
                      const c = weekCheck.get(s._id);
                      if (!c) return null;
                      if (c.ok) return <div className="text-[10px] font-bold text-emerald-600">✓ Đúng quy định</div>;
                      return (
                        <div className={`text-[10px] font-bold ${c.assigned === 0 ? "text-amber-600" : "text-rose-600"}`}>
                          ⚠ {c.message}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            {staffList.length === 0 && !loading && (
              <div className="text-xs text-slate-400 text-center py-4">Chưa có nhân viên khối Bán hàng.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

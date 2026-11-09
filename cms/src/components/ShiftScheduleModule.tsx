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

type ShiftCode = "SHIFT_1" | "SHIFT_2" | "OFF";

const ROWS: { code: ShiftCode; title: string; time: string; header: string; chip: string; cellHover: string }[] = [
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
}

export default function ShiftScheduleModule() {
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
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
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (ws: string) => {
    setLoading(true);
    try {
      const res = await fetchShiftSchedule(ws);
      setAssignments(res.assignments);
      setStaffList(res.staffList.filter((s) => s.role === "SALES" || s.department === "SALES"));
    } catch (e: any) {
      showToast("err", e?.message || "Lỗi tải lịch ca");
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Ca đã lưu trên server
  const savedMap = useMemo(() => {
    const m = new Map<string, ShiftCode>();
    for (const a of assignments) m.set(keyOf(String(a.staffId), a.date), a.shiftCode as ShiftCode);
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

  const handleSave = async () => {
    if (pendingChanges.length === 0) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      const res = await saveShiftChangesApi(weekStart, pendingChanges);
      showToast("ok", `Đã lưu lịch ca (${res.created} mới, ${res.updated} sửa, ${res.deleted} xoá)`);
      setDraft(new Map());
      setEditMode(false);
      setAddMenu(null);
      await load(weekStart);
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
  const handleDrop = (date: string, code: ShiftCode) => {
    setDropTarget(null);
    if (!editMode || !drag) return;
    setCode(drag.staffId, date, code);
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
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {editMode
              ? "Đang sửa: kéo nhân viên vào ô ca, kéo thẻ để đổi ca/ngày, bấm × để bỏ phân ca. Nhớ bấm Lưu."
              : "Bấm “Sửa lịch ca” để thay đổi phân ca."}
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
          {weekStart !== mondayOf(new Date()) && (
            <button
              type="button"
              onClick={() => changeWeek(mondayOf(new Date()))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Tuần này
            </button>
          )}

          {!editMode ? (
            <button
              type="button"
              onClick={startEdit}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              Sửa lịch ca
            </button>
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
                onClick={handleSave}
                disabled={saving || blockingViolations.length > 0}
                title={
                  blockingViolations.length > 0
                    ? "Mỗi nhân viên phải có 6 ngày làm + đúng 1 ngày nghỉ trong tuần"
                    : undefined
                }
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Đang lưu..." : `Lưu thay đổi${pendingChanges.length ? ` (${pendingChanges.length})` : ""}`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quy định tuần làm việc */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {editMode && blockingViolations.length > 0 && (
          <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Chưa thể lưu: {blockingViolations.map((st) => `${st.fullName} (${weekCheck.get(st._id)?.message})`).join("; ")}
          </span>
        )}
        {unscheduled.length > 0 && (
          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
            Chưa xếp lịch: {unscheduled.map((st) => st.fullName).join(", ")}
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
            {/* Header ngày */}
            <div className="grid grid-cols-[90px_repeat(7,1fr)] bg-slate-100 border-b border-slate-200 text-center text-xs font-bold text-slate-700">
              <div className="py-2.5 border-r border-slate-200" />
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`py-2 border-r last:border-r-0 border-slate-200 ${d.isToday ? "bg-blue-600 text-white" : d.index === 7 ? "text-rose-600" : ""
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
                className="grid grid-cols-[90px_repeat(7,1fr)] border-b last:border-b-0 border-slate-200"
              >
                <div className={`px-2 py-2 border-r border-slate-200 flex flex-col justify-center ${row.header}`}>
                  <div className="text-xs font-extrabold uppercase">{row.title}</div>
                  <div className="text-[10px] font-mono opacity-80">{row.time}</div>
                </div>

                {days.map((d) => {
                  const cellKey = `${row.code}|${d.date}`;
                  const staffInCell = staffList.filter((s) => effectiveCode(s._id, d.date) === row.code);
                  const unassigned = staffList.filter((s) => effectiveCode(s._id, d.date) !== row.code);
                  const isShift = row.code !== "OFF";
                  const empty = isShift && staffInCell.length === 0;

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
                      className={`relative p-1.5 min-h-[96px] border-r last:border-r-0 border-slate-200 flex flex-col gap-1 transition ${dropTarget === cellKey ? "bg-emerald-100 ring-2 ring-inset ring-emerald-500" : editMode ? row.cellHover : ""
                        } ${d.isToday ? "bg-blue-50/40" : ""}`}
                    >
                      {staffInCell.map((s) => {
                        const changed = isChanged(s._id, d.date);
                        return (
                          <div
                            key={s._id}
                            draggable={editMode}
                            onDragStart={() => setDrag({ staffId: s._id })}
                            onDragEnd={() => {
                              setDrag(null);
                              setDropTarget(null);
                            }}
                            title={s.fullName}
                            className={`group/chip relative w-full rounded-md border px-1.5 py-1 text-[11px] font-semibold text-slate-800 shadow-2xs ${row.chip} ${editMode ? "cursor-grab active:cursor-grabbing" : ""
                              } ${changed ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                          >
                            <div className="truncate pr-3">{s.fullName}</div>
                            {editMode && (
                              <button
                                type="button"
                                onClick={() => setCode(s._id, d.date, null)}
                                title="Bỏ phân ca"
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
                            <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto py-1 min-w-[140px]">
                              {unassigned.map((s) => {
                                const cur = effectiveCode(s._id, d.date);
                                return (
                                  <button
                                    key={s._id}
                                    type="button"
                                    onClick={() => {
                                      setCode(s._id, d.date, row.code);
                                      setAddMenu(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
                                  >
                                    <span className="font-semibold text-slate-800 truncate">{s.fullName}</span>
                                    {cur && (
                                      <span className="text-[9px] text-slate-400 shrink-0">
                                        {cur === "SHIFT_1" ? "đang Ca 1" : cur === "SHIFT_2" ? "đang Ca 2" : "đang Nghỉ"}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {empty && !editMode && (
                        <div className="m-auto text-[10px] font-bold text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Chưa có người
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
              Lịch đang khoá. Bấm “Sửa lịch ca” để kéo thả phân ca.
            </div>
          )}

          <div className="space-y-1.5">
            {staffList.map((s) => {
              const shifts = days.map((d) => effectiveCode(s._id, d.date));
              const workDays = shifts.filter((c) => c === "SHIFT_1" || c === "SHIFT_2").length;
              const offDays = shifts.filter((c) => c === "OFF").length;
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
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">{s.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{s.code}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-extrabold text-emerald-700">
                      {workDays} ca • {offDays} nghỉ
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

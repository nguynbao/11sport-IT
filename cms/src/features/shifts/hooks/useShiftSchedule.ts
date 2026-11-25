
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

type ShiftCode = "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
type RowShiftCode = "SHIFT_1" | "SHIFT_2" | "OFF";


export function isStaffInRow(code: ShiftCode | null, rowCode: RowShiftCode): boolean {
  if (!code) return false;
  if (rowCode === "SHIFT_1") return code === "SHIFT_1" || code === "BOTH";
  if (rowCode === "SHIFT_2") return code === "SHIFT_2" || code === "BOTH";
  return code === "OFF";
}

export const ROWS: { code: RowShiftCode; title: string; time: string; header: string; chip: string; cellHover: string }[] = [
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
    header: "bg-[#E0E7FF]/70 text-[#312E81]",
    chip: "border-[#A5B4FC] bg-white",
    cellHover: "hover:bg-[#EEF2FF]",
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

export const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}
export function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toDateStr(d);
}
export const keyOf = (staffId: string, date: string) => `${staffId}|${date}`;

export interface DragPayload {
  staffId: string;
  sourceRow?: RowShiftCode;
}


export function useShiftSchedule({ onScheduleUpdated }: { onScheduleUpdated?: () => void } = {}) {
  const currentMonday = useMemo(() => mondayOf(new Date()), []);
  const nextMonday = useMemo(() => addDays(currentMonday, 7), [currentMonday]);

  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(new Date()));
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [monthlyOffByStaff, setMonthlyOffByStaff] = useState<Record<string, StaffMonthlyOffStats>>({});
  const [paidLeaveByStaff, setPaidLeaveByStaff] = useState<Record<string, StaffPaidLeaveStats>>({});
  const [offRequestsByStaff, setOffRequestsByStaff] = useState<Record<string, StaffOffRequestItem[]>>({});
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
      setMonthlyOffByStaff(res.monthlyOffByStaff || {});
      setPaidLeaveByStaff(res.paidLeaveByStaff || {});
      setOffRequestsByStaff(res.offRequestsByStaff || {});
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

  const offRequestByStaffDate = useMemo(() => {
    const m = new Map<string, StaffOffRequestItem>();
    for (const [sid, list] of Object.entries(offRequestsByStaff)) {
      for (const item of list) {
        m.set(keyOf(sid, item.date), item);
      }
    }
    return m;
  }, [offRequestsByStaff]);

  const offRequestsSummary = useMemo(() => {
    const list: { staffName: string; items: string[] }[] = [];
    for (const st of staffList) {
      const reqs = offRequestsByStaff[st._id] || [];
      if (reqs.length === 0) continue;
      const items = reqs.map((r) => {
        const d = days.find((x) => x.date === r.date);
        const dayStr = d ? `${d.name} ${d.display}` : r.date;
        const typeStr = r.type === "PAID_LEAVE" ? "Phép" : "OFF";
        const statusStr = r.status === "APPROVED" ? "đã duyệt" : "chờ duyệt";
        return `${dayStr} (${typeStr} ${statusStr})`;
      });
      list.push({ staffName: st.fullName, items });
    }
    return list;
  }, [staffList, offRequestsByStaff, days]);

  const offOverrideWarnings = useMemo(() => {
    const list: string[] = [];
    for (const st of staffList) {
      for (const d of days) {
        const req = offRequestByStaffDate.get(keyOf(st._id, d.date));
        if (!req) continue;
        const code = effectiveCode(st._id, d.date);
        if (code && code !== "OFF") {
          list.push(`${st.fullName} (${d.name} ${d.display})`);
        }
      }
    }
    return list;
  }, [staffList, days, offRequestByStaffDate, effectiveCode]);

  // Tham khảo: 1 tháng nghỉ tối đa 4 ngày OFF + số phép đang có (HR xếp lịch không bị ràng buộc cứng)
  const weekCheck = useMemo(() => {
    const result = new Map<
      string,
      {
        assigned: number;
        off: number;
        unpaidOff: number;
        paidLeaveOff: number;
        ok: boolean;
        message: string;
        monthUsedAfterWeek: number;
        monthLimit: number;
      }
    >();
    const monthsInWeek = Array.from(new Set(days.map((d) => d.date.slice(0, 7))));
    for (const st of staffList) {
      const codes = days.map((d) => effectiveCode(st._id, d.date));
      const paidStats = paidLeaveByStaff[st._id];
      const paidDatesSet = new Set(paidStats?.paidLeaveDatesInWeek || []);
      const paidBonus = paidStats?.eligible ? Math.max(0, paidStats?.entitledInMonth || 0) : 0;
      const assigned = codes.filter((c) => c !== null).length;
      const off = codes.filter((c) => c === "OFF").length;
      const paidLeaveOff = days.filter((d, idx) => codes[idx] === "OFF" && paidDatesSet.has(d.date)).length;
      const unpaidOff = Math.max(0, off - paidLeaveOff);
      const stats = monthlyOffByStaff[st._id];
      const limit = stats?.limit ?? (4 + paidBonus);
      const primaryOutside = stats?.usedOutsideWeek ?? 0;
      const primaryMonth = stats?.primaryMonth || weekStart.slice(0, 7);
      const offInPrimaryMonthThisWeek = days.filter(
        (d, idx) => d.date.startsWith(`${primaryMonth}-`) && codes[idx] === "OFF" && !paidDatesSet.has(d.date)
      ).length;
      const monthUsedAfterWeek = primaryOutside + offInPrimaryMonthThisWeek;

      let message = "";
      let monthQuotaExceeded = false;
      if (assigned === 0) message = "Chưa xếp lịch tuần này";
      else {
        const problems: string[] = [];
        if (assigned < 7) problems.push(`còn ${7 - assigned} ngày chưa xếp`);
        for (const ym of monthsInWeek) {
          const mStats = stats?.byMonth?.[ym];
          const ymLimit = mStats?.limit ?? limit;
          const usedOutside = mStats?.usedOutsideWeek ?? (ym === primaryMonth ? primaryOutside : 0);
          const offInMonth = days.filter(
            (d, idx) => d.date.startsWith(`${ym}-`) && codes[idx] === "OFF" && !paidDatesSet.has(d.date)
          ).length;
          if (usedOutside + offInMonth > ymLimit) {
            monthQuotaExceeded = true;
            const rem = Math.max(0, ymLimit - usedOutside);
            problems.push(
              rem === 0
                ? `T${ym.slice(5, 7)} vượt hạn mức ${ymLimit} ngày (OFF + phép)`
                : `T${ym.slice(5, 7)} vượt ${usedOutside + offInMonth}/${ymLimit} ngày (còn ${rem})`
            );
          }
        }
        message = problems.join(", ");
      }
      result.set(st._id, {
        assigned,
        off,
        unpaidOff,
        paidLeaveOff,
        ok: assigned === 7 && !monthQuotaExceeded,
        message,
        monthUsedAfterWeek,
        monthLimit: limit,
      });
    }
    return result;
  }, [staffList, days, effectiveCode, monthlyOffByStaff, paidLeaveByStaff, weekStart]);

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
    if (!confirmWeek && pendingChanges.length === 0) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      const res = await saveShiftChangesApi(weekStart, pendingChanges, confirmWeek);
      const overrideCount = res.offOverrides?.length || 0;
      if (overrideCount > 0) {
        const names = Array.from(new Set(res.offOverrides!.map((o) => o.staffName))).join(", ");
        showToast(
          "ok",
          `Đã lưu lịch ca & gửi thông báo yêu cầu đi làm ngày OFF tới Sales: ${names}!`
        );
      } else if (confirmWeek) {
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


  return {
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
  };
}

export type ShiftScheduleViewModel = ReturnType<typeof useShiftSchedule>;

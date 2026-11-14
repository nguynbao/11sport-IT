"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Send,
  X,
  FileText,
  Trash2,
  Home,
  CalendarOff,
  Clock,
  LogOut,
  ChevronDown,
  Palmtree,
  Plus,
  CalendarDays,
  ArrowLeftRight,
} from "lucide-react";
import {
  LeaveRequestType,
  LeaveRequestStatus,
  MyLeaveRequest,
  ContractType,
  createLeaveRequestApi,
  fetchMyLeaveRequestsApi,
  cancelLeaveRequestApi,
} from "@/lib/api";

export const LEAVE_REASON_MAX = 100;

export const LEAVE_TYPE_META: Record<
  LeaveRequestType,
  { label: string; desc: string; cls: string; icon: React.ReactNode }
> = {
  PAID_LEAVE: {
    label: "Nghỉ phép có lương",
    desc: "Tích lũy 1–2 ngày phép thử việc + 1 ngày phép/tháng chính thức, được để dành cộng dồn (vẫn tính +1 công)",
    cls: "bg-teal-100 text-teal-800 border-teal-200",
    icon: <Palmtree className="w-3.5 h-3.5" />,
  },
  OFF: {
    label: "Xin nghỉ (OFF không lương)",
    desc: "Nghỉ nguyên ngày không tính công (từ 3 ngày/tuần trở đi phải tạo đơn trước tối thiểu 3 tuần)",
    cls: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <CalendarOff className="w-3.5 h-3.5" />,
  },
  CHANGE_OFF: {
    label: "Xin chuyển ngày off",
    desc: "Đổi ngày nghỉ đã đăng ký / đã được duyệt sang một ngày khác khi có việc đột xuất (chờ HR duyệt)",
    cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
  },
  WFH: {
    label: "Làm việc từ xa (WFH)",
    desc: "Không kiểm tra IP mạng khi chấm công ngày được duyệt",
    cls: "bg-sky-100 text-sky-800 border-sky-200",
    icon: <Home className="w-3.5 h-3.5" />,
  },
  LATE: {
    label: "Xin đi trễ",
    desc: "Báo trước lý do vào ca muộn để HR xét duyệt",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  EARLY: {
    label: "Xin về sớm",
    desc: "Khi được HR duyệt, được check-out sớm không cần xác nhận lại",
    cls: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <LogOut className="w-3.5 h-3.5" />,
  },
};

export interface AvailableOffDayOption {
  date: string;
  offType: "OFF" | "PAID_LEAVE";
  sourceLeaveId?: string;
  label: string;
}

const STATUS_META: Record<LeaveRequestStatus, { label: string; cls: string }> = {
  PENDING: { label: "Chờ HR duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-800" },
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDaysIso = (dateStr: string, deltaDays: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export function CreateLeaveModal({
  defaultDate,
  defaultType,
  defaultFromDate,
  availableOffDays = [],
  department,
  contractType,
  paidLeaveRemaining = 0,
  paidLeaveEntitled = 0,
  paidLeaveFromProbation = 0,
  salesOffRemaining,
  onClose,
  onSuccess,
}: {
  defaultDate?: string;
  defaultType?: LeaveRequestType;
  defaultFromDate?: string;
  availableOffDays?: AvailableOffDayOption[];
  department: "OFFICE" | "SALES";
  contractType?: ContractType;
  paidLeaveRemaining?: number;
  paidLeaveEntitled?: number;
  paidLeaveFromProbation?: number;
  salesOffRemaining?: number;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const isFulltime = contractType === "FULLTIME";
  const canUsePaidLeave = isFulltime && paidLeaveRemaining > 0;

  const types: LeaveRequestType[] = [
    ...(isFulltime ? (["PAID_LEAVE"] as LeaveRequestType[]) : []),
    "OFF",
    "CHANGE_OFF",
    "WFH",
    "LATE",
    "EARLY",
  ];

  const [type, setType] = useState<LeaveRequestType>(
    defaultType && types.includes(defaultType)
      ? defaultType
      : canUsePaidLeave
        ? "PAID_LEAVE"
        : "OFF"
  );
  const initialDate = defaultDate || todayIso();
  const [selectedDates, setSelectedDates] = useState<string[]>([initialDate]);
  const [fromDate, setFromDate] = useState<string>(
    defaultFromDate || availableOffDays[0]?.date || todayIso()
  );
  const [targetDate, setTargetDate] = useState<string>(
    defaultDate && defaultDate !== (defaultFromDate || availableOffDays[0]?.date)
      ? defaultDate
      : addDaysIso(defaultFromDate || availableOffDays[0]?.date || todayIso(), 1)
  );
  const [sourceOffType, setSourceOffType] = useState<"OFF" | "PAID_LEAVE">(
    () => {
      const found = availableOffDays.find((o) => o.date === (defaultFromDate || availableOffDays[0]?.date));
      return found?.offType || "OFF";
    }
  );
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const trimmedLen = reason.trim().length;
  const isMultiDayAllowed = type === "PAID_LEAVE" || type === "OFF" || type === "WFH";
  const maxDaysPerSubmit = type === "PAID_LEAVE" ? Math.min(7, Math.max(1, paidLeaveRemaining)) : 7;

  const updateDateAt = (idx: number, val: string) => {
    setSelectedDates((prev) => prev.map((d, i) => (i === idx ? val : d)));
  };

  const addNextConsecutiveDate = () => {
    setSelectedDates((prev) => {
      if (prev.length >= maxDaysPerSubmit) return prev;
      const last = prev[prev.length - 1] || todayIso();
      return [...prev, addDaysIso(last, 1)];
    });
  };

  const removeDateAt = (idx: number) => {
    setSelectedDates((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reason.trim();
    if (!clean) {
      setErr("Vui lòng nhập lý do");
      return;
    }
    if (clean.length > LEAVE_REASON_MAX) {
      setErr(`Lý do tối đa ${LEAVE_REASON_MAX} ký tự`);
      return;
    }

    if (type === "CHANGE_OFF") {
      if (!fromDate || !targetDate) {
        setErr("Vui lòng chọn ngày nghỉ hiện tại và ngày muốn chuyển sang");
        return;
      }
      if (fromDate === targetDate) {
        setErr("Ngày chuyển sang phải khác ngày nghỉ hiện tại");
        return;
      }
      setSending(true);
      setErr("");
      try {
        const matchedSource = availableOffDays.find((o) => o.date === fromDate);
        await createLeaveRequestApi({
          type: "CHANGE_OFF",
          fromDate,
          date: targetDate,
          sourceLeaveId: matchedSource?.sourceLeaveId,
          sourceOffType: matchedSource?.offType || sourceOffType,
          reason: clean,
        });
        onSuccess(
          `Đã gửi đơn xin chuyển ngày nghỉ (${fmtDate(fromDate)} → ${fmtDate(targetDate)}) — chờ HR duyệt`
        );
      } catch (e: any) {
        setErr(e?.message || "Gửi đơn chuyển ngày off thất bại");
      } finally {
        setSending(false);
      }
      return;
    }

    const uniqueDates = Array.from(new Set(selectedDates.filter(Boolean))).sort();
    if (uniqueDates.length === 0) {
      setErr("Vui lòng chọn ít nhất 1 ngày");
      return;
    }

    setSending(true);
    setErr("");
    let createdCount = 0;
    try {
      for (const d of uniqueDates) {
        await createLeaveRequestApi({ type, date: d, reason: clean });
        createdCount++;
      }
      onSuccess(
        uniqueDates.length > 1
          ? `Đã gửi ${createdCount} đơn ${LEAVE_TYPE_META[type].label} (${uniqueDates.map(fmtDate).join(", ")}) — chờ HR duyệt`
          : `Đã gửi đơn ${LEAVE_TYPE_META[type].label} ngày ${fmtDate(uniqueDates[0])} — chờ HR duyệt`
      );
    } catch (e: any) {
      const prefix = createdCount > 0 ? `(Đã tạo ${createdCount}/${uniqueDates.length} ngày) ` : "";
      setErr(prefix + (e?.message || "Gửi đơn thất bại"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Gửi đơn cho HR</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {!isFulltime && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              Hợp đồng hiện tại:{" "}
              <b>{contractType === "INTERN" ? "Thực tập" : "Thử việc (tối đa 2 tháng)"}</b> — mỗi tháng thử việc tích lũy <b>1 ngày phép có lương</b> và sẽ được <b>cộng dồn ngay khi chuyển sang Chính thức</b>.
            </div>
          )}

          {isFulltime && (
            <div className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[11px] text-teal-900 space-y-0.5">
              <div>
                Quỹ phép có lương tích lũy khả dụng:{" "}
                <b className="text-teal-700">{paidLeaveRemaining}/{paidLeaveEntitled} ngày</b>{" "}
                {paidLeaveFromProbation > 0 && (
                  <span className="text-teal-700">
                    (đã gồm +{paidLeaveFromProbation} ngày phép thử việc)
                  </span>
                )}
              </div>
              <div className="text-[10px] text-teal-700">
                Ngày phép chưa dùng được để dành cộng dồn sang các tháng sau. Dùng từ 2 ngày phép trở đi (tối đa 1 tuần = 7 ngày) cần tạo đơn trước tối thiểu 3 tuần (21 ngày).
              </div>
            </div>
          )}

          {department === "SALES" && typeof salesOffRemaining === "number" && (
            <div className="px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-900">
              Hạn mức nghỉ không lương (OFF) tháng này: còn{" "}
              <b>{salesOffRemaining}/4 ngày</b>. Nghỉ từ <b>3 ngày trở đi trong 1 tuần</b> bắt buộc tạo đơn trước <b>tối thiểu 3 tuần (21 ngày)</b>.
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600">Loại đơn</label>
            <div className="mt-1 grid grid-cols-1 gap-1.5">
              {types.map((t) => {
                const disabled = t === "PAID_LEAVE" && !canUsePaidLeave;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setType(t);
                      if (t !== "PAID_LEAVE" && t !== "OFF" && t !== "WFH") {
                        setSelectedDates((prev) => [prev[0] || todayIso()]);
                      }
                    }}
                    className={`text-left px-3 py-2 rounded-xl border text-xs transition flex items-start gap-2.5 ${
                      disabled
                        ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : type === t
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`mt-0.5 p-1.5 rounded-lg border ${LEAVE_TYPE_META[t].cls}`}>
                      {LEAVE_TYPE_META[t].icon}
                    </span>
                    <span className="flex-1">
                      <span className="font-bold text-slate-900 flex items-center justify-between gap-2">
                        <span>{LEAVE_TYPE_META[t].label}</span>
                        {t === "PAID_LEAVE" && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              canUsePaidLeave
                                ? "bg-teal-100 text-teal-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            Còn {paidLeaveRemaining}/{paidLeaveEntitled} ngày phép
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-500">{LEAVE_TYPE_META[t].desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === "CHANGE_OFF" ? (
            <div className="space-y-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 p-3">
              <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                Thông tin chuyển đổi ngày nghỉ (Chờ HR duyệt)
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  1. Ngày nghỉ hiện tại cần đổi (Ngày cũ)
                </label>
                {availableOffDays.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {availableOffDays.map((opt) => {
                      const active = fromDate === opt.date;
                      return (
                        <button
                          key={opt.date}
                          type="button"
                          onClick={() => {
                            setFromDate(opt.date);
                            setSourceOffType(opt.offType);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            active
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {fmtDate(opt.date)} ({opt.offType === "PAID_LEAVE" ? "Phép" : "OFF"})
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromDate(val);
                    const matched = availableOffDays.find((o) => o.date === val);
                    if (matched) setSourceOffType(matched.offType);
                  }}
                  required
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                />
                <div className="mt-1 text-[10px] text-slate-500">
                  Chọn ngày nghỉ (OFF hoặc Nghỉ phép) bạn đã đăng ký / đã được duyệt cần chuyển đi.
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2. Ngày muốn chuyển sang nghỉ (Ngày mới)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div className="text-[10px] text-indigo-800 bg-white/80 rounded-lg px-2.5 py-1.5 border border-indigo-100">
                Khi HR duyệt đơn: ngày <b>{fmtDate(fromDate)}</b> sẽ trở lại ngày đi làm bình thường và ngày{" "}
                <b>{fmtDate(targetDate)}</b> được chuyển thành ngày nghỉ.
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                  Ngày áp dụng ({selectedDates.length} ngày)
                </label>
                {isMultiDayAllowed && selectedDates.length < maxDaysPerSubmit && (
                  <button
                    type="button"
                    onClick={addNextConsecutiveDate}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm ngày liên tiếp (tối đa {maxDaysPerSubmit} ngày)
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-1.5">
                {selectedDates.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={d}
                      onChange={(e) => updateDateAt(idx, e.target.value)}
                      required
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                    />
                    {selectedDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDateAt(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        title="Xóa ngày này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">Lý do *</label>
              <span
                className={`text-[11px] font-mono ${
                  trimmedLen > LEAVE_REASON_MAX ? "text-rose-600 font-bold" : "text-slate-400"
                }`}
              >
                {trimmedLen}/{LEAVE_REASON_MAX}
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, LEAVE_REASON_MAX))}
              maxLength={LEAVE_REASON_MAX}
              rows={2}
              required
              placeholder={`Nhập ngắn gọn lý do (tối đa ${LEAVE_REASON_MAX} ký tự)...`}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {err && <div className="text-xs text-rose-600 font-semibold whitespace-pre-line">{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Đang gửi..." : "Gửi đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type LeaveFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export function MyLeaveRequestsPanel({
  reloadKey,
  onCreate,
  onRequestChangeOff,
  onChanged,
}: {
  reloadKey: number;
  onCreate: () => void;
  onRequestChangeOff?: (leave: MyLeaveRequest) => void;
  onChanged: (msg: string) => void;
}) {
  const [list, setList] = useState<MyLeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<LeaveFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await fetchMyLeaveRequestsApi());
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const counts: Record<LeaveFilter, number> = {
    ALL: list.length,
    PENDING: list.filter((l) => l.status === "PENDING").length,
    APPROVED: list.filter((l) => l.status === "APPROVED").length,
    REJECTED: list.filter((l) => l.status === "REJECTED").length,
  };
  const shown = list.filter((l) => filter === "ALL" || l.status === filter);

  const cancel = async (id: string) => {
    if (!confirm("Hủy đơn này?")) return;
    try {
      await cancelLeaveRequestApi(id);
      onChanged("Đã hủy đơn");
      load();
    } catch (e: any) {
      alert(e?.message || "Không hủy được đơn");
    }
  };

  const FILTERS: [LeaveFilter, string][] = [
    ["ALL", "Tất cả"],
    ["PENDING", "Chờ"],
    ["APPROVED", "Duyệt"],
    ["REJECTED", "Từ chối"],
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:max-h-[calc(100vh-140px)]">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 min-w-0">
          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Đơn từ của tôi</span>
          {counts.PENDING > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
              {counts.PENDING} chờ
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onCreate}
          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
        >
          <Send className="w-3 h-3" />
          Tạo đơn
        </button>
      </div>

      <div className="px-3 py-2 border-b border-slate-100">
        <div className="grid grid-cols-4 bg-slate-100 rounded-lg p-0.5 text-[10px] font-semibold">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-1 py-1 rounded-md truncate ${
                filter === k ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && list.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải đơn từ...</div>
        ) : shown.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-slate-400">
            Chưa có đơn nào.
            <br />
            Bấm <b>Tạo đơn</b> để xin nghỉ, WFH, đi trễ hoặc về sớm.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((l) => {
              const meta = LEAVE_TYPE_META[l.type];
              const st = STATUS_META[l.status];
              const open = openId === l._id;
              return (
                <li key={l._id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : l._id)}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-left transition ${
                      open ? "bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center ${meta.cls}`}
                      title={meta.label}
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-slate-900 truncate">
                        {meta?.label || l.type}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        {l.type === "CHANGE_OFF" && l.fromDate
                          ? `${fmtDate(l.fromDate)} → ${fmtDate(l.date)}`
                          : fmtDate(l.date)}
                      </span>
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {open && (
                    <div className="px-3 pb-2.5 pt-1 bg-slate-50 space-y-1.5 text-[11px]">
                      {l.type === "CHANGE_OFF" && l.fromDate && (
                        <div className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                          Chuyển ngày nghỉ ({l.sourceOffType === "PAID_LEAVE" ? "Phép có lương" : "OFF không lương"}):{" "}
                          <b>{fmtDate(l.fromDate)}</b> → <b>{fmtDate(l.date)}</b>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Lý do: </span>
                        <span className="text-slate-700 break-words">{l.reason}</span>
                      </div>
                      {l.reviewNote && (
                        <div>
                          <span className="text-slate-400">HR: </span>
                          <span className="text-slate-600 italic break-words">{l.reviewNote}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {(l.type === "OFF" || l.type === "PAID_LEAVE") &&
                          (l.status === "APPROVED" || l.status === "PENDING") &&
                          onRequestChangeOff && (
                            <button
                              type="button"
                              onClick={() => onRequestChangeOff(l)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              Đổi ngày off
                            </button>
                          )}
                        {l.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => cancel(l._id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hủy đơn
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

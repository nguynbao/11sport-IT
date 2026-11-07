"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LeaveRequestType,
  MyLeaveRequest,
  createLeaveRequestApi,
  fetchMyLeaveRequestsApi,
  cancelLeaveRequestApi,
} from "@/lib/api";
import {
  X,
  Send,
  FileText,
  Trash2,
  Home,
  CalendarOff,
  Clock3,
  LogOut as LogOutIcon,
  BadgeCheck,
  Lock,
  ChevronDown,
} from "lucide-react";

export const CONTRACT_LABEL: Record<string, string> = {
  FULLTIME: "Chính thức",
  PROBATION: "Thử việc",
  INTERN: "Thực tập",
  PARTTIME: "Bán thời gian (cũ)",
};

/** Độ dài tối đa của lý do trong đơn từ (khớp server) */
export const LEAVE_REASON_MAX = 100;

/** Chỉ nhân viên hợp đồng Chính thức mới được dùng ngày nghỉ phép có lương */
export function isPaidLeaveEligible(contractType?: string | null): boolean {
  return contractType === "FULLTIME";
}

export const LEAVE_TYPE_META: Record<
  LeaveRequestType,
  { label: string; desc: string; cls: string; icon: React.ReactNode }
> = {
  PAID_LEAVE: {
    label: "Nghỉ phép có lương",
    desc: "HĐ Chính thức • 1 ngày/tháng",
    cls: "bg-teal-100 text-teal-800 border-teal-300",
    icon: <BadgeCheck className="w-4 h-4" />,
  },
  OFF: {
    label: "Xin off",
    desc: "Nghỉ cả ngày, không tính công",
    cls: "bg-sky-100 text-sky-800 border-sky-300",
    icon: <CalendarOff className="w-4 h-4" />,
  },
  WFH: {
    label: "Làm từ xa (WFH)",
    desc: "Chỉ khối Văn phòng",
    cls: "bg-purple-100 text-purple-800 border-purple-300",
    icon: <Home className="w-4 h-4" />,
  },
  LATE: {
    label: "Xin đi trễ",
    desc: "Đến muộn có lý do",
    cls: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: <Clock3 className="w-4 h-4" />,
  },
  EARLY: {
    label: "Xin về sớm",
    desc: "Về trước giờ kết ca",
    cls: "bg-pink-100 text-pink-800 border-pink-300",
    icon: <LogOutIcon className="w-4 h-4" />,
  },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-700" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Modal tạo đơn (hỗ trợ nghỉ / WFH nhiều ngày liên tiếp)
// ---------------------------------------------------------------------------
export function LeaveRequestModal({
  department,
  contractType,
  defaultDate,
  defaultType,
  onClose,
  onSubmitted,
}: {
  department: string;
  contractType?: string;
  defaultDate?: string;
  defaultType?: LeaveRequestType;
  onClose: () => void;
  onSubmitted: (msg: string) => void;
}) {
  const isFulltime = isPaidLeaveEligible(contractType);
  const contractLabel = CONTRACT_LABEL[contractType || ""] || "Chưa cập nhật";
  // Luôn hiển thị "Nghỉ phép có lương" nhưng KHOÁ nếu chưa phải nhân viên Chính thức
  const types: LeaveRequestType[] = [
    "PAID_LEAVE",
    "OFF",
    ...(department === "OFFICE" ? (["WFH"] as LeaveRequestType[]) : []),
    "LATE",
    "EARLY",
  ];
  const today = toDateStr(new Date());
  const [type, setType] = useState<LeaveRequestType>(
    defaultType && types.includes(defaultType) && (defaultType !== "PAID_LEAVE" || isFulltime)
      ? defaultType
      : isFulltime
        ? "PAID_LEAVE"
        : "OFF"
  );
  const [fromDate, setFromDate] = useState(defaultDate || today);
  const [toDate, setToDate] = useState(defaultDate || today);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allowRange = type === "OFF" || type === "WFH";

  const dates = useMemo(() => {
    if (!allowRange) return [fromDate];
    const out: string[] = [];
    const [y1, m1, d1] = fromDate.split("-").map(Number);
    const [y2, m2, d2] = (toDate || fromDate).split("-").map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    for (let d = new Date(start); d <= end && out.length < 31; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue; // bỏ Chủ nhật
      out.push(toDateStr(d));
    }
    return out;
  }, [allowRange, fromDate, toDate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do.");
      return;
    }
    if (allowRange && toDate < fromDate) {
      setErr("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
      return;
    }
    if (dates.length === 0) {
      setErr("Khoảng ngày chọn không có ngày làm việc nào (đã bỏ Chủ nhật).");
      return;
    }
    setSending(true);
    setErr(null);
    const failed: string[] = [];
    for (const date of dates) {
      try {
        await createLeaveRequestApi({ type, date, reason: reason.trim() });
      } catch (e: any) {
        failed.push(`${fmtDate(date)}: ${e?.message || "lỗi"}`);
      }
    }
    setSending(false);
    const ok = dates.length - failed.length;
    if (failed.length && ok === 0) {
      setErr(failed.join("\n"));
      return;
    }
    onSubmitted(
      `Đã gửi ${ok} đơn "${LEAVE_TYPE_META[type].label}"${failed.length ? ` (${failed.length} ngày lỗi/trùng)` : ""}, chờ HR duyệt`
    );
  };

  return (
    <div className="fixed inset-0 z-[65] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Tạo đơn xin phép
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {types.map((t) => {
              const meta = LEAVE_TYPE_META[t];
              const active = type === t;
              const locked = t === "PAID_LEAVE" && !isFulltime;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && setType(t)}
                  title={locked ? `Chỉ nhân viên hợp đồng Chính thức mới được dùng (HĐ của bạn: ${contractLabel})` : undefined}
                  className={`p-2.5 rounded-xl border-2 text-left transition ${locked
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                    : active
                      ? `${meta.cls} ring-2 ring-offset-1 ring-emerald-500`
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    {locked ? <Lock className="w-4 h-4" /> : meta.icon}
                    {meta.label}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">{locked ? "Chỉ dành cho NV Chính thức" : meta.desc}</div>
                </button>
              );
            })}
          </div>
          {type === "PAID_LEAVE" && (
            <p className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5">
              Hợp đồng Chính thức được 1 ngày nghỉ phép có lương mỗi tháng (vẫn tính 1 công). Không dùng trong tháng sẽ mất quyền
              lợi, không cộng dồn sang tháng sau.
            </p>
          )}
          {department !== "OFFICE" && (
            <p className="text-[11px] text-slate-400">Khối Bán hàng không áp dụng hình thức làm từ xa (WFH).</p>
          )}

          <div className={`grid gap-2 ${allowRange ? "grid-cols-2" : "grid-cols-1"}`}>
            <label className="text-xs font-semibold text-slate-600">
              {allowRange ? "Từ ngày *" : "Ngày *"}
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (toDate < e.target.value) setToDate(e.target.value);
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            {allowRange && (
              <label className="text-xs font-semibold text-slate-600">
                Đến ngày *
                <input
                  type="date"
                  required
                  min={fromDate}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            )}
          </div>
          {allowRange && dates.length > 1 && (
            <p className="text-[11px] text-emerald-700 font-semibold">
              Sẽ tạo {dates.length} đơn cho {dates.length} ngày làm việc (đã bỏ Chủ nhật).
            </p>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do *
            <textarea
              rows={3}
              maxLength={LEAVE_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, LEAVE_REASON_MAX))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <span
              className={`block text-right text-[10px] mt-0.5 ${
                reason.length >= LEAVE_REASON_MAX ? "text-rose-600 font-bold" : "text-slate-400"
              }`}
            >
              {reason.length}/{LEAVE_REASON_MAX} ký tự
            </span>
          </label>

          {err && <div className="text-xs text-rose-600 font-semibold whitespace-pre-line">{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
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

// ---------------------------------------------------------------------------
// Danh sách "Đơn từ của tôi" — dạng gọn, mỗi đơn là 1 dòng thả xuống (accordion)
// ---------------------------------------------------------------------------
type LeaveFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export function MyLeaveRequestsPanel({
  reloadKey,
  onCreate,
  onChanged,
}: {
  reloadKey: number;
  onCreate: () => void;
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
      {/* Tiêu đề + nút tạo đơn */}
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

      {/* Bộ lọc trạng thái gọn */}
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

      {/* Danh sách dạng thả xuống */}
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
                      <span className="block text-[11px] font-bold text-slate-900 truncate">{meta.label}</span>
                      <span className="block text-[10px] text-slate-500 font-mono">{fmtDate(l.date)}</span>
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${st.cls}`}>{st.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div className="px-3 pb-2.5 pt-1 bg-slate-50 space-y-1.5 text-[11px]">
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

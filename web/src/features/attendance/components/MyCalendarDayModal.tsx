"use client";

import React, { useState } from "react";
import type { LeaveRequestType, MyCalendarCell, MyCalendarDay } from "@/shared/types";
import { isPaidLeaveEligible, LEAVE_REASON_MAX, createLeaveRequestApi } from "@/features/leave";
import { STATUS, LEAVE_TYPE_LABEL, LEAVE_STATUS, WEEK_HEADERS, fmtMinutes } from "../myCalendar.constants";
import { CheckCircle2, AlertTriangle, Clock, X, Send, RefreshCw, Timer, FileText, Info } from "lucide-react";

export default function MyCalendarDayModal({
  day,
  cell,
  department,
  contractType,
  multiplier,
  onClose,
  onRequestChangeOff,
  onSubmitted,
}: {
  day: MyCalendarDay;
  cell: MyCalendarCell;
  department: string;
  contractType?: string;
  multiplier: number;
  onClose: () => void;
  onRequestChangeOff?: (fromDate: string, sourceLeaveId?: string) => void;
  onSubmitted: (msg: string) => void;
}) {
  const paidLeaveAllowed = isPaidLeaveEligible(contractType);
  const st = cell.code === "HOLIDAY" && !cell.isPaidHoliday ? STATUS.DAY_OFF : STATUS[cell.code];
  const [yy, mm, dd] = day.date.split("-");
  const leaveTypes: LeaveRequestType[] = ["PAID_LEAVE", "OFF", "WFH", "LATE", "EARLY"];
  const activeOffLeave = (cell.leaveRequests || []).find(
    (l) =>
      (l.type === "OFF" || l.type === "PAID_LEAVE") &&
      (l.status === "APPROVED" || l.status === "PENDING")
  );
  const canChangeOffFromThisDay =
    Boolean(activeOffLeave) ||
    cell.code === "LEAVE" ||
    cell.code === "PAID_LEAVE" ||
    (department === "SALES" && cell.code === "DAY_OFF");

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<LeaveRequestType>(cell.code === "ABSENT" ? "OFF" : "EARLY");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await createLeaveRequestApi({ type, date: day.date, reason: reason.trim() });
      onSubmitted(`Đã gửi đơn "${LEAVE_TYPE_LABEL[type]}" ngày ${dd}/${mm}, chờ HR duyệt`);
    } catch (e: any) {
      setErr(e?.message || "Không gửi được đơn");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              {WEEK_HEADERS[day.weekday]}, {dd}/{mm}/{yy}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3 h-3 rounded ${st.dot}`} />
              <span className="text-base font-extrabold text-slate-900">{st.label}</span>
            </div>
            {day.holiday && (
              <span
                className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${day.holiday.isOfficialDayOff ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                  }`}
              >
                {day.holiday.isOfficialDayOff ? "Lễ chính thức" : "Sự kiện"}: {day.holiday.name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          {cell.attendanceId ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <InfoBox label="Giờ vào" value={cell.checkIn || "—"} />
              <InfoBox label="Giờ ra" value={cell.checkOut || "Chưa ra"} danger={!cell.checkOut} />
              <InfoBox label="Giờ công" value={cell.hours ? `${cell.hours}h` : "—"} />
            </div>
          ) : (
            <div className="text-xs text-slate-500">Không có dữ liệu chấm công ngày này.</div>
          )}

          <div className="space-y-1.5 text-xs">
            {cell.shiftCode && (
              <Row
                icon={<Clock className="w-3.5 h-3.5" />}
                text={
                  cell.shiftCode === "BOTH"
                    ? "Ca 1 + Ca 2 (08:30 – 21:00)"
                    : cell.shiftCode === "SHIFT_2"
                      ? "Ca 2 (12:00 – 21:00)"
                      : "Ca 1 (08:30 – 17:30)"
                }
              />
            )}
            {!!cell.lateMinutes && cell.lateMinutes > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />}
                text={`Đi trễ ${cell.lateMinutes} phút${cell.lateApproved ? " (có đơn được duyệt)" : ""}`}
              />
            )}
            {!!cell.earlyMinutes && cell.earlyMinutes > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-pink-600" />}
                text={`Về sớm ${cell.earlyMinutes} phút${cell.earlyApproved ? " (có đơn xin về sớm)" : ""}`}
              />
            )}
            {!!cell.overtimeMinutes && (
              <Row
                icon={<Timer className="w-3.5 h-3.5 text-brand-ink" />}
                text={`Tăng ca ${fmtMinutes(cell.overtimeMinutes)} (Đã được HR phê duyệt)`}
              />
            )}
            {!cell.overtimeMinutes && cell.overtimeStatus === "PENDING" && !!cell.lateCheckoutMinutes && (
              <Row
                icon={<Timer className="w-3.5 h-3.5 text-amber-600" />}
                text={`Check-out trễ ${cell.lateCheckoutMinutes} phút – Đang chờ HR xem xét tính tăng ca${cell.lateCheckoutReason ? ` (Lý do: ${cell.lateCheckoutReason})` : ""
                  }`}
              />
            )}
            {!cell.overtimeMinutes && cell.overtimeStatus === "REJECTED" && !!cell.lateCheckoutMinutes && (
              <Row
                icon={<Timer className="w-3.5 h-3.5 text-slate-500" />}
                text={`Check-out trễ ${cell.lateCheckoutMinutes} phút – HR xác nhận không tính tăng ca${cell.lateCheckoutReason ? ` (Lý do: ${cell.lateCheckoutReason})` : ""
                  }`}
              />
            )}
            {cell.isHolidayWork && (
              <Row
                icon={<span className="px-1 rounded bg-rose-600 text-white text-[9px] font-black">x{multiplier}</span>}
                text={`Đi làm ngày lễ chính thức – hưởng lương x${multiplier}`}
              />
            )}
            {day.holiday?.isOfficialDayOff && department === "SALES" && (
              <Row
                icon={<Info className="w-3.5 h-3.5 text-rose-600" />}
                text={`Khối Bán hàng: ngày lễ vẫn đi làm bình thường (không có ngày nghỉ mặc định), hưởng lương x${multiplier}.`}
              />
            )}
            {cell.isPaidHoliday && cell.code === "HOLIDAY" && (
              <Row icon={<CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />} text="Nghỉ lễ hưởng nguyên lương (+1 công)" />
            )}
            {cell.code === "MISSING_OUT" && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                text="Bạn chưa check-out ngày này. Liên hệ HR để điều chỉnh giờ ra."
              />
            )}
            {cell.adjusted && (
              <Row
                icon={<Info className="w-3.5 h-3.5 text-slate-500" />}
                text={`HR ${cell.adjustedByName || ""} đã điều chỉnh: ${cell.adjustReason || ""}`}
              />
            )}
          </div>

          {/* Đơn từ của ngày */}
          {(cell.leaveRequests || []).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Đơn từ ngày này
              </div>
              {cell.leaveRequests!.map((l) => (
                <div key={l.id} className="p-2 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      {l.type === "CHANGE_OFF" && l.fromDate
                        ? `Xin chuyển ngày off (${l.fromDate.split("-").reverse().join("/")} → ${(l.date || day.date).split("-").reverse().join("/")})`
                        : LEAVE_TYPE_LABEL[l.type]}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEAVE_STATUS[l.status]?.cls}`}>
                      {LEAVE_STATUS[l.status]?.label}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5 break-words">{l.reason}</div>
                  {l.reviewNote && <div className="text-slate-400 italic mt-0.5">HR: {l.reviewNote}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Nút xin chuyển ngày off sang ngày khác (khi ngày này là ngày nghỉ / đã xin off) */}
          {canChangeOffFromThisDay && onRequestChangeOff && (
            <button
              type="button"
              onClick={() => onRequestChangeOff(day.date, activeOffLeave?.id)}
              className="w-full py-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-brand-ink hover:bg-indigo-100 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Xin chuyển ngày off {dd}/{mm} sang ngày khác
            </button>
          )}

          {/* Gửi đơn */}
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-brand-ink hover:bg-blue-50 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi đơn cho ngày này
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-2 gap-1.5">
                {leaveTypes.map((t) => {
                  const locked = t === "PAID_LEAVE" && !paidLeaveAllowed;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setType(t)}
                      title={locked ? "Chỉ nhân viên hợp đồng Chính thức mới được dùng" : undefined}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${locked
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through"
                        : type === t
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      {LEAVE_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              <div>
                <textarea
                  rows={2}
                  maxLength={LEAVE_REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, LEAVE_REASON_MAX))}
                  placeholder="Lý do..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <span
                  className={`block text-right text-[10px] ${reason.length >= LEAVE_REASON_MAX ? "text-rose-600 font-bold" : "text-slate-400"
                    }`}
                >
                  {reason.length}/{LEAVE_REASON_MAX} ký tự
                </span>
              </div>
              {err && <div className="text-xs text-rose-600 font-semibold">{err}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {sending ? "Đang gửi..." : "Gửi đơn"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`font-mono font-extrabold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-slate-700">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

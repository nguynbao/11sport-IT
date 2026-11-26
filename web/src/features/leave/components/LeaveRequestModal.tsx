"use client";

import React from "react";
import type { LeaveRequestType } from "@/shared/types";
import { X, Send, FileText, Lock } from "lucide-react";
import { LEAVE_REASON_MAX, LEAVE_TYPE_META, fmtDate } from "../leave.constants";
import { useLeaveRequestForm } from "../hooks/useLeaveRequests";

export function LeaveRequestModal({
  department,
  contractType,
  defaultDate,
  defaultFromDate,
  defaultSourceLeaveId,
  defaultType,
  onClose,
  onSubmitted,
}: {
  department: string;
  contractType?: string;
  defaultDate?: string;
  defaultFromDate?: string;
  defaultSourceLeaveId?: string;
  defaultType?: LeaveRequestType;
  onClose: () => void;
  onSubmitted: (msg: string) => void;
}) {
  const {
    isFulltime, contractLabel, types, type, setType,
    fromDate, setFromDate, toDate, setToDate,
    changeFromDate, setChangeFromDate, changeToDate, setChangeToDate,
    setSelectedSourceLeaveId, existingOffRequests, reason, setReason,
    sending, err, allowRange, dates, submit,
  } = useLeaveRequestForm({
    department, contractType, defaultDate, defaultFromDate, defaultSourceLeaveId, defaultType, onSubmitted,
  });

  return (
    <div className="fixed inset-0 z-[65] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-ink" />
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
                      ? `${meta.cls} ring-2 ring-offset-1 ring-blue-500`
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
            <p className="text-[11px] text-brand-ink bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5">
              <b>Quy định cộng dồn phép:</b> Thử việc lên Chính thức được cộng số ngày phép tương ứng tháng thử việc (1–2 ngày) + mỗi tháng Chính thức có thêm <b>1 ngày phép</b> (hưởng nguyên lương). Ngày phép được <b>để dành cộng dồn</b> và dùng liên tiếp tối đa <b>1 tuần (7 ngày)</b> với điều kiện <b>từ 2 ngày phép trở đi phải tạo đơn trước tối thiểu 3 tuần (21 ngày)</b>.
            </p>
          )}
          {type === "OFF" && department === "SALES" && (
            <p className="text-[11px] text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
              Nhân viên Sales có tối đa <b>4 ngày nghỉ không lương (OFF)/tháng</b>. Khi đăng ký ca tuần mặc định chỉ được nghỉ tối đa <b>2 ngày/tuần</b> (1 ngày OFF + 1 ngày phép); nếu muốn nghỉ <b>từ 3 ngày trở đi trong 1 tuần</b> thì bắt buộc phải <b>tạo đơn trước tối thiểu 3 tuần (21 ngày)</b>.
            </p>
          )}
          {type === "CHANGE_OFF" && (
            <div className="space-y-2">
              <p className="text-[11px] text-brand-ink bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5">
                <b>Xin chuyển ngày off:</b> Dùng khi bạn đã xin off / có lịch off vào một ngày (VD: 20/11) nhưng có việc đột xuất muốn đổi sang nghỉ ngày khác (VD: 19/11). Đơn đổi ngày off sẽ <b>cần HR duyệt</b> mới có hiệu lực.
              </p>
              {existingOffRequests.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Chọn nhanh ngày đã xin nghỉ của bạn:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {existingOffRequests.slice(0, 8).map((item) => {
                      const isSelected = changeFromDate === item.date;
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => {
                            setChangeFromDate(item.date);
                            setSelectedSourceLeaveId(item._id);
                          }}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition ${isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          {fmtDate(item.date)} ({item.type === "PAID_LEAVE" ? "Phép" : "OFF"})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {type === "CHANGE_OFF" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Ngày off hiện tại (cần đổi) *
                <input
                  type="date"
                  required
                  value={changeFromDate}
                  onChange={(e) => {
                    setChangeFromDate(e.target.value);
                    const matched = existingOffRequests.find((r) => r.date === e.target.value);
                    setSelectedSourceLeaveId(matched?._id);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Đổi sang nghỉ ngày *
                <input
                  type="date"
                  required
                  value={changeToDate}
                  onChange={(e) => setChangeToDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>
          ) : (
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
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              )}
            </div>
          )}
          {type !== "CHANGE_OFF" && allowRange && dates.length > 1 && (
            <p className="text-[11px] text-brand-ink font-semibold">
              Sẽ tạo {dates.length} đơn cho {dates.length} ngày làm việc
              {department === "OFFICE" ? " (đã bỏ Chủ nhật)" : ""}.
            </p>
          )}
          {type === "CHANGE_OFF" && changeFromDate && changeToDate && changeFromDate !== changeToDate && (
            <p className="text-[11px] text-brand-ink font-semibold">
              Xin chuyển ngày nghỉ từ <b>{fmtDate(changeFromDate)}</b> sang nghỉ ngày <b>{fmtDate(changeToDate)}</b> (cần HR duyệt).
            </p>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do *
            <textarea
              rows={3}
              maxLength={LEAVE_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, LEAVE_REASON_MAX))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <span
              className={`block text-right text-[10px] mt-0.5 ${reason.length >= LEAVE_REASON_MAX ? "text-rose-600 font-bold" : "text-slate-400"
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
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

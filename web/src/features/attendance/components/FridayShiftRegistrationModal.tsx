"use client";

import React from "react";
import { Calendar, CheckCircle2, AlertCircle, X, Send } from "lucide-react";
import { addLocalDays } from "../utils/fridayShift";
import { useFridayShiftRegistration } from "../hooks/useFridayShiftRegistration";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function FridayShiftRegistrationModal({ onClose, onSuccess }: Props) {
  const {
    nextMondayStr, isConfirmedByHr, loadingExisting, paidLeaveQuota, preferences,
    submitting, errorMsg, availablePaidLeaveForReg, canUsePaidLeaveInReg,
    handleToggleOff, handleToggleShift, workCount, doubleShiftDays, unpaidOffCount,
    paidLeaveOffCount, unselectedCount, maxOffThisWeek, usedOutsideWeek, monthlyLimit,
    isRuleValid, handleSubmit,
  } = useFridayShiftRegistration({ onSuccess });

  const weekEndStr = addLocalDays(nextMondayStr, 6);
  const [, wsM, wsD] = nextMondayStr.split("-");
  const [weY, weM, weD] = weekEndStr.split("-");

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
      <div className="bg-white text-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">
                Đăng Ký Ca Tuần Sau ({wsD}/{wsM} – {weD}/{weM}/{weY})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chọn đủ 7 ngày • Đăng ký ca tối đa 2 ngày nghỉ/tuần (1 ngày OFF + 1 ngày phép) • Từ 3 ngày phải tạo đơn trước 3 tuần
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isConfirmedByHr && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-brand-ink font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
              <span>
                Lịch ca tuần sau đã được HR xác nhận chính thức. Nếu cần đổi ca hoặc đổi ngày nghỉ, vui lòng liên hệ trực tiếp HR.
              </span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>Quy định đăng ký ca tuần:</b> Tối đa <b>2 ngày nghỉ/tuần</b> gồm <b>1 ngày OFF không lương</b> (hạn mức tháng:{" "}
                <b>{usedOutsideWeek}/{monthlyLimit}</b> ngày đã dùng • còn <b>{maxOffThisWeek}</b> ngày) và{" "}
                <b>1 ngày phép có lương</b> (quỹ phép tích lũy còn:{" "}
                <b>{paidLeaveQuota?.eligible ? `${availablePaidLeaveForReg} ngày` : "0 ngày (chỉ áp dụng HĐ Chính thức)"}</b>).
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] shrink-0 ${
                  isRuleValid
                    ? "bg-blue-100 text-brand-ink"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {workCount} ngày làm{doubleShiftDays > 0 ? ` (${doubleShiftDays} ngày 2 ca)` : ""} • {unpaidOffCount} OFF • {paidLeaveOffCount} Phép{" "}
                {isRuleValid ? "✓" : unselectedCount > 0 ? `(Chưa chọn ${unselectedCount} ngày)` : "(Chưa hợp lệ)"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Từ <b>3 ngày nghỉ/tuần trở đi</b> (hoặc dùng <b>từ 2 ngày phép trở đi</b>) bắt buộc phải tạo đơn tại mục <b>Tạo đơn</b> trước tối thiểu <b>3 tuần (21 ngày)</b>.
            </div>
          </div>

          {loadingExisting ? (
            <div className="py-8 text-center text-slate-400">Đang tải thông tin đăng ký ca...</div>
          ) : (
            <div className="space-y-2.5">
              {preferences.map((item, idx) => (
                <div
                  key={item.date}
                  className={`p-3 rounded-2xl border transition flex flex-wrap items-center justify-between gap-3 ${
                    item.isOff && item.leaveType === "PAID_LEAVE"
                      ? "bg-teal-50/60 border-teal-200 text-teal-900"
                      : item.isOff
                      ? "bg-rose-50/50 border-rose-200 text-rose-800"
                      : item.shift1 || item.shift2
                      ? "bg-indigo-50/30 border-indigo-200 text-slate-800"
                      : "bg-white border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{item.dayName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.date}</div>
                    </div>
                    {!item.isOff && item.shift1 && item.shift2 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-brand-ink text-[10px] font-extrabold">
                        2 ca
                      </span>
                    )}
                    {item.isFormalLeave && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                        Đã có đơn ({item.leaveType === "PAID_LEAVE" ? "Nghỉ phép" : "OFF"})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={isConfirmedByHr || item.isFormalLeave}
                      onClick={() => handleToggleShift(idx, "SHIFT_1")}
                      className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                        !item.isOff && item.shift1
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      } disabled:opacity-60`}
                    >
                      Ca 1 (8h30-17h30)
                    </button>

                    <button
                      type="button"
                      disabled={isConfirmedByHr || item.isFormalLeave}
                      onClick={() => handleToggleShift(idx, "SHIFT_2")}
                      className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                        !item.isOff && item.shift2
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      } disabled:opacity-60`}
                    >
                      Ca 2 (12h-21h)
                    </button>

                    <button
                      type="button"
                      disabled={isConfirmedByHr || item.isFormalLeave}
                      onClick={() => handleToggleOff(idx, "OFF")}
                      className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                        item.isOff && item.leaveType === "OFF"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600"
                      } disabled:opacity-60`}
                    >
                      Xin OFF
                    </button>

                    <button
                      type="button"
                      disabled={isConfirmedByHr || item.isFormalLeave || !canUsePaidLeaveInReg}
                      onClick={() => handleToggleOff(idx, "PAID_LEAVE")}
                      title={
                        !paidLeaveQuota?.eligible
                          ? "Chỉ áp dụng cho Hợp đồng Chính thức"
                          : availablePaidLeaveForReg < 1
                          ? "Đã hết ngày phép tích lũy"
                          : "Sử dụng 1 ngày nghỉ phép có lương"
                      }
                      className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                        item.isOff && item.leaveType === "PAID_LEAVE"
                          ? "bg-teal-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-brand-ink"
                      } disabled:opacity-50`}
                    >
                      Nghỉ phép
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Đóng
            </button>
            {!isConfirmedByHr && (
              <button
                type="submit"
                disabled={submitting || !isRuleValid}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Đang gửi đăng ký..." : "Gửi Đăng Ký Cho HR"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

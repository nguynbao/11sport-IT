"use client";

import React, { useState } from "react";
import { submitShiftPreferencesApi } from "@/lib/api";
import { Calendar, CheckCircle2, AlertCircle, X, Send } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function FridayShiftRegistrationModal({ onClose, onSuccess }: Props) {
  // Tính ngày Thứ Hai tuần kế tiếp
  const nextMondayStr = (() => {
    const d = new Date();
    const day = d.getDay(); // 5 = Thứ Sáu
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    const nextMon = new Date(d);
    nextMon.setDate(d.getDate() + daysUntilNextMonday);
    return nextMon.toISOString().slice(0, 10);
  })();

  const [preferences, setPreferences] = useState<
    Array<{ date: string; dayOfWeek: number; dayName: string; isOff: boolean; shift: "SHIFT_1" | "SHIFT_2" }>
  >(() => {
    const dayNames = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nextMondayStr);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        dayOfWeek: i + 1,
        dayName: dayNames[i],
        isOff: false,
        shift: "SHIFT_1" as const,
      };
    });
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleToggleOff = (index: number) => {
    setPreferences((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, isOff: !item.isOff } : item))
    );
  };

  const handleSetShift = (index: number, shift: "SHIFT_1" | "SHIFT_2") => {
    setPreferences((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, shift, isOff: false } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      await submitShiftPreferencesApi({
        weekStart: nextMondayStr,
        preferences: preferences.map((p) => ({
          date: p.date,
          dayOfWeek: p.dayOfWeek,
          isOffRequested: p.isOff,
          preferenceShift: p.shift,
        })),
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi gửi đăng ký ca");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Đăng Ký Ca Làm Việc Tuần Tới</h3>
              <p className="text-xs text-slate-400 mt-0.5">Thứ 6 hàng tuần: Đăng ký lịch bận & ca mong muốn</p>
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            Hệ thống sẽ tự động xếp ca dựa trên đăng ký của bạn. Trường hợp trùng lịch nhiều người cùng xin nghỉ, HR sẽ phân ca lại.
          </div>

          <div className="space-y-2.5">
            {preferences.map((item, idx) => (
              <div
                key={item.date}
                className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  item.isOff
                    ? "bg-rose-50/50 border-rose-200 text-rose-800"
                    : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-900">{item.dayName}</div>
                  <div className="text-[11px] font-mono text-slate-400">{item.date}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetShift(idx, "SHIFT_1")}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs ${
                      !item.isOff && item.shift === "SHIFT_1"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    Ca 1 (8h30-17h30)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetShift(idx, "SHIFT_2")}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs ${
                      !item.isOff && item.shift === "SHIFT_2"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    Ca 2 (12h-21h)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleOff(idx)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition text-xs ${
                      item.isOff
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600"
                    }`}
                  >
                    Xin OFF
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Đang gửi đăng ký..." : "Gửi Đăng Ký Cho HR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

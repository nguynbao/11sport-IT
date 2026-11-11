"use client";

import React, { useEffect, useState } from "react";
import { fetchMyShiftScheduleApi, submitShiftPreferencesApi } from "@/lib/api";
import { Calendar, CheckCircle2, AlertCircle, X, Send } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addLocalDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalDateStr(new Date(y, m - 1, d + days));
}

function getNextMondayLocalStr() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const offsetToCurrentMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offsetToCurrentMonday + 7);
  return toLocalDateStr(d);
}

const DAY_NAMES = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

export default function FridayShiftRegistrationModal({ onClose, onSuccess }: Props) {
  const [nextMondayStr, setNextMondayStr] = useState<string>(() => getNextMondayLocalStr());
  const [isConfirmedByHr, setIsConfirmedByHr] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [monthlyOffQuota, setMonthlyOffQuota] = useState<{
    limit: number;
    primaryMonth: string;
    usedTotal: number;
    usedOutsideWeek: number;
    remainingForWeek: number;
    byMonth?: Record<
      string,
      {
        limit: number;
        usedTotal: number;
        usedOutsideWeek: number;
        remainingForWeek: number;
        usedDatesOutsideWeek: string[];
      }
    >;
  } | null>(null);
  const [paidLeaveQuota, setPaidLeaveQuota] = useState<{
    eligible: boolean;
    contractType: string;
    probationLeaveDays: number;
    fulltimeMonths: number;
    totalEarnedUpToMonth: number;
    usedBeforeMonth: number;
    usedInMonth: number;
    entitledInMonth: number;
    remainingAfterMonth: number;
    paidLeaveDatesInWeek: string[];
    formalLeaveDatesInWeek: string[];
  } | null>(null);

  const [preferences, setPreferences] = useState<
    Array<{
      date: string;
      dayOfWeek: number;
      dayName: string;
      isOff: boolean;
      leaveType: "NONE" | "OFF" | "PAID_LEAVE";
      isFormalLeave: boolean;
      shift1: boolean;
      shift2: boolean;
    }>
  >(() =>
    Array.from({ length: 7 }, (_, i) => ({
      date: addLocalDays(getNextMondayLocalStr(), i),
      dayOfWeek: i + 1,
      dayName: DAY_NAMES[i],
      isOff: false,
      leaveType: "NONE",
      isFormalLeave: false,
      shift1: false,
      shift2: false,
    }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingExisting(true);
      try {
        const data = await fetchMyShiftScheduleApi();
        if (!mounted) return;
        const ws = data.nextWeekStart || data.nextMonday || data.weekStart || getNextMondayLocalStr();
        setNextMondayStr(ws);
        const confirmed = Boolean(data.isConfirmedByHr);
        setIsConfirmedByHr(confirmed);
        if (data.monthlyOffQuota) {
          setMonthlyOffQuota(data.monthlyOffQuota);
        }
        if (data.paidLeaveQuota) {
          setPaidLeaveQuota(data.paidLeaveQuota);
        }

        const paidSet = new Set(data.paidLeaveQuota?.paidLeaveDatesInWeek || []);
        const formalSet = new Set(data.paidLeaveQuota?.formalLeaveDatesInWeek || []);
        const byDate = new Map((data.assignments || []).map((a) => [a.date, a]));
        setPreferences(
          Array.from({ length: 7 }, (_, i) => {
            const date = addLocalDays(ws, i);
            const existing = byDate.get(date);
            const isFormalLeave = formalSet.has(date);
            if (isFormalLeave) {
              const isPaid = paidSet.has(date);
              return {
                date,
                dayOfWeek: i + 1,
                dayName: DAY_NAMES[i],
                isOff: true,
                leaveType: isPaid ? "PAID_LEAVE" : "OFF",
                isFormalLeave: true,
                shift1: false,
                shift2: false,
              };
            }
            if (confirmed && existing) {
              const isOff = existing.shiftCode === "OFF" || Boolean(existing.isOffRequested);
              const code = existing.shiftCode;
              const isPaid = isOff && paidSet.has(date);
              return {
                date,
                dayOfWeek: i + 1,
                dayName: DAY_NAMES[i],
                isOff,
                leaveType: isOff ? (isPaid ? "PAID_LEAVE" : "OFF") : "NONE",
                isFormalLeave: false,
                shift1: !isOff && (code === "SHIFT_1" || code === "BOTH"),
                shift2: !isOff && (code === "SHIFT_2" || code === "BOTH"),
              };
            }
            return {
              date,
              dayOfWeek: i + 1,
              dayName: DAY_NAMES[i],
              isOff: false,
              leaveType: "NONE",
              isFormalLeave: false,
              shift1: false,
              shift2: false,
            };
          })
        );
      } catch {
        // giữ mặc định chưa chọn ca
      } finally {
        if (mounted) setLoadingExisting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getMonthRemainingForDate = (dateStr: string) => {
    const ym = dateStr.slice(0, 7);
    const byM = monthlyOffQuota?.byMonth?.[ym];
    if (byM) return byM.remainingForWeek;
    return monthlyOffQuota?.remainingForWeek ?? 4;
  };

  // Số ngày phép tích lũy còn lại có thể chọn trong đăng ký ca tuần (ngoài các ngày phép đã có đơn trong tuần)
  const paidLeaveInWeekFromFormal = preferences.filter(
    (p) => p.isFormalLeave && p.leaveType === "PAID_LEAVE"
  ).length;
  const availablePaidLeaveForReg = Math.max(
    0,
    (paidLeaveQuota?.remainingAfterMonth ?? 0) +
      (paidLeaveQuota?.paidLeaveDatesInWeek?.length ?? 0) -
      paidLeaveInWeekFromFormal
  );
  const canUsePaidLeaveInReg = Boolean(paidLeaveQuota?.eligible) && availablePaidLeaveForReg >= 1;

  const handleToggleOff = (index: number, requestedType: "OFF" | "PAID_LEAVE" = "OFF") => {
    if (isConfirmedByHr) return;
    setErrorMsg("");
    const target = preferences[index];
    if (!target || target.isFormalLeave) return;

    // Nếu bấm lại đúng loại đang chọn -> bỏ chọn ngày nghỉ
    if (target.isOff && target.leaveType === requestedType) {
      setPreferences((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                isOff: false,
                leaveType: "NONE",
              }
            : item
        )
      );
      return;
    }

    const otherOffItems = preferences.filter((_, idx) => idx !== index && preferences[idx].isOff);
    const otherRegOffItems = otherOffItems.filter((p) => !p.isFormalLeave);

    if (otherOffItems.length >= 2) {
      setErrorMsg(
        "Trong mục Đăng ký ca tuần, không được nghỉ quá 2 ngày/tuần (mặc định tối đa 1 ngày OFF không lương và 1 ngày phép có lương). Từ 3 ngày trở đi bắt buộc phải Tạo đơn trước tối thiểu 3 tuần (21 ngày)!"
      );
      return;
    }

    if (requestedType === "OFF") {
      const otherUnpaidReg = otherRegOffItems.filter((p) => p.leaveType === "OFF").length;
      if (otherUnpaidReg >= 1) {
        setErrorMsg(
          "Đăng ký ca tuần mặc định chỉ được chọn tối đa 1 ngày OFF không lương và 1 ngày phép có lương! Nếu muốn nghỉ thêm ngày thứ 2 trong tuần, vui lòng chọn 'Nghỉ phép' (nếu còn phép) hoặc Tạo đơn trước tối thiểu 3 tuần."
        );
        return;
      }
      const ym = target.date.slice(0, 7);
      const maxForMonth = getMonthRemainingForDate(target.date);
      const selectedInSameMonth = otherOffItems.filter(
        (p) => p.leaveType === "OFF" && p.date.startsWith(`${ym}-`)
      ).length;
      if (selectedInSameMonth >= maxForMonth) {
        setErrorMsg(
          maxForMonth === 0
            ? `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} bạn đã dùng hết 4/4 ngày nghỉ không lương (OFF). Các tuần còn lại trong tháng không được đăng ký OFF không lương thêm (bạn vẫn có thể dùng 1 ngày Nghỉ phép nếu còn)!`
            : `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)} bạn chỉ còn tối đa ${maxForMonth}/4 ngày nghỉ không lương (OFF) cho tuần này.`
        );
        return;
      }
    } else {
      if (!paidLeaveQuota?.eligible) {
        setErrorMsg(
          "Chỉ nhân viên Hợp đồng Chính thức mới được sử dụng ngày nghỉ phép có lương (ngày phép ở giai đoạn Thử việc sẽ được cộng dồn khi lên Chính thức)."
        );
        return;
      }
      if (availablePaidLeaveForReg < 1) {
        setErrorMsg("Bạn đã sử dụng hết số ngày nghỉ phép có lương tích lũy tính đến tháng này.");
        return;
      }
      const otherPaidReg = otherRegOffItems.filter((p) => p.leaveType === "PAID_LEAVE").length;
      if (otherPaidReg >= 1) {
        setErrorMsg(
          "Đăng ký ca tuần mặc định chỉ được chọn tối đa 1 ngày phép có lương. Từ 2 ngày phép trở đi bắt buộc phải Tạo đơn trước tối thiểu 3 tuần (21 ngày)!"
        );
        return;
      }
    }

    setPreferences((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              isOff: true,
              leaveType: requestedType,
              shift1: false,
              shift2: false,
            }
          : item
      )
    );
  };

  const handleToggleShift = (index: number, which: "SHIFT_1" | "SHIFT_2") => {
    if (isConfirmedByHr) return;
    const target = preferences[index];
    if (target?.isFormalLeave) return;
    setErrorMsg("");
    setPreferences((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const nextShift1 = which === "SHIFT_1" ? (item.isOff ? true : !item.shift1) : item.isOff ? false : item.shift1;
        const nextShift2 = which === "SHIFT_2" ? (item.isOff ? true : !item.shift2) : item.isOff ? false : item.shift2;
        return {
          ...item,
          isOff: false,
          leaveType: "NONE",
          shift1: nextShift1,
          shift2: nextShift2,
        };
      })
    );
  };

  const offCount = preferences.filter((p) => p.isOff).length;
  const regOffItems = preferences.filter((p) => p.isOff && !p.isFormalLeave);
  const unpaidOffCount = preferences.filter((p) => p.isOff && p.leaveType !== "PAID_LEAVE").length;
  const paidLeaveOffCount = preferences.filter((p) => p.isOff && p.leaveType === "PAID_LEAVE").length;
  const regUnpaidCount = regOffItems.filter((p) => p.leaveType !== "PAID_LEAVE").length;
  const regPaidCount = regOffItems.filter((p) => p.leaveType === "PAID_LEAVE").length;
  const workCount = preferences.filter((p) => !p.isOff && (p.shift1 || p.shift2)).length;
  const doubleShiftDays = preferences.filter((p) => !p.isOff && p.shift1 && p.shift2).length;
  const unselectedCount = 7 - offCount - workCount;
  const maxOffThisWeek = monthlyOffQuota?.remainingForWeek ?? 4;
  const usedOutsideWeek = monthlyOffQuota?.usedOutsideWeek ?? 0;
  const monthlyLimit = monthlyOffQuota?.limit ?? 4;
  const isMonthQuotaValid = Array.from(new Set(preferences.map((p) => p.date.slice(0, 7)))).every((ym) => {
    const picked = preferences.filter(
      (p) => p.isOff && p.leaveType !== "PAID_LEAVE" && p.date.startsWith(`${ym}-`)
    ).length;
    const rem = monthlyOffQuota?.byMonth?.[ym]?.remainingForWeek ?? maxOffThisWeek;
    return picked <= rem;
  });
  const isWeeklyRegLimitValid =
    (offCount <= 2 || regOffItems.length === 0) && regUnpaidCount <= 1 && regPaidCount <= 1;
  const isRuleValid = unselectedCount === 0 && isWeeklyRegLimitValid && isMonthQuotaValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isRuleValid) {
      setErrorMsg(
        `Quy định đăng ký ca khối Bán hàng: Phải chọn đủ 7 ngày trong tuần, tối đa 2 ngày nghỉ/tuần (mặc định 1 ngày OFF không lương + 1 ngày phép có lương; từ 3 ngày trở đi phải tạo đơn trước 3 tuần). Hiện tại bạn đã chọn ${workCount} ngày làm, ${unpaidOffCount} ngày OFF, ${paidLeaveOffCount} ngày phép${unselectedCount > 0 ? ` (còn ${unselectedCount} ngày chưa chọn)` : ""}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      await submitShiftPreferencesApi({
        weekStart: nextMondayStr,
        preferences: preferences.map((p) => ({
          date: p.date,
          dayOfWeek: p.dayOfWeek,
          isOffRequested: p.isOff,
          leaveType: p.isOff ? (p.leaveType === "PAID_LEAVE" ? "PAID_LEAVE" : "OFF") : undefined,
          preferenceShift: p.isOff
            ? "OFF"
            : p.shift1 && p.shift2
            ? "BOTH"
            : p.shift2
            ? "SHIFT_2"
            : "SHIFT_1",
        })),
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi gửi đăng ký ca");
    } finally {
      setSubmitting(false);
    }
  };

  const weekEndStr = addLocalDays(nextMondayStr, 6);
  const [, wsM, wsD] = nextMondayStr.split("-");
  const [weY, weM, weD] = weekEndStr.split("-");

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
      <div className="bg-white text-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
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
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
                    ? "bg-emerald-100 text-emerald-800"
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
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold">
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
                          : "bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700"
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
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
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

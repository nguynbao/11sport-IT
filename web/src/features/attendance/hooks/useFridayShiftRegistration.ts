import React, { useEffect, useState } from "react";
import { fetchMyShiftScheduleApi, submitShiftPreferencesApi } from "../api";
import { DAY_NAMES, addLocalDays, getNextMondayLocalStr } from "../utils/fridayShift";

export function useFridayShiftRegistration({ onSuccess }: { onSuccess: () => void }) {
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

  return {
    nextMondayStr, isConfirmedByHr, loadingExisting, paidLeaveQuota, preferences,
    submitting, errorMsg, availablePaidLeaveForReg, canUsePaidLeaveInReg,
    handleToggleOff, handleToggleShift, workCount, doubleShiftDays, unpaidOffCount,
    paidLeaveOffCount, unselectedCount, maxOffThisWeek, usedOutsideWeek, monthlyLimit,
    isRuleValid, handleSubmit,
  };
}

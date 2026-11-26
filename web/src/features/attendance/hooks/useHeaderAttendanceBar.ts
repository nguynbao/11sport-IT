import { useState, useEffect, useCallback, useRef } from "react";
import type { AttendanceData, DailyHandoverCheckData, ShiftHandoverRecord, StaffUser } from "@/shared/types";
import { checkInApi, checkOutApi, getTodayAttendanceApi } from "../api";
import { fetchDailyHandoverCheckApi, confirmHandoverApi, fetchHandoversApi } from "@/features/pos";
import { useIncomingHandoverSummary } from "./useIncomingHandoverSummary";
import { useAttendanceElapsed } from "./useAttendanceElapsed";
import { localDateStr } from "../utils/localDate";

export function useHeaderAttendanceBar(currentUser: StaffUser | null) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [isEarlyApprovedToday, setIsEarlyApprovedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedback(null);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Bàn giao ca & Nút Kiểm hàng luôn hiển thị cạnh đồng hồ cho Sales
  const [dailyCheckInfo, setDailyCheckInfo] = useState<DailyHandoverCheckData | null>(null);
  const [currentShiftHandover, setCurrentShiftHandover] = useState<ShiftHandoverRecord | null>(null);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showFridayModal, setShowFridayModal] = useState(false);
  const [pendingHandoverToConfirm, setPendingHandoverToConfirm] = useState<ShiftHandoverRecord | null>(null);
  const [showIncomingHandoverPopup, setShowIncomingHandoverPopup] = useState(false);
  const [mustConfirmBeforeCheckout, setMustConfirmBeforeCheckout] = useState(false);
  const [confirmNoteInput, setConfirmNoteInput] = useState("");
  const [confirmingHandover, setConfirmingHandover] = useState(false);
  const dismissedHandoverIdsRef = useRef<Set<string>>(new Set());
  const [lateCheckoutModal, setLateCheckoutModal] = useState<{ lateMinutes: number } | null>(null);
  const [lateCheckoutReasonInput, setLateCheckoutReasonInput] = useState("");

  const showNotice = useCallback((type: "ok" | "err", text: string) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback({ type, text });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, type === "err" ? 5500 : 4000);
  }, []);

  const applyPendingIncomingHandover = useCallback(
    (incoming: ShiftHandoverRecord | null | undefined, forceOpenPopup = false) => {
      const today = localDateStr();
      const yesterday = localDateStr(new Date(Date.now() - 86400000));
      const isValidIncoming =
        incoming &&
        incoming.status === "PENDING" &&
        currentUser &&
        String(incoming.fromStaffId) !== String(currentUser._id) &&
        (!incoming.toStaffId || String(incoming.toStaffId) === String(currentUser._id)) &&
        ((String(incoming.date) === today && incoming.shiftCode === "SHIFT_1") ||
          (String(incoming.date) === yesterday &&
            (incoming.shiftCode === "SHIFT_2" || incoming.shiftCode === "BOTH")));

      if (isValidIncoming && incoming) {
        setPendingHandoverToConfirm(incoming);
        if (forceOpenPopup || !dismissedHandoverIdsRef.current.has(incoming._id)) {
          setShowIncomingHandoverPopup(true);
        }
      } else {
        setPendingHandoverToConfirm(null);
        setShowIncomingHandoverPopup(false);
        setMustConfirmBeforeCheckout(false);
      }
    },
    [currentUser]
  );

  const pollPendingHandover = useCallback(
    async (forceOpenPopup = false) => {
      if (!currentUser || currentUser.role !== "SALES") return;
      try {
        const [todayRes, handoverRes] = await Promise.all([
          getTodayAttendanceApi().catch(() => null),
          fetchHandoversApi({ status: "PENDING" }).catch(() => null),
        ]);

        if (todayRes) {
          setAttendance(todayRes.attendance);
          if (todayRes.currentShiftHandover) {
            setCurrentShiftHandover(todayRes.currentShiftHandover);
          }
        }
        if (handoverRes) {
          applyPendingIncomingHandover(handoverRes.pendingIncomingHandover || null, forceOpenPopup);
        }
      } catch {
        // ignore
      }
    },
    [currentUser, applyPendingIncomingHandover]
  );


  const {
    incomingSummaries,
    incomingCheckCategories,
    incomingCheckLoading,
    incomingActualTotals,
    setIncomingActualTotals,
  } = useIncomingHandoverSummary({ showIncomingHandoverPopup, pendingHandoverToConfirm });

  const { elapsedText, setElapsedText, isLunchPaused, setIsLunchPaused } = useAttendanceElapsed({
    attendance,
    setAttendance,
    currentUser,
  });

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role === "ADMIN" || currentUser.role === "CEO") return;
    setLoading(true);
    try {
      const [todayRes, checkData] = await Promise.all([
        getTodayAttendanceApi(),
        currentUser.role === "SALES" || currentUser.department === "SALES"
          ? fetchDailyHandoverCheckApi().catch(() => null)
          : Promise.resolve(null),
      ]);
      setAttendance(todayRes.attendance);
      setIsWfhToday(todayRes.isWfhToday);
      setIsEarlyApprovedToday(Boolean(todayRes.isEarlyApprovedToday));
      if (todayRes.currentShiftHandover) {
        setCurrentShiftHandover(todayRes.currentShiftHandover);
      }
      if (checkData) {
        setDailyCheckInfo(checkData);
      }

      if (currentUser.role === "SALES") {
        if (todayRes.pendingIncomingHandover) {
          applyPendingIncomingHandover(todayRes.pendingIncomingHandover);
        } else {
          await pollPendingHandover();
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentUser, applyPendingIncomingHandover, pollPendingHandover]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tự động kiểm tra định kỳ khi Sales đang trong ca làm việc (hoặc đang chờ Ca 2 xác nhận để hoàn tất Check-out)
  useEffect(() => {
    if (!currentUser || currentUser.role !== "SALES") return;
    const isWorkingNow = Boolean(attendance && !attendance.checkOutTime);
    if (!isWorkingNow) return;

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      pollPendingHandover();
    }, 15000);

    const handleFocus = () => {
      pollPendingHandover();
    };
    const handleVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        pollPendingHandover();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentUser, attendance, pollPendingHandover]);

  // Qua 00:00 sang ngày mới: reset đồng hồ & tải lại trạng thái chấm công của ngày mới
  const dayRef = useRef<string>(localDateStr());
  useEffect(() => {
    const watcher = setInterval(() => {
      const today = localDateStr();
      if (today !== dayRef.current) {
        dayRef.current = today;
        setAttendance(null);
        setCurrentShiftHandover(null);
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        loadData();
      }
    }, 15000);
    return () => clearInterval(watcher);
  }, [loadData]);

  // Bấm nút PLAY -> Check-in trực tiếp trên Header
  const handlePlayCheckIn = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await checkInApi({});
      setAttendance(res.attendance);
      showNotice("ok", "Đã bắt đầu tính giờ ca làm việc!");
      if (currentUser?.role === "SALES") {
        dismissedHandoverIdsRef.current.clear();
        const checkData = await fetchDailyHandoverCheckApi().catch(() => null);
        if (checkData) setDailyCheckInfo(checkData);
        await pollPendingHandover(true);
      }
    } catch (err: any) {
      showNotice("err", err?.message || "Không thể chấm công vào ca");
    } finally {
      setActionLoading(false);
    }
  };

  // Bấm nút PAUSE -> Check-out trực tiếp trên Header
  const handlePauseCheckOut = async (
    forceEarly = false,
    earlyReason = "",
    lateCheckoutReason = "",
    bypassClientPendingCheck = false,
    submittedHandoverOverride?: ShiftHandoverRecord | null
  ) => {
    if (actionLoading) return;

    // 1. Nếu là nhân viên SALES đang còn phiếu bàn giao ca từ Ca trước chưa xác nhận -> bắt buộc mở popup xác nhận trước
    if (!bypassClientPendingCheck && currentUser?.role === "SALES" && pendingHandoverToConfirm) {
      setMustConfirmBeforeCheckout(true);
      setShowIncomingHandoverPopup(true);
      showNotice("err", "Vui lòng kiểm tra & xác nhận phiếu bàn giao từ ca trước trước khi kết ca!");
      return;
    }

    // 2. Kiểm tra đã đủ giờ kết thúc ca chưa (Ca 1: 17:30, Ca 2 & BOTH: 21:00)
    const now = new Date();
    const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
    const isEnd21 = attendance?.shiftCode === "SHIFT_2" || attendance?.shiftCode === "BOTH";
    const shiftEndMinutes = isEnd21 ? 21 * 60 : 17 * 60 + 30;
    const shiftEndLabel = isEnd21 ? "21:00" : "17:30";

    if (totalMinutesNow < shiftEndMinutes && !isEarlyApprovedToday && !forceEarly) {
      const remain = shiftEndMinutes - totalMinutesNow;
      const rHours = Math.floor(remain / 60);
      const rMins = remain % 60;
      const remainStr = rHours > 0 ? `${rHours} giờ ${rMins} phút` : `${rMins} phút`;
      showNotice(
        "err",
        `Chưa tới giờ tan ca (${shiftEndLabel} - còn ${remainStr}). Bạn có thể bấm nút "Kiểm hàng" cạnh đồng hồ để lưu bản nháp trước!`
      );
      return;
    }

    // 3. Nếu là nhân viên SALES (không phải WFH) đến giờ tan ca bấm Check-out mà chưa xác nhận gửi bàn giao ca (hoặc đang là bản nháp DRAFT) -> Hiển thị ngay bản bàn giao ca để xác nhận gửi
    const effectiveHandover = submittedHandoverOverride ?? currentShiftHandover;
    const isSalesOnSite =
      (currentUser?.role === "SALES" || currentUser?.department === "SALES") && !isWfhToday;
    if (isSalesOnSite && (!effectiveHandover || effectiveHandover.status === "DRAFT")) {
      setShowHandoverModal(true);
      return;
    }

    // 4. Kiểm tra lý do check-out trễ > 5 phút (tính theo thời điểm bấm gửi bàn giao nếu đã có)
    const isSalesOneShift =
      (currentUser?.department === "SALES" || currentUser?.role === "SALES") &&
      attendance?.shiftCode !== "BOTH";
    const refTime = attendance?.pendingCheckOutTime
      ? new Date(attendance.pendingCheckOutTime)
      : effectiveHandover?.submittedAt
        ? new Date(effectiveHandover.submittedAt)
        : now;
    const refMinutes = refTime.getHours() * 60 + refTime.getMinutes();
    const diffLateOut = refMinutes - shiftEndMinutes;
    const finalLateReason =
      lateCheckoutReason.trim() ||
      attendance?.lateCheckoutReason ||
      effectiveHandover?.lateCheckoutReason ||
      "";

    if (isSalesOneShift && diffLateOut > 5 && !finalLateReason) {
      setLateCheckoutModal({ lateMinutes: diffLateOut });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await checkOutApi({
        forceEarly: forceEarly || isEarlyApprovedToday,
        earlyReason: earlyReason || (isEarlyApprovedToday ? "Đã được HR duyệt về sớm" : ""),
        lateCheckoutReason: finalLateReason || undefined,
        requireConfirmation: true,
      });
      setAttendance(res.attendance);
      setLateCheckoutModal(null);
      setLateCheckoutReasonInput("");

      if (res.awaitingHandoverConfirm) {
        const lockedTimeStr = res.attendance.pendingCheckOutTime
          ? new Date(res.attendance.pendingCheckOutTime).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
          : shiftEndLabel;
        showNotice(
          "ok",
          `Đã chốt giờ ra ca (${lockedTimeStr}) & gửi bàn giao! Khi Ca 2 xác nhận bạn sẽ hoàn tất Check-out.`
        );
      } else {
        showNotice("ok", `Đã kết thúc ca (${res.attendance.totalWorkHours}h)!, Cảm ơn bạn vì một ngày cống hiến`);
      }

      const today = new Date();
      if (today.getDay() === 5 && currentUser?.role === "SALES") {
        setShowFridayModal(true);
      }
    } catch (err: any) {
      if (err.code === "INCOMING_HANDOVER_CONFIRM_REQUIRED") {
        await pollPendingHandover(true);
        setMustConfirmBeforeCheckout(true);
        setShowIncomingHandoverPopup(true);
        showNotice("err", err?.message || "Cần xác nhận bàn giao từ ca trước trước khi kết ca!");
      } else if (err.code === "HANDOVER_REQUIRED") {
        setShowHandoverModal(true);
      } else if (err.code === "LATE_CHECKOUT_REASON_REQUIRED") {
        const lateMins = Number(err.fields?.lateCheckoutMinutes || diffLateOut || 6);
        setLateCheckoutModal({ lateMinutes: lateMins });
      } else {
        showNotice("err", err?.message || "Không thể kết ca");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissIncomingHandover = () => {
    if (pendingHandoverToConfirm?._id) {
      dismissedHandoverIdsRef.current.add(pendingHandoverToConfirm._id);
    }
    setShowIncomingHandoverPopup(false);
    setMustConfirmBeforeCheckout(false);
  };

  const handleConfirmIncomingHandover = async (accept: boolean) => {
    if (!pendingHandoverToConfirm || confirmingHandover) return;
    setConfirmingHandover(true);
    try {
      const shouldContinueCheckout = mustConfirmBeforeCheckout;

      // Ghi nhận nếu Ca nhận kiểm đếm tổng số lượng thực tế có chênh lệch
      const receiverDiffs = incomingSummaries
        .map((s) => {
          const key = s.categoryCode || s.categoryName;
          const expected = s.expectedTotalQty;
          const actual = incomingActualTotals[key] ?? expected;
          return { s, expected, actual };
        })
        .filter((x) => x.actual !== x.expected);

      let finalConfirmNote = confirmNoteInput.trim();
      if (receiverDiffs.length > 0) {
        const diffSummary = receiverDiffs
          .map((x) => `Tổng ${x.s.categoryName} (Tồn T1:${x.expected} -> Kiểm nhận:${x.actual})`)
          .join(", ");
        finalConfirmNote = finalConfirmNote
          ? `${finalConfirmNote} | Kiểm nhận ca lệch: ${diffSummary}`
          : `Kiểm nhận ca lệch: ${diffSummary}`;
      }

      await confirmHandoverApi(
        pendingHandoverToConfirm._id,
        accept,
        finalConfirmNote || undefined
      );
      showNotice(
        "ok",
        accept
          ? `Đã xác nhận nhận bàn giao ca từ ${pendingHandoverToConfirm.fromStaffName}!`
          : "Đã ghi nhận báo lệch thông tin bàn giao ca!"
      );
      setPendingHandoverToConfirm(null);
      setShowIncomingHandoverPopup(false);
      setMustConfirmBeforeCheckout(false);
      setConfirmNoteInput("");

      if (shouldContinueCheckout) {
        await handlePauseCheckOut(false, "", lateCheckoutReasonInput, true);
      }
    } catch (err: any) {
      showNotice("err", err?.message || "Lỗi xác nhận bàn giao");
    } finally {
      setConfirmingHandover(false);
    }
  };

  return {
    attendance, isWfhToday, isEarlyApprovedToday, loading, actionLoading,
    elapsedText, isLunchPaused, feedback, showNotice, clearFeedback,
    dailyCheckInfo, currentShiftHandover, setCurrentShiftHandover,
    showHandoverModal, setShowHandoverModal, showFridayModal, setShowFridayModal,
    pendingHandoverToConfirm, showIncomingHandoverPopup, setShowIncomingHandoverPopup,
    mustConfirmBeforeCheckout, setMustConfirmBeforeCheckout,
    confirmNoteInput, setConfirmNoteInput, confirmingHandover,
    incomingSummaries, incomingCheckCategories, incomingCheckLoading,
    incomingActualTotals, setIncomingActualTotals,
    lateCheckoutModal, setLateCheckoutModal, lateCheckoutReasonInput, setLateCheckoutReasonInput,
    handlePlayCheckIn, handlePauseCheckOut, handleDismissIncomingHandover, handleConfirmIncomingHandover,
  };
}

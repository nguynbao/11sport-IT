"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StaffUser,
  AttendanceData,
  ShiftHandoverRecord,
  DailyHandoverCheckData,
  DailyHandoverCategorySummary,
  checkInApi,
  checkOutApi,
  getTodayAttendanceApi,
  confirmHandoverApi,
  fetchHandoversApi,
  fetchDailyHandoverCheckApi,
} from "@/lib/api";
import {
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Home,
  Clock,
  ClipboardCheck,
  Coins,
  Boxes,
  X,
  BellRing,
  Plus,
  Minus,
} from "lucide-react";
import ShiftHandoverModal from "./ShiftHandoverModal";
import FridayShiftRegistrationModal from "./FridayShiftRegistrationModal";

/** Ngày hiện tại theo giờ máy (YYYY-MM-DD) */
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  currentUser: StaffUser | null;
}

export default function HeaderAttendanceBar({ currentUser }: Props) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [isEarlyApprovedToday, setIsEarlyApprovedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Đồng hồ đếm giờ làm việc trực tiếp trên Header
  const [elapsedText, setElapsedText] = useState<string>("00:00:00");
  const [isLunchPaused, setIsLunchPaused] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  // Danh sách tổng số lượng theo danh mục khi Nhận ca (Vợt + ...)
  const [incomingSummaries, setIncomingSummaries] = useState<DailyHandoverCategorySummary[]>([]);
  const [incomingCheckCategories, setIncomingCheckCategories] = useState<string[]>([]);
  const [incomingCheckLoading, setIncomingCheckLoading] = useState(false);
  const [incomingActualTotals, setIncomingActualTotals] = useState<Record<string, number>>({});

  const [lateCheckoutModal, setLateCheckoutModal] = useState<{ lateMinutes: number } | null>(null);
  const [lateCheckoutReasonInput, setLateCheckoutReasonInput] = useState("");

  const showNotice = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

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

  // Tải thông tin tổng số lượng kiểm tra (Vợt + ...) của phiếu bàn giao đang chờ xác nhận
  useEffect(() => {
    if (!showIncomingHandoverPopup || !pendingHandoverToConfirm) return;
    let cancelled = false;
    const loadIncomingSummary = async () => {
      setIncomingCheckLoading(true);
      try {
        const checkData = await fetchDailyHandoverCheckApi(pendingHandoverToConfirm.date);
        if (cancelled) return;

        let catSummaries: DailyHandoverCategorySummary[] = Array.isArray(checkData.categorySummaries)
          ? checkData.categorySummaries
          : [];

        if (catSummaries.length === 0) {
          const prods = Array.isArray(checkData.products) ? checkData.products : [];
          const cats = Array.isArray(checkData.checkedCategories)
            ? checkData.checkedCategories
            : ["Vợt"];
          catSummaries = cats.map((catName, idx) => {
            const matching = prods.filter((p) => p.categoryName === catName);
            return {
              categoryId: catName,
              categoryCode: catName.toUpperCase(),
              categoryName: catName,
              isPrimaryCategory: idx === 0,
              unit: matching[0]?.unit || "Cái",
              productCount: matching.length,
              expectedTotalQty: matching.reduce(
                (sum, p) => sum + (Number(p.stockQtyFloor1) || 0),
                0
              ),
            };
          });
        }

        setIncomingSummaries(catSummaries);
        setIncomingCheckCategories(
          Array.isArray(checkData.checkedCategories) && checkData.checkedCategories.length > 0
            ? checkData.checkedCategories
            : Array.isArray(pendingHandoverToConfirm.checkedCategories)
            ? pendingHandoverToConfirm.checkedCategories
            : ["Vợt"]
        );

        const initTotals: Record<string, number> = {};
        for (const s of catSummaries) {
          const key = s.categoryCode || s.categoryName;
          initTotals[key] = 0;
        }
        setIncomingActualTotals(initTotals);
      } catch {
        if (!cancelled) {
          setIncomingSummaries([]);
        }
      } finally {
        if (!cancelled) {
          setIncomingCheckLoading(false);
        }
      }
    };
    loadIncomingSummary();
    return () => {
      cancelled = true;
    };
  }, [showIncomingHandoverPopup, pendingHandoverToConfirm?._id, pendingHandoverToConfirm?.date]);

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role === "ADMIN") return;
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
      pollPendingHandover();
    }, 6000);

    const handleFocus = () => {
      pollPendingHandover();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
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

  // Tính toán đồng hồ chạy trực tiếp mỗi giây khi đã Check-in
  // Khi nhân viên đã bấm xác nhận gửi bàn giao ca (pendingCheckOutTime đã ghi nhận), đồng hồ dừng đúng tại mốc bấm gửi!
  useEffect(() => {
    if (!attendance?.checkInTime) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      return;
    }

    if (attendance.date && attendance.date !== localDateStr()) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      setAttendance(null);
      return;
    }

    const computeElapsed = () => {
      if (!attendance.checkOutTime && attendance.date && attendance.date !== localDateStr()) {
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        setAttendance(null);
        return;
      }
      const startRaw = attendance.workStartTime || attendance.checkInTime;
      const startTime = new Date(startRaw);
      const lockedOutRaw = attendance.checkOutTime || attendance.pendingCheckOutTime;
      const endTime = lockedOutRaw ? new Date(lockedOutRaw) : new Date();

      const isOffice =
        currentUser?.department === "OFFICE" ||
        (currentUser?.role && currentUser.role !== "SALES");

      const lunchStart = new Date(endTime);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(endTime);
      lunchEnd.setHours(13, 0, 0, 0);

      let pausedNow = false;
      let effectiveEnd = endTime;
      let deductMs = 0;

      if (isOffice) {
        if (!lockedOutRaw && endTime >= lunchStart && endTime < lunchEnd) {
          pausedNow = true;
          effectiveEnd = lunchStart;
        } else if (endTime >= lunchEnd && startTime < lunchEnd) {
          const overlapStart = startTime > lunchStart ? startTime : lunchStart;
          if (overlapStart < lunchEnd) {
            deductMs = lunchEnd.getTime() - overlapStart.getTime();
          }
        }
      }

      setIsLunchPaused(pausedNow);

      const diffMs = Math.max(0, effectiveEnd.getTime() - startTime.getTime() - deductMs);
      const totalSeconds = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;

      setElapsedText(
        `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };

    computeElapsed();
    if (!attendance.checkOutTime && !attendance.pendingCheckOutTime) {
      const timer = setInterval(computeElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [attendance, currentUser]);

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
        showNotice("ok", `Đã kết thúc ca (${res.attendance.totalWorkHours}h)!`);
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

  if (!currentUser || currentUser.role === "ADMIN") return null;

  const isWorking = Boolean(attendance && !attendance.checkOutTime);
  const isCompleted = Boolean(attendance && attendance.checkOutTime);
  const isSalesStaff =
    currentUser.role === "SALES" || currentUser.department === "SALES";
  const isAwaitingNextShiftConfirm = Boolean(
    isWorking &&
      attendance?.pendingCheckOutTime &&
      currentShiftHandover?.status === "PENDING"
  );

  const now = new Date();
  const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
  const isEnd21 = attendance?.shiftCode === "SHIFT_2" || attendance?.shiftCode === "BOTH";
  const shiftEndMinutes = isEnd21 ? 21 * 60 : 17 * 60 + 30;
  const shiftEndLabel = isEnd21 ? "21:00" : "17:30";
  const canConfirmCheckoutNow =
    totalMinutesNow >= shiftEndMinutes || isEarlyApprovedToday;

  // Nhãn hiển thị trên nút Kiểm hàng cạnh đồng hồ đếm giờ (VD: "Vợt (151) + Giày (106)")
  const checkButtonSummaryText =
    dailyCheckInfo?.categorySummaries && dailyCheckInfo.categorySummaries.length > 0
      ? dailyCheckInfo.categorySummaries
          .map((s) => `${s.categoryName} (${s.expectedTotalQty})`)
          .join(" + ")
      : dailyCheckInfo?.checkedCategoryLabel || "Vợt + ...";

  const activeCheckCategories =
    incomingCheckCategories.length > 0
      ? incomingCheckCategories
      : Array.isArray(pendingHandoverToConfirm?.checkedCategories) &&
        pendingHandoverToConfirm.checkedCategories.length > 0
      ? pendingHandoverToConfirm.checkedCategories
      : ["Vợt"];

  const incomingDiffCount = incomingSummaries.filter((s) => {
    const key = s.categoryCode || s.categoryName;
    return (incomingActualTotals[key] ?? 0) !== s.expectedTotalQty;
  }).length;

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex items-center gap-2 bg-slate-800/95 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-inner">
        {/* Badge WFH nếu có */}
        {isWfhToday && (
          <span
            title="Hôm nay được duyệt làm việc từ xa (WFH)"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] font-bold"
          >
            <Home className="w-3 h-3" />
            WFH
          </span>
        )}

        {/* Chưa Check-in: Nút PLAY + Đồng hồ 00:00:00 */}
        {!attendance && !loading && (
          <button
            type="button"
            onClick={handlePlayCheckIn}
            disabled={actionLoading}
            title="Bấm Play để bắt đầu tính giờ chấm công & kiểm tra nhận ca"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="font-mono text-sm tracking-wider">00:00:00</span>
          </button>
        )}

        {/* Đang trong ca: Nút PAUSE + Đồng hồ đếm giờ HH:MM:SS + Nút KIỂM HÀNG luôn ở cạnh đồng hồ */}
        {isWorking && (
          <>
            <button
              type="button"
              onClick={() => handlePauseCheckOut(false)}
              disabled={actionLoading}
              title={
                isAwaitingNextShiftConfirm
                  ? "Đã chốt giờ gửi bàn giao - Đang chờ Ca 2 xác nhận"
                  : "Bấm Pause để kết thúc ca (Check-out)"
              }
              className={`p-1.5 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-md transition cursor-pointer disabled:opacity-50 ${
                isAwaitingNextShiftConfirm
                  ? "bg-sky-500 hover:bg-sky-400 text-slate-950"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950"
              }`}
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAwaitingNextShiftConfirm
                    ? "bg-sky-400"
                    : isLunchPaused
                    ? "bg-amber-400"
                    : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span className="font-mono font-black text-sm sm:text-base text-emerald-400 tracking-wider">
                {elapsedText}
              </span>
            </div>

            {/* Nút Kiểm hàng luôn hiển thị cạnh đồng hồ đếm giờ cho nhân viên Sales */}
            {isSalesStaff && !isWfhToday && (
              <div className="flex items-center pl-2 border-l border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(true)}
                  title="Mở bảng Kiểm hàng (Tổng số lượng mặt hàng kiểm trong ngày, Tiền mặt trong quầy & Lý do)"
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
                    isAwaitingNextShiftConfirm
                      ? "bg-sky-500/20 border border-sky-400/40 text-sky-300 hover:bg-sky-500/30"
                      : currentShiftHandover?.status === "DRAFT"
                      ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[200px]">
                    Kiểm hàng: {checkButtonSummaryText}
                  </span>
                  {isAwaitingNextShiftConfirm ? (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 text-[10px] font-black">
                      Chờ Ca 2 (
                      {attendance?.pendingCheckOutTime
                        ? new Date(attendance.pendingCheckOutTime).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : shiftEndLabel}
                      )
                    </span>
                  ) : currentShiftHandover?.status === "DRAFT" ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                      Nháp
                    </span>
                  ) : null}
                </button>
              </div>
            )}
          </>
        )}

        {/* Đã Check-out hoàn tất trong ngày: Chỉ hiện icon hoàn tất + Đồng hồ tổng giờ */}
        {isCompleted && (
          <div className="flex items-center gap-2 px-2 py-0.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono font-black text-sm sm:text-base text-emerald-300 tracking-wider">
              {elapsedText}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>--:--:--</span>
          </div>
        )}

        {/* Nếu Sales có phiếu bàn giao từ ca trước đang chờ xác nhận */}
        {pendingHandoverToConfirm && (
          <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMustConfirmBeforeCheckout(false);
                setShowIncomingHandoverPopup(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1.5 shadow-md animate-pulse cursor-pointer"
              title={`Bấm để mở Popup kiểm tra hàng bàn giao & nhận ca từ ${pendingHandoverToConfirm.fromStaffName}`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {pendingHandoverToConfirm.date !== localDateStr() ||
                pendingHandoverToConfirm.shiftCode !== "SHIFT_1"
                  ? `Nhận ca & Kiểm hàng (${pendingHandoverToConfirm.date.slice(5)})`
                  : "Nhận ca & Kiểm hàng (Ca 1)"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Thông báo nhỏ gọn ngay dưới thanh Header */}
      {feedback && (
        <div
          className={`absolute top-full mt-1.5 z-50 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 border ${
            feedback.type === "ok"
              ? "bg-emerald-950/95 text-emerald-300 border-emerald-700"
              : "bg-rose-950/95 text-rose-300 border-rose-700"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Popup Kiểm Tra & Xác Nhận Bàn Giao Ca (Hiển thị Tổng số lượng theo mặt hàng kiểm trong ngày) */}
      {showIncomingHandoverPopup && pendingHandoverToConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {pendingHandoverToConfirm.date !== localDateStr() ||
                    pendingHandoverToConfirm.shiftCode !== "SHIFT_1"
                      ? `Kiểm Tra & Nhận Bàn Giao Từ Ca Tối (${pendingHandoverToConfirm.date})`
                      : "Kiểm Tra & Nhận Bàn Giao Từ Ca 1"}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Người bàn giao: <b className="text-emerald-400">{pendingHandoverToConfirm.fromStaffName}</b> • Nhóm kiểm:{" "}
                    <b className="text-amber-300">{activeCheckCategories.join(" + ")}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissIncomingHandover}
                title="Đóng tạm để kiểm hàng sau"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {mustConfirmBeforeCheckout ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold text-rose-900">
                      Bắt buộc xác nhận bàn giao trước khi Kết ca!
                    </div>
                    <p className="mt-0.5 text-rose-700">
                      Bạn chưa xác nhận phiếu bàn giao từ{" "}
                      <b>{pendingHandoverToConfirm.fromStaffName}</b>. Vui lòng kiểm tra tổng số lượng bên dưới và bấm{" "}
                      <b>Xác nhận nhận ca</b>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-2xl">
                  Vui lòng kiểm tra <b>tiền mặt trong quầy</b> và <b>tổng số lượng ({activeCheckCategories.join(" + ")})</b> do{" "}
                  <b>{pendingHandoverToConfirm.fromStaffName}</b> bàn giao rồi bấm <b>Xác nhận nhận ca</b> (khi bạn xác nhận, ca trước sẽ hoàn tất Check-out theo đúng giờ họ đã bấm gửi).
                </div>
              )}

              {/* Thông tin tiền mặt trong quầy */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>Tiền mặt trong quầy bàn giao:</span>
                </div>
                <div className="font-mono text-base font-black text-amber-950">
                  {Number(pendingHandoverToConfirm.cashBalance || 0).toLocaleString("vi-VN")} đ
                </div>
              </div>

              {/* Lý do / Ghi chú từ ca trước */}
              {pendingHandoverToConfirm.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-700">Lý do / Ghi chú từ ca trước: </span>
                  <span className="text-slate-800">{pendingHandoverToConfirm.notes}</span>
                </div>
              )}

              {/* BẢNG TỔNG SỐ LƯỢNG MẶT HÀNG KIỂM TRONG NGÀY */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">
                    Tổng số lượng mặt hàng kiểm ({activeCheckCategories.join(" + ")})
                  </span>
                  {incomingDiffCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                      Đang lệch {incomingDiffCount} nhóm
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      Khớp tồn Tầng 1
                    </span>
                  )}
                </div>

                {incomingCheckLoading ? (
                  <div className="py-6 text-center text-slate-400">
                    Đang tải tổng số lượng kiểm tra...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomingSummaries.map((item) => {
                      const key = item.categoryCode || item.categoryName;
                      const expected = item.expectedTotalQty;
                      const actual = incomingActualTotals[key] ?? 0;
                      const isDiff = actual !== expected;
                      const prevReported = Array.isArray(pendingHandoverToConfirm.categoryCounts)
                        ? pendingHandoverToConfirm.categoryCounts.find(
                            (c) =>
                              c.categoryCode === item.categoryCode ||
                              c.categoryName === item.categoryName
                          )?.actualTotalQty
                        : undefined;

                      return (
                        <div
                          key={key}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                            isDiff
                              ? "bg-amber-50/70 border-amber-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                                {item.categoryName}
                              </span>
                              <span className="font-bold text-slate-700">
                                Tổng tất cả size, màu
                              </span>
                            </div>
                            <div className="mt-1 text-slate-600 flex flex-wrap items-center gap-2">
                              <span>
                                Tồn Tầng 1 đối chiếu:{" "}
                                <b className="font-mono text-slate-900">{expected}</b>{" "}
                                {item.unit || "Cái"}
                              </span>
                              {typeof prevReported === "number" && (
                                <span className="text-emerald-800 font-semibold">
                                  • Ca trước đếm:{" "}
                                  <b className="font-mono">{prevReported}</b>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 bg-white border border-slate-300 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualTotals((prev) => ({
                                  ...prev,
                                  [key]: Math.max(0, (prev[key] ?? 0) - 1),
                                }))
                              }
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actual}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                const val = digits ? parseInt(digits, 10) : 0;
                                setIncomingActualTotals((prev) => ({ ...prev, [key]: val }));
                              }}
                              className={`w-14 text-center font-mono font-black text-sm outline-none ${
                                isDiff ? "text-amber-700" : "text-emerald-700"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualTotals((prev) => ({
                                  ...prev,
                                  [key]: (prev[key] ?? 0) + 1,
                                }))
                              }
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ghi chú xác nhận của Ca nhận */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do / Ghi chú của Ca nhận (có thể ghi hoặc không)
                </label>
                <input
                  type="text"
                  value={confirmNoteInput}
                  onChange={(e) => setConfirmNoteInput(e.target.value)}
                  placeholder="VD: Đã đếm đủ tổng số lượng và tiền mặt..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDismissIncomingHandover}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Để sau
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={confirmingHandover}
                  onClick={() => handleConfirmIncomingHandover(false)}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Báo lệch thông tin
                </button>
                <button
                  type="button"
                  disabled={confirmingHandover}
                  onClick={() => handleConfirmIncomingHandover(true)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {confirmingHandover ? "Đang xác nhận..." : "Xác Nhận Nhận Ca"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHandoverModal && (
        <ShiftHandoverModal
          currentUser={currentUser}
          shiftCode={attendance?.shiftCode || "SHIFT_1"}
          existingHandover={currentShiftHandover}
          canConfirmCheckout={canConfirmCheckoutNow}
          shiftEndLabel={shiftEndLabel}
          onClose={() => setShowHandoverModal(false)}
          onSavedDraft={(draft) => {
            setCurrentShiftHandover(draft);
            showNotice("ok", "Đã lưu bản nháp kiểm hàng trong ca!");
          }}
          onSuccess={async (submittedHandover, lateReasonFromModal) => {
            setShowHandoverModal(false);
            if (submittedHandover) {
              setCurrentShiftHandover(submittedHandover);
            }
            await handlePauseCheckOut(
              false,
              "",
              lateReasonFromModal || lateCheckoutReasonInput,
              true,
              submittedHandover
            );
          }}
        />
      )}

      {lateCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-800">
            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              Check-out trễ {lateCheckoutModal.lateMinutes} phút sau giờ kết ca
            </div>
            <p className="text-slate-600 leading-relaxed">
              Quy định chỉ cho phép check-out trễ tối đa <b>5 phút</b>. Vì bạn gửi phiếu / check-out sau 5 phút, vui lòng nhập{" "}
              <b>lý do check-out trễ</b> để HR xem xét:
            </p>
            <textarea
              rows={3}
              value={lateCheckoutReasonInput}
              onChange={(e) => setLateCheckoutReasonInput(e.target.value)}
              placeholder="VD: Ở lại tư vấn chốt đơn cho khách đến trễ / kiểm hàng cuối ca..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLateCheckoutModal(null)}
                className="px-3.5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!lateCheckoutReasonInput.trim() || actionLoading}
                onClick={() => handlePauseCheckOut(false, "", lateCheckoutReasonInput.trim())}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                {actionLoading ? "Đang gửi..." : "Gửi lý do & Check-out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFridayModal && (
        <FridayShiftRegistrationModal
          onClose={() => setShowFridayModal(false)}
          onSuccess={() => {
            setShowFridayModal(false);
            showNotice("ok", "Đã gửi đăng ký lịch ca tuần sau cho HR!");
          }}
        />
      )}
    </div>
  );
}

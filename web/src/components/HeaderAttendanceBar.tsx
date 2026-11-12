"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StaffUser,
  AttendanceData,
  ShiftHandoverRecord,
  DailyHandoverProductItem,
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
  Search,
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

  // Bàn giao ca cho Sales (chỉ hiện khi cần thiết)
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showFridayModal, setShowFridayModal] = useState(false);
  const [pendingHandoverToConfirm, setPendingHandoverToConfirm] = useState<ShiftHandoverRecord | null>(null);
  const [showIncomingHandoverPopup, setShowIncomingHandoverPopup] = useState(false);
  const [mustConfirmBeforeCheckout, setMustConfirmBeforeCheckout] = useState(false);
  const [confirmNoteInput, setConfirmNoteInput] = useState("");
  const [confirmingHandover, setConfirmingHandover] = useState(false);
  const dismissedHandoverIdsRef = useRef<Set<string>>(new Set());

  // Danh sách sản phẩm kiểm tra khi Nhận ca (Vợt + Nhóm ngẫu nhiên của ca bàn giao)
  const [incomingCheckProducts, setIncomingCheckProducts] = useState<DailyHandoverProductItem[]>([]);
  const [incomingCheckCategories, setIncomingCheckCategories] = useState<string[]>([]);
  const [incomingCheckLoading, setIncomingCheckLoading] = useState(false);
  const [incomingActualCounts, setIncomingActualCounts] = useState<Record<string, number>>({});
  const [incomingCategoryFilter, setIncomingCategoryFilter] = useState<string>("ALL");
  const [incomingSearchTerm, setIncomingSearchTerm] = useState<string>("");

  const [lateCheckoutModal, setLateCheckoutModal] = useState<{ lateMinutes: number } | null>(null);
  const [lateCheckoutReasonInput, setLateCheckoutReasonInput] = useState("");

  const showNotice = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const applyPendingIncomingHandover = useCallback(
    (incoming: ShiftHandoverRecord | null | undefined, forceOpenPopup = false) => {
      const today = localDateStr();
      const isValidIncoming =
        incoming &&
        incoming.status === "PENDING" &&
        currentUser &&
        (String(incoming.date) < today ||
          String(incoming.fromStaffId) !== String(currentUser._id));

      if (isValidIncoming && incoming) {
        setPendingHandoverToConfirm(incoming);
        // Nếu bấm Nhận ca (forceOpenPopup) hoặc nhân viên chưa bấm "Để sau" -> bật popup kiểm tra ngay
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
        const today = localDateStr();
        const res = await fetchHandoversApi({ status: "PENDING" });
        const pending =
          res.pendingIncomingHandover ||
          (Array.isArray(res.items)
            ? res.items.find(
                (h) =>
                  h.status === "PENDING" &&
                  (String(h.date) < today ||
                    String(h.fromStaffId) !== String(currentUser._id))
              ) || null
            : null);
        applyPendingIncomingHandover(pending, forceOpenPopup);
      } catch {
        // ignore
      }
    },
    [currentUser, applyPendingIncomingHandover]
  );

  // Tải danh sách sản phẩm kiểm tra (Vợt + Nhóm ngẫu nhiên) của phiếu bàn giao đang chờ xác nhận
  useEffect(() => {
    if (!showIncomingHandoverPopup || !pendingHandoverToConfirm) return;
    let cancelled = false;
    const loadIncomingChecklist = async () => {
      setIncomingCheckLoading(true);
      try {
        const checkData = await fetchDailyHandoverCheckApi(pendingHandoverToConfirm.date);
        if (cancelled) return;
        const prods = Array.isArray(checkData.products) ? checkData.products : [];
        setIncomingCheckProducts(prods);
        setIncomingCheckCategories(
          Array.isArray(checkData.checkedCategories) && checkData.checkedCategories.length > 0
            ? checkData.checkedCategories
            : Array.isArray(pendingHandoverToConfirm.checkedCategories)
            ? pendingHandoverToConfirm.checkedCategories
            : []
        );

        // Khởi tạo số lượng kiểm thực tế: mặc định lấy số lượng ca trước bàn giao (nếu có lệch) hoặc tồn Tầng 1
        const discrepancyMap = new Map<string, number>();
        if (Array.isArray(pendingHandoverToConfirm.discrepancies)) {
          for (const d of pendingHandoverToConfirm.discrepancies) {
            if (d.productCode) discrepancyMap.set(String(d.productCode), Number(d.actual));
          }
        }
        const initialCounts: Record<string, number> = {};
        for (const p of prods) {
          const reported =
            discrepancyMap.get(String(p.code)) ??
            Number(p.stockQtyFloor1 || 0);
          initialCounts[p._id] = reported;
        }
        setIncomingActualCounts(initialCounts);
        setIncomingCategoryFilter("ALL");
        setIncomingSearchTerm("");
      } catch {
        if (!cancelled) {
          setIncomingCheckProducts([]);
        }
      } finally {
        if (!cancelled) {
          setIncomingCheckLoading(false);
        }
      }
    };
    loadIncomingChecklist();
    return () => {
      cancelled = true;
    };
  }, [showIncomingHandoverPopup, pendingHandoverToConfirm?._id, pendingHandoverToConfirm?.date]);

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role === "ADMIN") return;
    setLoading(true);
    try {
      const todayRes = await getTodayAttendanceApi();
      setAttendance(todayRes.attendance);
      setIsWfhToday(todayRes.isWfhToday);
      setIsEarlyApprovedToday(Boolean(todayRes.isEarlyApprovedToday));

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

  // Tự động kiểm tra định kỳ khi Ca 2 đang trong ca làm việc để hiển thị ngay popup khi Ca 1 vừa gửi phiếu kết ca
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
  // (ca hôm trước quên check-out sẽ được ghi nhận "Quên check-out" trên bảng công, không đếm tiếp)
  const dayRef = useRef<string>(localDateStr());
  useEffect(() => {
    const watcher = setInterval(() => {
      const today = localDateStr();
      if (today !== dayRef.current) {
        dayRef.current = today;
        setAttendance(null);
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        loadData();
      }
    }, 15000);
    return () => clearInterval(watcher);
  }, [loadData]);

  // Tính toán đồng hồ chạy trực tiếp mỗi giây khi đã Check-in
  useEffect(() => {
    if (!attendance?.checkInTime) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      return;
    }

    // Bản ghi không phải của hôm nay (quên check-out từ hôm trước) -> không đếm tiếp, reset về 00:00:00
    if (attendance.date && attendance.date !== localDateStr()) {
      setElapsedText("00:00:00");
      setIsLunchPaused(false);
      setAttendance(null);
      return;
    }

    const computeElapsed = () => {
      // Đồng hồ đang chạy mà vừa qua 00:00 -> dừng & reset ngay
      if (!attendance.checkOutTime && attendance.date && attendance.date !== localDateStr()) {
        setElapsedText("00:00:00");
        setIsLunchPaused(false);
        setAttendance(null);
        return;
      }
      const startRaw = attendance.workStartTime || attendance.checkInTime;
      const startTime = new Date(startRaw);
      const endTime = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();

      const isOffice =
        currentUser?.department === "OFFICE" ||
        (currentUser?.role && currentUser.role !== "SALES");

      // Kiểm tra giờ nghỉ trưa 12:00 - 13:00 (1 tiếng: sáng 08:30-12:00, chiều 13:00-17:30) đối với khối Văn phòng
      const lunchStart = new Date(endTime);
      lunchStart.setHours(12, 0, 0, 0);
      const lunchEnd = new Date(endTime);
      lunchEnd.setHours(13, 0, 0, 0);

      let pausedNow = false;
      let effectiveEnd = endTime;
      let deductMs = 0;

      if (isOffice) {
        if (!attendance.checkOutTime && endTime >= lunchStart && endTime < lunchEnd) {
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
    if (!attendance.checkOutTime) {
      const timer = setInterval(computeElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [attendance, currentUser]);

  // Bấm nút PLAY -> Check-in trực tiếp trên Header (Kiểm tra theo IP mạng Wi-Fi phía server)
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
    bypassClientPendingCheck = false
  ) => {
    if (actionLoading) return;

    // Nếu là nhân viên SALES đang còn phiếu bàn giao ca từ Ca trước chưa xác nhận -> bắt buộc mở popup xác nhận trước khi kết ca
    if (!bypassClientPendingCheck && currentUser?.role === "SALES" && pendingHandoverToConfirm) {
      setMustConfirmBeforeCheckout(true);
      setShowIncomingHandoverPopup(true);
      showNotice("err", "Vui lòng kiểm tra & xác nhận phiếu bàn giao từ ca trước trước khi kết ca!");
      return;
    }

    // Kiểm tra đã đủ giờ kết thúc ca chưa (Ca 1: 17:30, Ca 2 & Ca 1+2 BOTH: 21:00)
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
        `Chưa đủ giờ kết thúc ca (${shiftEndLabel} - còn ${remainStr}), chưa thể bàn giao ca & Check-out!`
      );
      return;
    }

    // Nhân viên Bán hàng làm 1 ca (SHIFT_1 / SHIFT_2) check-out trễ > 5 phút phải nhập lý do để HR xem xét
    const isSalesOneShift =
      (currentUser?.department === "SALES" || currentUser?.role === "SALES") &&
      attendance?.shiftCode !== "BOTH";
    const diffLateOut = totalMinutesNow - shiftEndMinutes;
    if (isSalesOneShift && diffLateOut > 5 && !lateCheckoutReason.trim()) {
      setLateCheckoutModal({ lateMinutes: diffLateOut });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await checkOutApi({
        forceEarly: forceEarly || isEarlyApprovedToday,
        earlyReason: earlyReason || (isEarlyApprovedToday ? "Đã được HR duyệt về sớm" : ""),
        lateCheckoutReason: lateCheckoutReason.trim() || undefined,
      });
      setAttendance(res.attendance);
      setLateCheckoutModal(null);
      setLateCheckoutReasonInput("");
      showNotice("ok", `Đã kết thúc ca (${res.attendance.totalWorkHours}h)!`);

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

      // Ghi nhận thêm nếu ca nhận kiểm đếm thực tế phát hiện lệch so với tồn Tầng 1
      const receiverDiscrepancies = incomingCheckProducts
        .map((p) => {
          const expected = Number(p.stockQtyFloor1 || 0);
          const actual = incomingActualCounts[p._id] ?? expected;
          return { p, expected, actual };
        })
        .filter((x) => x.actual !== x.expected);

      let finalConfirmNote = confirmNoteInput.trim();
      if (receiverDiscrepancies.length > 0) {
        const diffSummary = receiverDiscrepancies
          .map((x) => `${x.p.code} (HT:${x.expected} -> Kiểm nhận:${x.actual})`)
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
          ? `Đã kiểm tra & xác nhận nhận ca từ ${pendingHandoverToConfirm.fromStaffName}!`
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

  const activeCheckCategories =
    incomingCheckCategories.length > 0
      ? incomingCheckCategories
      : Array.isArray(pendingHandoverToConfirm?.checkedCategories) &&
        pendingHandoverToConfirm.checkedCategories.length > 0
      ? pendingHandoverToConfirm.checkedCategories
      : ["Vợt"];

  const filteredIncomingProducts = incomingCheckProducts.filter((p) => {
    const expected = Number(p.stockQtyFloor1 || 0);
    const actual = incomingActualCounts[p._id] ?? expected;
    if (incomingCategoryFilter === "DIFF" && actual === expected) return false;
    if (
      incomingCategoryFilter !== "ALL" &&
      incomingCategoryFilter !== "DIFF" &&
      p.categoryName !== incomingCategoryFilter
    ) {
      return false;
    }
    if (incomingSearchTerm.trim()) {
      const q = incomingSearchTerm.trim().toLowerCase();
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.code || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const incomingDiffCount = incomingCheckProducts.filter((p) => {
    const expected = Number(p.stockQtyFloor1 || 0);
    const actual = incomingActualCounts[p._id] ?? expected;
    return actual !== expected;
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

        {/* Chưa Check-in: Nút PLAY + Đồng hồ 00:00:00 (Tự động nhận Ca theo giờ Check-in) */}
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

        {/* Đang trong ca: Nút PAUSE + Đồng hồ đếm giờ HH:MM:SS */}
        {isWorking && (
          <>
            <button
              type="button"
              onClick={() => handlePauseCheckOut(false)}
              disabled={actionLoading}
              title="Bấm Pause để kết thúc ca (Check-out)"
              className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow-md transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLunchPaused ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span className="font-mono font-black text-sm sm:text-base text-emerald-400 tracking-wider">
                {elapsedText}
              </span>
            </div>
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

        {/* Nếu Sales có phiếu bàn giao từ ca trước (Ca 1 giao Ca 2 cùng ngày hoặc Ca tối giao Ca 1 sáng hôm sau) đang chờ xác nhận */}
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

      {/* Thông báo nhỏ gọn ngay dưới thanh Header (không mở popup) */}
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

      {/* Popup Kiểm Tra & Xác Nhận Bàn Giao Ca (Hiển thị đầy đủ danh sách Vợt + Nhóm ngẫu nhiên để kiểm đếm khi Nhận ca) */}
      {showIncomingHandoverPopup && pendingHandoverToConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
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
                    Người bàn giao: <b className="text-emerald-400">{pendingHandoverToConfirm.fromStaffName}</b> • Ngày{" "}
                    {pendingHandoverToConfirm.date} • Nhóm kiểm:{" "}
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
                      {pendingHandoverToConfirm.date !== localDateStr() ||
                      pendingHandoverToConfirm.shiftCode !== "SHIFT_1"
                        ? `Ca tối ngày ${pendingHandoverToConfirm.date}`
                        : "Ca 1"}{" "}
                      ({pendingHandoverToConfirm.fromStaffName}). Vui lòng kiểm tra danh sách bên dưới và bấm{" "}
                      <b>Xác nhận thông tin bàn giao</b> để tiếp tục kết ca.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-2xl">
                  {pendingHandoverToConfirm.date !== localDateStr() ||
                  pendingHandoverToConfirm.shiftCode !== "SHIFT_1" ? (
                    <>
                      Ca tối ngày <b>{pendingHandoverToConfirm.date}</b> đã lập phiếu bàn giao cho Ca 1 sáng nay. Vui lòng kiểm tra{" "}
                      <b>tiền mặt trong két</b> và <b>danh sách sản phẩm ({activeCheckCategories.join(" + ")})</b> bên dưới rồi bấm{" "}
                      <b>Xác nhận nhận ca</b> (hoặc bấm <b>Để sau</b> nếu muốn kiểm hàng sau).
                    </>
                  ) : (
                    <>
                      Ca 1 vừa hoàn tất phiếu kết ca. Vui lòng kiểm tra <b>tiền mặt trong két</b> và{" "}
                      <b>danh sách sản phẩm ({activeCheckCategories.join(" + ")})</b> bên dưới rồi bấm{" "}
                      <b>Xác nhận nhận ca</b> (hoặc bấm <b>Để sau</b> nếu muốn kiểm hàng sau).
                    </>
                  )}
                </div>
              )}

              {/* Thông tin tiền mặt & danh mục kiểm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>Tiền mặt trong két bàn giao</span>
                  </div>
                  <div className="font-mono text-lg font-black text-amber-950">
                    {Number(pendingHandoverToConfirm.cashBalance || 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>Nhóm hàng kiểm tra nhận ca</span>
                  </div>
                  <div className="font-extrabold text-sm text-emerald-950">
                    {activeCheckCategories.join(" + ")}
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Tổng cộng {incomingCheckProducts.length || pendingHandoverToConfirm.totalCheckedProducts || 0} mã tại Tầng 1
                  </div>
                </div>
              </div>

              {/* Ghi chú từ ca trước */}
              {pendingHandoverToConfirm.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-700">Ghi chú từ ca trước: </span>
                  <span className="text-slate-800">{pendingHandoverToConfirm.notes}</span>
                </div>
              )}

              {/* DANH SÁCH SẢN PHẨM KIỂM TRA NHẬN CA (Vợt + Nhóm ngẫu nhiên) */}
              <div className="space-y-2.5 border border-slate-200 rounded-2xl p-3.5 bg-slate-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>
                      Danh sách sản phẩm kiểm tra nhận ca ({activeCheckCategories.join(" + ")})
                    </span>
                  </div>
                  {incomingDiffCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                      Đang lệch {incomingDiffCount} mã
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      Khớp 100% ({incomingCheckProducts.length} mã)
                    </span>
                  )}
                </div>

                {/* Bộ lọc nhóm & ô tìm kiếm */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIncomingCategoryFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                        incomingCategoryFilter === "ALL"
                          ? "bg-slate-900 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Tất cả ({incomingCheckProducts.length})
                    </button>
                    {activeCheckCategories.map((cat) => {
                      const count = incomingCheckProducts.filter((p) => p.categoryName === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setIncomingCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            incomingCategoryFilter === cat
                              ? "bg-emerald-600 text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                    {incomingDiffCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setIncomingCategoryFilter("DIFF")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          incomingCategoryFilter === "DIFF"
                            ? "bg-amber-600 text-white"
                            : "bg-amber-50 border border-amber-200 text-amber-800"
                        }`}
                      >
                        Đang lệch ({incomingDiffCount})
                      </button>
                    )}
                  </div>

                  <div className="relative sm:w-52">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={incomingSearchTerm}
                      onChange={(e) => setIncomingSearchTerm(e.target.value)}
                      placeholder="Tìm tên hoặc mã SP..."
                      className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Bảng sản phẩm kiểm đếm */}
                {incomingCheckLoading ? (
                  <div className="py-8 text-center text-slate-400 font-semibold">
                    Đang tải danh sách sản phẩm kiểm tra Kho Tầng 1...
                  </div>
                ) : filteredIncomingProducts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    Không có sản phẩm nào trong bộ lọc này.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {filteredIncomingProducts.map((p) => {
                      const expected = Number(p.stockQtyFloor1 || 0);
                      const actual = incomingActualCounts[p._id] ?? expected;
                      const isDiff = actual !== expected;
                      return (
                        <div
                          key={p._id}
                          className={`p-2.5 flex items-center justify-between gap-2 ${
                            isDiff ? "bg-amber-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {p.categoryName}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{p.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Mã: {p.code} • Tồn HT Tầng 1: <b className="text-slate-800">{expected}</b>{" "}
                              {p.unit || "cây"}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualCounts((prev) => ({
                                  ...prev,
                                  [p._id]: Math.max(0, (prev[p._id] ?? expected) - 1),
                                }))
                              }
                              className="w-6 h-6 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={String(actual)}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                const val = digits ? parseInt(digits, 10) : 0;
                                setIncomingActualCounts((prev) => ({ ...prev, [p._id]: val }));
                              }}
                              className={`w-12 text-center py-1 rounded-lg border font-mono font-bold text-xs outline-none ${
                                isDiff
                                  ? "border-amber-400 bg-amber-50 text-amber-900"
                                  : "border-slate-200 bg-slate-50 text-slate-900"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIncomingActualCounts((prev) => ({
                                  ...prev,
                                  [p._id]: (prev[p._id] ?? expected) + 1,
                                }))
                              }
                              className="w-6 h-6 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                            >
                              +
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
                  Ghi chú kiểm tra của Ca nhận (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={confirmNoteInput}
                  onChange={(e) => setConfirmNoteInput(e.target.value)}
                  placeholder="VD: Đã kiểm đủ tiền két và hàng trưng bày Tầng 1..."
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
                Để sau (Tắt popup kiểm hàng sau)
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
          onClose={() => setShowHandoverModal(false)}
          onSuccess={async () => {
            setShowHandoverModal(false);
            showNotice("ok", "Đã gửi biên bản bàn giao Kho Tầng 1!");
            await handlePauseCheckOut(false, "", lateCheckoutReasonInput, true);
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
              Quy định chỉ cho phép check-out trễ tối đa <b>5 phút</b>. Vì bạn check-out sau 5 phút, vui lòng nhập{" "}
              <b>lý do check-out trễ</b> để HR xem xét có tính thời gian này vào tăng ca hay không:
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

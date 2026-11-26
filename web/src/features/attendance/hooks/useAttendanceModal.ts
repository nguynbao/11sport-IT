import { useState, useEffect } from "react";
import type { AttendanceData, DailyHandoverProductItem, StaffUser } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { checkInApi, checkOutApi, getTodayAttendanceApi } from "../api";
import { confirmHandoverApi, fetchDailyHandoverCheckApi } from "@/features/pos";

export function useAttendanceModal(currentUser: StaffUser | null) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Time & Shift
  const [currentTime, setCurrentTime] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH">("SHIFT_1");

  // Modals phụ
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showFridayModal, setShowFridayModal] = useState(false);
  const [pendingHandoverToConfirm, setPendingHandoverToConfirm] = useState<any | null>(null);
  const [incomingCheckProducts, setIncomingCheckProducts] = useState<DailyHandoverProductItem[]>([]);
  const [incomingCheckCategories, setIncomingCheckCategories] = useState<string[]>([]);
  const [showIncomingInspectionModal, setShowIncomingInspectionModal] = useState(false);

  // Thông tin mạng IP Wi-Fi chấm công lấy từ /attendance/config
  const [officeName, setOfficeName] = useState<string>("11Sport Showroom & Văn phòng");
  const [detectedClientIp, setDetectedClientIp] = useState<string>("127.0.0.1");
  const [requireIp, setRequireIp] = useState<boolean>(true);
  const [isCurrentIpAllowed, setIsCurrentIpAllowed] = useState<boolean>(true);

  useEffect(() => {
    // Cập nhật đồng hồ thời gian thực mỗi giây
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const [data, cfgRes] = await Promise.all([
        getTodayAttendanceApi(),
        apiRequest<{ config: any; detectedClientIp: string; isCurrentIpAllowed?: boolean }>("/attendance/config").catch(() => null),
      ]);
      setAttendance(data.attendance);
      setIsWfhToday(data.isWfhToday);
      if (
        data.assignedShift === "SHIFT_1" ||
        data.assignedShift === "SHIFT_2" ||
        data.assignedShift === "BOTH"
      ) {
        setSelectedShift(data.assignedShift);
      }

      if (cfgRes?.data?.config) {
        const cfg = cfgRes.data.config;
        setOfficeName(cfg.officeName || "11Sport Showroom & Văn phòng");
        setRequireIp(cfg.requireIp !== false);
        setDetectedClientIp(cfgRes.data.detectedClientIp || "127.0.0.1");
        setIsCurrentIpAllowed(cfgRes.data.isCurrentIpAllowed !== false);
      }

      // Nếu là Sales Ca 2 vừa check-in: kiểm tra có bàn giao ca nào đang chờ nhận không
      if (data.attendance && currentUser?.role === "SALES") {
        checkPendingHandover();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const checkPendingHandover = async (openPopupImmediately = false) => {
    try {
      const res = await apiRequest<any>("/shifts/handover?status=PENDING");
      const rawData = res.data;
      const pending =
        res.meta?.pendingIncomingHandover ||
        rawData?.pendingIncomingHandover ||
        null;
      if (pending && String(pending.fromStaffId) !== String(currentUser?._id)) {
        setPendingHandoverToConfirm(pending);
        try {
          const checkData = await fetchDailyHandoverCheckApi(pending.date);
          setIncomingCheckProducts(Array.isArray(checkData.products) ? checkData.products : []);
          setIncomingCheckCategories(
            Array.isArray(checkData.checkedCategories) ? checkData.checkedCategories : []
          );
        } catch {
          setIncomingCheckProducts([]);
        }
        if (openPopupImmediately) {
          setShowIncomingInspectionModal(true);
        }
      } else {
        setPendingHandoverToConfirm(null);
      }
    } catch {
      // ignore
    }
  };

  const handleCheckIn = async () => {
    if (actionLoading) return;
    setStatusMsg(null);
    setActionLoading(true);
    try {
      const res = await checkInApi({
        shiftCode: selectedShift,
      });

      setStatusMsg({ type: "success", text: res.message });
      setAttendance(res.attendance);

      // Nếu là Sales: kiểm tra bàn giao ca kế tiếp và mở ngay popup kiểm tra hàng
      if (currentUser?.role === "SALES") {
        await checkPendingHandover(true);
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Lỗi khi chấm công vào ca" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (
    forceEarly = false,
    earlyReason = "",
    lateCheckoutReason = ""
  ) => {
    if (actionLoading) return;
    setStatusMsg(null);
    setActionLoading(true);
    try {
      const res = await checkOutApi({
        forceEarly,
        earlyReason,
        lateCheckoutReason,
      });
      setStatusMsg({ type: "success", text: res.message });
      setAttendance(res.attendance);

      // Kiểm tra nếu hôm nay là Thứ Sáu (day = 5) và là Sales: hiển thị Modal đăng ký ca tuần sau
      const today = new Date();
      if (today.getDay() === 5 && currentUser?.role === "SALES") {
        setShowFridayModal(true);
      }
    } catch (err: any) {
      if (err.code === "HANDOVER_REQUIRED") {
        // Cần bàn giao Kho Tầng 1 -> mở Modal bàn giao ngay
        setShowHandoverModal(true);
      } else if (err.code === "EARLY_LEAVE_WARNING") {
        const earlyMins = err.fields?.earlyMinutes || "vài";
        const reason = prompt(`Bạn đang về sớm ${earlyMins} phút trước giờ kết thúc ca. Nhập lý do về sớm để hoàn tất:`);
        if (reason !== null) {
          handleCheckOut(true, reason, lateCheckoutReason);
        }
      } else if (err.code === "LATE_CHECKOUT_REASON_REQUIRED") {
        const lateMins = err.fields?.lateCheckoutMinutes || "quá 5";
        const reason = prompt(
          `Bạn đang check-out trễ ${lateMins} phút (quá 5 phút sau giờ kết ca). Vui lòng nhập lý do vì sao check-out trễ để HR xem xét tính tăng ca:`
        );
        if (reason && reason.trim()) {
          handleCheckOut(forceEarly, earlyReason, reason.trim());
        } else {
          setStatusMsg({
            type: "error",
            text: "Bắt buộc nhập lý do khi check-out trễ quá 5 phút sau giờ kết thúc ca!",
          });
        }
      } else {
        setStatusMsg({ type: "error", text: err.message || "Lỗi khi Check-out" });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmIncomingHandover = async (accept: boolean) => {
    if (!pendingHandoverToConfirm) return;
    try {
      await confirmHandoverApi(pendingHandoverToConfirm._id, accept);
      alert(accept ? "Đã xác nhận nhận ca và Kho Tầng 1 thành công!" : "Đã từ chối bàn giao ca");
      setPendingHandoverToConfirm(null);
    } catch (err: any) {
      alert(err.message || "Lỗi xác nhận");
    }
  };

  return {
    attendance, isWfhToday, actionLoading, statusMsg, currentTime,
    selectedShift, setSelectedShift,
    showHandoverModal, setShowHandoverModal, showFridayModal, setShowFridayModal,
    pendingHandoverToConfirm, incomingCheckProducts, incomingCheckCategories,
    showIncomingInspectionModal, officeName, detectedClientIp, requireIp, isCurrentIpAllowed,
    handleCheckIn, handleCheckOut, handleConfirmIncomingHandover,
  };
}

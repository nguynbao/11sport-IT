"use client";

import React, { useState, useEffect } from "react";
import {
  StaffUser,
  AttendanceData,
  checkInApi,
  checkOutApi,
  getTodayAttendanceApi,
  confirmHandoverApi,
  apiRequest,
} from "@/lib/api";
import {
  Clock,
  MapPin,
  Wifi,
  Home,
  CheckCircle2,
  AlertTriangle,
  X,
  LogOut,
  LogIn,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import ShiftHandoverModal from "./ShiftHandoverModal";
import FridayShiftRegistrationModal from "./FridayShiftRegistrationModal";
import { useGpsGate } from "./GpsPermissionModal";
import { getFreshPosition, type GeoCoords } from "@/lib/geolocation";

interface Props {
  currentUser: StaffUser | null;
  onClose: () => void;
}

export default function AttendanceModal({ currentUser, onClose }: Props) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isWfhToday, setIsWfhToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Time & Location
  const [currentTime, setCurrentTime] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH">("SHIFT_1");

  // Modals phụ
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showFridayModal, setShowFridayModal] = useState(false);
  const [pendingHandoverToConfirm, setPendingHandoverToConfirm] = useState<any | null>(null);

  // Showroom 11Sport: lấy từ cấu hình /attendance/config (2 cơ sở cấu hình trong .env của server)
  const [officeName, setOfficeName] = useState<string>("11Sport Showroom & Văn phòng");
  const [branches, setBranches] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [nearestBranchName, setNearestBranchName] = useState<string>("");
  const [maxRadius, setMaxRadius] = useState<number>(50);
  const [detectedClientIp, setDetectedClientIp] = useState<string>("127.0.0.1");
  const [requireIp, setRequireIp] = useState<boolean>(false);

  // GPS bắt buộc: lấy vị trí tươi ngay lúc bấm Check-in/Check-out (không dùng tọa độ thay thế)
  const { withGps, locating, gpsModal } = useGpsGate();

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
        apiRequest<{ config: any; detectedClientIp: string }>("/attendance/config").catch(() => null),
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

      let targetBranches: { name: string; lat: number; lng: number }[] = [];
      if (cfgRes?.data?.config) {
        const cfg = cfgRes.data.config;
        setOfficeName(cfg.officeName || "11Sport Showroom & Văn phòng");
        targetBranches = Array.isArray(cfg.branches)
          ? cfg.branches
              .map((b: any) => ({ name: String(b.name || ""), lat: Number(b.lat), lng: Number(b.lng) }))
              .filter((b: { lat: number; lng: number }) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
          : [];
        setBranches(targetBranches);
        setMaxRadius(Number(cfg.maxDistanceMeters ?? 50));
        setRequireIp(Boolean(cfg.requireIp));
        setDetectedClientIp(cfgRes.data.detectedClientIp || "127.0.0.1");
      }

      // Chỉ để hiển thị khoảng cách tham khảo; khi bấm chấm công sẽ lấy lại GPS mới
      previewLocation(targetBranches);

      // Nếu là Sales Ca 2 vừa check-in: kiểm tra có bàn giao ca nào đang chờ nhận không
      if (data.attendance && currentUser?.role === "SALES") {
        checkPendingHandover();
      }
    } catch {
      previewLocation(branches);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingHandover = async () => {
    try {
      const res = await apiRequest<any[]>("/shifts/handover");
      // Nếu có biên bản đang PENDING của hôm nay
      const pending = Array.isArray(res.data) ? res.data.find((h: any) => h.status === "PENDING") : null;
      if (pending && pending.fromStaffId !== currentUser?._id) {
        setPendingHandoverToConfirm(pending);
      }
    } catch {
      // ignore
    }
  };

  /** Cập nhật khoảng cách hiển thị tới cơ sở gần nhất (Cơ sở 1 / Cơ sở 2) */
  const updateDistance = (
    gps: { lat: number; lng: number },
    targetBranches: { name: string; lat: number; lng: number }[] = branches
  ) => {
    setCoords({ lat: gps.lat, lng: gps.lng });
    if (targetBranches.length === 0) {
      setDistanceMeters(null);
      setNearestBranchName("");
      return;
    }
    let nearest = targetBranches[0];
    let best = calculateDistance(gps.lat, gps.lng, nearest.lat, nearest.lng);
    for (const b of targetBranches.slice(1)) {
      const d = calculateDistance(gps.lat, gps.lng, b.lat, b.lng);
      if (d < best) {
        best = d;
        nearest = b;
      }
    }
    setDistanceMeters(Math.round(best));
    setNearestBranchName(nearest.name);
  };

  const previewLocation = (targetBranches: { name: string; lat: number; lng: number }[]) => {
    getFreshPosition(10000)
      .then((gps) => updateDistance(gps, targetBranches))
      .catch(() => setDistanceMeters(null));
  };

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Ca WFH đã được HR duyệt: server bỏ qua GPS/IP nên không bắt buộc định vị
  const skipGps = isWfhToday || attendance?.checkInType === "WFH";

  const submitCheckIn = async (gps: GeoCoords | null) => {
    setStatusMsg(null);
    setActionLoading(true);
    try {
      if (gps) updateDistance(gps);
      const res = await checkInApi({
        ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
        shiftCode: selectedShift,
      });

      setStatusMsg({ type: "success", text: res.message });
      setAttendance(res.attendance);

      // Nếu là Sales: kiểm tra bàn giao ca kế tiếp
      if (currentUser?.role === "SALES") {
        checkPendingHandover();
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Lỗi khi chấm công vào ca" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (actionLoading || locating) return;
    setStatusMsg(null);
    if (skipGps) return submitCheckIn(null);
    // Lấy GPS ngay tại thời điểm bấm; chưa bật GPS -> hiện popup yêu cầu bật
    return withGps(submitCheckIn);
  };

  const handleCheckOut = async (
    forceEarly = false,
    earlyReason = "",
    lateCheckoutReason = ""
  ) => {
    if (actionLoading || locating) return;
    setStatusMsg(null);
    const submit = (gps: GeoCoords | null) => submitCheckOut(gps, forceEarly, earlyReason, lateCheckoutReason);
    if (skipGps) return submit(null);
    // Lấy GPS ngay tại thời điểm bấm Check-out; chưa bật GPS -> hiện popup yêu cầu bật
    return withGps(submit);
  };

  const submitCheckOut = async (
    gps: GeoCoords | null,
    forceEarly = false,
    earlyReason = "",
    lateCheckoutReason = ""
  ) => {
    setStatusMsg(null);
    setActionLoading(true);
    try {
      if (gps) updateDistance(gps);
      const res = await checkOutApi({
        forceEarly,
        earlyReason,
        lateCheckoutReason,
        ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
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

  const isLocationValid = isWfhToday || (distanceMeters !== null && distanceMeters <= maxRadius);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-extrabold text-base">Chấm Công & Ca Làm Việc</h3>
              <p className="text-xs text-slate-400">{officeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chính */}
        <div className="p-6 space-y-5 text-xs">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl border font-semibold flex items-center gap-2 ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Banner thông báo Ca trước bàn giao đang chờ duyệt */}
          {pendingHandoverToConfirm && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Ca trước ({pendingHandoverToConfirm.fromStaffName}) đã gửi bàn giao Kho Tầng 1!
              </div>
              <p className="text-slate-600">
                Tiền mặt: <strong>{pendingHandoverToConfirm.cashBalance?.toLocaleString("vi-VN")} ₫</strong> • Hàng
                lệch: <strong>{pendingHandoverToConfirm.discrepancies?.length || 0} mã</strong>.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleConfirmIncomingHandover(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  ✓ Đồng ý nhận ca
                </button>
                <button
                  onClick={() => handleConfirmIncomingHandover(false)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  ✕ Từ chối
                </button>
              </div>
            </div>
          )}

          {/* Banner WFH nếu có */}
          {isWfhToday && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-2xl flex items-center gap-2.5 font-bold">
              <Home className="w-5 h-5 text-purple-600 shrink-0" />
              <span>Hôm nay bạn có lịch Làm việc từ xa (WFH) đã duyệt bởi HR. Bạn có thể chấm công tự do!</span>
            </div>
          )}

          {/* Đồng hồ lớn */}
          <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="text-3xl font-black font-mono tracking-tight text-slate-900">{currentTime}</div>
            <div className="text-slate-400 font-semibold mt-1">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
          </div>

          {/* Thông tin vị trí & mạng */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
              <MapPin
                className={`w-4 h-4 shrink-0 ${
                  isWfhToday || (distanceMeters !== null && distanceMeters <= maxRadius)
                    ? "text-emerald-600"
                    : "text-rose-500"
                }`}
              />
              <div>
                <div className="font-bold text-slate-800">Vị trí GPS (≤{maxRadius}m)</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {isWfhToday
                    ? "Bỏ qua (WFH)"
                    : distanceMeters !== null
                      ? `Cách ~${distanceMeters}m${nearestBranchName ? ` • ${nearestBranchName.split(":")[0]}` : ""}`
                      : "Chưa có vị trí"}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-slate-800">
                  Mạng Wi-Fi {requireIp ? "(Bắt buộc IP)" : ""}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {isWfhToday ? "Internet tự do" : `IP: ${detectedClientIp}`}
                </div>
              </div>
            </div>
          </div>

          {/* Chọn Ca làm việc (Nếu chưa check-in) */}
          {!attendance && (
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">Chọn Ca làm việc hôm nay:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedShift("SHIFT_1")}
                  className={`p-3 rounded-2xl border font-bold text-left transition ${
                    selectedShift === "SHIFT_1"
                      ? "bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div>Ca 1 (Hành chính / Sáng)</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">08:30 - 17:30</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedShift("SHIFT_2")}
                  className={`p-3 rounded-2xl border font-bold text-left transition ${
                    selectedShift === "SHIFT_2"
                      ? "bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div>Ca 2 (Chiều - Tối)</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">12:00 - 21:00</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedShift("BOTH")}
                  className={`p-3 rounded-2xl border font-bold text-left transition ${
                    selectedShift === "BOTH"
                      ? "bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div>Ca 1 + Ca 2 (2 ca)</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">08:30 - 21:00</div>
                </button>
              </div>
            </div>
          )}

          {/* Trạng thái đã Check-in */}
          {attendance && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Đã Check-in vào ca
                </span>
                <span className="font-mono font-bold text-emerald-800">
                  {new Date(attendance.checkInTime).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="text-slate-600 space-y-1">
                <div>
                  Ca làm việc:{" "}
                  <strong>
                    {attendance.shiftCode === "BOTH"
                      ? "Ca 1 + Ca 2 (08:30 - 21:00)"
                      : attendance.shiftCode === "SHIFT_2"
                      ? "Ca 2 (12:00 - 21:00)"
                      : "Ca 1 (08:30 - 17:30)"}
                  </strong>
                </div>
                <div>
                  Mốc tính công chuẩn:{" "}
                  <strong>
                    {new Date(attendance.workStartTime).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>{" "}
                  (Đã làm tròn nếu check-in sớm)
                </div>
                {attendance.checkOutTime && (
                  <div>
                    Đã Check-out lúc:{" "}
                    <strong>
                      {new Date(attendance.checkOutTime).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>{" "}
                    • Tổng: <strong>{attendance.totalWorkHours}h công</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nút bấm Hành động */}
          <div className="pt-2">
            {!attendance ? (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={actionLoading || locating}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5" />
                {locating ? "Đang lấy vị trí GPS..." : actionLoading ? "Đang xác thực vị trí..." : "BẤM CHECK-IN VÀO CA"}
              </button>
            ) : !attendance.checkOutTime ? (
              <button
                type="button"
                onClick={() => handleCheckOut()}
                disabled={actionLoading || locating}
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                {locating ? "Đang lấy vị trí GPS..." : actionLoading ? "Đang xử lý..." : "KẾT CA & BẤM CHECK-OUT"}
              </button>
            ) : (
              <div className="text-center py-3 bg-slate-100 rounded-2xl font-bold text-slate-500">
                ✓ Bạn đã hoàn thành trọn vẹn ca làm việc hôm nay
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Bàn Giao Kho Tầng 1 */}
      {showHandoverModal && (
        <ShiftHandoverModal
          currentUser={currentUser}
          onClose={() => setShowHandoverModal(false)}
          onSuccess={() => {
            setShowHandoverModal(false);
            alert("Biên bản bàn giao Kho Tầng 1 đã gửi! Khi ca sau xác nhận, bạn sẽ được phép Check-out.");
          }}
        />
      )}

      {gpsModal}

      {/* Modal Đăng Ký Ca Thứ 6 */}
      {showFridayModal && (
        <FridayShiftRegistrationModal
          onClose={() => setShowFridayModal(false)}
          onSuccess={() => {
            setShowFridayModal(false);
            alert("Đã gửi đăng ký ca làm việc tuần tới thành công cho HR!");
          }}
        />
      )}
    </div>
  );
}

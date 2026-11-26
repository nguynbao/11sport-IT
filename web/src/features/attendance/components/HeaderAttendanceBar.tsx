"use client";

import React from "react";
import type { StaffUser } from "@/shared/types";
import { ShiftHandoverModal } from "@/features/pos";
import { Play, Pause, CheckCircle2, AlertTriangle, Home, Clock, Boxes, BellRing } from "lucide-react";
import FridayShiftRegistrationModal from "./FridayShiftRegistrationModal";
import IncomingHandoverPopup from "./IncomingHandoverPopup";
import LateCheckoutModal from "./LateCheckoutModal";
import { useHeaderAttendanceBar } from "../hooks/useHeaderAttendanceBar";
import { localDateStr } from "../utils/localDate";

interface Props {
  currentUser: StaffUser | null;
}

export default function HeaderAttendanceBar({ currentUser }: Props) {
  const {
    attendance, isWfhToday, isEarlyApprovedToday, loading, actionLoading,
    elapsedText, isLunchPaused, feedback, showNotice,
    dailyCheckInfo, currentShiftHandover, setCurrentShiftHandover,
    showHandoverModal, setShowHandoverModal, showFridayModal, setShowFridayModal,
    pendingHandoverToConfirm, showIncomingHandoverPopup, setShowIncomingHandoverPopup,
    mustConfirmBeforeCheckout, setMustConfirmBeforeCheckout,
    confirmNoteInput, setConfirmNoteInput, confirmingHandover,
    incomingSummaries, incomingCheckCategories, incomingCheckLoading,
    incomingActualTotals, setIncomingActualTotals,
    lateCheckoutModal, setLateCheckoutModal, lateCheckoutReasonInput, setLateCheckoutReasonInput,
    handlePlayCheckIn, handlePauseCheckOut, handleDismissIncomingHandover, handleConfirmIncomingHandover,
  } = useHeaderAttendanceBar(currentUser);

  if (!currentUser || currentUser.role === "ADMIN" || currentUser.role === "CEO") return null;

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
    <div className="relative w-full md:w-auto max-w-full flex items-center justify-center">
      <div className="w-full md:w-auto max-w-full flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-2xs text-slate-800">
        {/* Badge WFH nếu có */}
        {isWfhToday && (
          <span
            title="Hôm nay được duyệt làm việc từ xa (WFH)"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 border border-purple-200 text-purple-700 text-[11px] font-bold"
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
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
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
              className={`p-1.5 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-xs transition cursor-pointer disabled:opacity-50 ${
                isAwaitingNextShiftConfirm
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950"
              }`}
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAwaitingNextShiftConfirm
                    ? "bg-blue-600"
                    : isLunchPaused
                    ? "bg-amber-500"
                    : "bg-blue-600 animate-pulse"
                }`}
              />
              <span className="font-mono font-black text-sm sm:text-base text-brand-ink tracking-wider">
                {elapsedText}
              </span>
            </div>

            {/* Nút Kiểm hàng luôn hiển thị cạnh đồng hồ đếm giờ cho nhân viên Sales */}
            {isSalesStaff && !isWfhToday && (
              <div className="flex items-center pl-2 border-l border-slate-300 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(true)}
                  title="Mở bảng Kiểm hàng (Tổng số lượng mặt hàng kiểm trong ngày, Tiền mặt trong quầy & Lý do)"
                  className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer min-w-0 ${
                    isAwaitingNextShiftConfirm
                      ? "bg-blue-50 border border-blue-300 text-brand-ink hover:bg-blue-100"
                      : currentShiftHandover?.status === "DRAFT"
                      ? "bg-blue-50 border border-blue-300 text-brand-ink hover:bg-blue-100"
                      : "bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-brand-ink shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    Kiểm hàng: {checkButtonSummaryText}
                  </span>
                  {isAwaitingNextShiftConfirm ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black">
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
            <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
            <span className="font-mono font-black text-sm sm:text-base text-brand-ink tracking-wider">
              {elapsedText}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 animate-spin text-blue-400" />
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
              ? "bg-blue-950/95 text-blue-300 border-blue-700"
              : "bg-rose-950/95 text-rose-300 border-rose-700"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}


      {showIncomingHandoverPopup && pendingHandoverToConfirm && (
        <IncomingHandoverPopup
          pendingHandoverToConfirm={pendingHandoverToConfirm}
          activeCheckCategories={activeCheckCategories}
          mustConfirmBeforeCheckout={mustConfirmBeforeCheckout}
          incomingDiffCount={incomingDiffCount}
          incomingCheckLoading={incomingCheckLoading}
          incomingSummaries={incomingSummaries}
          incomingActualTotals={incomingActualTotals}
          setIncomingActualTotals={setIncomingActualTotals}
          confirmNoteInput={confirmNoteInput}
          setConfirmNoteInput={setConfirmNoteInput}
          confirmingHandover={confirmingHandover}
          handleDismissIncomingHandover={handleDismissIncomingHandover}
          handleConfirmIncomingHandover={handleConfirmIncomingHandover}
        />
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
        <LateCheckoutModal
          lateMinutes={lateCheckoutModal.lateMinutes}
          reason={lateCheckoutReasonInput}
          actionLoading={actionLoading}
          onReasonChange={setLateCheckoutReasonInput}
          onCancel={() => setLateCheckoutModal(null)}
          onSubmit={(reason) => handlePauseCheckOut(false, "", reason)}
        />
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

"use client";

import React from "react";
import type { StaffUser } from "@/shared/types";
import { LeaveRequestModal, MyLeaveRequestsPanel } from "@/features/leave";
import { CheckCircle2, ArrowLeft, Info } from "lucide-react";
import FridayShiftRegistrationModal from "./FridayShiftRegistrationModal";
import MyCalendarHeader from "./MyCalendarHeader";
import MyCalendarSummary from "./MyCalendarSummary";
import MyCalendarNextWeekSchedule from "./MyCalendarNextWeekSchedule";
import MyCalendarGrid from "./MyCalendarGrid";
import MyCalendarLegend from "./MyCalendarLegend";
import MyCalendarDayModal from "./MyCalendarDayModal";
import { useMyAttendanceCalendar } from "../hooks/useMyAttendanceCalendar";

interface Props {
  currentUser: StaffUser;
  onBack?: () => void;
  onScheduleSeen?: () => void;
}

export default function MyAttendanceCalendar({ currentUser, onBack, onScheduleSeen }: Props) {
  const {
    month, year, data, loading, error, selected, setSelected, toast, notify,
    leaveModal, setLeaveModal, leaveReloadKey, showShiftRegModal, setShowShiftRegModal,
    myShiftSchedule, justSawConfirmedSchedule, isSalesStaff, afterLeaveChange,
    loadShiftSchedule, load, goPrev, goNext, goThisMonth, isThisMonth, grid,
  } = useMyAttendanceCalendar({ currentUser, onScheduleSeen });

  if (currentUser.role === "ADMIN" || currentUser.role === "CEO") {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-sm text-slate-600">
          Tài khoản {currentUser.role === "CEO" ? "Giám đốc (CEO)" : "Quản trị viên (ADMIN)"} không cần chấm công.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
      </div>
    );
  }

  const multiplier = data?.rules.holidayWorkPayMultiplier ?? 4;

  return (
    <div className="max-w-[1600px] mx-auto">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] bg-blue-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          {toast}
        </div>
      )}

      {/* Bố cục 3 cột (12 phần): Trái (2/12) Đơn từ của tôi — Giữa (8/12) Lịch công — Phải (2/12) Chú thích & Quy định */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <aside className="order-2 lg:order-1 lg:col-span-2 lg:sticky lg:top-3">
          <MyLeaveRequestsPanel
            reloadKey={leaveReloadKey}
            onCreate={() => setLeaveModal({})}
            onRequestChangeOff={(l) =>
              setLeaveModal({
                type: "CHANGE_OFF",
                fromDate: l.date,
                sourceLeaveId: l._id,
              })
            }
            onChanged={afterLeaveChange}
          />
        </aside>

        <section className="order-1 lg:order-2 lg:col-span-8 space-y-3 min-w-0">
          <MyCalendarHeader
            currentUser={currentUser}
            data={data}
            month={month}
            year={year}
            loading={loading}
            isSalesStaff={isSalesStaff}
            isThisMonth={isThisMonth}
            onBack={onBack}
            onShiftReg={() => setShowShiftRegModal(true)}
            onCreate={() => setLeaveModal({})}
            onThisMonth={goThisMonth}
            goPrev={goPrev}
            goNext={goNext}
            load={load}
          />

          <MyCalendarSummary
            data={data}
            month={month}
            year={year}
            isSalesStaff={isSalesStaff}
            multiplier={multiplier}
            onRegisterPaidLeave={() => setLeaveModal({ type: "PAID_LEAVE" })}
          />

          {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}

          {/* Lịch làm việc tuần sau cho nhân viên khối Bán hàng (SALES) */}
          {isSalesStaff && myShiftSchedule && (
            <MyCalendarNextWeekSchedule
              myShiftSchedule={myShiftSchedule}
              justSawConfirmedSchedule={justSawConfirmedSchedule}
              onRegister={() => setShowShiftRegModal(true)}
            />
          )}

          {/* Lịch tháng */}
          <MyCalendarGrid
            loading={loading}
            data={data}
            grid={grid}
            multiplier={multiplier}
            onSelect={(day, cell) => setSelected({ day, cell })}
          />
        </section>

        {/* Cột phải (2/12): Chú thích chuẩn HR & Quy định chấm công */}
        <aside className="order-3 lg:col-span-2 lg:sticky lg:top-3 space-y-2.5">
          <MyCalendarLegend data={data} multiplier={multiplier} />
        </aside>
      </div>

      {showShiftRegModal && (
        <FridayShiftRegistrationModal
          onClose={() => setShowShiftRegModal(false)}
          onSuccess={() => {
            setShowShiftRegModal(false);
            notify("Đã gửi đăng ký ca tuần sau cho HR!");
            loadShiftSchedule();
            load();
          }}
        />
      )}

      {leaveModal && (
        <LeaveRequestModal
          department={data?.row?.department || currentUser.department || "OFFICE"}
          contractType={data?.row?.contractType || currentUser.contractType}
          defaultDate={leaveModal.date}
          defaultFromDate={leaveModal.fromDate}
          defaultSourceLeaveId={leaveModal.sourceLeaveId}
          defaultType={leaveModal.type}
          onClose={() => setLeaveModal(null)}
          onSubmitted={(msg) => {
            setLeaveModal(null);
            afterLeaveChange(msg);
          }}
        />
      )}

      {selected && data?.row && (
        <MyCalendarDayModal
          day={selected.day}
          cell={selected.cell}
          department={data.row.department}
          contractType={data.row.contractType}
          multiplier={multiplier}
          onClose={() => setSelected(null)}
          onRequestChangeOff={(fromDate, sourceLeaveId) => {
            setSelected(null);
            setLeaveModal({
              type: "CHANGE_OFF",
              fromDate,
              sourceLeaveId,
            });
          }}
          onSubmitted={(msg) => {
            setSelected(null);
            afterLeaveChange(msg);
          }}
        />
      )}
    </div>
  );
}

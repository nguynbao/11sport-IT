"use client";


import { CreateLeaveModal,MyLeaveRequestsPanel } from "@/features/leave";
import { LeaveRequestType,MyCalendarCell,MyCalendarData,MyCalendarDay,StaffUser } from "@/shared/types";
import {
ChevronLeft,
ChevronRight,
Hourglass,
RefreshCw,
Send
} from "lucide-react";
import { useCallback,useEffect,useMemo,useState } from "react";
import { fetchMyCalendarApi } from "../api";
import {
CONTRACT_LABEL,
fmtMinutes,
WEEK_HEADERS
} from "../myCalendar.constants";
import { DayCell,DayDetailModal,StatCard } from "./MyCalendarSubViews";

export default function MyAttendanceCalendar({
  currentUser,
  onBack,
}: {
  currentUser: StaffUser;
  onBack?: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<MyCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ day: MyCalendarDay; cell: MyCalendarCell } | null>(null);
  const [leaveModal, setLeaveModal] = useState<{
    date?: string;
    fromDate?: string;
    sourceLeaveId?: string;
    type?: LeaveRequestType;
  } | null>(null);
  const [leaveReloadKey, setLeaveReloadKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (currentUser.role === "ADMIN" || currentUser.role === "CEO") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyCalendarApi(month, year);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Không tải được lịch chấm công");
    } finally {
      setLoading(false);
    }
  }, [month, year, currentUser.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = () => {
      load();
    };
    window.addEventListener("attendance-changed", h);
    return () => window.removeEventListener("attendance-changed", h);
  }, [load]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const grid = useMemo(() => {
    if (!data) return [];
    const firstWeekday = data.days[0]?.weekday ?? 0;
    const blanks: (MyCalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null);
    return [...blanks, ...data.days];
  }, [data]);

  const availableOffDays = useMemo(() => {
    const out: {
      date: string;
      offType: "OFF" | "PAID_LEAVE";
      sourceLeaveId?: string;
      label: string;
    }[] = [];
    const seen = new Set<string>();
    const cells = data?.row?.cells || {};
    for (const [dateStr, cell] of Object.entries(cells)) {
      const activeLeave = (cell.leaveRequests || []).find(
        (l) =>
          (l.type === "OFF" || l.type === "PAID_LEAVE") &&
          (l.status === "APPROVED" || l.status === "PENDING")
      );
      if (activeLeave) {
        seen.add(dateStr);
        out.push({
          date: dateStr,
          offType: activeLeave.type === "PAID_LEAVE" ? "PAID_LEAVE" : "OFF",
          sourceLeaveId: activeLeave.id,
          label: `${dateStr} (${activeLeave.type === "PAID_LEAVE" ? "Phép" : "OFF"})`,
        });
      } else if (cell.code === "LEAVE" || cell.code === "PAID_LEAVE") {
        seen.add(dateStr);
        out.push({
          date: dateStr,
          offType: cell.code === "PAID_LEAVE" ? "PAID_LEAVE" : "OFF",
          label: `${dateStr} (${cell.code === "PAID_LEAVE" ? "Phép" : "OFF"})`,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (currentUser.role === "ADMIN" || currentUser.role === "CEO") {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
        <div className="text-base font-extrabold text-slate-800">
          Tài khoản {currentUser.role === "CEO" ? "Giám đốc (CEO)" : "Quản trị viên (ADMIN)"} không cần chấm công cá nhân
        </div>
        <p className="text-xs text-slate-500">
          Vui lòng xem và điều chỉnh bảng công toàn công ty tại mục <b>Quản lý Nhân sự & Chấm công (HRM)</b>.
        </p>
      </div>
    );
  }

  const s = data?.row?.summary;
  const pct = s && s.standardDays > 0 ? Math.min(100, Math.round((s.paidUnits / s.standardDays) * 100)) : 0;
  const multiplier = data?.rules?.holidayWorkPayMultiplier || 4;

  const afterLeaveChange = (msg: string) => {
    notify(msg);
    setLeaveReloadKey((k) => k + 1);
    load();
  };

  return (
    <div className="w-full space-y-3">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Cột trái (2/12): Đơn từ của tôi */}
        <aside className="order-2 lg:order-1 lg:col-span-2 lg:sticky lg:top-3">
          <MyLeaveRequestsPanel
            reloadKey={leaveReloadKey}
            onCreate={() => setLeaveModal({})}
            onRequestChangeOff={(leave) =>
              setLeaveModal({
                type: "CHANGE_OFF",
                fromDate: leave.date,
                sourceLeaveId: leave._id,
              })
            }
            onChanged={afterLeaveChange}
          />
        </aside>

        {/* Cột giữa (8/12): Lịch chấm công tháng */}
        <section className="order-1 lg:order-2 lg:col-span-8 space-y-3 min-w-0">
          {/* Thanh tiêu đề + chọn tháng + gửi đơn */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="whitespace-nowrap">Lịch Chấm Công Của Tôi</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-brand-ink whitespace-nowrap">
                  Khối Văn phòng
                </span>
                {data?.row?.contractType && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                      data.row.contractType === "FULLTIME"
                        ? "bg-teal-100 text-brand-ink"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    HĐ: {CONTRACT_LABEL[data.row.contractType] || data.row.contractType}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Bấm vào một ngày trên lịch để xem giờ vào/ra hoặc gửi đơn xin nghỉ, chuyển ngày off, WFH, đi trễ, về sớm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Quay lại
                </button>
              )}
              <button
                type="button"
                onClick={() => setLeaveModal({})}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Gửi đơn
              </button>
              <button
                type="button"
                onClick={() => setLeaveModal({ type: "CHANGE_OFF" })}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Xin chuyển ngày off
              </button>
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs sm:text-sm font-extrabold text-slate-800 min-w-[96px] text-center">
                  Tháng {month}/{year}
                </span>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMonth(now.getMonth() + 1);
                  setYear(now.getFullYear());
                }}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={load}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Tải lại"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Tổng hợp tháng */}
          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Tổng công tính lương</div>
                <div className="flex items-end gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-900">{s.paidUnits.toFixed(2)}</span>
                  <span className="text-sm font-bold text-slate-400 mb-0.5">/ {s.standardDays}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${pct >= 95 ? "bg-teal-500" : pct >= 80 ? "bg-yellow-400" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Đi làm {s.workUnits.toFixed(2)}
                  {s.holidayPaidDays > 0 && (
                    <span className="text-rose-600 font-semibold"> + Lễ {s.holidayPaidDays}</span>
                  )}
                  {(s.paidLeaveUsed ?? 0) > 0 && (
                    <span className="text-brand-ink font-semibold"> + Phép {s.paidLeaveUsed}</span>
                  )}
                </div>
              </div>
              <StatCard label="Tổng giờ làm" value={`${s.totalHours.toFixed(1)}h`} tone="slate" />
              <StatCard label="Đi trễ" value={`${s.lateCount} lần`} sub={fmtMinutes(s.lateMinutes)} tone="yellow" />
              <StatCard label="Về sớm" value={`${s.earlyCount} lần`} sub={fmtMinutes(s.earlyMinutes)} tone="pink" />
              <StatCard
                label="Vắng / Quên ra ca"
                value={`${s.absentDays} / ${s.missingCheckout}`}
                tone="red"
              />
              <StatCard
                label="Tăng ca"
                value={fmtMinutes(s.overtimeMinutes)}
                sub={`${s.overtimeDays || 0} ngày`}
                tone="indigo"
              />
              <StatCard
                label={`Làm ngày lễ (x${multiplier})`}
                value={`${s.holidayWorkDays} ngày`}
                sub={s.holidayWorkHours ? `${s.holidayWorkHours}h` : undefined}
                tone="rose"
              />
            </div>
          )}

          {s && (s.pendingRequests ?? 0) > 0 && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Hourglass className="w-4 h-4" />
              Bạn có {s.pendingRequests} đơn đang chờ HR duyệt trong tháng này.
            </div>
          )}

          {s && (
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
                data?.row?.contractType !== "FULLTIME"
                  ? "bg-slate-50 border-slate-200 text-slate-600"
                  : (s.paidLeaveRemaining ?? Math.max(0, (s.paidLeaveEntitled || 0) - (s.paidLeaveUsed || 0))) > 0
                    ? "bg-teal-50 border-teal-200 text-teal-900"
                    : "bg-slate-100 border-slate-300 text-slate-700"
              }`}
            >
              <span>
                <b>Quỹ nghỉ phép có lương (tích lũy đến tháng {month}/{year}):</b>{" "}
                {data?.row?.contractType !== "FULLTIME" ? (
                  <>
                    Đang ở giai đoạn{" "}
                    <b>{CONTRACT_LABEL[data?.row?.contractType || ""] || "Chưa cập nhật"}</b>
                    {data?.row?.contractType === "PROBATION" && (s.paidLeaveFromProbation ?? 0) > 0
                      ? ` • Đã tích lũy ${s.paidLeaveFromProbation} ngày phép thử việc – sẽ được cộng vào quỹ phép ngay khi ký HĐ Chính thức.`
                      : " – khi lên HĐ Chính thức sẽ được cộng số ngày phép tương ứng tháng thử việc (tối đa 2 ngày) + 1 ngày phép mỗi tháng chính thức."}
                  </>
                ) : (
                  <>
                    Có thể dùng <b>{s.paidLeaveEntitled || 0} ngày</b>
                    {(s.paidLeaveFromProbation ?? 0) > 0
                      ? ` (gồm +${s.paidLeaveFromProbation} ngày từ thử việc)`
                      : ""}{" "}
                    • Đã dùng trong tháng: <b>{s.paidLeaveUsed || 0} ngày</b> • Còn để dành cộng dồn:{" "}
                    <b>
                      {s.paidLeaveRemaining ?? Math.max(0, (s.paidLeaveEntitled || 0) - (s.paidLeaveUsed || 0))} ngày
                    </b>{" "}
                    (dùng liên tiếp tối đa 1 tuần; từ 2 ngày phép trở đi phải tạo đơn trước 3 tuần).
                  </>
                )}
              </span>
              {data?.row?.contractType === "FULLTIME" &&
                (s.paidLeaveRemaining ?? Math.max(0, (s.paidLeaveEntitled || 0) - (s.paidLeaveUsed || 0))) > 0 && (
                  <button
                    type="button"
                    onClick={() => setLeaveModal({ type: "PAID_LEAVE" })}
                    className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold"
                  >
                    Đăng ký nghỉ phép
                  </button>
                )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
          )}

          {/* Lịch tháng */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-4 shadow-sm space-y-2">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
              {WEEK_HEADERS.map((h, i) => (
                <div
                  key={h}
                  className={`py-1 text-[11px] sm:text-xs font-extrabold uppercase ${
                    i === 0 ? "text-rose-600" : "text-slate-500"
                  }`}
                >
                  {h}
                </div>
              ))}
            </div>

            {loading && !data ? (
              <div className="py-20 text-center text-slate-400 text-sm">Đang tải lịch công...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {grid.map((day, idx) => {
                  if (!day) {
                    return (
                      <div key={`blank-${idx}`} className="rounded-xl bg-slate-50/40 min-h-[72px] sm:min-h-[104px]" />
                    );
                  }
                  const cell = data?.row?.cells[day.date];
                  if (!cell) {
                    return <div key={day.date} className="rounded-xl border border-slate-200 min-h-[72px] sm:min-h-[104px]" />;
                  }
                  return (
                    <DayCell
                      key={day.date}
                      day={day}
                      cell={cell}
                      department={data?.row?.department || "OFFICE"}
                      multiplier={multiplier}
                      onClick={() => setSelected({ day, cell })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cột phải (2/12): Chú thích chuẩn HR & Quy định chấm công */}
        <aside className="order-3 lg:col-span-2 lg:sticky lg:top-3 space-y-2.5">
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-3 shadow-sm space-y-2.5">
            <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
              Chú thích:
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1.5 text-[11px] text-slate-700">
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] text-[11px] font-black inline-flex items-center justify-center">
                  ✓
                </span>
                <span className="font-medium truncate">Đúng giờ</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#BFDBFE]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#3B82F6] text-white animate-pulse text-[9px] font-black inline-flex items-center justify-center">
                  ●
                </span>
                <span className="font-medium truncate">Đang làm</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#A5F3FC]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#0891B2] text-white text-[9px] font-black inline-flex items-center justify-center">
                  W
                </span>
                <span className="font-medium truncate">Làm từ xa (WFH)</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#C7D2FE]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#4F46E5] text-white text-[8px] font-black inline-flex items-center justify-center">
                  TC
                </span>
                <span className="font-medium truncate">Tăng ca (đã duyệt)</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#FBBF24] text-[#451A03] text-[8px] font-black inline-flex items-center justify-center">
                  T/S
                </span>
                <span className="font-medium truncate" title="Đi trễ (T) / Về sớm (S) / Cả hai (TS)">
                  Đi trễ (T) / Về sớm (S) / Cả hai (TS)
                </span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECACA]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#DC2626] text-white text-[9px] font-black inline-flex items-center justify-center">
                  !
                </span>
                <span className="font-medium truncate">Quên check-out</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECDD3]">
                <span className="w-4 h-4 shrink-0 rounded bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185] text-[9px] font-black inline-flex items-center justify-center">
                  V
                </span>
                <span className="font-medium truncate">Vắng không phép</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                <span className="w-4 h-4 shrink-0 rounded bg-slate-200 text-slate-700 border border-slate-300 text-[9px] font-black inline-flex items-center justify-center">
                  P
                </span>
                <span className="font-medium truncate">Nghỉ OFF không lương</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[8px] font-black inline-flex items-center justify-center">
                  PL
                </span>
                <span className="font-medium truncate">Phép có lương (+1 công)</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                  L
                </span>
                <span className="font-medium truncate">Nghỉ lễ (+1 công VP)</span>
              </div>

              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
                  ★
                </span>
                <span className="font-medium truncate">Đi làm lễ (lương x{multiplier})</span>
              </div>
            </div>

            {data && (
              <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px] leading-relaxed text-slate-600">
                <div className="font-extrabold text-slate-800 uppercase">Quy định</div>
                <p>• Tuần làm 6 ngày (nghỉ Chủ nhật).</p>
                <p>• Ca hành chính: 08:30 – 17:30 (nghỉ trưa 12:00 – 13:00, chuẩn 8h/ngày).</p>
                <p>
                  • Trễ quá {data.rules.lateToleranceMinutes}p tính đi trễ. Khối Văn phòng chỉ tính tăng ca khi được HR yêu cầu.
                </p>
                <p>• Nghỉ lễ chính thức hưởng +1 công; đi làm ngày lễ lương x{multiplier}.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {leaveModal && (
        <CreateLeaveModal
          department={data?.row?.department || currentUser.department || "OFFICE"}
          contractType={data?.row?.contractType || currentUser.contractType}
          defaultDate={leaveModal.date}
          defaultFromDate={leaveModal.fromDate}
          defaultType={leaveModal.type}
          availableOffDays={availableOffDays}
          paidLeaveRemaining={
            s?.paidLeaveRemaining ?? Math.max(0, (s?.paidLeaveEntitled || 0) - (s?.paidLeaveUsed || 0))
          }
          paidLeaveEntitled={s?.paidLeaveEntitled || 0}
          paidLeaveFromProbation={s?.paidLeaveFromProbation || 0}
          salesOffRemaining={s?.salesOffRemaining}
          onClose={() => setLeaveModal(null)}
          onSuccess={(msg) => {
            setLeaveModal(null);
            afterLeaveChange(msg);
          }}
        />
      )}

      {selected && data?.row && (
        <DayDetailModal
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


"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StaffUser,
  MyCalendarData,
  MyCalendarCell,
  MyCalendarCellCode,
  MyCalendarDay,
  LeaveRequestType,
  fetchMyCalendarApi,
  createLeaveRequestApi,
} from "@/lib/api";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  RefreshCw,
  Timer,
  Hourglass,
  FileText,
  Info,
} from "lucide-react";
import {
  LeaveRequestModal,
  MyLeaveRequestsPanel,
  CONTRACT_LABEL,
  isPaidLeaveEligible,
  LEAVE_REASON_MAX,
} from "./LeaveRequests";

// ---------------------------------------------------------------------------
// Màu & nhãn cho từng trạng thái ngày công
// ---------------------------------------------------------------------------
const STATUS: Record<
  MyCalendarCellCode,
  { label: string; short: string; box: string; dayNum: string; dot: string }
> = {
  ON_TIME: {
    label: "Đúng giờ",
    short: "Đúng giờ",
    box: "bg-emerald-50 border-emerald-400",
    dayNum: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  LATE: {
    label: "Đi trễ",
    short: "Trễ",
    box: "bg-yellow-50 border-yellow-400",
    dayNum: "text-yellow-700",
    dot: "bg-yellow-400",
  },
  EARLY: {
    label: "Về sớm",
    short: "Về sớm",
    box: "bg-pink-50 border-pink-400",
    dayNum: "text-pink-700",
    dot: "bg-pink-500",
  },
  LATE_EARLY: {
    label: "Đi trễ & về sớm",
    short: "Trễ + sớm",
    box: "bg-gradient-to-br from-yellow-50 to-pink-50 border-pink-400",
    dayNum: "text-pink-700",
    dot: "bg-gradient-to-r from-yellow-400 to-pink-500",
  },
  WFH: {
    label: "Làm việc từ xa (WFH)",
    short: "WFH",
    box: "bg-purple-50 border-purple-400",
    dayNum: "text-purple-700",
    dot: "bg-purple-500",
  },
  WORKING: {
    label: "Đang làm việc",
    short: "Đang làm",
    box: "bg-blue-50 border-blue-500",
    dayNum: "text-blue-700",
    dot: "bg-blue-500",
  },
  MISSING_OUT: {
    label: "Quên check-out",
    short: "Quên ra ca",
    box: "bg-red-50 border-red-500 border-dashed",
    dayNum: "text-red-700",
    dot: "bg-red-600",
  },
  PAID_LEAVE: {
    label: "Nghỉ phép có lương (+1 công)",
    short: "Phép có lương",
    box: "bg-teal-50 border-teal-500",
    dayNum: "text-teal-700",
    dot: "bg-teal-500",
  },
  LEAVE: {
    label: "Nghỉ không lương (đã duyệt)",
    short: "Nghỉ KL",
    box: "bg-sky-50 border-sky-400",
    dayNum: "text-sky-700",
    dot: "bg-sky-500",
  },
  ABSENT: {
    label: "Vắng không phép",
    short: "Vắng",
    box: "bg-red-100 border-red-500",
    dayNum: "text-red-700",
    dot: "bg-red-500",
  },
  HOLIDAY: {
    label: "Nghỉ lễ chính thức (hưởng lương)",
    short: "Nghỉ lễ",
    box: "bg-rose-50 border-rose-400",
    dayNum: "text-rose-700",
    dot: "bg-rose-500",
  },
  DAY_OFF: {
    label: "Ngày nghỉ (OFF)",
    short: "OFF",
    box: "bg-slate-100 border-slate-300",
    dayNum: "text-slate-400",
    dot: "bg-slate-400",
  },
  UNSCHEDULED: {
    label: "Chưa được xếp ca",
    short: "Chưa xếp ca",
    box: "bg-white border-slate-300 border-dashed",
    dayNum: "text-slate-500",
    dot: "bg-white border border-dashed border-slate-400",
  },
  FUTURE: {
    label: "Chưa tới",
    short: "",
    box: "bg-white border-slate-300",
    dayNum: "text-slate-700",
    dot: "bg-white border border-slate-300",
  },
};

const LEGEND: MyCalendarCellCode[] = [
  "ON_TIME",
  "LATE",
  "EARLY",
  "WFH",
  "ABSENT",
  "DAY_OFF",
  "PAID_LEAVE",
  "LEAVE",
  "HOLIDAY",
  "MISSING_OUT",
  "WORKING",
];

const LEAVE_TYPE_LABEL: Record<LeaveRequestType, string> = {
  PAID_LEAVE: "Nghỉ phép có lương",
  OFF: "Xin off",
  LATE: "Xin đi trễ",
  EARLY: "Xin về sớm",
  WFH: "Làm từ xa (WFH)",
};
const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-100 text-rose-700" },
};

const WEEK_HEADERS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function fmtMinutes(min?: number): string {
  if (!min) return "0p";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}p`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

interface Props {
  currentUser: StaffUser;
  onBack?: () => void;
}

export default function MyAttendanceCalendar({ currentUser, onBack }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<MyCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ day: MyCalendarDay; cell: MyCalendarCell } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [leaveModal, setLeaveModal] = useState<{ date?: string; type?: LeaveRequestType } | null>(null);
  const [leaveReloadKey, setLeaveReloadKey] = useState(0);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const afterLeaveChange = (msg: string) => {
    notify(msg);
    setLeaveReloadKey((k) => k + 1);
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMyCalendarApi(month, year));
    } catch (e: any) {
      setError(e?.message || "Không tải được lịch công");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (currentUser.role !== "ADMIN") load();
  }, [load, currentUser.role]);

  const goPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const isThisMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Lưới 6 tuần, bắt đầu từ Chủ nhật
  const grid = useMemo(() => {
    if (!data) return [];
    const first = new Date(year, month - 1, 1);
    const lead = first.getDay();
    const cells: (MyCalendarDay | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (const d of data.days) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [data, month, year]);

  if (currentUser.role === "ADMIN") {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-sm text-slate-600">Tài khoản Quản trị viên (ADMIN) không cần chấm công.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
      </div>
    );
  }

  const s = data?.row?.summary;
  const pct = s && s.standardDays > 0 ? Math.min(100, (s.paidUnits / s.standardDays) * 100) : 0;
  const multiplier = data?.rules.holidayWorkPayMultiplier ?? 4;

  return (
    <div className="max-w-[1600px] mx-auto">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Bố cục 3 cột (10 phần): Trái (2/10) Đơn từ của tôi — Giữa (7/10) Lịch công — Phải (1/10) Chú thích & Quy định */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 items-start">
        <aside className="order-2 lg:order-1 lg:col-span-2 lg:sticky lg:top-3">
          <MyLeaveRequestsPanel
            reloadKey={leaveReloadKey}
            onCreate={() => setLeaveModal({})}
            onChanged={afterLeaveChange}
          />
        </aside>

        <section className="order-1 lg:order-2 lg:col-span-7 space-y-3 min-w-0">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  Lịch công của tôi
                </h2>
                <p className="text-[11px] text-slate-500">
                  {currentUser.fullName} • {data?.row?.department === "SALES" ? "Khối Bán hàng" : "Khối Văn phòng"}
                  {data?.row ? ` • chuẩn ${data.row.standardHours}h/ngày` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLeaveModal({})}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Tạo đơn (Nghỉ / WFH / Trễ / Về sớm)
              </button>
              {!isThisMonth && (
                <button
                  type="button"
                  onClick={() => {
                    setMonth(now.getMonth() + 1);
                    setYear(now.getFullYear());
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  Tháng này
                </button>
              )}
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button type="button" onClick={goPrev} className="p-1.5 rounded-lg hover:bg-white text-slate-600" title="Tháng trước">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-sm font-extrabold text-slate-900 min-w-[112px] text-center">
                  Tháng {month}, {year}
                </span>
                <button type="button" onClick={goNext} className="p-1.5 rounded-lg hover:bg-white text-slate-600" title="Tháng sau">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
                    className={`h-full ${pct >= 95 ? "bg-emerald-500" : pct >= 80 ? "bg-yellow-400" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Đi làm {s.workUnits.toFixed(2)}
                  {s.holidayPaidDays > 0 && <span className="text-rose-600 font-semibold"> + Lễ {s.holidayPaidDays}</span>}
                  {s.paidLeaveUsed > 0 && <span className="text-teal-600 font-semibold"> + Phép {s.paidLeaveUsed}</span>}
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
                sub={`${s.overtimeDays} ngày`}
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

          {s && s.pendingRequests > 0 && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Hourglass className="w-4 h-4" />
              Bạn có {s.pendingRequests} đơn đang chờ HR duyệt trong tháng này.
            </div>
          )}

          {s && (
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${!s.paidLeaveEntitled
                ? "bg-slate-50 border-slate-200 text-slate-500"
                : s.paidLeaveUsed
                  ? "bg-teal-50 border-teal-200 text-teal-800"
                  : s.paidLeaveForfeited
                    ? "bg-slate-100 border-slate-300 text-slate-600"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
            >
              <span>
                Ngày nghỉ phép có lương tháng {month}/{year}:{" "}
                {!s.paidLeaveEntitled
                  ? `không áp dụng – chỉ dành cho nhân viên Chính thức (HĐ của bạn: ${CONTRACT_LABEL[data?.row?.contractType || ""] || "Chưa cập nhật"
                  })`
                  : s.paidLeaveUsed
                    ? "đã dùng 1/1 ngày ✓"
                    : s.paidLeaveForfeited
                      ? "không sử dụng – đã mất quyền lợi"
                      : "còn 1 ngày – hãy đăng ký trước khi hết tháng, không dùng sẽ mất quyền lợi"}
              </span>
              {!!s.paidLeaveEntitled && !s.paidLeaveUsed && !s.paidLeaveForfeited && (
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

          {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}

          {/* Lịch tháng */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-2">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
              {WEEK_HEADERS.map((h, i) => (
                <div
                  key={h}
                  className={`py-1 text-[11px] sm:text-xs font-extrabold uppercase ${i === 0 ? "text-rose-600" : "text-slate-500"
                    }`}
                >
                  {h}
                </div>
              ))}
            </div>

            {loading && !data ? (
              <div className="py-20 text-center text-slate-400 text-sm">Đang tải lịch công...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {grid.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} className="rounded-xl bg-slate-50/40 min-h-[78px] sm:min-h-[104px]" />;
                  const cell = data?.row?.cells[day.date];
                  if (!cell) return <div key={day.date} className="rounded-xl border border-slate-200 min-h-[78px]" />;
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

        {/* Cột phải (1/10): Chú thích màu & Quy định chấm công */}
        <aside className="order-3 lg:col-span-1 lg:sticky lg:top-3 space-y-2.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm space-y-2">
            <h3 className="text-xs font-extrabold text-slate-900 pb-1.5 border-b border-slate-100">
              Chú thích
            </h3>
            <div className="flex flex-col gap-1.5 text-[10px] leading-snug text-slate-600">
              {LEGEND.map((code) => (
                <div key={code} className="flex items-start gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded shrink-0 mt-0.5 ${STATUS[code].dot}`} />
                  <span>{STATUS[code].label}</span>
                </div>
              ))}
              <div className="flex items-start gap-1.5">
                <span className="px-1 rounded bg-indigo-600 text-white text-[8px] font-black shrink-0 mt-0.5">TC</span>
                <span>Tăng ca</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="px-1 rounded bg-rose-600 text-white text-[8px] font-black shrink-0 mt-0.5">
                  x{multiplier}
                </span>
                <span>Đi làm ngày lễ (lương x{multiplier})</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="px-1 rounded bg-amber-500 text-white text-[8px] font-black shrink-0 mt-0.5">
                  Sự kiện
                </span>
                <span>Lễ kỷ niệm (làm bình thường)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span>Có đơn chờ duyệt</span>
              </div>
            </div>

            {data && (
              <div className="pt-2 border-t border-slate-100 space-y-1 text-[10px] leading-relaxed text-slate-500">
                <div className="font-extrabold text-slate-700">Quy định</div>
                <p>
                  • Tuần làm 6 ngày (
                  {data.row?.department === "SALES" ? "nghỉ đúng 1 ngày OFF theo lịch xếp ca" : "nghỉ Chủ nhật"}).
                </p>
                <p>
                  • {data.rules.shifts.SHIFT_1}; {data.rules.shifts.SHIFT_2}.
                </p>
                <p>
                  • Trễ quá {data.rules.lateToleranceMinutes}p tính đi trễ. Tăng ca tính từ {data.rules.overtimeMinMinutes}p sau giờ kết ca.
                </p>
                <p>
                  •{" "}
                  {data.row?.department === "SALES"
                    ? `Khối Bán hàng: không có ngày nghỉ mặc định (kể cả CN & lễ) – nghỉ theo ngày OFF xếp ca; làm ngày lễ lương x${multiplier}.`
                    : `Khối Văn phòng: nghỉ lễ chính thức hưởng +1 công; đi làm ngày lễ lương x${multiplier}.`}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {leaveModal && (
        <LeaveRequestModal
          department={data?.row?.department || currentUser.department || "OFFICE"}
          contractType={data?.row?.contractType || currentUser.contractType}
          defaultDate={leaveModal.date}
          defaultType={leaveModal.type}
          onClose={() => setLeaveModal(null)}
          onSubmitted={(msg) => {
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
          onSubmitted={(msg) => {
            setSelected(null);
            afterLeaveChange(msg);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "slate" | "yellow" | "pink" | "red" | "indigo" | "rose";
}) {
  const tones = {
    slate: "border-slate-200",
    yellow: "border-yellow-300 bg-yellow-50/50",
    pink: "border-pink-300 bg-pink-50/50",
    red: "border-red-300 bg-red-50/50",
    indigo: "border-indigo-300 bg-indigo-50/50",
    rose: "border-rose-300 bg-rose-50/50",
  } as const;
  return (
    <div className={`bg-white rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold text-slate-500 truncate">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ô ngày trên lịch
// ---------------------------------------------------------------------------
function DayCell({
  day,
  cell,
  department,
  multiplier,
  onClick,
}: {
  day: MyCalendarDay;
  cell: MyCalendarCell;
  department: string;
  multiplier: number;
  onClick: () => void;
}) {
  const isUnpaidHoliday = cell.code === "HOLIDAY" && !cell.isPaidHoliday;
  const st = isUnpaidHoliday ? STATUS.DAY_OFF : STATUS[cell.code];
  const hasPending = (cell.leaveRequests || []).some((l) => l.status === "PENDING");
  const eventHoliday = day.holiday && !day.holiday.isOfficialDayOff ? day.holiday : null;
  const officialHoliday = day.holiday && day.holiday.isOfficialDayOff ? day.holiday : null;
  const shiftLabel = cell.shiftCode === "SHIFT_2" ? "Ca 2" : cell.shiftCode === "SHIFT_1" ? "Ca 1" : null;

  let statusText = st.short;
  if (cell.code === "EARLY" || cell.code === "LATE_EARLY") {
    statusText = cell.earlyApproved ? "Xin về sớm" : st.short;
  }
  if (cell.code === "LATE" && cell.lateApproved) statusText = "Trễ (có đơn)";
  if (cell.code === "FUTURE" && shiftLabel) statusText = shiftLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden text-left rounded-xl border-2 p-1.5 sm:p-2 min-h-[78px] sm:min-h-[104px] flex flex-col transition hover:shadow-md hover:-translate-y-0.5 ${st.box} ${day.isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""
        }`}
    >
      {/* Ruy băng chéo góc phải: x4 lương khi đi làm ngày lễ */}
      {cell.isHolidayWork && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-rose-600 text-white text-[9px] font-black text-center py-[1px] shadow">
          x{multiplier} lương
        </span>
      )}
      {/* Nhãn sự kiện (lễ kỷ niệm) */}
      {!cell.isHolidayWork && eventHoliday && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-amber-500 text-white text-[8px] font-black text-center py-[1px]">
          Sự kiện
        </span>
      )}
      {!cell.isHolidayWork && officialHoliday && (
        <span className="pointer-events-none absolute top-[7px] -right-[22px] w-[78px] rotate-45 bg-rose-600 text-white text-[8px] font-black text-center py-[1px]">
          {department === "SALES" ? `LỄ • x${multiplier}` : "LỄ"}
        </span>
      )}

      <div className="flex items-center gap-1">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs sm:text-sm font-black ${day.isToday ? "bg-blue-600 text-white" : st.dayNum
            }`}
        >
          {day.day}
        </span>
        {hasPending && <span className="w-2 h-2 rounded-full bg-amber-500" title="Có đơn chờ duyệt" />}
        {cell.adjusted && <span className="w-1.5 h-1.5 rounded-full bg-slate-800" title="HR đã điều chỉnh" />}
      </div>

      <div className="mt-auto space-y-0.5 min-w-0">
        {statusText && (
          <div className={`text-[10px] sm:text-[11px] font-extrabold truncate ${st.dayNum}`}>{statusText}</div>
        )}
        {cell.checkIn && (
          <div className="hidden sm:block text-[10px] font-mono text-slate-600 truncate">
            {cell.checkIn}–{cell.checkOut || "--:--"}
          </div>
        )}
        {(officialHoliday || eventHoliday) && (
          <div className="hidden sm:block text-[9px] text-slate-500 truncate" title={day.holiday!.name}>
            {day.holiday!.name}
          </div>
        )}
        <div className="flex flex-wrap gap-0.5">
          {!!cell.overtimeMinutes && (
            <span className="px-1 rounded bg-indigo-600 text-white text-[9px] font-black">
              TC {fmtMinutes(cell.overtimeMinutes)}
            </span>
          )}
          {cell.isPaidHoliday && cell.code === "HOLIDAY" && (
            <span className="px-1 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">+1 công</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modal chi tiết ngày + gửi đơn
// ---------------------------------------------------------------------------
function DayDetailModal({
  day,
  cell,
  department,
  contractType,
  multiplier,
  onClose,
  onSubmitted,
}: {
  day: MyCalendarDay;
  cell: MyCalendarCell;
  department: string;
  contractType?: string;
  multiplier: number;
  onClose: () => void;
  onSubmitted: (msg: string) => void;
}) {
  const paidLeaveAllowed = isPaidLeaveEligible(contractType);
  const st = cell.code === "HOLIDAY" && !cell.isPaidHoliday ? STATUS.DAY_OFF : STATUS[cell.code];
  const [yy, mm, dd] = day.date.split("-");
  const leaveTypes: LeaveRequestType[] =
    department === "OFFICE" ? ["PAID_LEAVE", "OFF", "LATE", "EARLY", "WFH"] : ["PAID_LEAVE", "OFF", "LATE", "EARLY"];

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<LeaveRequestType>(cell.code === "ABSENT" ? "OFF" : "EARLY");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await createLeaveRequestApi({ type, date: day.date, reason: reason.trim() });
      onSubmitted(`Đã gửi đơn "${LEAVE_TYPE_LABEL[type]}" ngày ${dd}/${mm}, chờ HR duyệt`);
    } catch (e: any) {
      setErr(e?.message || "Không gửi được đơn");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              {WEEK_HEADERS[day.weekday]}, {dd}/{mm}/{yy}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3 h-3 rounded ${st.dot}`} />
              <span className="text-base font-extrabold text-slate-900">{st.label}</span>
            </div>
            {day.holiday && (
              <span
                className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${day.holiday.isOfficialDayOff ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                  }`}
              >
                {day.holiday.isOfficialDayOff ? "Lễ chính thức" : "Sự kiện"}: {day.holiday.name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          {cell.attendanceId ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <InfoBox label="Giờ vào" value={cell.checkIn || "—"} />
              <InfoBox label="Giờ ra" value={cell.checkOut || "Chưa ra"} danger={!cell.checkOut} />
              <InfoBox label="Giờ công" value={cell.hours ? `${cell.hours}h` : "—"} />
            </div>
          ) : (
            <div className="text-xs text-slate-500">Không có dữ liệu chấm công ngày này.</div>
          )}

          <div className="space-y-1.5 text-xs">
            {cell.shiftCode && (
              <Row icon={<Clock className="w-3.5 h-3.5" />} text={cell.shiftCode === "SHIFT_2" ? "Ca 2 (12:00 – 21:00)" : "Ca 1 (08:30 – 17:30)"} />
            )}
            {!!cell.lateMinutes && cell.lateMinutes > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />}
                text={`Đi trễ ${cell.lateMinutes} phút${cell.lateApproved ? " (có đơn được duyệt)" : ""}`}
              />
            )}
            {!!cell.earlyMinutes && cell.earlyMinutes > 0 && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-pink-600" />}
                text={`Về sớm ${cell.earlyMinutes} phút${cell.earlyApproved ? " (có đơn xin về sớm)" : ""}`}
              />
            )}
            {!!cell.overtimeMinutes && (
              <Row icon={<Timer className="w-3.5 h-3.5 text-indigo-600" />} text={`Tăng ca ${fmtMinutes(cell.overtimeMinutes)}`} />
            )}
            {cell.isHolidayWork && (
              <Row
                icon={<span className="px-1 rounded bg-rose-600 text-white text-[9px] font-black">x{multiplier}</span>}
                text={`Đi làm ngày lễ chính thức – hưởng lương x${multiplier}`}
              />
            )}
            {day.holiday?.isOfficialDayOff && department === "SALES" && (
              <Row
                icon={<Info className="w-3.5 h-3.5 text-rose-600" />}
                text={`Khối Bán hàng: ngày lễ vẫn đi làm bình thường (không có ngày nghỉ mặc định), hưởng lương x${multiplier}.`}
              />
            )}
            {cell.isPaidHoliday && cell.code === "HOLIDAY" && (
              <Row icon={<CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />} text="Nghỉ lễ hưởng nguyên lương (+1 công)" />
            )}
            {cell.code === "MISSING_OUT" && (
              <Row
                icon={<AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                text="Bạn chưa check-out ngày này. Liên hệ HR để điều chỉnh giờ ra."
              />
            )}
            {cell.adjusted && (
              <Row
                icon={<Info className="w-3.5 h-3.5 text-slate-500" />}
                text={`HR ${cell.adjustedByName || ""} đã điều chỉnh: ${cell.adjustReason || ""}`}
              />
            )}
          </div>

          {/* Đơn từ của ngày */}
          {(cell.leaveRequests || []).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Đơn từ ngày này
              </div>
              {cell.leaveRequests!.map((l) => (
                <div key={l.id} className="p-2 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{LEAVE_TYPE_LABEL[l.type]}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEAVE_STATUS[l.status]?.cls}`}>
                      {LEAVE_STATUS[l.status]?.label}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5 break-words">{l.reason}</div>
                  {l.reviewNote && <div className="text-slate-400 italic mt-0.5">HR: {l.reviewNote}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Gửi đơn */}
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi đơn cho ngày này
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-2 gap-1.5">
                {leaveTypes.map((t) => {
                  const locked = t === "PAID_LEAVE" && !paidLeaveAllowed;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setType(t)}
                      title={locked ? "Chỉ nhân viên hợp đồng Chính thức mới được dùng" : undefined}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${locked
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through"
                          : type === t
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      {LEAVE_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              <div>
                <textarea
                  rows={2}
                  maxLength={LEAVE_REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, LEAVE_REASON_MAX))}
                  placeholder="Lý do..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <span
                  className={`block text-right text-[10px] ${reason.length >= LEAVE_REASON_MAX ? "text-rose-600 font-bold" : "text-slate-400"
                    }`}
                >
                  {reason.length}/{LEAVE_REASON_MAX} ký tự
                </span>
              </div>
              {err && <div className="text-xs text-rose-600 font-semibold">{err}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {sending ? "Đang gửi..." : "Gửi đơn"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`font-mono font-extrabold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-slate-700">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TimesheetData,
  TimesheetRow,
  TimesheetCell,
  TimesheetCellCode,
  TimesheetDay,
  Department,
  fetchTimesheetApi,
  adjustAttendanceApi,
  createManualAttendanceApi,
} from "@/lib/api";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn } from "@/lib/excel";
import ExportExcelButton from "./ExportExcelButton";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  AlertTriangle,
  UserX,
  LogOut,
  Activity,
  CheckCircle2,
  X,
  Pencil,
  Plus,
  LayoutGrid,
  ListChecks,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Cấu hình hiển thị từng loại ô công
// ---------------------------------------------------------------------------
const CELL_STYLE: Record<
  TimesheetCellCode,
  { symbol: string; label: string; className: string; excel: string }
> = {
  ON_TIME: { symbol: "✓", label: "Đúng giờ", className: "bg-emerald-500 text-white", excel: "X" },
  LATE: { symbol: "T", label: "Đi trễ", className: "bg-amber-400 text-amber-950", excel: "T" },
  EARLY: { symbol: "S", label: "Về sớm", className: "bg-orange-400 text-white", excel: "S" },
  LATE_EARLY: { symbol: "TS", label: "Trễ & về sớm", className: "bg-orange-600 text-white", excel: "TS" },
  WFH: { symbol: "W", label: "Làm từ xa (WFH)", className: "bg-purple-500 text-white", excel: "W" },
  WORKING: { symbol: "●", label: "Đang làm", className: "bg-blue-500 text-white animate-pulse", excel: "●" },
  MISSING_OUT: { symbol: "!", label: "Quên check-out", className: "bg-red-600 text-white", excel: "!" },
  LEAVE: { symbol: "P", label: "Nghỉ không lương (đã duyệt)", className: "bg-sky-100 text-sky-700 border border-sky-300", excel: "P" },
  PAID_LEAVE: { symbol: "PL", label: "Nghỉ phép có lương (+1 công)", className: "bg-teal-500 text-white", excel: "PL" },
  ABSENT: { symbol: "V", label: "Vắng không phép", className: "bg-rose-100 text-rose-700 border border-rose-400", excel: "V" },
  HOLIDAY: { symbol: "L", label: "Nghỉ lễ chính thức (hưởng lương, tính công)", className: "bg-rose-500 text-white", excel: "L" },
  DAY_OFF: { symbol: "", label: "Ngày nghỉ / không có ca", className: "bg-slate-50 text-slate-300", excel: "" },
  UNSCHEDULED: { symbol: "?", label: "Sales chưa được xếp ca", className: "bg-white text-slate-400 border border-dashed border-slate-400", excel: "?" },
  FUTURE: { symbol: "", label: "Chưa tới", className: "bg-white text-slate-300 border border-dashed border-slate-200", excel: "" },
};

const LEGEND_ORDER: TimesheetCellCode[] = [
  "ON_TIME",
  "LATE",
  "EARLY",
  "LATE_EARLY",
  "WFH",
  "WORKING",
  "MISSING_OUT",
  "LEAVE",
  "PAID_LEAVE",
  "ABSENT",
  "HOLIDAY",
];

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

type ViewMode = "MATRIX" | "SUMMARY";
type IssueFilter = "ALL" | "ISSUES";

interface EditTarget {
  row: TimesheetRow;
  day: TimesheetDay;
  cell: TimesheetCell;
}

function formatMinutes(min: number): string {
  if (!min) return "0p";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}p` : ""}` : `${m}p`;
}

function hasIssue(row: TimesheetRow): boolean {
  const s = row.summary;
  return s.lateCount > 0 || s.earlyCount > 0 || s.missingCheckout > 0 || s.absentDays > 0;
}

export default function AttendanceTimesheetModule() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [department, setDepartment] = useState<Department | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("ALL");
  const [view, setView] = useState<ViewMode>("MATRIX");

  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [showManual, setShowManual] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTimesheetApi({ month, year, department });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Không tải được bảng công");
    } finally {
      setLoading(false);
    }
  }, [month, year, department]);

  useEffect(() => {
    load();
  }, [load]);

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
  const goThisMonth = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !r.staffName.toLowerCase().includes(q) && !r.staffCode.toLowerCase().includes(q)) return false;
      if (issueFilter === "ISSUES" && !hasIssue(r)) return false;
      return true;
    });
  }, [data, search, issueFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.workUnits += r.summary.paidUnits;
        acc.totalHours += r.summary.totalHours;
        acc.lateCount += r.summary.lateCount;
        acc.missing += r.summary.missingCheckout;
        acc.absent += r.summary.absentDays;
        acc.holidayWork += r.summary.holidayWorkDays;
        return acc;
      },
      { workUnits: 0, totalHours: 0, lateCount: 0, missing: 0, absent: 0, holidayWork: 0 }
    );
  }, [filteredRows]);

  // ---------------------------------------------------------------------------
  // Xuất Excel: Sheet 1 Tổng hợp công, Sheet 2 Bảng công chi tiết theo ngày
  // ---------------------------------------------------------------------------
  const handleExport = () => {
    if (!data) return;
    const deptLabel = (d: string) => (d === "OFFICE" ? "Văn phòng" : "Bán hàng");

    const summaryCols: ExcelColumn<TimesheetRow>[] = [
      { header: "Mã NV", value: (r) => r.staffCode },
      { header: "Họ và tên", value: (r) => r.staffName, width: 26 },
      { header: "Khối", value: (r) => deptLabel(r.department) },
      { header: "Công chuẩn", value: (r) => r.summary.standardDays, format: "int", total: true },
      { header: "Công đi làm", value: (r) => r.summary.workUnits, total: true },
      { header: "Công lễ hưởng lương", value: (r) => r.summary.holidayPaidDays, format: "int", total: true },
      { header: "Tổng công tính lương", value: (r) => r.summary.paidUnits, total: true },
      { header: "Tổng giờ", value: (r) => r.summary.totalHours, total: true },
      { header: "Số lần trễ", value: (r) => r.summary.lateCount, format: "int", total: true },
      { header: "Phút trễ", value: (r) => r.summary.lateMinutes, format: "int", total: true },
      { header: "Số lần về sớm", value: (r) => r.summary.earlyCount, format: "int", total: true },
      { header: "Phút về sớm", value: (r) => r.summary.earlyMinutes, format: "int", total: true },
      { header: "Quên check-out", value: (r) => r.summary.missingCheckout, format: "int", total: true },
      { header: "Vắng không phép", value: (r) => r.summary.absentDays, format: "int", total: true },
      { header: "Nghỉ không lương", value: (r) => r.summary.leaveDays, format: "int", total: true },
      {
        header: "Phép có lương (đã dùng/được hưởng)",
        value: (r) =>
          r.summary.paidLeaveEntitled
            ? `${r.summary.paidLeaveUsed || 0}/${r.summary.paidLeaveEntitled}${r.summary.paidLeaveForfeited ? " - Mất quyền lợi" : ""}`
            : "Không áp dụng",
        width: 26,
      },
      { header: "WFH", value: (r) => r.summary.wfhDays, format: "int", total: true },
      { header: "Đi làm ngày lễ", value: (r) => r.summary.holidayWorkDays, format: "int", total: true },
      { header: "Giờ làm ngày lễ", value: (r) => r.summary.holidayWorkHours, total: true },
    ];

    const dayCols: ExcelColumn<TimesheetRow>[] = [
      { header: "Mã NV", value: (r) => r.staffCode },
      { header: "Họ và tên", value: (r) => r.staffName, width: 26 },
      ...data.days.map<ExcelColumn<TimesheetRow>>((d) => ({
        header: `${d.day} ${WEEKDAY_SHORT[d.weekday]}`,
        value: (r) => {
          const c = r.cells[d.date];
          if (!c) return "";
          const sym = CELL_STYLE[c.code]?.excel || "";
          return c.isHolidayWork && sym ? `${sym}*` : sym;
        },
        width: 6,
      })),
      { header: "Tổng công", value: (r) => r.summary.paidUnits, total: true },
      { header: "Giờ", value: (r) => r.summary.totalHours, total: true },
    ];

    const subtitle =
      "Ký hiệu: X đúng giờ, T trễ, S về sớm, TS trễ & về sớm, W WFH, ! quên check-out, P nghỉ không lương, PL nghỉ phép có lương, V vắng, L nghỉ lễ chính thức (hưởng lương, tính 1 công), * đi làm ngày lễ";

    downloadExcel(excelFileName(`BangCong_T${month}_${year}`), [
      buildSheet("Tổng hợp công", summaryCols, filteredRows, {
        title: `TỔNG HỢP CÔNG THÁNG ${month}/${year}`,
      }),
      buildSheet("Bảng công chi tiết", dayCols, filteredRows, {
        title: `BẢNG CHẤM CÔNG CHI TIẾT THÁNG ${month}/${year}`,
        subtitle,
      }),
    ]);
  };

  const overview = data?.overview;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Bảng Chấm Công Toàn Công Ty</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Chấm công bù
          </button>
          <ExportExcelButton onExport={handleExport} disabled={!data || filteredRows.length === 0} />
        </div>
      </div>

      {/* KPI hôm nay & tháng */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Tổng nhân sự"
          value={overview?.totalStaff ?? "-"}
          tone="slate"
        />
        <KpiCard
          icon={<Activity className="w-4 h-4" />}
          label="Đang làm việc"
          value={isCurrentMonth ? overview?.workingNow ?? "-" : "-"}
          sub={isCurrentMonth ? `${overview?.checkedInToday ?? 0} đã check-in hôm nay` : "Chỉ áp dụng tháng hiện tại"}
          tone="blue"
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="Đi trễ hôm nay"
          value={isCurrentMonth ? overview?.lateToday ?? "-" : "-"}
          tone="amber"
        />
        <KpiCard
          icon={<UserX className="w-4 h-4" />}
          label="Chưa check-in hôm nay"
          value={isCurrentMonth ? overview?.notCheckedInToday ?? "-" : "-"}
          tone="rose"
        />
        <KpiCard
          icon={<LogOut className="w-4 h-4" />}
          label="Quên check-out (tháng)"
          value={overview?.missingCheckoutMonth ?? "-"}
          sub="Cần HR điều chỉnh"
          tone="red"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Vắng không phép (tháng)"
          value={overview?.absentMonth ?? "-"}
          tone="rose"
        />
      </div>

      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Chọn tháng */}
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={goPrev}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-extrabold text-slate-900 min-w-[110px] text-center">
              Tháng {month}/{year}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goThisMonth}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Tháng này
            </button>
          )}

          {/* Khối */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
            {(
              [
                ["ALL", "Tất cả"],
                ["OFFICE", "Văn phòng"],
                ["SALES", "Bán hàng"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDepartment(val)}
                className={`px-2.5 py-1.5 rounded-md transition cursor-pointer ${department === val ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lọc vấn đề */}
          <button
            type="button"
            onClick={() => setIssueFilter((f) => (f === "ALL" ? "ISSUES" : "ALL"))}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${issueFilter === "ISSUES"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Chỉ NV có vi phạm
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên / mã NV..."
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={load}
            title="Tải lại"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Chế độ xem */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("MATRIX")}
            className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${view === "MATRIX" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Bảng công tháng
          </button>
          <button
            type="button"
            onClick={() => setView("SUMMARY")}
            className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${view === "SUMMARY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Tổng hợp công
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-slate-400 text-sm">Đang tải bảng công...</div>
      ) : !data || filteredRows.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Không có nhân sự phù hợp bộ lọc.</div>
      ) : view === "MATRIX" ? (
        <MatrixView
          data={data}
          rows={filteredRows}
          onCellClick={(row, day, cell) => setEditTarget({ row, day, cell })}
        />
      ) : (
        <SummaryView rows={filteredRows} />
      )}

      {/* Tổng cuối bảng + chú thích */}
      {data && filteredRows.length > 0 && (
        <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
            {LEGEND_ORDER.map((code) => (
              <span key={code} className="inline-flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded text-[9px] font-black inline-flex items-center justify-center ${CELL_STYLE[code].className}`}
                >
                  {CELL_STYLE[code].symbol}
                </span>
                {CELL_STYLE[code].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-emerald-500 ring-2 ring-rose-500 ring-offset-1 inline-block" />
              Đi làm ngày lễ (lương x4)
            </span>
          </div>
          <div className="text-xs text-slate-600 flex flex-wrap gap-3 font-semibold">
            <span>
              Tổng công: <b className="text-slate-900">{totals.workUnits.toFixed(2)}</b>
            </span>
            <span>
              Tổng giờ: <b className="text-slate-900">{totals.totalHours.toFixed(1)}h</b>
            </span>
            <span>
              Lượt trễ: <b className="text-amber-700">{totals.lateCount}</b>
            </span>
            <span>
              Quên ra ca: <b className="text-red-600">{totals.missing}</b>
            </span>
            <span>
              Vắng: <b className="text-rose-700">{totals.absent}</b>
            </span>
            <span>
              Làm ngày lễ: <b className="text-rose-600">{totals.holidayWork}</b>
            </span>
          </div>
        </div>
      )}

      {editTarget && (
        <CellDetailModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(msg) => {
            setEditTarget(null);
            showToast(msg);
            load();
          }}
        />
      )}

      {showManual && data && (
        <ManualAttendanceModal
          rows={data.rows}
          onClose={() => setShowManual(false)}
          onSaved={(msg) => {
            setShowManual(false);
            showToast(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone: "slate" | "blue" | "amber" | "rose" | "red";
}) {
  const toneMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    red: "bg-red-50 border-red-200 text-red-700",
  } as const;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-75 truncate">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ma trận nhân viên × ngày
// ---------------------------------------------------------------------------
function MatrixView({
  data,
  rows,
  onCellClick,
}: {
  data: TimesheetData;
  rows: TimesheetRow[];
  onCellClick: (row: TimesheetRow, day: TimesheetDay, cell: TimesheetCell) => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh]">
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b border-r border-slate-200 px-3 py-2 text-left font-bold text-slate-700 min-w-[190px]">
              Nhân viên
            </th>
            {data.days.map((d) => {
              const isSun = d.weekday === 0;
              const officialHoliday = d.holiday?.isOfficialDayOff;
              return (
                <th
                  key={d.date}
                  title={d.holiday ? d.holiday.name : undefined}
                  className={`sticky top-0 z-20 border-b border-slate-200 px-0 py-1.5 w-8 min-w-[32px] text-center font-semibold ${d.isToday
                      ? "bg-blue-600 text-white"
                      : officialHoliday
                        ? "bg-rose-100 text-rose-700"
                        : isSun
                          ? "bg-slate-200/70 text-rose-600"
                          : "bg-slate-100 text-slate-600"
                    }`}
                >
                  <div className="text-[12px] font-extrabold leading-none">{d.day}</div>
                  <div className="text-[9px] leading-none mt-0.5 opacity-80">{WEEKDAY_SHORT[d.weekday]}</div>
                </th>
              );
            })}
            <th className="sticky top-0 right-[56px] z-30 bg-emerald-50 border-b border-l border-slate-200 px-2 py-2 text-center font-bold text-emerald-800 min-w-[64px]">
              Công
            </th>
            <th className="sticky top-0 right-0 z-30 bg-emerald-50 border-b border-slate-200 px-2 py-2 text-center font-bold text-emerald-800 min-w-[56px]">
              Giờ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = row.summary.standardDays > 0 ? row.summary.paidUnits / row.summary.standardDays : 0;
            return (
              <tr key={row.staffId} className="group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 px-3 py-1.5">
                  <div className="font-bold text-slate-900 truncate max-w-[170px]">{row.staffName}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="font-mono">{row.staffCode}</span>
                    <span
                      className={`px-1.5 rounded font-semibold ${row.department === "OFFICE" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-700"
                        }`}
                    >
                      {row.department === "OFFICE" ? "VP" : "BH"}
                    </span>
                    {hasIssue(row) && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                  </div>
                </td>
                {data.days.map((d) => {
                  const cell = row.cells[d.date];
                  if (!cell) return <td key={d.date} className="border-b border-slate-100" />;
                  const baseStyle = CELL_STYLE[cell.code];
                  // Lễ không được cộng công (Khối Bán hàng, hoặc lễ trùng Chủ nhật) -> hiển thị nhạt
                  const style =
                    cell.code === "HOLIDAY" && !cell.isPaidHoliday
                      ? {
                        ...baseStyle,
                        className: "bg-rose-50 text-rose-400",
                        label:
                          row.department === "SALES"
                            ? "Ngày lễ – Khối Bán hàng không cộng công (đi làm hưởng x4)"
                            : "Ngày lễ trùng ngày nghỉ tuần",
                      }
                      : baseStyle;
                  const clickable = cell.code !== "FUTURE" && cell.code !== "HOLIDAY";
                  const title = [
                    `${row.staffName} • ${d.day}/${data.month}`,
                    style.label,
                    cell.checkIn ? `Vào ${cell.checkIn}${cell.checkOut ? ` – Ra ${cell.checkOut}` : ""}` : "",
                    cell.hours ? `${cell.hours}h` : "",
                    cell.lateMinutes ? `Trễ ${cell.lateMinutes}p` : "",
                    cell.earlyMinutes ? `Về sớm ${cell.earlyMinutes}p` : "",
                    cell.overtimeStatus === "PENDING" && cell.lateCheckoutMinutes
                      ? `⏳ Check-out trễ ${cell.lateCheckoutMinutes}p – Chờ HR xét duyệt tăng ca${cell.lateCheckoutReason ? ` (Lý do: ${cell.lateCheckoutReason})` : ""}`
                      : "",
                    cell.overtimeMinutes ? `Tăng ca (đã duyệt): ${cell.overtimeMinutes}p` : "",
                    cell.isPaidHoliday ? "Nghỉ lễ hưởng nguyên lương: +1 công" : "",
                    cell.isHolidayWork ? "Đi làm ngày lễ chính thức – lương x4" : "",
                    cell.adjusted ? `Đã điều chỉnh bởi ${cell.adjustedByName}: ${cell.adjustReason}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <td
                      key={d.date}
                      className={`border-b border-slate-100 p-[3px] text-center ${d.isToday ? "bg-blue-50/60" : ""}`}
                    >
                      <button
                        type="button"
                        title={title}
                        disabled={!clickable}
                        onClick={() => onCellClick(row, d, cell)}
                        className={`relative w-[26px] h-[26px] rounded-md text-[10px] font-black inline-flex items-center justify-center transition ${style.className
                          } ${cell.isHolidayWork ? "ring-2 ring-rose-500 ring-offset-1" : ""} ${cell.overtimeStatus === "PENDING" ? "ring-2 ring-amber-500 ring-offset-1" : ""} ${clickable ? "hover:scale-110 hover:shadow-md cursor-pointer" : "cursor-default"
                          }`}
                      >
                        {style.symbol}
                        {cell.overtimeStatus === "PENDING" && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                        )}
                        {cell.adjusted && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-900" />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="sticky right-[56px] z-10 bg-white group-hover:bg-slate-50 border-b border-l border-slate-200 px-2 py-1.5 text-center">
                  <div
                    className="font-extrabold text-slate-900"
                    title={`Đi làm ${row.summary.workUnits} công + Lễ hưởng lương ${row.summary.holidayPaidDays} công`}
                  >
                    {row.summary.paidUnits.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-slate-400">/{row.summary.standardDays}</div>
                  <div className="h-1 rounded bg-slate-100 mt-0.5 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0.95 ? "bg-emerald-500" : pct >= 0.8 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-b border-slate-200 px-2 py-1.5 text-center font-bold text-emerald-700">
                  {row.summary.totalHours.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bảng tổng hợp công theo nhân viên
// ---------------------------------------------------------------------------
function SummaryView({ rows }: { rows: TimesheetRow[] }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh]">
      <table className="w-full text-xs text-slate-700">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold">
          <tr>
            <th className="px-3 py-2 text-left">Nhân viên</th>
            <th className="px-2 py-2 text-center">Tổng công / chuẩn</th>
            <th className="px-2 py-2 text-center">Tổng giờ</th>
            <th className="px-2 py-2 text-center">Đi trễ</th>
            <th className="px-2 py-2 text-center">Về sớm</th>
            <th className="px-2 py-2 text-center">Quên ra ca</th>
            <th className="px-2 py-2 text-center">Vắng KP</th>
            <th className="px-2 py-2 text-center">Nghỉ không lương</th>
            <th className="px-2 py-2 text-center">Phép có lương</th>
            <th className="px-2 py-2 text-center">WFH</th>
            <th className="px-2 py-2 text-center">Làm ngày lễ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const s = r.summary;
            const pct = s.standardDays > 0 ? s.paidUnits / s.standardDays : 0;
            return (
              <tr key={r.staffId} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="font-bold text-slate-900">{r.staffName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {r.staffCode} • {r.department === "OFFICE" ? "Văn phòng" : "Bán hàng"} • chuẩn {r.standardHours}h/ngày
                  </div>
                </td>
                <td className="px-2 py-2 min-w-[150px]">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-900">{s.paidUnits.toFixed(2)}</span>
                    <span className="text-slate-400">/ {s.standardDays}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Đi làm {s.workUnits.toFixed(2)}
                    {s.holidayPaidDays > 0 && (
                      <span className="text-rose-600 font-semibold"> + Lễ {s.holidayPaidDays}</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0.95 ? "bg-emerald-500" : pct >= 0.8 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-bold text-emerald-700">{s.totalHours.toFixed(1)}h</td>
                <td className="px-2 py-2 text-center">
                  {s.lateCount > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      {s.lateCount} lần • {formatMinutes(s.lateMinutes)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.earlyCount > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">
                      {s.earlyCount} lần • {formatMinutes(s.earlyMinutes)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.missingCheckout > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">{s.missingCheckout}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.absentDays > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">{s.absentDays}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{s.leaveDays || <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-2 text-center">
                  {!s.paidLeaveEntitled ? (
                    <span className="text-[10px] text-slate-300" title="Chỉ áp dụng HĐ Chính thức">Không áp dụng</span>
                  ) : s.paidLeaveUsed ? (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">Đã dùng 1/1</span>
                  ) : s.paidLeaveForfeited ? (
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold">Mất quyền lợi</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Còn 1 ngày</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{s.wfhDays || <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-2 text-center">
                  {s.holidayWorkDays > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                      {s.holidayWorkDays} ngày • {s.holidayWorkHours}h
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chi tiết ô công + điều chỉnh / chấm công bù
// ---------------------------------------------------------------------------
function CellDetailModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { row, day, cell } = target;
  const hasRecord = Boolean(cell.attendanceId);
  const isSales = row.department === "SALES";
  const defaultShift = (cell.shiftCode || "SHIFT_1") as "SHIFT_1" | "SHIFT_2" | "BOTH";

  const [checkIn, setCheckIn] = useState(
    cell.checkIn || (defaultShift === "SHIFT_2" ? "12:00" : "08:30")
  );
  const [checkOut, setCheckOut] = useState(
    cell.checkOut || (defaultShift === "SHIFT_1" ? "17:30" : "21:00")
  );
  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH">(defaultShift);
  const [overtimeStatus, setOvertimeStatus] = useState<"NONE" | "PENDING" | "APPROVED" | "REJECTED">(
    cell.overtimeStatus || "NONE"
  );
  const [overtimeApprovedMinutes, setOvertimeApprovedMinutes] = useState<number>(
    cell.overtimeApprovedMinutes || cell.lateCheckoutMinutes || 0
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const style = CELL_STYLE[cell.code];
  const [yy, mm, dd] = day.date.split("-");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do để lưu vết điều chỉnh.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (hasRecord) {
        await adjustAttendanceApi(cell.attendanceId!, {
          checkIn,
          checkOut: checkOut || undefined,
          shiftCode: isSales ? shiftCode : undefined,
          overtimeStatus: shiftCode === "BOTH" ? "NONE" : overtimeStatus,
          overtimeApprovedMinutes:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED"
              ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
              : 0,
          reason: reason.trim(),
        });
        onSaved(`Đã điều chỉnh giờ công ${row.staffName} ngày ${dd}/${mm}`);
      } else {
        await createManualAttendanceApi({
          staffId: row.staffId,
          date: day.date,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkIn,
          checkOut: checkOut || undefined,
          overtimeStatus:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED" ? "APPROVED" : "NONE",
          overtimeApprovedMinutes:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED"
              ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
              : 0,
          reason: reason.trim(),
        });
        onSaved(`Đã chấm công bù cho ${row.staffName} ngày ${dd}/${mm}`);
      }
    } catch (e: any) {
      setErr(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">
              {WEEKDAY_SHORT[day.weekday]}, {dd}/{mm}/{yy}
              {day.holiday && (
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${day.holiday.isOfficialDayOff ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                    }`}
                >
                  {day.holiday.name}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {row.staffName} <span className="text-xs font-mono text-slate-400">{row.staffCode}</span>
            </h3>
            <span
              className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${style.className}`}
            >
              {style.symbol && <span>{style.symbol}</span>}
              {style.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasRecord && (
          <div className="px-5 py-3 bg-slate-50 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-slate-400">Giờ vào</div>
              <div className="font-mono font-bold text-slate-900">{cell.checkIn || "—"}</div>
            </div>
            <div>
              <div className="text-slate-400">Giờ ra</div>
              <div className={`font-mono font-bold ${cell.checkOut ? "text-slate-900" : "text-red-600"}`}>
                {cell.checkOut || "Chưa ra"}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Giờ công</div>
              <div className="font-mono font-bold text-emerald-700">{cell.hours ? `${cell.hours}h` : "—"}</div>
            </div>
            {(cell.lateMinutes || cell.earlyMinutes) ? (
              <div className="col-span-3 text-[11px] text-slate-600">
                {cell.lateMinutes ? `Trễ ${cell.lateMinutes} phút` : ""}
                {cell.lateMinutes && cell.earlyMinutes ? " • " : ""}
                {cell.earlyMinutes ? `Về sớm ${cell.earlyMinutes} phút` : ""}
              </div>
            ) : null}
            {cell.adjusted && (
              <div className="col-span-3 text-[11px] text-slate-500 italic">
                Đã điều chỉnh bởi {cell.adjustedByName || "HR"}: {cell.adjustReason}
              </div>
            )}
            {!!cell.lateCheckoutMinutes && (
              <div className="col-span-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-left text-[11px] text-amber-900">
                <div>
                  <b>Check-out trễ sau giờ kết ca:</b> {cell.lateCheckoutMinutes} phút{" "}
                  <span className="font-bold">
                    (
                    {cell.overtimeStatus === "APPROVED"
                      ? `HR đã duyệt tính tăng ca ${cell.overtimeMinutes || cell.overtimeApprovedMinutes}p`
                      : cell.overtimeStatus === "REJECTED"
                      ? "HR không tính tăng ca"
                      : "⏳ Đang chờ HR xem xét"}
                    )
                  </span>
                </div>
                {cell.lateCheckoutReason && (
                  <div className="mt-0.5 text-slate-700">
                    <b>Lý do NV giải trình:</b> {cell.lateCheckoutReason}
                  </div>
                )}
              </div>
            )}
            {cell.note && !cell.adjusted && (
              <div className="col-span-3 text-[11px] text-slate-500 italic">{cell.note}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            {hasRecord ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {hasRecord ? "Điều chỉnh giờ công" : "Chấm công bù cho ngày này"}
          </div>

          {isSales && (
            <div className="grid grid-cols-3 gap-2">
              {(["SHIFT_1", "SHIFT_2", "BOTH"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setShiftCode(sc)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${shiftCode === sc
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                      : "bg-white border-slate-200 text-slate-600"
                    }`}
                >
                  {sc === "BOTH"
                    ? "Ca 1+2 (08:30–21:00)"
                    : sc === "SHIFT_1"
                    ? "Ca 1 (08:30–17:30)"
                    : "Ca 2 (12:00–21:00)"}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Giờ vào *
              <input
                type="time"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Giờ ra
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </label>
          </div>

          {/* Xét duyệt Tăng ca / Check-out trễ */}
          {isSales ? (
            shiftCode === "BOTH" ? (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                Nhân viên làm <b>2 ca (Ca 1 + Ca 2: 08:30–21:00)</b> theo bảng xếp ca —{" "}
                <b>không tính là tăng ca</b>.
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2 text-xs">
                <div className="font-bold text-indigo-950">
                  Xét duyệt Check-out trễ / Tăng ca (Khối Bán hàng – 1 ca)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOvertimeStatus("NONE")}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      overtimeStatus === "NONE" || overtimeStatus === "REJECTED"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    Không tính TC
                  </button>
                  <button
                    type="button"
                    onClick={() => setOvertimeStatus("PENDING")}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      overtimeStatus === "PENDING"
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    Chờ xem xét
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOvertimeStatus("APPROVED");
                      if (!overtimeApprovedMinutes && cell.lateCheckoutMinutes) {
                        setOvertimeApprovedMinutes(cell.lateCheckoutMinutes);
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      overtimeStatus === "APPROVED"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    ✓ Duyệt Tăng ca
                  </button>
                </div>
                {overtimeStatus === "APPROVED" && (
                  <label className="block text-[11px] font-semibold text-indigo-900">
                    Số phút check-out trễ được HR quy thành Tăng ca:
                    <input
                      type="number"
                      min={0}
                      value={overtimeApprovedMinutes}
                      onChange={(e) => setOvertimeApprovedMinutes(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold outline-none"
                    />
                  </label>
                )}
              </div>
            )
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2 text-xs">
              <div className="font-bold text-indigo-950">
                Yêu cầu Tăng ca (Khối Văn phòng – chỉ tính khi HR yêu cầu)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOvertimeStatus("NONE")}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                    overtimeStatus !== "APPROVED"
                      ? "bg-slate-800 border-slate-800 text-white"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  Không tăng ca
                </button>
                <button
                  type="button"
                  onClick={() => setOvertimeStatus("APPROVED")}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                    overtimeStatus === "APPROVED"
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  ✓ HR yêu cầu Tăng ca
                </button>
              </div>
              {overtimeStatus === "APPROVED" && (
                <label className="block text-[11px] font-semibold text-indigo-900">
                  Số phút Tăng ca được tính (0 = tự tính theo giờ ra sau 17:30):
                  <input
                    type="number"
                    min={0}
                    value={overtimeApprovedMinutes}
                    onChange={(e) => setOvertimeApprovedMinutes(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold outline-none"
                  />
                </label>
              )}
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do (bắt buộc, lưu vết) *
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </label>

          {err && <div className="text-xs text-rose-600 font-semibold">{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Đang lưu..." : hasRecord ? "Lưu điều chỉnh" : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chấm công bù (chọn nhân viên + ngày bất kỳ)
// ---------------------------------------------------------------------------
function ManualAttendanceModal({
  rows,
  onClose,
  onSaved,
}: {
  rows: TimesheetRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const [staffId, setStaffId] = useState(rows[0]?.staffId || "");
  const [date, setDate] = useState(todayStr);
  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH">("SHIFT_1");
  const [checkIn, setCheckIn] = useState("08:30");
  const [checkOut, setCheckOut] = useState("17:30");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = rows.find((r) => r.staffId === staffId);
  const isSales = selected?.department === "SALES";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !reason.trim()) {
      setErr("Vui lòng chọn nhân viên và nhập lý do.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await createManualAttendanceApi({
        staffId,
        date,
        shiftCode: isSales ? shiftCode : "SHIFT_1",
        checkIn,
        checkOut: checkOut || undefined,
        reason: reason.trim(),
      });
      onSaved(`Đã chấm công bù cho ${selected?.staffName || "nhân viên"}`);
    } catch (e: any) {
      setErr(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Chấm công bù</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Nhân viên *
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {rows.map((r) => (
                <option key={r.staffId} value={r.staffId}>
                  {r.staffCode} – {r.staffName} ({r.department === "OFFICE" ? "VP" : "BH"})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Ngày *
            <input
              type="date"
              required
              max={todayStr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </label>
          {isSales && (
            <div className="grid grid-cols-3 gap-2">
              {(["SHIFT_1", "SHIFT_2", "BOTH"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => {
                    setShiftCode(sc);
                    setCheckIn(sc === "SHIFT_2" ? "12:00" : "08:30");
                    setCheckOut(sc === "SHIFT_1" ? "17:30" : "21:00");
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${shiftCode === sc
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                      : "bg-white border-slate-200 text-slate-600"
                    }`}
                >
                  {sc === "BOTH"
                    ? "Ca 1+2 (08:30–21:00)"
                    : sc === "SHIFT_1"
                    ? "Ca 1 (08:30–17:30)"
                    : "Ca 2 (12:00–21:00)"}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Giờ vào *
              <input
                type="time"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Giờ ra
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Lý do (bắt buộc, lưu vết) *
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Mất mạng không chấm công được, đã xác nhận với quản lý..."
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </label>
          {err && <div className="text-xs text-rose-600 font-semibold">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Đang lưu..." : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

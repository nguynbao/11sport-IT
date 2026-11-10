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
  ChevronDown,
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
// Cấu hình hiển thị từng loại ô công (gom 6 nhóm màu đặc trưng, dễ nhớ, không trùng lặp)
//  1. Xanh lá (Emerald) : Đi làm đúng giờ (✓), WFH (W), Đang trong ca (●)
//  2. Tím (Indigo)      : Tăng ca đã duyệt (TC)
//  3. Hồng Sen (Fuchsia): Nghỉ lễ chính thức hưởng lương (+1 công VP) (L)
//  4. Xanh dương (Blue) : Nghỉ phép có lương (+1 công) (PL)
//  5. Xám (Slate)       : Nghỉ OFF không lương (P)
//  6. Vàng (Amber)      : Đi trễ / Về sớm (T, S, TS)
//  7. Đỏ (Red / Rose)   : Quên check-out (!), Vắng không phép (V)
// ---------------------------------------------------------------------------
const CELL_STYLE: Record<
  TimesheetCellCode,
  { symbol: string; label: string; className: string; excel: string }
> = {
  ON_TIME: { symbol: "✓", label: "Đúng giờ", className: "bg-emerald-500 text-white", excel: "X" },
  WFH: { symbol: "W", label: "Làm từ xa (WFH)", className: "bg-cyan-600 text-white", excel: "W" },
  WORKING: {
    symbol: "●",
    label: "Đang làm",
    className: "bg-sky-500 text-white animate-pulse",
    excel: "●",
  },
  LATE: { symbol: "T", label: "Đi trễ", className: "bg-amber-400 text-amber-950", excel: "T" },
  EARLY: { symbol: "S", label: "Về sớm", className: "bg-amber-400 text-amber-950", excel: "S" },
  LATE_EARLY: { symbol: "TS", label: "Trễ & về sớm", className: "bg-amber-500 text-amber-950", excel: "TS" },
  MISSING_OUT: { symbol: "!", label: "Quên check-out", className: "bg-red-600 text-white", excel: "!" },
  ABSENT: {
    symbol: "V",
    label: "Vắng không phép",
    className: "bg-rose-100 text-rose-700 border border-rose-400",
    excel: "V",
  },
  LEAVE: {
    symbol: "P",
    label: "Nghỉ OFF không lương",
    className: "bg-slate-200 text-slate-700 border border-slate-300",
    excel: "P",
  },
  PAID_LEAVE: {
    symbol: "PL",
    label: "Nghỉ phép có lương (+1 công)",
    className: "bg-blue-600 text-white",
    excel: "PL",
  },
  HOLIDAY: {
    symbol: "L",
    label: "Nghỉ lễ chính thức (VP hưởng lương, +1 công)",
    className: "bg-fuchsia-600 text-white",
    excel: "L",
  },
  DAY_OFF: { symbol: "", label: "Ngày nghỉ / không có ca", className: "bg-slate-50 text-slate-300", excel: "" },
  UNSCHEDULED: {
    symbol: "?",
    label: "Sales chưa được xếp ca",
    className: "bg-white text-slate-400 border border-dashed border-slate-400",
    excel: "?",
  },
  FUTURE: {
    symbol: "",
    label: "Chưa tới",
    className: "bg-white text-slate-300 border border-dashed border-slate-200",
    excel: "",
  },
};

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
  const [exportScope, setExportScope] = useState<string>("ALL");

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
        acc.overtimeMinutes += r.summary.overtimeMinutes || 0;
        acc.holidayPaidDays += r.summary.holidayPaidDays || 0;
        return acc;
      },
      {
        workUnits: 0,
        totalHours: 0,
        lateCount: 0,
        missing: 0,
        absent: 0,
        holidayWork: 0,
        overtimeMinutes: 0,
        holidayPaidDays: 0,
      }
    );
  }, [filteredRows]);

  const monthInfo = useMemo(() => {
    if (!data) return null;
    if (data.monthMeta) return data.monthMeta;
    const daysInMonth = data.days.length;
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const sundaysCount = data.days.filter((d) => d.weekday === 0).length;
    const standardDays = daysInMonth - sundaysCount;
    const officialHolidaysCount = data.days.filter((d) => d.holiday?.isOfficialDayOff).length;
    const officePaidHolidaysCount = data.days.filter(
      (d) => d.holiday?.isOfficialDayOff && d.weekday !== 0
    ).length;
    return {
      daysInMonth,
      isLeapYear,
      sundaysCount,
      standardDays,
      officialHolidaysCount,
      officePaidHolidaysCount,
    };
  }, [data, year]);

  // ---------------------------------------------------------------------------
  // Xuất Excel: Hỗ trợ Xuất tổng (Tổng hợp + Ma trận) & Xuất từng người (Chi tiết + Sheet từng NV)
  // ---------------------------------------------------------------------------
  const handleExport = () => {
    if (!data) return;
    const deptLabel = (d: string) => (d === "OFFICE" ? "Văn phòng" : "Bán hàng");
    const shiftLabel = (sc?: string | null) => {
      if (sc === "SHIFT_1") return "Ca 1 (08:30-17:30)";
      if (sc === "SHIFT_2") return "Ca 2 (12:00-21:00)";
      if (sc === "BOTH") return "Ca 1+2 (08:30-21:00)";
      return "—";
    };
    const cellWorkUnit = (row: TimesheetRow, cell?: TimesheetCell): number => {
      if (!cell) return 0;
      if (cell.code === "PAID_LEAVE" || cell.code === "HOLIDAY") return cell.isPaidHoliday || cell.code === "PAID_LEAVE" ? 1 : 0;
      if (cell.hours && cell.hours > 0 && cell.code !== "MISSING_OUT") {
        if (row.department === "OFFICE" && cell.isPaidHoliday) return 1;
        return Number(Math.min(1, cell.hours / (row.standardHours || 8)).toFixed(2));
      }
      return 0;
    };

    const targetRows = exportScope.startsWith("STAFF:")
      ? filteredRows.filter((r) => r.staffId === exportScope.slice(6))
      : filteredRows;
    if (targetRows.length === 0) return;

    const summaryCols: ExcelColumn<TimesheetRow>[] = [
      { header: "Mã NV", value: (r) => r.staffCode },
      { header: "Họ và tên", value: (r) => r.staffName, width: 26 },
      { header: "Khối", value: (r) => deptLabel(r.department) },
      { header: "Công chuẩn", value: (r) => r.summary.standardDays, format: "int", total: true },
      { header: "Công đi làm", value: (r) => r.summary.workUnits, total: true },
      { header: "Công lễ hưởng lương", value: (r) => r.summary.holidayPaidDays, format: "int", total: true },
      { header: "Tổng công tính lương", value: (r) => r.summary.paidUnits, total: true },
      { header: "Tổng giờ (24h)", value: (r) => r.summary.totalHours, total: true },
      { header: "Số lần trễ", value: (r) => r.summary.lateCount, format: "int", total: true },
      { header: "Phút trễ", value: (r) => r.summary.lateMinutes, format: "int", total: true },
      { header: "Số lần về sớm", value: (r) => r.summary.earlyCount, format: "int", total: true },
      { header: "Phút về sớm", value: (r) => r.summary.earlyMinutes, format: "int", total: true },
      { header: "Số ngày Tăng ca", value: (r) => r.summary.overtimeDays || 0, format: "int", total: true },
      { header: "Phút Tăng ca", value: (r) => r.summary.overtimeMinutes || 0, format: "int", total: true },
      { header: "Quên check-out", value: (r) => r.summary.missingCheckout, format: "int", total: true },
      { header: "Vắng không phép", value: (r) => r.summary.absentDays, format: "int", total: true },
      { header: "Nghỉ không lương (Đơn OFF)", value: (r) => r.summary.leaveDays, format: "int", total: true },
      {
        header: "Hạn mức OFF Sales (đã dùng/4)",
        value: (r) =>
          r.department === "SALES"
            ? `${r.summary.salesOffUsed ?? r.summary.leaveDays}/${r.summary.salesOffEntitled ?? 4}`
            : "Nghỉ CN cố định",
        width: 22,
      },
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
      { header: "Khối", value: (r) => deptLabel(r.department), width: 12 },
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

    type PersonDayRow = {
      row: TimesheetRow;
      day: TimesheetDay;
      cell: TimesheetCell;
    };

    const allPersonDays: PersonDayRow[] = targetRows.flatMap((r) =>
      data.days.map((d) => ({
        row: r,
        day: d,
        cell: r.cells[d.date] || { code: "FUTURE" as TimesheetCellCode },
      }))
    );

    const personDetailCols: ExcelColumn<PersonDayRow>[] = [
      { header: "Mã NV", value: (x) => x.row.staffCode, width: 10 },
      { header: "Họ và tên", value: (x) => x.row.staffName, width: 24 },
      { header: "Khối", value: (x) => deptLabel(x.row.department), width: 12 },
      { header: "Ngày", value: (x) => x.day.date, width: 12 },
      { header: "Thứ", value: (x) => WEEKDAY_SHORT[x.day.weekday], width: 6 },
      {
        header: "Trạng thái",
        value: (x) => CELL_STYLE[x.cell.code]?.label || x.cell.code,
        width: 20,
      },
      { header: "Ca làm việc", value: (x) => shiftLabel(x.cell.shiftCode), width: 18 },
      { header: "Giờ vào (0h-24h)", value: (x) => x.cell.checkIn || "", width: 14 },
      { header: "Giờ ra (0h-24h)", value: (x) => x.cell.checkOut || "", width: 14 },
      { header: "Giờ công", value: (x) => Number(x.cell.hours || 0), total: true, width: 10 },
      { header: "Công tính lương", value: (x) => cellWorkUnit(x.row, x.cell), total: true, width: 14 },
      { header: "Đi trễ (phút)", value: (x) => Number(x.cell.lateMinutes || 0), format: "int", total: true, width: 12 },
      { header: "Về sớm (phút)", value: (x) => Number(x.cell.earlyMinutes || 0), format: "int", total: true, width: 12 },
      { header: "Tăng ca duyệt (phút)", value: (x) => Number(x.cell.overtimeMinutes || 0), format: "int", total: true, width: 16 },
      {
        header: "Ghi chú / Điều chỉnh",
        value: (x) =>
          [
            x.day.holiday ? `Lễ: ${x.day.holiday.name}` : "",
            x.cell.adjusted ? `HR ĐC (${x.cell.adjustedByName || "HR"}): ${x.cell.adjustReason || ""}` : "",
            x.cell.note || "",
          ]
            .filter(Boolean)
            .join(" | "),
        width: 36,
      },
    ];

    const subtitle =
      "Ký hiệu: X đúng giờ, T trễ, S về sớm, TS trễ & về sớm, W WFH, ! quên check-out, P nghỉ không lương, PL nghỉ phép có lương, V vắng, L nghỉ lễ chính thức (hưởng lương, tính 1 công), * đi làm ngày lễ. Định dạng giờ: 00:00 - 24:00 (24h).";

    const sheets = [];

    if (exportScope === "ALL" || exportScope === "SUMMARY") {
      sheets.push(
        buildSheet("Tổng hợp công", summaryCols, targetRows, {
          title: `TỔNG HỢP CÔNG TOÀN NHÂN VIÊN THÁNG ${month}/${year}`,
          subtitle: `Tổng số nhân sự: ${targetRows.length} — Xuất lúc ${new Date().toLocaleString("vi-VN", { hour12: false })}`,
        }),
        buildSheet("Bảng công ma trận", dayCols, targetRows, {
          title: `BẢNG CHẤM CÔNG MA TRẬN THÁNG ${month}/${year}`,
          subtitle,
        })
      );
    }

    if (exportScope === "ALL" || exportScope === "INDIVIDUAL_ALL" || exportScope.startsWith("STAFF:")) {
      sheets.push(
        buildSheet("Chi tiết từng người", personDetailCols, allPersonDays, {
          title: `CHI TIẾT CHẤM CÔNG TỪNG NGƯỜI THÁNG ${month}/${year}`,
          subtitle: `Định dạng 24h (00:00 - 24:00) — Tổng cộng ${targetRows.length} nhân viên`,
        })
      );

      for (const r of targetRows) {
        const staffDays: PersonDayRow[] = data.days.map((d) => ({
          row: r,
          day: d,
          cell: r.cells[d.date] || { code: "FUTURE" as TimesheetCellCode },
        }));
        const s = r.summary;
        const staffSheetName = `${r.staffCode} - ${r.staffName}`.slice(0, 31);
        sheets.push(
          buildSheet(staffSheetName, personDetailCols, staffDays, {
            title: `BẢNG CHẤM CÔNG CÁ NHÂN THÁNG ${month}/${year} — ${r.staffCode} - ${r.staffName.toUpperCase()} (${deptLabel(r.department)})`,
            subtitle: `Công chuẩn: ${s.standardDays} | Công đi làm: ${s.workUnits} | Công lễ: ${s.holidayPaidDays} | Phép có lương: ${s.paidLeaveUsed || 0}/${s.paidLeaveEntitled || 0} | Tổng công tính lương: ${s.paidUnits} | Tổng giờ: ${s.totalHours}h | Trễ: ${s.lateCount} lần (${s.lateMinutes}p) | Tăng ca: ${s.overtimeMinutes || 0}p`,
          })
        );
      }
    }

    const filePrefix = exportScope.startsWith("STAFF:")
      ? `BangCong_${targetRows[0]?.staffCode || "NV"}_T${month}_${year}`
      : exportScope === "SUMMARY"
        ? `BangCong_TongHop_T${month}_${year}`
        : exportScope === "INDIVIDUAL_ALL"
          ? `BangCong_TungNguoi_T${month}_${year}`
          : `BangCong_ToanBo_T${month}_${year}`;

    downloadExcel(excelFileName(filePrefix), sheets);
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
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <div className="relative">
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                title="Chọn chế độ xuất Excel Bảng chấm công"
              >
                <option value="ALL">Xuất Tổng + Từng người (Đầy đủ)</option>
                <option value="SUMMARY">Chỉ xuất Tổng (Tổng hợp & Ma trận)</option>
                <option value="INDIVIDUAL_ALL">Chỉ xuất Từng người (Toàn bộ NV)</option>
                {filteredRows.map((r) => (
                  <option key={r.staffId} value={`STAFF:${r.staffId}`}>
                    Từng người: {r.staffCode} – {r.staffName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <ExportExcelButton onExport={handleExport} disabled={!data || filteredRows.length === 0} />
          </div>
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
          {monthInfo && (
            <div
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] font-semibold text-emerald-900 flex flex-wrap items-center gap-1.5"
              title="1 tuần làm việc 6 ngày (nghỉ 1 ngày/tuần). Tổng số công chuẩn thay đổi theo số ngày của tháng (28, 29, 30, 31 ngày) và số Chủ nhật (4 hoặc 5 CN) trong tháng."
            >
              <span>
                Chuẩn tháng: <b>{monthInfo.standardDays} công</b>
              </span>
              <span className="text-emerald-700 font-normal">
                ({monthInfo.daysInMonth} ngày
                {month === 2 ? (monthInfo.isLeapYear ? " • Năm nhuận" : " • Không nhuận") : ""} −{" "}
                {monthInfo.sundaysCount} CN)
              </span>
              {monthInfo.officePaidHolidaysCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-bold">
                  VP +{monthInfo.officePaidHolidaysCount} công lễ
                </span>
              )}
            </div>
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
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-3">
            <div className="flex-1 min-w-0">
              {view === "MATRIX" ? (
                <MatrixView
                  data={data}
                  rows={filteredRows}
                  onCellClick={(row, day, cell) => setEditTarget({ row, day, cell })}
                />
              ) : (
                <SummaryView rows={filteredRows} />
              )}
            </div>

            {/* Chú thích bên phải xếp thành hàng dọc */}
            <aside className="w-full xl:w-[248px] shrink-0 bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] px-1 pb-2 border-b border-slate-200/80 mb-2">
                  Chú thích
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-1.5 text-[11px] text-slate-700">
                  {/* Đúng giờ */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <span className="w-4 h-4 shrink-0 rounded bg-emerald-500 text-white text-[9px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span className="font-medium truncate">Đúng giờ</span>
                  </div>

                  {/* Đang làm */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-sky-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-sky-500 text-white animate-pulse text-[9px] font-black inline-flex items-center justify-center">
                      ●
                    </span>
                    <span className="font-medium truncate">Đang làm</span>
                  </div>

                  {/* Làm từ xa (WFH) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-cyan-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-cyan-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span className="font-medium truncate">Làm từ xa (WFH)</span>
                  </div>

                  {/* Tăng ca (đã duyệt) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-indigo-600 text-white text-[8px] font-black inline-flex items-center justify-center">
                      TC
                    </span>
                    <span className="font-medium truncate">Tăng ca (đã duyệt)</span>
                  </div>

                  {/* Đi trễ / Về sớm (giữ chung) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-amber-400 text-amber-950 text-[8px] font-black inline-flex items-center justify-center">
                      T/S
                    </span>
                    <span className="font-medium truncate" title="Đi trễ (T) / Về sớm (S) / Cả hai (TS)">
                      Đi trễ (T) / Về sớm (S) / Cả hai (TS)
                    </span>
                  </div>

                  {/* Quên check-out */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-red-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-red-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      !
                    </span>
                    <span className="font-medium truncate">Quên check-out</span>
                  </div>

                  {/* Vắng không phép */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-rose-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-rose-100 text-rose-700 border border-rose-400 text-[9px] font-black inline-flex items-center justify-center">
                      V
                    </span>
                    <span className="font-medium truncate">Vắng không phép</span>
                  </div>

                  {/* Nghỉ OFF không lương */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <span className="w-4 h-4 shrink-0 rounded bg-slate-200 text-slate-700 border border-slate-300 text-[9px] font-black inline-flex items-center justify-center">
                      P
                    </span>
                    <span className="font-medium truncate">Nghỉ OFF không lương</span>
                  </div>

                  {/* Phép có lương (+1 công) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-blue-600 text-white text-[8px] font-black inline-flex items-center justify-center">
                      PL
                    </span>
                    <span className="font-medium truncate">Phép có lương (+1 công)</span>
                  </div>

                  {/* Nghỉ lễ (+1 công VP) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      L
                    </span>
                    <span className="font-medium truncate">Nghỉ lễ (+1 công VP)</span>
                  </div>

                  {/* Đi làm lễ (lương x4) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-emerald-500 text-white ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
                      ★
                    </span>
                    <span className="font-medium truncate">Đi làm lễ (lương x4)</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center justify-end gap-3 font-semibold pt-0.5">
            <span>
              Tổng công tính lương: <b className="text-slate-900">{totals.workUnits.toFixed(2)}</b>
            </span>
            {totals.holidayPaidDays > 0 && (
              <span>
                Công nghỉ lễ (VP): <b className="text-fuchsia-700">+{totals.holidayPaidDays}</b>
              </span>
            )}
            <span>
              Tổng giờ: <b className="text-slate-900">{totals.totalHours.toFixed(1)}h</b>
            </span>
            {totals.overtimeMinutes > 0 && (
              <span>
                Tăng ca duyệt: <b className="text-indigo-700">{formatMinutes(totals.overtimeMinutes)}</b>
              </span>
            )}
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
              Làm ngày lễ: <b className="text-fuchsia-700">{totals.holidayWork}</b>
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
      <table className="w-full border-separate border-spacing-0 text-xs">
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
            <th className="sticky top-0 right-[60px] z-30 bg-emerald-50 border-b border-l border-slate-200 px-2 py-1.5 text-center font-bold text-emerald-800 min-w-[70px]">
              <div>Công</div>
              <div className="text-[9px] font-semibold text-emerald-600 leading-none mt-0.5">
                /{rows[0]?.summary.standardDays ?? (data.monthMeta?.standardDays || 26)} chuẩn
              </div>
            </th>
            <th className="sticky top-0 right-0 z-30 bg-emerald-50 border-b border-slate-200 px-2 py-1.5 text-center font-bold text-emerald-800 min-w-[60px]">
              <div>Giờ</div>
              <div className="text-[9px] font-semibold text-indigo-600 leading-none mt-0.5">&amp; TC</div>
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
                  const hasApprovedOvertime = Boolean(cell.overtimeMinutes && cell.overtimeMinutes > 0);
                  // Lễ không được cộng công (Khối Bán hàng, hoặc lễ trùng Chủ nhật) -> hiển thị nhạt
                  const style =
                    cell.code === "HOLIDAY" && !cell.isPaidHoliday
                      ? {
                        ...baseStyle,
                        className: "bg-fuchsia-50 text-fuchsia-400 border border-fuchsia-200",
                        label:
                          row.department === "SALES"
                            ? "Ngày lễ – Khối Bán hàng không cộng công (đi làm hưởng x4)"
                            : "Ngày lễ trùng ngày nghỉ tuần",
                      }
                      : hasApprovedOvertime && (cell.code === "ON_TIME" || cell.code === "WFH")
                      ? {
                        ...baseStyle,
                        symbol: "TC",
                        className: "bg-indigo-600 text-white",
                        label: `${baseStyle.label} + Tăng ca (${cell.overtimeMinutes}p)`,
                      }
                      : baseStyle;
                  const clickable = cell.code !== "FUTURE";
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
                          } ${cell.isHolidayWork ? "ring-2 ring-yellow-400 ring-offset-1" : ""} ${hasApprovedOvertime && cell.code !== "ON_TIME" && cell.code !== "WFH" ? "ring-2 ring-indigo-600 ring-offset-1" : ""} ${cell.overtimeStatus === "PENDING" ? "ring-2 ring-indigo-400 ring-offset-1" : ""} ${clickable ? "hover:scale-110 hover:shadow-md cursor-pointer" : "cursor-default"
                          }`}
                      >
                        {style.symbol}
                        {hasApprovedOvertime && cell.code !== "ON_TIME" && cell.code !== "WFH" && (
                          <span className="absolute -bottom-1 -right-1 px-0.5 rounded bg-indigo-600 text-white text-[7px] font-black leading-tight border border-white">
                            TC
                          </span>
                        )}
                        {cell.overtimeStatus === "PENDING" && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500 border border-white" />
                        )}
                        {cell.adjusted && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-900" />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="sticky right-[60px] z-10 bg-white group-hover:bg-slate-50 border-b border-l border-slate-200 px-2 py-1.5 text-center min-w-[70px]">
                  <div
                    className="font-extrabold text-slate-900 leading-tight"
                    title={`Đi làm: ${row.summary.workUnits} công | Nghỉ lễ hưởng lương: ${row.summary.holidayPaidDays} công | Phép có lương: ${row.summary.paidLeaveUsed || 0} công | Công chuẩn tháng: ${row.summary.standardDays} công`}
                  >
                    {row.summary.paidUnits.toFixed(1)}
                    <span className="text-[10px] font-semibold text-slate-400">/{row.summary.standardDays}</span>
                  </div>
                  {(row.summary.holidayPaidDays > 0 || (row.summary.paidLeaveUsed || 0) > 0) && (
                    <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                      {row.summary.holidayPaidDays > 0 && (
                        <span className="px-1 rounded bg-fuchsia-100 text-fuchsia-700 text-[8px] font-bold leading-tight">
                          +{row.summary.holidayPaidDays}L
                        </span>
                      )}
                      {(row.summary.paidLeaveUsed || 0) > 0 && (
                        <span className="px-1 rounded bg-blue-100 text-blue-700 text-[8px] font-bold leading-tight">
                          +{row.summary.paidLeaveUsed}PL
                        </span>
                      )}
                    </div>
                  )}
                  <div className="h-1 rounded bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0.95 ? "bg-emerald-500" : pct >= 0.8 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-b border-slate-200 px-2 py-1.5 text-center min-w-[60px]">
                  <div className="font-bold text-emerald-700 leading-tight">{row.summary.totalHours.toFixed(1)}</div>
                  {(row.summary.overtimeMinutes || 0) > 0 && (
                    <div
                      className="mt-0.5 px-1 rounded bg-indigo-100 text-indigo-700 text-[8px] font-bold leading-tight inline-block"
                      title={`Tăng ca đã duyệt: ${row.summary.overtimeMinutes} phút (${row.summary.overtimeDays || 1} ngày)`}
                    >
                      +{formatMinutes(row.summary.overtimeMinutes || 0)} TC
                    </div>
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
            <th className="px-2 py-2 text-center">Tăng ca</th>
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
                      <span className="text-fuchsia-700 font-semibold"> + Lễ {s.holidayPaidDays}</span>
                    )}
                    {(s.paidLeaveUsed || 0) > 0 && (
                      <span className="text-blue-700 font-semibold"> + Phép {s.paidLeaveUsed}</span>
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
                  {(s.overtimeMinutes || 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                      {s.overtimeDays || 1} ngày • {formatMinutes(s.overtimeMinutes || 0)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
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

const SHIFT_DEFAULT_TIMES: Record<"SHIFT_1" | "SHIFT_2" | "BOTH", { checkIn: string; checkOut: string; label: string }> = {
  SHIFT_1: { checkIn: "08:30", checkOut: "17:30", label: "Ca 1 (08:30–17:30)" },
  SHIFT_2: { checkIn: "12:00", checkOut: "21:00", label: "Ca 2 (12:00–21:00)" },
  BOTH: { checkIn: "08:30", checkOut: "21:00", label: "Ca 1+2 (08:30–21:00)" },
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Bộ chọn giờ định dạng 24h (00:00 – 23:59), không hiển thị AM/PM trên mọi trình duyệt.
 */
function Time24Input({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: string;
  onChange: (val: string) => void;
  allowEmpty?: boolean;
}) {
  const parts = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  const hh = parts ? String(Math.min(23, Math.max(0, Number(parts[1])))).padStart(2, "0") : "";
  const mm = parts ? String(Math.min(59, Math.max(0, Number(parts[2])))).padStart(2, "0") : "";

  return (
    <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 focus-within:bg-white transition">
      <div className="relative">
        <select
          value={hh}
          onChange={(e) => {
            const nextH = e.target.value;
            if (!nextH) {
              onChange("");
            } else {
              onChange(`${nextH}:${mm || "00"}`);
            }
          }}
          className="appearance-none w-full bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg pl-3 pr-7 py-1.5 text-center text-sm font-mono font-bold text-slate-900 outline-none cursor-pointer transition"
          aria-label="Giờ (00-23)"
        >
          {allowEmpty && <option value="">--h</option>}
          {HOURS_24.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
      </div>
      <span className="text-slate-400 font-mono font-bold text-sm select-none px-0.5">:</span>
      <div className="relative">
        <select
          value={hh ? mm || "00" : ""}
          disabled={!hh && allowEmpty}
          onChange={(e) => {
            const nextM = e.target.value || "00";
            onChange(`${hh || "08"}:${nextM}`);
          }}
          className="appearance-none w-full bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg pl-3 pr-7 py-1.5 text-center text-sm font-mono font-bold text-slate-900 outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition"
          aria-label="Phút (00-59)"
        >
          {!hh && allowEmpty && <option value="">--p</option>}
          {MINUTES_60.map((m) => (
            <option key={m} value={m}>
              {m}p
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chi tiết ô công + điều chỉnh / chấm công bù / chấm OFF
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
  const isFulltime = row.contractType === "FULLTIME";
  const initialIsOff = cell.code === "LEAVE" || cell.code === "PAID_LEAVE";
  const defaultWorkShift = (cell.shiftCode || "SHIFT_1") as "SHIFT_1" | "SHIFT_2" | "BOTH";
  const initialIsWfh =
    cell.checkInType === "WFH" ||
    cell.code === "WFH" ||
    Boolean(cell.leaveRequests?.some((l) => l.type === "WFH" && l.status === "APPROVED"));

  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF">(
    initialIsOff ? "OFF" : defaultWorkShift
  );
  const [checkInType, setCheckInType] = useState<"STANDARD" | "WFH">(
    initialIsWfh ? "WFH" : "STANDARD"
  );
  const [offType, setOffType] = useState<"OFF" | "PAID_LEAVE">(
    cell.code === "PAID_LEAVE" ? "PAID_LEAVE" : "OFF"
  );
  const [checkIn, setCheckIn] = useState(
    cell.checkIn || SHIFT_DEFAULT_TIMES[defaultWorkShift].checkIn
  );
  const [checkOut, setCheckOut] = useState(
    cell.checkOut || SHIFT_DEFAULT_TIMES[defaultWorkShift].checkOut
  );
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

  const handleSelectShift = (sc: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF") => {
    setShiftCode(sc);
    if (sc !== "OFF") {
      setCheckIn(SHIFT_DEFAULT_TIMES[sc].checkIn);
      setCheckOut(SHIFT_DEFAULT_TIMES[sc].checkOut);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do để lưu vết điều chỉnh.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (shiftCode === "OFF") {
        if (hasRecord) {
          await adjustAttendanceApi(cell.attendanceId!, {
            shiftCode: "OFF",
            offType,
            reason: reason.trim(),
          });
        } else {
          await createManualAttendanceApi({
            staffId: row.staffId,
            date: day.date,
            shiftCode: "OFF",
            offType,
            reason: reason.trim(),
          });
        }
        onSaved(
          `Đã chấm ${offType === "PAID_LEAVE" ? "Nghỉ phép có lương" : "OFF (Nghỉ không lương)"} cho ${row.staffName} ngày ${dd}/${mm}`
        );
      } else if (hasRecord) {
        await adjustAttendanceApi(cell.attendanceId!, {
          checkIn,
          checkOut: checkOut || undefined,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
          overtimeStatus: shiftCode === "BOTH" ? "NONE" : overtimeStatus,
          overtimeApprovedMinutes:
            shiftCode !== "BOTH" && overtimeStatus === "APPROVED"
              ? Math.max(0, Number(overtimeApprovedMinutes) || 0)
              : 0,
          reason: reason.trim(),
        });
        onSaved(
          `Đã điều chỉnh giờ công ${checkInType === "WFH" ? "(WFH) " : ""}${row.staffName} ngày ${dd}/${mm}`
        );
      } else {
        await createManualAttendanceApi({
          staffId: row.staffId,
          date: day.date,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
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
        onSaved(
          `Đã chấm công bù ${checkInType === "WFH" ? "(WFH) " : ""}cho ${row.staffName} ngày ${dd}/${mm}`
        );
      }
    } catch (e: any) {
      setErr(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
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
              <div className="text-slate-400">Giờ vào (24h)</div>
              <div className="font-mono font-bold text-slate-900">{cell.checkIn || "—"}</div>
            </div>
            <div>
              <div className="text-slate-400">Giờ ra (24h)</div>
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
          <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {hasRecord ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {hasRecord ? "Điều chỉnh giờ công / Chuyển OFF" : "Chấm công bù / Chấm OFF cho ngày này"}
            </span>
            <span className="text-[11px] font-normal text-slate-400">Định dạng 0h–24h</span>
          </div>

          {/* Chọn Ca làm việc hoặc OFF (tự động điều chỉnh giờ vào/ra khi chọn ca) */}
          <div className={`grid ${isSales ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"} gap-2`}>
            {isSales ? (
              (["SHIFT_1", "SHIFT_2", "BOTH"] as const).map((sc) => {
                const active = shiftCode === sc;
                const title = sc === "BOTH" ? "Ca 1 + Ca 2" : sc === "SHIFT_1" ? "Ca 1" : "Ca 2";
                const timeRange =
                  sc === "BOTH" ? "08:30 – 21:00" : sc === "SHIFT_1" ? "08:30 – 17:30" : "12:00 – 21:00";
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => handleSelectShift(sc)}
                    className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${active
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                  >
                    <span className="text-xs font-bold leading-tight whitespace-nowrap">{title}</span>
                    <span
                      className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${active ? "text-emerald-700 font-semibold" : "text-slate-400"
                        }`}
                    >
                      {timeRange}
                    </span>
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => handleSelectShift("SHIFT_1")}
                className={`flex flex-col items-center justify-center px-3 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode !== "OFF"
                  ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30 shadow-2xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                  }`}
              >
                <span className="text-xs font-bold leading-tight whitespace-nowrap">Ca Hành chính</span>
                <span
                  className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${shiftCode !== "OFF" ? "text-emerald-700 font-semibold" : "text-slate-400"
                    }`}
                >
                  08:30 – 17:30
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSelectShift("OFF")}
              className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode === "OFF"
                ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                : "bg-purple-50/60 border-purple-200 text-purple-800 hover:bg-purple-100"
                }`}
            >
              <span className="text-xs font-bold leading-tight whitespace-nowrap">OFF (Nghỉ)</span>
              <span
                className={`text-[11px] mt-0.5 whitespace-nowrap ${shiftCode === "OFF" ? "text-purple-100 font-medium" : "text-purple-500"
                  }`}
              >
                Nghỉ cả ngày
              </span>
            </button>
          </div>

          {shiftCode === "OFF" ? (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
              <div className="font-bold text-purple-900">Chọn hình thức nghỉ OFF cho ngày {dd}/{mm}/{yy}:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOffType("OFF")}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition ${offType === "OFF"
                    ? "bg-white border-purple-600 ring-2 ring-purple-500 text-purple-950 font-bold"
                    : "bg-white/70 border-purple-200 text-slate-600"
                    }`}
                >
                  <div>Nghỉ không lương (OFF)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isSales
                      ? `Hạn mức Sales: tối đa 4 ngày/tháng (đã nghỉ ${row.summary.salesOffUsed ?? 0}/4)`
                      : "Không tính công ngày này"}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!isFulltime}
                  onClick={() => setOffType("PAID_LEAVE")}
                  className={`p-2 rounded-lg border text-left transition ${!isFulltime
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : offType === "PAID_LEAVE"
                      ? "bg-teal-50 border-teal-600 ring-2 ring-teal-500 text-teal-950 font-bold cursor-pointer"
                      : "bg-white/70 border-purple-200 text-slate-600 cursor-pointer"
                    }`}
                >
                  <div>Nghỉ phép có lương (+1 công)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isFulltime
                      ? `HĐ Chính thức: 1 ngày/tháng (đã dùng ${row.summary.paidLeaveUsed || 0}/1)`
                      : "Chỉ dành cho HĐ Chính thức"}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Hình thức làm việc: Trực tiếp hay Làm từ xa (WFH) */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">
                  Hình thức chấm công *
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInType("STANDARD")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "STANDARD"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-emerald-500 text-white text-[9px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span>Làm trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInType("WFH")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "WFH"
                      ? "bg-cyan-50 border-cyan-500 text-cyan-900 ring-1 ring-cyan-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-cyan-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span>Làm từ xa (WFH)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ vào *</span>
                  </div>
                  <Time24Input value={checkIn} onChange={setCheckIn} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ ra</span>
                    {checkOut && (
                      <button
                        type="button"
                        onClick={() => setCheckOut("")}
                        className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        Xóa giờ ra
                      </button>
                    )}
                  </div>
                  <Time24Input value={checkOut} onChange={setCheckOut} allowEmpty />
                </div>
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
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "NONE" || overtimeStatus === "REJECTED"
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-600"
                          }`}
                      >
                        Không tính TC
                      </button>
                      <button
                        type="button"
                        onClick={() => setOvertimeStatus("PENDING")}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "PENDING"
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
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "APPROVED"
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
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={overtimeApprovedMinutes > 0 ? overtimeApprovedMinutes.toLocaleString("vi-VN") : ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                            setOvertimeApprovedMinutes(digits ? Number(digits) : 0);
                          }}
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
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus !== "APPROVED"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      Không tăng ca
                    </button>
                    <button
                      type="button"
                      onClick={() => setOvertimeStatus("APPROVED")}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${overtimeStatus === "APPROVED"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600"
                        }`}
                    >
                      ✓ HR yêu cầu Tăng ca
                    </button>
                  </div>
                  {overtimeStatus === "APPROVED" && (
                    <label className="block text-[11px] font-semibold text-indigo-900">
                      Số phút Tăng ca được tính (bỏ trống = tự tính theo giờ ra sau 17:30):
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={overtimeApprovedMinutes > 0 ? overtimeApprovedMinutes.toLocaleString("vi-VN") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                          setOvertimeApprovedMinutes(digits ? Number(digits) : 0);
                        }}
                        className="mt-1 w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold outline-none"
                      />
                    </label>
                  )}
                </div>
              )}
            </>
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
              {saving ? "Đang lưu..." : shiftCode === "OFF" ? "Lưu chấm OFF" : hasRecord ? "Lưu điều chỉnh" : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal chấm công bù (chọn nhân viên + ngày bất kỳ + tự động giờ theo ca + hỗ trợ OFF)
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
  const [shiftCode, setShiftCode] = useState<"SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF">("SHIFT_1");
  const [checkInType, setCheckInType] = useState<"STANDARD" | "WFH">("STANDARD");
  const [offType, setOffType] = useState<"OFF" | "PAID_LEAVE">("OFF");
  const [checkIn, setCheckIn] = useState("08:30");
  const [checkOut, setCheckOut] = useState("17:30");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = rows.find((r) => r.staffId === staffId);
  const isSales = selected?.department === "SALES";
  const isFulltime = selected?.contractType === "FULLTIME";

  const applyShiftSelection = (sc: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF") => {
    setShiftCode(sc);
    if (sc !== "OFF") {
      setCheckIn(SHIFT_DEFAULT_TIMES[sc].checkIn);
      setCheckOut(SHIFT_DEFAULT_TIMES[sc].checkOut);
    }
  };

  const syncShiftForStaffAndDate = (nextStaffId: string, nextDate: string) => {
    const row = rows.find((r) => r.staffId === nextStaffId);
    if (!row) return;
    const cell = row.cells?.[nextDate];
    const hasWfh =
      cell?.checkInType === "WFH" ||
      cell?.code === "WFH" ||
      Boolean(cell?.leaveRequests?.some((l) => l.type === "WFH" && l.status === "APPROVED"));
    setCheckInType(hasWfh ? "WFH" : "STANDARD");

    if (row.department !== "SALES") {
      applyShiftSelection("SHIFT_1");
      return;
    }
    if (cell?.shiftCode === "SHIFT_1" || cell?.shiftCode === "SHIFT_2" || cell?.shiftCode === "BOTH") {
      applyShiftSelection(cell.shiftCode);
    } else {
      applyShiftSelection("SHIFT_1");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !reason.trim()) {
      setErr("Vui lòng chọn nhân viên và nhập lý do.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (shiftCode === "OFF") {
        await createManualAttendanceApi({
          staffId,
          date,
          shiftCode: "OFF",
          offType: isFulltime ? offType : "OFF",
          reason: reason.trim(),
        });
        onSaved(
          `Đã chấm ${offType === "PAID_LEAVE" && isFulltime ? "Nghỉ phép có lương" : "OFF (Nghỉ không lương)"} cho ${selected?.staffName || "nhân viên"
          }`
        );
      } else {
        await createManualAttendanceApi({
          staffId,
          date,
          shiftCode: isSales ? shiftCode : "SHIFT_1",
          checkInType,
          checkIn,
          checkOut: checkOut || undefined,
          reason: reason.trim(),
        });
        onSaved(
          `Đã chấm công bù ${checkInType === "WFH" ? "(WFH) " : ""}cho ${selected?.staffName || "nhân viên"}`
        );
      }
    } catch (e: any) {
      setErr(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Chấm công bù / Chấm OFF</h3>
            <p className="text-[11px] text-slate-500">Chọn ca sẽ tự động điền giờ vào – giờ ra chuẩn (0h–24h)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Nhân viên *
              <select
                value={staffId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setStaffId(nextId);
                  syncShiftForStaffAndDate(nextId, date);
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
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
                max={shiftCode === "OFF" ? undefined : todayStr}
                value={date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (shiftCode !== "OFF") {
                    syncShiftForStaffAndDate(staffId, nextDate);
                  }
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              Chọn ca làm việc hoặc chấm OFF *
            </div>
            <div className={`grid ${isSales ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"} gap-2`}>
              {isSales ? (
                (["SHIFT_1", "SHIFT_2", "BOTH"] as const).map((sc) => {
                  const active = shiftCode === sc;
                  const title = sc === "BOTH" ? "Ca 1 + Ca 2" : sc === "SHIFT_1" ? "Ca 1" : "Ca 2";
                  const timeRange =
                    sc === "BOTH" ? "08:30 – 21:00" : sc === "SHIFT_1" ? "08:30 – 17:30" : "12:00 – 21:00";
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => applyShiftSelection(sc)}
                      className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${active
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                    >
                      <span className="text-xs font-bold leading-tight whitespace-nowrap">{title}</span>
                      <span
                        className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${active ? "text-emerald-700 font-semibold" : "text-slate-400"
                          }`}
                      >
                        {timeRange}
                      </span>
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => applyShiftSelection("SHIFT_1")}
                  className={`flex flex-col items-center justify-center px-3 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode !== "OFF"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                >
                  <span className="text-xs font-bold leading-tight whitespace-nowrap">Ca Hành chính</span>
                  <span
                    className={`text-[11px] font-mono mt-0.5 whitespace-nowrap ${shiftCode !== "OFF" ? "text-emerald-700 font-semibold" : "text-slate-400"
                      }`}
                  >
                    08:30 – 17:30
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => applyShiftSelection("OFF")}
                className={`flex flex-col items-center justify-center px-2.5 py-2 min-h-[54px] rounded-xl border cursor-pointer transition ${shiftCode === "OFF"
                  ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                  : "bg-purple-50/60 border-purple-200 text-purple-800 hover:bg-purple-100"
                  }`}
              >
                <span className="text-xs font-bold leading-tight whitespace-nowrap">OFF (Nghỉ)</span>
                <span
                  className={`text-[11px] mt-0.5 whitespace-nowrap ${shiftCode === "OFF" ? "text-purple-100 font-medium" : "text-purple-500"
                    }`}
                >
                  Nghỉ cả ngày
                </span>
              </button>
            </div>
          </div>

          {shiftCode === "OFF" ? (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
              <div className="font-bold text-purple-900">Chọn hình thức nghỉ OFF:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOffType("OFF")}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition ${offType === "OFF"
                    ? "bg-white border-purple-600 ring-2 ring-purple-500 text-purple-950 font-bold"
                    : "bg-white/70 border-purple-200 text-slate-600"
                    }`}
                >
                  <div>Nghỉ không lương (OFF)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isSales
                      ? `Hạn mức Sales: tối đa 4 ngày/tháng (đã dùng ${selected?.summary.salesOffUsed ?? 0}/4)`
                      : "Không tính công ngày này"}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!isFulltime}
                  onClick={() => setOffType("PAID_LEAVE")}
                  className={`p-2 rounded-lg border text-left transition ${!isFulltime
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : offType === "PAID_LEAVE"
                      ? "bg-teal-50 border-teal-600 ring-2 ring-teal-500 text-teal-950 font-bold cursor-pointer"
                      : "bg-white/70 border-purple-200 text-slate-600 cursor-pointer"
                    }`}
                >
                  <div>Nghỉ phép có lương (+1 công)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                    {isFulltime
                      ? `HĐ Chính thức: 1 ngày/tháng (đã dùng ${selected?.summary.paidLeaveUsed || 0}/1)`
                      : "Chỉ dành cho HĐ Chính thức"}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Hình thức làm việc: Trực tiếp hay Làm từ xa (WFH) */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">
                  Hình thức chấm công *
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInType("STANDARD")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "STANDARD"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-emerald-500 text-white text-[9px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span>Làm trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInType("WFH")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${checkInType === "WFH"
                      ? "bg-cyan-50 border-cyan-500 text-cyan-900 ring-1 ring-cyan-500/30"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="w-4 h-4 rounded bg-cyan-600 text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span>Làm từ xa (WFH)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ vào *</span>
                  </div>
                  <Time24Input value={checkIn} onChange={setCheckIn} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Giờ ra</span>
                    {checkOut && (
                      <button
                        type="button"
                        onClick={() => setCheckOut("")}
                        className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        Xóa giờ ra
                      </button>
                    )}
                  </div>
                  <Time24Input value={checkOut} onChange={setCheckOut} allowEmpty />
                </div>
              </div>
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Lý do (bắt buộc, lưu vết) *
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Mất mạng không chấm công được / Nhân viên báo nghỉ OFF..."
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
              {saving ? "Đang lưu..." : shiftCode === "OFF" ? "Lưu chấm OFF" : "Chấm công bù"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

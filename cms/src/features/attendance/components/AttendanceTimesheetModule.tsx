"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TimesheetData, TimesheetRow, TimesheetCell, TimesheetCellCode, TimesheetDay, Department } from "@/shared/types";
import { fetchTimesheetApi, adjustAttendanceApi, createManualAttendanceApi } from "../api";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn } from "@/shared/lib/excel";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
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
import {
  CELL_STYLE,
  WEEKDAY_SHORT,
  ViewMode,
  IssueFilter,
  EditTarget,
  formatMinutes,
  hasIssue,
  SHIFT_DEFAULT_TIMES,
  HOURS_24,
  MINUTES_60,
} from "../timesheet.constants";
import { KpiCard } from "./TimesheetKpiCard";
import { MatrixView } from "./TimesheetMatrixView";
import { SummaryView } from "./TimesheetSummaryView";
import { CellDetailModal } from "./TimesheetCellDetailModal";
import { ManualAttendanceModal } from "./ManualAttendanceModal";

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
        <div className="fixed bottom-6 right-6 z-[60] bg-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-400" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-brand-ink" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Bảng Chấm Công Toàn Công Ty</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Chấm công bù
          </button>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <div className="relative">
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
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
              className="px-2.5 py-1.5 rounded-lg bg-teal-50/80 border border-teal-200 text-[11px] font-semibold text-teal-900 flex flex-wrap items-center gap-1.5"
              title="1 tuần làm việc 6 ngày (nghỉ 1 ngày/tuần). Tổng số công chuẩn thay đổi theo số ngày của tháng (28, 29, 30, 31 ngày) và số Chủ nhật (4 hoặc 5 CN) trong tháng."
            >
              <span>
                Chuẩn tháng: <b>{monthInfo.standardDays} công</b>
              </span>
              <span className="text-brand-ink font-normal">
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
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44 focus:ring-2 focus:ring-teal-500 outline-none"
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
                    <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] text-[11px] font-black inline-flex items-center justify-center">
                      ✓
                    </span>
                    <span className="font-medium truncate">Đúng giờ</span>
                  </div>

                  {/* Đang làm */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#BFDBFE]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#3B82F6] text-white animate-pulse text-[9px] font-black inline-flex items-center justify-center">
                      ●
                    </span>
                    <span className="font-medium truncate">Đang làm</span>
                  </div>

                  {/* Làm từ xa (WFH) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#A5F3FC]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#0891B2] text-white text-[9px] font-black inline-flex items-center justify-center">
                      W
                    </span>
                    <span className="font-medium truncate">Làm từ xa (WFH)</span>
                  </div>

                  {/* Tăng ca (đã duyệt) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#C7D2FE]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#4F46E5] text-white text-[8px] font-black inline-flex items-center justify-center">
                      TC
                    </span>
                    <span className="font-medium truncate">Tăng ca (đã duyệt)</span>
                  </div>

                  {/* Đi trễ / Về sớm (giữ chung) */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#FBBF24] text-[#451A03] text-[8px] font-black inline-flex items-center justify-center">
                      T/S
                    </span>
                    <span className="font-medium truncate" title="Đi trễ (T) / Về sớm (S) / Cả hai (TS)">
                      Đi trễ (T) / Về sớm (S) / Cả hai (TS)
                    </span>
                  </div>

                  {/* Quên check-out */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECACA]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#DC2626] text-white text-[9px] font-black inline-flex items-center justify-center">
                      !
                    </span>
                    <span className="font-medium truncate">Quên check-out</span>
                  </div>

                  {/* Vắng không phép */}
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FECDD3]">
                    <span className="w-4 h-4 shrink-0 rounded bg-[#FFE4E6] text-[#BE123C] border border-[#FB7185] text-[9px] font-black inline-flex items-center justify-center">
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
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-fuchsia-200">
                    <span className="w-4 h-4 shrink-0 rounded bg-fuchsia-600 text-white text-[8px] font-black inline-flex items-center justify-center">
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
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#FDE68A]">
                    <span className="w-4 h-4 shrink-0 rounded bg-transparent text-[#10B981] ring-2 ring-yellow-400 text-[9px] font-black inline-flex items-center justify-center">
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
                Tăng ca duyệt: <b className="text-brand-ink">{formatMinutes(totals.overtimeMinutes)}</b>
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

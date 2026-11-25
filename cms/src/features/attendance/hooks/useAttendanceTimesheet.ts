import { buildSheet,downloadExcel,ExcelColumn,excelFileName } from "@/shared/lib/excel";
import { Department,TimesheetCell,TimesheetCellCode,TimesheetData,TimesheetDay,TimesheetRow } from "@/shared/types";
import { useCallback,useEffect,useMemo,useState } from "react";
import { fetchTimesheetApi } from "../api";
import { DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from "@/config/listing";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useClientPagination } from "@/shared/hooks/useClientPagination";
import {
CELL_STYLE,
EditTarget,
hasIssue,
IssueFilter,
ViewMode,
WEEKDAY_SHORT
} from "../timesheet.constants";



export function useAttendanceTimesheet() {
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

  const debouncedSearch = useDebounce(search, DEBOUNCE_MS.LOCAL);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !r.staffName.toLowerCase().includes(q) && !r.staffCode.toLowerCase().includes(q)) return false;
      if (issueFilter === "ISSUES" && !hasIssue(r)) return false;
      return true;
    });
  }, [data, debouncedSearch, issueFilter]);

  const timesheetPagination = useClientPagination(filteredRows, DEFAULT_PAGE_SIZE);
  useEffect(() => {
    timesheetPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, issueFilter, month, year, department]);

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


  return {
    month,
    year,
    department,
    setDepartment,
    search,
    setSearch,
    issueFilter,
    setIssueFilter,
    view,
    setView,
    data,
    loading,
    error,
    toast,
    editTarget,
    setEditTarget,
    showManual,
    setShowManual,
    exportScope,
    setExportScope,
    showToast,
    load,
    goPrev,
    goNext,
    goThisMonth,
    filteredRows,
    timesheetPagination,
    totals,
    monthInfo,
    handleExport,
    overview,
    isCurrentMonth,
  };
}

export type AttendanceTimesheetViewModel = ReturnType<typeof useAttendanceTimesheet>;

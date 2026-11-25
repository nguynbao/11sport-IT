import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/shared/api/client";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { StaffActivityReport } from "@/shared/types";
import { exportStaffActivity } from "../exports";

export type ViewTab = "SALES" | "WAREHOUSE";

const toInputDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function useStaffActivity() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(toInputDate(now));
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTab>("SALES");
  const [report, setReport] = useState<StaffActivityReport>({ staff: [], sales: [], warehouse: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      const res = await apiRequest<StaffActivityReport>(`${API_ENDPOINTS.REPORTS.STAFF_ACTIVITY}?${q.toString()}`);
      setReport({
        staff: res.data?.staff || [],
        sales: res.data?.sales || [],
        warehouse: res.data?.warehouse || [],
      });
    } catch (err: any) {
      setError(err?.message || "Không tải được báo cáo hoạt động nhân viên.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const staffRows = useMemo(
    () => report.staff.filter((s) => !roleFilter || s.role === roleFilter),
    [report.staff, roleFilter]
  );
  const visibleIds = useMemo(() => new Set(staffRows.map((s) => s.staffId)), [staffRows]);
  const matchStaff = (id: string) =>
    selectedStaffId !== null ? id === selectedStaffId : !roleFilter || visibleIds.has(id);
  const salesRows = report.sales.filter((a) => matchStaff(a.staffId));
  const warehouseRows = report.warehouse.filter((a) => matchStaff(a.staffId));
  const selectedStaff = report.staff.find((s) => s.staffId === selectedStaffId) || null;

  const totals = staffRows.reduce(
    (acc, s) => {
      acc.orders += s.sales.orders;
      acc.revenue += s.sales.revenue;
      acc.scanned += s.warehouse.unitsScanned;
      acc.imported += s.warehouse.unitsImported;
      if (s.sales.orders > 0) acc.sellers += 1;
      if (s.warehouse.unitsScanned > 0 || s.warehouse.importsCompleted > 0 || s.warehouse.importsCreated > 0)
        acc.checkers += 1;
      return acc;
    },
    { orders: 0, revenue: 0, scanned: 0, imported: 0, sellers: 0, checkers: 0 }
  );

  const handleExport = () =>
    exportStaffActivity(
      { staff: selectedStaff ? [selectedStaff] : staffRows, sales: salesRows, warehouse: warehouseRows },
      fromDate,
      toDate
    );


  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    roleFilter,
    setRoleFilter,
    selectedStaffId,
    setSelectedStaffId,
    view,
    setView,
    report,
    loading,
    error,
    loadReport,
    staffRows,
    salesRows,
    warehouseRows,
    selectedStaff,
    totals,
    handleExport,
  };
}

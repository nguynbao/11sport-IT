"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ShoppingBag,
  PackageCheck,
  RefreshCw,
  Users,
  ScanLine,
  TrendingUp,
} from "lucide-react";
import {
  apiRequest,
  formatDateTime,
  formatVND,
  StaffActivityReport,
  StaffActivitySummary,
} from "@/lib/api";
import ExportExcelButton from "./ExportExcelButton";
import { exportStaffActivity, SALES_ACTIVITY_LABEL, WAREHOUSE_ACTIVITY_LABEL } from "@/lib/exports";

type ViewTab = "SALES" | "WAREHOUSE";

const ROLE_LABEL: Record<string, string> = {
  SALES: "Bán hàng",
  WAREHOUSE: "Thủ kho",
  ADMIN: "Quản lý",
};

const toInputDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function StaffActivityModule() {
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
      const res = await apiRequest<StaffActivityReport>(`/reports/staff-activity?${q.toString()}`);
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

  const roleBadge = (role: string) => (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
        role === "SALES"
          ? "bg-blue-100 text-blue-800"
          : role === "WAREHOUSE"
          ? "bg-amber-100 text-amber-800"
          : role === "ADMIN"
          ? "bg-purple-100 text-purple-800"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {ROLE_LABEL[role] || "Không xác định"}
    </span>
  );

  const isSelected = (s: StaffActivitySummary) => selectedStaffId === s.staffId;

  return (
    <div className="space-y-5">
      {/* Bộ lọc */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Hoạt động Nhân viên — Ai bán hàng, ai kiểm kho
            </h3>
            <p className="text-xs text-slate-500">
              Tổng hợp theo tài khoản đăng nhập: đơn bán, trả/đổi, lập phiếu nhập, quét kiểm hàng, hoàn thành nhập
              kho và điều chỉnh kho.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <span className="text-xs text-slate-400">đến</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setSelectedStaffId(null);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="">Tất cả vai trò</option>
              <option value="SALES">Nhân viên bán hàng</option>
              <option value="WAREHOUSE">Thủ kho</option>
              <option value="ADMIN">Quản lý</option>
            </select>
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Tải lại
            </button>
            <ExportExcelButton
              onExport={handleExport}
              disabled={staffRows.length === 0}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</div>
        )}

        {/* Thẻ tổng quan */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-[11px] font-bold uppercase text-blue-700 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Đơn bán
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">{totals.orders}</div>
            <div className="text-[11px] text-slate-500">{totals.sellers} nhân viên có bán hàng</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="text-[11px] font-bold uppercase text-emerald-700 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Doanh thu
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">{formatVND(totals.revenue)}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="text-[11px] font-bold uppercase text-amber-700 flex items-center gap-1">
              <ScanLine className="w-3.5 h-3.5" /> Chiếc đã quét kiểm
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">{totals.scanned}</div>
            <div className="text-[11px] text-slate-500">{totals.checkers} nhân viên có kiểm/nhập kho</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5" /> SL đã nhập kho
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">{totals.imported}</div>
          </div>
        </div>
      </div>

      {/* Bảng tổng hợp theo nhân viên */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Tổng hợp theo nhân viên ({staffRows.length})
          </h3>
          {selectedStaff ? (
            <button
              type="button"
              onClick={() => setSelectedStaffId(null)}
              className="text-xs font-bold text-emerald-700 underline"
            >
              Đang xem: {selectedStaff.fullName} — Bỏ chọn
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">Bấm vào 1 nhân viên để xem chi tiết</span>
          )}
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full min-w-[980px] text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3" rowSpan={2}>Nhân viên</th>
                <th className="py-3 px-3 text-center" rowSpan={2}>Vai trò</th>
                <th className="py-2 px-3 text-center bg-blue-900/60" colSpan={3}>Bán hàng</th>
                <th className="py-2 px-3 text-center bg-amber-900/50" colSpan={5}>Kiểm / Nhập / Xuất chuyển kho</th>
                <th className="py-3 px-3" rowSpan={2}>Hoạt động gần nhất</th>
              </tr>
              <tr className="text-[10px]">
                <th className="py-2 px-3 text-right bg-blue-900/40">Đơn</th>
                <th className="py-2 px-3 text-right bg-blue-900/40">Doanh thu</th>
                <th className="py-2 px-3 text-right bg-blue-900/40">Trả/Đổi</th>
                <th className="py-2 px-3 text-right bg-amber-900/30">Lập phiếu</th>
                <th className="py-2 px-3 text-right bg-amber-900/30">Quét kiểm (chiếc/dòng)</th>
                <th className="py-2 px-3 text-right bg-amber-900/30">Hoàn thành</th>
                <th className="py-2 px-3 text-right bg-amber-900/30">Xuất chuyển tầng (PXK)</th>
                <th className="py-2 px-3 text-right bg-amber-900/30">Điều chỉnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-400">
                    {loading ? "Đang tải..." : "Không có dữ liệu trong kỳ này"}
                  </td>
                </tr>
              )}
              {staffRows.map((s) => {
                const idle =
                  s.sales.orders + s.sales.returnsHandled === 0 &&
                  s.warehouse.importsCreated +
                    s.warehouse.unitsScanned +
                    s.warehouse.importsCompleted +
                    (s.warehouse.transfers || 0) +
                    s.warehouse.adjustments ===
                    0;
                return (
                  <tr
                    key={s.staffId || "unknown"}
                    onClick={() => setSelectedStaffId(isSelected(s) ? null : s.staffId)}
                    className={`cursor-pointer ${
                      isSelected(s) ? "bg-emerald-50" : idle ? "text-slate-400 hover:bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{s.fullName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {s.code || "-"} {s.username ? `· ${s.username}` : ""}
                        {s.status === "LOCKED" && <span className="ml-1 text-red-600 font-bold">(đã khóa)</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">{roleBadge(s.role)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800">{s.sales.orders}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {formatVND(s.sales.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.sales.returnsHandled}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.warehouse.importsCreated}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                      {s.warehouse.unitsScanned} / {s.warehouse.rowsChecked}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.warehouse.importsCompleted}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-800 whitespace-nowrap">
                      {s.warehouse.transfers || 0} phiếu ({s.warehouse.unitsTransferred || 0} SP)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.warehouse.adjustments}</td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {s.lastActivityAt ? formatDateTime(s.lastActivityAt) : "Chưa có"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nhật ký chi tiết */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <button
            type="button"
            onClick={() => setView("SALES")}
            className={`min-h-[40px] rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 ${
              view === "SALES" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Bán hàng ({salesRows.length})
          </button>
          <button
            type="button"
            onClick={() => setView("WAREHOUSE")}
            className={`min-h-[40px] rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 ${
              view === "WAREHOUSE" ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-700"
            }`}
          >
            <PackageCheck className="w-4 h-4" /> Kiểm kho ({warehouseRows.length})
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          {view === "SALES" ? (
            <table className="w-full min-w-[820px] text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Nhân viên</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Khách hàng</th>
                  <th className="py-3 px-3 text-right">Số SP</th>
                  <th className="py-3 px-3 text-right">Số tiền</th>
                  <th className="py-3 px-3">Thanh toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salesRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">Không có hoạt động bán hàng</td>
                  </tr>
                )}
                {salesRows.map((a, i) => (
                  <tr key={`${a.referenceCode}-${i}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDateTime(a.at)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{a.staffName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.type === "ORDER" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {SALES_ACTIVITY_LABEL[a.type] || a.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">{a.referenceCode}</td>
                    <td className="py-2.5 px-3">{a.customerName}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{a.units}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">{formatVND(a.amount)}</td>
                    <td className="py-2.5 px-3">{a.paymentMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[820px] text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Nhân viên</th>
                  <th className="py-3 px-3">Thao tác</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3 text-right">Số lượng</th>
                  <th className="py-3 px-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {warehouseRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">Không có hoạt động kiểm kho</td>
                  </tr>
                )}
                {warehouseRows.map((a, i) => (
                  <tr key={`${a.referenceCode}-${a.type}-${i}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDateTime(a.at)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{a.staffName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          a.type === "IMPORT_CHECKED"
                            ? "bg-amber-100 text-amber-800"
                            : a.type === "IMPORT_COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.type === "EXPORT_TRANSFER"
                            ? "bg-indigo-100 text-indigo-800"
                            : a.type === "ADJUSTMENT"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {WAREHOUSE_ACTIVITY_LABEL[a.type] || a.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">{a.referenceCode}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{a.quantity}</td>
                    <td className="py-2.5 px-3 text-slate-600">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

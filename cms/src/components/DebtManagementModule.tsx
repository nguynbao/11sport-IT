"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  RevenueDashboardData,
  DebtOrderRow,
  Order,
  apiRequest,
  formatVND,
  formatDateTime,
  formatPhone,
  formatNumberDots,
  parseNumberDots,
  filterAndRankBySearch,
} from "@/lib/api";
import {
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  FileText,
  Users,
  Printer,
  X,
} from "lucide-react";

interface DebtManagementModuleProps {
  onOpenInvoice?: (order: Order) => void;
}

export default function DebtManagementModule({ onOpenInvoice }: DebtManagementModuleProps) {
  const [data, setData] = useState<RevenueDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [debtTab, setDebtTab] = useState<"ORDERS" | "CUSTOMERS">("ORDERS");
  const [debtFilter, setDebtFilter] = useState<
    "HAS_DEBT" | "OVERDUE" | "UNPAID" | "PARTIAL" | "SETTLED" | "ALL"
  >("HAS_DEBT");
  const [debtSearch, setDebtSearch] = useState("");
  const [expandedCustomerPhone, setExpandedCustomerPhone] = useState<string | null>(null);

  // Modal Thu nợ / Tất toán (Dành cho Admin)
  const [debtPayModalOrder, setDebtPayModalOrder] = useState<DebtOrderRow | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [debtPayMethod, setDebtPayMethod] = useState<"BANKING" | "CASH" | "CARD">("BANKING");
  const [debtPayNote, setDebtPayNote] = useState("");
  const [debtPaySaving, setDebtPaySaving] = useState(false);
  const [debtPayError, setDebtPayError] = useState("");
  const [debtPaySuccessMsg, setDebtPaySuccessMsg] = useState("");

  const loadDebtData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<RevenueDashboardData>("/reports/revenue-dashboard");
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebtData();
  }, [loadDebtData]);

  const openDebtPayModal = (order: DebtOrderRow) => {
    setDebtPayModalOrder(order);
    setDebtPayAmount(String(order.debtAmount || 0));
    setDebtPayMethod("BANKING");
    setDebtPayNote("");
    setDebtPayError("");
  };

  const handleConfirmDebtPayment = async () => {
    if (!debtPayModalOrder) return;
    const amt = Math.round(Number(debtPayAmount) || 0);
    if (amt <= 0) {
      setDebtPayError("Vui lòng nhập số tiền thu nợ lớn hơn 0 VND.");
      return;
    }
    if (amt > debtPayModalOrder.debtAmount) {
      setDebtPayError(
        `Số tiền thu (${formatVND(amt)}) không được vượt quá dư nợ còn lại (${formatVND(
          debtPayModalOrder.debtAmount
        )}).`
      );
      return;
    }

    setDebtPaySaving(true);
    setDebtPayError("");
    try {
      const res = await apiRequest(`/orders/${debtPayModalOrder._id}/debt-payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          method: debtPayMethod,
          note: debtPayNote.trim() || undefined,
        }),
      });
      setDebtPayModalOrder(null);
      setDebtPaySuccessMsg(
        (res as any).message ||
          `Đã ghi nhận thu nợ ${formatVND(amt)} cho đơn ${debtPayModalOrder.orderCode} thành công!`
      );
      setTimeout(() => setDebtPaySuccessMsg(""), 5000);
      await loadDebtData();
    } catch (err: any) {
      setDebtPayError(err.message || "Lỗi khi ghi nhận thu công nợ.");
    } finally {
      setDebtPaySaving(false);
    }
  };

  const handlePrintOrder = async (row: DebtOrderRow) => {
    if (!onOpenInvoice) return;
    try {
      const res = await apiRequest<Order>(`/orders/${row._id}`);
      if (res.data) {
        onOpenInvoice(res.data);
        return;
      }
    } catch {
      // fallback
    }
    onOpenInvoice({
      _id: row._id,
      orderCode: row.orderCode,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      items: row.items || [],
      subtotal: row.totalAmount,
      paymentMethod: (row.paymentMethod as any) || "OTHER",
      paymentMethodDetail: row.paymentMethodDetail,
      hasCardFee: false,
      cardFee: 0,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      debtAmount: row.debtAmount,
      initialDebtAmount: row.initialDebtAmount,
      debtStatus: row.debtStatus,
      debtDueDate: row.debtDueDate,
      debtPayments: row.debtPayments,
      note: row.note,
      status: "PAID",
      createdBy: "",
      createdByName: row.createdByName,
      confirmedByName: row.confirmedByName,
      createdAt: row.createdAt,
    });
  };

  const dm = data?.debtManagement;
  const s = data?.summary;

  const filteredDebtOrders = useMemo(() => {
    const list = dm?.orders || [];
    const byStatus = list.filter((o) => {
      if (debtFilter === "HAS_DEBT") return o.debtAmount > 0;
      if (debtFilter === "OVERDUE") return o.isOverdue && o.debtAmount > 0;
      if (debtFilter === "UNPAID") return o.debtStatus === "UNPAID" && o.debtAmount > 0;
      if (debtFilter === "PARTIAL") return o.debtStatus === "PARTIAL" && o.debtAmount > 0;
      if (debtFilter === "SETTLED") return o.debtStatus === "SETTLED" || o.debtAmount === 0;
      return true;
    });
    const q = debtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (o) => [
      { text: o.orderCode, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      { text: o.customerPhone, weight: 1.4 },
    ]);
  }, [dm?.orders, debtFilter, debtSearch]);

  const filteredDebtCustomers = useMemo(() => {
    const list = dm?.customers || [];
    const byStatus = list.filter((c) => {
      if (debtFilter === "HAS_DEBT") return c.totalDebtAmount > 0;
      if (debtFilter === "OVERDUE") return c.overdueOrders > 0 && c.totalDebtAmount > 0;
      if (debtFilter === "SETTLED") return c.totalDebtAmount === 0;
      return true;
    });
    const q = debtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (c) => [
      { text: c.customerName, weight: 1.4 },
      { text: c.phone, weight: 1.5 },
    ]);
  }, [dm?.customers, debtFilter, debtSearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            Quản lý Công nợ Khách hàng (Mua trước trả sau) — 11Sport CMS
          </div>
          <h2 className="text-lg font-extrabold mt-0.5">
            Theo dõi Dư nợ Khách hàng, Cảnh báo Quá hạn & Xác nhận Thu Nợ / Tất Toán
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý tập trung toàn bộ đơn bán công nợ tại quầy POS, lịch sử khách trả góp từng đợt và tất toán dư nợ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setDebtTab("ORDERS")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${
                debtTab === "ORDERS"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Theo Đơn Công Nợ ({dm?.orders?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setDebtTab("CUSTOMERS")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${
                debtTab === "CUSTOMERS"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Gom nhóm theo Khách SĐT ({dm?.customers?.length || 0})
            </button>
          </div>

          <button
            type="button"
            onClick={loadDebtData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {debtPaySuccessMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{debtPaySuccessMsg}</span>
        </div>
      )}

      {/* 4 Thẻ KPI Công nợ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
            <span>1. Tổng dư nợ cần thu</span>
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {formatVND(dm?.summary?.totalOutstandingDebt || 0)}
          </div>
          <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            Trên <strong>{dm?.summary?.activeDebtOrdersCount || 0}</strong> đơn đang nợ ·{" "}
            <strong>{dm?.summary?.activeDebtCustomersCount || 0}</strong> khách hàng
          </div>
        </div>

        <div
          className={`rounded-2xl border-2 p-4 shadow-sm ${
            (dm?.summary?.overdueOrdersCount || 0) > 0
              ? "bg-red-50/70 border-red-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-red-700">
            <span>2. Nợ quá hạn hẹn trả</span>
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-red-700 mt-2">
            {formatVND(dm?.summary?.overdueDebtAmount || 0)}
          </div>
          <div className="text-[11px] text-red-700 mt-2 pt-2 border-t border-red-200/60 font-semibold">
            {(dm?.summary?.overdueOrdersCount || 0) > 0
              ? `⚠️ Có ${dm?.summary?.overdueOrdersCount} đơn đã quá hạn hẹn trả!`
              : "Không có đơn công nợ quá hạn"}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-blue-800">
            <span>3. Tổng công nợ đã phát sinh</span>
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-blue-900 mt-2">
            {formatVND(dm?.summary?.totalInitialDebt || s?.initialDebtInPeriod || 0)}
          </div>
          <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            Tổng số đơn từng mua công nợ: <strong>{dm?.orders?.length || 0}</strong> đơn
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-emerald-800">
            <span>4. Đã thu hồi công nợ</span>
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-2">
            {formatVND(dm?.summary?.totalCollectedDebt || 0)}
          </div>
          <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            Đã tất toán hoàn tất: <strong>{dm?.summary?.settledDebtOrdersCount || 0}</strong> đơn
          </div>
        </div>
      </div>

      {/* Bảng quản lý & thao tác thu nợ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "HAS_DEBT", label: "Đang còn nợ" },
                { id: "OVERDUE", label: "Quá hạn hẹn trả" },
                { id: "UNPAID", label: "Chưa trả đợt nào" },
                { id: "PARTIAL", label: "Đã trả một phần" },
                { id: "SETTLED", label: "Đã tất toán xong" },
                { id: "ALL", label: "Tất cả đơn công nợ" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDebtFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  debtFilter === f.id
                    ? f.id === "OVERDUE"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={debtSearch}
              onChange={(e) => setDebtSearch(e.target.value)}
              placeholder="Tìm mã đơn, tên khách, SĐT..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>

        {debtTab === "ORDERS" ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                <tr>
                  <th className="text-left px-3 py-3">Mã đơn / Ngày mua</th>
                  <th className="text-left px-3 py-3">Khách hàng</th>
                  <th className="text-right px-3 py-3">Tổng đơn</th>
                  <th className="text-right px-3 py-3">Đã thu</th>
                  <th className="text-right px-3 py-3">Còn nợ</th>
                  <th className="text-center px-3 py-3">Hạn hẹn trả</th>
                  <th className="text-center px-3 py-3">Trạng thái & Lịch sử trả nợ</th>
                  <th className="text-right px-3 py-3">Thao tác Thu nợ / In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDebtOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      Không có đơn công nợ nào khớp bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredDebtOrders.map((o) => (
                    <tr
                      key={o._id}
                      className={`hover:bg-slate-50 ${
                        o.isOverdue && o.debtAmount > 0 ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <div className="font-mono font-extrabold text-slate-900">{o.orderCode}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateTime(o.createdAt)}
                        </div>
                        {(o.confirmedByName || o.createdByName) && (
                          <div className="text-[10px] text-slate-400">
                            Thu ngân: {o.confirmedByName || o.createdByName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{o.customerName}</div>
                        <div className="font-mono text-[11px] text-blue-700 font-semibold">
                          {formatPhone(o.customerPhone)}
                        </div>
                        {o.note && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 max-w-xs truncate">
                            Ghi chú: {o.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                        {formatVND(o.totalAmount)}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Nợ gốc: {formatVND(o.initialDebtAmount)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatVND(o.paidAmount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-black text-amber-700 text-sm">
                        {formatVND(o.debtAmount)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {o.debtDueDate ? (
                          <div>
                            <div className="font-mono font-bold text-slate-800">
                              {new Date(o.debtDueDate).toLocaleDateString("vi-VN")}
                            </div>
                            {o.isOverdue && o.debtAmount > 0 && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                                Quá hạn {o.daysOverdue} ngày
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Không hẹn</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            o.debtAmount <= 0 || o.debtStatus === "SETTLED"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.debtStatus === "PARTIAL"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.debtAmount <= 0 || o.debtStatus === "SETTLED"
                            ? "Đã tất toán"
                            : o.debtStatus === "PARTIAL"
                            ? "Trả 1 phần"
                            : "Chưa trả nợ"}
                        </span>
                        {o.debtPayments && o.debtPayments.length > 0 && (
                          <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-600 text-left bg-slate-50 rounded p-1.5 border border-slate-200 max-w-[240px] mx-auto">
                            {o.debtPayments.map((dp, i) => (
                              <div key={i} className="flex justify-between gap-1">
                                <span className="font-mono font-bold text-emerald-700">
                                  +{formatVND(dp.amount)} ({dp.method})
                                </span>
                                <span className="text-slate-400">
                                  {new Date(dp.paidAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {o.debtAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() => openDebtPayModal(o)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm transition"
                            >
                              Thu nợ / Tất toán
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mr-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất
                            </span>
                          )}
                          {onOpenInvoice && (
                            <button
                              type="button"
                              onClick={() => handlePrintOrder(o)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs inline-flex items-center gap-1"
                              title="In hóa đơn PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: GOM NHÓM THEO KHÁCH HÀNG (SĐT) */
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                <tr>
                  <th className="text-left px-3 py-3">Khách hàng / SĐT</th>
                  <th className="text-center px-3 py-3">Số đơn nợ</th>
                  <th className="text-right px-3 py-3">Tổng mua</th>
                  <th className="text-right px-3 py-3">Đã thanh toán</th>
                  <th className="text-right px-3 py-3">Tổng dư nợ còn lại</th>
                  <th className="text-center px-3 py-3">Hạn trả gần nhất</th>
                  <th className="text-right px-3 py-3">Chi tiết & Thu nợ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDebtCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      Không có khách hàng công nợ nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredDebtCustomers.map((c) => {
                    const isExpanded = expandedCustomerPhone === c.phone;
                    const custOrders = c.orders || [];
                    return (
                      <React.Fragment key={c.phone}>
                        <tr
                          className={`hover:bg-slate-50 ${
                            c.overdueOrders > 0 && c.totalDebtAmount > 0 ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="px-3 py-3">
                            <div className="font-extrabold text-slate-900">{c.customerName}</div>
                            <div className="font-mono text-xs text-blue-700 font-bold">
                              {formatPhone(c.phone)}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-mono font-extrabold text-amber-800">
                              {c.activeDebtOrders} đơn đang nợ
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Tổng lịch sử: {c.totalOrders} đơn
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">
                            {formatVND(c.totalOrderAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                            {formatVND(c.totalPaidAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-black text-amber-700 text-sm">
                            {formatVND(c.totalDebtAmount)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {c.nearestDueDate ? (
                              <div>
                                <div className="font-mono font-bold text-slate-800">
                                  {new Date(c.nearestDueDate).toLocaleDateString("vi-VN")}
                                </div>
                                {c.overdueOrders > 0 && (
                                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                                    {c.overdueOrders} đơn quá hạn
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCustomerPhone(isExpanded ? null : c.phone)
                              }
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                            >
                              {isExpanded ? "Ẩn đơn" : `Xem ${custOrders.length} đơn & Thu nợ`}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-amber-50/40">
                            <td colSpan={7} className="p-3">
                              <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
                                <div className="text-xs font-extrabold text-slate-800">
                                  Danh sách đơn công nợ của khách {c.customerName} (
                                  {formatPhone(c.phone)}):
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {custOrders.map((co) => (
                                    <div
                                      key={co._id}
                                      className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                                    >
                                      <div>
                                        <span className="font-mono font-extrabold text-slate-900">
                                          {co.orderCode}
                                        </span>{" "}
                                        <span className="text-slate-500">
                                          ({formatDateTime(co.createdAt)})
                                        </span>
                                        {co.debtDueDate && (
                                          <span className="ml-2 text-[11px] font-semibold text-amber-800">
                                            · Hạn trả:{" "}
                                            {new Date(co.debtDueDate).toLocaleDateString("vi-VN")}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span>
                                          Tổng:{" "}
                                          <strong className="font-mono">
                                            {formatVND(co.totalAmount)}
                                          </strong>
                                        </span>
                                        <span className="text-emerald-700">
                                          Đã trả:{" "}
                                          <strong className="font-mono">
                                            {formatVND(co.paidAmount)}
                                          </strong>
                                        </span>
                                        <span className="text-amber-700">
                                          Còn nợ:{" "}
                                          <strong className="font-mono">
                                            {formatVND(co.debtAmount)}
                                          </strong>
                                        </span>
                                        {co.debtAmount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => openDebtPayModal(co)}
                                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
                                          >
                                            Thu nợ đơn này
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL THU NỢ / TẤT TOÁN CÔNG NỢ (DÀNH CHO ADMIN) */}
      {debtPayModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-amber-600">
                  Xác nhận thu hồi công nợ (Admin)
                </span>
                <h4 className="text-base font-black text-slate-900 mt-0.5">
                  Đơn hàng {debtPayModalOrder.orderCode}
                </h4>
                <p className="text-xs text-slate-500">
                  Khách hàng: <strong>{debtPayModalOrder.customerName}</strong> ·{" "}
                  <span className="font-mono">{formatPhone(debtPayModalOrder.customerPhone)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDebtPayModalOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Tổng giá trị đơn hàng:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatVND(debtPayModalOrder.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Đã thanh toán trước đó:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatVND(debtPayModalOrder.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-amber-200/80 text-sm">
                <span className="font-extrabold text-amber-900">Dư nợ còn phải thu:</span>
                <span className="font-mono font-black text-amber-700">
                  {formatVND(debtPayModalOrder.debtAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Số tiền khách trả đợt này (VND) *
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDebtPayAmount(String(Math.round(debtPayModalOrder.debtAmount / 2)))
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
                    >
                      Thu 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtPayAmount(String(debtPayModalOrder.debtAmount))}
                      className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-[10px] font-extrabold text-amber-800"
                    >
                      Tất toán 100%
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(Number(debtPayAmount) || 0)}
                  onChange={(e) => setDebtPayAmount(String(parseNumberDots(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900"
                  placeholder="Nhập số tiền thu..."
                />
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Còn nợ sau đợt thu này:</span>
                  <span className="font-mono font-extrabold text-amber-700">
                    {formatVND(
                      Math.max(0, debtPayModalOrder.debtAmount - (Number(debtPayAmount) || 0))
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hình thức khách thanh toán nợ *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "BANKING", label: "Chuyển khoản" },
                      { id: "CASH", label: "Tiền mặt" },
                      { id: "CARD", label: "Quẹt thẻ" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDebtPayMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        debtPayMethod === m.id
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú đợt thu nợ (tùy chọn)
                </label>
                <input
                  type="text"
                  value={debtPayNote}
                  onChange={(e) => setDebtPayNote(e.target.value)}
                  placeholder="VD: Khách CK Vietcombank tất toán công nợ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>

            {debtPayError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs font-bold text-red-700">
                {debtPayError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDebtPayModalOrder(null)}
                disabled={debtPaySaving}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDebtPayment}
                disabled={debtPaySaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm disabled:opacity-50"
              >
                {debtPaySaving ? "Đang lưu..." : "Xác nhận Thu Nợ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

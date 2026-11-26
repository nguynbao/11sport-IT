"use client";

import { formatDateTime,formatPhone,formatVND } from "@/shared/utils/format";
import {
AlertTriangle,
CheckCircle2,
Clock,
FileText,
Printer,
RefreshCw,
Search,
Users,
Wallet
} from "lucide-react";
import React from "react";

import { DebtManagementModuleProps,useDebtManagement } from "../hooks/useDebtManagement";
import { DebtPaymentModal } from "./DebtPaymentModal";
import { PaginationBar } from "@/shared/ui/PaginationBar";

export default function DebtManagementModule(props: DebtManagementModuleProps) {
  const vm = useDebtManagement(props);
  const {
    onOpenInvoice,
    loading,
    debtTab,
    setDebtTab,
    debtFilter,
    setDebtFilter,
    debtSearch,
    setDebtSearch,
    expandedCustomerPhone,
    setExpandedCustomerPhone,
    debtPaySuccessMsg,
    loadDebtData,
    openDebtPayModal,
    handlePrintOrder,
    dm,
    s,
    filteredDebtOrders,
    filteredDebtCustomers,
  } = vm;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            Quản lý Công nợ Khách hàng (Mua trước trả sau) — 11Sport CMS
          </div>
          <h2 className="text-lg font-extrabold mt-0.5 text-slate-900">
            Theo dõi Dư nợ Khách hàng, Cảnh báo Quá hạn & Xác nhận Thu Nợ / Tất Toán
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tập trung toàn bộ đơn bán công nợ tại quầy POS, lịch sử khách trả góp từng đợt và tất toán dư nợ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setDebtTab("ORDERS")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${
                debtTab === "ORDERS"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
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
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
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
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
            Làm mới
          </button>
        </div>
      </div>

      {debtPaySuccessMsg && (
        <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-xs font-bold text-brand-ink flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
          <span>{debtPaySuccessMsg}</span>
        </div>
      )}

      {/* 4 Thẻ KPI Công nợ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
            <span>1. Tổng dư nợ cần thu</span>
            <span className="p-2 rounded-xl bg-teal-100 text-brand-ink">
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
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-brand-ink">
            <span>3. Tổng công nợ đã phát sinh</span>
            <span className="p-2 rounded-xl bg-teal-100 text-brand-ink">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-teal-900 mt-2">
            {formatVND(dm?.summary?.totalInitialDebt || s?.initialDebtInPeriod || 0)}
          </div>
          <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            Tổng số đơn từng mua công nợ: <strong>{dm?.orders?.length || 0}</strong> đơn
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-brand-ink">
            <span>4. Đã thu nợ & Giảm nợ trả hàng</span>
            <span className="p-2 rounded-xl bg-teal-100 text-brand-ink">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-brand-ink mt-2">
            {formatVND(dm?.summary?.totalCollectedDebt || 0)}
          </div>
          <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100 space-y-0.5">
            <div>
              Giảm nợ do trả hàng:{" "}
              <strong className="font-mono text-purple-700">
                {formatVND(dm?.summary?.totalReducedByReturn || 0)}
              </strong>
            </div>
            <div>
              Đã tất toán hoàn tất: <strong>{dm?.summary?.settledDebtOrdersCount || 0}</strong> đơn
            </div>
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
                      : "bg-teal-600 text-white shadow-sm"
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
            <table data-cards className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                <tr>
                  <th className="text-left px-3 py-3">Mã đơn / Ngày mua</th>
                  <th className="text-left px-3 py-3">Khách hàng</th>
                  <th className="text-right px-3 py-3">Tổng đơn</th>
                  <th className="text-right px-3 py-3">Đã thu / Giảm nợ</th>
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
                  vm.ordersPagination.items.map((o) => (
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
                        <div className="font-mono text-[11px] text-brand-ink font-semibold">
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
                      <td className="px-3 py-3 text-right font-mono font-bold text-brand-ink">
                        {formatVND(o.paidAmount)}
                        {(o.reducedByReturnAmount || 0) > 0 && (
                          <div className="text-[10px] text-purple-700 font-semibold">
                            Giảm nợ trả hàng: -{formatVND(o.reducedByReturnAmount || 0)}
                          </div>
                        )}
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
                              ? "bg-teal-100 text-brand-ink"
                              : o.debtStatus === "PARTIAL"
                              ? "bg-teal-100 text-brand-ink"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.debtAmount <= 0 || o.debtStatus === "SETTLED"
                            ? "Đã tất toán"
                            : o.debtStatus === "PARTIAL"
                            ? "Trả 1 phần"
                            : "Chưa trả nợ"}
                        </span>
                        {((o.debtPayments && o.debtPayments.length > 0) ||
                          (o.debtAdjustments && o.debtAdjustments.length > 0)) && (
                          <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-600 text-left bg-slate-50 rounded p-1.5 border border-slate-200 max-w-[240px] mx-auto">
                            {o.debtPayments?.map((dp, i) => (
                              <div key={`dp-${i}`} className="flex justify-between gap-1">
                                <span className="font-mono font-bold text-brand-ink">
                                  +{formatVND(dp.amount)} ({dp.method})
                                </span>
                                <span className="text-slate-400">
                                  {new Date(dp.paidAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                            ))}
                            {o.debtAdjustments?.map((da, i) => (
                              <div
                                key={`da-${i}`}
                                className="flex justify-between gap-1 text-purple-700"
                                title={da.note || `Cấn trừ nợ từ phiếu trả ${da.returnCode || ""}`}
                              >
                                <span className="font-mono font-bold">
                                  -{formatVND(da.amount)} (Trả {da.returnCode || "hàng"})
                                </span>
                                <span className="text-slate-400">
                                  {da.at || da.adjustedAt
                                    ? new Date(da.at || da.adjustedAt || "").toLocaleDateString("vi-VN")
                                    : ""}
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
                              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-sm transition"
                            >
                              Thu nợ / Tất toán
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-brand-ink flex items-center gap-1 mr-1">
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
            <PaginationBar
              totalItems={vm.ordersPagination.total}
              page={vm.ordersPagination.page}
              totalPages={vm.ordersPagination.totalPages}
              pageSize={vm.ordersPagination.pageSize}
              onPageChange={vm.ordersPagination.setPage}
              onPageSizeChange={vm.ordersPagination.setPageSize}
              itemLabel="đơn công nợ"
            />
          </div>
        ) : (
          /* TAB 2: GOM NHÓM THEO KHÁCH HÀNG (SĐT) */
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table data-cards className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
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
                  vm.customersPagination.items.map((c) => {
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
                            <div className="font-mono text-xs text-brand-ink font-bold">
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
                          <td className="px-3 py-3 text-right font-mono font-bold text-brand-ink">
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
                              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition"
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
                                        <span className="text-brand-ink">
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
            <PaginationBar
              totalItems={vm.customersPagination.total}
              page={vm.customersPagination.page}
              totalPages={vm.customersPagination.totalPages}
              pageSize={vm.customersPagination.pageSize}
              onPageChange={vm.customersPagination.setPage}
              onPageSizeChange={vm.customersPagination.setPageSize}
              itemLabel="khách hàng nợ"
            />
          </div>
        )}
      </div>

      <DebtPaymentModal vm={vm} />
    </div>
  );
}

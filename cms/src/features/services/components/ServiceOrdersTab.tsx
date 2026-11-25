"use client";

import { ServiceOrderStatus } from "@/shared/types";
import { formatPhone,formatVND } from "@/shared/utils/format";
import {
AlertTriangle,
CheckCircle2,
Edit3,
PackageCheck,
Play,
RefreshCw,
Search,
Wallet
} from "lucide-react";
import { ServiceManagementViewModel } from "../hooks/useServiceManagement";
import { PaginationBar } from "@/shared/ui/PaginationBar";
const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeCls: "bg-red-50 text-red-600 border-red-200",
  },
};

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputDate(raw?: string | null): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ServiceOrdersTab({ vm }: { vm: ServiceManagementViewModel }) {
  const {
    canManageServices,
    subTab,
    serviceOrders,
    ordersMeta,
    loadingOrders,
    orderSearch,
    setOrderSearch,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    overdueOnly,
    setOverdueOnly,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fetchServiceOrders,
    handleStatusChange,
    handleOpenCollectModal,
    handleOpenEditOrder,
  } = vm;

  return (
    <>
      {/* TAB 1: QUẢN LÝ ĐƠN DỊCH VỤ */}
      {/* ================================================== */}
      {subTab === "ORDERS" && (
        <div className="space-y-4">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Tổng đơn dịch vụ</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {ordersMeta.totalOrders}
              </div>
            </div>
            <div className="bg-teal-50 p-3.5 rounded-xl border border-teal-200">
              <div className="text-xs font-bold text-brand-ink">Tiếp nhận / Đang xử lý</div>
              <div className="text-xl font-extrabold text-teal-900 mt-1">
                {ordersMeta.receivedCount + ordersMeta.inProgressCount}
              </div>
            </div>
            <div className="bg-teal-50 p-3.5 rounded-xl border border-teal-200">
              <div className="text-xs font-bold text-brand-ink">Đã xong (Chờ lấy)</div>
              <div className="text-xl font-extrabold text-teal-900 mt-1">
                {ordersMeta.readyCount}
              </div>
            </div>
            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
              <div className="text-xs font-bold text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Quá hạn hẹn trả
              </div>
              <div className="text-xl font-extrabold text-red-700 mt-1">
                {ordersMeta.overdueCount}
              </div>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
              <div className="text-xs font-bold text-brand-ink">Tổng doanh thu DV</div>
              <div className="text-base font-mono font-extrabold text-indigo-900 mt-1">
                {formatVND(ordersMeta.totalRevenue)}
              </div>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <div className="text-xs font-bold text-amber-800">Còn phải thu KH</div>
              <div className="text-base font-mono font-extrabold text-rose-600 mt-1">
                {formatVND(ordersMeta.totalRemaining)}
              </div>
            </div>
          </div>

          {/* BỘ LỌC & BẢNG ĐƠN DỊCH VỤ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tìm kiếm đơn dịch vụ
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Mã DV-0001, tên khách, SĐT, loại dịch vụ..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Trạng thái xử lý
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="RECEIVED">Đã tiếp nhận</option>
                  <option value="IN_PROGRESS">Đang xử lý</option>
                  <option value="READY">Đã xong (Chờ lấy)</option>
                  <option value="RETURNED">Đã trả khách</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Thanh toán
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="UNPAID">Chưa thu (0đ)</option>
                  <option value="PARTIAL">Đã đặt cọc</option>
                  <option value="PAID">Đã thu đủ</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Từ ngày gửi
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Đến ngày gửi
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchServiceOrders}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                  title="Làm mới"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOverdueOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                  overdueOnly
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Chỉ hiện đơn Quá hạn hẹn trả ({ordersMeta.overdueCount})
              </button>

              {(statusFilter !== "ALL" ||
                paymentFilter !== "ALL" ||
                overdueOnly ||
                fromDate ||
                toDate ||
                orderSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setPaymentFilter("ALL");
                    setOverdueOnly(false);
                    setFromDate("");
                    setToDate("");
                    setOrderSearch("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* BẢNG DANH SÁCH */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-extrabold">
                    <th className="py-3 px-3">Mã đơn</th>
                    <th className="py-3 px-3">Khách hàng</th>
                    <th className="py-3 px-3">Chi tiết dịch vụ</th>
                    <th className="py-3 px-3">Ngày gửi / Hẹn trả</th>
                    <th className="py-3 px-3 text-right">Tổng tiền / Thanh toán</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    {canManageServices && (
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={canManageServices ? 7 : 6} className="py-10 text-center text-slate-500">
                        Đang tải danh sách đơn dịch vụ...
                      </td>
                    </tr>
                  ) : serviceOrders.length === 0 ? (
                    <tr>
                      <td colSpan={canManageServices ? 7 : 6} className="py-10 text-center text-slate-500">
                        Chưa có đơn dịch vụ nào khớp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    serviceOrders.map((ord) => {
                      const stInfo = STATUS_INFO[ord.status] || STATUS_INFO.RECEIVED;
                      return (
                        <tr
                          key={ord._id}
                          className={`hover:bg-slate-50/80 ${
                            ord.isOverdue ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {ord.orderCode}
                            </span>
                            {ord.createdByName && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                NV: {ord.createdByName}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="font-extrabold text-slate-900">
                              {ord.customerName}
                            </div>
                            <div className="font-mono text-slate-600 mt-0.5">
                              {formatPhone(ord.customerPhone)}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top max-w-xs">
                            <div className="space-y-1">
                              {(ord.items || []).map((it, idx) => (
                                <div key={idx}>
                                  <span className="font-bold text-slate-900">
                                    • {it.serviceName}
                                  </span>{" "}
                                  <span className="text-slate-500">
                                    ({it.quantity} {it.unit} × {formatVND(it.unitPrice)}
                                    {(Number(it.discountAmount) || 0) > 0
                                      ? ` - Giảm ${formatVND(it.discountAmount)}`
                                      : ""}
                                    )
                                  </span>
                                  {it.itemNote && (
                                    <div className="text-[11px] text-brand-ink pl-2">
                                      ↳ {it.itemNote}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {ord.note && (
                                <div className="text-[11px] text-slate-500 italic">
                                  Ghi chú: {ord.note}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div>
                              Gửi: <strong>{formatDateDisplay(ord.receivedAt)}</strong>
                            </div>
                            <div
                              className={`mt-0.5 ${
                                ord.isOverdue ? "text-red-600 font-extrabold" : ""
                              }`}
                            >
                              Hẹn trả: <strong>{formatDateDisplay(ord.dueAt)}</strong>
                            </div>
                            {ord.returnedAt && (
                              <div className="text-[11px] text-brand-ink mt-0.5">
                                Đã trả: {formatDateDisplay(ord.returnedAt)}
                              </div>
                            )}
                            {ord.isOverdue && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold">
                                <AlertTriangle className="w-3 h-3" /> Quá hạn hẹn trả
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <div className="font-mono font-extrabold text-sm text-slate-900">
                              {formatVND(ord.totalAmount)}
                            </div>
                            {((Number(ord.itemDiscountTotal) || 0) +
                              (Number(ord.billDiscountAmount) || 0) >
                              0 ||
                              (Number(ord.cardFee) || 0) > 0) && (
                              <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                                {(Number(ord.itemDiscountTotal) || 0) +
                                  (Number(ord.billDiscountAmount) || 0) >
                                  0 && (
                                  <div className="text-amber-700">
                                    Giảm: -
                                    {formatVND(
                                      (Number(ord.itemDiscountTotal) || 0) +
                                        (Number(ord.billDiscountAmount) || 0)
                                    )}
                                  </div>
                                )}
                                {(Number(ord.cardFee) || 0) > 0 && (
                                  <div className="text-brand-ink">
                                    Phí thẻ ({ord.cardFeePercent || 1.8}%): +
                                    {formatVND(ord.cardFee)}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="text-[11px] text-brand-ink font-mono">
                              Đã thu: {formatVND(ord.paidAmount)}
                            </div>
                            {ord.remainingAmount > 0 ? (
                              <div className="text-[11px] font-mono font-extrabold text-rose-600">
                                Còn thu: {formatVND(ord.remainingAmount)}
                              </div>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-teal-50 text-brand-ink text-[10px] font-bold">
                                Đã thanh toán đủ
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            {canManageServices ? (
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    ord,
                                    e.target.value as ServiceOrderStatus
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${stInfo.badgeCls}`}
                              >
                                <option value="RECEIVED">Đã tiếp nhận</option>
                                <option value="IN_PROGRESS">Đang xử lý</option>
                                <option value="READY">Đã xong (Chờ lấy)</option>
                                <option value="RETURNED">Đã trả khách</option>
                                <option value="CANCELLED">Đã hủy</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold border ${stInfo.badgeCls}`}
                              >
                                {stInfo.label}
                              </span>
                            )}
                          </td>

                          {canManageServices && (
                            <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {/* Bước 1: Đã nhận đồ -> Bắt đầu làm */}
                                {ord.status === "RECEIVED" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStatusChange(ord, "IN_PROGRESS")
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1"
                                    title="Bước 1: Bắt đầu xử lý dịch vụ"
                                  >
                                    <Play className="w-3.5 h-3.5" /> Bắt đầu làm
                                  </button>
                                )}

                                {/* Bước 2: Đang xử lý -> Đã xong */}
                                {ord.status === "IN_PROGRESS" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(ord, "READY")}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                                    title="Bước 2: Xác nhận đã làm xong, chờ khách lấy"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã xong
                                  </button>
                                )}

                                {/* Bước 3: Đã xong (Chờ lấy) -> Thu tiền & Trả đồ (nếu còn tiền) hoặc Trả đồ (nếu đã thu đủ) */}
                                {ord.status === "READY" && ord.remainingAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCollectModal(ord, true)}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                                    title="Bước 3: Thu tiền & Trả đồ cho khách"
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Thu tiền &amp; Trả đồ
                                  </button>
                                )}

                                {ord.status === "READY" && ord.remainingAmount <= 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(ord, "RETURNED")}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1"
                                    title="Bước 3: Xác nhận trả đồ cho khách"
                                  >
                                    <PackageCheck className="w-3.5 h-3.5" /> Trả đồ
                                  </button>
                                )}

                                {/* Trường hợp đã trả đồ nhưng còn công nợ */}
                                {ord.status === "RETURNED" && ord.remainingAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCollectModal(ord, false)}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                                    title="Thu nốt tiền dịch vụ"
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Thu tiền
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditOrder(ord)}
                                  className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                  title="Chỉnh sửa đơn dịch vụ"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={vm.orderTotal}
              page={vm.orderPage}
              totalPages={vm.orderTotalPages}
              pageSize={vm.orderPageSize}
              onPageChange={vm.setOrderPage}
              onPageSizeChange={vm.setOrderPageSize}
              itemLabel="đơn dịch vụ"
            />
          </div>
        </div>
      )}

      {/* ================================================== */}
    </>
  );
}

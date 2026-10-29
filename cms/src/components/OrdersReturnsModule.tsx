"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Order,
  ReturnReceipt,
  apiRequest,
  formatVND,
  formatDateTime,
} from "@/lib/api";
import { Search, Printer, ShoppingBag, RotateCcw } from "lucide-react";
import ExportExcelButton from "./ExportExcelButton";
import { exportOrders, exportReturns } from "@/lib/exports";

interface OrdersReturnsModuleProps {
  onOpenInvoice: (order: Order) => void;
}

export default function OrdersReturnsModule({
  onOpenInvoice,
}: OrdersReturnsModuleProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReceipt[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const loadData = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (statusFilter) q.set("status", statusFilter);
      if (paymentFilter) q.set("paymentMethod", paymentFilter);

      const [ordRes, retRes] = await Promise.all([
        apiRequest<Order[]>(`/orders?${q.toString()}`),
        apiRequest<ReturnReceipt[]>("/returns"),
      ]);
      setOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
      setReturns(Array.isArray(retRes.data) ? retRes.data : []);
    } catch {
      // ignore
    }
  }, [search, statusFilter, paymentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Bộ lọc Đơn hàng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              Quản lý Toàn bộ Đơn hàng POS & Xuất Hóa Đơn PDF
            </h3>
            <p className="text-xs text-slate-500">
              Tra cứu theo mã đơn, SĐT khách hàng, phương thức thanh toán và mở bản in PDF (Khổ K80 / A4).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportExcelButton
              label="Xuất Excel (kèm chi tiết)"
              onExport={() => exportOrders(orders)}
              disabled={orders.length === 0}
            />
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã đơn, tên hoặc SĐT khách..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PAID">PAID (Đã bán)</option>
              <option value="PARTIALLY_RETURNED">
                PARTIALLY_RETURNED (Trả 1 phần)
              </option>
              <option value="FULLY_RETURNED">FULLY_RETURNED (Trả toàn bộ)</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="">Tất cả PTTT</option>
              <option value="CASH">Tiền mặt (CASH)</option>
              <option value="BANKING">Chuyển khoản (BANKING)</option>
              <option value="CARD">Thẻ (CARD)</option>
            </select>
          </div>
        </div>

        {/* Bảng Đơn hàng */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3">Mã Đơn</th>
                <th className="py-3 px-3">Khách hàng (SĐT)</th>
                <th className="py-3 px-3">Sản phẩm mua</th>
                <th className="py-3 px-3">Thanh toán</th>
                <th className="py-3 px-3 text-right">Tiền hàng</th>
                <th className="py-3 px-3 text-right">Phí thẻ 3%</th>
                <th className="py-3 px-3 text-right">Tổng thu</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-right">Hóa đơn PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((ord) => (
                <tr key={ord._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {ord.orderCode || ord.code}
                    <div className="text-[10px] text-slate-400 font-normal">
                      {formatDateTime(ord.createdAt)}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{ord.customerName}</div>
                    <div className="font-mono text-slate-500">{ord.customerPhone}</div>
                  </td>
                  <td className="py-3 px-3">
                    {ord.items?.map((it, idx) => (
                      <div key={idx} className="text-slate-700">
                        • {it.productName} (×{it.quantity})
                      </div>
                    ))}
                  </td>
                  <td className="py-3 px-3 font-semibold">{ord.paymentMethod}</td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatVND(ord.subtotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-700">
                    {formatVND(ord.cardFee)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                    {formatVND(ord.totalAmount)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ord.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : ord.status === "PARTIALLY_RETURNED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(ord)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> PDF (K80/A4)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng Phiếu Trả / Đổi Hàng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Danh sách Phiếu Trả / Đổi Hàng ({returns.length})
          </h3>
          <ExportExcelButton onExport={() => exportReturns(returns)} disabled={returns.length === 0} />
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3">Mã Phiếu</th>
                <th className="py-3 px-3">Đơn hàng gốc</th>
                <th className="py-3 px-3">Loại</th>
                <th className="py-3 px-3 text-right">Tiền hàng trả</th>
                <th className="py-3 px-3 text-right">Tiền hàng đổi</th>
                <th className="py-3 px-3 text-right">Chênh lệch</th>
                <th className="py-3 px-3">Ghi chú</th>
                <th className="py-3 px-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {returns.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold">
                    {r.returnCode || r.code}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                    {r.orderCode}
                  </td>
                  <td className="py-3 px-3 font-bold">{r.type}</td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatVND(r.returnTotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatVND(r.exchangeTotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {r.netDifference < 0
                      ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                      : r.netDifference > 0
                      ? `Thu thêm ${formatVND(r.netDifference)}`
                      : "0 ₫"}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{r.note || "-"}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

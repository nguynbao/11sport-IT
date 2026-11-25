"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatDateTime, formatVND } from "@/lib/api";
import { formatWebShippingAddress, WebOnlineOrderItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import { Eye, Search, Truck, X } from "lucide-react";

const FULFILLMENT_OPTIONS = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PACKING", label: "Đang đóng gói" },
  { value: "SHIPPING", label: "Đang giao hàng" },
  { value: "DELIVERED", label: "Đã giao thành công" },
  { value: "CANCELLED", label: "Đã hủy (Hoàn kho)" },
];

export default function WebOrdersTab() {
  const [orders, setOrders] = useState<WebOnlineOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const [selected, setSelected] = useState<WebOnlineOrderItem | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (fulfillmentFilter) qs.set("fulfillmentStatus", fulfillmentFilter);
      if (paymentFilter) qs.set("paymentStatus", paymentFilter);
      const query = qs.toString() ? `?${qs.toString()}` : "";
      const res = await apiRequest<WebOnlineOrderItem[]>(`/cms/web/orders${query}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách đơn hàng Online");
    } finally {
      setLoading(false);
    }
  }, [q, fulfillmentFilter, paymentFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openDetail = (o: WebOnlineOrderItem) => {
    setSelected(o);
    setNextStatus(o.fulfillmentStatus || "PENDING");
    setTrackingCode(o.trackingCode || "");
  };

  const handleUpdateFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/cms/web/orders/${selected._id}/fulfillment`, {
        method: "PATCH",
        body: JSON.stringify({
          fulfillmentStatus: nextStatus,
          trackingCode,
        }),
      });
      setSuccess(`Đã cập nhật đơn ${selected.orderCode} → ${nextStatus}`);
      setSelected(null);
      await loadOrders();
    } catch (err: any) {
      setError(err?.message || "Cập nhật đơn hàng thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, tên, SĐT..."
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs w-64 focus:border-teal-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
          >
            <option value="">Thanh toán: Tất cả</option>
            <option value="PAID">Đã thanh toán (PAID)</option>
            <option value="UNPAID">Chưa thanh toán (UNPAID)</option>
            <option value="EXPIRED">Hết hạn QR (EXPIRED)</option>
          </select>
          <select
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
          >
            <option value="">Giao hàng: Tất cả</option>
            {FULFILLMENT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TabFeedbackBanner
        error={error}
        success={success}
        onClear={() => {
          setError("");
          setSuccess("");
        }}
      />

      {loading ? (
        <TabLoadingState />
      ) : orders.length === 0 ? (
        <TabEmptyState title="Chưa có đơn hàng Online nào khớp bộ lọc" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Mã đơn / Thời gian</th>
                <th className="p-3">Khách hàng</th>
                <th className="p-3 text-right">Tổng tiền</th>
                <th className="p-3">Thanh toán</th>
                <th className="p-3">Giao hàng &amp; Vận đơn</th>
                <th className="p-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-mono font-extrabold text-teal-700">{o.orderCode}</div>
                    <div className="text-[11px] text-slate-400">{formatDateTime(o.createdAt)}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{o.customerName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{o.customerPhone}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                    {formatVND(o.totalAmount)}
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-[11px] font-bold">{o.paymentGateway || "COD"}</div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded border text-[10px] font-bold ${
                        o.paymentStatus === "PAID"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : o.paymentStatus === "EXPIRED"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[11px] text-slate-800">
                      {o.fulfillmentStatus}
                    </span>
                    {o.trackingCode && (
                      <div className="font-mono text-[11px] text-teal-700 mt-0.5 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        <span>{o.trackingCode}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(o)}
                      className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xử lý</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm font-mono">Đơn hàng {selected.orderCode}</h4>
              <button type="button" onClick={() => setSelected(null)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div>
                  <strong>Khách hàng:</strong> {selected.customerName} ({selected.customerPhone})
                </div>
                <div>
                  <strong>Địa chỉ:</strong> {formatWebShippingAddress(selected.shippingAddress)}
                </div>
                <div>
                  <strong>Tổng thanh toán:</strong>{" "}
                  <span className="font-mono font-extrabold text-teal-700">
                    {formatVND(selected.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
                    <tr>
                      <th className="p-2.5">Sản phẩm</th>
                      <th className="p-2.5 text-center">SL</th>
                      <th className="p-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selected.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{it.productName}</div>
                          {(it.color || it.size) && (
                            <div className="text-[11px] text-slate-500">
                              {it.color} {it.size}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatVND(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleUpdateFulfillment} className="space-y-3 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Trạng thái giao hàng</label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      {FULFILLMENT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Mã vận đơn</label>
                    <input
                      type="text"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder="VD: GHTK-123456"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                  >
                    {saving ? "Đang cập nhật..." : "Cập nhật đơn"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

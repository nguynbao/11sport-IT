"use client";

import React, { useState, useEffect } from "react";
import { Order, ReturnReceipt, apiRequest, formatVND, formatDateTime } from "@/lib/api";
import { Search, User, Phone, Printer, ShoppingBag, RotateCcw } from "lucide-react";

interface CustomerTabProps {
  onOpenInvoice: (order: Order) => void;
}

export default function CustomerTab({ onOpenInvoice }: CustomerTabProps) {
  const [phone, setPhone] = useState("");
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReceipt[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Tải danh sách khách hàng gần đây để nhân viên bấm tra cứu nhanh
    apiRequest<any[]>("/customers")
      .then((res) => {
        setAllCustomers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});
  }, []);

  const handleLookup = async (targetPhone?: string) => {
    const qPhone = (targetPhone ?? phone).trim();
    if (!qPhone) return;
    setPhone(qPhone);
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await apiRequest<any>(
        `/customers/lookup?phone=${encodeURIComponent(qPhone)}`
      );
      const cust = res.data?.customer || res.data;
      const ordList = res.data?.orders || [];
      const retList = res.data?.returns || [];

      if (!cust || (!cust.phone && !cust.customerPhone && ordList.length === 0)) {
        setCustomerInfo(null);
        setOrders([]);
        setReturns([]);
        setErrorMsg(`Không tìm thấy hồ sơ khách hàng hoặc đơn hàng với SĐT "${qPhone}".`);
      } else {
        setCustomerInfo(cust);
        setOrders(Array.isArray(ordList) ? ordList : []);
        setReturns(Array.isArray(retList) ? retList : []);
      }
    } catch (err: any) {
      setCustomerInfo(null);
      setOrders([]);
      setReturns([]);
      setErrorMsg(err?.message || "Không tìm thấy thông tin khách hàng.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh tìm kiếm theo SĐT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Tra cứu Khách hàng theo Số Điện Thoại & Xuất Hóa Đơn PDF
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Nhập số điện thoại khách hàng để xem toàn bộ lịch sử mua hàng, phiếu trả/đổi và in lại hóa đơn PDF (Khổ K80 / A4).
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập SĐT khách hàng (VD: 0901234567)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow"
          >
            <Search className="w-4 h-4" />
            {loading ? "Đang tra cứu..." : "Tra cứu SĐT"}
          </button>
        </form>

        {/* Gợi ý khách hàng đã lưu */}
        {allCustomers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Khách hàng gần đây:
            </span>
            {allCustomers.slice(0, 6).map((c) => {
              const cPhone = c.phone || c.customerPhone;
              const cName = c.fullName || c.name || c.customerName;
              return (
                <button
                  key={c._id || cPhone}
                  type="button"
                  onClick={() => handleLookup(cPhone)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-mono font-semibold text-slate-700 transition"
                >
                  {cName} ({cPhone})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Kết quả Hồ sơ Khách hàng & Lịch sử Đơn hàng */}
      {customerInfo && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xs uppercase text-emerald-400 font-bold">
                  Hồ sơ Khách hàng 11Sport
                </div>
                <div className="text-xl font-extrabold">
                  {customerInfo.fullName || customerInfo.name || customerInfo.customerName}
                </div>
                <div className="font-mono text-sm text-slate-300">
                  SĐT: {customerInfo.phone || customerInfo.customerPhone || phone}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">Tổng số đơn đã mua</div>
                <div className="text-2xl font-mono font-extrabold text-white">
                  {orders.length} đơn
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Tổng chi tiêu tích lũy</div>
                <div className="text-2xl font-mono font-extrabold text-emerald-400">
                  {formatVND(
                    orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bảng danh sách đơn hàng của khách */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              Lịch sử Đơn hàng ({orders.length})
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Khách hàng chưa có đơn hàng nào.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900 text-white text-xs uppercase">
                    <tr>
                      <th className="py-3 px-4">Mã Đơn</th>
                      <th className="py-3 px-4">Ngày mua</th>
                      <th className="py-3 px-4">Chi tiết sản phẩm</th>
                      <th className="py-3 px-4">Thanh toán</th>
                      <th className="py-3 px-4 text-right">Phí thẻ 3%</th>
                      <th className="py-3 px-4 text-right">Tổng tiền</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Xuất PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {orders.map((ord) => (
                      <tr key={ord._id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {ord.orderCode || ord.code}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {formatDateTime(ord.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {ord.items?.map((it, i) => (
                            <div key={i} className="text-slate-800">
                              • {it.productName} (×{it.quantity})
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">
                          {ord.paymentMethod}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-amber-700">
                          {formatVND(ord.cardFee)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                          {formatVND(ord.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              ord.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : ord.status === "PARTIALLY_RETURNED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {ord.status === "PAID"
                              ? "Đã thanh toán"
                              : ord.status === "PARTIALLY_RETURNED"
                              ? "Đã trả 1 phần"
                              : "Đã trả toàn bộ"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                          >
                            <Printer className="w-3.5 h-3.5" /> In PDF (K80/A4)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lịch sử trả / đổi hàng nếu có */}
          {returns.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-3">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                Lịch sử Phiếu Trả / Đổi Hàng ({returns.length})
              </h3>
              <div className="space-y-2">
                {returns.map((ret) => (
                  <div
                    key={ret._id}
                    className="p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900">
                        {ret.returnCode || ret.code}
                      </span>{" "}
                      — Đơn gốc:{" "}
                      <span className="font-mono font-semibold">{ret.orderCode}</span>
                    </div>
                    <div className="text-slate-600">
                      Loại: <strong>{ret.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}</strong> ·
                      Chênh lệch:{" "}
                      <span className="font-mono font-bold">
                        {formatVND(ret.netDifference)}
                      </span>
                    </div>
                    <div className="text-slate-400">{formatDateTime(ret.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

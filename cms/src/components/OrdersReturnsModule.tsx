"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Order,
  ReturnReceipt,
  apiRequest,
  formatVND,
  formatDateTime,
  formatPhone,
  useDebounce,
  filterAndRankBySearch,
} from "@/lib/api";
import { Search, Printer, ShoppingBag, RotateCcw, CheckCircle2, Trash2 } from "lucide-react";
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
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Debounce từ khóa tìm kiếm (400ms) để tránh gọi API liên tục trên từng phím gõ
  const debouncedSearch = useDebounce(search, 400);

  const loadData = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      if (statusFilter) q.set("status", statusFilter);
      if (paymentFilter) q.set("paymentMethod", paymentFilter);

      const retQ = new URLSearchParams();
      if (debouncedSearch.trim()) retQ.set("search", debouncedSearch.trim());

      const [ordRes, retRes] = await Promise.all([
        apiRequest<Order[]>(`/orders?${q.toString()}`),
        apiRequest<ReturnReceipt[]>(
          `/returns${retQ.toString() ? `?${retQ.toString()}` : ""}`
        ),
      ]);
      setOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
      setReturns(Array.isArray(retRes.data) ? retRes.data : []);
    } catch {
      // ignore
    }
  }, [debouncedSearch, statusFilter, paymentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmDraft = async (ord: Order) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Xác nhận chốt thanh toán cho hóa đơn nháp ${ord.orderCode || ord.code} (${formatVND(
          ord.totalAmount
        )})? Hệ thống sẽ thực hiện trừ tồn Kho Tầng 1.`
      )
    ) {
      return;
    }
    setActionMsg(null);
    try {
      const res = await apiRequest<Order>(`/orders/${ord._id}/confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setActionMsg({
        type: "success",
        text: `Đã chốt thanh toán hóa đơn ${res.data.orderCode} và trừ tồn Kho Tầng 1 thành công!`,
      });
      loadData();
      onOpenInvoice(res.data);
    } catch (err: any) {
      setActionMsg({
        type: "error",
        text: err?.message || "Không thể chốt thanh toán hóa đơn nháp.",
      });
    }
  };

  const handleDeleteDraft = async (ord: Order) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xóa hóa đơn nháp ${ord.orderCode || ord.code}?`)
    ) {
      return;
    }
    setActionMsg(null);
    try {
      await apiRequest(`/orders/${ord._id}`, { method: "DELETE" });
      setActionMsg({
        type: "success",
        text: `Đã xóa hóa đơn nháp ${ord.orderCode || ord.code}.`,
      });
      loadData();
    } catch (err: any) {
      setActionMsg({
        type: "error",
        text: err?.message || "Không thể xóa hóa đơn nháp.",
      });
    }
  };

  // Lọc tức thì trên client trong lúc chờ Debounce API
  const displayedOrders = useMemo(() => {
    if (!search.trim()) return orders;
    return filterAndRankBySearch(orders, search, (o) => [
      { text: o.orderCode || o.code, weight: 1.6 },
      { text: o.customerPhone, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      { text: o.createdByName || o.soldByName, weight: 0.9 },
      ...(o.items || []).flatMap((i) => [
        { text: i.productCode, weight: 1.2 },
        { text: i.productName, weight: 1.1 },
      ]),
    ]);
  }, [orders, search]);

  const displayedReturns = useMemo(() => {
    if (!search.trim()) return returns;
    return filterAndRankBySearch(returns, search, (r) => [
      { text: r.code || r.returnCode, weight: 1.6 },
      { text: r.orderCode, weight: 1.5 },
      { text: r.customerPhone, weight: 1.5 },
      { text: r.customerName, weight: 1.3 },
      { text: r.performedByName, weight: 0.9 },
      { text: r.note, weight: 0.8 },
    ]);
  }, [returns, search]);

  return (
    <div className="space-y-6">
      {/* Bộ lọc Đơn hàng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              Quản lý Toàn bộ Đơn hàng POS, Bản Nháp & Xuất Hóa Đơn PDF
            </h3>
            <p className="text-xs text-slate-500">
              Tra cứu theo mã đơn, SĐT khách hàng, phương thức thanh toán, quản lý bản nháp và mở bản in PDF (Khổ K80 / A4).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportExcelButton
              label="Xuất Excel (kèm chi tiết)"
              onExport={() => exportOrders(displayedOrders)}
              disabled={displayedOrders.length === 0}
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
              <option value="DRAFT">DRAFT (Bản nháp)</option>
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
              <option value="OTHER">Khác (OTHER)</option>
            </select>
          </div>
        </div>

        {actionMsg && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold border ${actionMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
              }`}
          >
            {actionMsg.text}
          </div>
        )}

        {/* Bảng Đơn hàng */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3">Mã Đơn</th>
                <th className="py-3 px-3">Khách hàng (SĐT)</th>
                <th className="py-3 px-3">Sản phẩm mua</th>
                <th className="py-3 px-3">Thanh toán</th>
                <th className="py-3 px-3">Người tạo / Chốt</th>
                <th className="py-3 px-3 text-right">Tiền hàng</th>
                <th className="py-3 px-3 text-right">Giảm giá</th>
                <th className="py-3 px-3 text-right">Phí thẻ 3%</th>
                <th className="py-3 px-3 text-right">Tổng thu</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác / PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedOrders.map((ord) => {
                const totalDisc =
                  (Number(ord.itemDiscountTotal) || 0) +
                  (Number(ord.billDiscountAmount) || 0);
                return (
                  <tr key={ord._id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {ord.orderCode || ord.code}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {formatDateTime(ord.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{ord.customerName}</div>
                      <div className="font-mono text-slate-500">{formatPhone(ord.customerPhone) || "-"}</div>
                    </td>
                    <td className="py-3 px-3">
                      {ord.items?.map((it, idx) => {
                        const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
                        return (
                          <div key={idx} className="text-slate-700 flex items-center gap-1 flex-wrap">
                            <span>
                              • {it.productName} (×{it.quantity})
                            </span>
                            {isGift && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                🎁 Hàng tặng
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      <div>{ord.paymentMethod}</div>
                      {ord.paymentMethod === "OTHER" && ord.paymentMethodDetail && (
                        <div className="text-[10px] font-normal text-indigo-700">
                          ({ord.paymentMethodDetail})
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      <div>
                        <span className="text-[10px] text-slate-400">Tạo: </span>
                        <span>{ord.createdByName || ord.soldByName || "-"}</span>
                      </div>
                      {ord.status !== "DRAFT" ? (
                        <div className="text-[11px] text-emerald-700">
                          <span className="text-[10px] text-slate-400">Chốt: </span>
                          <span>{ord.confirmedByName || ord.createdByName || "-"}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700 font-normal">
                          (Chưa chốt TT)
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatVND(ord.rawSubtotal || ord.subtotal)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-700">
                      {totalDisc > 0 ? `-${formatVND(totalDisc)}` : "0 VND"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700">
                      {formatVND(ord.cardFee)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                      {formatVND(ord.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${ord.status === "DRAFT"
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                          : ord.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : ord.status === "PARTIALLY_RETURNED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                          }`}
                      >
                        {ord.status === "DRAFT" ? "DRAFT (Nháp)" : ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {ord.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirmDraft(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                              title="Chốt thanh toán & trừ kho Tầng 1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Chốt đơn
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(ord)}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 inline-flex items-center"
                              title="Xóa bản nháp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(ord)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> PDF (K80/A4)
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng Phiếu Trả / Đổi Hàng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Danh sách Phiếu Trả / Đổi Hàng ({displayedReturns.length})
          </h3>
          <ExportExcelButton onExport={() => exportReturns(displayedReturns)} disabled={displayedReturns.length === 0} />
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
                <th className="py-3 px-3">NV xử lý</th>
                <th className="py-3 px-3">Ghi chú</th>
                <th className="py-3 px-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedReturns.map((r) => (
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
                  <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    {r.performedByName || "-"}
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

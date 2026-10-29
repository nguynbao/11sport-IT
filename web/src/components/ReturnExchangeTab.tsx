"use client";

import React, { useState, useEffect } from "react";
import {
  Order,
  Product,
  ReturnReceipt,
  apiRequest,
  formatVND,
  formatDateTime,
} from "@/lib/api";
import {
  Search,
  RotateCcw,
  ArrowLeftRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ReturnItemForm {
  productId: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  maxReturnable: number;
  quantity: number;
  condition: "GOOD" | "DAMAGED";
}

interface ExchangeItemForm {
  product: Product;
  quantity: number;
}

export default function ReturnExchangeTab() {
  const [orderCodeInput, setOrderCodeInput] = useState("");
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sellableProducts, setSellableProducts] = useState<Product[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnReceipt[]>([]);

  // Form trả/đổi
  const [mode, setMode] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANKING" | "CARD">("CASH");
  const [note, setNote] = useState("");
  const [returnRows, setReturnRows] = useState<ReturnItemForm[]>([]);
  const [exchangeRows, setExchangeRows] = useState<ExchangeItemForm[]>([]);
  const [selectedExchangeProductId, setSelectedExchangeProductId] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadInitialLists = async () => {
    try {
      const [ordRes, prodRes, retRes] = await Promise.all([
        apiRequest<Order[]>("/orders"),
        apiRequest<Product[]>("/products?onlySellable=true"),
        apiRequest<ReturnReceipt[]>("/returns"),
      ]);
      setRecentOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
      const prods = Array.isArray(prodRes.data)
        ? prodRes.data.filter(
            (p) => p.sellingPrice > 0 && (Number(p.stockFloor1 ?? p.stock) || 0) > 0
          )
        : [];
      setSellableProducts(prods);
      if (prods.length > 0) setSelectedExchangeProductId(prods[0]._id);
      setRecentReturns(Array.isArray(retRes.data) ? retRes.data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadInitialLists();
  }, []);

  const prepareOrderForReturn = (ord: Order) => {
    setSelectedOrder(ord);
    setOrderCodeInput(ord.orderCode || ord.code || "");
    setErrorMsg("");
    setSuccessMsg("");

    const rows: ReturnItemForm[] = (ord.items || []).map((it) => {
      const alreadyReturned = Number(it.returnedQuantity || 0);
      const maxReturnable = Math.max(0, Number(it.quantity) - alreadyReturned);
      return {
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        unitPrice: Number(it.unitPrice),
        maxReturnable,
        quantity: 0,
        condition: "GOOD",
      };
    });
    setReturnRows(rows);
    setExchangeRows([]);
  };

  const handleSearchOrder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = orderCodeInput.trim();
    if (!code) return;

    setLoading(true);
    setErrorMsg("");
    try {
      // Thử tra theo endpoint /orders/by-code/:code trước, nếu không có thì lọc từ /orders
      try {
        const res = await apiRequest<Order>(
          `/orders/by-code/${encodeURIComponent(code)}`
        );
        if (res.data) {
          prepareOrderForReturn(res.data);
          return;
        }
      } catch {
        // Fallback tìm trong danh sách đơn hàng
      }

      const listRes = await apiRequest<Order[]>(
        `/orders?search=${encodeURIComponent(code)}`
      );
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const found = list.find(
        (o) =>
          (o.orderCode || o.code || "").toUpperCase() === code.toUpperCase() ||
          o._id === code
      );
      if (!found) {
        setSelectedOrder(null);
        setErrorMsg(`Không tìm thấy đơn hàng với mã "${code}".`);
      } else {
        prepareOrderForReturn(found);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tra cứu đơn hàng gốc.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExchangeProduct = () => {
    if (!selectedExchangeProductId) return;
    const prod = sellableProducts.find((p) => p._id === selectedExchangeProductId);
    if (!prod) return;
    const floor1Stock = Number(prod.stockFloor1 ?? prod.stock) || 0;

    setExchangeRows((prev) => {
      const existing = prev.find((r) => r.product._id === prod._id);
      if (existing) {
        if (existing.quantity + 1 > floor1Stock) return prev;
        return prev.map((r) =>
          r.product._id === prod._id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
  };

  // Tính toán tài chính theo BR-16 (Trên đơn giá gốc, không hoàn phí thẻ 3%)
  const returnTotal = returnRows.reduce(
    (sum, r) => sum + r.unitPrice * r.quantity,
    0
  );
  const exchangeTotal =
    mode === "EXCHANGE"
      ? exchangeRows.reduce(
          (sum, r) => sum + r.product.sellingPrice * r.quantity,
          0
        )
      : 0;
  const netDifference = exchangeTotal - returnTotal;

  const handleSubmitReturnExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg("");
    setSuccessMsg("");

    const activeReturns = returnRows.filter((r) => r.quantity > 0);
    if (activeReturns.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm cần trả (số lượng > 0).");
      return;
    }

    if (mode === "EXCHANGE" && exchangeRows.length === 0) {
      setErrorMsg(
        "Bạn đang chọn chế độ ĐỔI HÀNG. Vui lòng chọn ít nhất 1 sản phẩm mới muốn đổi sang."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrder._id,
        type: mode,
        refundMethod,
        note:
          note.trim() ||
          (mode === "EXCHANGE" ? "Khách đổi hàng tại quầy" : "Khách trả hàng tại quầy"),
        returnItems: activeReturns.map((r) => ({
          productId: r.productId,
          quantity: r.quantity,
          condition: r.condition,
        })),
        exchangeItems:
          mode === "EXCHANGE"
            ? exchangeRows.map((ex) => ({
                productId: ex.product._id,
                quantity: ex.quantity,
              }))
            : [],
      };

      const res = await apiRequest<any>("/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdReturn = res.data?.returnExchange || res.data;
      setSuccessMsg(
        `Đã xử lý phiếu ${
          createdReturn?.returnCode || createdReturn?.code || "Trả/Đổi"
        } thành công! Tồn kho và trạng thái đơn gốc đã được cập nhật.`
      );
      await loadInitialLists();
      // Làm mới lại đơn gốc
      await handleSearchOrder();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi xác nhận phiếu Trả/Đổi hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Khung tìm đơn hàng gốc */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Trả Hàng & Đổi Hàng Tại Quầy (BR-14, BR-15, BR-16)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Nhập mã đơn hàng cần trả/đổi. Hệ thống kiểm tra số lượng đã mua/đã trả, cộng lại kho cho hàng{" "}
          <strong>Còn bán được (GOOD)</strong> và tính tiền trên giá gốc sản phẩm (không hoàn phí thẻ 3%).
        </p>

        <form onSubmit={handleSearchOrder} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={orderCodeInput}
              onChange={(e) => setOrderCodeInput(e.target.value)}
              placeholder="Nhập Mã đơn hàng gốc (VD: DH-0001)..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm"
          >
            {loading ? "Đang kiểm tra..." : "Kiểm tra Đơn hàng"}
          </button>
        </form>

        {/* Chọn nhanh từ các đơn gần đây */}
        {recentOrders.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Chọn nhanh đơn hàng gần đây:
            </span>
            {recentOrders.slice(0, 6).map((o) => {
              const code = o.orderCode || o.code || o._id;
              return (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => prepareOrderForReturn(o)}
                  className="min-h-[36px] max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-mono font-bold text-slate-700"
                >
                  {code} ({o.customerName})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Chi tiết xử lý Trả / Đổi khi đã chọn đơn gốc */}
      {selectedOrder && (
        <form
          onSubmit={handleSubmitReturnExchange}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 space-y-4 sm:space-y-6"
        >
          {/* Header thông tin đơn gốc */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase text-slate-500">
                Đơn hàng gốc đang chọn
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-slate-900 break-words">
                {selectedOrder.orderCode || selectedOrder.code} — {selectedOrder.customerName} (
                {selectedOrder.customerPhone})
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Ngày mua: {formatDateTime(selectedOrder.createdAt)} · Tiền hàng:{" "}
                <strong className="font-mono">{formatVND(selectedOrder.subtotal)}</strong> · Phí
                thẻ 3%:{" "}
                <strong className="font-mono">{formatVND(selectedOrder.cardFee)}</strong> (Không
                hoàn phí thẻ khi trả/đổi)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 lg:shrink-0">
              <button
                type="button"
                onClick={() => setMode("RETURN")}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  mode === "RETURN"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                <RotateCcw className="w-4 h-4" /> TRẢ HÀNG HOÀN TIỀN
              </button>
              <button
                type="button"
                onClick={() => setMode("EXCHANGE")}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  mode === "EXCHANGE"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" /> ĐỔI SANG SẢN PHẨM MỚI
              </button>
            </div>
          </div>

          {/* 1. Bảng chọn sản phẩm trả lại & tình trạng hàng */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">
              1. Chọn sản phẩm khách trả lại & Tình trạng hàng (GOOD / DAMAGED):
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
              <table className="w-full min-w-[820px] text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Sản phẩm trong đơn</th>
                    <th className="py-2.5 px-3 text-right">Đơn giá gốc</th>
                    <th className="py-2.5 px-3 text-center">Còn có thể trả</th>
                    <th className="py-2.5 px-3 text-center w-32">Số lượng trả</th>
                    <th className="py-2.5 px-3 w-64">Tình trạng hàng trả về (BR-15)</th>
                    <th className="py-2.5 px-3 text-right">Thành tiền hoàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {returnRows.map((row, idx) => (
                    <tr key={row.productId} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{row.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {row.productCode}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        {formatVND(row.unitPrice)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {row.maxReturnable}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={row.maxReturnable}
                          disabled={row.maxReturnable === 0}
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Math.min(
                              row.maxReturnable,
                              Math.max(0, Number(e.target.value))
                            );
                            setReturnRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, quantity: val } : r
                              )
                            );
                          }}
                          className="w-20 min-h-[40px] px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-bold"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <select
                          disabled={row.quantity === 0}
                          value={row.condition}
                          onChange={(e) =>
                            setReturnRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      condition: e.target.value as "GOOD" | "DAMAGED",
                                    }
                                  : r
                              )
                            )
                          }
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
                        >
                          <option value="GOOD">
                            Còn bán được (GOOD) — Cộng lại Kho
                          </option>
                          <option value="DAMAGED">
                            Hỏng / Lỗi (DAMAGED) — Không cộng Kho
                          </option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                        {formatVND(row.unitPrice * row.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Nếu là ĐỔI HÀNG: Chọn sản phẩm mới từ kho */}
          {mode === "EXCHANGE" && (
            <div className="space-y-3 bg-emerald-50/50 p-3 sm:p-4 rounded-xl border border-emerald-200">
              <h3 className="font-bold text-slate-900 text-sm">
                2. Chọn sản phẩm mới xuất kho đổi cho khách:
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <select
                  value={selectedExchangeProductId}
                  onChange={(e) => setSelectedExchangeProductId(e.target.value)}
                  className="w-full sm:flex-1 min-w-0 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                >
                  {sellableProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — Giá: {formatVND(p.sellingPrice)} (Tồn: {p.stock})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddExchangeProduct}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Thêm sản phẩm đổi
                </button>
              </div>

              {exchangeRows.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-w-full">
                  <table className="w-full min-w-[560px] text-xs text-left">
                    <thead className="bg-slate-800 text-white uppercase">
                      <tr>
                        <th className="py-2 px-3">Sản phẩm đổi mới</th>
                        <th className="py-2 px-3 text-right">Đơn giá</th>
                        <th className="py-2 px-3 text-center w-28">Số lượng</th>
                        <th className="py-2 px-3 text-right">Thành tiền</th>
                        <th className="py-2 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {exchangeRows.map((ex, i) => (
                        <tr key={ex.product._id}>
                          <td className="py-2 px-3 font-semibold">
                            {ex.product.name}{" "}
                            <span className="font-mono text-slate-500">
                              ({ex.product.code})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatVND(ex.product.sellingPrice)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={ex.product.stock}
                              value={ex.quantity}
                              onChange={(e) => {
                                const val = Math.min(
                                  ex.product.stock,
                                  Math.max(1, Number(e.target.value))
                                );
                                setExchangeRows((prev) =>
                                  prev.map((r, idx) =>
                                    idx === i ? { ...r, quantity: val } : r
                                  )
                                );
                              }}
                              className="w-16 min-h-[40px] px-2 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {formatVND(ex.product.sellingPrice * ex.quantity)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExchangeRows((prev) =>
                                  prev.filter((_, idx) => idx !== i)
                                )
                              }
                              className="w-10 h-10 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. Hình thức thanh toán hoàn/thu & Tổng kết tiền chênh lệch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Hình thức thanh toán hoàn / thu thêm
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) =>
                    setRefundMethod(e.target.value as "CASH" | "BANKING" | "CARD")
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANKING">Chuyển khoản (BANKING)</option>
                  <option value="CARD">Thẻ (CARD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Ghi chú lý do Trả / Đổi
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Đổi size rộng hơn / Hàng lỗi đường may..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-xl space-y-2">
              <div className="flex justify-between gap-2 text-xs text-slate-300">
                <span>Tổng giá trị hàng trả lại (Giá gốc):</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatVND(returnTotal)}
                </span>
              </div>
              {mode === "EXCHANGE" && (
                <div className="flex justify-between gap-2 text-xs text-slate-300">
                  <span>Tổng giá trị hàng đổi mới:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatVND(exchangeTotal)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-700 flex flex-wrap justify-between items-center gap-x-2 gap-y-1">
                <span className="text-sm font-extrabold uppercase">
                  {netDifference > 0
                    ? "Khách cần trả thêm:"
                    : netDifference < 0
                    ? "Cửa hàng hoàn lại khách:"
                    : "Chênh lệch thanh toán:"}
                </span>
                <span
                  className={`font-mono text-xl font-extrabold ${
                    netDifference > 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {formatVND(Math.abs(netDifference))}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] mt-3 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg"
              >
                {submitting
                  ? "Đang xử lý..."
                  : mode === "EXCHANGE"
                  ? "XÁC NHẬN PHIẾU ĐỔI HÀNG"
                  : "XÁC NHẬN PHIẾU TRẢ HÀNG & HOÀN TIỀN"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Danh sách phiếu trả/đổi gần đây */}
      {recentReturns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-3">
            Lịch sử Phiếu Trả / Đổi Hàng gần đây
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
            <table className="w-full min-w-[760px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Mã Phiếu</th>
                  <th className="py-2.5 px-3">Đơn gốc</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3 text-right">Tiền hàng trả</th>
                  <th className="py-2.5 px-3 text-right">Tiền hàng đổi</th>
                  <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentReturns.slice(0, 8).map((r) => (
                  <tr key={r._id}>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {r.returnCode || r.code}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{r.orderCode}</td>
                    <td className="py-2.5 px-3 font-bold">
                      {r.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatVND(r.returnTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatVND(r.exchangeTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {r.netDifference < 0
                        ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                        : r.netDifference > 0
                        ? `Thu thêm ${formatVND(r.netDifference)}`
                        : "0 ₫"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

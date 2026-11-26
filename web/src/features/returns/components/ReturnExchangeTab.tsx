"use client";

import React from "react";
import {
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatDateTime,
  formatPhone,
} from "@/shared/utils/format";
import {
  Search,
  RotateCcw,
  ArrowLeftRight,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Tag,
} from "lucide-react";
import { exchangeUnitPrice, getExchangeItemPricing } from "../types";
import { useReturnExchange } from "../hooks/useReturnExchange";

export default function ReturnExchangeTab() {
  const {
    orderCodeInput,
    setOrderCodeInput,
    selectedOrder,
    recentReturns,
    mode,
    refundMethod,
    setRefundMethod,
    note,
    setNote,
    returnRows,
    setReturnRows,
    exchangeRows,
    setExchangeRows,
    exchangeSearch,
    setExchangeSearch,
    loading,
    loadingProducts,
    submitting,
    errorMsg,
    successMsg,
    reloadSellableProducts,
    exchangeOptions,
    filteredExchangeOptions,
    selectedQtyByOptionKey,
    matchingRecentOrders,
    prepareOrderForReturn,
    handleSearchOrder,
    handleAddExchangeOption,
    handleChangeExchangeDiscount,
    handleChangeExchangeDesiredPrice,
    handleExchangeSearchKeyDown,
    serverCalc,
    localCalc,
    returnSubtotal,
    refundedCardFee,
    returnTotal,
    exchangeRawSubtotal,
    exchangeDiscountTotal,
    exchangeTotal,
    netDifference,
    refundAmount,
    debtBefore,
    debtReduction,
    cashRefund,
    debtAfter,
    handleSubmitReturnExchange,
  } = useReturnExchange();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Khung tìm đơn hàng gốc */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Đổi Hàng Tại Quầy (BR-15, BR-16)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Nhập mã đơn hàng cần đổi sang sản phẩm mới. Hệ thống kiểm tra số lượng đã mua/đã đổi, cộng lại kho cho hàng{" "}
          <strong>Còn bán được (GOOD)</strong> và tự động tính chênh lệch giá khi đổi sản phẩm.
        </p>

        <form onSubmit={handleSearchOrder} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={orderCodeInput}
              onChange={(e) => setOrderCodeInput(e.target.value)}
              placeholder="Nhập Mã đơn hàng gốc (VD: HD-0162)..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
          >
            {loading ? "Đang kiểm tra..." : "Kiểm tra Đơn hàng"}
          </button>
        </form>

        {/* Chọn nhanh từ các đơn gần đây (hoặc khớp từ khóa đang gõ) */}
        {matchingRecentOrders.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              {orderCodeInput.trim() ? "Đơn hàng khớp tìm kiếm:" : "Chọn nhanh đơn hàng gần đây:"}
            </span>
            {matchingRecentOrders.map((o) => {
              const code = o.orderCode || o.code || o._id;
              return (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => prepareOrderForReturn(o)}
                  className="min-h-[36px] max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-brand-ink text-xs font-mono font-bold text-slate-700"
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
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-brand-ink text-xs font-semibold flex items-center gap-2">
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
                {selectedOrder.orderCode || selectedOrder.code} — {selectedOrder.customerName}
                {selectedOrder.customerPhone ? ` (${formatPhone(selectedOrder.customerPhone)})` : ""}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Ngày mua: {formatDateTime(selectedOrder.createdAt)} · Tiền hàng:{" "}
                  <strong className="font-mono">{formatVND(selectedOrder.subtotal)}</strong>
                </span>
                {Number(selectedOrder.billDiscountAmount) > 0 && (
                  <span className="text-amber-700 font-semibold">
                    · Giảm giá Bill:{" "}
                    <strong className="font-mono">
                      -{formatVND(Number(selectedOrder.billDiscountAmount))}
                    </strong>
                  </span>
                )}
                <span>
                  · Giá Bill thực thu:{" "}
                  <strong className="font-mono text-brand-ink">
                    {formatVND(Number(selectedOrder.totalAmount) || Math.max(0, Number(selectedOrder.subtotal || 0) - Number(selectedOrder.billDiscountAmount || 0)))}
                  </strong>
                </span>
                <span>
                  · Phí thẻ:{" "}
                  <strong className="font-mono">{formatVND(selectedOrder.cardFee)}</strong>{" "}
                  {Number(selectedOrder.cardFee) > 0 ? (
                    <span className="text-brand-ink font-semibold">
                      (Có hoàn lại phí thẻ cho khách khi trả/đổi)
                    </span>
                  ) : (
                    <span>(Không thu phí thẻ)</span>
                  )}
                </span>
                {Number(selectedOrder.debtAmount) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold">
                    Đang còn công nợ: {formatVND(Number(selectedOrder.debtAmount))} (Sẽ ưu tiên cấn trừ vào nợ khi hoàn trả)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 lg:shrink-0">
              <span className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow">
                <ArrowLeftRight className="w-4 h-4" /> ĐỔI SANG SẢN PHẨM MỚI
              </span>
            </div>
          </div>

          {/* 1. Bảng chọn sản phẩm đổi & tình trạng hàng */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                1. Chọn sản phẩm khách mang đổi &amp; Tình trạng hàng (GOOD / DAMAGED):
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReturnRows((prev) =>
                      prev.map((r) => ({ ...r, quantity: r.maxReturnable }))
                    )
                  }
                  disabled={returnRows.every((r) => r.maxReturnable === 0)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-brand-ink border border-blue-200 text-xs font-bold disabled:opacity-50"
                >
                  Chọn đổi toàn bộ đơn
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReturnRows((prev) => prev.map((r) => ({ ...r, quantity: 0 })))
                  }
                  disabled={returnRows.every((r) => r.quantity === 0)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
                >
                  Đặt lại về 0
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
              <table className="w-full min-w-[840px] text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Sản phẩm trong đơn</th>
                    <th className="py-2.5 px-3 text-right">Giá niêm yết / Giá bán</th>
                    <th className="py-2.5 px-3 text-center">Còn có thể trả</th>
                    <th className="py-2.5 px-3 text-center w-40">Số lượng trả</th>
                    <th className="py-2.5 px-3 w-64">Tình trạng hàng trả về (BR-15)</th>
                    <th className="py-2.5 px-3 text-right">Thành tiền hoàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {returnRows.map((row, idx) => (
                    <tr
                      key={`${row.lineIndex}-${row.productId}-${row.color}-${row.size}`}
                      className={row.quantity > 0 ? "bg-blue-50/40" : "hover:bg-slate-50"}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{row.productName}</span>
                          {row.isGift && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              🎁 Hàng tặng
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>{row.productCode}</span>
                          {(row.color || row.size) && (
                            <span className="font-sans text-[11px] font-semibold text-brand-ink">
                              {[
                                row.color ? `Màu: ${row.color}` : "",
                                row.size ? `Size: ${row.size}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        {(() => {
                          const effUnit = localCalc.unitRefundPrices[idx] ?? row.unitPrice;
                          const hasBillOrItemDisc = !row.isGift && Math.max(row.originalUnitPrice, row.unitPrice) > effUnit;
                          return (
                            <div>
                              {hasBillOrItemDisc && (
                                <div className="line-through text-slate-400 text-[11px]">
                                  {formatVND(Math.max(row.originalUnitPrice, row.unitPrice))}
                                </div>
                              )}
                              <div className="font-bold text-brand-ink">
                                {formatVND(effUnit)}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-brand-ink">
                        {row.maxReturnable}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={row.quantity <= 0}
                            onClick={() =>
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, quantity: Math.max(0, r.quantity - 1) } : r
                                )
                              )
                            }
                            className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={row.maxReturnable}
                            disabled={row.maxReturnable === 0}
                            value={row.quantity}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = Math.min(
                                row.maxReturnable,
                                Math.max(0, Number(e.target.value) || 0)
                              );
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, quantity: val } : r
                                )
                              );
                            }}
                            className="w-16 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                          />
                          <button
                            type="button"
                            disabled={row.quantity >= row.maxReturnable}
                            onClick={() =>
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                      ...r,
                                      quantity: Math.min(r.maxReturnable, r.quantity + 1),
                                    }
                                    : r
                                )
                              )
                            }
                            className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                        {formatVND(localCalc.lineRefundTotals[idx] ?? row.unitPrice * row.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Nếu là ĐỔI HÀNG: Tìm kiếm & chọn sản phẩm mới từ Kho Tầng 1 */}
          {mode === "EXCHANGE" && (
            <div className="space-y-3 bg-blue-50/50 p-3 sm:p-4 rounded-xl border border-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    2. Tìm & chọn sản phẩm mới xuất kho đổi cho khách (Kho Tầng 1):
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Gõ tên sản phẩm, mã SP, mã vạch / mã biến thể, màu sắc hoặc size để tìm nhanh (hoặc quét mã vạch và nhấn Enter).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadSellableProducts}
                  disabled={loadingProducts}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? "animate-spin" : ""}`} />
                  {loadingProducts ? "Đang tải..." : "Làm mới tồn kho"}
                </button>
              </div>

              {/* Ô Input Search sản phẩm để đổi */}
              <div className="relative">
                <Search className="w-4 h-4 text-brand-ink absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={exchangeSearch}
                  onChange={(e) => setExchangeSearch(e.target.value)}
                  onKeyDown={handleExchangeSearchKeyDown}
                  placeholder="Tìm sản phẩm đổi theo tên, mã SP, mã vạch, màu sắc, size..."
                  className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-blue-300 bg-white text-sm font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
                {exchangeSearch && (
                  <button
                    type="button"
                    onClick={() => setExchangeSearch("")}
                    className="w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 absolute right-2 top-1.5 rounded-lg hover:bg-slate-100"
                    title="Xóa từ khóa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Danh sách kết quả gợi ý sản phẩm đổi */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="font-semibold">
                    {exchangeSearch.trim()
                      ? `Kết quả khớp "${exchangeSearch.trim()}" (${filteredExchangeOptions.length})`
                      : `Gợi ý sản phẩm sẵn sàng xuất đổi tại Kho Tầng 1 (${exchangeOptions.length} phân loại)`}
                  </span>
                  {exchangeSearch.trim() && filteredExchangeOptions.length > 0 && (
                    <span className="text-brand-ink font-semibold hidden sm:inline">
                      Nhấn Enter để thêm nhanh kết quả đầu tiên
                    </span>
                  )}
                </div>

                {loadingProducts && exchangeOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Đang tải danh sách sản phẩm Kho Tầng 1...
                  </div>
                ) : filteredExchangeOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {exchangeSearch.trim()
                      ? `Không tìm thấy sản phẩm nào tại Kho Tầng 1 khớp với "${exchangeSearch.trim()}".`
                      : "Hiện không có sản phẩm nào còn tồn khả dụng tại Kho Tầng 1."}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {filteredExchangeOptions.map((opt) => {
                      const chosenQty = selectedQtyByOptionKey.get(opt.optionKey) || 0;
                      const outOfRemaining = chosenQty >= opt.stockFloor1;
                      return (
                        <div
                          key={opt.optionKey}
                          className="px-3 py-2.5 hover:bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{opt.product.name}</span>
                              {opt.color && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800">
                                  {opt.colorHexes.length > 0 && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                      style={{ backgroundColor: opt.colorHexes[0] }}
                                    />
                                  )}
                                  Màu: {opt.color}
                                </span>
                              )}
                              {opt.size && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-brand-ink">
                                  Size: {opt.size}
                                </span>
                              )}
                              {chosenQty > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-brand-ink text-[10px] font-extrabold">
                                  Đã chọn: {chosenQty}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="font-mono font-semibold text-slate-700">
                                {opt.variantCode}
                              </span>
                              {opt.product.brand && <span>· {opt.product.brand}</span>}
                              {opt.product.categoryName && (
                                <span>· {opt.product.categoryName}</span>
                              )}
                              <span className="text-brand-ink font-semibold">
                                · Tồn T1: {opt.directFloor1}
                                {opt.unpackableFloor1 > 0
                                  ? ` (+${opt.unpackableFloor1} tách bộ)`
                                  : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="font-mono font-extrabold text-xs sm:text-sm text-brand-ink">
                              {formatVND(exchangeUnitPrice(opt))}
                            </span>
                            <button
                              type="button"
                              disabled={outOfRemaining}
                              onClick={() => handleAddExchangeOption(opt)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {outOfRemaining ? "Đã tối đa tồn" : "Chọn đổi"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bảng sản phẩm đổi mới đã chọn */}
              {exchangeRows.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-blue-300 bg-white/80 text-center text-xs text-slate-600">
                  Chưa có sản phẩm đổi mới nào được chọn. Hãy gõ tìm sản phẩm ở ô phía trên và bấm{" "}
                  <strong>+ Chọn đổi</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-w-full">
                  <table className="w-full min-w-[780px] text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Sản phẩm đổi mới đã chọn</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá</th>
                        <th className="py-2.5 px-3">Giảm giá / Nhập giá muốn bán</th>
                        <th className="py-2.5 px-3 text-center w-36">Số lượng đổi</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {exchangeRows.map((ex, i) => {
                        const pricing = getExchangeItemPricing(ex);
                        return (
                          <tr key={ex.optionKey} className="align-top">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{ex.displayName}</div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {ex.variantCode || ex.product.code} · Tối đa khả dụng: {ex.stockFloor1}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {pricing.discountPerUnit > 0 ? (
                                <div>
                                  <div className="line-through text-slate-400 text-[11px]">
                                    {formatVND(pricing.originalUnitPrice)}
                                  </div>
                                  <div className="font-bold text-brand-ink">
                                    {formatVND(pricing.unitPrice)}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-semibold">
                                  {formatVND(pricing.originalUnitPrice)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-[260px]">
                                <select
                                  value={ex.discountType}
                                  onChange={(e) => {
                                    const val = e.target.value as
                                      | "NONE"
                                      | "PERCENT"
                                      | "AMOUNT";
                                    handleChangeExchangeDiscount(
                                      ex.optionKey,
                                      val,
                                      0,
                                      val,
                                      ""
                                    );
                                  }}
                                  className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold"
                                >
                                  <option value="NONE">Không giảm</option>
                                  <option value="PERCENT">Giảm theo %</option>
                                  <option value="AMOUNT">Giảm tiền (VND/SP)</option>
                                </select>

                                {ex.discountType === "PERCENT" && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={ex.discountValue || ""}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.preventDefault();
                                      }}
                                      onChange={(e) =>
                                        handleChangeExchangeDiscount(
                                          ex.optionKey,
                                          "PERCENT",
                                          Number(e.target.value),
                                          "PERCENT"
                                        )
                                      }
                                      placeholder="0"
                                      className="w-16 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                                    />
                                    <span className="font-bold text-rose-700">%</span>
                                  </div>
                                )}

                                {ex.discountType === "AMOUNT" &&
                                  ex.discountInputMode !== "PRICE" && (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={
                                          ex.discountValue > 0
                                            ? formatNumberDots(ex.discountValue)
                                            : ""
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") e.preventDefault();
                                        }}
                                        onChange={(e) =>
                                          handleChangeExchangeDiscount(
                                            ex.optionKey,
                                            "AMOUNT",
                                            parseNumberDots(e.target.value),
                                            "AMOUNT"
                                          )
                                        }
                                        placeholder="Số tiền giảm"
                                        className="w-28 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                                      />
                                      <span className="font-bold text-rose-700 text-[10px]">
                                        đ/SP
                                      </span>
                                    </div>
                                  )}

                                {/* Ô input nhập giá muốn bán luôn hiển thị trực tiếp */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      ex.discountInputMode === "PRICE" &&
                                        ex.customPriceText !== undefined
                                        ? ex.customPriceText
                                        : pricing.discountAmount > 0
                                          ? formatNumberDots(pricing.unitPrice)
                                          : ""
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.preventDefault();
                                    }}
                                    onChange={(e) =>
                                      handleChangeExchangeDesiredPrice(
                                        ex.optionKey,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Nhập giá muốn bán"
                                    className="w-36 px-2.5 py-1 rounded border border-blue-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 font-mono font-bold text-right text-xs bg-white text-blue-900 placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
                                  />
                                  <span className="text-[10px] font-bold text-slate-500">
                                    đ/SP
                                  </span>
                                </div>

                                {pricing.discountAmount > 0 && (
                                  <span className="font-mono text-[11px] font-bold text-rose-600">
                                    (−{formatVND(pricing.discountAmount)})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={ex.quantity <= 1}
                                  onClick={() =>
                                    setExchangeRows((prev) =>
                                      prev.map((r, idx) =>
                                        idx === i
                                          ? { ...r, quantity: Math.max(1, r.quantity - 1) }
                                          : r
                                      )
                                    )
                                  }
                                  className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={ex.stockFloor1}
                                  value={ex.quantity}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.preventDefault();
                                  }}
                                  onChange={(e) => {
                                    const val = Math.min(
                                      ex.stockFloor1,
                                      Math.max(1, Number(e.target.value) || 1)
                                    );
                                    setExchangeRows((prev) =>
                                      prev.map((r, idx) =>
                                        idx === i ? { ...r, quantity: val } : r
                                      )
                                    );
                                  }}
                                  className="w-14 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                                />
                                <button
                                  type="button"
                                  disabled={ex.quantity >= ex.stockFloor1}
                                  onClick={() =>
                                    setExchangeRows((prev) =>
                                      prev.map((r, idx) =>
                                        idx === i
                                          ? {
                                            ...r,
                                            quantity: Math.min(ex.stockFloor1, r.quantity + 1),
                                          }
                                          : r
                                      )
                                    )
                                  }
                                  className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              <div>{formatVND(pricing.lineTotal)}</div>
                              {pricing.discountAmount > 0 && (
                                <div className="text-[11px] font-bold text-rose-600">
                                  −{formatVND(pricing.discountAmount)}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setExchangeRows((prev) =>
                                    prev.filter((_, idx) => idx !== i)
                                  )
                                }
                                className="w-9 h-9 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                                title="Xóa dòng đổi"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="VD: Đổi size rộng hơn / Hàng lỗi đường may..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 text-slate-800 p-4 sm:p-5 rounded-xl space-y-2">
              <div className="flex justify-between gap-2 text-xs text-slate-600">
                <span>
                  Tiền hàng trả lại
                  {Number(selectedOrder.billDiscountAmount) > 0
                    ? " (đã phân bổ giảm giá Bill)"
                    : ""}
                  :
                </span>
                <span className="font-mono font-bold text-amber-700">
                  {formatVND(returnSubtotal)}
                </span>
              </div>
              {Number(selectedOrder.cardFee) > 0 && (
                <div className="flex justify-between gap-2 text-xs text-brand-ink">
                  <span>
                    Hoàn lại phí quẹt thẻ
                    {selectedOrder.cardFeePercent ? ` (${selectedOrder.cardFeePercent}%)` : ""}:
                  </span>
                  <span className="font-mono font-bold">
                    +{formatVND(refundedCardFee)}
                  </span>
                </div>
              )}
              {refundedCardFee > 0 && (
                <div className="flex justify-between gap-2 text-xs text-slate-700">
                  <span>Tổng giá trị hoàn từ đơn cũ:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatVND(returnTotal)}
                  </span>
                </div>
              )}
              {mode === "EXCHANGE" && (
                <>
                  {exchangeDiscountTotal > 0 && (
                    <div className="flex justify-between gap-2 text-xs text-rose-600 font-semibold">
                      <span>
                        Giảm giá hàng đổi mới (Giá niêm yết: {formatVND(exchangeRawSubtotal)}):
                      </span>
                      <span className="font-mono font-bold">
                        −{formatVND(exchangeDiscountTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 text-xs text-slate-700">
                    <span>Tổng giá trị hàng đổi mới (sau giảm):</span>
                    <span className="font-mono font-bold text-brand-ink">
                      {formatVND(exchangeTotal)}
                    </span>
                  </div>
                </>
              )}
              <div className="pt-2 border-t border-blue-200 flex flex-wrap justify-between items-center gap-x-2 gap-y-1">
                <span className="text-sm font-extrabold uppercase text-slate-900">
                  {netDifference > 0
                    ? "Khách cần trả thêm:"
                    : netDifference < 0
                      ? "Tổng tiền hoàn trả (refundAmount):"
                      : "Chênh lệch thanh toán:"}
                </span>
                <span
                  className={`font-mono text-xl font-extrabold ${netDifference > 0 ? "text-brand-ink" : "text-amber-700"
                    }`}
                >
                  {formatVND(Math.abs(netDifference))}
                </span>
              </div>

              {/* Hiển thị chi tiết cấn trừ công nợ & tiền thực hoàn cho khách khi đơn gốc có nợ */}
              {(debtBefore > 0 || debtReduction > 0) && netDifference < 0 && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-800 uppercase text-[11px]">
                    Phân bổ hoàn trả cho đơn đang có công nợ ({formatVND(debtBefore)}):
                  </div>
                  <div className="flex justify-between gap-2 text-slate-700">
                    <span>1. Tổng tiền hoàn trả (refundAmount):</span>
                    <span className="font-mono font-bold text-amber-700">
                      {formatVND(refundAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-purple-700">
                    <span>
                      2. Cấn trừ vào công nợ đơn gốc (Nợ còn lại: {formatVND(debtAfter)}):
                    </span>
                    <span className="font-mono font-extrabold">
                      -{formatVND(debtReduction)}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-amber-200 flex justify-between gap-2 text-brand-ink text-sm">
                    <span className="font-extrabold">
                      3. Thực hoàn tiền mặt/CK cho khách (cashRefund):
                    </span>
                    <span className="font-mono font-extrabold text-brand-ink">
                      {formatVND(cashRefund)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] mt-3 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg"
              >
                {submitting
                  ? "Đang xử lý..."
                  : mode === "EXCHANGE"
                    ? "XÁC NHẬN PHIẾU ĐỔI HÀNG"
                    : debtReduction > 0 && cashRefund === 0
                      ? "XÁC NHẬN TRẢ HÀNG & CẤN TRỪ CÔNG NỢ"
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
                  <th className="py-2.5 px-3 text-right">Chênh lệch / Hoàn trả</th>
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
                      <div>{formatVND(r.returnTotal)}</div>
                      {Number(r.refundedCardFee) > 0 && (
                        <div className="text-[10px] text-brand-ink font-sans font-semibold">
                          (gồm phí thẻ {formatVND(Number(r.refundedCardFee))})
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatVND(r.exchangeTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <div>
                        {r.netDifference < 0
                          ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                          : r.netDifference > 0
                            ? `Thu thêm ${formatVND(r.netDifference)}`
                            : "0 ₫"}
                      </div>
                      {r.netDifference < 0 && Number(r.debtReduction) > 0 && (
                        <div className="text-[10px] font-sans font-semibold text-purple-700 mt-0.5 space-y-0.5">
                          <div>
                            • Cấn trừ nợ: -{formatVND(Number(r.debtReduction))}
                            {r.debtAfter !== undefined
                              ? ` (Còn nợ: ${formatVND(Number(r.debtAfter))})`
                              : ""}
                          </div>
                          <div className="text-brand-ink">
                            • Thực hoàn tiền: {formatVND(Number(r.cashRefund ?? 0))}
                          </div>
                        </div>
                      )}
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

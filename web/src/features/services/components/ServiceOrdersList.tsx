"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatPhone } from "@/shared/utils/format";
import { Search, Calendar, Clock, AlertTriangle, Printer, RefreshCw, Eye, Wallet, PackageCheck } from "lucide-react";
import {
  STATUS_BADGE_MAP,
  formatShortDate,
} from "../types";

export default function ServiceOrdersList({ s }: { s: PosServiceState }) {
  const {
    billDiscountAmount,
    cardFee,
    cardFeePercent,
    customerName,
    customerPhone,
    displayedOrders,
    fetchServiceOrders,
    handleConfirmReturnPaidReadyOrder,
    handleOpenCollectReadyOrder,
    itemDiscountTotal,
    loadingOrders,
    note,
    orderSearch,
    ordersMeta,
    setOrderSearch,
    setPrintOrder,
    setStatusFilter,
    statusFilter,
    submittingCollect,
    totalAmount,
  } = s;

  return (
    <>
          <div className="p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Theo Dõi Trạng Thái Đơn Dịch Vụ</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-brand-ink border border-blue-200">
                    <Eye className="w-3 h-3" /> Chế độ quan sát (Sales)
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Admin cập nhật tiến độ xử lý trên CMS. Khi đơn <strong>Đã xong (Chờ lấy)</strong>, Sales có thể xác nhận lấy tiền &amp; trả đồ cho khách.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchServiceOrders}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                Làm mới
              </button>
            </div>

            {/* Thẻ thống kê nhanh */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold text-brand-ink">Tiếp nhận / Đang làm</div>
                <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                  {ordersMeta.receivedCount + ordersMeta.inProgressCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-bold text-brand-ink">Đã xong (Chờ lấy)</div>
                <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                  {ordersMeta.readyCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Quá hạn hẹn trả
                </div>
                <div className="text-lg font-extrabold text-red-700 mt-0.5">
                  {ordersMeta.overdueCount} đơn
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-600">Đã trả khách</div>
                <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {ordersMeta.returnedCount} đơn
                </div>
              </div>
            </div>

            {/* Tìm kiếm & Lọc trạng thái */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Tìm theo SĐT, tên khách, mã đơn DV-0001, tên vợt..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "ACTIVE_ONLY", label: "Đang xử lý & Chờ lấy" },
                { id: "RECEIVED", label: "Đã tiếp nhận" },
                { id: "IN_PROGRESS", label: "Đang xử lý" },
                { id: "READY", label: "Đã xong (Chờ lấy)" },
                { id: "OVERDUE", label: `⚠️ Quá hạn (${ordersMeta.overdueCount})` },
                { id: "RETURNED", label: "Đã trả khách" },
                { id: "ALL", label: "Tất cả" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${statusFilter === tab.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Danh sách thẻ đơn dịch vụ */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {loadingOrders ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Đang tải danh sách đơn dịch vụ...
                </div>
              ) : displayedOrders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Không có đơn dịch vụ nào khớp với bộ lọc hiện tại.
                </div>
              ) : (
                displayedOrders.map((ord) => {
                  const badge = STATUS_BADGE_MAP[ord.status] || STATUS_BADGE_MAP.RECEIVED;
                  const totalDisc =
                    (Number(ord.itemDiscountTotal) || 0) +
                    (Number(ord.billDiscountAmount) || 0);
                  const ordCardFee = Number(ord.cardFee) || 0;

                  return (
                    <div
                      key={ord._id}
                      className={`p-3.5 rounded-xl border transition ${ord.isOverdue
                        ? "border-red-300 bg-red-50/30"
                        : "border-slate-200 bg-white hover:border-blue-400"
                        }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-600 text-white">
                              {ord.orderCode}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900">
                              {ord.customerName}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-600">
                              • {formatPhone(ord.customerPhone)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Ngày gửi: <strong>{formatShortDate(ord.receivedAt)}</strong>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 ${ord.isOverdue ? "text-red-600 font-extrabold" : ""
                                }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Hẹn trả: <strong>{formatShortDate(ord.dueAt)}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {ord.isOverdue && (
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Quá hạn hẹn trả
                            </span>
                          )}
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết dịch vụ trong đơn */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                        {(ord.items || []).map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="text-slate-800">
                              <span className="font-bold">{it.serviceName}</span>{" "}
                              <span className="text-slate-500">
                                ({it.quantity} {it.unit} × {formatVND(it.unitPrice)}
                                {(Number(it.discountAmount) || 0) > 0
                                  ? ` - Giảm ${formatVND(it.discountAmount)}`
                                  : ""}
                                )
                              </span>
                              {it.itemNote && (
                                <span className="ml-1.5 text-brand-ink font-medium">
                                  — {it.itemNote}
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {formatVND(it.lineTotal)}
                            </span>
                          </div>
                        ))}
                        {(totalDisc > 0 || ordCardFee > 0) && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 text-slate-600">
                            {totalDisc > 0 && (
                              <span className="text-amber-700 font-semibold">
                                Tổng giảm giá: -{formatVND(totalDisc)}
                              </span>
                            )}
                            {ordCardFee > 0 && (
                              <span className="text-brand-ink font-semibold">
                                Phí quẹt thẻ ({ord.cardFeePercent || 1.8}%): +
                                {formatVND(ordCardFee)}
                              </span>
                            )}
                          </div>
                        )}
                        {ord.note && (
                          <div className="text-[11px] text-slate-500 italic">
                            Ghi chú: {ord.note}
                          </div>
                        )}
                      </div>

                      {/* Tổng tiền & Trạng thái thanh toán + Nút In phiếu */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span>
                            Tổng:{" "}
                            <strong className="font-mono text-slate-900">
                              {formatVND(ord.totalAmount)}
                            </strong>
                          </span>
                          <span>
                            Đã thu:{" "}
                            <strong className="font-mono text-brand-ink">
                              {formatVND(ord.paidAmount)}
                            </strong>
                          </span>
                          {ord.remainingAmount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              Còn thu: {formatVND(ord.remainingAmount)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200 font-bold">
                              Đã thu đủ
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {ord.status === "READY" && ord.remainingAmount > 0 && (
                            <button
                              type="button"
                              disabled={submittingCollect}
                              onClick={() => handleOpenCollectReadyOrder(ord)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Xác nhận lấy tiền &amp; Trả đồ
                            </button>
                          )}
                          {ord.status === "READY" && ord.remainingAmount <= 0 && (
                            <button
                              type="button"
                              disabled={submittingCollect}
                              onClick={() => handleConfirmReturnPaidReadyOrder(ord)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Xác nhận trả đồ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPrintOrder(ord)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" /> In phiếu (2 liên)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
    </>
  );
}

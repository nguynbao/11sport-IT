"use client";

import React from "react";
import { Order } from "@/shared/types";
import { formatVND, formatDateTime, formatPhone } from "@/shared/utils/format";
import { Search, Printer, ShoppingBag, RotateCcw, CheckCircle2, Trash2, Eye } from "lucide-react";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { exportOrders } from "../exports";

interface OrdersTableSectionProps {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  debtFilter: string;
  setDebtFilter: (v: string) => void;
  actionMsg: { type: "success" | "error"; text: string } | null;
  displayedOrders: Order[];
  ordPage: number;
  ordPageSize: number;
  ordTotal: number;
  ordTotalPages: number;
  setOrdPage: (p: number) => void;
  setOrdPageSize: (s: number) => void;
  canReturn: boolean;
  onSelectOrder: (ord: Order) => void;
  onOpenInvoice: (ord: Order) => void;
  onOpenReturn: (ord: Order) => void;
  onConfirmDraft: (ord: Order) => void;
  onDeleteDraft: (ord: Order) => void;
}

export function OrdersTableSection({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  paymentFilter,
  setPaymentFilter,
  debtFilter,
  setDebtFilter,
  actionMsg,
  displayedOrders,
  ordPage,
  ordPageSize,
  ordTotal,
  ordTotalPages,
  setOrdPage,
  setOrdPageSize,
  canReturn,
  onSelectOrder: setSelectedOrder,
  onOpenInvoice,
  onOpenReturn: setReturnOrder,
  onConfirmDraft: handleConfirmDraft,
  onDeleteDraft: handleDeleteDraft,
}: OrdersTableSectionProps) {
  return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-ink" />
              Quản lý Toàn bộ Đơn hàng POS, Bản Nháp & Xuất Hóa Đơn PDF
            </h3>
            <p className="text-xs text-slate-500">
              Tra cứu theo mã đơn, SĐT khách hàng, phương thức thanh toán, quản lý bản nháp và mở bản in PDF (Khổ K80 / A4).
            </p>
          </div>

          <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
            <ExportExcelButton
              label="Xuất Excel"
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
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="">Tất cả PTTT</option>
              <option value="CASH">Tiền mặt (CASH)</option>
              <option value="BANKING">Chuyển khoản (BANKING)</option>
              <option value="CARD">Thẻ (CARD)</option>
              <option value="OTHER">Khác / Công nợ (OTHER)</option>
            </select>

            <select
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-amber-300 text-xs bg-amber-50 font-semibold text-amber-900"
            >
              <option value="">Tất cả Công nợ</option>
              <option value="HAS_DEBT">Đang còn nợ</option>
              <option value="OVERDUE">Quá hạn hẹn trả</option>
              <option value="UNPAID">Chưa trả nợ</option>
              <option value="PARTIAL">Đã trả 1 phần</option>
              <option value="SETTLED">Đã tất toán nợ</option>
            </select>
          </div>
        </div>

        {actionMsg && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold border ${actionMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-brand-ink"
              : "bg-red-50 border-red-200 text-red-700"
              }`}
          >
            {actionMsg.text}
          </div>
        )}

        {/* Bảng Đơn hàng */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table data-cards data-no-detail className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3">Mã Đơn</th>
                <th className="py-3 px-3">Khách hàng (SĐT)</th>
                <th className="py-3 px-3">Sản phẩm mua</th>
                <th className="py-3 px-3">Thanh toán</th>
                <th className="py-3 px-3">Người tạo / Chốt</th>
                <th className="py-3 px-3 text-right">Tiền hàng</th>
                <th className="py-3 px-3 text-right">Giảm giá</th>
                <th className="py-3 px-3 text-right">Phí thẻ</th>
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
                const itemsList = ord.items || [];
                const giftCount = itemsList.filter(
                  (it) => Boolean(it.isGift) || it.discountType === "GIFT"
                ).length;
                const paidCount = itemsList.length - giftCount;
                const firstItem = itemsList[0];
                return (
                  <tr
                    key={ord._id}
                    onClick={() => setSelectedOrder(ord)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          {paidCount > 0 ? `${paidCount} sản phẩm` : `${itemsList.length} mặt hàng`}
                        </span>
                        {giftCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            🎁 {giftCount} quà tặng
                          </span>
                        )}
                      </div>
                      {firstItem && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[230px] mt-0.5">
                          {firstItem.productName}
                          {itemsList.length > 1 ? ` (+${itemsList.length - 1})` : ""}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      <div>{ord.paymentMethod}</div>
                      {ord.paymentMethod === "OTHER" && ord.paymentMethodDetail && (
                        <div className="text-[10px] font-normal text-brand-ink">
                          ({ord.paymentMethodDetail})
                        </div>
                      )}
                      {Number(ord.debtAmount || 0) > 0 && (
                        <div className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                          Còn nợ: {formatVND(ord.debtAmount || 0)}
                        </div>
                      )}
                      {ord.debtStatus === "SETTLED" && Number(ord.initialDebtAmount || 0) > 0 && (
                        <div className="mt-1 inline-block px-2 py-0.5 rounded bg-teal-100 text-brand-ink border border-teal-300 text-[10px] font-bold">
                          Đã tất toán nợ
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      <div>
                        <span className="text-[10px] text-slate-400">Tạo: </span>
                        <span>{ord.createdByName || ord.soldByName || "-"}</span>
                      </div>
                      {ord.status !== "DRAFT" ? (
                        <div className="text-[11px] text-brand-ink">
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
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-brand-ink">
                      {formatVND(ord.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${ord.status === "DRAFT"
                          ? "bg-indigo-100 text-brand-ink border border-indigo-300"
                          : ord.status === "PAID"
                            ? "bg-teal-100 text-brand-ink"
                            : ord.status === "PARTIALLY_RETURNED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                          }`}
                      >
                        {ord.status === "DRAFT" ? "DRAFT (Nháp)" : ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div
                        className="inline-flex items-center justify-end gap-1.5 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(ord)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Xem chi tiết đơn hàng"
                        >
                          <Eye className="w-3.5 h-3.5" /> Chi tiết
                        </button>
                        {canReturn &&
                          (ord.status === "PAID" || ord.status === "PARTIALLY_RETURNED") && (
                            <button
                              type="button"
                              onClick={() => setReturnOrder(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold inline-flex items-center gap-1 cursor-pointer"
                              title="Trả hàng hoàn tiền"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Trả hàng
                            </button>
                          )}
                        {ord.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirmDraft(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1"
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
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1"
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
        <PaginationBar
          totalItems={ordTotal}
          page={ordPage}
          totalPages={ordTotalPages}
          pageSize={ordPageSize}
          onPageChange={setOrdPage}
          onPageSizeChange={setOrdPageSize}
          itemLabel="đơn hàng"
        />
      </div>
  );
}

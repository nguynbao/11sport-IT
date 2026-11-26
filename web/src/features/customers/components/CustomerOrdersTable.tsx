"use client";

import React from "react";
import { Printer, ShoppingBag } from "lucide-react";
import type { Order } from "@/shared/types";
import { formatDateTime, formatVND } from "@/shared/utils/format";
import { PaginationBar } from "@/shared/ui/PaginationBar";

interface CustomerOrdersTableProps {
  totalOrdersCount: number;
  pagedOrders: Order[];
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (sz: number) => void;
  onOpenInvoice: (order: Order) => void;
}

export function CustomerOrdersTable({
  totalOrdersCount,
  pagedOrders,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onOpenInvoice,
}: CustomerOrdersTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-brand-ink" />
          {`Lịch sử Đơn hàng (${totalOrdersCount})`}
        </h3>
      </div>

      {totalOrdersCount === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          Khách hàng chưa có đơn hàng nào.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full min-w-[900px] text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-xs uppercase">
                <tr>
                  <th className="py-3 px-4">Mã Đơn</th>
                  <th className="py-3 px-4">Ngày mua</th>
                  <th className="py-3 px-4">Chi tiết sản phẩm</th>
                  <th className="py-3 px-4">Thanh toán</th>
                  <th className="py-3 px-4 text-right">Phí thẻ</th>
                  <th className="py-3 px-4 text-right">Tổng tiền</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Xuất PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedOrders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {ord.orderCode || ord.code}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
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
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-brand-ink whitespace-nowrap">
                      {formatVND(ord.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                          ord.status === "DRAFT"
                            ? "bg-indigo-100 text-brand-ink border border-indigo-300"
                            : ord.status === "PAID"
                              ? "bg-blue-100 text-brand-ink"
                              : ord.status === "PARTIALLY_RETURNED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-700"
                        }`}
                      >
                        {ord.status === "DRAFT"
                          ? "Bản nháp"
                          : ord.status === "PAID"
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
                        className="min-h-[40px] whitespace-nowrap px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" /> In PDF (K80)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            totalItems={totalOrdersCount}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="đơn hàng"
            showAllOption
          />
        </div>
      )}
    </div>
  );
}

import React from "react";
import type { Order } from "@/shared/types";
import { formatDateTime, formatPhone, formatVND } from "@/shared/utils/format";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { Banknote, Landmark, CreditCard, Printer, Eye, Layers } from "lucide-react";
import { formatPaymentMethodLabel, formatShiftBadge } from "../../utils/shiftBills";

interface Props {
  pagedOrders: Order[];
  totalBills: number;
  page: number;
  totalPages: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  setDetailOrder: (o: Order | null) => void;
  onOpenInvoice: (order: Order) => void;
}

export default function ShiftBillsTable({
  pagedOrders,
  totalBills,
  page,
  totalPages,
  pageSize,
  setPage,
  setPageSize,
  setDetailOrder,
  onOpenInvoice,
}: Props) {
  return (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table data-cards className="w-full min-w-[920px] text-xs sm:text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-3.5">Mã Bill</th>
                  <th className="py-3 px-3.5">Giờ tạo / Ca</th>
                  <th className="py-3 px-3.5">Khách hàng</th>
                  <th className="py-3 px-3.5">Sản phẩm trong Bill</th>
                  <th className="py-3 px-3.5">Thanh toán</th>
                  <th className="py-3 px-3.5 text-right">Tổng tiền</th>
                  <th className="py-3 px-3.5 text-center">Trạng thái</th>
                  <th className="py-3 px-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedOrders.map((ord) => {
                  const code = ord.orderCode || ord.code || "";
                  const totalUnits = (ord.items || []).reduce(
                    (s, it) => s + (Number(it.quantity) || 0),
                    0
                  );
                  const debtAmt = Math.max(0, Number(ord.debtAmount) || 0);
                  return (
                    <tr key={ord._id} className="hover:bg-slate-50/90 transition">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {code}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          NV: {ord.confirmedByName || ord.createdByName || "Sales"}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {formatDateTime(ord.confirmedAt || ord.createdAt)}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                          {formatShiftBadge(ord.shiftCode)}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">
                          {ord.customerName || "Khách lẻ"}
                        </div>
                        {ord.customerPhone && (
                          <div className="font-mono text-xs text-slate-500">
                            {formatPhone(ord.customerPhone)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="space-y-0.5">
                          {(ord.items || []).slice(0, 3).map((it, idx) => (
                            <div key={idx} className="text-xs text-slate-800 truncate">
                              • {it.productName}{" "}
                              <strong className="font-mono">×{it.quantity}</strong>
                              {(it.isGift || it.discountType === "GIFT") && (
                                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                  🎁 Tặng
                                </span>
                              )}
                            </div>
                          ))}
                          {(ord.items || []).length > 3 && (
                            <div className="text-[11px] font-semibold text-brand-ink">
                              +{(ord.items || []).length - 3} dòng sản phẩm khác (Tổng {totalUnits} SP)
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                          {ord.paymentMethod === "CASH" && (
                            <Banknote className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {ord.paymentMethod === "BANKING" && (
                            <Landmark className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {ord.paymentMethod === "CARD" && (
                            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          {ord.paymentMethod === "OTHER" && (
                            <Layers className="w-3.5 h-3.5 text-brand-ink" />
                          )}
                          {formatPaymentMethodLabel(ord)}
                        </span>
                        {ord.cardFee > 0 && (
                          <div className="text-[10px] font-mono text-amber-700">
                            Phí thẻ: +{formatVND(ord.cardFee)}
                          </div>
                        )}
                        {debtAmt > 0 && (
                          <div className="text-[10px] font-mono font-bold text-red-600">
                            Nợ: {formatVND(debtAmt)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-brand-ink text-sm">
                          {formatVND(ord.totalAmount)}
                        </div>
                        {((ord.itemDiscountTotal || 0) > 0 ||
                          (ord.billDiscountAmount || 0) > 0) && (
                            <div className="text-[10px] font-mono text-rose-600">
                              Giảm: −
                              {formatVND(
                                (Number(ord.itemDiscountTotal) || 0) +
                                (Number(ord.billDiscountAmount) || 0)
                              )}
                            </div>
                          )}
                      </td>

                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ord.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : ord.status === "PAID"
                              ? "bg-blue-100 text-brand-ink"
                              : ord.status === "PARTIALLY_RETURNED"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-700"
                            }`}
                        >
                          {ord.status === "DRAFT"
                            ? "Bản nháp"
                            : ord.status === "PAID"
                              ? "Đã TT"
                              : ord.status === "PARTIALLY_RETURNED"
                                ? "Trả 1 phần"
                                : "Đã trả hết"}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailOrder(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Xem chi tiết Bill"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="In hoặc xuất PDF hóa đơn (K80)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>In Bill</span>
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
              totalItems={totalBills}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="hoá đơn"
              showAllOption
            />
          </div>
  );
}

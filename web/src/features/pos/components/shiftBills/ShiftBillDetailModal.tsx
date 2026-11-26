import React from "react";
import type { Order } from "@/shared/types";
import { formatDateTime, formatPhone, formatVND } from "@/shared/utils/format";
import { Printer, X, User, Tag, Gift } from "lucide-react";
import { formatPaymentMethodLabel, formatShiftBadge } from "../../utils/shiftBills";

interface Props {
  detailOrder: Order;
  setDetailOrder: (o: Order | null) => void;
  onOpenInvoice: (order: Order) => void;
}

export default function ShiftBillDetailModal({ detailOrder, setDetailOrder, onOpenInvoice }: Props) {
  return (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base text-blue-400">
                    Bill {detailOrder.orderCode || detailOrder.code}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                    {formatShiftBadge(detailOrder.shiftCode)}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Thời gian: {formatDateTime(detailOrder.confirmedAt || detailOrder.createdAt)} ·
                  NV: {detailOrder.confirmedByName || detailOrder.createdByName || "Sales"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-blue-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-brand-ink mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">
                      Khách hàng
                    </div>
                    <div className="font-bold text-slate-900">
                      {detailOrder.customerName || "Khách lẻ"}
                    </div>
                    <div className="font-mono text-xs text-slate-600">
                      SĐT: {formatPhone(detailOrder.customerPhone)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">
                    Hình thức thanh toán
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatPaymentMethodLabel(detailOrder)}
                  </div>
                  {detailOrder.note && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Ghi chú: {detailOrder.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Danh sách mặt hàng trong Bill */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Sản phẩm</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3 text-right">Đơn giá</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailOrder.items || []).map((it, idx) => {
                      const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
                      const origPrice = Number(it.originalUnitPrice ?? it.unitPrice) || 0;
                      const hasDisc = !isGift && origPrice > Number(it.unitPrice);
                      return (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{it.productName}</span>
                              {isGift && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  <Gift className="w-3 h-3" /> Hàng tặng (0đ)
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Mã: {it.productCode}
                              {(it.returnedQuantity || 0) > 0 && (
                                <span className="ml-2 text-rose-600 font-bold">
                                  (Đã trả: {it.returnedQuantity})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {isGift ? (
                              <span className="text-amber-700 font-bold">0 VND</span>
                            ) : hasDisc ? (
                              <div>
                                <div className="line-through text-slate-400 text-[11px]">
                                  {formatVND(origPrice)}
                                </div>
                                <div className="font-bold text-brand-ink">
                                  {formatVND(it.unitPrice)}
                                </div>
                              </div>
                            ) : (
                              <span>{formatVND(it.unitPrice)}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                            {formatVND(it.lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tổng kết tiền trên Bill */}
              <div className="bg-blue-50/70 border border-blue-200 text-slate-800 p-4 rounded-xl space-y-1.5 text-xs">
                {detailOrder.rawSubtotal !== undefined && detailOrder.rawSubtotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng tiền hàng (giá niêm yết):</span>
                    <span className="font-mono">{formatVND(detailOrder.rawSubtotal)}</span>
                  </div>
                )}
                {(detailOrder.itemDiscountTotal || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Giảm giá trên sản phẩm:
                    </span>
                    <span className="font-mono">
                      −{formatVND(detailOrder.itemDiscountTotal || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Tạm tính (Subtotal):</span>
                  <span className="font-mono">{formatVND(detailOrder.subtotal)}</span>
                </div>
                {(detailOrder.billDiscountAmount || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Giảm giá tổng Bill:</span>
                    <span className="font-mono">
                      −{formatVND(detailOrder.billDiscountAmount || 0)}
                    </span>
                  </div>
                )}
                {detailOrder.cardFee > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Phí quẹt thẻ ({detailOrder.cardFeePercent || 1.8}%):</span>
                    <span className="font-mono">+{formatVND(detailOrder.cardFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-blue-200 text-brand-ink">
                  <span>TỔNG THANH TOÁN:</span>
                  <span className="font-mono text-base">
                    {formatVND(detailOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const ord = detailOrder;
                  setDetailOrder(null);
                  onOpenInvoice(ord);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>In / Xuất Hóa Đơn PDF (K80)</span>
              </button>
            </div>
          </div>
        </div>
  );
}

"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND, formatNumberDots, formatPhone, formatDateTime } from "@/shared/utils/format";
import { Printer, X } from "lucide-react";
import {
  STATUS_BADGE_MAP,
  formatShortDate,
} from "../types";

export default function PrintServiceReceipt({ s }: { s: PosServiceState }) {
  const {
    billDiscountAmount,
    cardFee,
    cardFeePercent,
    customerName,
    customerPhone,
    handlePrintServiceReceipt,
    itemDiscountTotal,
    note,
    paymentMethod,
    printOrder,
    rawSubtotal,
    servicePrintRef,
    setPrintOrder,
    subtotal,
    totalAmount,
  } = s;

  return (
    <>
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            {/* Thanh công cụ Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-blue-600 text-white">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">
                  Xem trước Hóa Đơn Dịch Vụ (2 bản: Khách &amp; Shop) — {printOrder.orderCode}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-700/80 border border-white/20 text-xs font-semibold text-white">
                  Khổ K80 (80mm)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("SPLIT_2_BILLS")}
                  title="Tách thành 2 lệnh in riêng biệt để máy in K80 tự động cắt rời Liên 1 và Liên 2"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 !text-white text-xs font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  In 2 Bill (Tự cắt rời)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("COPY_1")}
                  title="Chỉ in Liên 1 (Bản giao khách)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 !text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  In Liên 1 (Khách)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintServiceReceipt("COPY_2")}
                  title="Chỉ in Liên 2 (Bản lưu shop)"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 !text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  In Liên 2 (Shop)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrder(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 !text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vùng hiển thị 2 bản hóa đơn dịch vụ */}
            <div className="p-6 bg-slate-100 max-h-[80vh] overflow-y-auto flex justify-center">
              <div
                ref={servicePrintRef}
                id="service-receipt-print-area"
                className="w-full max-w-[330px] space-y-6"
              >
                {(
                  [
                    {
                      copyIndex: 1,
                      copyBadge: "LIÊN 1: BẢN GIAO KHÁCH",
                      copySub: "Khách hàng giữ phiếu này để đối chiếu khi nhận đồ",
                      isShopCopy: false,
                    },
                    {
                      copyIndex: 2,
                      copyBadge: "LIÊN 2: BẢN LƯU SHOP",
                      copySub: "Cửa hàng giữ / kẹp cùng đồ khách gửi",
                      isShopCopy: true,
                    },
                  ] as const
                ).map((copy, cIdx) => {
                  const statusInfo =
                    STATUS_BADGE_MAP[printOrder.status] || STATUS_BADGE_MAP.RECEIVED;
                  const pmLabel =
                    printOrder.paymentMethod === "BANKING"
                      ? "Chuyển khoản"
                      : printOrder.paymentMethod === "CARD"
                        ? "Quẹt thẻ (Card)"
                        : "Tiền mặt";
                  return (
                    <React.Fragment key={copy.copyIndex}>
                      {cIdx > 0 && (
                        <div className="no-print-cut-line flex items-center gap-2 py-1 text-[11px] font-mono font-bold text-slate-400 select-none">
                          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                          <span>✂ CẮT TẠI ĐÂY (TỰ ĐỘNG TÁCH 2 BẢN KHI IN)</span>
                          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                        </div>
                      )}

                      <div className="service-bill-copy bg-white text-black border border-slate-300 shadow-sm p-3.5 text-[12px]">
                        {/* Header 11Sport giống mẫu Hóa Đơn Bán Hàng */}
                        <div className="text-center border-b-2 border-black pb-2.5 mb-2.5">
                          <div className="flex justify-center mb-1.5">
                            <img
                              data-keep-logo src="/logo-11sport.svg"
                              alt="11Sport Logo"
                              className="h-10 w-auto object-contain"
                            />
                          </div>
                          <p className="text-[11px] font-semibold text-black leading-snug">
                            Địa chỉ: 24 Tố Hữu, P.Hòa Cường, TP. Đà Nẵng
                          </p>
                          <p className="text-[11px] font-bold text-black mt-0.5">
                            Hotline: 076.576.3456
                          </p>
                          <h2 className="font-black uppercase mt-2 tracking-wide text-sm">
                            HÓA ĐƠN / PHIẾU DỊCH VỤ
                          </h2>
                          <div className="mt-1 inline-block px-2.5 py-0.5 border border-black rounded font-extrabold text-[11px] uppercase tracking-wider">
                            {copy.copyBadge}
                          </div>
                          <p className="text-[10px] italic text-black/80 mt-0.5">
                            ({copy.copySub})
                          </p>
                        </div>

                        {/* Thông tin chung & Khách hàng */}
                        <div className="space-y-1 text-xs border-b border-dashed border-black pb-2.5 mb-2.5">
                          <div className="flex justify-between">
                            <span className="font-semibold">Mã phiếu:</span>
                            <span className="font-mono font-black text-sm">
                              {printOrder.orderCode}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày lập:</span>
                            <span className="font-mono">
                              {formatDateTime(
                                printOrder.createdAt || printOrder.receivedAt
                              )}
                            </span>
                          </div>
                          {printOrder.createdByName && (
                            <div className="flex justify-between">
                              <span className="font-semibold">Nhân viên nhận:</span>
                              <span className="font-bold">{printOrder.createdByName}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="font-semibold">Khách hàng:</span>
                            <span className="font-black uppercase">
                              {printOrder.customerName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Số ĐT:</span>
                            <span className="font-mono font-bold">
                              {formatPhone(printOrder.customerPhone)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày gửi đồ:</span>
                            <span className="font-mono font-bold">
                              {formatShortDate(printOrder.receivedAt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Ngày hẹn trả:</span>
                            <span className="font-mono font-black underline">
                              {formatShortDate(printOrder.dueAt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold">Trạng thái:</span>
                            <span className="font-bold">{statusInfo.label}</span>
                          </div>
                        </div>

                        {/* Bảng danh sách dịch vụ */}
                        <table className="w-full text-xs border-collapse mb-3">
                          <thead>
                            <tr className="border-b-2 border-black text-left">
                              <th className="py-1 font-bold">Dịch vụ</th>
                              <th className="py-1 font-bold text-center w-9">SL</th>
                              <th className="py-1 font-bold text-right">Đ.Giá</th>
                              <th className="py-1 font-bold text-right">T.Tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dashed divide-slate-300">
                            {(printOrder.items || []).map((it, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="py-1.5 pr-1">
                                  <div className="font-bold text-black">
                                    {idx + 1}. {it.serviceName}
                                  </div>
                                  {(Number(it.discountAmount) || 0) > 0 && (
                                    <div className="text-[10px] font-semibold text-black mt-0.5">
                                      • Giảm giá dòng: -{formatNumberDots(it.discountAmount)}
                                    </div>
                                  )}
                                  {it.itemNote && (
                                    <div className="text-[11px] font-semibold text-black mt-0.5">
                                      • Ghi chú: {it.itemNote}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 text-center font-mono font-bold">
                                  {it.quantity}
                                </td>
                                <td className="py-1.5 text-right font-mono">
                                  {formatNumberDots(it.unitPrice)}
                                </td>
                                <td className="py-1.5 text-right font-mono font-bold">
                                  {formatNumberDots(it.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Tổng kết thanh toán */}
                        <div className="border-t-2 border-black pt-2 space-y-1 text-xs">
                          {((Number(printOrder.itemDiscountTotal) || 0) > 0 ||
                            (Number(printOrder.billDiscountAmount) || 0) > 0 ||
                            (Number(printOrder.cardFee) || 0) > 0) && (
                              <>
                                <div className="flex justify-between">
                                  <span>Tạm tính:</span>
                                  <span className="font-mono">
                                    {formatVND(
                                      printOrder.rawSubtotal ??
                                      printOrder.subtotal ??
                                      printOrder.totalAmount
                                    )}
                                  </span>
                                </div>
                                {(Number(printOrder.itemDiscountTotal) || 0) +
                                  (Number(printOrder.billDiscountAmount) || 0) >
                                  0 && (
                                    <div className="flex justify-between">
                                      <span>Giảm giá:</span>
                                      <span className="font-mono font-semibold">
                                        -
                                        {formatVND(
                                          (Number(printOrder.itemDiscountTotal) || 0) +
                                          (Number(printOrder.billDiscountAmount) || 0)
                                        )}
                                      </span>
                                    </div>
                                  )}
                                {(Number(printOrder.cardFee) || 0) > 0 && (
                                  <div className="flex justify-between">
                                    <span>
                                      Phí quẹt thẻ ({printOrder.cardFeePercent || 1.8}%):
                                    </span>
                                    <span className="font-mono font-semibold">
                                      +{formatVND(printOrder.cardFee)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          <div className="flex justify-between font-bold">
                            <span>Tổng tiền dịch vụ:</span>
                            <span className="font-mono text-sm font-black">
                              {formatVND(printOrder.totalAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Đã thanh toán ({pmLabel}):</span>
                            <span className="font-mono font-bold">
                              {formatVND(printOrder.paidAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed border-black">
                            <span>CÒN PHẢI THU KHI NHẬN:</span>
                            <span className="font-mono">
                              {formatVND(printOrder.remainingAmount)}
                            </span>
                          </div>
                        </div>

                        {printOrder.note && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-400 text-[11px]">
                            <span className="font-bold">Ghi chú phiếu: </span>
                            <span>{printOrder.note}</span>
                          </div>
                        )}

                        {/* Chân chữ ký / đối chiếu tùy theo bản Khách hay bản Shop */}
                        {copy.isShopCopy ? (
                          <div className="mt-3 pt-2 border-t border-dashed border-black text-[11px] space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-center font-bold">
                              <div>
                                <div>KHÁCH HÀNG KÝ GỬI</div>
                                <div className="h-10" />
                                <div className="font-normal text-[10px]">
                                  (Ký &amp; ghi rõ họ tên)
                                </div>
                              </div>
                              <div>
                                <div>NHÂN VIÊN TIẾP NHẬN</div>
                                <div className="h-10" />
                                <div className="font-normal text-[10px]">
                                  {printOrder.createdByName || "(Ký xác nhận)"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-2 border-t border-dashed border-slate-400 text-center text-[11px] space-y-0.5">
                            <p className="font-bold">
                              Quý khách vui lòng mang theo phiếu này khi đến nhận đồ.
                            </p>
                            <p className="font-bold text-black">
                              Cảm ơn Quý khách đã tin tưởng 11Sport!
                            </p>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

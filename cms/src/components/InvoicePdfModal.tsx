"use client";

import React, { useState, useRef } from "react";
import { Order, formatVND, formatDateTime } from "@/lib/api";
import { Printer, X, FileText, Receipt, Download } from "lucide-react";

interface InvoicePdfModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function InvoicePdfModal({ order, onClose }: InvoicePdfModalProps) {
  const [paperSize, setPaperSize] = useState<"K80" | "A4">("K80");
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const orderCode = order.orderCode || order.code || order._id;
  const sellerName =
    order.soldByName ||
    order.createdByName ||
    (typeof order.soldBy === "string" ? order.soldBy : "Nhân viên 11Sport");

  const paymentMethodLabel =
    order.paymentMethod === "CASH"
      ? "Tiền mặt (CASH)"
      : order.paymentMethod === "BANKING"
      ? "Chuyển khoản (BANKING)"
      : `Thẻ (CARD)${order.hasCardFee ? " - Có phí 3%" : " - Không phí"}`;

  const handlePrint = () => {
    if (!printAreaRef.current) {
      window.print();
      return;
    }

    const htmlContent = printAreaRef.current.innerHTML;
    const isK80 = paperSize === "K80";
    const originUrl = typeof window !== "undefined" ? window.location.origin : "";

    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <base href="${originUrl}/" />
        <title>Hoa-don-${orderCode}-${paperSize}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: ${isK80 ? "80mm auto" : "A4 portrait"};
            margin: ${isK80 ? "3mm" : "12mm"};
          }
          body {
            background: #ffffff;
            color: #000000;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .invoice-wrapper {
            width: ${isK80 ? "74mm" : "100%"};
            max-width: ${isK80 ? "74mm" : "794px"};
            box-sizing: border-box;
            color: #000000;
          }
        </style>
      </head>
      <body>
        <div class="invoice-wrapper">
          ${htmlContent}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">
              Xuất / In Hóa Đơn PDF — <span className="font-mono text-emerald-400">{orderCode}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-lg flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaperSize("K80")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  paperSize === "K80"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Receipt className="w-4 h-4" />
                Khổ Bill K80 (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize("A4")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  paperSize === "A4"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4" />
                Khổ Chuẩn A4
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-1.5 shadow"
            >
              <Download className="w-4 h-4" />
              In / Lưu PDF ({paperSize})
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          <div
            ref={printAreaRef}
            className={`bg-white text-black shadow-md border border-slate-300 overflow-hidden ${
              paperSize === "K80"
                ? "w-[360px] p-4 text-[11px]"
                : "w-full max-w-[794px] p-8 text-xs"
            }`}
          >
            {/* Header cửa hàng 11Sport với Logo */}
            <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3 text-black">
              <img
                src="/logo-11sport.png"
                alt="11SPORT"
                className={`mx-auto object-contain mb-1.5 ${
                  paperSize === "K80" ? "h-16 w-auto" : "h-20 w-auto"
                }`}
              />
              <div className="font-semibold text-black text-[11px] leading-snug">
                Địa chỉ: 24 Tố Hữu, P.Hòa Cường, TP. Đà Nẵng
              </div>
              <div className="font-bold text-black text-[11px] leading-snug mt-0.5">
                Hotline: 076.576.3456
              </div>
              <div className="mt-2 font-extrabold uppercase tracking-wider text-xs sm:text-sm text-black">
                HÓA ĐƠN BÁN HÀNG
              </div>
              <div className="font-mono text-[11px] font-semibold text-black mt-0.5">
                Mã đơn: <strong className="font-extrabold">{orderCode}</strong>
              </div>
              <div className="text-black font-medium text-[11px] mt-0.5">
                Ngày giờ: {formatDateTime(order.createdAt)}
              </div>
            </div>

            {/* Thông tin khách hàng & thu ngân */}
            <div className="space-y-1 mb-3 pb-2.5 border-b border-black text-black text-[11px]">
              <div>
                <span className="font-semibold">Khách hàng: </span>
                <span className="font-extrabold">{order.customerName}</span>
              </div>
              <div className="font-mono">
                <span className="font-semibold font-sans">SĐT: </span>
                <span className="font-bold">{order.customerPhone}</span>
              </div>
              <div>
                <span className="font-semibold">Thu ngân / Người bán: </span>
                <span className="font-extrabold">{sellerName}</span>
              </div>
              <div>
                <span className="font-semibold">Thanh toán: </span>
                <span className="font-bold">{paymentMethodLabel}</span>
              </div>
            </div>

            {/* Bảng chi tiết đơn hàng chia hàng chia cột rõ ràng */}
            <div className="mb-3">
              <table className="w-full border-collapse border border-black text-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-[10px] font-extrabold uppercase">
                    <th className="border-r border-black py-1.5 px-1.5 text-left">
                      Mặt hàng
                    </th>
                    <th className="border-r border-black py-1.5 px-1 text-center w-8">
                      SL
                    </th>
                    <th className="border-r border-black py-1.5 px-1.5 text-right whitespace-nowrap">
                      Đơn giá
                    </th>
                    <th className="py-1.5 px-1.5 text-right whitespace-nowrap">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-[11px]">
                  {order.items?.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="border-r border-black py-1.5 px-1.5 font-semibold leading-snug break-words">
                        <div>
                          {idx + 1}. {item.productName}
                        </div>
                        {(Number(item.discountAmount) || 0) > 0 && (
                          <div className="text-[10px] font-bold text-black mt-0.5">
                            (Giảm SP: -{formatVND(item.discountAmount)})
                          </div>
                        )}
                      </td>
                      <td className="border-r border-black py-1.5 px-1 text-center font-mono font-bold">
                        {item.quantity}
                      </td>
                      <td className="border-r border-black py-1.5 px-1.5 text-right font-mono font-semibold whitespace-nowrap">
                        {formatVND(item.unitPrice)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono font-extrabold whitespace-nowrap">
                        {formatVND(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tạm tính, Giảm giá, Phí thẻ & Tổng thanh toán (1 dòng, giảm font-size, chữ đen đậm) */}
            <div className="border-t-2 border-black pt-2 space-y-1 text-black text-[11px]">
              {(Number(order.itemDiscountTotal) || 0) > 0 && (
                <>
                  <div className="flex justify-between items-center whitespace-nowrap gap-2">
                    <span className="font-semibold">Tiền hàng (niêm yết):</span>
                    <span className="font-mono font-bold">
                      {formatVND(order.rawSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center whitespace-nowrap gap-2">
                    <span className="font-semibold">Giảm giá sản phẩm:</span>
                    <span className="font-mono font-bold">
                      -{formatVND(order.itemDiscountTotal)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center whitespace-nowrap gap-2">
                <span className="font-semibold">Tạm tính tiền hàng (Subtotal):</span>
                <span className="font-mono font-bold">
                  {formatVND(order.subtotal)}
                </span>
              </div>

              {(Number(order.billDiscountAmount) || 0) > 0 && (
                <div className="flex justify-between items-center whitespace-nowrap gap-2">
                  <span className="font-semibold">
                    Giảm giá Bill
                    {order.billDiscountType === "PERCENT"
                      ? ` (${order.billDiscountValue}%)`
                      : ""}
                    :
                  </span>
                  <span className="font-mono font-bold">
                    -{formatVND(order.billDiscountAmount)}
                  </span>
                </div>
              )}

              {order.paymentMethod === "CARD" && (
                <div className="flex justify-between items-center whitespace-nowrap gap-2">
                  <span className="font-semibold">
                    Phí quẹt thẻ {order.hasCardFee ? "(3%)" : "(0%)"}:
                  </span>
                  <span className="font-mono font-bold">
                    +{formatVND(order.cardFee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center whitespace-nowrap gap-2 text-xs font-extrabold text-black pt-1.5 border-t border-black">
                <span>TỔNG THANH TOÁN:</span>
                <span className="font-mono text-xs sm:text-[13px] font-black">
                  {formatVND(order.totalAmount)}
                </span>
              </div>
            </div>

            {/* Ghi chú thuế & lời cảm ơn */}
            <div className="mt-4 pt-2.5 border-t border-dashed border-black text-center space-y-1 text-black">
              <div className="italic font-bold text-[11px]">
                Ghi chú: {order.note || "Giá đã bao gồm thuế"}
              </div>
              <div className="text-[10px] font-semibold leading-snug">
                Cảm ơn Quý khách đã mua sắm tại 11Sport! Vui lòng giữ hóa đơn khi cần đổi/trả hàng.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

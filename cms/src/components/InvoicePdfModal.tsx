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
        <title>Hoa-don-${orderCode}-${paperSize}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: ${isK80 ? "80mm auto" : "A4 portrait"};
            margin: ${isK80 ? "4mm" : "12mm"};
          }
          body {
            background: #ffffff;
            color: #0f172a;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
          }
          .invoice-wrapper {
            width: ${isK80 ? "72mm" : "100%"};
            max-width: ${isK80 ? "72mm" : "794px"};
            box-sizing: border-box;
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
            }, 250);
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
            className={`bg-white text-slate-900 shadow-md border border-slate-200 overflow-hidden ${
              paperSize === "K80"
                ? "w-[360px] p-5 text-xs"
                : "w-full max-w-[794px] p-8 text-sm"
            }`}
          >
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
              <div className="font-extrabold tracking-tight text-slate-900 text-lg sm:text-xl">
                11SPORT — THỂ THAO CHÍNH HÃNG
              </div>
              <div className="text-slate-600 mt-1 text-xs">
                Đ/c: Hệ thống Cửa hàng Thể thao 11Sport · Hotline: 1900 1100
              </div>
              <div className="mt-3 font-bold uppercase tracking-wider text-sm sm:text-base text-slate-900">
                HÓA ĐƠN BÁN HÀNG ({paperSize})
              </div>
              <div className="font-mono text-xs text-slate-700 mt-1">
                Mã đơn: <strong>{orderCode}</strong>
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                Ngày giờ: {formatDateTime(order.createdAt)}
              </div>
            </div>

            <div
              className={`grid gap-2 mb-4 pb-3 border-b border-slate-200 ${
                paperSize === "K80" ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              <div>
                <div className="text-slate-500 text-xs">Khách hàng:</div>
                <div className="font-semibold text-slate-900">{order.customerName}</div>
                <div className="font-mono text-slate-700">SĐT: {order.customerPhone}</div>
              </div>
              <div className={paperSize === "K80" ? "" : "text-right"}>
                <div className="text-slate-500 text-xs">Thu ngân / Người bán:</div>
                <div className="font-semibold text-slate-900">{sellerName}</div>
                <div className="text-slate-700">Thanh toán: {paymentMethodLabel}</div>
              </div>
            </div>

            {paperSize === "K80" ? (
              <div className="mb-4">
                <div className="grid grid-cols-12 border-b-2 border-slate-800 pb-1.5 font-bold text-slate-900 text-[11px]">
                  <div className="col-span-5">Mặt hàng</div>
                  <div className="col-span-2 text-center">SL</div>
                  <div className="col-span-2 text-right">Đ.Giá</div>
                  <div className="col-span-3 text-right">T.Tiền</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="py-2.5 space-y-1">
                      <div className="font-semibold text-slate-900 leading-snug break-words">
                        {idx + 1}. {item.productName}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 break-all leading-tight">
                        {item.productCode} {item.unit ? `(${item.unit})` : ""}
                      </div>
                      <div className="grid grid-cols-12 items-center pt-0.5 font-mono text-[11px]">
                        <div className="col-span-5 text-slate-500">Đơn giá × SL:</div>
                        <div className="col-span-2 text-center font-semibold text-slate-900">
                          {item.quantity}
                        </div>
                        <div className="col-span-2 text-right text-slate-700 whitespace-nowrap">
                          {formatVND(item.unitPrice)}
                        </div>
                        <div className="col-span-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatVND(item.lineTotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse mb-4">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left">
                    <th className="py-2 w-8 font-bold">#</th>
                    <th className="py-2 font-bold">Mặt hàng</th>
                    <th className="py-2 w-16 font-bold text-center">SL</th>
                    <th className="py-2 w-28 font-bold text-right">Đơn giá</th>
                    <th className="py-2 w-32 font-bold text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items?.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-2.5 pr-1 font-mono">{idx + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900 break-words">
                          {item.productName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 break-all mt-0.5">
                          {item.productCode} {item.unit ? `(${item.unit})` : ""}
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 text-right font-mono whitespace-nowrap">
                        {formatVND(item.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold whitespace-nowrap">
                        {formatVND(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="border-t-2 border-slate-800 pt-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tổng tiền hàng (Subtotal):</span>
                <span className="font-mono font-semibold whitespace-nowrap">
                  {formatVND(order.subtotal)}
                </span>
              </div>

              {order.paymentMethod === "CARD" && (
                <div className="flex justify-between items-center text-amber-800 bg-amber-50 px-2 py-1 rounded">
                  <span>
                    Phí quẹt thẻ {order.hasCardFee ? "(3% khách chịu)" : "(0% - Miễn phí)"}:
                  </span>
                  <span className="font-mono font-semibold whitespace-nowrap">
                    +{formatVND(order.cardFee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>TỔNG THANH TOÁN:</span>
                <span className="font-mono text-emerald-700 whitespace-nowrap">
                  {formatVND(order.totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-dashed border-slate-300 text-center space-y-1">
              <div className="italic font-semibold text-slate-700">
                Ghi chú: {order.note || "Giá đã bao gồm thuế"}
              </div>
              <div className="text-xs text-slate-500">
                Cảm ơn Quý khách đã mua sắm tại 11Sport! Vui lòng giữ hóa đơn khi cần đổi/trả hàng.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

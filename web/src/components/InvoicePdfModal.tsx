"use client";

import React, { useState, useRef } from "react";
import { Order, formatVND, formatDateTime, formatPhone } from "@/lib/api";
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
        : order.paymentMethod === "OTHER"
          ? `Khác (${order.paymentMethodDetail || "Tùy chọn"})`
          : `Thẻ (CARD)${order.hasCardFee ? " - Có phí 3%" : " - Không phí"}`;

  const getItemCalculatedPricing = (item: Order["items"][number]) => {
    const isGift = Boolean(item.isGift) || item.discountType === "GIFT";
    const qty = Math.max(1, Number(item.quantity) || 1);
    const discAmt = Math.max(0, Number(item.discountAmount) || 0);
    const rawOrigUnit = Number(item.originalUnitPrice) || 0;
    const storedUnit = Number(item.unitPrice) || 0;
    const storedLine = Number(item.lineTotal) || 0;

    // Đơn giá niêm yết trước giảm (hiển thị cột ĐƠN GIÁ):
    // Nếu có giảm giá SP (discAmt > 0), ưu tiên originalUnitPrice (khi > storedUnit);
    // Nếu dữ liệu cũ chỉ có storedUnit là giá sau giảm (rawSubtotal > subtotal), khôi phục đơn giá gốc = storedUnit + discAmt/qty
    const origUnitPrice =
      discAmt > 0
        ? rawOrigUnit > storedUnit
          ? rawOrigUnit
          : storedLine === storedUnit * qty &&
            (Number(order.rawSubtotal) || 0) > (Number(order.subtotal) || 0)
            ? storedUnit + Math.round(discAmt / qty)
            : rawOrigUnit > 0
              ? rawOrigUnit
              : storedUnit
        : rawOrigUnit > 0
          ? rawOrigUnit
          : storedUnit;

    const origLineTotal = origUnitPrice * qty;
    // Thành tiền sau khi trừ giảm giá SP (hiển thị cột THÀNH TIỀN):
    const netLineTotal = Math.max(0, origLineTotal - discAmt);

    return {
      isGift,
      qty,
      discAmt,
      origUnitPrice,
      origLineTotal,
      netLineTotal,
    };
  };

  const calcRawSub =
    (order.items || []).reduce((s, item) => {
      const p = getItemCalculatedPricing(item);
      return p.isGift ? s : s + p.origLineTotal;
    }, 0) ||
    Number(order.rawSubtotal) ||
    Number(order.subtotal) ||
    0;

  const calcItemDisc =
    (order.items || []).reduce((s, item) => {
      const p = getItemCalculatedPricing(item);
      return p.isGift ? s : s + p.discAmt;
    }, 0) ||
    Number(order.itemDiscountTotal) ||
    0;

  const calcSubtotal = Math.max(0, calcRawSub - calcItemDisc);
  const calcBillDisc = Math.max(0, Number(order.billDiscountAmount) || 0);
  const calcAfterBillDisc = Math.max(0, calcSubtotal - calcBillDisc);
  const calcCardFee =
    order.paymentMethod === "CARD" && order.hasCardFee
      ? Number(order.cardFee) || Math.round(calcAfterBillDisc * 0.03)
      : 0;
  const calcTotalAmount = calcAfterBillDisc + calcCardFee;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Thanh công cụ Modal */}
        <div className="bg-slate-900 text-white px-3 py-3 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Printer className="w-5 h-5 shrink-0 text-emerald-400" />
              <h3 className="font-bold text-base sm:text-lg truncate">
                Xuất / In Hóa Đơn PDF — <span className="font-mono text-emerald-400">{orderCode}</span>
                {order.status === "DRAFT" && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-extrabold">
                    BẢN NHÁP
                  </span>
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden w-10 h-10 shrink-0 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Chuyển đổi khổ K80 và A4 */}
            <div className="bg-slate-800 p-1 rounded-lg grid grid-cols-2 sm:flex sm:items-center gap-1">
              <button
                type="button"
                onClick={() => setPaperSize("K80")}
                className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${paperSize === "K80"
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
                className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${paperSize === "A4"
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
              className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow"
            >
              <Download className="w-4 h-4" />
              In / Lưu PDF ({paperSize})
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex w-10 h-10 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vùng hiển thị bản xem trước */}
        <div className="p-2 sm:p-6 overflow-auto bg-slate-100 flex-1">
          <div
            ref={printAreaRef}
            id="printable-invoice"
            className={`mx-auto bg-white text-black shadow-md border border-slate-300 overflow-hidden ${paperSize === "K80"
                ? "w-full max-w-[360px] p-3.5 sm:p-4 text-[11px]"
                : "w-full min-w-[560px] max-w-[794px] p-6 sm:p-8 text-xs"
              }`}
          >
            {/* Header cửa hàng 11Sport với Logo */}
            <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3 text-black">
              <img
                src="/logo-11sport.svg"
                alt="11SPORT"
                className={`mx-auto object-contain mb-1.5 ${paperSize === "K80" ? "h-16 w-auto" : "h-20 w-auto"
                  }`}
              />
              <div className="font-semibold text-black text-[11px] leading-snug">
                Địa chỉ: 24 Tố Hữu, P.Hòa Cường, TP. Đà Nẵng
              </div>
              <div className="font-bold text-black text-[11px] leading-snug mt-0.5">
                Hotline: 076.576.3456
              </div>
              <div className="mt-2 font-extrabold uppercase tracking-wider text-xs sm:text-sm text-black">
                {order.status === "DRAFT" ? "HÓA ĐƠN BÁN HÀNG (BẢN NHÁP)" : "HÓA ĐƠN BÁN HÀNG"}
              </div>
              {order.status === "DRAFT" && (
                <div className="mt-1 inline-block px-2 py-0.5 border border-black text-[10px] font-extrabold uppercase text-black">
                  Bản nháp — Chưa thanh toán
                </div>
              )}
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
                <span className="font-extrabold">{order.customerName || "Khách lẻ"}</span>
              </div>
              <div className="font-mono">
                <span className="font-semibold font-sans">SĐT: </span>
                <span className="font-bold">{formatPhone(order.customerPhone) || "-"}</span>
              </div>
              <div>
                <span className="font-semibold">
                  {order.status === "DRAFT" ? "Người tạo nháp: " : "Người tạo đơn: "}
                </span>
                <span className="font-extrabold">{sellerName}</span>
              </div>
              {order.status !== "DRAFT" && (
                <div>
                  <span className="font-semibold">Người chốt TT: </span>
                  <span className="font-extrabold">
                    {order.confirmedByName || sellerName}
                  </span>
                </div>
              )}
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
                    <th className="border-r border-black py-1.5 px-1.5 text-left align-middle">
                      Mặt hàng
                    </th>
                    <th className="border-r border-black py-1.5 px-1 text-center align-middle w-8">
                      SL
                    </th>
                    <th className="border-r border-black py-1.5 px-1.5 text-center align-middle whitespace-nowrap">
                      Đơn giá
                    </th>
                    <th className="py-1.5 px-1.5 text-center align-middle whitespace-nowrap">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-[11px]">
                  {order.items?.map((item, idx) => {
                    const {
                      isGift,
                      qty,
                      discAmt,
                      origUnitPrice,
                      netLineTotal,
                    } = getItemCalculatedPricing(item);

                    return (
                      <tr key={idx}>
                        <td className="border-r border-black py-1.5 px-1.5 font-semibold leading-snug break-words align-middle">
                          <div>
                            {idx + 1}. {item.productName}
                          </div>
                          {isGift ? (
                            <div className="text-[10px] font-bold text-black mt-0.5">
                              (🎁 Hàng tặng - Không tính tiền)
                            </div>
                          ) : (
                            discAmt > 0 && (
                              <div className="text-[10px] font-bold text-black mt-0.5">
                                (Giảm SP: -{formatVND(discAmt)})
                              </div>
                            )
                          )}
                        </td>
                        <td className="border-r border-black py-1.5 px-1 text-center align-middle font-mono font-bold">
                          {qty}
                        </td>
                        <td className="border-r border-black py-1.5 px-1.5 text-center align-middle font-mono font-semibold whitespace-nowrap">
                          {isGift ? "0 VND" : formatVND(origUnitPrice)}
                        </td>
                        <td className="py-1.5 px-1.5 text-center align-middle font-mono font-extrabold whitespace-nowrap">
                          {isGift ? "0 VND" : formatVND(netLineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tạm tính, Giảm giá, Phí thẻ & Tổng thanh toán (1 dòng, giảm font-size, chữ đen đậm) */}
            <div className="border-t-2 border-black pt-2 space-y-1 text-black text-[11px]">
              {calcItemDisc > 0 && (
                <>
                  <div className="flex justify-between items-center whitespace-nowrap gap-2">
                    <span className="font-semibold">Tiền hàng (niêm yết):</span>
                    <span className="font-mono font-bold">
                      {formatVND(calcRawSub)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center whitespace-nowrap gap-2">
                    <span className="font-semibold">Giảm giá sản phẩm:</span>
                    <span className="font-mono font-bold">
                      -{formatVND(calcItemDisc)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center whitespace-nowrap gap-2">
                <span className="font-semibold">Tạm tính tiền hàng (Subtotal):</span>
                <span className="font-mono font-bold">
                  {formatVND(calcSubtotal)}
                </span>
              </div>

              {calcBillDisc > 0 && (
                <div className="flex justify-between items-center whitespace-nowrap gap-2">
                  <span className="font-semibold">
                    Giảm giá Bill
                    {order.billDiscountType === "PERCENT"
                      ? ` (${order.billDiscountValue}%)`
                      : ""}
                    :
                  </span>
                  <span className="font-mono font-bold">
                    -{formatVND(calcBillDisc)}
                  </span>
                </div>
              )}

              {order.paymentMethod === "CARD" && (
                <div className="flex justify-between items-center whitespace-nowrap gap-2">
                  <span className="font-semibold">
                    Phí quẹt thẻ {order.hasCardFee ? "(3%)" : "(0%)"}:
                  </span>
                  <span className="font-mono font-bold">
                    +{formatVND(calcCardFee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center whitespace-nowrap gap-2 text-xs font-extrabold text-black pt-1.5 border-t border-black">
                <span>
                  {order.status === "DRAFT" ? "TỔNG TẠM TÍNH (NHÁP):" : "TỔNG THANH TOÁN:"}
                </span>
                <span className="font-mono text-xs sm:text-[13px] font-black">
                  {formatVND(calcTotalAmount)}
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

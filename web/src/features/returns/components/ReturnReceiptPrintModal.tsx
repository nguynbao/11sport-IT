"use client";

import React, { useRef } from "react";
import { Printer, Receipt, X } from "lucide-react";
import type { ReturnReceipt } from "@/shared/types";
import { formatDateTime, formatNumberDots, formatPhone, formatVND } from "@/shared/utils/format";

interface Props {
  returnReceipt: ReturnReceipt | null;
  onClose: () => void;
}

export default function ReturnReceiptPrintModal({ returnReceipt, onClose }: Props) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!returnReceipt) return null;

  const r = returnReceipt;
  const code = r.returnCode || r.code || r._id;

  const handlePrint = () => {
    if (!printAreaRef.current) {
      window.print();
      return;
    }

    const htmlContent = printAreaRef.current.innerHTML;
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
        <title>Phieu-doi-hang-${code}-K80</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
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
          .invoice-wrapper { width: 74mm; max-width: 74mm; box-sizing: border-box; color: #000000; }
        </style>
      </head>
      <body>
        <div class="invoice-wrapper">${htmlContent}</div>
        <script>
          setTimeout(function() { window.focus(); window.print(); }, 450);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3.5 bg-blue-600 text-slate-900 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase opacity-80">In Bill Đổi Hàng (K80)</div>
              <div className="font-extrabold text-sm truncate">{code}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-xl hover:bg-black/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-[74mm] max-w-full bg-white p-3 rounded-lg shadow-sm text-[11px] text-slate-900 leading-snug space-y-2"
          >
            <div className="text-center border-b border-dashed border-slate-400 pb-2">
              <div className="text-sm font-black tracking-wide">11 SPORT</div>
              <div className="text-[11px] font-extrabold uppercase mt-0.5">
                {r.type === "EXCHANGE" ? "PHIẾU ĐỔI HÀNG" : "PHIẾU TRẢ HÀNG"}
              </div>
              <div className="font-mono text-[10px] font-bold mt-0.5">
                Mã: {code} • Đơn gốc: {r.orderCode}
              </div>
              <div className="text-[10px] text-slate-600">{formatDateTime(r.createdAt)}</div>
            </div>

            <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
              <div>
                <span className="font-bold">Khách hàng:</span> {r.customerName || "Khách lẻ"}
                {r.customerPhone ? ` (${formatPhone(r.customerPhone)})` : ""}
              </div>
              <div>
                <span className="font-bold">Nhân viên:</span> {r.performedByName || "Nhân viên"}
              </div>
              <div>
                <span className="font-bold">Thanh toán:</span> {r.refundMethod || "CASH"}
              </div>
            </div>

            <div>
              <div className="font-extrabold uppercase text-[10px] border-b border-slate-300 pb-0.5 mb-1">
                Hàng khách trả ({r.returnItems?.length || 0})
              </div>
              <div className="space-y-1">
                {(r.returnItems || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between gap-2 text-[10px]">
                    <div className="min-w-0">
                      <div className="font-semibold">{it.productName}</div>
                      <div className="text-[9px] text-slate-600 font-mono">
                        {it.quantity} × {formatNumberDots(it.unitPrice)}
                        {it.color || it.size ? ` (${[it.color, it.size].filter(Boolean).join("/")})` : ""}
                      </div>
                    </div>
                    <div className="font-mono font-bold shrink-0">
                      {formatNumberDots(it.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(r.exchangeItems) && r.exchangeItems.length > 0 && (
              <div className="pt-1 border-t border-dashed border-slate-400">
                <div className="font-extrabold uppercase text-[10px] border-b border-slate-300 pb-0.5 mb-1">
                  Hàng xuất đổi ({r.exchangeItems.length})
                </div>
                <div className="space-y-1">
                  {r.exchangeItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between gap-2 text-[10px]">
                      <div className="min-w-0">
                        <div className="font-semibold">{it.productName}</div>
                        <div className="text-[9px] text-slate-600 font-mono">
                          {it.quantity} × {formatNumberDots(it.unitPrice)}
                          {it.color || it.size ? ` (${[it.color, it.size].filter(Boolean).join("/")})` : ""}
                        </div>
                      </div>
                      <div className="font-mono font-bold shrink-0">
                        {formatNumberDots(it.lineTotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1.5 border-t border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Tiền hàng trả:</span>
                <span className="font-mono font-bold">{formatVND(r.returnTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tiền hàng đổi:</span>
                <span className="font-mono font-bold">{formatVND(r.exchangeTotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-300">
                <span>
                  {r.netDifference > 0
                    ? "THU THÊM:"
                    : r.netDifference < 0
                      ? "HOÀN KHÁCH:"
                      : "CHÊNH LỆCH:"}
                </span>
                <span className="font-mono">{formatVND(Math.abs(r.netDifference))}</span>
              </div>
              {r.note && (
                <div className="text-[9px] text-slate-600 pt-1">
                  <span className="font-bold">Ghi chú:</span> {r.note}
                </div>
              )}
            </div>

            <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
              Cảm ơn quý khách đã mua hàng tại 11 Sport!
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-slate-900 font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            In Bill (K80)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

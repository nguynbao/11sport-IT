import type { ServiceOrder } from "@/shared/types";

export type ServicePrintMode = "SPLIT_2_BILLS" | "BOTH_2_PAGES" | "COPY_1" | "COPY_2";

export function printServiceReceipt(
  container: HTMLDivElement | null,
  printOrder: ServiceOrder | null,
  mode: ServicePrintMode = "SPLIT_2_BILLS"
) {
    if (!container || !printOrder) return;
    const copyNodes = container.querySelectorAll(".service-bill-copy");
    const copy1Html = copyNodes[0]?.outerHTML || "";
    const copy2Html = copyNodes[1]?.outerHTML || "";
    if (!copy1Html && !copy2Html) return;

    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      window.print();
      return;
    }

    const originUrl = typeof window !== "undefined" ? window.location.origin : "";
    const effectiveMode = mode;

    const initialStep =
      effectiveMode === "SPLIT_2_BILLS" || effectiveMode === "COPY_1"
        ? "1"
        : effectiveMode === "COPY_2"
          ? "2"
          : "all";

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <base href="${originUrl}/" />
          <title>Hóa đơn dịch vụ ${printOrder.orderCode} - ${initialStep === "1"
        ? "Liên 1 (Giao Khách)"
        : initialStep === "2"
          ? "Liên 2 (Lưu Shop)"
          : "2 Bản"
      }</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              margin: 2mm;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .service-print-page {
              width: 74mm;
              max-width: 74mm;
              margin: 0 auto;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .service-bill-copy {
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
            }
            /* Chế độ in tách riêng từng bill (ép máy in nhiệt K80 cắt rời từng bill) */
            body[data-print-step="1"] .bill-page-1 {
              display: block !important;
            }
            body[data-print-step="1"] .bill-page-2 {
              display: none !important;
            }
            body[data-print-step="2"] .bill-page-1 {
              display: none !important;
            }
            body[data-print-step="2"] .bill-page-2 {
              display: block !important;
            }
            /* Chế độ in gộp 2 trang (tách trang chuẩn CSS Paged Media) */
            body[data-print-step="all"] .bill-page-1 {
              display: block !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            body[data-print-step="all"] .bill-page-2 {
              display: block !important;
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
            }
          </style>
        </head>
        <body data-print-step="${initialStep}">
          <div class="service-print-page bill-page-1">
            ${copy1Html}
          </div>
          <div class="service-print-page bill-page-2">
            ${copy2Html}
          </div>
          <script>
            (function() {
              var mode = ${JSON.stringify(effectiveMode)};
              var orderCode = ${JSON.stringify(printOrder.orderCode)};
              var step2Started = false;

              function finishAndClose() {
                setTimeout(function() {
                  window.close();
                }, 300);
              }

              function triggerSecondBillPrint() {
                if (step2Started) return;
                step2Started = true;
                document.body.setAttribute("data-print-step", "2");
                document.title = "Hóa đơn dịch vụ " + orderCode + " - Liên 2 (Lưu Shop)";
                setTimeout(function() {
                  window.focus();
                  window.onafterprint = finishAndClose;
                  window.print();
                  finishAndClose();
                }, 450);
              }

              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  if (mode === "SPLIT_2_BILLS") {
                    window.onafterprint = triggerSecondBillPrint;
                    window.print();
                    triggerSecondBillPrint();
                  } else {
                    window.onafterprint = finishAndClose;
                    window.print();
                    finishAndClose();
                  }
                }, 350);
              };
            })();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
}

import { FIXED_LABEL_CONFIG, getEffectiveNameFontPx } from "./barcodeLabelTypes";
import { escapeHtml, renderCode128PrintSvgFor203Dpi } from "./barcodeLabelCode128";

export interface PrintLabelEntry {
  code: string;
  name: string;
  price: number;
}

export interface BuildPrintHtmlOptions {
  expandedLabels: PrintLabelEntry[];
  shopName: string;
  showShopName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  nameFontSizePx: number;
  wrapProductName: boolean;
}

export function buildBrowserPrintHtml({
  expandedLabels,
  shopName,
  showShopName,
  showProductName,
  showPrice,
  nameFontSizePx,
  wrapProductName
}: BuildPrintHtmlOptions): string {
  const pagesHtml: string[] = [];
  const cols = FIXED_LABEL_CONFIG.columns;

  const svgCache = new Map<string, string>();
  const getSvgForCode = (code: string) => {
    if (!svgCache.has(code)) {
      svgCache.set(
        code,
        renderCode128PrintSvgFor203Dpi(code, FIXED_LABEL_CONFIG.labelWidthMm)
      );
    }
    return svgCache.get(code) || "";
  };

  for (let i = 0; i < expandedLabels.length; i += cols) {
    const rowItems = expandedLabels.slice(i, i + cols);
    const cellsHtml = rowItems
      .map((item) => {
        const svgMarkup = getSvgForCode(item.code);
        const shopHtml = showShopName
          ? `<div class="label-shop">${escapeHtml(shopName)}</div>`
          : "";
        const effectiveNamePx = getEffectiveNameFontPx(item.name, nameFontSizePx);
        const nameFontPt = (effectiveNamePx * 0.35).toFixed(1);
        const nameWrapCss = wrapProductName
          ? "white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;"
          : "white-space: nowrap; text-overflow: ellipsis;";
        const nameHtml = showProductName
          ? `<div class="label-name" style="font-size:${nameFontPt}pt;${nameWrapCss}">${escapeHtml(item.name)}</div>`
          : "";
        const priceHtml =
          showPrice && item.price > 0
            ? `<div class="label-price">${item.price.toLocaleString("vi-VN")} đ</div>`
            : "";

        return `
          <div class="label-cell">
            ${shopHtml}
            ${nameHtml}
            <div class="label-barcode">
              ${svgMarkup}
            </div>
            <div class="label-code">${escapeHtml(item.code)}</div>
            ${priceHtml}
          </div>
        `;
      })
      .join("");

    const emptyCells =
      rowItems.length < cols
        ? Array.from({ length: cols - rowItems.length })
          .map(() => `<div class="label-cell empty"></div>`)
          .join("")
        : "";

    pagesHtml.push(`<div class="label-page">${cellsHtml}${emptyCells}</div>`);
  }

  const safePrintHeightMm = (FIXED_LABEL_CONFIG.pageHeightMm - 0.3).toFixed(1);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>In tem 2 cot 70x20mm - ${escapeHtml(shopName)}</title>
<style>
  @page {
    size: 70mm 20mm;
    margin: 0mm !important;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    width: 70mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: none;
    text-rendering: geometricPrecision;
  }
  .label-page {
    width: 70mm;
    height: ${safePrintHeightMm}mm;
    max-height: ${safePrintHeightMm}mm;
    display: grid;
    grid-template-columns: 34mm 34mm;
    column-gap: 2mm;
    align-items: stretch;
    justify-content: space-between;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    background: #ffffff;
  }
  .label-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .label-cell {
    width: 34mm;
    height: ${safePrintHeightMm}mm;
    padding: 0.15mm 2.2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    overflow: hidden;
    background: #ffffff;
  }
  .label-cell.empty {
    visibility: hidden;
  }
  .label-shop {
    width: 100%;
    flex-shrink: 0;
    font-size: 7.0pt;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 0.35mm solid #000000;
    padding-bottom: 0.15mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label-name {
    width: 100%;
    flex-shrink: 0;
    font-size: 8.2pt;
    font-weight: 800;
    line-height: 1.05;
    max-height: 5.2mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label-barcode {
    width: 100%;
    flex: 1 1 auto;
    min-height: 4.2mm;
    max-height: ${showProductName ? "9.0mm" : "12.0mm"};
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    overflow: hidden;
  }
  .barcode-svg {
    display: block;
    height: 100%;
    shape-rendering: crispEdges;
  }
  .label-code {
    width: 100%;
    flex-shrink: 0;
    font-family: "Courier New", Consolas, monospace;
    font-size: 6.4pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1.05;
    white-space: nowrap;
    overflow: hidden;
  }
  .label-price {
    width: 100%;
    flex-shrink: 0;
    font-size: 9.4pt;
    font-weight: 900;
    line-height: 1.05;
    white-space: nowrap;
  }
</style>
</head>
<body>
${pagesHtml.join("\n")}
</body>
</html>`;
}

export function printHtmlViaIframe(
  iframeRef: { current: HTMLIFrameElement | null },
  htmlContent: string
): void {
  let iframe = iframeRef.current;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    iframeRef.current = iframe;
  }

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe?.contentWindow?.focus();
    iframe?.contentWindow?.print();
  }, 220);
}

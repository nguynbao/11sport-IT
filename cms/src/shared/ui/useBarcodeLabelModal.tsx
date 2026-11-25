import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchFirstOkJson } from "@/shared/api/localFetch";
import { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { generateVariantProductCode, toCompactBarcode128 } from "@/shared/utils/productCode";
import {
  Printer,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Usb,
  Layers,
  MonitorCheck
} from "lucide-react";
import {
  BarcodeLabelItem,
  BarcodeLabelModalProps,
  NormalizedLabelItem,
  SystemPrinterInfo,
  FIXED_LABEL_CONFIG,
  PRINTER_STORAGE_KEY,
  renderCode128PrintSvgFor203Dpi,
  renderCode128SvgString,
  sanitizeAscii,
  escapeHtml,
} from "./barcodeLabelCode128";

export function useBarcodeLabelModal({
  open,
  isOpen,
  onClose,
  items,
  title = "In Tem Nhãn Mã Vạch (70×20mm - 2 cột)",
  shopName = "11 SPORT",
}: BarcodeLabelModalProps) {
  const modalOpen = Boolean(isOpen ?? open);

  const normalizedItems = useMemo<NormalizedLabelItem[]>(() => {
    return (items || []).map((item, idx) => {
      const baseCode = String(item.productCode || item.code || "ITEM").trim();
      const rawCode = String(item.code || item.productCode || "ITEM").trim();
      const hasAttr = Boolean((item.color && item.color.trim()) || (item.size && item.size.trim()));
      // v5.0: ưu tiên mã con do server sinh (item.code). Chỉ tự ghép mã (công thức cũ) khi caller
      // không truyền mã con riêng — tem in đúng nguyên mã, không cắt bớt.
      const hasExplicitChildCode = Boolean(item.code && item.code.trim() && item.code.trim() !== baseCode);
      const code = hasAttr && !hasExplicitChildCode
        ? generateVariantProductCode(baseCode, item.color, item.size)
        : rawCode;
      const name = String(item.name || item.productName || "Sản phẩm").trim();
      const attrLabel = [
        item.color?.trim(),
        item.size?.trim() ? `Size ${item.size.trim().toUpperCase()}` : "",
      ]
        .filter(Boolean)
        .join(" - ");
      const price = Number(item.price ?? item.sellingPrice ?? 0);
      const id = String(item.id ?? `${code}_${idx}`);
      const defaultQty = item.defaultQty && item.defaultQty > 0 ? item.defaultQty : 1;
      return { id, code, baseCode, name, attrLabel, price, defaultQty };
    });
  }, [items]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showShopName, setShowShopName] = useState<boolean>(true);
  const [showProductName, setShowProductName] = useState<boolean>(true);
  // 0 = Tự động co chữ theo độ dài tên; 10..28 = cỡ chữ cố định (px ở 203 DPI)
  const [nameFontSizePx, setNameFontSizePx] = useState<number>(0);
  const [wrapProductName, setWrapProductName] = useState<boolean>(true);

  const getEffectiveNameFontPx = (text: string, customPx: number): number => {
    if (customPx && customPx > 0) {
      return Math.max(10, Math.min(28, customPx));
    }
    const len = (text || "").trim().length;
    if (len <= 14) return 24;
    if (len <= 18) return 21;
    if (len <= 22) return 18;
    if (len <= 28) return 16;
    return 14;
  };

  const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [isScanningPrinters, setIsScanningPrinters] = useState<boolean>(false);
  const [isPrintingDirect, setIsPrintingDirect] = useState<boolean>(false);
  const [printStatusMsg, setPrintStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  const fetchPrintersList = async () => {
    setIsScanningPrinters(true);
    setPrintStatusMsg(null);
    try {
      const endpoints = [
        "http://localhost:4000/api/v1/system/printers",
        "http://localhost:4000/api/v1/printers",
        "/api/printers",
        "/api/v1/system/printers",
        "/api/v1/printers"
      ];
      const { json } = await fetchFirstOkJson<{ data?: { printers?: SystemPrinterInfo[] } }>(
        endpoints,
        { cache: "no-store" },
        (data) => Array.isArray(data?.data?.printers),
        4000
      );
      const list: SystemPrinterInfo[] = json?.data?.printers || [];

      setPrinters(list);

      const savedPrinter =
        typeof window !== "undefined" ? localStorage.getItem(PRINTER_STORAGE_KEY) : null;

      if (savedPrinter && list.some((p) => p.Name === savedPrinter)) {
        setSelectedPrinter(savedPrinter);
      } else {
        const thermalOnline = list.find((p) => p.IsThermal && p.IsOnline);
        const anyThermal = list.find((p) => p.IsThermal);
        const defaultOnline = list.find((p) => p.Default && p.IsOnline);
        const firstOnline = list.find((p) => p.IsOnline);
        const chosen = thermalOnline || anyThermal || defaultOnline || firstOnline || list[0];
        if (chosen) {
          setSelectedPrinter(chosen.Name);
        }
      }
    } catch {
      setPrinters([]);
    } finally {
      setIsScanningPrinters(false);
    }
  };

  useEffect(() => {
    if (modalOpen) {
      const initial: Record<string, number> = {};
      const initPrices: Record<string, number> = {};
      let hasMissingPrice = false;
      normalizedItems.forEach((item) => {
        initial[item.id] = item.defaultQty;
        initPrices[item.id] = item.price;
        if (!(item.price > 0)) {
          hasMissingPrice = true;
        }
      });
      setQuantities(initial);
      setCustomPrices(initPrices);
      fetchPrintersList();

      if (hasMissingPrice) {
        apiRequest<Product[]>("/products?limit=500")
          .then((res) => {
            const prods = Array.isArray(res?.data) ? res.data : [];
            if (prods.length === 0) return;
            const byCode = new Map<string, Product>();
            const byName = new Map<string, Product>();
            prods.forEach((p) => {
              if (p.code) byCode.set(p.code.trim().toUpperCase(), p);
              if (p.name) byName.set(p.name.trim().toLowerCase(), p);
              (p.variants || []).forEach((v) => {
                if (v.variantCode) byCode.set(v.variantCode.trim().toUpperCase(), p);
              });
            });
            setCustomPrices((prev) => {
              const next = { ...prev };
              normalizedItems.forEach((item) => {
                if ((next[item.id] || 0) > 0) return;
                const matched =
                  byCode.get(item.baseCode.toUpperCase()) ||
                  byCode.get(item.code.toUpperCase()) ||
                  byName.get(item.name.toLowerCase());
                if (matched && Number(matched.sellingPrice) > 0) {
                  next[item.id] = Number(matched.sellingPrice);
                }
              });
              return next;
            });
          })
          .catch(() => {});
      }
    }
  }, [modalOpen, normalizedItems]);

  const getEffectiveItemPrice = (item: NormalizedLabelItem): number => {
    const val = customPrices[item.id] !== undefined ? customPrices[item.id] : item.price;
    return Number(val) > 0 ? Number(val) : 0;
  };

  const currentPrinterObj = useMemo(
    () => printers.find((p) => p.Name === selectedPrinter) || null,
    [printers, selectedPrinter]
  );

  const totalLabels = useMemo(() => {
    return normalizedItems.reduce((sum, item) => sum + (quantities[item.id] || 0), 0);
  }, [normalizedItems, quantities]);

  const totalRows = Math.ceil(totalLabels / FIXED_LABEL_CONFIG.columns);

  // removed early null return so hook always returns ViewModel

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const setExactQty = (id: string, val: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(500, isNaN(val) ? 0 : val))
    }));
  };

  const handleSelectPrinter = (name: string) => {
    setSelectedPrinter(name);
    setPrintStatusMsg(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(PRINTER_STORAGE_KEY, name);
    }
  };

  // IN TRỰC TIẾP QUA WINDOWS SPOOLER (1-CLICK CHUẨN 2 CỘT 70x20mm)
  const handleDirectWindowsPrint = async () => {
    if (totalLabels <= 0) return;

    if (!selectedPrinter) {
      handleBrowserPrintDialog();
      return;
    }

    setIsPrintingDirect(true);
    setPrintStatusMsg({
      type: "info",
      text: `Đang đồng bộ khổ 2 cột 70×20mm và gửi ${totalLabels} tem (${totalRows} hàng) tới "${selectedPrinter}"...`
    });

    try {
      const payloadItems = normalizedItems
        .map((item) => {
          const qty = quantities[item.id] || 0;
          if (qty <= 0) return null;
          const effPrice = getEffectiveItemPrice(item);
          return {
            code: toCompactBarcode128(sanitizeAscii(item.code), 200),
            name: showProductName ? item.name : "",
            priceText:
              showPrice && effPrice > 0
                ? `${effPrice.toLocaleString("vi-VN")} đ`
                : "",
            sellingPrice: showPrice ? effPrice : 0,
            quantity: qty
          };
        })
        .filter(Boolean);

      const bodyPayload = JSON.stringify({
        printerName: selectedPrinter,
        shopName: showShopName ? shopName : "",
        columns: 2,
        paperWidthMm: FIXED_LABEL_CONFIG.pageWidthMm,
        paperHeightMm: FIXED_LABEL_CONFIG.pageHeightMm,
        preset: {
          id: FIXED_LABEL_CONFIG.id,
          widthMm: FIXED_LABEL_CONFIG.labelWidthMm,
          heightMm: FIXED_LABEL_CONFIG.labelHeightMm,
          columns: 2,
          pageWidthMm: FIXED_LABEL_CONFIG.pageWidthMm,
          pageHeightMm: FIXED_LABEL_CONFIG.pageHeightMm
        },
        options: {
          showShopName,
          showProductName,
          showPrice,
          nameFontSizePx,
          wrapProductName
        },
        items: payloadItems
      });

      const endpoints = [
        "http://localhost:4000/api/v1/system/printers/print-labels",
        "http://localhost:4000/api/v1/printers/print-labels",
        "/api/printers",
        "/api/v1/system/printers/print-labels",
        "/api/v1/printers/print-labels"
      ];

      const { json, lastError } = await fetchFirstOkJson<any>(
        endpoints,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyPayload,
        },
        (data) => Boolean(data?.success || data?.data?.printedPages !== undefined),
        8000
      );
      const lastErr = lastError || "Không kết nối được dịch vụ máy in.";
      const printedOk = Boolean(json);
      const successMsg =
        json?.message ||
        `Đã in ${totalLabels} tem (${totalRows} hàng 70×20mm) ra máy in "${selectedPrinter}"!`;

      if (!printedOk) {
        throw new Error(lastErr);
      }

      setPrintStatusMsg({
        type: "success",
        text: successMsg
      });
    } catch (err: any) {
      setPrintStatusMsg({
        type: "error",
        text: `${err?.message || "Lỗi khi in trực tiếp."} — Bạn có thể bấm "In qua trình duyệt (Ctrl+P)" bên dưới để in ngay.`
      });
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // IN QUA HỘP THOẠI TRÌNH DUYỆT (CHUẨN 2 CỘT 70x20mm)
  const handleBrowserPrintDialog = () => {
    if (totalLabels <= 0) return;

    const expandedLabels: {
      code: string;
      name: string;
      price: number;
    }[] = [];

    normalizedItems.forEach((item) => {
      const qty = quantities[item.id] || 0;
      const effPrice = getEffectiveItemPrice(item);
      const compactCode = toCompactBarcode128(sanitizeAscii(item.code), 200);
      for (let i = 0; i < qty; i++) {
        expandedLabels.push({
          code: compactCode,
          name: item.name,
          price: effPrice
        });
      }
    });

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

    const htmlContent = `<!DOCTYPE html>
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

    let iframe = printIframeRef.current;
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
      printIframeRef.current = iframe;
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
  };

  const previewItem =
    normalizedItems.find((it) => (quantities[it.id] || 0) > 0) || normalizedItems[0];

  const renderSingleStickerPreview = (item: NormalizedLabelItem | undefined, indexLabel: string) => {
    if (!item) return null;
    const cleanCode = toCompactBarcode128(sanitizeAscii(item.code), 200);
    const effPrice = getEffectiveItemPrice(item);
    const effective203Px = getEffectiveNameFontPx(item.name, nameFontSizePx);
    const previewNameFontPx = Math.round(effective203Px * 0.62 * 10) / 10;
    const isTwoLinePreview =
      showProductName && wrapProductName && (item.name || "").trim().length > 18;
    const previewBarHeight = !showProductName ? 58 : isTwoLinePreview ? 34 : 44;

    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 132,
          backgroundColor: "#ffffff",
          border: "1.5px dashed #64748b",
          borderRadius: 6,
          padding: "3px 8px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "center",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
          color: "#000000",
          position: "relative"
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 4,
            fontSize: 8.5,
            fontWeight: 700,
            color: "#64748b"
          }}
        >
          {indexLabel}
        </span>

        {showShopName && (
          <div
            style={{
              width: "100%",
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 900,
              lineHeight: 1.05,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: "2px solid #000000",
              paddingBottom: 2
            }}
          >
            {shopName}
          </div>
        )}

        {showProductName && (
          <div
            style={{
              width: "100%",
              flexShrink: 0,
              fontSize: previewNameFontPx,
              fontWeight: 800,
              lineHeight: 1.05,
              ...(wrapProductName
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    whiteSpace: "normal",
                    overflow: "hidden",
                    wordBreak: "break-word" as const
                  }
                : {
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  })
            }}
          >
            {item.name}
          </div>
        )}

        <div
          style={{
            width: "88%",
            height: previewBarHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          dangerouslySetInnerHTML={{
            __html: renderCode128SvgString(cleanCode, previewBarHeight)
          }}
        />

        <div
          style={{
            width: "100%",
            flexShrink: 0,
            fontFamily: "Consolas, 'Courier New', monospace",
            fontSize: 10.2,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            overflow: "hidden"
          }}
        >
          {cleanCode}
        </div>

        {showPrice && (
          effPrice > 0 ? (
            <div style={{ width: "100%", flexShrink: 0, fontSize: 15, fontWeight: 900, lineHeight: 1.05 }}>
              {effPrice.toLocaleString("vi-VN")} đ
            </div>
          ) : (
            <div style={{ width: "100%", flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "#dc2626", lineHeight: 1.05 }}>
              Chưa nhập giá niêm yết
            </div>
          )
        )}
      </div>
    );
  };


  return {
    onClose,
    title,
    shopName,
    normalizedItems,
    quantities,
    setQuantities,
    setCustomPrices,
    showPrice,
    setShowPrice,
    showShopName,
    setShowShopName,
    showProductName,
    setShowProductName,
    nameFontSizePx,
    setNameFontSizePx,
    wrapProductName,
    setWrapProductName,
    getEffectiveNameFontPx,
    printers,
    selectedPrinter,
    isScanningPrinters,
    isPrintingDirect,
    printStatusMsg,
    fetchPrintersList,
    getEffectiveItemPrice,
    currentPrinterObj,
    totalLabels,
    totalRows,
    updateQty,
    setExactQty,
    handleSelectPrinter,
    handleDirectWindowsPrint,
    handleBrowserPrintDialog,
    previewItem,
    renderSingleStickerPreview,
  };
}

export type BarcodeLabelViewModel = ReturnType<typeof useBarcodeLabelModal>;

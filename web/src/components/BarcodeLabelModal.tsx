"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatVND } from "@/lib/api";

export interface BarcodeLabelItem {
  id?: string;
  /** Mã sản phẩm chung (IN HOA VIẾT LIỀN, KHÔNG chứa màu/size) — dùng để in mã vạch */
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  sellingPrice?: number;
  unit?: string;
  /** Số lượng tem mặc định (theo SL nhập hoặc tồn kho) */
  defaultQty?: number;
}

interface BarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  items: BarcodeLabelItem[];
  title?: string;
}

type LabelPresetId = "50x30_1UP" | "40x30_1UP" | "35x22_2UP";

interface LabelPreset {
  id: LabelPresetId;
  name: string;
  desc: string;
  widthMm: number;
  heightMm: number;
  columns: 1 | 2;
  pageWidthMm: number;
  pageHeightMm: number;
}

interface DetectedPrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isOnline: boolean;
  isThermal: boolean;
}

const BROWSER_DIALOG_VALUE = "__BROWSER_DIALOG__";

const LABEL_PRESETS: LabelPreset[] = [
  {
    id: "50x30_1UP",
    name: "50 × 30 mm (1 tem/hàng)",
    desc: "Chuẩn máy in nhiệt Xprinter / Godex / Zebra (Khuyên dùng)",
    widthMm: 50,
    heightMm: 30,
    columns: 1,
    pageWidthMm: 50,
    pageHeightMm: 30,
  },
  {
    id: "40x30_1UP",
    name: "40 × 30 mm (1 tem/hàng)",
    desc: "Khổ tem vừa cho tag treo quần áo, phụ kiện",
    widthMm: 40,
    heightMm: 30,
    columns: 1,
    pageWidthMm: 40,
    pageHeightMm: 30,
  },
  {
    id: "35x22_2UP",
    name: "35 × 22 mm (2 tem/hàng - khổ 70×22)",
    desc: "Giấy cuộn 2 tem ngang tiết kiệm giấy",
    widthMm: 35,
    heightMm: 22,
    columns: 2,
    pageWidthMm: 72,
    pageHeightMm: 22,
  },
];

/**
 * Bảng mã chuẩn Code128 (0..106) theo ISO/IEC 15417.
 * Mỗi chuỗi gồm 6 chữ số độ rộng của [Bar, Space, Bar, Space, Bar, Space] (Stop 106 có 7 phần tử).
 */
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

/**
 * Chuẩn hóa Mã sản phẩm để đưa vào Label:
 * Chỉ giữ CHỮ IN HOA & SỐ viết liền (không chứa màu/size).
 */
export function cleanMasterCodeForLabel(rawCode: string): string {
  return String(rawCode || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Sinh danh sách thanh đen (bars) theo chuẩn Code128-B cho chuỗi mã sản phẩm.
 */
export function encodeCode128Bars(rawText: string): {
  bars: { x: number; w: number }[];
  totalUnits: number;
} {
  const text = cleanMasterCodeForLabel(rawText) || "11SPORT";
  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const ascii = text.charCodeAt(i);
    const val = ascii >= 32 && ascii <= 126 ? ascii - 32 : 0;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop pattern

  const quietZone = 10;
  let cursor = quietZone;
  const bars: { x: number; w: number }[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let j = 0; j < pattern.length; j++) {
      const width = Number(pattern[j]) || 1;
      if (j % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }

  return {
    bars,
    totalUnits: cursor + quietZone,
  };
}

export function Code128Svg({
  value,
  height = 38,
}: {
  value: string;
  height?: number;
}) {
  const cleanCode = cleanMasterCodeForLabel(value);
  const { bars, totalUnits } = useMemo(() => encodeCode128Bars(cleanCode), [cleanCode]);

  return (
    <svg
      viewBox={`0 0 ${totalUnits} ${height}`}
      className="w-full h-auto block"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={totalUnits} height={height} fill="#FFFFFF" />
      {bars.map((b, idx) => (
        <rect key={idx} x={b.x} y={0} width={b.w} height={height} fill="#000000" />
      ))}
    </svg>
  );
}

export default function BarcodeLabelModal({
  open,
  onClose,
  items,
  title = "In Tem Nhãn Mã Vạch (Máy In Label)",
}: BarcodeLabelModalProps) {
  const [presetId, setPresetId] = useState<LabelPresetId>("50x30_1UP");
  const [showShopName, setShowShopName] = useState(true);
  const showProductName = false; // Bỏ phần in tên sản phẩm trên tem mã vạch theo yêu cầu
  const [showPrice, setShowPrice] = useState(true);
  const groupByMasterCode = true; // Mặc định luôn gộp các dòng cùng Mã SP thành 1 dòng tổng SL tem

  // State máy in kết nối
  const [printers, setPrinters] = useState<DetectedPrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [printingDirect, setPrintingDirect] = useState(false);
  const [printStatusMsg, setPrintStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const scanConnectedPrinters = useCallback(async () => {
    setScanningPrinters(true);
    setPrintStatusMsg(null);
    const endpoints = [
      "/api/printers",
      "http://localhost:4000/api/v1/printers",
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        const list: DetectedPrinterInfo[] = Array.isArray(json?.data?.printers)
          ? json.data.printers
          : [];
        const recommended: string | null = json?.data?.recommendedPrinter || null;

        if (list.length > 0) {
          setPrinters(list);
          setSelectedPrinter((prev) => {
            if (prev && (prev === BROWSER_DIALOG_VALUE || list.some((p) => p.name === prev))) {
              return prev;
            }
            return recommended || list[0].name;
          });
          setScanningPrinters(false);
          return;
        }
      } catch {
        // Thử endpoint tiếp theo
      }
    }

    setPrinters([]);
    setSelectedPrinter(BROWSER_DIALOG_VALUE);
    setScanningPrinters(false);
  }, []);

  const syncThermalDriverPaperSize = useCallback(
    async (targetPrinterName: string, preset: LabelPreset) => {
      if (!targetPrinterName || targetPrinterName === BROWSER_DIALOG_VALUE) return;
      const body = JSON.stringify({
        printerName: targetPrinterName,
        syncOnly: true,
        preset: {
          id: preset.id,
          widthMm: preset.widthMm,
          heightMm: preset.heightMm,
          columns: preset.columns,
          pageWidthMm: preset.pageWidthMm,
          pageHeightMm: preset.pageHeightMm,
        },
      });
      const endpoints = [
        "/api/printers",
        "http://localhost:4000/api/v1/printers/print-labels",
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          if (res.ok) return;
        } catch {
          // Thử endpoint tiếp theo
        }
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      scanConnectedPrinters();
    }
  }, [open, scanConnectedPrinters]);

  useEffect(() => {
    if (!open) return;
    const presetObj = LABEL_PRESETS.find((p) => p.id === presetId) || LABEL_PRESETS[0];
    const thermalPrinter =
      (selectedPrinter && selectedPrinter !== BROWSER_DIALOG_VALUE
        ? selectedPrinter
        : printers.find((p) => p.isThermal)?.name || printers[0]?.name) || "";
    if (thermalPrinter) {
      syncThermalDriverPaperSize(thermalPrinter, presetObj);
    }
  }, [open, presetId, selectedPrinter, printers, syncThermalDriverPaperSize]);

  const normalizedRows = useMemo(() => {
    const base = items
      .map((it, idx) => {
        const cleanCode = cleanMasterCodeForLabel(it.productCode);
        return {
          key: it.id || `${cleanCode}_${it.color || ""}_${it.size || ""}_${idx}`,
          productCode: cleanCode,
          productName: it.productName || cleanCode,
          color: it.color || "",
          size: it.size || "",
          sellingPrice: Number(it.sellingPrice || 0),
          defaultQty: Math.max(1, Math.round(Number(it.defaultQty ?? 1))),
        };
      })
      .filter((r) => Boolean(r.productCode));

    if (!groupByMasterCode) return base;

    const grouped = new Map<string, (typeof base)[number]>();
    for (const r of base) {
      const existing = grouped.get(r.productCode);
      if (existing) {
        existing.defaultQty += r.defaultQty;
        if (!existing.sellingPrice && r.sellingPrice) existing.sellingPrice = r.sellingPrice;
      } else {
        grouped.set(r.productCode, {
          ...r,
          key: r.productCode,
          color: "",
          size: "",
        });
      }
    }
    return Array.from(grouped.values());
  }, [items, groupByMasterCode]);

  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});

  if (!open) return null;

  const currentPreset = LABEL_PRESETS.find((p) => p.id === presetId) || LABEL_PRESETS[0];

  const getRowQty = (rowKey: string, defaultQty: number) => {
    if (qtyOverrides[rowKey] !== undefined) return qtyOverrides[rowKey];
    return defaultQty;
  };

  const setAllQtyMode = (mode: "DEFAULT" | "ONE" | "ZERO") => {
    const next: Record<string, number> = {};
    for (const r of normalizedRows) {
      next[r.key] = mode === "DEFAULT" ? r.defaultQty : mode === "ONE" ? 1 : 0;
    }
    setQtyOverrides(next);
  };

  const totalLabelsToPrint = normalizedRows.reduce(
    (sum, r) => sum + Math.max(0, getRowQty(r.key, r.defaultQty)),
    0
  );

  const sampleRow = normalizedRows[0] || {
    key: "SAMPLE",
    productCode: "AOKAMITOPRO",
    productName: "Áo đấu Kamito Pro",
    color: "",
    size: "",
    sellingPrice: 290000,
    defaultQty: 1,
  };

  const activePrinterObj = printers.find((p) => p.name === selectedPrinter) || null;

  /**
   * In qua hộp thoại trình duyệt (Sử dụng hidden iframe + gọi thẳng contentWindow.print()
   * để không bị chặn Popup và không bị lỗi window.onload không kích hoạt).
   */
  const handleBrowserPrintDialog = () => {
    const expandedLabels: {
      productCode: string;
      productName: string;
      sellingPrice: number;
    }[] = [];

    for (const r of normalizedRows) {
      const count = Math.max(0, getRowQty(r.key, r.defaultQty));
      for (let i = 0; i < count; i++) {
        expandedLabels.push({
          productCode: r.productCode,
          productName: r.productName,
          sellingPrice: r.sellingPrice,
        });
      }
    }

    if (expandedLabels.length === 0) {
      setPrintStatusMsg({
        type: "error",
        text: "Vui lòng chọn số lượng tem cần in lớn hơn 0!",
      });
      return;
    }

    const renderSingleStickerHtml = (lbl: {
      productCode: string;
      productName: string;
      sellingPrice: number;
    }) => {
      const { bars, totalUnits } = encodeCode128Bars(lbl.productCode);
      const rectsHtml = bars
        .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="40" fill="#000" />`)
        .join("");

      const priceText =
        showPrice && lbl.sellingPrice > 0 ? formatVND(lbl.sellingPrice) : "";

      return `
        <div class="label-sticker">
          ${showShopName ? `<div class="shop-title">11 SPORT</div>` : ""}
          <div class="barcode-wrap">
            <svg viewBox="0 0 ${totalUnits} 40" preserveAspectRatio="none" shape-rendering="crispEdges">
              <rect x="0" y="0" width="${totalUnits}" height="40" fill="#fff" />
              ${rectsHtml}
            </svg>
          </div>
          <div class="prod-code">${lbl.productCode}</div>
          ${priceText ? `<div class="prod-price">${priceText}</div>` : ""}
        </div>
      `;
    };

    let pagesHtml = "";
    if (currentPreset.columns === 2) {
      for (let i = 0; i < expandedLabels.length; i += 2) {
        const left = renderSingleStickerHtml(expandedLabels[i]);
        const right = expandedLabels[i + 1]
          ? renderSingleStickerHtml(expandedLabels[i + 1])
          : `<div class="label-sticker empty"></div>`;
        pagesHtml += `<div class="label-page two-col">${left}${right}</div>`;
      }
    } else {
      for (const lbl of expandedLabels) {
        pagesHtml += `<div class="label-page one-col">${renderSingleStickerHtml(lbl)}</div>`;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>In Tem Mã Vạch 11Sport (${expandedLabels.length} tem)</title>
        <style>
          @page {
            size: ${currentPreset.pageWidthMm}mm ${currentPreset.pageHeightMm}mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: ${currentPreset.pageWidthMm}mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @media screen {
            html, body {
              width: 100%;
              background: #f1f5f9;
              padding: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
            }
            .label-page {
              background: #ffffff;
              box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
              border: 1px dashed #94a3b8;
            }
          }
          @media print {
            html, body {
              width: ${currentPreset.pageWidthMm}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
          }
          .no-print {
            width: 100%;
            max-width: 680px;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 14px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 12px;
            margin-bottom: 6px;
          }
          .no-print button {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 7px 14px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
          }
          .label-page {
            width: ${currentPreset.pageWidthMm}mm;
            height: ${currentPreset.pageHeightMm}mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: row;
            align-items: center;
            overflow: hidden;
          }
          .label-page.one-col {
            justify-content: center;
          }
          .label-page.two-col {
            justify-content: space-between;
          }
          .label-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .label-sticker {
            width: ${currentPreset.widthMm}mm;
            height: ${currentPreset.heightMm}mm;
            padding: 1.4mm 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
          }
          .shop-title {
            font-size: ${currentPreset.heightMm <= 24 ? "7pt" : "8pt"};
            font-weight: 900;
            letter-spacing: 0.6px;
            line-height: 1.05;
            margin-bottom: 0.6mm;
          }
          .barcode-wrap {
            width: 96%;
            height: ${currentPreset.heightMm <= 24 ? "10mm" : "14mm"};
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .barcode-wrap svg {
            width: 100%;
            height: 100%;
            display: block;
          }
          .prod-code {
            font-family: "Courier New", Courier, monospace;
            font-size: ${currentPreset.heightMm <= 24 ? "7.5pt" : "9pt"};
            font-weight: 900;
            letter-spacing: 0.6px;
            line-height: 1.1;
            margin-top: 0.6mm;
          }
          .prod-price {
            font-size: ${currentPreset.heightMm <= 24 ? "7pt" : "8.5pt"};
            font-weight: 800;
            line-height: 1.1;
            margin-top: 0.5mm;
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <span><b>Xem trước ${expandedLabels.length} tem (Khổ giấy trang in: ${currentPreset.pageWidthMm}×${currentPreset.pageHeightMm}mm)</b> — Chọn máy in <b>Xprinter XP-350BM</b> (Khổ giấy: <b>USER</b>).</span>
          <button type="button" onclick="window.focus(); window.print();">🖨️ Bấm để In ngay (Ctrl+P)</button>
        </div>
        ${pagesHtml}
      </body>
      </html>
    `;

    const targetThermalPrinter =
      (selectedPrinter && selectedPrinter !== BROWSER_DIALOG_VALUE
        ? selectedPrinter
        : printers.find((p) => p.isThermal)?.name || printers[0]?.name) || "";

    const printWindow = window.open("", "_blank", "width=760,height=680");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setPrintStatusMsg({
        type: "info",
        text: `Đang đồng bộ khổ giấy ${currentPreset.pageWidthMm}×${currentPreset.pageHeightMm}mm với driver máy in và mở hộp thoại in...`,
      });

      void (async () => {
        if (targetThermalPrinter) {
          await syncThermalDriverPaperSize(targetThermalPrinter, currentPreset);
        }
        setPrintStatusMsg({
          type: "info",
          text: `Đã đồng bộ khổ giấy USER (${currentPreset.pageWidthMm}×${currentPreset.pageHeightMm}mm)! Trong hộp thoại in trình duyệt, hãy chọn Xprinter XP-350BM.`,
        });
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {
            // Người dùng có thể bấm nút "🖨️ Bấm để In ngay" ngay trong cửa sổ vừa mở
          }
        }, 150);
      })();
      return;
    }

    // Fallback nếu trình duyệt chặn popup: dùng iframe ẩn
    const iframeId = "eleven-sport-barcode-print-iframe";
    let printIframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (printIframe) {
      printIframe.remove();
    }
    printIframe = document.createElement("iframe");
    printIframe.id = iframeId;
    printIframe.style.position = "fixed";
    printIframe.style.left = "-9999px";
    printIframe.style.top = "0";
    printIframe.style.width = "400px";
    printIframe.style.height = "300px";
    printIframe.style.border = "0";
    document.body.appendChild(printIframe);

    const frameDoc = printIframe.contentWindow?.document;
    if (!frameDoc || !printIframe.contentWindow) {
      setPrintStatusMsg({
        type: "error",
        text: "Không thể khởi tạo khung in trên trình duyệt này.",
      });
      return;
    }

    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
      try {
        printIframe?.contentWindow?.focus();
        printIframe?.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 250);
  };

  /**
   * Xử lý nút In chính:
   * - Nếu đã chọn máy in kết nối (ví dụ: Xprinter XP-350BM): gửi lệnh in trực tiếp xuống máy in qua Windows Spooler.
   * - Nếu chọn Hộp thoại trình duyệt: mở hộp thoại in.
   */
  const handlePrintLabels = async () => {
    if (totalLabelsToPrint <= 0) {
      setPrintStatusMsg({
        type: "error",
        text: "Vui lòng chọn số lượng tem cần in lớn hơn 0!",
      });
      return;
    }

    if (!selectedPrinter || selectedPrinter === BROWSER_DIALOG_VALUE) {
      handleBrowserPrintDialog();
      return;
    }

    const itemsPayload = normalizedRows
      .map((r) => ({
        code: r.productCode,
        name: r.productName,
        sellingPrice: r.sellingPrice,
        quantity: Math.max(0, getRowQty(r.key, r.defaultQty)),
      }))
      .filter((it) => it.quantity > 0);

    setPrintingDirect(true);
    setPrintStatusMsg({
      type: "info",
      text: `Đang gửi lệnh in ${totalLabelsToPrint} tem trực tiếp tới máy in "${selectedPrinter}"...`,
    });

    const requestBody = JSON.stringify({
      printerName: selectedPrinter,
      preset: {
        id: currentPreset.id,
        widthMm: currentPreset.widthMm,
        heightMm: currentPreset.heightMm,
        columns: currentPreset.columns,
        pageWidthMm: currentPreset.pageWidthMm,
        pageHeightMm: currentPreset.pageHeightMm,
      },
      options: {
        showShopName,
        showProductName,
        showPrice,
      },
      items: itemsPayload,
    });

    const endpoints = [
      "/api/printers",
      "http://localhost:4000/api/v1/printers/print-labels",
    ];

    let lastErr = "Không thể kết nối tới dịch vụ máy in.";
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.data?.printed) {
          setPrintingDirect(false);
          setPrintStatusMsg({
            type: "success",
            text:
              json.data.message ||
              `Đã gửi lệnh in ${totalLabelsToPrint} tem tới máy in "${selectedPrinter}" thành công!`,
          });
          return;
        }
        if (json?.message) {
          lastErr = json.message;
        }
      } catch (err: any) {
        lastErr = err?.message || lastErr;
      }
    }

    setPrintingDirect(false);
    setPrintStatusMsg({
      type: "error",
      text: `${lastErr} — Đang chuyển sang hộp thoại in của trình duyệt...`,
    });
    handleBrowserPrintDialog();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>🖨️</span>
              <span>{title}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Mã vạch trên tem chỉ chứa <b>Mã sản phẩm chung IN HOA VIẾT LIỀN</b> (không kèm màu/size)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-sm font-semibold"
          >
            ✕ Đóng
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Khung chọn máy in nhiệt kết nối trực tiếp */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              activePrinterObj?.isOnline
                ? "bg-emerald-50/80 border-emerald-300"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase text-slate-800">
                  Máy in kết nối (Thermal Label Printer):
                </span>
                {scanningPrinters ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                    ⏳ Đang dò máy in...
                  </span>
                ) : activePrinterObj ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      activePrinterObj.isOnline
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {activePrinterObj.isOnline ? "🟢 Sẵn sàng" : "🟡 Kiểm tra cáp/nguồn"} •{" "}
                    {activePrinterObj.name} ({activePrinterObj.portName})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                    🌐 Chế độ hộp thoại in trình duyệt
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={selectedPrinter}
                  onChange={(e) => {
                    setSelectedPrinter(e.target.value);
                    setPrintStatusMsg(null);
                  }}
                  aria-label="Chọn máy in tem mã vạch"
                  className="text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5 min-w-[260px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.isThermal ? "🖨️ [Máy in nhiệt] " : "🖨️ "}
                      {p.name} (Cổng {p.portName} — {p.isOnline ? "Sẵn sàng" : p.status})
                    </option>
                  ))}
                  <option value={BROWSER_DIALOG_VALUE}>
                    🌐 Mở hộp thoại In của trình duyệt (Chọn máy in thủ công / Lưu PDF)
                  </option>
                </select>

                <button
                  type="button"
                  onClick={scanConnectedPrinters}
                  disabled={scanningPrinters}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  🔄 {scanningPrinters ? "Đang quét..." : "Quét lại máy in"}
                </button>
              </div>
            </div>
          </div>

          {/* Thông báo kết quả gửi lệnh in */}
          {printStatusMsg && (
            <div
              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                printStatusMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : printStatusMsg.type === "error"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-blue-50 border-blue-300 text-blue-800"
              }`}
            >
              <span>
                {printStatusMsg.type === "success"
                  ? "✅ "
                  : printStatusMsg.type === "error"
                    ? "⚠️ "
                    : "ℹ️ "}
                {printStatusMsg.text}
              </span>
              <button
                type="button"
                onClick={() => setPrintStatusMsg(null)}
                className="text-slate-500 hover:text-slate-800 font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cấu hình khổ giấy & Xem trước */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-bold uppercase text-slate-700">
                1. Chọn khổ giấy máy in tem nhiệt (Thermal Label)
              </div>
              <div className="space-y-2">
                {LABEL_PRESETS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                      presetId === p.id
                        ? "border-blue-600 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="labelPreset"
                      checked={presetId === p.id}
                      onChange={() => setPresetId(p.id)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showShopName}
                    onChange={(e) => setShowShopName(e.target.checked)}
                    className="accent-blue-600"
                  />
                  In tiêu đề &ldquo;11 SPORT&rdquo;
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="accent-blue-600"
                  />
                  In giá bán lẻ
                </label>
              </div>
            </div>

            {/* Khung xem trước mẫu tem */}
            <div className="lg:col-span-5 bg-slate-100 rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center">
              <div className="text-[11px] font-semibold uppercase text-slate-500 mb-2">
                Xem trước mẫu tem ({currentPreset.widthMm}×{currentPreset.heightMm}mm)
              </div>
              <div className="bg-white border-2 border-dashed border-slate-400 rounded-lg px-4 py-3 w-64 shadow-sm flex flex-col items-center text-center">
                {showShopName && (
                  <div className="text-[11px] font-black tracking-wider text-slate-900">
                    11 SPORT
                  </div>
                )}
                <div className="w-full my-1.5 px-2">
                  <Code128Svg value={sampleRow.productCode} height={42} />
                </div>
                <div className="font-mono text-sm font-black tracking-widest text-slate-900">
                  {sampleRow.productCode}
                </div>
                {showPrice && sampleRow.sellingPrice > 0 && (
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {formatVND(sampleRow.sellingPrice)}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-2 text-center">
                ✓ Mã vạch chuẩn Code128 — chỉ mã hóa <b>{sampleRow.productCode}</b>
              </div>
            </div>
          </div>

          {/* Danh sách sản phẩm & số lượng tem cần in */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase text-slate-700">
                2. Danh sách Mã sản phẩm & Số lượng tem in ({normalizedRows.length} dòng — Tổng{" "}
                <span className="text-blue-700">{totalLabelsToPrint}</span> tem)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllQtyMode("DEFAULT")}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                >
                  Theo SL nhập/tồn
                </button>
                <button
                  type="button"
                  onClick={() => setAllQtyMode("ONE")}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                >
                  Mỗi dòng = 1 tem
                </button>
                <button
                  type="button"
                  onClick={() => setAllQtyMode("ZERO")}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-500"
                >
                  Đặt về 0
                </button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-left w-10">#</th>
                    <th className="py-2 px-3 text-left">Mã vạch in trên Label</th>
                    <th className="py-2 px-3 text-left">Tên sản phẩm</th>
                    {!groupByMasterCode && (
                      <th className="py-2 px-3 text-left">Phân loại (Màu / Size)</th>
                    )}
                    <th className="py-2 px-3 text-right">Giá bán</th>
                    <th className="py-2 px-3 text-center w-36">Số tem cần in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {normalizedRows.map((r, idx) => {
                    const qty = getRowQty(r.key, r.defaultQty);
                    return (
                      <tr key={r.key} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            {r.productCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{r.productName}</td>
                        {!groupByMasterCode && (
                          <td className="py-2 px-3 text-slate-600">
                            {r.color || r.size ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                {[r.color, r.size ? `Size ${r.size}` : ""]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </span>
                            ) : (
                              <span className="text-slate-400">Mặc định</span>
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          {r.sellingPrice > 0 ? formatVND(r.sellingPrice) : "Chưa đặt giá"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                setQtyOverrides((prev) => ({
                                  ...prev,
                                  [r.key]: Math.max(0, qty - 1),
                                }))
                              }
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              aria-label={`Số tem cần in cho ${r.productCode}`}
                              value={qty}
                              onChange={(e) =>
                                setQtyOverrides((prev) => ({
                                  ...prev,
                                  [r.key]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                }))
                              }
                              className="w-14 text-center font-bold text-slate-900 py-1 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQtyOverrides((prev) => ({
                                  ...prev,
                                  [r.key]: qty + 1,
                                }))
                              }
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Tổng cộng: <b className="text-slate-900">{totalLabelsToPrint} tem</b> trên khổ{" "}
            <b>
              {currentPreset.widthMm}×{currentPreset.heightMm}mm
            </b>
            {activePrinterObj && (
              <span className="ml-1 text-emerald-700 font-semibold">
                • Máy in: {activePrinterObj.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
            >
              Đóng
            </button>
            {selectedPrinter && selectedPrinter !== BROWSER_DIALOG_VALUE && (
              <button
                type="button"
                onClick={handleBrowserPrintDialog}
                disabled={totalLabelsToPrint <= 0 || printingDirect}
                className="px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 text-xs font-semibold"
                title="Mở hộp thoại in của trình duyệt (Ctrl+P) để xem trước hoặc lưu PDF"
              >
                🌐 Hộp thoại In trình duyệt
              </button>
            )}
            <button
              type="button"
              onClick={handlePrintLabels}
              disabled={totalLabelsToPrint <= 0 || printingDirect}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>
                {printingDirect
                  ? "Đang gửi lệnh in..."
                  : activePrinterObj
                    ? `In ${totalLabelsToPrint} Tem Ra ${activePrinterObj.name}`
                    : `In ${totalLabelsToPrint} Tem Mã Vạch Ngay`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

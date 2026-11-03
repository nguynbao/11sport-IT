"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Product, apiRequest, formatNumberDots, generateVariantProductCode, parseNumberDots } from "@/lib/api";
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

export interface BarcodeLabelItem {
  id?: string | number;
  code?: string;
  productCode?: string;
  name?: string;
  productName?: string;
  price?: number;
  sellingPrice?: number;
  color?: string;
  size?: string;
  unit?: string;
  category?: string;
  defaultQty?: number;
}

interface NormalizedLabelItem {
  id: string;
  code: string;
  baseCode: string;
  name: string;
  attrLabel: string;
  price: number;
  defaultQty: number;
}

interface BarcodeLabelModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  items: BarcodeLabelItem[];
  title?: string;
  shopName?: string;
}

type SystemPrinterInfo = {
  Name: string;
  DriverName: string;
  PortName: string;
  PrinterStatus: string;
  Default: boolean;
  WorkOffline: boolean;
  IsOnline: boolean;
  IsThermal: boolean;
};

// Cấu hình cố định chuẩn máy in tem 2 cột 70 × 20 mm (2 tem 35 × 20 mm / hàng)
const FIXED_LABEL_CONFIG = {
  id: "70x20_2up",
  name: "Tem đôi 2 cột 70 × 20 mm (2 tem 35×20mm / hàng)",
  columns: 2 as const,
  pageWidthMm: 70,
  pageHeightMm: 20,
  labelWidthMm: 34.5,
  labelHeightMm: 20,
  colGapMm: 1
};

const CODE128_PATTERNS: string[] = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011"
];

function sanitizeAscii(input: string): string {
  const normalized = (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      out += normalized[i];
    }
  }
  return out || "ITEM";
}

function encodeCode128RawPattern(rawText: string): string {
  const text = sanitizeAscii(rawText);
  const START_B = 104;
  const START_C = 105;
  const CODE_B = 100;
  const CODE_C = 99;
  const STOP_CODE = 106;

  const countConsecutiveDigits = (str: string, startIdx: number): number => {
    let count = 0;
    while (startIdx + count < str.length) {
      const ch = str.charCodeAt(startIdx + count);
      if (ch >= 48 && ch <= 57) count++;
      else break;
    }
    return count;
  };

  const codes: number[] = [];
  let i = 0;
  const initialDigits = countConsecutiveDigits(text, 0);
  let mode: "B" | "C" = initialDigits >= 4 ? "C" : "B";
  codes.push(mode === "C" ? START_C : START_B);

  while (i < text.length) {
    if (mode === "C") {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 2) {
        codes.push(parseInt(text.slice(i, i + 2), 10));
        i += 2;
      } else {
        codes.push(CODE_B);
        mode = "B";
      }
    } else {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 4) {
        if (dCount % 2 === 1) {
          codes.push(text.charCodeAt(i) - 32);
          i += 1;
        }
        codes.push(CODE_C);
        mode = "C";
      } else {
        codes.push(text.charCodeAt(i) - 32);
        i += 1;
      }
    }
  }

  let checksum = codes[0];
  for (let idx = 1; idx < codes.length; idx++) {
    checksum += codes[idx] * idx;
  }
  const checkIndex = checksum % 103;
  codes.push(checkIndex);
  codes.push(STOP_CODE);

  return codes.map((c) => CODE128_PATTERNS[c] || "").join("");
}

function encodeCode128Bars(rawText: string, maxDots = 258): string {
  const pat = encodeCode128RawPattern(rawText);
  const numSymbols = Math.floor((pat.length - 2) / 11);
  if (numSymbols <= 0) return pat;

  let symW = Math.floor((maxDots - 4) / numSymbols);
  if (symW > 24) symW = 24;
  if (symW < 16) symW = 11;

  if (symW === 11) {
    return pat;
  }

  let out = "";
  for (let sIdx = 0; sIdx < numSymbols; sIdx++) {
    const symPat = pat.slice(sIdx * 11, sIdx * 11 + 11);
    const m: number[] = [];
    let i = 0;
    while (i < 11) {
      const ch = symPat[i];
      let r = 1;
      while (i + r < 11 && symPat[i + r] === ch) r++;
      m.push(r);
      i += r;
    }

    if (symW === 22) {
      for (let k = 0; k < 6; k++) {
        out += (k % 2 === 0 ? "1" : "0").repeat(m[k] * 2);
      }
      continue;
    }

    const minR: number[] = [];
    const maxR: number[] = [];
    for (let k = 0; k < 6; k++) {
      let lo = 1;
      while (Math.round((lo * 11) / symW) < m[k]) lo++;
      let hi = lo;
      while (Math.round(((hi + 1) * 11) / symW) === m[k]) hi++;
      minR.push(lo);
      maxR.push(hi);
    }

    let bestR: number[] = m.map((v) => Math.max(1, Math.round((v * symW) / 11)));
    let bestCost = 1e9;

    for (let r0 = minR[0]; r0 <= maxR[0]; r0++) {
      for (let r1 = minR[1]; r1 <= maxR[1]; r1++) {
        for (let r2 = minR[2]; r2 <= maxR[2]; r2++) {
          for (let r3 = minR[3]; r3 <= maxR[3]; r3++) {
            for (let r4 = minR[4]; r4 <= maxR[4]; r4++) {
              const r5 = symW - (r0 + r1 + r2 + r3 + r4);
              if (r5 >= minR[5] && r5 <= maxR[5]) {
                const rr = [r0, r1, r2, r3, r4, r5];
                let ok = true;
                for (let k = 0; k < 4; k++) {
                  if (Math.round(((rr[k] + rr[k + 1]) * 11) / symW) !== m[k] + m[k + 1]) {
                    ok = false;
                    break;
                  }
                }
                if (ok) {
                  let cost = 0;
                  for (let k = 0; k < 6; k++) {
                    const diff = (rr[k] * 11) / symW - m[k];
                    cost += diff * diff;
                  }
                  if (cost < bestCost) {
                    bestCost = cost;
                    bestR = rr;
                  }
                }
              }
            }
          }
        }
      }
    }

    for (let k = 0; k < 6; k++) {
      out += (k % 2 === 0 ? "1" : "0").repeat(bestR[k]);
    }
  }

  const finalBarPx = Math.max(2, Math.round((2 * symW) / 11));
  out += "1".repeat(finalBarPx);
  return out;
}

function renderCode128SvgString(rawText: string, height = 46): string {
  const pattern = encodeCode128Bars(rawText, 258);
  const quietZoneUnits = 4;
  const exactWidthPx = pattern.length + quietZoneUnits * 2;

  const rects: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "1") {
      let run = 1;
      while (i + run < pattern.length && pattern[i + run] === "1") {
        run++;
      }
      const x = quietZoneUnits + i;
      const w = run;
      rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000" shape-rendering="crispEdges" />`);
      i += run;
    } else {
      i++;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${exactWidthPx} ${height}" width="100%" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;margin:0 auto;background:#ffffff;image-rendering:pixelated;image-rendering:crisp-edges;">
    <rect x="0" y="0" width="${exactWidthPx}" height="${height}" fill="#ffffff" />
    ${rects.join("")}
  </svg>`;
}

/**
 * Kết xuất ảnh PNG 1-bit khớp đúng độ phân giải đầu in 203 DPI cho khổ tem 35×20mm (lấp đầy ~93% chiều ngang tem)
 */
function renderCode128MonochromePngDataUrl(rawText: string, labelWidthMm = 34.5, barHeightPx = 68): string {
  const baseWidth = Math.round(labelWidthMm * 8); // 276 dots cho tem 34.5mm ở 203 DPI
  const canvasHeight = barHeightPx;
  const quietZonePx = 8; // ~1.0mm mỗi bên
  const maxBarW = baseWidth - quietZonePx * 2;
  const pattern = encodeCode128Bars(rawText, maxBarW);
  const dotsPerUnit = Math.max(1, Math.min(2, Math.floor(maxBarW / pattern.length) || 1));
  const totalBarPx = pattern.length * dotsPerUnit;
  const canvasWidth = Math.max(baseWidth, totalBarPx + quietZonePx * 2);
  const startX = Math.max(quietZonePx, Math.floor((canvasWidth - totalBarPx) / 2));

  if (typeof document === "undefined") {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#000000";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "1") {
      let run = 1;
      while (i + run < pattern.length && pattern[i + run] === "1") {
        run++;
      }
      const x = startX + i * dotsPerUnit;
      const w = run * dotsPerUnit;
      ctx.fillRect(x, 0, w, canvasHeight);
      i += run;
    } else {
      i++;
    }
  }

  return canvas.toDataURL("image/png");
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PRINTER_STORAGE_KEY = "11sport_preferred_thermal_printer";

export default function BarcodeLabelModal({
  open,
  isOpen,
  onClose,
  items,
  title = "In Tem Mã Vạch 2 Cột (70 × 20 mm)",
  shopName = "11SPORT"
}: BarcodeLabelModalProps) {
  const modalOpen = Boolean(isOpen ?? open);

  const normalizedItems = useMemo<NormalizedLabelItem[]>(() => {
    return (items || []).map((item, idx) => {
      const baseCode = String(item.productCode || item.code || "ITEM").trim();
      const rawCode = String(item.code || item.productCode || "ITEM").trim();
      const hasAttr = Boolean((item.color && item.color.trim()) || (item.size && item.size.trim()));
      const code = hasAttr
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
        "http://localhost:4000/api/v1/printers",
        "/api/printers",
        "/api/v1/printers"
      ];
      let list: SystemPrinterInfo[] = [];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json?.data?.printers)) {
              list = json.data.printers;
              break;
            }
          }
        } catch {
          // try next endpoint
        }
      }

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

  if (!modalOpen) return null;

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
            code: sanitizeAscii(item.code),
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
        "http://localhost:4000/api/v1/printers/print-labels",
        "/api/printers",
        "/api/v1/printers/print-labels"
      ];

      let lastErr = "Không kết nối được dịch vụ máy in.";
      let printedOk = false;
      let successMsg = "";

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyPayload
          });
          const json = await res.json();
          if (res.ok && (json?.success || json?.data?.printedPages !== undefined)) {
            printedOk = true;
            successMsg =
              json.message ||
              `Đã in ${totalLabels} tem (${totalRows} hàng 70×20mm) ra máy in "${selectedPrinter}"!`;
            break;
          } else if (json?.message || json?.error?.message) {
            lastErr = json?.message || json?.error?.message;
          }
        } catch (e: any) {
          lastErr = e?.message || lastErr;
        }
      }

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
      for (let i = 0; i < qty; i++) {
        expandedLabels.push({
          code: sanitizeAscii(item.code),
          name: item.name,
          price: effPrice
        });
      }
    });

    const pagesHtml: string[] = [];
    const cols = FIXED_LABEL_CONFIG.columns;

    const pngCache = new Map<string, string>();
    const getPngForCode = (code: string) => {
      if (!pngCache.has(code)) {
        pngCache.set(
          code,
          renderCode128MonochromePngDataUrl(code, FIXED_LABEL_CONFIG.labelWidthMm, 68)
        );
      }
      return pngCache.get(code) || "";
    };

    for (let i = 0; i < expandedLabels.length; i += cols) {
      const rowItems = expandedLabels.slice(i, i + cols);
      const cellsHtml = rowItems
        .map((item) => {
          const pngDataUrl = getPngForCode(item.code);
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
                <img class="barcode-img" src="${pngDataUrl}" alt="${escapeHtml(item.code)}" />
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
    }
    .label-page {
      width: 70mm;
      height: ${safePrintHeightMm}mm;
      max-height: ${safePrintHeightMm}mm;
      display: grid;
      grid-template-columns: 34.5mm 34.5mm;
      column-gap: 1mm;
      align-items: stretch;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      background: #ffffff;
      filter: contrast(200%);
    }
    .label-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .label-cell {
      width: 34.5mm;
      height: ${safePrintHeightMm}mm;
      padding: 0.15mm 0.4mm;
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
      width: 98%;
      flex: 1 1 auto;
      min-height: 4.2mm;
      max-height: ${showProductName ? "9.0mm" : "12.0mm"};
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      overflow: hidden;
    }
    .barcode-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: fill;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
    .label-code {
      width: 100%;
      flex-shrink: 0;
      font-family: "Courier New", Consolas, monospace;
      font-size: 6.5pt;
      font-weight: 800;
      letter-spacing: 0.08em;
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
    const cleanCode = sanitizeAscii(item.code);
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
          padding: "3px 5px",
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
            width: "96%",
            height: previewBarHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          dangerouslySetInnerHTML={{
            __html: renderCode128SvgString(item.code, previewBarHeight)
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
            letterSpacing: "0.08em",
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
              Chưa nhập giá bán
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 880,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8"
              }}
            >
              <Printer size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Cấu hình cố định: Khổ 2 cột 70 × 20 mm (2 tem 35×20mm / hàng) • Chuẩn 203 DPI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 18,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 18
          }}
        >
          {/* Left column: Printer + Options + Product list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 1. KẾT NỐI MÁY IN */}
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: 12,
                padding: 12
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#14532d",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Usb size={14} color="#16a34a" />
                  Máy in tem nhiệt (Khổ 2 cột 70 × 20 mm)
                </div>
                <button
                  type="button"
                  onClick={fetchPrintersList}
                  disabled={isScanningPrinters}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#15803d",
                    backgroundColor: "#dcfce7",
                    border: "1px solid #86efac",
                    borderRadius: 6,
                    padding: "3px 8px",
                    cursor: isScanningPrinters ? "wait" : "pointer"
                  }}
                >
                  <RefreshCw size={11} className={isScanningPrinters ? "animate-spin" : ""} />
                  {isScanningPrinters ? "Đang quét..." : "Quét lại"}
                </button>
              </div>

              {printers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => handleSelectPrinter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1.5px solid #22c55e",
                      backgroundColor: "#ffffff",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    {printers.map((p) => (
                      <option key={p.Name} value={p.Name}>
                        {p.IsOnline ? "🟢 [ĐANG BẬT]" : "⚪ [OFFLINE]"} {p.Name} ({p.PortName})
                        {p.IsThermal ? " — Máy in tem nhiệt" : ""}
                      </option>
                    ))}
                  </select>

                  {currentPrinterObj && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: currentPrinterObj.IsOnline ? "#15803d" : "#b45309",
                        backgroundColor: currentPrinterObj.IsOnline ? "#dcfce7" : "#fef3c7",
                        padding: "5px 9px",
                        borderRadius: 6,
                        fontWeight: 600
                      }}
                    >
                      <span>
                        Cổng: <strong>{currentPrinterObj.PortName}</strong> • Khổ:{" "}
                        <strong>70×20mm (2 cột)</strong>
                      </span>
                      <span>
                        {currentPrinterObj.IsOnline ? "✓ Sẵn sàng in" : "⚠ Offline"}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    backgroundColor: "#ffffff",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px dashed #cbd5e1"
                  }}
                >
                  {isScanningPrinters
                    ? "Đang tìm máy in Xprinter trên thiết bị..."
                    : "Nếu dùng trên máy tính khác, hãy chạy file KetNoiMayInTem-11Sport.bat hoặc bấm 'In qua trình duyệt (Ctrl+P)'."}
                </div>
              )}
            </div>

            {/* 2. Tuỳ chọn hiển thị & Cỡ chữ tên sản phẩm */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showShopName}
                      onChange={(e) => setShowShopName(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In tên cửa hàng ({shopName})
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => setShowProductName(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In tên sản phẩm
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In giá bán lẻ
                  </label>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0284c7",
                    backgroundColor: "#e0f2fe",
                    padding: "3px 8px",
                    borderRadius: 6
                  }}
                >
                  2 tem / hàng (35×20mm)
                </span>
              </div>

              {showProductName && (
                <div
                  style={{
                    paddingTop: 9,
                    borderTop: "1px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                      Cỡ chữ tên SP:
                    </span>
                    {[
                      { label: "Tự động", val: 0 },
                      { label: "Nhỏ", val: 14 },
                      { label: "Vừa", val: 18 },
                      { label: "Lớn", val: 22 }
                    ].map((opt) => {
                      const active = nameFontSizePx === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setNameFontSizePx(opt.val)}
                          style={{
                            padding: "3px 8px",
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: 6,
                            border: active ? "1px solid #0284c7" : "1px solid #cbd5e1",
                            backgroundColor: active ? "#0284c7" : "#ffffff",
                            color: active ? "#ffffff" : "#334155",
                            cursor: "pointer"
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        padding: "1px 4px",
                        marginLeft: 2
                      }}
                    >
                      <button
                        type="button"
                        title="Giảm cỡ chữ tên sản phẩm"
                        onClick={() => {
                          const cur =
                            nameFontSizePx > 0
                              ? nameFontSizePx
                              : getEffectiveNameFontPx(previewItem?.name || "", 0);
                          setNameFontSizePx(Math.max(10, cur - 1));
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#334155"
                        }}
                      >
                        <Minus size={12} />
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#0f172a",
                          minWidth: 36,
                          textAlign: "center"
                        }}
                      >
                        {nameFontSizePx === 0 ? "Auto" : `${nameFontSizePx}px`}
                      </span>
                      <button
                        type="button"
                        title="Tăng cỡ chữ tên sản phẩm"
                        onClick={() => {
                          const cur =
                            nameFontSizePx > 0
                              ? nameFontSizePx
                              : getEffectiveNameFontPx(previewItem?.name || "", 0);
                          setNameFontSizePx(Math.min(26, cur + 1));
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#334155"
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={wrapProductName}
                      onChange={(e) => setWrapProductName(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#0284c7" }}
                    />
                    Tự xuống 2 dòng khi tên dài
                  </label>
                </div>
              )}
            </div>

            {/* 3. Danh sách sản phẩm & số lượng tem */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "9px 14px",
                  backgroundColor: "#f1f5f9",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155"
                }}
              >
                <span>DANH SÁCH SẢN PHẨM ({normalizedItems.length})</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      normalizedItems.forEach((it) => {
                        next[it.id] = 2;
                      });
                      setQuantities(next);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0284c7",
                      background: "#e0f2fe",
                      border: "none",
                      borderRadius: 6,
                      padding: "3px 8px",
                      cursor: "pointer"
                    }}
                  >
                    Đặt tất cả = 2 (1 hàng)
                  </button>
                  <span>Tổng: {totalLabels} tem</span>
                </div>
              </div>

              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                {normalizedItems.map((item) => {
                  const qty = quantities[item.id] || 0;
                  const effPrice = getEffectiveItemPrice(item);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        backgroundColor: qty > 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {item.name}
                          {item.attrLabel ? (
                            <span style={{ color: "#4338ca", fontWeight: 700, marginLeft: 6, fontSize: 12 }}>
                              ({item.attrLabel})
                            </span>
                          ) : null}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 3
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#0369a1",
                              backgroundColor: "#e0f2fe",
                              padding: "1px 6px",
                              borderRadius: 4
                            }}
                          >
                            {item.code}
                          </span>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Giá:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={effPrice > 0 ? formatNumberDots(effPrice) : ""}
                              placeholder="Nhập giá bán..."
                              onChange={(e) => {
                                const nextVal = parseNumberDots(e.target.value);
                                setCustomPrices((prev) => ({
                                  ...prev,
                                  [item.id]: nextVal,
                                }));
                              }}
                              style={{
                                width: 92,
                                padding: "2px 6px",
                                borderRadius: 5,
                                border: effPrice > 0 ? "1px solid #cbd5e1" : "1px solid #f59e0b",
                                backgroundColor: effPrice > 0 ? "#ffffff" : "#fffbeb",
                                color: effPrice > 0 ? "#0f172a" : "#b45309",
                                fontFamily: "monospace",
                                fontSize: 11.5,
                                fontWeight: 700,
                                textAlign: "right"
                              }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>đ</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={qty}
                          onChange={(e) => setExactQty(item.id, parseInt(e.target.value, 10))}
                          style={{
                            width: 52,
                            height: 28,
                            textAlign: "center",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: 2-Column 70x20mm Live Preview + Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
            >
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase"
                  }}
                >
                  Xem trước 1 hàng 2 cột (70 × 20 mm)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#0284c7",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Sparkles size={12} /> 2 tem 35×20mm
                </span>
              </div>

              {previewItem ? (
                <div
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: "10px",
                    backgroundColor: "#e2e8f0",
                    borderRadius: 10
                  }}
                >
                  {renderSingleStickerPreview(previewItem, "Cột 1")}
                  {renderSingleStickerPreview(previewItem, "Cột 2")}
                </div>
              ) : (
                <div style={{ padding: 24, color: "#94a3b8", fontSize: 13 }}>
                  Chưa có sản phẩm để xem trước
                </div>
              )}
            </div>

            {/* Print Status Feedback */}
            {printStatusMsg && (
              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 12,
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  backgroundColor:
                    printStatusMsg.type === "success"
                      ? "#dcfce7"
                      : printStatusMsg.type === "error"
                        ? "#fee2e2"
                        : "#e0f2fe",
                  border:
                    printStatusMsg.type === "success"
                      ? "1px solid #86efac"
                      : printStatusMsg.type === "error"
                        ? "1px solid #fca5a5"
                        : "1px solid #7dd3fc",
                  color:
                    printStatusMsg.type === "success"
                      ? "#14532d"
                      : printStatusMsg.type === "error"
                        ? "#7f1d1d"
                        : "#0c4a6e"
                }}
              >
                {printStatusMsg.type === "success" ? (
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <span>{printStatusMsg.text}</span>
              </div>
            )}

            {/* Info Box */}
            <div
              style={{
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: 12,
                fontSize: 11.5,
                color: "#1e3a8a",
                lineHeight: 1.5
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#1d4ed8"
                }}
              >
                <MonitorCheck size={14} />
                Đã cố định chuẩn máy in 2 cột 70 × 20 mm:
              </div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>
                  Mỗi hàng giấy in song song <strong>2 tem (Trái & Phải, mỗi tem 35×20mm)</strong>, không còn bị lệch vào khe giữa 2 cột.
                </li>
                <li>
                  Đã lược bỏ phần Phân loại/ĐVT để mã vạch 1D rộng và cao tối đa trên tem 35×20mm, giúp máy quét bắt nhạy ngay lập tức.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div style={{ fontSize: 13, color: "#475569" }}>
            Tổng số lượng in:{" "}
            <strong style={{ color: "#0f172a", fontSize: 15 }}>{totalLabels} tem</strong> (
            <strong>{totalRows} hàng</strong> giấy 70×20mm)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 15px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={totalLabels <= 0}
              onClick={handleBrowserPrintDialog}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #0284c7",
                backgroundColor: "#f0f9ff",
                color: "#0369a1",
                fontSize: 13,
                fontWeight: 700,
                cursor: totalLabels > 0 ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Layers size={15} />
              In qua trình duyệt (Ctrl+P)
            </button>

            <button
              type="button"
              disabled={totalLabels <= 0 || isPrintingDirect}
              onClick={handleDirectWindowsPrint}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background:
                  totalLabels > 0
                    ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                    : "#94a3b8",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: totalLabels > 0 && !isPrintingDirect ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow:
                  totalLabels > 0 ? "0 4px 12px rgba(22, 163, 74, 0.35)" : "none"
              }}
            >
              <Printer size={16} />
              {isPrintingDirect
                ? "Đang gửi lệnh in..."
                : selectedPrinter
                  ? `In thẳng ra ${selectedPrinter} (${totalLabels} tem)`
                  : `In ngay (${totalLabels} tem)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

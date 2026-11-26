import { apiRequest } from "@/shared/api/client";
import { fetchFirstOkJson } from "@/shared/api/localFetch";
import { Product } from "@/shared/types";
import { generateVariantProductCode,toCompactBarcode128 } from "@/shared/utils/productCode";
import { useEffect,useMemo,useRef,useState } from "react";
import {
BarcodeLabelModalProps,
FIXED_LABEL_CONFIG,
NormalizedLabelItem,
PRINTER_STORAGE_KEY,
sanitizeAscii,
SystemPrinterInfo
} from "./barcodeLabelCode128";
import { openBrowserPrintDialog } from "./barcodePrintDialog";
import { BarcodeStickerPreview } from "./BarcodeStickerPreview";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

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
        API_ENDPOINTS.PRINTERS.NEXT_API,
        API_ENDPOINTS.PRINTERS.LOCAL_LIST[0],
        API_ENDPOINTS.PRINTERS.LOCAL_LIST[1]
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
        API_ENDPOINTS.PRINTERS.NEXT_API,
        API_ENDPOINTS.PRINTERS.LOCAL_PRINT_LABELS[0],
        API_ENDPOINTS.PRINTERS.LOCAL_PRINT_LABELS[1]
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
  const handleBrowserPrintDialog = () =>
    openBrowserPrintDialog({
      totalLabels,
      normalizedItems,
      quantities,
      getEffectiveItemPrice,
      showShopName,
      shopName,
      showProductName,
      wrapProductName,
      nameFontSizePx,
      getEffectiveNameFontPx,
      showPrice,
      printIframeRef,
    });

  const previewItem =
    normalizedItems.find((it) => (quantities[it.id] || 0) > 0) || normalizedItems[0];

  const renderSingleStickerPreview = (item: NormalizedLabelItem | undefined, indexLabel: string) => (
    <BarcodeStickerPreview
      item={item}
      indexLabel={indexLabel}
      getEffectiveItemPrice={getEffectiveItemPrice}
      getEffectiveNameFontPx={getEffectiveNameFontPx}
      nameFontSizePx={nameFontSizePx}
      showProductName={showProductName}
      wrapProductName={wrapProductName}
      showShopName={showShopName}
      shopName={shopName}
      showPrice={showPrice}
    />
  );


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

import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { lookupProductByCodeApi } from "@/shared/api/catalogLookup";
import type { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/shared/lib/barcodeScanner";
import { getFloor1Stock } from "../utils/stock";
import type { InventoryWarehouse } from "../types";

interface Params {
  products: Product[];
  allCatalogProducts: Product[];
  setAllCatalogProducts: Dispatch<SetStateAction<Product[]>>;
  effectiveWarehouse: InventoryWarehouse;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  setExpandedProdIds: Dispatch<SetStateAction<Set<string>>>;
  labelModalItems: BarcodeLabelItem[] | null;
}

export function useInventoryScanner({
  products,
  allCatalogProducts,
  setAllCatalogProducts,
  effectiveWarehouse,
  variantCodeFor,
  setExpandedProdIds,
  labelModalItems,
}: Params) {
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [showScannerPanel, setShowScannerPanel] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannedCheckCounts, setScannedCheckCounts] = useState<Record<string, number>>({});
  const [scannedVariantCounts, setScannedVariantCounts] = useState<
    Record<string, Record<string, number>>
  >({});
  const [lastScannedProdId, setLastScannedProdId] = useState<string | null>(null);
  const [lastScannedVariantCode, setLastScannedVariantCode] = useState<string | null>(null);
  const [onlyShowScanned, setOnlyShowScanned] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);

  const handleBarcodeScanForInventoryCheck = useCallback(
    async (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;
      let scanRes = findProductAndVariantByScannedBarcode(pool, rawTrimmed);

      if (!scanRes) {
        try {
          const hit = await lookupProductByCodeApi(rawTrimmed);
          if (hit?.product) {
            const v = hit.variant;
            scanRes = {
              product: hit.product,
              matchedVariant: v
                ? {
                    ...v,
                    variantCode: v.variantCode || v.barcode || hit.product.code,
                    stockFloor1: Number(v.stockFloor1 || 0),
                    stockFloor2: Number(v.stockFloor2 || 0),
                    stock: Number(v.stock || 0),
                  }
                : undefined,
              isVariantExactMatch: Boolean(v),
            };
          }
        } catch {
          // ignore
        }
      }

      if (!scanRes) {
        try {
          const freshRes = await apiRequest<Product[]>("/products");
          const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
          if (freshPool.length > 0) {
            setAllCatalogProducts(freshPool);
            scanRes = findProductAndVariantByScannedBarcode(freshPool, rawTrimmed);
          }
        } catch {
          // ignore
        }
      }

      if (!scanRes) {
        playScannerBeep("error");
        const cleaned = cleanBarcodeCode(rawTrimmed);
        setLastScanFeedback({
          type: "error",
          code: cleaned || rawTrimmed,
          message: `Không tìm thấy sản phẩm hoặc mã con "${rawTrimmed}" trong kho.`,
          time: nowStr,
        });
        return;
      }

      const { product, matchedVariant } = scanRes;

      setExpandedProdIds((prev) => {
        const next = new Set(prev);
        next.add(product._id);
        return next;
      });
      setLastScannedProdId(product._id);

      const prevCount = scannedCheckCounts[product._id] || 0;
      const nextCount = prevCount + 1;
      setScannedCheckCounts((prev) => ({
        ...prev,
        [product._id]: nextCount,
      }));

      if (matchedVariant && (matchedVariant.color || matchedVariant.size)) {
        const childCode =
          matchedVariant.variantCode ||
          variantCodeFor(product.code, matchedVariant.color, matchedVariant.size);
        setLastScannedVariantCode(childCode);
        const prevVarCount = scannedVariantCounts[product._id]?.[childCode] || 0;
        const nextVarCount = prevVarCount + 1;
        setScannedVariantCounts((prev) => ({
          ...prev,
          [product._id]: {
            ...(prev[product._id] || {}),
            [childCode]: nextVarCount,
          },
        }));

        const varSysStock =
          effectiveWarehouse === "FLOOR_1"
            ? Number(matchedVariant.stockFloor1 || 0)
            : effectiveWarehouse === "FLOOR_2"
              ? Number(matchedVariant.stockFloor2 || 0)
              : Number(matchedVariant.stock || 0);

        const isOver = varSysStock > 0 && nextVarCount > varSysStock;
        const isExact = varSysStock > 0 && nextVarCount === varSysStock;
        playScannerBeep(isOver ? "warning" : "success");

        const attrDesc = [
          matchedVariant.color,
          matchedVariant.size ? `Size ${matchedVariant.size}` : "",
        ]
          .filter(Boolean)
          .join(" - ");

        setLastScanFeedback({
          type: isOver ? "warning" : "success",
          code: childCode,
          message: `[${childCode}] ${product.name} (${attrDesc}) • Đã quét mã con: ${nextVarCount} / Tồn biến thể: ${varSysStock} ${product.unit}${
            isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextVarCount - varSysStock})` : ""
          }`,
          time: nowStr,
        });
        return;
      }

      setLastScannedVariantCode(null);
      const sysStock =
        effectiveWarehouse === "FLOOR_1"
          ? getFloor1Stock(product)
          : effectiveWarehouse === "FLOOR_2"
            ? Number(product.stockFloor2 || 0)
            : Number(product.stock || 0);

      const isOver = sysStock > 0 && nextCount > sysStock;
      const isExact = sysStock > 0 && nextCount === sysStock;
      playScannerBeep(isOver ? "warning" : "success");

      setLastScanFeedback({
        type: isOver ? "warning" : "success",
        code: product.code,
        message: `[${product.code}] ${product.name} • Đã quét kiểm: ${nextCount} / Tồn hệ thống: ${sysStock} ${product.unit}${
          isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextCount - sysStock})` : ""
        }`,
        time: nowStr,
      });
    },
    [allCatalogProducts, products, scannedCheckCounts, scannedVariantCounts, effectiveWarehouse]
  );

  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !labelModalItems,
    onScan: (code) => {
      handleBarcodeScanForInventoryCheck(code);
    },
  });

  return {
    scannerEnabled,
    setScannerEnabled,
    showScannerPanel,
    setShowScannerPanel,
    scannerInput,
    setScannerInput,
    scannedCheckCounts,
    setScannedCheckCounts,
    scannedVariantCounts,
    setScannedVariantCounts,
    lastScannedProdId,
    setLastScannedProdId,
    lastScannedVariantCode,
    setLastScannedVariantCode,
    onlyShowScanned,
    setOnlyShowScanned,
    lastScanFeedback,
    setLastScanFeedback,
    handleBarcodeScanForInventoryCheck,
  };
}

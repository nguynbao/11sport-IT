import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import BarcodeLabelModal, { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import ProductCodeCreatorModal, { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import {
  ColorInputWithPicker,
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  isScannedCodeMatch,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/shared/lib/barcodeScanner";
import { exportProducts, exportInventoryReport, exportMovements, exportImports } from "../exports";
import { Product, ProductVariant, Category, StockMovement, InventoryReportRow, WarehouseFloor, Brand } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { formatVND, formatNumberDots, parseNumberDots, formatDateTime, formatVariantLabel } from "@/shared/utils/format";
import { resolveVariantCode, findVariantByColorSize, variantEffectiveSellingPrice, variantEffectiveCostPrice, extractVariantFromText } from "@/shared/utils/productCode";
import { lookupProductByCodeApi, fetchBrandsApi } from "@/shared/api/catalogLookup";
import { describeApiError } from "@/shared/api/errors";
import { useDebounce, filterAndRankBySearch } from "@/shared/lib/search";
import {
  Package,
  BarChart3,
  BookOpen,
  ClipboardList,
  Save,
  Pencil,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  ArrowLeftRight,
  Eye,
  History,
  UserCheck,
  X,
  RotateCcw,
  Printer,
  Upload,
  Download,
  CopyPlus,
  CheckSquare,
  ScanBarcode,
} from "lucide-react";
import {
  AdminImportRow,
  SubTab,
  HistoryView,
  ActiveWarehouseTab,
  QuickStockFilter,
  COMMON_COLORS,
  COMMON_SIZES,
} from "../types";


import type { InventoryState } from "./useInventoryState";

export interface InventoryScannerDeps {
  state: InventoryState;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  getDisplayedProducts: () => Product[];
  activeWarehouseLabel: string;
  handleSelectAdminRowSuggestion: (rowIdx: number, prod: Product) => void;
  handleSelectAdminRowVariant: (rowIdx: number, prod: Product, selectedVal: string) => void;
}

export function useInventoryScanner(deps: InventoryScannerDeps) {
  const {
    state,
    variantCodeFor,
    getDisplayedProducts,
    activeWarehouseLabel,
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
  } = deps;
  const {
    subTab,
    activeWarehouse,
    products,
    categories,
    categoryId,
    setProdPage,
    prodPageSize,
    showAdminImportModal,
    newProdCatId,
    adminImportRows,
    setAdminImportRows,
    allCatalogProducts,
    setAllCatalogProducts,
    setExpandedVariantProdId,
    showLabelModal,
    scannerEnabled,
    scannedCheckCounts,
    setScannedCheckCounts,
    scannedVariantCounts,
    setScannedVariantCounts,
    setLastScannedProdId,
    setLastScannedVariantCode,
    setLastScanFeedback,
  } = state;

  const handleBarcodeScanInCms = useCallback(
    async (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;

      const findWithRemoteRetry = async (code: string) => {
        const localHit = findProductAndVariantByScannedBarcode(pool, code);
        if (localHit) return localHit;
        // v5.0: tra cứu server theo mã mới / mã con / mã cũ (legacy) / mã rút gọn tem cũ
        try {
          const hit = await lookupProductByCodeApi(code);
          if (hit?.product) {
            const v = hit.variant;
            return {
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
          // ignore -> thử tải lại danh mục
        }
        try {
          const freshRes = await apiRequest<Product[]>("/products");
          const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
          if (freshPool.length > 0) {
            setAllCatalogProducts(freshPool);
            return findProductAndVariantByScannedBarcode(freshPool, code);
          }
        } catch {
          // ignore network error
        }
        return undefined;
      };

      // Nếu đang mở Popup Nhập Kho Admin -> Quét mã để cộng SL hoặc thêm dòng vào bảng nhập kho
      if (showAdminImportModal) {
        const exactChildIdx = adminImportRows.findIndex(
          (r) =>
            r.productCode &&
            (r.color || r.size) &&
            isScannedCodeMatch(
              rawTrimmed,
              variantCodeFor(r.productCode, r.color, r.size)
            )
        );
        const matchedRowIdx =
          exactChildIdx >= 0
            ? exactChildIdx
            : adminImportRows.findIndex(
              (r) => r.productCode && isScannedCodeMatch(rawTrimmed, r.productCode)
            );
        if (matchedRowIdx >= 0) {
          setAdminImportRows((prev) =>
            prev.map((r, i) =>
              i === matchedRowIdx
                ? { ...r, quantity: (Number(r.quantity) || 0) + 1, isConfirmed: true }
                : r
            )
          );
          const row = adminImportRows[matchedRowIdx];
          const rowCode = variantCodeFor(row.productCode, row.color, row.size);
          playScannerBeep("success");
          setLastScanFeedback({
            type: "success",
            code: rowCode,
            message: `Đã cộng +1 vào dòng #${matchedRowIdx + 1} [${rowCode}] ${row.productName} (SL: ${(Number(row.quantity) || 0) + 1})`,
            time: nowStr,
          });
          return;
        }

        const scanRes = await findWithRemoteRetry(rawTrimmed);
        if (scanRes) {
          const { product, matchedVariant } = scanRes;
          const catId =
            typeof product.categoryId === "object"
              ? product.categoryId?._id || ""
              : String(product.categoryId || "");
          const vColor = matchedVariant?.color || "";
          const vSize = matchedVariant?.size || "";
          const childCode = variantCodeFor(product.code, vColor, vSize);
          setAdminImportRows((prev) => {
            const isSingleBlank =
              prev.length === 1 && !prev[0].productCode.trim() && !prev[0].productName.trim();
            const newRow: AdminImportRow = {
              stt: isSingleBlank ? 1 : prev.length + 1,
              productId: product._id,
              productCode: product.code,
              productName: product.name,
              categoryId: catId || newProdCatId || categories[0]?._id || "",
              brand: product.brand || "",
              color: vColor,
              size: vSize,
              unit: product.unit || "Cái",
              quantity: 1,
              costPrice: Number(product.costPrice || 0),
              sellingPrice: Number(product.sellingPrice || 0),
              note: "Quét từ máy quét label",
              isConfirmed: true,
            };
            return isSingleBlank ? [newRow] : [...prev, newRow];
          });
          playScannerBeep("success");
          setLastScanFeedback({
            type: "success",
            code: childCode,
            message: `Đã thêm [${childCode}] ${product.name}${vColor || vSize ? ` (${[vColor, vSize].filter(Boolean).join(" - ")})` : ""
              } vào bảng nhập kho (SL: 1)`,
            time: nowStr,
          });
          return;
        }

        playScannerBeep("error");
        setLastScanFeedback({
          type: "error",
          code: cleanBarcodeCode(rawTrimmed),
          message: `Không tìm thấy mã "${rawTrimmed}" trong danh mục để thêm tự động.`,
          time: nowStr,
        });
        return;
      }

      // Mặc định: Quét kiểm hàng & đối chiếu tồn kho trên tab PRODUCTS (ưu tiên khớp chính xác Mã con thuộc tính)
      const scanRes = await findWithRemoteRetry(rawTrimmed);
      if (!scanRes) {
        playScannerBeep("error");
        setLastScanFeedback({
          type: "error",
          code: cleanBarcodeCode(rawTrimmed),
          message: `Không tìm thấy sản phẩm hoặc mã con "${rawTrimmed}" trong kho.`,
          time: nowStr,
        });
        return;
      }

      const { product, matchedVariant } = scanRes;
      setLastScannedProdId(product._id);
      setExpandedVariantProdId(product._id);
      const prevCount = scannedCheckCounts[product._id] || 0;
      const nextCount = prevCount + 1;
      setScannedCheckCounts((prev) => ({
        ...prev,
        [product._id]: nextCount,
      }));

      // Tự động chuyển tới trang có sản phẩm vừa quét nếu đang phân trang
      const idxInDisplayed = getDisplayedProducts().findIndex((p) => p._id === product._id);
      if (idxInDisplayed >= 0 && prodPageSize > 0) {
        const targetPage = Math.floor(idxInDisplayed / prodPageSize) + 1;
        setProdPage(targetPage);
      }

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

        const varF1 = Number(matchedVariant.stockFloor1 || 0);
        const varF2 = Number(matchedVariant.stockFloor2 || 0);
        const varSysStock =
          activeWarehouse === "FLOOR_1"
            ? varF1
            : activeWarehouse === "FLOOR_2"
              ? varF2
              : varF1 + varF2;
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
          message: `[${childCode}] ${product.name} (${attrDesc}) • Đã quét mã con: ${nextVarCount} / Tồn biến thể (${activeWarehouseLabel}): ${varSysStock} ${product.unit || "Cái"}${isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextVarCount - varSysStock})` : ""
            }`,
          time: nowStr,
        });
        return;
      }

      setLastScannedVariantCode(null);
      const f1 = Number(product.stockFloor1 ?? product.stock ?? 0);
      const f2 = Number(product.stockFloor2 ?? 0);
      const sysStock =
        activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : f1 + f2;
      const isOver = sysStock > 0 && nextCount > sysStock;
      const isExact = sysStock > 0 && nextCount === sysStock;
      playScannerBeep(isOver ? "warning" : "success");

      setLastScanFeedback({
        type: isOver ? "warning" : "success",
        code: product.code,
        message: `[${product.code}] ${product.name} • Đã quét kiểm: ${nextCount} / Tồn ${activeWarehouseLabel}: ${sysStock} ${product.unit || "Cái"}${isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextCount - sysStock})` : ""
          }`,
        time: nowStr,
      });
    },
    [
      allCatalogProducts,
      products,
      showAdminImportModal,
      adminImportRows,
      newProdCatId,
      categories,
      scannedCheckCounts,
      scannedVariantCounts,
      getDisplayedProducts,
      prodPageSize,
      activeWarehouse,
      activeWarehouseLabel,
      variantCodeFor,
    ]
  );

  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !showLabelModal && (subTab === "PRODUCTS" || showAdminImportModal),
    onScan: (code) => {
      handleBarcodeScanInCms(code);
    },
  });

  return {
    handleBarcodeScanInCms,
  };
}

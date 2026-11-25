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

export interface InventorySetLinkDeps {
  state: InventoryState;
  loadProductsAndCats: () => Promise<void>;
  loadCategoriesAndImports: () => Promise<void>;
  loadMovements: () => Promise<void>;
}

export function useInventorySetLink(deps: InventorySetLinkDeps) {
  const {
    state,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadMovements,
  } = deps;
  const {
    activeWarehouse,
    products,
    categoryId,
    setLinkModalProduct,
    setSetLinkModalProduct,
    setLinkMode,
    setSetLinkMode,
    selectedParentSetId,
    setSelectedParentSetId,
    packSizeInput,
    setPackSizeInput,
    setSetLinkSearch,
    setChildMode,
    setSetChildMode,
    selectedExistingRetailId,
    setSelectedExistingRetailId,
    newRetailName,
    setNewRetailName,
    newRetailUnit,
    setNewRetailUnit,
    newRetailSellingPrice,
    setNewRetailSellingPrice,
    setModalUnpackCount,
    setModalUnpackWarehouse,
    setSavingSetLink,
    setUnpackingLoadingId,
    setStatusMsg,
  } = state;

  const handleOpenSetLinkModal = (prod: Product) => {
    const isLikelySet =
      (Array.isArray(prod.linkedRetailProducts) && prod.linkedRetailProducts.length > 0) ||
      (!prod.parentSetProductId &&
        /hộp|bộ|ống|lốc|thùng|set|box|pack|túi/i.test(`${prod.unit || ""} ${prod.name || ""}`));
    setSetLinkModalProduct(prod);
    setSetLinkMode(isLikelySet ? "AS_SET" : "AS_RETAIL");
    setSelectedParentSetId(prod.parentSetProductId || "");
    setPackSizeInput(
      prod.packSize && prod.packSize > 0
        ? prod.packSize
        : prod.linkedRetailProducts?.[0]?.packSize || 12
    );
    setSetLinkSearch("");
    setSetChildMode("CREATE_NEW_RETAIL");
    setSelectedExistingRetailId(prod.linkedRetailProducts?.[0]?._id || "");
    const cleanBaseName = prod.name.replace(/\s*\((?:hộp|bộ|ống|lốc|set)[^)]*\)/gi, "").trim();
    setNewRetailName(`${cleanBaseName} (Bán lẻ)`);
    setNewRetailUnit(/ống|cầu/i.test(prod.name) ? "Quả" : /vớ|tất|giày/i.test(prod.name) ? "Đôi" : "Cái");
    const defaultPack = prod.linkedRetailProducts?.[0]?.packSize || 12;
    setNewRetailSellingPrice(
      prod.sellingPrice > 0 ? Math.ceil(prod.sellingPrice / defaultPack / 1000) * 1000 : 0
    );
    setModalUnpackCount(1);
    setModalUnpackWarehouse(activeWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
  };

  const handleQuickUnpackSet = async (
    retailProductId: string,
    setsToUnpack = 1,
    warehouseOverride?: WarehouseFloor
  ) => {
    const targetWh: WarehouseFloor =
      warehouseOverride || (activeWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1");
    setUnpackingLoadingId(retailProductId);
    setStatusMsg(null);
    try {
      const res = await apiRequest<any>("/inventory/unpack-set", {
        method: "POST",
        body: JSON.stringify({
          retailProductId,
          setsToUnpack,
          warehouse: targetWh,
          reason: "Tách bộ 1 chạm trên CMS",
        }),
      });
      const d = res.data;
      const whLabel = targetWh === "FLOOR_2" ? "Kho Tầng 2" : "Kho Tầng 1";
      setStatusMsg({
        type: "success",
        text: `⚡ Đã tách ${d.setsUnpacked} ${d.setProduct?.unit || "Bộ"} "${d.setProduct?.name}" (-${d.setsUnpacked} ${d.setProduct?.unit || "Bộ"}) → Cộng +${d.addedRetailQuantity} ${d.retailProduct?.unit || "Cái"} vào "${d.retailProduct?.name}" tại ${whLabel} (Mã phiếu: ${d.referenceCode})!`,
      });
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports(), loadMovements()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể tách sản phẩm bộ sang lẻ.",
      });
    } finally {
      setUnpackingLoadingId(null);
    }
  };

  const handleSaveSetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setLinkModalProduct) return;
    const validPack = Math.max(1, Math.round(Number(packSizeInput) || 0));
    setSavingSetLink(true);
    setStatusMsg(null);
    try {
      if (setLinkMode === "AS_RETAIL") {
        if (!selectedParentSetId) {
          setStatusMsg({
            type: "error",
            text: "Vui lòng chọn Sản phẩm Bộ/Hộp gốc để liên kết.",
          });
          setSavingSetLink(false);
          return;
        }
        await apiRequest(`/products/${setLinkModalProduct._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            parentSetProductId: selectedParentSetId,
            packSize: validPack,
          }),
        });
        setStatusMsg({
          type: "success",
          text: `Đã liên kết "${setLinkModalProduct.name}" với Sản phẩm Bộ (Tỷ lệ: 1 Bộ = ${validPack} ${setLinkModalProduct.unit}). Khi bán lẻ hết hàng tại Tầng 1, hệ thống sẽ tự động trừ 1 Bộ và cộng +${validPack} ${setLinkModalProduct.unit}!`,
        });
      } else {
        if (setChildMode === "EXISTING_RETAIL") {
          if (!selectedExistingRetailId) {
            setStatusMsg({
              type: "error",
              text: "Vui lòng chọn Sản phẩm Lẻ có sẵn để gắn vào Bộ này.",
            });
            setSavingSetLink(false);
            return;
          }
          await apiRequest(`/products/${selectedExistingRetailId}`, {
            method: "PATCH",
            body: JSON.stringify({
              parentSetProductId: setLinkModalProduct._id,
              packSize: validPack,
            }),
          });
          setStatusMsg({
            type: "success",
            text: `Đã gắn Sản phẩm Lẻ vào Bộ "${setLinkModalProduct.name}" (1 ${setLinkModalProduct.unit} = ${validPack} đơn vị lẻ)!`,
          });
        } else {
          const cleanName = newRetailName.trim();
          if (!cleanName) {
            setStatusMsg({
              type: "error",
              text: "Vui lòng nhập tên cho Sản phẩm Lẻ mới.",
            });
            setSavingSetLink(false);
            return;
          }
          const catId =
            typeof setLinkModalProduct.categoryId === "object"
              ? setLinkModalProduct.categoryId?._id || ""
              : String(setLinkModalProduct.categoryId || "");
          const estCost =
            Number(setLinkModalProduct.costPrice) > 0
              ? Math.round(Number(setLinkModalProduct.costPrice) / validPack)
              : 0;
          await apiRequest("/products", {
            method: "POST",
            body: JSON.stringify({
              name: cleanName,
              brand: setLinkModalProduct.brand || "",
              categoryId: catId,
              unit: newRetailUnit.trim() || "Cái",
              sellingPrice: Math.max(0, Math.round(Number(newRetailSellingPrice) || 0)),
              costPrice: estCost,
              quantity: 0,
              targetWarehouse: "FLOOR_1",
              parentSetProductId: setLinkModalProduct._id,
              packSize: validPack,
            }),
          });
          setStatusMsg({
            type: "success",
            text: `Đã tạo mới Sản phẩm Lẻ "${cleanName}" và liên kết tự động với Bộ "${setLinkModalProduct.name}" (1 ${setLinkModalProduct.unit} = ${validPack} ${newRetailUnit.trim() || "Cái"})!`,
          });
        }
      }
      setSetLinkModalProduct(null);
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể lưu cấu hình liên kết Bộ ↔ Lẻ.",
      });
    } finally {
      setSavingSetLink(false);
    }
  };

  const handleClearSetLink = async (retailProdId: string) => {
    setSavingSetLink(true);
    try {
      await apiRequest(`/products/${retailProdId}`, {
        method: "PATCH",
        body: JSON.stringify({
          parentSetProductId: "",
          packSize: 0,
        }),
      });
      setStatusMsg({
        type: "success",
        text: "Đã gỡ liên kết Sản phẩm Bộ ↔ Lẻ.",
      });
      setSetLinkModalProduct(null);
      await Promise.all([loadProductsAndCats(), loadCategoriesAndImports()]);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể gỡ liên kết.",
      });
    } finally {
      setSavingSetLink(false);
    }
  };

  // Lọc sản phẩm theo Kho đang chọn (Kho Tầng 1 / Kho Tầng 2 / Xem gộp cả 2 Kho) + Smart Search tức thì

  return {
    handleOpenSetLinkModal,
    handleQuickUnpackSet,
    handleSaveSetLink,
    handleClearSetLink,
  };
}

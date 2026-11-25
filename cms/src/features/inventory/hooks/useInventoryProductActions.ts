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


import { useInventoryVariantActions } from "./useInventoryVariantActions";
import type { InventoryState } from "./useInventoryState";

export interface InventoryProductActionsDeps {
  state: InventoryState;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
  loadProductsAndCats: () => Promise<void>;
  loadCategoriesAndImports: () => Promise<void>;
  loadImports: () => Promise<void>;
  loadMovements: () => Promise<void>;
  getDisplayedProducts: () => Product[];
  getActiveQty: (p: Product) => number;
}

export function useInventoryProductActions(deps: InventoryProductActionsDeps) {
  const {
    state,
    variantCodeFor,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadImports,
    loadMovements,
    getDisplayedProducts,
    getActiveQty,
  } = deps;
  const {
    activeWarehouse,
    setActiveWarehouse,
    products,
    expandedImportId,
    setExpandedImportId,
    categoryId,
    editingNames,
    setEditingNames,
    editingNotes,
    setEditingNotes,
    editingCats,
    setEditingCats,
    editingUnits,
    setEditingUnits,
    editingFloor1,
    setEditingFloor1,
    editingFloor2,
    setEditingFloor2,
    editingCosts,
    setEditingCosts,
    editingPrices,
    setEditingPrices,
    setNewProdWarehouse,
    editingVariants,
    setEditingVariants,
    newVariantInputs,
    setNewVariantInputs,
    setSavingVariantsProdId,
    setShowLabelModal,
    setLabelItems,
    savingBatch,
    setSavingBatch,
    setStatusMsg,
  } = state;

  const handleSelectWarehouseTab = (wh: ActiveWarehouseTab) => {
    setActiveWarehouse(wh);
    if (wh === "FLOOR_1" || wh === "FLOOR_2") {
      setNewProdWarehouse(wh);
    }
  };

  // Kiểm tra sản phẩm có thay đổi so với giá trị gốc hay không
  const isProductChanged = useCallback(
    (prod: Product) => {
      const origName = String(prod.name ?? "").trim();
      const origNote = String(prod.note ?? "").trim();
      const origCatId = String(
        typeof prod.categoryId === "object" ? prod.categoryId?._id || "" : prod.categoryId || ""
      );
      const origUnit = String(prod.unit ?? "Cái").trim() || "Cái";
      const origF1 = Math.max(0, Math.round(Number(prod.stockFloor1 ?? prod.stock ?? 0)));
      const origF2 = Math.max(0, Math.round(Number(prod.stockFloor2 ?? 0)));
      const origCost = Number(prod.costPrice ?? 0);
      const origPrice = Number(prod.sellingPrice ?? 0);

      const newName = String(editingNames[prod._id] ?? origName).trim();
      const newNote = String(editingNotes[prod._id] ?? origNote).trim();
      const newCatId = String(editingCats[prod._id] ?? origCatId);
      const newUnit = String(editingUnits[prod._id] ?? origUnit).trim() || "Cái";
      const newF1 = Math.max(0, Math.round(Number(editingFloor1[prod._id] ?? origF1)));
      const newF2 = Math.max(0, Math.round(Number(editingFloor2[prod._id] ?? origF2)));
      const newCost = Number(editingCosts[prod._id] ?? origCost);
      const newPrice = Number(editingPrices[prod._id] ?? origPrice);

      return (
        newName !== origName ||
        newNote !== origNote ||
        newCatId !== origCatId ||
        newUnit !== origUnit ||
        newF1 !== origF1 ||
        newF2 !== origF2 ||
        newCost !== origCost ||
        newPrice !== origPrice
      );
    },
    [editingNames, editingNotes, editingCats, editingUnits, editingFloor1, editingFloor2, editingCosts, editingPrices]
  );

  // Danh sách các sản phẩm đã có chỉnh sửa (số lượng, giá, tên, ĐVT, danh mục)
  const changedProducts = useMemo(() => {
    return products.filter((p) => isProductChanged(p));
  }, [products, isProductChanged]);

  // Hoàn tác toàn bộ chỉnh sửa chưa lưu về dữ liệu gốc
  const handleResetProductEdits = () => {
    const nameMap: Record<string, string> = {};
    const noteMap: Record<string, string> = {};
    const catMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    const f1Map: Record<string, number> = {};
    const f2Map: Record<string, number> = {};
    const costMap: Record<string, number> = {};
    const priceMap: Record<string, number> = {};
    products.forEach((p) => {
      nameMap[p._id] = p.name || "";
      noteMap[p._id] = p.note || "";
      catMap[p._id] =
        typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
      unitMap[p._id] = p.unit || "Cái";
      f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
      f2Map[p._id] = Number(p.stockFloor2 ?? 0);
      costMap[p._id] = Number(p.costPrice || 0);
      priceMap[p._id] = Number(p.sellingPrice || 0);
    });
    setEditingNames(nameMap);
    setEditingNotes(noteMap);
    setEditingCats(catMap);
    setEditingUnits(unitMap);
    setEditingFloor1(f1Map);
    setEditingFloor2(f2Map);
    setEditingCosts(costMap);
    setEditingPrices(priceMap);
    setStatusMsg(null);
  };

  // Lưu nhanh 1 sản phẩm trên dòng (hoặc bấm Enter)
  const handleSaveSingleProductRow = async (prod: Product) => {
    if (savingBatch) return;
    setStatusMsg(null);
    const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
    const newNote = String(editingNotes[prod._id] ?? prod.note ?? "").trim();
    const newCatId = String(
      editingCats[prod._id] ??
      (typeof prod.categoryId === "object" ? prod.categoryId?._id : prod.categoryId) ??
      ""
    );
    const newUnit = String(editingUnits[prod._id] ?? prod.unit ?? "Cái").trim() || "Cái";
    const newF1 = Math.max(0, Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0)));
    const newF2 = Math.max(0, Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0)));
    const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
    const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);

    if (!newName) {
      setStatusMsg({ type: "error", text: `Tên sản phẩm (Mã: ${prod.code}) không được để trống.` });
      return;
    }

    setSavingBatch(true);
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: newName,
          note: newNote,
          ...(newCatId ? { categoryId: newCatId } : {}),
          unit: newUnit,
          stockFloor1: newF1,
          stockFloor2: newF2,
          stock: newF1 + newF2,
          allowDirectStock: true,
          costPrice: newCost,
          sellingPrice: newPrice,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu cập nhật mặt hàng "${newName}" (${prod.code})!`,
      });
      await loadProductsAndCats();
      loadCategoriesAndImports();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Lỗi khi lưu sản phẩm." });
    } finally {
      setSavingBatch(false);
    }
  };

  // Hoàn tác riêng 1 dòng sản phẩm
  const handleResetSingleProductRow = (prod: Product) => {
    setEditingNames((prev) => ({ ...prev, [prod._id]: prod.name || "" }));
    setEditingNotes((prev) => ({ ...prev, [prod._id]: prod.note || "" }));
    setEditingCats((prev) => ({
      ...prev,
      [prod._id]: typeof prod.categoryId === "object" ? prod.categoryId?._id || "" : String(prod.categoryId || ""),
    }));
    setEditingUnits((prev) => ({ ...prev, [prod._id]: prod.unit || "Cái" }));
    setEditingFloor1((prev) => ({ ...prev, [prod._id]: Number(prod.stockFloor1 ?? prod.stock ?? 0) }));
    setEditingFloor2((prev) => ({ ...prev, [prod._id]: Number(prod.stockFloor2 ?? 0) }));
    setEditingCosts((prev) => ({ ...prev, [prod._id]: Number(prod.costPrice || 0) }));
    setEditingPrices((prev) => ({ ...prev, [prod._id]: Number(prod.sellingPrice || 0) }));
  };

  // Gom lại thành 1 nút Lưu duy nhất: Lưu toàn bộ sản phẩm đã có thay đổi
  const handleSaveAllProductChanges = async () => {
    if (changedProducts.length === 0 || savingBatch) return;
    setStatusMsg(null);

    for (const prod of changedProducts) {
      const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
      const newF1 = Math.max(
        0,
        Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0))
      );
      const newF2 = Math.max(
        0,
        Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0))
      );
      const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
      const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);
      if (!newName) {
        setStatusMsg({
          type: "error",
          text: `Tên sản phẩm (Mã: ${prod.code}) không được để trống.`,
        });
        return;
      }
      if (newF1 < 0 || newF2 < 0 || newCost < 0 || newPrice < 0) {
        setStatusMsg({
          type: "error",
          text: `Số lượng, giá vốn và giá niêm yết của "${newName}" không được âm.`,
        });
        return;
      }
    }

    setSavingBatch(true);
    try {
      for (const prod of changedProducts) {
        const newName = String(editingNames[prod._id] ?? prod.name ?? "").trim();
        const newNote = String(editingNotes[prod._id] ?? prod.note ?? "").trim();
        const newCatId = String(
          editingCats[prod._id] ??
          (typeof prod.categoryId === "object" ? prod.categoryId?._id : prod.categoryId) ??
          ""
        );
        const newUnit = String(editingUnits[prod._id] ?? prod.unit ?? "Cái").trim() || "Cái";
        const newF1 = Math.max(
          0,
          Math.round(Number(editingFloor1[prod._id] ?? prod.stockFloor1 ?? prod.stock ?? 0))
        );
        const newF2 = Math.max(
          0,
          Math.round(Number(editingFloor2[prod._id] ?? prod.stockFloor2 ?? 0))
        );
        const newStock = newF1 + newF2;
        const newCost = Number(editingCosts[prod._id] ?? prod.costPrice ?? 0);
        const newPrice = Number(editingPrices[prod._id] ?? prod.sellingPrice ?? 0);

        await apiRequest(`/products/${prod._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: newName,
            note: newNote,
            ...(newCatId ? { categoryId: newCatId } : {}),
            unit: newUnit,
            stockFloor1: newF1,
            stockFloor2: newF2,
            stock: newStock,
            allowDirectStock: true,
            costPrice: newCost,
            sellingPrice: newPrice,
          }),
        });
      }
      setStatusMsg({
        type: "success",
        text: `Đã lưu thành công ${changedProducts.length} mặt hàng có thay đổi (Số lượng tồn Kho Tầng 1 / Tầng 2, Giá vốn, Giá niêm yết)!`,
      });
      await loadProductsAndCats();
      loadCategoriesAndImports();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi lưu thay đổi sản phẩm.",
      });
    } finally {
      setSavingBatch(false);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn XÓA sản phẩm "${prod.name}" (Mã: ${prod.code}) khỏi kho không?`
      )
    ) {
      return;
    }
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${prod._id}`, { method: "DELETE" });
      setStatusMsg({
        type: "success",
        text: `Đã xóa sản phẩm "${prod.name}" (${prod.code}) khỏi hệ thống!`,
      });
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa sản phẩm.",
      });
    }
  };

  const handleDeleteImportReceipt = async (imp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const code = imp.code || imp.receiptCode || imp._id;
    const isCompleted = imp.status === "COMPLETED";
    const msg = isCompleted
      ? `Phiếu nhập "${code}" đã HOÀN THÀNH. Nếu xóa, hệ thống sẽ hoàn tác số lượng đã cộng vào kho. Bạn có chắc chắn muốn xóa không?`
      : `Bạn có chắc chắn muốn xóa phiếu nhập "${code}" không?`;
    if (!window.confirm(msg)) return;
    setStatusMsg(null);
    try {
      await apiRequest(`/imports/${imp._id}`, { method: "DELETE" });
      setStatusMsg({
        type: "success",
        text: `Đã xóa phiếu nhập "${code}" thành công!`,
      });
      if (expandedImportId === imp._id) setExpandedImportId(null);
      loadImports();
      loadProductsAndCats();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Không thể xóa phiếu nhập.",
      });
    }
  };

  // Gợi ý các sản phẩm đã có trong kho khi gõ tên hàng/mã hàng ở từng dòng trong Popup Nhập kho Admin

  const {
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    buildLabelItemsForProduct,
    handleOpenPrintLabelForProduct,
    handleOpenPrintLabelsForDisplayed,
  } = useInventoryVariantActions({
    state,
    variantCodeFor,
    loadProductsAndCats,
    getDisplayedProducts,
    getActiveQty,
  });

  // Sản phẩm có tồn > 0 tại kho đầu dời (theo hướng dời đang chọn) + Smart Search

  return {
    handleSelectWarehouseTab,
    isProductChanged,
    changedProducts,
    handleResetProductEdits,
    handleSaveSingleProductRow,
    handleResetSingleProductRow,
    handleSaveAllProductChanges,
    handleDeleteProduct,
    handleDeleteImportReceipt,
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    buildLabelItemsForProduct,
    handleOpenPrintLabelForProduct,
    handleOpenPrintLabelsForDisplayed,
  };
}

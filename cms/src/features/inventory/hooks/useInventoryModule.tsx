"use client";

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

import { InventoryPaginationBar } from "../components/InventoryPaginationBar";
import { useInventoryState } from "./useInventoryState";
import { useInventoryProductActions } from "./useInventoryProductActions";
import { useInventoryAdminImport } from "./useInventoryAdminImport";
import { useInventoryTransfer } from "./useInventoryTransfer";
import { useInventorySetLink } from "./useInventorySetLink";
import { useInventoryScanner } from "./useInventoryScanner";

import { useInventoryLoaders } from "./useInventoryLoaders";
import { useInventoryDerived } from "./inventoryDerived";
export function useInventoryModule() {
  const state = useInventoryState();
  const {
    subTab,
    setSubTab,
    historyView,
    setHistoryView,
    activeWarehouse,
    showZeroFloorItems,
    setShowZeroFloorItems,
    quickStockFilter,
    setQuickStockFilter,
    showScannerPanel,
    setShowScannerPanel,
    products,
    setProducts,
    categories,
    setCategories,
    movements,
    setMovements,
    reportRows,
    setReportRows,
    importsList,
    setImportsList,
    expandedImportId,
    setExpandedImportId,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    brandFilter,
    setBrandFilter,
    brandOptions,
    setBrandOptions,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    movementType,
    setMovementType,
    prodPage,
    setProdPage,
    prodPageSize,
    setProdPageSize,
    reportPage,
    setReportPage,
    reportPageSize,
    setReportPageSize,
    movPage,
    setMovPage,
    movPageSize,
    setMovPageSize,
    impPage,
    setImpPage,
    impPageSize,
    setImpPageSize,
    editingNames,
    setEditingNames,
    editingNotes,
    setEditingNotes,
    editingCats,
    setEditingCats,
    setEditingUnits,
    editingFloor1,
    setEditingFloor1,
    editingFloor2,
    setEditingFloor2,
    editingCosts,
    setEditingCosts,
    editingPrices,
    setEditingPrices,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
    newProdCatId,
    setNewProdCatId,
    newProdWarehouse,
    setNewProdWarehouse,
    adminImportRows,
    setAdminImportRows,
    activeAdminSuggestRowIdx,
    setActiveAdminSuggestRowIdx,
    adminSuggestHighlightIdx,
    setAdminSuggestHighlightIdx,
    importFilterCatId,
    setImportFilterCatId,
    importFilterBrandId,
    setImportFilterBrandId,
    importingAdminFile,
    submittingAdminImport,
    setAdminFileImportMode,
    adminFileInputRef,
    allCatalogProducts,
    setAllCatalogProducts,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    canSeeCost,
    expandedVariantProdId,
    setExpandedVariantProdId,
    cmsVarColorFilter,
    setCmsVarColorFilter,
    cmsVarSearch,
    setCmsVarSearch,
    editingVariants,
    setEditingVariants,
    newVariantInputs,
    setNewVariantInputs,
    savingVariantsProdId,
    showLabelModal,
    setShowLabelModal,
    labelItems,
    setLabelItems,
    setLinkModalProduct,
    setSetLinkModalProduct,
    setLinkMode,
    setSetLinkMode,
    selectedParentSetId,
    setSelectedParentSetId,
    packSizeInput,
    setPackSizeInput,
    setLinkSearch,
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
    modalUnpackCount,
    setModalUnpackCount,
    modalUnpackWarehouse,
    setModalUnpackWarehouse,
    savingSetLink,
    unpackingLoadingId,
    scannerEnabled,
    setScannerEnabled,
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
    transfersList,
    setTransfersList,
    transferDirection,
    setTransferDirection,
    transferProductId,
    setTransferProductId,
    transferColor,
    setTransferColor,
    transferSize,
    setTransferSize,
    transferQty,
    setTransferQty,
    transferSearch,
    setTransferSearch,
    transferSuggestOpen,
    setTransferSuggestOpen,
    transferItems,
    setTransferItems,
    transferNote,
    setTransferNote,
    expandedTransferCode,
    setExpandedTransferCode,
    savingBatch,
    detailModalReceipt,
    setDetailModalReceipt,
    statusMsg,
    setStatusMsg,
    setLoading,
    debouncedSearch,
  } = state;

  const loaders = useInventoryLoaders(state);
  const {
    catalogByCode,
    variantCodeFor,
    loadCategoriesAndImports,
    loadProductsAndCats,
    loadReport,
    loadMovements,
    loadImports,
    loadTransfers,
  } = loaders;
  const productActions = useInventoryProductActions({
    state,
    variantCodeFor,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadImports,
    loadMovements,
    getDisplayedProducts: () => displayedProducts,
    getActiveQty: (prod) => getActiveQty(prod),
  });
  const {
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
  } = productActions;

  const adminImport = useInventoryAdminImport({
    state,
    catalogByCode,
    variantCodeFor,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadImports,
    loadMovements,
  });
  const {
    getAdminRowSuggestions,
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
    handleClearAdminRowProduct,
    handleUpdateAdminRow,
    handleAddAdminRow,
    handleDuplicateAdminRow,
    handleUpdateAdminRowColor,
    handleCodeCreatorDone,
    handleRemoveAdminRow,
    handleDownloadAdminSampleCsv,
    handleAdminImportFileChange,
    handleSubmitAdminBatchImport,
  } = adminImport;

  const transfer = useInventoryTransfer({
    state,
    variantCodeFor,
    loadProductsAndCats,
    loadTransfers,
    loadMovements,
  });
  const {
    sourceFloorProducts,
    getSourceFloorStock,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    getSourceVariantFloorStock,
    getTransferItemKey,
    syncDefaultTransferVariantForProduct,
    handleSelectTransferProduct,
    handleChangeTransferDirection,
    handleAddTransferItem,
    handleUpdateTransferItemVariant,
    handleUpdateTransferItemQty,
    handleRemoveTransferItem,
    handleCreateTransfer,
    floor1ImportedCodes,
    floor2ImportedCodes,
  } = transfer;

  const setLink = useInventorySetLink({
    state,
    loadProductsAndCats,
    loadCategoriesAndImports,
    loadMovements,
  });
  const {
    handleOpenSetLinkModal,
    handleQuickUnpackSet,
    handleSaveSetLink,
    handleClearSetLink,
  } = setLink;

  const scanner = useInventoryScanner({
    state,
    variantCodeFor,
    getDisplayedProducts: () => displayedProducts,
    activeWarehouseLabel:
      activeWarehouse === "FLOOR_1"
        ? "🏢 Kho Tầng 1"
        : activeWarehouse === "FLOOR_2"
          ? "🏬 Kho Tầng 2"
          : "📊 Tổng hợp Cả 2 Kho (Tầng 1 + Tầng 2)",
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
  });
  const { handleBarcodeScanInCms } = scanner;

  const derived = useInventoryDerived({ state, floor1ImportedCodes, floor2ImportedCodes, isProductChanged, variantCodeFor });
  const { displayedProducts, getActiveQty } = derived;

  const renderPaginationBar = (opts: Parameters<typeof InventoryPaginationBar>[0]) => (
    <InventoryPaginationBar {...opts} />
  );

  return {
    ...state,
    ...loaders,
    ...derived,
    ...productActions,
    ...adminImport,
    ...transfer,
    ...setLink,
    ...scanner,
    renderPaginationBar,
  };
}

export type InventoryViewModel = ReturnType<typeof useInventoryModule>;


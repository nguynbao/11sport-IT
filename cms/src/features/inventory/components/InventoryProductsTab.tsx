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
import { InventoryViewModel } from "../hooks/useInventoryModule";
import { COMMON_COLORS, COMMON_SIZES, QuickStockFilter } from "../types";

export function InventoryProductsTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    setSubTab,
    activeWarehouse,
    showZeroFloorItems,
    setShowZeroFloorItems,
    quickStockFilter,
    setQuickStockFilter,
    showScannerPanel,
    setShowScannerPanel,
    products,
    categories,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    brandFilter,
    setBrandFilter,
    brandOptions,
    setProdPage,
    prodPageSize,
    setProdPageSize,
    editingNames,
    editingNotes,
    editingCats,
    editingFloor1,
    editingFloor2,
    editingCosts,
    editingPrices,
    setShowAdminImportModal,
    setEditingProductModal,
    canSeeCost,
    variantCodeFor,
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
    setTransferDirection,
    setTransferProductId,
    savingBatch,
    isProductChanged,
    changedProducts,
    handleResetProductEdits,
    handleSaveSingleProductRow,
    handleResetSingleProductRow,
    handleSaveAllProductChanges,
    handleDeleteProduct,
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    handleOpenPrintLabelForProduct,
    handleOpenPrintLabelsForDisplayed,
    handleOpenSetLinkModal,
    handleQuickUnpackSet,
    displayedProducts,
    totalStockQty,
    totalCostInventoryValue,
    totalSellInventoryValue,
    activeWarehouseLabel,
    prodTotalPages,
    safeProdPage,
    pagedProducts,
    handleBarcodeScanInCms,
    renderPaginationBar,
  } = vm;

  return (
    <>
      {/* SUB-TAB 1: SẢN PHẨM, SỐ LƯỢNG, GIÁ GỐC & GIÁ BÁN LẺ */}
      {subTab === "PRODUCTS" && (
        <div className="space-y-6">
          {/* Bảng danh sách sản phẩm: Chia rõ Kho Tầng 1 & Kho Tầng 2 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            {/* Hàng 1: Tiêu đề + Cụm nút tác vụ chính */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex flex-wrap items-center gap-2">
                  <span>Danh mục Sản phẩm — {activeWarehouseLabel}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-brand-ink">
                    {displayedProducts.length} mặt hàng · {totalStockQty.toLocaleString("vi-VN")} đơn vị
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWarehouse === "FLOOR_1"
                    ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 1. Bấm sang tab 'Kho Tầng 2' ở trên để quản lý riêng Kho Tầng 2."
                    : activeWarehouse === "FLOOR_2"
                      ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 2. Có thể bật 'Hiện cả SP ngoài Tầng 2' nếu muốn nhập số lượng Tầng 2 cho các mã hàng khác."
                      : "Đang xem gộp cả 2 kho: có thể chỉnh sửa riêng cột Tồn Kho Tầng 1 và Tồn Kho Tầng 2 trên cùng một dòng."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminImportModal(true)}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="Mở cửa sổ Nhập kho nhanh dành cho Admin"
                >
                  <Plus className="w-4 h-4" />
                  Nhập kho
                </button>
                {changedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                    title="Hoàn tác các thay đổi chưa lưu"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác ({changedProducts.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAllProductChanges}
                  disabled={changedProducts.length === 0 || savingBatch}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition ${
                    changedProducts.length > 0 && !savingBatch
                      ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md ring-2 ring-teal-200 cursor-pointer"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                  title={
                    changedProducts.length > 0
                      ? `Lưu toàn bộ ${changedProducts.length} sản phẩm đã thay đổi`
                      : "Chưa có thay đổi nào về số lượng hoặc thông tin sản phẩm"
                  }
                >
                  <Save className="w-4 h-4" />
                  {savingBatch
                    ? "Đang lưu..."
                    : changedProducts.length > 0
                      ? `Lưu thay đổi (${changedProducts.length} SP)`
                      : "Lưu thay đổi"}
                </button>
                <button
                  type="button"
                  disabled={displayedProducts.length === 0}
                  onClick={handleOpenPrintLabelsForDisplayed}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="In tem nhãn mã vạch"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Tem Label
                </button>
                <ExportExcelButton
                  onExport={() => exportProducts(displayedProducts, { hideCost: !canSeeCost })}
                  disabled={displayedProducts.length === 0}
                />
                <button
                  type="button"
                  onClick={() => setShowScannerPanel((v) => !v)}
                  className={`px-3 py-2 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    showScannerPanel || Object.keys(scannedCheckCounts).length > 0
                      ? "bg-teal-50 border-teal-400 text-teal-900"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Bật/tắt khung Máy quét Label kiểm hàng"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-brand-ink" />
                  <span>
                    Máy quét kiểm kho
                    {Object.keys(scannedCheckCounts).length > 0
                      ? ` (${Object.keys(scannedCheckCounts).length})`
                      : ""}
                  </span>
                </button>
              </div>
            </div>

            {/* Hàng 2: Thanh tìm kiếm + Bộ lọc Category/Brand + Quick Filter Chips */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã gốc, mã con, tên, ghi chú..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.skuCode ? `[${c.skuCode}] ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Lọc theo thương hiệu"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Thương hiệu</option>
                  {brandOptions
                    .filter((b) => !categoryId || b.isSystem || (b.categoryIds || []).map(String).includes(categoryId))
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        [{b.code}] {b.name}
                      </option>
                    ))}
                </select>
                {activeWarehouse !== "ALL" && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showZeroFloorItems}
                      onChange={(e) => setShowZeroFloorItems(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Hiện cả SP ngoài {activeWarehouse === "FLOOR_2" ? "Tầng 2" : "Tầng 1"} ({products.length} SP)
                  </label>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: "Tất cả" },
                    { id: "IN_STOCK", label: "Còn hàng (>0)" },
                    { id: "ZERO_STOCK", label: "Hết hàng (=0)" },
                    { id: "MISSING_PRICE", label: "Chưa có giá" },
                    ...(changedProducts.length > 0
                      ? [{ id: "CHANGED" as QuickStockFilter, label: `Đang sửa (${changedProducts.length})` }]
                      : []),
                  ] as { id: QuickStockFilter; label: string }[]
                ).map((chip) => {
                  const active = quickStockFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setQuickStockFilter(chip.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        active
                          ? "bg-teal-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                {(search || categoryId || brandFilter || quickStockFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategoryId("");
                      setBrandFilter("");
                      setQuickStockFilter("ALL");
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Xoá lọc
                  </button>
                )}
              </div>
            </div>

            {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN CMS */}
            {(showScannerPanel || Object.keys(scannedCheckCounts).length > 0 || lastScanFeedback) && (
              <div className="rounded-xl border border-teal-300 bg-teal-50/50 p-3 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <ScanBarcode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-teal-950">
                          Máy Quét Label — Kiểm Hàng &amp; Đối Chiếu Tồn Kho
                        </span>
                        <button
                          type="button"
                          onClick={() => setScannerEnabled((v) => !v)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                            scannerEnabled ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {scannerEnabled ? "● ĐANG BẬT TỰ ĐỘNG" : "○ ĐÃ TẮT"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Bắn mã vạch hoặc nhập tay để cộng +1 kiểm đếm và tự động bung dòng biến thể Màu/Size.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!scannerInput.trim()) return;
                        handleBarcodeScanInCms(scannerInput);
                        setScannerInput("");
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        data-barcode-input="true"
                        value={scannerInput}
                        onChange={(e) => setScannerInput(e.target.value)}
                        placeholder="Quét hoặc gõ mã SP + Enter..."
                        className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border border-teal-400 bg-white text-xs font-mono font-bold text-slate-900 uppercase focus:border-teal-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold whitespace-nowrap cursor-pointer"
                      >
                        +1 Kiểm
                      </button>
                    </form>

                    {Object.keys(scannedCheckCounts).length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOnlyShowScanned((v) => !v)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                            onlyShowScanned
                              ? "bg-teal-700 text-white border-teal-700"
                              : "bg-white text-brand-ink border-teal-300 hover:bg-teal-50"
                          }`}
                        >
                          {onlyShowScanned
                            ? `Đang lọc mã đã quét (${Object.keys(scannedCheckCounts).length})`
                            : `Chỉ hiện mã đã quét (${Object.keys(scannedCheckCounts).length})`}
                        </button>
                        {lastScannedProdId && (scannedCheckCounts[lastScannedProdId] || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setScannedCheckCounts((prev) => {
                                const cur = prev[lastScannedProdId] || 0;
                                const copy = { ...prev };
                                if (cur <= 1) delete copy[lastScannedProdId];
                                else copy[lastScannedProdId] = cur - 1;
                                return copy;
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCheckCounts({});
                            setScannedVariantCounts({});
                            setLastScannedProdId(null);
                            setLastScannedVariantCode(null);
                            setOnlyShowScanned(false);
                            setLastScanFeedback(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          Reset bộ đếm
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {lastScanFeedback && (
                  <div
                    className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                      lastScanFeedback.type === "success"
                        ? "bg-teal-100/90 border-teal-300 text-teal-950"
                        : lastScanFeedback.type === "warning"
                          ? "bg-amber-100/90 border-amber-300 text-amber-950"
                          : "bg-red-100/90 border-red-300 text-red-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {lastScanFeedback.type === "error" ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
                      )}
                      <span className="truncate">{lastScanFeedback.message}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {lastScanFeedback.time}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Sản phẩm</th>
                    <th className="py-3 px-3 w-36">Category</th>
                    <th className="py-3 px-3 w-36">Thương hiệu</th>
                    {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-brand-ink">
                        Tồn Tầng 1
                      </th>
                    )}
                    {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-purple-700">
                        Tồn Tầng 2
                      </th>
                    )}
                    {activeWarehouse === "ALL" && (
                      <th className="py-3 px-3 text-center w-28 whitespace-nowrap text-slate-700">
                        Tổng 2 Kho
                      </th>
                    )}
                    <th className="py-3 px-3 text-right w-36 whitespace-nowrap">Giá vốn (VND)</th>
                    <th className="py-3 px-3 text-right w-36 whitespace-nowrap">Giá niêm yết (VND)</th>
                    <th className="py-3 px-3 text-right w-32 whitespace-nowrap">Lãi / SP</th>
                    <th className="py-3 px-4 text-right w-32 whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedProducts.map((p, idx) => {
                    const rowStt =
                      prodPageSize <= 0
                        ? idx + 1
                        : (safeProdPage - 1) * prodPageSize + idx + 1;
                    const nameVal = editingNames[p._id] ?? p.name ?? "";
                    const catVal =
                      editingCats[p._id] ??
                      (typeof p.categoryId === "object"
                        ? p.categoryId?._id || ""
                        : String(p.categoryId || ""));
                    const catName =
                      categories.find((c) => c._id === catVal)?.name ||
                      (typeof p.categoryId === "object" ? p.categoryId?.name : "") ||
                      "Chưa phân loại";
                    const origF1 = Number(p.stockFloor1 ?? p.stock ?? 0);
                    const origF2 = Number(p.stockFloor2 ?? 0);
                    const f1Val = Number(editingFloor1[p._id] ?? origF1);
                    const f2Val = Number(editingFloor2[p._id] ?? origF2);
                    const activeQty =
                      activeWarehouse === "FLOOR_1"
                        ? f1Val
                        : activeWarehouse === "FLOOR_2"
                          ? f2Val
                          : f1Val + f2Val;
                    const costVal = Number(editingCosts[p._id] ?? p.costPrice ?? 0);
                    const sellVal = Number(editingPrices[p._id] ?? p.sellingPrice ?? 0);
                    const margin = sellVal - costVal;
                    const marginPct = costVal > 0 ? Math.round((margin / costVal) * 100) : 0;
                    const prodVariants = editingVariants[p._id] ?? p.variants ?? [];
                    const namedVars = prodVariants.filter((v) => v.color || v.size);
                    const isVarExpanded = expandedVariantProdId === p._id;
                    const newVarDraft = newVariantInputs[p._id] || {
                      color: "",
                      size: "",
                      stockFloor1: activeWarehouse === "FLOOR_2" ? 0 : 1,
                      stockFloor2: activeWarehouse === "FLOOR_2" ? 1 : 0,
                    };
                    const scannedQty = scannedCheckCounts[p._id] || 0;
                    const previewVars = isVarExpanded ? namedVars : namedVars.slice(0, 4);
                    const hiddenVarCount = Math.max(0, namedVars.length - previewVars.length);
                    return (
                      <React.Fragment key={p._id}>
                        <tr
                          className={`bg-white hover:bg-teal-50/70 transition-colors ${lastScannedProdId === p._id
                            ? "bg-teal-50/90 ring-2 ring-inset ring-teal-500"
                            : scannedQty > 0
                              ? "bg-teal-50/40"
                              : ""
                            }`}
                        >
                          {/* 1. SẢN PHẨM */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                              <span className="font-semibold text-slate-400">
                                {String(rowStt).padStart(2, "0")}
                              </span>
                              <span className="font-semibold text-slate-500">{p.code}</span>
                              {(p.brandName || p.brand || p.versionName) && (
                                <span className="font-sans text-[10px] text-slate-400">
                                  · {p.brandName || p.brand || ""}
                                  {p.versionName ? ` ${p.versionName}` : ""}
                                </span>
                              )}
                              {scannedQty > 0 && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${scannedQty === activeQty
                                    ? "bg-teal-600 text-white border-teal-700"
                                    : scannedQty > activeQty
                                      ? "bg-amber-500 text-white border-amber-600"
                                      : "bg-teal-100 text-teal-900 border-teal-300"
                                    }`}
                                >
                                  Quét: {scannedQty}/{activeQty}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenPrintLabelForProduct(p)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-slate-500 hover:text-brand-ink hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                                title="In tem nhãn mã vạch theo từng Mã con (Màu + Size)"
                              >
                                <Printer className="w-3 h-3" /> In mã
                              </button>
                            </div>

                            <div className="mt-1 font-bold text-slate-900 text-[13px] leading-snug">
                              {nameVal}
                            </div>
                            {(editingNotes[p._id] ?? p.note) && (
                              <div className="mt-0.5 text-[11px] text-slate-400 truncate max-w-md">
                                {editingNotes[p._id] ?? p.note}
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {previewVars.length > 0 ? (
                                previewVars.map((v, vIdx) => {
                                  const cLabel = (v.color || "").trim() || "Mặc định";
                                  const sLabel = (v.size || "").trim();
                                  const vQty =
                                    activeWarehouse === "FLOOR_2"
                                      ? v.stockFloor2 || 0
                                      : activeWarehouse === "FLOOR_1"
                                        ? v.stockFloor1 || 0
                                        : (v.stockFloor1 || 0) + (v.stockFloor2 || 0);
                                  const vHexes = resolveVariantColorHexes(
                                    cLabel,
                                    Array.isArray(v.colorHexes) && v.colorHexes.length > 0
                                      ? v.colorHexes
                                      : undefined
                                  );
                                  const childCode =
                                    v.variantCode || variantCodeFor(p.code, v.color, v.size);
                                  return (
                                    <button
                                      key={`${cLabel}-${sLabel}-${vIdx}`}
                                      type="button"
                                      onClick={() =>
                                        setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                      }
                                      title={`Mã con: ${childCode} · Bấm để quản lý Size/Màu`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition cursor-pointer ${lastScannedVariantCode === childCode
                                        ? "bg-teal-600 text-white border-teal-700"
                                        : "bg-slate-50 hover:bg-teal-50 hover:border-teal-400 text-slate-700 hover:text-teal-900 border-slate-200"
                                        }`}
                                    >
                                      <ColorSwatchBadge
                                        hexes={vHexes}
                                        colorName={cLabel}
                                        size="xs"
                                      />
                                      <span>
                                        {cLabel}
                                        {sLabel ? ` · ${sLabel}` : ""} ({vQty})
                                      </span>
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-slate-300 bg-white hover:border-teal-400 hover:text-brand-ink text-slate-500 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  + Thêm size/màu
                                </button>
                              )}
                              {hiddenVarCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                  }
                                  className="px-2 py-0.5 rounded-full bg-indigo-50 text-brand-ink border border-indigo-200 text-[11px] font-bold hover:bg-indigo-100 cursor-pointer"
                                >
                                  +{hiddenVarCount} nữa
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedVariantProdId(isVarExpanded ? null : p._id)
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed text-[11px] font-semibold transition cursor-pointer ${isVarExpanded
                                  ? "bg-teal-600 text-white border-teal-700"
                                  : "bg-white hover:bg-teal-50 hover:border-teal-500 hover:text-brand-ink text-slate-600 border-slate-300"
                                  }`}
                              >
                                + Thêm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSetLinkModal(p)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition cursor-pointer ${(p.parentSetProductId && (p.packSize || 0) > 0) ||
                                  (Array.isArray(p.linkedRetailProducts) &&
                                    p.linkedRetailProducts.length > 0)
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-white hover:bg-teal-50 hover:border-teal-400 hover:text-brand-ink text-slate-600 border-slate-200"
                                  }`}
                                title="Cấu hình liên kết tự động tách từ Sản phẩm Bộ/Hộp sang Sản phẩm Lẻ"
                              >
                                {p.parentSetProductId && (p.packSize || 0) > 0
                                  ? `SP Lẻ (1 ${p.parentSetUnit || "Bộ"} = ${p.packSize} ${p.unit})`
                                  : Array.isArray(p.linkedRetailProducts) &&
                                    p.linkedRetailProducts.length > 0
                                    ? `SP Bộ (${p.linkedRetailProducts.length} SP lẻ)`
                                    : "Gắn Bộ ↔ Lẻ"}
                              </button>
                            </div>

                            {/* Giữ nút Tách 1 Bộ nhanh nếu đã liên kết Bộ <-> Lẻ */}
                            {p.parentSetProductId && (p.packSize || 0) > 0 && (
                              <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 border border-amber-200 inline-flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="text-amber-950 font-semibold">
                                  Bộ:{" "}
                                  <strong className="font-mono">
                                    {p.parentSetProductCode || "SP Bộ"}
                                  </strong>{" "}
                                  (Tồn T1: {p.parentSetStockFloor1 ?? 0})
                                </span>
                                <button
                                  type="button"
                                  disabled={unpackingLoadingId === p._id}
                                  onClick={() => handleQuickUnpackSet(p._id, 1)}
                                  className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  {unpackingLoadingId === p._id
                                    ? "Đang tách..."
                                    : `⚡ Tách 1 ${p.parentSetUnit || "Bộ"} → +${p.packSize} ${p.unit}`}
                                </button>
                              </div>
                            )}
                            {Array.isArray(p.linkedRetailProducts) &&
                              p.linkedRetailProducts.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {p.linkedRetailProducts.map((ret) => (
                                    <div
                                      key={ret._id}
                                      className="px-2.5 py-1 rounded-lg bg-teal-50/80 border border-teal-200 inline-flex items-center gap-2 text-[10px]"
                                    >
                                      <span className="text-teal-950 font-semibold">
                                        Bóc lẻ{" "}
                                        <strong className="font-mono">{ret.code}</strong> (Tồn T1:{" "}
                                        {ret.stockFloor1})
                                      </span>
                                      <button
                                        type="button"
                                        disabled={unpackingLoadingId === ret._id}
                                        onClick={() => handleQuickUnpackSet(ret._id, 1)}
                                        className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-[10px] cursor-pointer"
                                      >
                                        {unpackingLoadingId === ret._id
                                          ? "Đang tách..."
                                          : `⚡ Tách 1 ${p.unit} → +${ret.packSize} ${ret.unit}`}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </td>

                          {/* 2. CATEGORY */}
                          <td className="py-3.5 px-3 align-top">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-50 text-brand-ink font-semibold text-[11px] whitespace-nowrap">
                              {catName}
                            </span>
                          </td>

                          {/* 2b. THƯƠNG HIỆU */}
                          <td className="py-3.5 px-3 align-top">
                            {(p.brandName || p.brand) ? (
                              <div>
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] whitespace-nowrap">
                                  {p.brandName || p.brand}
                                </span>
                                {p.versionName && (
                                  <div className="mt-0.5 text-[10px] text-slate-400 whitespace-nowrap">
                                    {p.versionName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>

                          {/* 3. TỒN TẦNG 1 */}
                          {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f1Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f1Val > 0
                                  ? "bg-teal-50 text-brand-ink"
                                  : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                {f1Val > 0 ? "Còn hàng" : "Hết hàng"}
                              </span>
                            </td>
                          )}

                          {/* 4. TỒN TẦNG 2 */}
                          {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f2Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f2Val > 0
                                  ? "bg-teal-50 text-brand-ink"
                                  : "bg-slate-100 text-slate-500"
                                  }`}
                              >
                                {f2Val > 0 ? "Còn hàng" : "Hết hàng"}
                              </span>
                            </td>
                          )}

                          {/* TỔNG 2 KHO (khi chọn Gộp 2 kho) */}
                          {activeWarehouse === "ALL" && (
                            <td className="py-3.5 px-3 text-center align-top">
                              <div className="text-lg font-black text-slate-900 tabular-nums">
                                {formatNumberDots(f1Val + f2Val)}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${f1Val + f2Val > 0
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-slate-100 text-slate-400"
                                  }`}
                              >
                                Tổng
                              </span>
                            </td>
                          )}

                          {/* 5. GIÁ VỐN (VND) */}
                          <td className="py-3.5 px-3 text-right align-top">
                            <div className="text-[15px] font-black text-slate-900 tabular-nums">
                              {formatNumberDots(costVal)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                              Tổng: <strong className="text-slate-900">{formatNumberDots(activeQty * costVal)}</strong>
                            </div>
                          </td>

                          {/* 6. GIÁ NIÊM YẾT (VND) */}
                          <td className="py-3.5 px-3 text-right align-top">
                            <div className="text-[15px] font-black text-slate-900 tabular-nums">
                              {formatNumberDots(sellVal)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">
                              Niêm yết
                            </div>
                          </td>

                          {/* 7. LÃI / SP */}
                          <td className="py-3.5 px-3 text-right align-top">
                            {sellVal > 0 ? (
                              <>
                                <div
                                  className={`text-[15px] font-black tabular-nums whitespace-nowrap ${margin < 0 ? "text-red-600" : "text-slate-900"
                                    }`}
                                >
                                  {margin >= 0
                                    ? `+${formatNumberDots(margin)}`
                                    : `-${formatNumberDots(Math.abs(margin))}`}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">
                                  {costVal > 0 ? `${marginPct}% / SP` : "Chưa có vốn"}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-slate-400">—</div>
                            )}
                          </td>

                          {/* 8. THAO TÁC */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {isProductChanged(p) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={savingBatch}
                                    onClick={() => handleSaveSingleProductRow(p)}
                                    className="px-2 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Lưu riêng dòng sản phẩm này"
                                  >
                                    <Save className="w-3 h-3" /> Lưu
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingBatch}
                                    onClick={() => handleResetSingleProductRow(p)}
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                                    title="Hoàn tác dòng này"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingProductModal(p)}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-teal-100 hover:border-teal-400 text-brand-ink inline-flex items-center justify-center transition cursor-pointer"
                                title="Sửa thông tin sản phẩm, giá và biến thể"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferProductId(p._id);
                                  if (activeWarehouse === "FLOOR_2") {
                                    setTransferDirection("F2_TO_F1");
                                  } else if (activeWarehouse === "FLOOR_1") {
                                    setTransferDirection("F1_TO_F2");
                                  }
                                  setSubTab("TRANSFER");
                                }}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-200 hover:border-slate-400 text-slate-700 inline-flex items-center justify-center transition cursor-pointer"
                                title="Chuyển tầng (T1 ↔ T2)"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p)}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-red-100 hover:border-red-300 text-red-500 hover:text-red-700 inline-flex items-center justify-center transition cursor-pointer"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isVarExpanded && (
                          <tr className="bg-indigo-50/40">
                            <td colSpan={activeWarehouse === "ALL" ? 10 : 8} className="p-3.5">
                              <div className="bg-white rounded-xl border-2 border-indigo-200 p-3.5 space-y-3 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-extrabold text-indigo-950">
                                      🎨 Quản lý Chi tiết Màu sắc • Size • Mã con cho Mã gốc:{" "}
                                      <span className="font-mono text-brand-ink">{p.code}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Mỗi thuộc tính (Màu + Size) có <b>Mã con riêng</b> để in tem &amp; quét kiểm kho chính xác, dùng chung Giá vốn ({formatVND(costVal)}) và Giá niêm yết ({formatVND(sellVal)}).
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={savingVariantsProdId === p._id}
                                    onClick={() => handleSaveProductVariants(p)}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    {savingVariantsProdId === p._id
                                      ? "Đang lưu Size/Màu..."
                                      : "Lưu bảng Size/Màu"}
                                  </button>
                                </div>

                                {/* Thanh lọc nhanh theo Màu sắc & Tìm kiếm Size/Mã con khi có nhiều biến thể */}
                                {prodVariants.length > 3 && (() => {
                                  const colorMap = new Map<string, number>();
                                  prodVariants.forEach((v) => {
                                    const c = (v.color || "").trim() || "Mặc định";
                                    colorMap.set(c, (colorMap.get(c) || 0) + 1);
                                  });
                                  const colorEntries = Array.from(colorMap.entries());
                                  return (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                                          Lọc theo màu:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setCmsVarColorFilter("ALL")}
                                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold border transition ${cmsVarColorFilter === "ALL"
                                            ? "bg-teal-600 text-white border-slate-900"
                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                            }`}
                                        >
                                          Tất cả ({prodVariants.length})
                                        </button>
                                        {colorEntries.map(([cName, cnt]) => {
                                          const explicitHexes = prodVariants.find(
                                            (v) =>
                                              ((v.color || "").trim() || "Mặc định") === cName &&
                                              Array.isArray(v.colorHexes) &&
                                              v.colorHexes.length > 0
                                          )?.colorHexes;
                                          const cHexes = resolveVariantColorHexes(
                                            cName,
                                            explicitHexes
                                          );
                                          const isSelectedTab = cmsVarColorFilter === cName;
                                          return (
                                            <button
                                              key={cName}
                                              type="button"
                                              onClick={() => setCmsVarColorFilter(cName)}
                                              style={
                                                !isSelectedTab
                                                  ? getColorBoxBorderStyle(cHexes, "#ffffff", 2)
                                                  : undefined
                                              }
                                              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${isSelectedTab
                                                ? "bg-indigo-600 text-white border-indigo-700"
                                                : "bg-white text-slate-800 border-slate-300 hover:bg-indigo-50"
                                                }`}
                                            >
                                              <ColorSwatchBadge
                                                hexes={cHexes}
                                                colorName={cName}
                                                size="xs"
                                              />
                                              <span>
                                                {cName} ({cnt})
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="relative w-full sm:w-52 shrink-0">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                                        <input
                                          type="text"
                                          value={cmsVarSearch}
                                          onChange={(e) => setCmsVarSearch(e.target.value)}
                                          placeholder="Tìm mã con, màu, size..."
                                          className="w-full pl-8 pr-2.5 py-1 rounded border border-slate-300 bg-white text-xs focus:border-indigo-600 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
                                      <tr>
                                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                                        <th className="py-2 px-2.5">Mã con</th>
                                        <th className="py-2 px-2.5">Màu sắc</th>
                                        <th className="py-2 px-2.5">Size</th>
                                        <th className="py-2 px-2.5 text-right">🏢 Tồn Kho Tầng 1</th>
                                        <th className="py-2 px-2.5 text-right">🏬 Tồn Kho Tầng 2</th>
                                        <th className="py-2 px-2.5 text-right">Tổng SL</th>
                                        <th className="py-2 px-2.5 text-right" title="Trống/0 = dùng giá niêm yết gốc">Giá niêm yết</th>
                                        {canSeeCost && (
                                          <th className="py-2 px-2.5 text-right" title="Trống/0 = dùng giá vốn gốc">Giá vốn</th>
                                        )}
                                        <th className="py-2 px-2.5 text-center">In tem</th>
                                        <th className="py-2 px-2.5 text-center w-16">Xóa</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {prodVariants.length === 0 ? (
                                        <tr>
                                          <td colSpan={canSeeCost ? 11 : 10} className="py-3 text-center text-slate-400">
                                            Chưa có phân loại Size/Màu. Hãy thêm ở dòng bên dưới.
                                          </td>
                                        </tr>
                                      ) : (
                                        prodVariants
                                          .map((v, vIdx) => ({ v, vIdx }))
                                          .filter(({ v }) => {
                                            const c = (v.color || "").trim() || "Mặc định";
                                            if (cmsVarColorFilter !== "ALL" && c !== cmsVarColorFilter) {
                                              return false;
                                            }
                                            const q = cmsVarSearch.trim().toLowerCase();
                                            if (!q) return true;
                                            const childCode = variantCodeFor(
                                              p.code,
                                              v.color,
                                              v.size
                                            );
                                            return `${c} ${v.size || ""} ${childCode}`
                                              .toLowerCase()
                                              .includes(q);
                                          })
                                          .map(({ v, vIdx }) => {
                                            const childCode = variantCodeFor(
                                              p.code,
                                              v.color,
                                              v.size
                                            );
                                            const vScanned =
                                              scannedVariantCounts[p._id]?.[childCode] || 0;
                                            return (
                                              <tr
                                                key={vIdx}
                                                className={`hover:bg-slate-50 ${lastScannedVariantCode === childCode
                                                  ? "bg-teal-50"
                                                  : ""
                                                  }`}
                                              >
                                                <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                                                  {vIdx + 1}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                                    {childCode}
                                                  </span>
                                                  {vScanned > 0 && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-teal-600 text-white font-mono text-[10px] font-bold">
                                                      Quét: {vScanned}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <ColorInputWithPicker
                                                    compact
                                                    listId="cms-color-suggestions"
                                                    value={v.color}
                                                    colorHexes={v.colorHexes}
                                                    onChange={(nextColor, nextHexes) => {
                                                      const next = prodVariants.map((item, idx) => {
                                                        if (idx === vIdx) {
                                                          return {
                                                            ...item,
                                                            color: nextColor,
                                                            colorHexes: nextHexes,
                                                          };
                                                        }
                                                        const cleanC = String(nextColor || "")
                                                          .trim()
                                                          .toLowerCase();
                                                        if (
                                                          cleanC &&
                                                          nextHexes.length > 0 &&
                                                          String(item.color || "")
                                                            .trim()
                                                            .toLowerCase() === cleanC
                                                        ) {
                                                          return { ...item, colorHexes: nextHexes };
                                                        }
                                                        return item;
                                                      });
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    placeholder="VD: Đỏ, Trắng..."
                                                    className="w-44"
                                                  />
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                  <input
                                                    type="text"
                                                    list="cms-size-suggestions"
                                                    value={v.size}
                                                    onChange={(e) => {
                                                      const next = [...prodVariants];
                                                      next[vIdx] = {
                                                        ...next[vIdx],
                                                        size: e.target.value.toUpperCase(),
                                                      };
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    placeholder="M, L, XL, 42..."
                                                    className="w-24 px-2 py-1 rounded border border-slate-300 font-mono font-bold uppercase text-center"
                                                  />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    value={v.stockFloor1}
                                                    onChange={(e) => {
                                                      const nextF1 = Math.max(
                                                        0,
                                                        Math.round(Number(e.target.value) || 0)
                                                      );
                                                      const next = [...prodVariants];
                                                      next[vIdx] = {
                                                        ...next[vIdx],
                                                        stockFloor1: nextF1,
                                                        stock: nextF1 + (Number(next[vIdx].stockFloor2) || 0),
                                                      };
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    className="w-24 px-2 py-1 rounded border border-teal-300 font-mono font-bold text-right text-brand-ink"
                                                  />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    value={v.stockFloor2}
                                                    onChange={(e) => {
                                                      const nextF2 = Math.max(
                                                        0,
                                                        Math.round(Number(e.target.value) || 0)
                                                      );
                                                      const next = [...prodVariants];
                                                      next[vIdx] = {
                                                        ...next[vIdx],
                                                        stockFloor2: nextF2,
                                                        stock: (Number(next[vIdx].stockFloor1) || 0) + nextF2,
                                                      };
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    className="w-24 px-2 py-1 rounded border border-purple-300 font-mono font-bold text-right text-purple-800"
                                                  />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-slate-900">
                                                  {(Number(v.stockFloor1) || 0) + (Number(v.stockFloor2) || 0)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right">
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    aria-label={`Giá niêm yết riêng ${childCode}`}
                                                    disabled={!v.variantKey && !v.variantCode}
                                                    defaultValue={Number(v.sellingPrice || 0) > 0 ? formatNumberDots(Number(v.sellingPrice)) : ""}
                                                    key={`sp_${p._id}_${vIdx}_${v.sellingPrice || 0}`}
                                                    placeholder={formatNumberDots(sellVal)}
                                                    onChange={(e) => {
                                                      const digits = e.target.value.replace(/\D/g, "");
                                                      e.target.value = digits ? formatNumberDots(Number(digits)) : "";
                                                    }}
                                                    onBlur={(e) => handleSaveVariantPrice(p, v, "sellingPrice", parseNumberDots(e.target.value))}
                                                    className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-right disabled:bg-slate-100"
                                                    title="Giá niêm yết riêng của biến thể — để trống = dùng giá niêm yết gốc (R8). Rời ô để lưu."
                                                  />
                                                </td>
                                                {canSeeCost && (
                                                  <td className="py-1.5 px-2.5 text-right">
                                                    <input
                                                      type="text"
                                                      inputMode="numeric"
                                                      aria-label={`Giá vốn riêng ${childCode}`}
                                                      disabled={!v.variantKey && !v.variantCode}
                                                      defaultValue={Number(v.costPrice || 0) > 0 ? formatNumberDots(Number(v.costPrice)) : ""}
                                                      key={`cp_${p._id}_${vIdx}_${v.costPrice || 0}`}
                                                      placeholder={formatNumberDots(costVal)}
                                                      onChange={(e) => {
                                                        const digits = e.target.value.replace(/\D/g, "");
                                                        e.target.value = digits ? formatNumberDots(Number(digits)) : "";
                                                      }}
                                                      onBlur={(e) => handleSaveVariantPrice(p, v, "costPrice", parseNumberDots(e.target.value))}
                                                      className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-right disabled:bg-slate-100"
                                                      title="Giá vốn riêng của biến thể — để trống = dùng giá vốn gốc. Rời ô để lưu."
                                                    />
                                                  </td>
                                                )}
                                                <td className="py-1.5 px-2.5 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenPrintLabelForProduct(p, v)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-[10px] font-bold"
                                                    title={`In tem mã con ${childCode}`}
                                                  >
                                                    <Printer className="w-3 h-3" /> In tem
                                                  </button>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const next = prodVariants.filter((_, i) => i !== vIdx);
                                                      setEditingVariants((prev) => ({
                                                        ...prev,
                                                        [p._id]: next,
                                                      }));
                                                    }}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                    title="Xóa phân loại này"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Dòng thêm nhanh Size / Màu mới */}
                                <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                      + Màu sắc mới (Chọn 1 hoặc nhiều màu)
                                    </label>
                                    <ColorInputWithPicker
                                      listId="cms-color-suggestions"
                                      value={newVarDraft.color}
                                      colorHexes={newVarDraft.colorHexes}
                                      onChange={(nextColor, nextHexes) =>
                                        setNewVariantInputs((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...newVarDraft,
                                            color: nextColor,
                                            colorHexes: nextHexes,
                                          },
                                        }))
                                      }
                                      placeholder="VD: Xanh, Đen..."
                                      className="w-48"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                      Size mới
                                    </label>
                                    <input
                                      type="text"
                                      list="cms-size-suggestions"
                                      value={newVarDraft.size}
                                      onChange={(e) =>
                                        setNewVariantInputs((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...newVarDraft,
                                            size: e.target.value.toUpperCase(),
                                          },
                                        }))
                                      }
                                      placeholder="M, L, XL, 42..."
                                      className="w-24 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono font-bold uppercase text-center bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-brand-ink mb-0.5">
                                      SL Kho Tầng 1
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={newVarDraft.stockFloor1}
                                      onChange={(e) =>
                                        setNewVariantInputs((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...newVarDraft,
                                            stockFloor1: Math.max(0, Number(e.target.value) || 0),
                                          },
                                        }))
                                      }
                                      className="w-24 px-2.5 py-1.5 rounded border border-teal-300 text-xs font-mono font-bold text-right bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-purple-700 mb-0.5">
                                      SL Kho Tầng 2
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={newVarDraft.stockFloor2}
                                      onChange={(e) =>
                                        setNewVariantInputs((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...newVarDraft,
                                            stockFloor2: Math.max(0, Number(e.target.value) || 0),
                                          },
                                        }))
                                      }
                                      className="w-24 px-2.5 py-1.5 rounded border border-purple-300 text-xs font-mono font-bold text-right bg-white"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={savingVariantsProdId === p._id}
                                    onClick={() => handleAddVariantToProduct(p)}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Thêm Size/Màu &amp; Lưu
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {displayedProducts.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-right uppercase">
                        Tổng toàn kho {activeWarehouseLabel} ({displayedProducts.length} mặt hàng):
                      </td>
                      {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0),
                            0
                          )}
                        </td>
                      )}
                      {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-purple-700">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor2) || 0),
                            0
                          )}
                        </td>
                      )}
                      {activeWarehouse === "ALL" && (
                        <td className="py-3 px-2.5 text-right font-mono text-slate-900">
                          {totalStockQty}
                        </td>
                      )}
                      <td className="py-3 px-2.5 text-right font-mono text-amber-800 whitespace-nowrap">
                        {formatVND(totalCostInventoryValue)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-brand-ink whitespace-nowrap">
                        {formatVND(totalSellInventoryValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {changedProducts.length > 0 && (
              <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white text-slate-900 shadow-xl border-2 border-teal-300">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold font-mono">
                    {changedProducts.length} SP
                  </span>
                  <span className="text-slate-700">
                    đang có thay đổi số lượng tồn kho / giá chưa lưu. Bấm <strong>Lưu thay đổi</strong> để cập nhật toàn bộ cùng lúc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllProductChanges}
                    disabled={changedProducts.length === 0 || savingBatch}
                    className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    {savingBatch ? "Đang lưu..." : `Lưu thay đổi (${changedProducts.length} SP)`}
                  </button>
                </div>
              </div>
            )}

            {renderPaginationBar({
              totalItems: displayedProducts.length,
              page: safeProdPage,
              totalPages: prodTotalPages,
              pageSize: prodPageSize,
              onPageChange: setProdPage,
              onPageSizeChange: setProdPageSize,
              itemLabel: "mặt hàng trong kho",
            })}
          </div>
        </div>
      )}

    </>
  );
}

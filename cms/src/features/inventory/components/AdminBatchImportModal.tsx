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
import { COMMON_COLORS, COMMON_SIZES } from "../types";

export function AdminBatchImportModal({ vm }: { vm: InventoryViewModel }) {
  const {
    products,
    categories,
    brandOptions,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
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
    setShowCodeCreator,
    catalogByCode,
    variantCodeFor,
    setShowLabelModal,
    setLabelItems,
    getAdminRowSuggestions,
    handleSelectAdminRowSuggestion,
    handleSelectAdminRowVariant,
    handleClearAdminRowProduct,
    handleUpdateAdminRow,
    handleAddAdminRow,
    handleDuplicateAdminRow,
    handleUpdateAdminRowColor,
    handleRemoveAdminRow,
    handleDownloadAdminSampleCsv,
    handleAdminImportFileChange,
    handleSubmitAdminBatchImport,
    productByCode,
  } = vm;

  return (
    <>
      {/* MODAL POPUP NHẬP KHO DÀNH CHO ADMIN (HỖ TRỢ NHẬP NHIỀU DÒNG & IMPORT EXCEL / CSV / PDF) */}
      {showAdminImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[1440px] max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Popup */}
            <div className="px-5 py-3.5 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-slate-900">
                  <Plus className="w-4 h-4 text-brand-ink" />
                  <span>Nhập Kho Sản Phẩm — Chọn Sản phẩm & Biến thể từ Danh mục</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Chọn sản phẩm/biến thể đã tạo sẵn (hoặc quét mã vạch), nhập <strong>Số lượng</strong> và <strong>Giá nhập</strong> là xong. Hàng mới chưa có trong danh mục thì bấm <strong>+ Tạo SP mới</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminImportModal(false)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitAdminBatchImport}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Input file ẩn để đọc .xlsx, .csv, .pdf */}
              <input
                ref={adminFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.pdf,.txt"
                onChange={handleAdminImportFileChange}
                className="hidden"
              />

              {/* Khung Ghi chú, Chọn Kho & Bộ lọc nhanh Category / Thương hiệu */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ghi chú Phiếu nhập kho
                  </label>
                  <input
                    type="text"
                    value={adminImportNote}
                    onChange={(e) => setAdminImportNote(e.target.value)}
                    placeholder="VD: Nhập lô hàng Giày Asics & Vợt Kamito đợt mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Category gợi ý
                  </label>
                  <select
                    value={importFilterCatId}
                    onChange={(e) => {
                      setImportFilterCatId(e.target.value);
                      setImportFilterBrandId("");
                    }}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        [{c.skuCode || c.code}] {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Thương hiệu gợi ý
                  </label>
                  <select
                    value={importFilterBrandId}
                    onChange={(e) => setImportFilterBrandId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Thương hiệu</option>
                    {brandOptions
                      .filter(
                        (b) =>
                          !importFilterCatId ||
                          b.isSystem ||
                          (b.categoryIds || []).map(String).includes(importFilterCatId)
                      )
                      .map((b) => (
                        <option key={b._id} value={b._id}>
                          [{b.code}] {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold uppercase text-brand-ink mb-1">
                    Nhập vào Kho (Chọn Tầng) *
                  </label>
                  <select
                    value={newProdWarehouse}
                    onChange={(e) =>
                      setNewProdWarehouse(
                        e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-teal-600 text-sm font-bold text-slate-900 bg-teal-50/40"
                  >
                    <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                    <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                  </select>
                </div>
              </div>

              {/* Thanh công cụ gọn: + Tạo SP mới (nếu chưa có), Import File, In Tem & Tick xác nhận */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCodeCreator(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    title="Nếu mặt hàng mới về chưa có trong danh mục, bấm để khai báo SP chuẩn mã rồi tự động đưa vào phiếu nhập"
                  >
                    <CopyPlus className="w-4 h-4" />
                    <span>+ Tạo SP mới (chưa có trong danh mục)</span>
                  </button>

                  <button
                    type="button"
                    disabled={importingAdminFile}
                    onClick={() => {
                      setAdminFileImportMode("replace");
                      adminFileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-teal-400" />
                    <span>
                      {importingAdminFile
                        ? "Đang đọc file..."
                        : "📄 Import PDF / Excel"}
                    </span>
                  </button>

                  {adminImportRows.some((r) => r.productName.trim() !== "") && (
                    <button
                      type="button"
                      disabled={importingAdminFile}
                      onClick={() => {
                        setAdminFileImportMode("append");
                        adminFileInputRef.current?.click();
                      }}
                      className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Nối thêm file</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadAdminSampleCsv}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>File Mẫu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const valid = adminImportRows.filter((r) => r.productName.trim() !== "");
                      if (valid.length === 0) {
                        alert("Chưa có dòng sản phẩm nào để in tem mã vạch!");
                        return;
                      }
                      const printable = valid.filter((it) => {
                        if (!it.productCode) return false;
                        const prod = catalogByCode.get(it.productCode.toUpperCase());
                        if (!prod) return false;
                        if (!prod.versionCode || (!it.color && !it.size)) return true;
                        return Boolean(findVariantByColorSize(prod, it.color, it.size));
                      });
                      if (printable.length === 0) {
                        alert(
                          "Các dòng chưa có mã do hệ thống sinh (biến thể mới). Hãy Hoàn thành nhập kho trước rồi in tem."
                        );
                        return;
                      }
                      if (printable.length < valid.length) {
                        alert(
                          `${valid.length - printable.length} dòng là biến thể mới chưa có mã — sẽ bỏ qua khi in. Hoàn thành nhập kho để hệ thống sinh mã.`
                        );
                      }
                      setLabelItems(
                        printable.map((it, idx) => {
                          const baseCode = it.productCode;
                          const childCode = variantCodeFor(baseCode, it.color, it.size);
                          const matchedProd = catalogByCode.get(baseCode.toUpperCase());
                          const matchedVariant = findVariantByColorSize(matchedProd, it.color, it.size);
                          const resolvedSellPrice =
                            Number(it.sellingPrice) > 0
                              ? Number(it.sellingPrice)
                              : matchedProd
                                ? variantEffectiveSellingPrice(matchedProd, matchedVariant)
                                : 0;
                          return {
                            id: `${childCode}_${idx}`,
                            code: childCode,
                            productCode: baseCode,
                            productName: it.productName,
                            color: it.color,
                            size: it.size,
                            sellingPrice: resolvedSellPrice,
                            unit: it.unit,
                            defaultQty: Math.max(1, Number(it.quantity || 1)),
                          };
                        })
                      );
                      setShowLabelModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      🖨️ In Tem ({adminImportRows.filter((r) => r.productName.trim() !== "").length})
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink font-bold">
                    Xác nhận: {adminImportRows.filter((r) => r.isConfirmed).length}/
                    {adminImportRows.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-600 text-white font-bold">
                    Tổng vốn:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.costPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-700 text-white font-bold">
                    Tổng niêm yết:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.sellingPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminImportRows((prev) =>
                        prev.map((r) => ({ ...r, isConfirmed: true }))
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Tick xác nhận tất cả
                  </button>
                </div>
              </div>

              {/* Bảng nhập gọn: Chọn Sản phẩm có sẵn -> Chọn Biến thể (Màu • Size) -> SL -> Giá */}
              <div
                className={`overflow-x-auto border border-slate-200 rounded-xl transition-all ${activeAdminSuggestRowIdx !== null ? "pb-60" : ""
                  }`}
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-3 px-2 text-center w-10">STT</th>
                      <th className="py-3 px-3 min-w-[280px]">
                        SẢN PHẨM (CHỌN TỪ DANH MỤC / QUÉT MÃ) *
                      </th>
                      <th className="py-3 px-3 min-w-[230px] text-amber-300">
                        BIẾN THỂ (MÀU • SIZE & MÃ CON) *
                      </th>
                      <th className="py-3 px-2 w-16 text-center">ĐVT</th>
                      <th className="py-3 px-2 w-24 min-w-[85px] text-right bg-amber-50 text-amber-800">
                        SỐ LƯỢNG
                      </th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right">
                        GIÁ VỐN NHẬP (VND)
                      </th>
                      <th className="py-3 px-2.5 w-32 min-w-[120px] text-right text-brand-ink">
                        GIÁ NIÊM YẾT (VND)
                      </th>
                      <th className="py-3 px-2 min-w-[120px]">GHI CHÚ</th>
                      <th className="py-3 px-2 w-20 text-center bg-teal-50 text-brand-ink">
                        XÁC NHẬN
                      </th>
                      <th className="py-3 px-2 w-16 text-center">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminImportRows.map((row, idx) => {
                      const existingProd =
                        (row.productId &&
                          (allCatalogProducts.length > 0 ? allCatalogProducts : products).find(
                            (p) => p._id === row.productId
                          )) ||
                        (row.productCode
                          ? catalogByCode.get(row.productCode.toUpperCase()) ||
                          productByCode.get(row.productCode)
                          : undefined);
                      const prodVariants = (existingProd?.variants || []).filter(
                        (v) => v.color || v.size
                      );
                      const currentVarKey = row.isNewVariant
                        ? "__NEW__"
                        : `${row.color || ""}||${row.size || ""}`;
                      const resolvedVarCode = existingProd
                        ? resolveVariantCode(existingProd, existingProd.code, row.color, row.size)
                        : variantCodeFor(row.productCode, row.color, row.size);

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 ${row.isConfirmed ? "bg-teal-50/20" : ""}`}
                        >
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 align-top pt-3.5">
                            {idx + 1}
                          </td>

                          {/* CỘT 1: CHỌN SẢN PHẨM TỪ DANH MỤC */}
                          <td className="py-2.5 px-3 align-top">
                            {existingProd ? (
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-mono font-extrabold text-[11px] text-brand-ink bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded mr-1.5">
                                      {existingProd.code}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs">
                                      {existingProd.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAdminRowProduct(idx)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 shrink-0 cursor-pointer"
                                  >
                                    Đổi SP
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                                    {existingProd.categoryName || "Danh mục"}
                                  </span>
                                  {(existingProd.brandName || existingProd.brand) && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-brand-ink font-bold">
                                      {existingProd.brandCode ? `[${existingProd.brandCode}] ` : ""}
                                      {existingProd.brandName || existingProd.brand}
                                    </span>
                                  )}
                                  {existingProd.versionName && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                                      Ver: {existingProd.versionName}
                                    </span>
                                  )}
                                  <span className="text-brand-ink font-bold ml-auto">
                                    Tồn: {existingProd.stock} {existingProd.unit}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={row.productName}
                                  onFocus={() => {
                                    setActiveAdminSuggestRowIdx(idx);
                                    setAdminSuggestHighlightIdx(0);
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveAdminSuggestRowIdx((prev) =>
                                        prev === idx ? null : prev
                                      );
                                    }, 180);
                                  }}
                                  onChange={(e) => {
                                    handleUpdateAdminRow(idx, "productName", e.target.value);
                                    setActiveAdminSuggestRowIdx(idx);
                                    setAdminSuggestHighlightIdx(0);
                                  }}
                                  onKeyDown={(e) => {
                                    if (activeAdminSuggestRowIdx !== idx) return;
                                    const suggestions = getAdminRowSuggestions(row.productName);
                                    if (suggestions.length === 0) return;
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      setAdminSuggestHighlightIdx(
                                        (prev) => (prev + 1) % suggestions.length
                                      );
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      setAdminSuggestHighlightIdx(
                                        (prev) =>
                                          (prev - 1 + suggestions.length) % suggestions.length
                                      );
                                    } else if (e.key === "Enter") {
                                      const picked =
                                        suggestions[adminSuggestHighlightIdx] || suggestions[0];
                                      if (picked) {
                                        e.preventDefault();
                                        handleSelectAdminRowSuggestion(idx, picked);
                                      }
                                    } else if (e.key === "Escape") {
                                      setActiveAdminSuggestRowIdx(null);
                                    }
                                  }}
                                  placeholder="🔍 Gõ tên, mã SP, version để chọn..."
                                  className="w-full px-2.5 py-2 rounded-lg border-2 border-teal-500/70 font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
                                />
                                {activeAdminSuggestRowIdx === idx &&
                                  (() => {
                                    const suggestions = getAdminRowSuggestions(row.productName);
                                    return (
                                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border-2 border-teal-500 shadow-2xl overflow-hidden min-w-[340px]">
                                        <div className="px-3 py-1.5 bg-teal-600 text-white text-[10px] font-bold flex items-center justify-between gap-2">
                                          <span>
                                            📦 Chọn sản phẩm từ danh mục ({suggestions.length})
                                          </span>
                                          <button
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              setActiveAdminSuggestRowIdx(null);
                                              setShowCodeCreator(true);
                                            }}
                                            className="text-amber-300 hover:underline font-extrabold cursor-pointer"
                                          >
                                            + Tạo SP mới
                                          </button>
                                        </div>
                                        {suggestions.length === 0 ? (
                                          <div className="p-3 text-center text-xs text-slate-500">
                                            Không tìm thấy sản phẩm khớp. Bấm{" "}
                                            <button
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                setActiveAdminSuggestRowIdx(null);
                                                setShowCodeCreator(true);
                                              }}
                                              className="font-extrabold text-brand-ink underline cursor-pointer"
                                            >
                                              + Tạo SP mới
                                            </button>{" "}
                                            để khai báo.
                                          </div>
                                        ) : (
                                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                            {suggestions.map((p, sIdx) => {
                                              const isHighlighted =
                                                sIdx === adminSuggestHighlightIdx;
                                              return (
                                                <button
                                                  key={p._id}
                                                  type="button"
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleSelectAdminRowSuggestion(idx, p);
                                                  }}
                                                  onMouseEnter={() =>
                                                    setAdminSuggestHighlightIdx(sIdx)
                                                  }
                                                  className={`w-full text-left px-3 py-2 transition flex flex-col gap-0.5 cursor-pointer ${isHighlighted
                                                      ? "bg-teal-50/90"
                                                      : "hover:bg-slate-50"
                                                    }`}
                                                >
                                                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                    <span className="font-mono font-extrabold text-[11px] text-brand-ink bg-teal-50 px-1.5 py-0.5 rounded">
                                                      {p.code}
                                                    </span>
                                                    <span>{p.name}</span>
                                                  </div>
                                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                                                    <span>
                                                      {p.categoryName}
                                                      {p.brandName || p.brand
                                                        ? ` • ${p.brandName || p.brand}`
                                                        : ""}
                                                      {p.versionName
                                                        ? ` • ${p.versionName}`
                                                        : ""}
                                                    </span>
                                                    <span className="text-brand-ink font-bold">
                                                      {(p.variants || []).length} biến thể • Tồn:{" "}
                                                      {p.stock} {p.unit}
                                                    </span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}
                          </td>

                          {/* CỘT 2: CHỌN BIẾN THỂ (MÀU • SIZE & MÃ CON) */}
                          <td className="py-2.5 px-3 align-top">
                            {existingProd && prodVariants.length > 0 && !row.isNewVariant ? (
                              <div className="space-y-1.5">
                                <select
                                  value={currentVarKey}
                                  onChange={(e) =>
                                    handleSelectAdminRowVariant(idx, existingProd, e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                                >
                                  {prodVariants.map((v, vIdx) => {
                                    const val = `${v.color || ""}||${v.size || ""}`;
                                    const vCode = resolveVariantCode(
                                      existingProd,
                                      existingProd.code,
                                      v.color,
                                      v.size
                                    );
                                    return (
                                      <option key={`${val}_${vIdx}`} value={val}>
                                        {v.color || "Mặc định"}
                                        {v.size ? ` - Size ${v.size}` : ""} ({vCode}) • Tồn:{" "}
                                        {v.stock ?? 0}
                                      </option>
                                    );
                                  })}
                                  <option value="__NEW__">+ Thêm Màu / Size mới cho SP này...</option>
                                </select>
                                {resolvedVarCode && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                      Mã con: {resolvedVarCode}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                                  <div className="sm:col-span-8">
                                    <ColorInputWithPicker
                                      listId="cms-color-suggestions"
                                      value={row.color}
                                      colorHexes={row.colorHexes}
                                      onChange={(nextColor, nextHexes) =>
                                        handleUpdateAdminRowColor(idx, nextColor, nextHexes)
                                      }
                                      placeholder="Màu sắc *"
                                    />
                                  </div>
                                  <div className="sm:col-span-4">
                                    <input
                                      type="text"
                                      list="cms-size-suggestions"
                                      value={row.size}
                                      onChange={(e) =>
                                        handleUpdateAdminRow(
                                          idx,
                                          "size",
                                          e.target.value.toUpperCase()
                                        )
                                      }
                                      placeholder="Size (41, L..)"
                                      className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-extrabold uppercase text-brand-ink focus:border-teal-600 focus:outline-none"
                                    />
                                  </div>
                                </div>
                                {existingProd && prodVariants.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectAdminRowVariant(
                                        idx,
                                        existingProd,
                                        `${prodVariants[0].color || ""}||${prodVariants[0].size || ""}`
                                      )
                                    }
                                    className="text-[10px] font-bold text-brand-ink hover:underline cursor-pointer"
                                  >
                                    ← Chọn từ {prodVariants.length} biến thể có sẵn
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* ĐVT */}
                          <td className="py-2.5 px-2 text-center align-top pt-3.5 font-semibold text-slate-700">
                            {existingProd?.unit || row.unit || "Cái"}
                          </td>

                          {/* SỐ LƯỢNG */}
                          <td className="py-2.5 px-2 align-top bg-amber-50/30">
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "quantity", e.target.value)
                              }
                              className="w-full px-2 py-1.5 rounded border-2 border-amber-400 text-right font-mono font-extrabold text-slate-900"
                            />
                          </td>

                          {/* GIÁ GỐC */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.costPrice > 0 ? formatNumberDots(row.costPrice) : ""}
                              onChange={(e) =>
                                handleUpdateAdminRow(
                                  idx,
                                  "costPrice",
                                  parseNumberDots(e.target.value)
                                )
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold text-slate-900"
                            />
                          </td>

                          {/* GIÁ BÁN */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                row.sellingPrice > 0 ? formatNumberDots(row.sellingPrice) : ""
                              }
                              onChange={(e) =>
                                handleUpdateAdminRow(
                                  idx,
                                  "sellingPrice",
                                  parseNumberDots(e.target.value)
                                )
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded border border-teal-300 text-right font-mono font-bold text-teal-900"
                            />
                          </td>

                          {/* GHI CHÚ */}
                          <td className="py-2.5 px-2 align-top">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) =>
                                handleUpdateAdminRow(idx, "note", e.target.value)
                              }
                              placeholder="Ghi chú..."
                              className="w-full px-2 py-1.5 rounded border border-slate-300"
                            />
                          </td>

                          {/* XÁC NHẬN */}
                          <td className="py-2.5 px-2 text-center bg-teal-50/30 align-top pt-3">
                            <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.isConfirmed}
                                onChange={(e) =>
                                  handleUpdateAdminRow(idx, "isConfirmed", e.target.checked)
                                }
                                className="w-4 h-4 accent-teal-600 rounded"
                              />
                              <span
                                className={`text-[10px] font-bold ${row.isConfirmed ? "text-brand-ink" : "text-slate-400"
                                  }`}
                              >
                                {row.isConfirmed ? "✓ Nhập" : "Bỏ qua"}
                              </span>
                            </label>
                          </td>

                          {/* THÊM / XÓA DÒNG */}
                          <td className="py-2.5 px-1.5 text-center align-top pt-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateAdminRow(idx)}
                                className="p-1.5 text-brand-ink hover:bg-teal-50 rounded cursor-pointer"
                                title="Thêm nhanh biến thể khác cho cùng sản phẩm này"
                              >
                                <CopyPlus className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdminRow(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="Xóa dòng"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Nút Thêm dòng mới nằm ngay dưới bảng trong phiếu */}
                <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleAddAdminRow}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm dòng nhập kho</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Chọn <strong>Sản phẩm</strong> → chọn <strong>Biến thể (Màu • Size)</strong> → điền <strong>Số lượng</strong>. Bấm biểu tượng nhân bản ở cuối dòng để nhập thêm Màu/Size khác của cùng sản phẩm.
                  </span>
                </div>
              </div>

              {/* Footer Popup */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Mặc định cột <strong>Xác nhận</strong> không tick. Vui lòng tick các dòng cần nhập hoặc bấm{" "}
                  <strong>Tick xác nhận tất cả</strong> trước khi hoàn thành.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminImportModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdminImport}
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submittingAdminImport
                        ? "Đang nhập kho..."
                        : `✅ Hoàn thành Nhập Kho (${adminImportRows.filter(
                          (r) =>
                            (r.productName.trim() !== "" || r.productCode.trim() !== "") &&
                            r.isConfirmed
                        ).length} dòng đã tick)`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALIST GỢI Ý MÀU SẮC & SIZE CHO CMS (GIỐNG WEB) */}
      <datalist id="cms-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="cms-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

    </>
  );
}

"use client";


import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Brand, Category, Product, ProductVariant } from "@/shared/types";
import { addProductVariantsApi, fetchBrandsApi } from "../api";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { filterAndRankBySearch, useDebounce } from "@/shared/lib/search";
import { formatNumberDots, formatVND, parseNumberDots } from "@/shared/utils/format";
import { resolveVariantCode, variantEffectiveCostPrice, variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import ProductCodeCreatorModal, { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import BarcodeLabelModal, { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportProducts } from "@/features/inventory";
import {
  ColorInputWithPicker,
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useProductCatalog, COMMON_COLORS, COMMON_SIZES, StockStatusFilter } from "../hooks/useProductCatalog";
import { ProductCatalogTable } from "./ProductCatalogTable";

export default function ProductCatalogModule() {
  const vm = useProductCatalog();
  const {
    canSeeCost,
    products,
    categories,
    brands,
    filterCategoryId,
    setFilterCategoryId,
    filterBrandId,
    setFilterBrandId,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    labelItems,
    showLabelModal,
    setShowLabelModal,
    statusMsg,
    setStatusMsg,
    visibleProducts,
    handleCodeCreatorDone,
  } = vm;

  return (
    <div className="space-y-6">
      {/* Banner hướng dẫn */}
      <div className="bg-white text-slate-900 rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-50 text-brand-ink border border-teal-100 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-0.5">
            <div className="font-extrabold text-sm text-slate-900">
              Danh mục Sản phẩm Chuẩn Mã (CATEGORY + BRAND + VERSION + MÀU + SIZE)
            </div>
            <p className="text-slate-600">
              Khai báo trước Mã gốc, các biến thể (Màu • Size), Giá vốn &amp; Giá niêm yết tại đây. Khi hàng về kho, chỉ cần vào{" "}
              <strong className="text-brand-ink">Quản lý Kho → + Nhập kho</strong> để chọn sẵn sản phẩm và nhập số lượng.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCodeCreator(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs inline-flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm Sản phẩm mới</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role={statusMsg.type === "error" ? "alert" : "status"}
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-brand-ink"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Khung bộ lọc & danh sách sản phẩm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-ink" />
            <span>Danh sách Sản phẩm ({visibleProducts.length}/{products.length} mã gốc)</span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã gốc, mã con, tên, ghi chú..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <select
              aria-label="Lọc theo danh mục"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
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
              value={filterBrandId}
              onChange={(e) => setFilterBrandId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Tất cả Thương hiệu</option>
              {brands
                .filter(
                  (b) =>
                    !filterCategoryId ||
                    b.isSystem ||
                    (b.categoryIds || []).map(String).includes(filterCategoryId)
                )
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
            </select>

            <select
              aria-label="Lọc theo trạng thái"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StockStatusFilter)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="NEW_SCHEME">Chuẩn mã v5.0 (có Version)</option>
              <option value="IN_STOCK">Đang có tồn kho (&gt; 0)</option>
              <option value="ZERO_STOCK">Chưa nhập tồn (= 0)</option>
            </select>

            <ExportExcelButton
              onExport={() => exportProducts(visibleProducts, { hideCost: !canSeeCost })}
              disabled={visibleProducts.length === 0}
            />
          </div>
        </div>

      <ProductCatalogTable vm={vm} />
      </div>

      <datalist id="catalog-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="catalog-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <ProductCodeCreatorModal
        open={showCodeCreator || Boolean(editingProductModal)}
        onClose={() => {
          setShowCodeCreator(false);
          setEditingProductModal(null);
        }}
        categories={categories}
        defaultCategoryId={filterCategoryId || undefined}
        editingProduct={editingProductModal}
        canSeeCost={canSeeCost}
        onDone={handleCodeCreatorDone}
        colorSuggestions={COMMON_COLORS}
        sizeSuggestions={COMMON_SIZES}
      />

      <BarcodeLabelModal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        items={labelItems}
        title="In Tem Nhãn Mã Vạch (Danh mục Sản phẩm)"
      />
    </div>
  );
}


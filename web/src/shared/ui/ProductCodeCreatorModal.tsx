"use client";

import React, { useEffect } from "react";
import type { Category, Product } from "@/shared/types";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { toCode } from "./productCodeCreatorTypes";
import type { ProductCodeCreatorResult } from "./productCodeCreatorTypes";
import { useProductCodeCreator } from "./useProductCodeCreator";
import ProductCodeCreatorVariantsTable from "./ProductCodeCreatorVariantsTable";
import ProductCodeCreatorPreview from "./ProductCodeCreatorPreview";

export type { CreatorVariantDraft, ProductCodeCreatorResult } from "./productCodeCreatorTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  defaultCategoryId?: string;
  /** Nếu truyền sản phẩm vào => chuyển sang chế độ Sửa Sản phẩm & Biến thể */
  editingProduct?: Product | null;
  /** Ẩn giá vốn (role SALES) */
  canSeeCost: boolean;
  /** Cho phép đặt giá bán (role có quyền sửa giá bán) */
  canSetSellingPrice?: boolean;
  onDone: (result: ProductCodeCreatorResult) => void;
  colorSuggestions?: string[];
  sizeSuggestions?: string[];
}

/**
 * v5.0 — Tạo hoặc Sửa sản phẩm theo quy chuẩn mã CATE + BRAND + VERSION + MÀU + SIZE.
 * Chọn Category → Brand (chỉ brand thuộc Category) → Version → biến thể (Màu/mã màu/Size/giá riêng).
 * Mã gốc & mã con được SERVER xem trước (POST /products/preview-code) và sinh khi lưu.
 */
export default function ProductCodeCreatorModal({
  open,
  onClose,
  categories,
  defaultCategoryId,
  editingProduct = null,
  canSeeCost,
  canSetSellingPrice = true,
  onDone,
  colorSuggestions = [],
  sizeSuggestions = [],
}: Props) {
  const c = useProductCodeCreator({
    open,
    onClose,
    categories,
    defaultCategoryId,
    editingProduct,
    canSeeCost,
    canSetSellingPrice,
    onDone,
  });
  const {
    isEditing,
    activeCategories,
    categoryId,
    setCategoryId,
    brands,
    brandsLoading,
    brandId,
    setBrandId,
    versionName,
    setVersionName,
    versionCode,
    setVersionCode,
    name,
    setName,
    unit,
    setUnit,
    sellingPrice,
    setSellingPrice,
    costPrice,
    setCostPrice,
    note,
    setNote,
    preview,
    selectedBrand,
    setDuplicate,
    handleClose,
    handleSubmit,
    submitting,
    dup,
    conflicts,
    error,
  } = c;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 flex items-start justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pcc-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="pcc-title" className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="w-5 h-5 text-brand-ink" />
                <span>
                  Sửa Sản phẩm &amp; Biến thể:{" "}
                  <span className="font-mono text-brand-ink">{editingProduct?.code}</span> —{" "}
                  {editingProduct?.name}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-brand-ink" />
                <span>Tạo sản phẩm chuẩn mã (Cate + Brand + Version + Màu + Size)</span>
              </>
            )}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="pcc-cat" className="block font-bold uppercase text-slate-600 mb-1">
                1. Danh mục *
              </label>
              <select
                id="pcc-cat"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setDuplicate(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
              >
                <option value="">-- Chọn danh mục --</option>
                {activeCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.skuCode ? `[${c.skuCode}] ` : `[${c.code.charAt(0)}] `}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pcc-brand" className="block font-bold uppercase text-slate-600 mb-1">
                2. Thương hiệu * {brandsLoading && <Loader2 className="w-3 h-3 inline animate-spin" />}
              </label>
              <select
                id="pcc-brand"
                value={brandId}
                disabled={!categoryId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setDuplicate(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold disabled:bg-slate-100"
              >
                <option value="">-- Chọn thương hiệu --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
              {categoryId && !brandsLoading && brands.length <= 1 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Chưa có thương hiệu cho danh mục này — thêm ở “Danh mục &amp; Thương hiệu”.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="pcc-vname" className="block font-bold uppercase text-slate-600 mb-1">
                3. Version (tên mẫu) *
              </label>
              <input
                id="pcc-vname"
                type="text"
                value={versionName}
                onChange={(e) => {
                  setVersionName(e.target.value);
                  setDuplicate(null);
                }}
                placeholder="VD: Solution Speed FF4"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="pcc-vcode" className="block font-bold uppercase text-slate-600 mb-1">
                Version code (≤ 6)
              </label>
              <input
                id="pcc-vcode"
                type="text"
                value={versionCode}
                maxLength={6}
                onChange={(e) => {
                  setVersionCode(toCode(e.target.value, 6));
                  setDuplicate(null);
                }}
                placeholder={
                  preview?.suggestedVersionCode ? `Gợi ý: ${preview.suggestedVersionCode}` : "Tự gợi ý"
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
              {preview?.suggestedVersionCode && !versionCode && (
                <button
                  type="button"
                  onClick={() => setVersionCode(preview.suggestedVersionCode)}
                  className="mt-1 text-[11px] text-brand-ink font-bold hover:underline cursor-pointer"
                >
                  Dùng gợi ý {preview.suggestedVersionCode}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="pcc-name" className="block font-bold uppercase text-slate-600 mb-1">
                Tên hiển thị sản phẩm
              </label>
              <input
                id="pcc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  selectedBrand && versionName
                    ? `${selectedBrand.isSystem ? "" : selectedBrand.name + " "}${versionName}`
                    : "Mặc định: Thương hiệu + Version"
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="pcc-unit" className="block font-bold uppercase text-slate-600 mb-1">
                ĐVT
              </label>
              <input
                id="pcc-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {canSetSellingPrice && (
                <div>
                  <label htmlFor="pcc-sell" className="block font-bold uppercase text-slate-600 mb-1">
                    Giá niêm yết
                  </label>
                  <input
                    id="pcc-sell"
                    type="text"
                    inputMode="numeric"
                    value={sellingPrice ? formatNumberDots(sellingPrice) : ""}
                    onChange={(e) => setSellingPrice(parseNumberDots(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 text-right font-bold"
                  />
                </div>
              )}
              {canSeeCost && (
                <div>
                  <label htmlFor="pcc-cost" className="block font-bold uppercase text-slate-600 mb-1">
                    Giá vốn
                  </label>
                  <input
                    id="pcc-cost"
                    type="text"
                    inputMode="numeric"
                    value={costPrice ? formatNumberDots(costPrice) : ""}
                    onChange={(e) => setCostPrice(parseNumberDots(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 text-right font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="pcc-note" className="block font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Ghi chú sản phẩm (tuỳ chọn)
            </label>
            <input
              id="pcc-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Form ôm chân nên tư vấn tăng 0.5 size, hàng bảo hành 6 tháng, chất liệu lưới thoáng khí..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <ProductCodeCreatorVariantsTable
            variants={c.variants}
            setVariants={c.setVariants}
            updateVariant={c.updateVariant}
            previewVariantFor={c.previewVariantFor}
            isEditing={isEditing}
            canSeeCost={canSeeCost}
            canSetSellingPrice={canSetSellingPrice}
            sellingPrice={sellingPrice}
            costPrice={costPrice}
            colorSuggestions={colorSuggestions}
            sizeSuggestions={sizeSuggestions}
          />

          {/* Xem trước mã do server sinh */}
          <ProductCodeCreatorPreview
            preview={preview}
            previewLoading={c.previewLoading}
            previewError={c.previewError}
            conflicts={conflicts}
            dup={dup}
            isEditing={isEditing}
            editingProduct={editingProduct}
            submitting={submitting}
            onAddVariantsToExisting={c.handleAddVariantsToExisting}
          />

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-bold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || Boolean(dup) || conflicts.length > 0}
            className={`px-5 py-2 rounded-lg disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
              isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              <Save className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isEditing ? "Lưu cập nhật Sản phẩm" : "Tạo sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}

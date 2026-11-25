"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Brand, Category, PreviewCodeResult, Product } from "@/shared/types";
import { addProductVariantsApi, fetchBrandsApi, previewProductCodeApi } from "@/shared/api/catalogLookup";
import { apiRequest } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { useDebounce } from "@/shared/lib/search";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  CreatorVariantDraft,
  EMPTY_VARIANT,
  ProductCodeCreatorProps,
  ProductCodeCreatorResult,
  toCode,
  useProductCodeCreator,
} from "./useProductCodeCreator";

export type { CreatorVariantDraft, ProductCodeCreatorResult };

export default function ProductCodeCreatorModal(props: ProductCodeCreatorProps) {
  const {
    editingProduct,
    canSeeCost,
    canSetSellingPrice,
    colorSuggestions,
    sizeSuggestions,
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
    variants,
    setVariants,
    preview,
    previewLoading,
    previewError,
    submitting,
    error,
    setDuplicate,
    selectedBrand,
    handleClose,
    updateVariant,
    handleSubmit,
    handleAddVariantsToExisting,
    dup,
    conflicts,
    previewVariantFor,
  } = useProductCodeCreator(props);

  if (!props.open) return null;

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold uppercase text-slate-700">
                4. Biến thể (Màu + Size) — giá riêng tuỳ chọn, trống = dùng giá mặc định
              </h3>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      ...EMPTY_VARIANT,
                      color: prev[prev.length - 1]?.color || "",
                      colorCode: prev[prev.length - 1]?.colorCode || "",
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm biến thể
              </button>
            </div>
            <datalist id="pcc-colors">
              {colorSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="pcc-sizes">
              {sizeSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-2 text-left">Màu *</th>
                    <th className="py-2 px-2 text-left">Mã màu (2–3)</th>
                    <th className="py-2 px-2 text-left">Size</th>
                    {canSetSellingPrice && <th className="py-2 px-2 text-right">Giá niêm yết riêng</th>}
                    {canSeeCost && <th className="py-2 px-2 text-right">Giá vốn riêng</th>}
                    {isEditing && <th className="py-2 px-2 text-center">Tồn hiện tại</th>}
                    <th className="py-2 px-2 text-left">Mã con (server)</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {variants.map((v, idx) => {
                    const pv = previewVariantFor(v);
                    const vStock = Number(v.stock ?? 0);
                    if (!props.open) return null;

  return (
                      <tr key={idx}>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Màu biến thể ${idx + 1}`}
                            list="pcc-colors"
                            value={v.color}
                            onChange={(e) => updateVariant(idx, { color: e.target.value })}
                            placeholder="VD: Đỏ"
                            className="w-32 px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Mã màu biến thể ${idx + 1}`}
                            value={v.colorCode}
                            maxLength={3}
                            onChange={(e) => updateVariant(idx, { colorCode: toCode(e.target.value, 3) })}
                            placeholder={pv?.colorCode ? pv.colorCode : "Tự gợi ý"}
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-mono font-bold"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Size biến thể ${idx + 1}`}
                            list="pcc-sizes"
                            value={v.size}
                            onChange={(e) => updateVariant(idx, { size: e.target.value.toUpperCase() })}
                            placeholder="VD: 40"
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-bold"
                          />
                        </td>
                        {canSetSellingPrice && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá niêm yết biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.sellingPrice ? formatNumberDots(v.sellingPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { sellingPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={sellingPrice ? formatNumberDots(sellingPrice) : "= giá niêm yết"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {canSeeCost && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá vốn biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.costPrice ? formatNumberDots(v.costPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { costPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={costPrice ? formatNumberDots(costPrice) : "= giá vốn"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {isEditing && (
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-600">
                            {vStock}
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-mono font-extrabold text-brand-ink">
                          {pv?.variantCode || <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            aria-label={`Xoá biến thể ${idx + 1}`}
                            disabled={isEditing && vStock > 0}
                            title={
                              isEditing && vStock > 0
                                ? `Biến thể đang có tồn (${vStock}) — không thể xoá`
                                : "Xoá dòng biến thể này"
                            }
                            onClick={() =>
                              setVariants((prev) =>
                                prev.length <= 1 ? [{ ...EMPTY_VARIANT }] : prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Xem trước mã do server sinh */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2" aria-live="polite">
            <div className="flex items-center gap-2 font-bold text-slate-700 uppercase">
              Mã gốc chuẩn mới (server xem trước) {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            {preview ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.categoryCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.brandCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.versionCode}
                  </span>
                  =
                  <span className="px-3 py-1 rounded bg-teal-600 text-white text-sm font-extrabold">
                    {preview.code}
                  </span>
                </div>
                {isEditing && editingProduct && preview.code !== editingProduct.code && (
                  <p className="text-[11px] text-brand-ink font-semibold">
                    ℹ️ Mã gốc sẽ đổi từ <strong className="font-mono">{editingProduct.code}</strong> sang{" "}
                    <strong className="font-mono">{preview.code}</strong> (mã cũ được tự động lưu vào{" "}
                    <code className="font-mono">legacyCode</code> để vẫn quét được tem cũ).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">
                {previewError || "Chọn Danh mục, Thương hiệu và nhập Version để xem mã."}
              </p>
            )}
            {preview && previewError === "" && conflicts.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  Mã trùng với sản phẩm khác (R10) — hãy sửa Version code hoặc mã màu:
                  <ul className="list-disc ml-4 font-mono">
                    {conflicts.map((c, i) => (
                      <li key={i}>
                        {c.code} ↔ SP {c.productCode}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {dup && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold flex flex-wrap items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Đã có sản phẩm cùng Danh mục + Thương hiệu + Version:{" "}
                  <span className="font-mono">{dup.code}</span>
                  {dup.name ? ` — ${dup.name}` : ""}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    disabled={submitting || !dup._id}
                    onClick={() => handleAddVariantsToExisting(dup._id)}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center gap-1 cursor-pointer"
                  >
                    <CopyPlus className="w-3.5 h-3.5" /> Thêm biến thể vào sản phẩm này
                  </button>
                )}
              </div>
            )}
          </div>

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
              isEditing ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-600 hover:bg-teal-700"
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


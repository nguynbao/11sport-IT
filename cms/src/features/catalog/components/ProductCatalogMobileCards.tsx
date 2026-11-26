"use client";

import React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { ProductCatalogViewModel } from "../hooks/useProductCatalog";
import { ProductCatalogVariantSection } from "./ProductCatalogVariantSection";

export function ProductCatalogMobileCards({ vm }: { vm: ProductCatalogViewModel }) {
  const {
    canSeeCost,
    loading,
    setEditingProductModal,
    expandedProdId,
    setExpandedProdId,
    editingBase,
    setEditingBase,
    savingProdId,
    categoryMap,
    brandMap,
    visibleProducts,
    handleSaveBaseProduct,
    handleDeleteProduct,
    handleOpenPrintLabel,
  } = vm;

  if (loading && visibleProducts.length === 0) {
    return (
      <div className="md:hidden py-8 text-center text-xs text-slate-500 border border-slate-200 rounded-xl bg-white">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Đang tải danh mục sản phẩm...
      </div>
    );
  }

  if (!loading && visibleProducts.length === 0) {
    return (
      <div className="md:hidden py-8 px-4 text-center text-xs text-slate-500 border border-slate-200 rounded-xl bg-white">
        Chưa có sản phẩm nào khớp bộ lọc. Bấm <strong>+ Thêm Sản phẩm mới</strong> để khai báo.
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {vm.productPagination.items.map((p, idx) => {
        const catId =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        const cat = categoryMap.get(catId);
        const brand = p.brandId ? brandMap.get(String(p.brandId)) : undefined;
        const baseEdit = editingBase[p._id] || {
          name: p.name || "",
          unit: p.unit || "Cái",
          costPrice: Number(p.costPrice || 0),
          sellingPrice: Number(p.sellingPrice || 0),
          note: p.note || "",
        };
        const isBaseChanged =
          baseEdit.name.trim() !== String(p.name || "").trim() ||
          baseEdit.unit.trim() !== String(p.unit || "Cái").trim() ||
          String(baseEdit.note || "").trim() !== String(p.note || "").trim() ||
          Number(baseEdit.costPrice || 0) !== Number(p.costPrice || 0) ||
          Number(baseEdit.sellingPrice || 0) !== Number(p.sellingPrice || 0);

        const prodVariants = Array.isArray(p.variants) ? p.variants : [];
        const isExpanded = expandedProdId === p._id;
        const totalStock = Number(
          p.stock ?? (Number(p.stockFloor1 || 0) + Number(p.stockFloor2 || 0))
        );
        const stt = (vm.productPagination.page - 1) * vm.productPagination.pageSize + idx + 1;

        return (
          <div
            key={p._id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5"
          >
            {/* 1. STT + Mã gốc */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px] font-bold">
                  #{stt}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-brand-ink font-mono text-xs font-extrabold truncate">
                  {p.code}
                </span>
              </div>
              {p.legacyCode && p.legacyCode !== p.code && (
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  Cũ: {p.legacyCode}
                </span>
              )}
            </div>

            {/* 2. Tên sản phẩm + Ghi chú */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={baseEdit.name}
                onChange={(e) =>
                  setEditingBase((prev) => ({
                    ...prev,
                    [p._id]: { ...baseEdit, name: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-teal-500 font-extrabold text-sm text-slate-900 bg-white"
              />
              <div className="relative">
                <FileText className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={baseEdit.note || ""}
                  onChange={(e) =>
                    setEditingBase((prev) => ({
                      ...prev,
                      [p._id]: { ...baseEdit, note: e.target.value },
                    }))
                  }
                  placeholder="Ghi chú sản phẩm..."
                  className="w-full pl-7 pr-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50/70 text-[11px] text-slate-700"
                />
              </div>
            </div>

            {/* 3. Phân loại / Biến thể */}
            <div className="space-y-1.5">
              {prodVariants.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prodVariants.slice(0, 4).map((v, vIdx) => {
                    const vCode = resolveVariantCode(p, p.code, v.color, v.size);
                    return (
                      <span
                        key={`${vCode}_${vIdx}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 max-w-full"
                      >
                        <span className="font-bold text-slate-900">{v.color}</span>
                        {v.size && <span className="text-brand-ink font-mono">• {v.size}</span>}
                      </span>
                    );
                  })}
                  {prodVariants.length > 4 && (
                    <span className="text-[10px] text-slate-500 font-bold self-center">
                      +{prodVariants.length - 4} nữa
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setExpandedProdId(isExpanded ? null : p._id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                  isExpanded
                    ? "bg-teal-600 text-white border-teal-700"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Chi tiết ({prodVariants.length} mã con) / +Size,Màu</span>
              </button>

              {isExpanded && (
                <div className="overflow-x-auto rounded-xl border border-indigo-200 bg-indigo-50/30">
                  <table className="w-full text-xs text-left">
                    <tbody>
                      <ProductCatalogVariantSection
                        vm={vm}
                        product={p}
                        prodVariants={prodVariants}
                        baseEdit={baseEdit}
                      />
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Danh mục & Thương hiệu */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-slate-200 text-xs">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-400">Danh mục</div>
                <div className="font-bold text-slate-800 truncate">
                  {cat?.name || p.categoryName || "—"}
                </div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">Thương hiệu</div>
                <div className="font-bold text-slate-800 truncate">
                  {p.brandName || brand?.name || p.brand || "Không hãng"}
                </div>
              </div>
            </div>

            {/* 5. ĐVT & Tồn */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">ĐVT:</span>
                <input
                  type="text"
                  value={baseEdit.unit}
                  onChange={(e) =>
                    setEditingBase((prev) => ({
                      ...prev,
                      [p._id]: { ...baseEdit, unit: e.target.value },
                    }))
                  }
                  className="w-16 px-2 py-0.5 rounded border border-slate-200 text-center font-bold text-slate-800 bg-slate-50"
                />
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-extrabold ${
                  totalStock > 0
                    ? "bg-amber-50 border border-amber-200 text-brand-ink"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Tồn: {totalStock} {baseEdit.unit || p.unit}
              </span>
            </div>

            {/* 6. Giá vốn & Giá niêm yết */}
            <div className={`grid gap-2 pt-2 border-t border-dashed border-slate-200 ${canSeeCost ? "grid-cols-2" : "grid-cols-1"}`}>
              {canSeeCost && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Giá vốn
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={baseEdit.costPrice > 0 ? formatNumberDots(baseEdit.costPrice) : ""}
                    placeholder="0"
                    onChange={(e) =>
                      setEditingBase((prev) => ({
                        ...prev,
                        [p._id]: { ...baseEdit, costPrice: parseNumberDots(e.target.value) },
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-right font-mono text-xs font-bold text-slate-800"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5 text-right">
                  Giá niêm yết
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={baseEdit.sellingPrice > 0 ? formatNumberDots(baseEdit.sellingPrice) : ""}
                  placeholder="0"
                  onChange={(e) =>
                    setEditingBase((prev) => ({
                      ...prev,
                      [p._id]: { ...baseEdit, sellingPrice: parseNumberDots(e.target.value) },
                    }))
                  }
                  className="w-full px-2.5 py-1 rounded-lg border border-teal-300 text-right font-mono text-xs font-extrabold text-brand-ink"
                />
              </div>
            </div>

            {/* 7. Thao tác */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {isBaseChanged && (
                <>
                  <button
                    type="button"
                    disabled={savingProdId === p._id}
                    onClick={() => handleSaveBaseProduct(p)}
                    className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingProdId === p._id ? "Lưu..." : "Lưu"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBase((prev) => ({
                        ...prev,
                        [p._id]: {
                          name: p.name || "",
                          unit: p.unit || "Cái",
                          costPrice: Number(p.costPrice || 0),
                          sellingPrice: Number(p.sellingPrice || 0),
                          note: p.note || "",
                        },
                      }))
                    }
                    className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
                    title="Hoàn tác"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleOpenPrintLabel(p)}
                className="flex-1 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-brand-ink border border-amber-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> In tem
              </button>
              <button
                type="button"
                onClick={() => setEditingProductModal(p)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Sửa
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(p)}
                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 inline-flex items-center justify-center cursor-pointer"
                title="Xóa sản phẩm"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

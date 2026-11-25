"use client";


import { formatNumberDots,parseNumberDots } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import {
ChevronDown,
ChevronUp,
FileText,
Loader2,
Pencil,
Printer,
RotateCcw,
Save,
Trash2
} from "lucide-react";
import React from "react";
import { ProductCatalogViewModel } from "../hooks/useProductCatalog";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { ProductCatalogVariantSection } from "./ProductCatalogVariantSection";

export function ProductCatalogTable({ vm }: { vm: ProductCatalogViewModel }) {
  const {
    canSeeCost,
    loading,
    setEditingProductModal,
    expandedProdId,
    setExpandedProdId,
    editingBase,
    setEditingBase,
    savingProdId,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    categoryMap,
    brandMap,
    visibleProducts,
    handleSaveBaseProduct,
    handleSaveVariantPrice,
    handleAddVariant,
    handleDeleteProduct,
    handleOpenPrintLabel,
  } = vm;

  return (
    <>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3">Mã gốc &amp; Mã cũ</th>
                <th className="py-3 px-3 min-w-[260px]">Tên sản phẩm, Ghi chú &amp; Biến thể</th>
                <th className="py-3 px-3">Category • Brand • Version</th>
                <th className="py-3 px-2.5 text-center w-20">ĐVT</th>
                {canSeeCost && <th className="py-3 px-3 text-right w-36">Giá vốn</th>}
                <th className="py-3 px-3 text-right w-36">Giá niêm yết</th>
                <th className="py-3 px-3 text-center w-24">Tồn hiện tại</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={canSeeCost ? 9 : 8} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Đang tải danh mục sản phẩm...
                  </td>
                </tr>
              )}
              {!loading && visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={canSeeCost ? 9 : 8} className="py-8 text-center text-slate-500">
                    Chưa có sản phẩm nào khớp bộ lọc. Bấm <strong>+ Thêm Sản phẩm mới</strong> để khai báo.
                  </td>
                </tr>
              )}
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
                const newVarDraft = newVariantDrafts[p._id] || {
                  color: "",
                  colorCode: "",
                  colorHexes: [],
                  size: "",
                  costPrice: 0,
                  sellingPrice: 0,
                };
                const totalStock = Number(
                  p.stock ?? (Number(p.stockFloor1 || 0) + Number(p.stockFloor2 || 0))
                );

                return (
                  <React.Fragment key={p._id}>
                    <tr className={`hover:bg-slate-50 ${isExpanded ? "bg-indigo-50/30" : ""}`}>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 align-top">
                        {(vm.productPagination.page - 1) * vm.productPagination.pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono font-extrabold text-slate-900 text-xs">{p.code}</div>
                        {p.legacyCode && p.legacyCode !== p.code && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Mã cũ: {p.legacyCode}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top space-y-1.5">
                        <input
                          type="text"
                          value={baseEdit.name}
                          onChange={(e) =>
                            setEditingBase((prev) => ({
                              ...prev,
                              [p._id]: { ...baseEdit, name: e.target.value },
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveBaseProduct(p);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-bold text-slate-900 bg-white"
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveBaseProduct(p);
                              }
                            }}
                            placeholder="Ghi chú sản phẩm (VD: chất liệu, bảo hành, tư vấn size...)"
                            className={`w-full pl-7 pr-2.5 py-1 rounded border text-[11px] transition ${
                              baseEdit.note
                                ? "border-amber-200 bg-amber-50/40 text-slate-800 font-medium"
                                : "border-slate-200 bg-slate-50/60 text-slate-600 placeholder:text-slate-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedProdId(isExpanded ? null : p._id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold transition cursor-pointer ${
                              isExpanded
                                ? "bg-indigo-600 text-white border-indigo-700"
                                : "bg-indigo-50 hover:bg-indigo-100 text-brand-ink border-indigo-200"
                            }`}
                          >
                            <span>
                              🎨 {prodVariants.length} biến thể (Màu/Size) · + Thêm biến thể
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {prodVariants.slice(0, 4).map((v, vIdx) => {
                            const vCode = resolveVariantCode(p, p.code, v.color, v.size);
                            return (
                              <span
                                key={`${vCode}_${vIdx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                                title={`Mã con: ${vCode}`}
                              >
                                <span className="font-bold text-slate-900">{v.color}</span>
                                {v.size && <span className="text-brand-ink font-mono">• {v.size}</span>}
                                <span className="font-mono text-slate-500">[{vCode}]</span>
                              </span>
                            );
                          })}
                          {prodVariants.length > 4 && (
                            <span className="text-[10px] text-slate-500 font-bold">
                              +{prodVariants.length - 4} biến thể...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-bold text-[11px]">
                            {cat?.skuCode ? `[${cat.skuCode}] ` : ""}
                            {cat?.name || p.categoryName || "—"}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-bold text-[11px]">
                            {p.brandCode || brand?.code ? `[${p.brandCode || brand?.code}] ` : ""}
                            {p.brandName || brand?.name || p.brand || "NN"}
                          </span>
                        </div>
                        {(p.versionName || p.versionCode) && (
                          <div className="text-[11px] text-slate-600">
                            Version: <strong className="text-slate-900">{p.versionName || "—"}</strong>{" "}
                            {p.versionCode && (
                              <span className="font-mono font-bold text-brand-ink">({p.versionCode})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2.5 text-center align-top">
                        <input
                          type="text"
                          value={baseEdit.unit}
                          onChange={(e) =>
                            setEditingBase((prev) => ({
                              ...prev,
                              [p._id]: { ...baseEdit, unit: e.target.value },
                            }))
                          }
                          className="w-16 px-2 py-1.5 rounded border border-slate-300 text-center font-semibold"
                        />
                      </td>
                      {canSeeCost && (
                        <td className="py-3 px-3 text-right align-top">
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
                            className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3 text-right align-top">
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
                          className="w-28 px-2 py-1.5 rounded border border-teal-300 text-right font-mono font-bold text-teal-900"
                        />
                      </td>
                      <td className="py-3 px-3 text-center align-top font-mono font-extrabold text-slate-800">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            totalStock > 0
                              ? "bg-teal-100 text-brand-ink"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {totalStock} {baseEdit.unit || p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProductModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Sửa đầy đủ Danh mục, Thương hiệu, Version, Mã Version, Tên SP, Giá và các Biến thể Màu/Size"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Sửa
                          </button>
                          {isBaseChanged && (
                            <>
                              <button
                                type="button"
                                disabled={savingProdId === p._id}
                                onClick={() => handleSaveBaseProduct(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-xs"
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
                                title="Hoàn tác thay đổi chưa lưu"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPrintLabel(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="In tem nhãn mã vạch cho sản phẩm này"
                          >
                            <Printer className="w-3.5 h-3.5" /> In tem
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 inline-flex items-center justify-center cursor-pointer"
                            title="Xóa sản phẩm (khi chưa phát sinh giao dịch)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <ProductCatalogVariantSection vm={vm} product={p} prodVariants={prodVariants} baseEdit={baseEdit} />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar
          totalItems={vm.productPagination.total}
          page={vm.productPagination.page}
          totalPages={vm.productPagination.totalPages}
          pageSize={vm.productPagination.pageSize}
          onPageChange={vm.productPagination.setPage}
          onPageSizeChange={vm.productPagination.setPageSize}
          itemLabel="sản phẩm"
        />
    </>
  );
}

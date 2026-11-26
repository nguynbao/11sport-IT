"use client";

import { Product,ProductVariant } from "@/shared/types";
import {
ColorInputWithPicker,
ColorSwatchBadge,
getColorBoxBorderStyle,
resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import { formatNumberDots,formatVND,parseNumberDots } from "@/shared/utils/format";
import { resolveVariantCode,variantEffectiveCostPrice,variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import { Pencil,Plus,Printer } from "lucide-react";
import { ProductCatalogViewModel } from "../hooks/useProductCatalog";

export function ProductCatalogVariantSection({
  vm,
  product: p,
  prodVariants,
  baseEdit,
}: {
  vm: ProductCatalogViewModel;
  product: Product;
  prodVariants: ProductVariant[];
  baseEdit: { costPrice: number; sellingPrice: number };
}) {
  const {
    canSeeCost,
    setEditingProductModal,
    handleOpenPrintLabel,
    handleSaveVariantPrice,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    handleAddVariant,
  } = vm;
  const newVarDraft = newVariantDrafts[p._id] || {
    color: "",
    size: "",
    costPrice: 0,
    sellingPrice: 0,
  };

  return (
                      <tr className="bg-indigo-50/40">
                        <td colSpan={canSeeCost ? 9 : 8} className="p-4">
                          <div className="bg-white rounded-xl border-2 border-indigo-200 p-4 space-y-4 shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="font-extrabold text-indigo-950 text-xs">
                                  Danh sách Biến thể (Màu • Size • Mã con) của SP:{" "}
                                  <span className="font-mono text-brand-ink">{p.code}</span> — {p.name}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Giá riêng của biến thể nếu để trống (hoặc 0) sẽ tự động dùng Giá vốn (
                                  {formatVND(baseEdit.costPrice)}) và Giá niêm yết ({formatVND(baseEdit.sellingPrice)}) mặc định của sản phẩm gốc.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingProductModal(p)}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Sửa Category / Brand / Version / Biến thể
                              </button>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table data-cards className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px]">
                                  <tr>
                                    <th className="py-2 px-3 w-10 text-center">#</th>
                                    <th className="py-2 px-3">Mã con (variantCode)</th>
                                    <th className="py-2 px-3">Màu sắc &amp; Mã màu</th>
                                    <th className="py-2 px-3">Size</th>
                                    {canSeeCost && <th className="py-2 px-3 text-right">Giá vốn riêng</th>}
                                    <th className="py-2 px-3 text-right">Giá niêm yết riêng</th>
                                    <th className="py-2 px-3 text-center">Tồn hiện tại</th>
                                    <th className="py-2 px-3 text-right">In tem lẻ</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {prodVariants.length === 0 ? (
                                    <tr>
                                      <td colSpan={canSeeCost ? 8 : 7} className="py-4 text-center text-slate-400">
                                        Chưa có biến thể nào. Hãy thêm biến thể (Màu / Size) ở khung bên dưới.
                                      </td>
                                    </tr>
                                  ) : (
                                    prodVariants.map((v, vIdx) => {
                                      const vCode = resolveVariantCode(p, p.code, v.color, v.size);
                                      const hexes = resolveVariantColorHexes(v.color, v.colorHexes);
                                      const effCost = variantEffectiveCostPrice(p, v);
                                      const effSell = variantEffectiveSellingPrice(p, v);
                                      const vStock =
                                        Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0)));
                                      return (
                                        <tr key={`${vCode}_${vIdx}`} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                                            {vIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-extrabold text-brand-ink">
                                            {vCode}
                                          </td>
                                          <td className="py-2 px-3">
                                            <div
                                              style={getColorBoxBorderStyle(hexes, "var(--box-bg, #f8fafc)", 2)}
                                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-50"
                                            >
                                              <ColorSwatchBadge hexes={hexes} colorName={v.color} size="xs" />
                                              <span className="font-bold text-slate-900">{v.color}</span>
                                              {v.colorCode && (
                                                <span className="font-mono text-[10px] text-slate-500">
                                                  ({v.colorCode})
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 font-mono font-extrabold text-slate-900">
                                            {v.size || "—"}
                                          </td>
                                          {canSeeCost && (
                                            <td className="py-2 px-3 text-right">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                defaultValue={
                                                  Number(v.costPrice || 0) > 0
                                                    ? formatNumberDots(Number(v.costPrice))
                                                    : ""
                                                }
                                                key={`vcost_${p._id}_${vIdx}_${v.costPrice || 0}`}
                                                placeholder={`Mặc định: ${formatNumberDots(effCost)}`}
                                                onChange={(e) => {
                                                  const digits = e.target.value.replace(/\D/g, "");
                                                  e.target.value = digits ? formatNumberDots(Number(digits)) : "";
                                                }}
                                                onBlur={(e) =>
                                                  handleSaveVariantPrice(
                                                    p,
                                                    v,
                                                    "costPrice",
                                                    parseNumberDots(e.target.value)
                                                  )
                                                }
                                                className="w-32 px-2 py-1 rounded border border-slate-300 font-mono text-right"
                                              />
                                            </td>
                                          )}
                                          <td className="py-2 px-3 text-right">
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              defaultValue={
                                                Number(v.sellingPrice || 0) > 0
                                                  ? formatNumberDots(Number(v.sellingPrice))
                                                  : ""
                                              }
                                              key={`vsell_${p._id}_${vIdx}_${v.sellingPrice || 0}`}
                                              placeholder={`Mặc định: ${formatNumberDots(effSell)}`}
                                              onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, "");
                                                e.target.value = digits ? formatNumberDots(Number(digits)) : "";
                                              }}
                                              onBlur={(e) =>
                                                handleSaveVariantPrice(
                                                  p,
                                                  v,
                                                  "sellingPrice",
                                                  parseNumberDots(e.target.value)
                                                )
                                              }
                                              className="w-32 px-2 py-1 rounded border border-teal-300 font-mono text-right text-teal-900 font-bold"
                                            />
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                            {vStock} (T1: {v.stockFloor1 || 0} · T2: {v.stockFloor2 || 0})
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPrintLabel(p, v)}
                                              className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <Printer className="w-3 h-3" /> In tem
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Form thêm biến thể mới vào sản phẩm */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  + Màu sắc mới *
                                </label>
                                <ColorInputWithPicker
                                  listId="catalog-color-suggestions"
                                  value={newVarDraft.color}
                                  colorHexes={newVarDraft.colorHexes}
                                  onChange={(nextColor, nextHexes) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        color: nextColor,
                                        colorHexes: nextHexes,
                                      },
                                    }))
                                  }
                                  placeholder="VD: Đỏ, Trắng..."
                                  className="w-48"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Mã màu (2–3 ký tự)
                                </label>
                                <input
                                  type="text"
                                  maxLength={3}
                                  value={newVarDraft.colorCode}
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        colorCode: e.target.value
                                          .toUpperCase()
                                          .replace(/[^A-Z0-9]/g, "")
                                          .slice(0, 3),
                                      },
                                    }))
                                  }
                                  placeholder="Tự gợi ý"
                                  className="w-24 px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold text-xs bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Size
                                </label>
                                <input
                                  type="text"
                                  list="catalog-size-suggestions"
                                  value={newVarDraft.size}
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        size: e.target.value.toUpperCase(),
                                      },
                                    }))
                                  }
                                  placeholder="VD: 40, L, XL..."
                                  className="w-24 px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold text-xs uppercase bg-white"
                                />
                              </div>
                              {canSeeCost && (
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                    Giá vốn riêng (tuỳ chọn)
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newVarDraft.costPrice > 0 ? formatNumberDots(newVarDraft.costPrice) : ""}
                                    onChange={(e) =>
                                      setNewVariantDrafts((prev) => ({
                                        ...prev,
                                        [p._id]: {
                                          ...newVarDraft,
                                          costPrice: parseNumberDots(e.target.value),
                                        },
                                      }))
                                    }
                                    placeholder="= giá vốn"
                                    className="w-28 px-2.5 py-1.5 rounded border border-slate-300 font-mono text-right text-xs bg-white"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Giá niêm yết riêng (tuỳ chọn)
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={
                                    newVarDraft.sellingPrice > 0 ? formatNumberDots(newVarDraft.sellingPrice) : ""
                                  }
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        sellingPrice: parseNumberDots(e.target.value),
                                      },
                                    }))
                                  }
                                  placeholder="= giá niêm yết"
                                  className="w-28 px-2.5 py-1.5 rounded border border-slate-300 font-mono text-right text-xs bg-white"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={addingVariantProdId === p._id}
                                onClick={() => handleAddVariant(p)}
                                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {addingVariantProdId === p._id
                                  ? "Đang thêm..."
                                  : "+ Thêm biến thể (Màu/Size)"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
  );
}

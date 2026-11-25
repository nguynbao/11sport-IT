"use client";

import {
ColorSwatchBadge,
resolveVariantColorHexes
} from "@/shared/ui/ColorSwatchPicker";
import { formatNumberDots } from "@/shared/utils/format";
import {
ArrowLeftRight,
Pencil,
Printer,
RotateCcw,
Save,
Trash2
} from "lucide-react";
import React from "react";
import { InventoryViewModel } from "../hooks/useInventoryModule";

import { InventoryTableFooter } from "./InventoryTableFooter";
import { InventoryVariantsPanel } from "./InventoryVariantsPanel";

export function InventoryProductsTable({ vm }: { vm: InventoryViewModel }) {
  const {
    setSubTab,
    activeWarehouse,
    categories,
    categoryId,
    prodPageSize,
    editingNames,
    editingNotes,
    editingCats,
    editingFloor1,
    editingFloor2,
    editingCosts,
    editingPrices,
    setEditingProductModal,
    variantCodeFor,
    expandedVariantProdId,
    setExpandedVariantProdId,
    editingVariants,
    newVariantInputs,
    unpackingLoadingId,
    scannedCheckCounts,
    lastScannedProdId,
    lastScannedVariantCode,
    setTransferDirection,
    setTransferProductId,
    savingBatch,
    isProductChanged,
    handleSaveSingleProductRow,
    handleResetSingleProductRow,
    handleDeleteProduct,
    handleOpenPrintLabelForProduct,
    handleOpenSetLinkModal,
    handleQuickUnpackSet,
    displayedProducts,
    totalStockQty,
    totalCostInventoryValue,
    totalSellInventoryValue,
    activeWarehouseLabel,
    safeProdPage,
    pagedProducts,
  } = vm;

  return (
    <>
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
                        <InventoryVariantsPanel vm={vm} p={p} costVal={costVal} sellVal={sellVal} prodVariants={prodVariants} namedVars={namedVars} isVarExpanded={isVarExpanded} newVarDraft={newVarDraft} />
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <InventoryTableFooter vm={vm} />
              </table>
            </div>
    </>
  );
}

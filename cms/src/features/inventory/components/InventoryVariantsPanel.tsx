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


export function InventoryVariantsPanel({
  vm,
  p,
  costVal,
  sellVal,
  prodVariants,
  namedVars,
  isVarExpanded,
  newVarDraft,
}: {
  vm: InventoryViewModel;
  p: Product;
  costVal: number;
  sellVal: number;
  prodVariants: ProductVariant[];
  namedVars: ProductVariant[];
  isVarExpanded: boolean;
  newVarDraft: { color: string; colorHexes?: string[]; size: string; stockFloor1: number; stockFloor2: number };
}) {
  const {
    activeWarehouse,
    canSeeCost,
    variantCodeFor,
    cmsVarColorFilter,
    setCmsVarColorFilter,
    cmsVarSearch,
    setCmsVarSearch,
    setEditingVariants,
    setNewVariantInputs,
    savingVariantsProdId,
    scannedVariantCounts,
    lastScannedVariantCode,
    handleSaveProductVariants,
    handleSaveVariantPrice,
    handleAddVariantToProduct,
    handleOpenPrintLabelForProduct,
  } = vm;

  return (
    <>
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
    </>
  );
}

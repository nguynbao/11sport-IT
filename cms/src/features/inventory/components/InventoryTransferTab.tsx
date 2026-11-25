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

export function InventoryTransferTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    setSubTab,
    setHistoryView,
    products,
    variantCodeFor,
    transferDirection,
    transferProductId,
    setTransferProductId,
    transferColor,
    setTransferColor,
    transferSize,
    setTransferSize,
    transferQty,
    setTransferQty,
    transferSearch,
    setTransferSearch,
    transferSuggestOpen,
    setTransferSuggestOpen,
    transferItems,
    setTransferItems,
    transferNote,
    setTransferNote,
    sourceFloorProducts,
    getSourceFloorStock,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    getSourceVariantFloorStock,
    getTransferItemKey,
    handleSelectTransferProduct,
    handleChangeTransferDirection,
    handleAddTransferItem,
    handleUpdateTransferItemVariant,
    handleUpdateTransferItemQty,
    handleRemoveTransferItem,
    handleCreateTransfer,
  } = vm;

  return (
    <>
      {/* SUB-TAB 2: XUẤT KHO CHUYỂN TẦNG (KHO TẦNG 1 <-> KHO TẦNG 2) */}
      {subTab === "TRANSFER" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-brand-ink" />
                  Tạo Phiếu Xuất Kho Chuyển Tầng (Kho 1 ↔ Kho 2)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn hướng dời kho → thêm sản phẩm vào phiếu → bấm <strong>Xác nhận Tạo Phiếu Xuất Kho</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryView("TRANSFERS");
                  setSubTab("HISTORY");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                Xem lịch sử chuyển tầng →
              </button>
            </div>

            {/* BƯỚC 1: CHỌN HƯỚNG DỜI KHO (GỌN 1 HÀNG) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleChangeTransferDirection("F1_TO_F2")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${transferDirection === "F1_TO_F2"
                  ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                  : "bg-slate-50 text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
              >
                <div className="text-xs font-extrabold">
                  🏢 Kho Tầng 1 → 🏬 Kho Tầng 2
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-extrabold ${transferDirection === "F1_TO_F2"
                    ? "bg-white/20 text-white"
                    : "bg-white text-brand-ink border border-slate-200"
                    }`}
                >
                  {products.filter((p) => (Number(p.stockFloor1 ?? p.stock) || 0) > 0).length} SP
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleChangeTransferDirection("F2_TO_F1")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${transferDirection === "F2_TO_F1"
                  ? "bg-teal-600 text-white border-teal-700 shadow-sm"
                  : "bg-slate-50 text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
              >
                <div className="text-xs font-extrabold">
                  🏬 Kho Tầng 2 → 🏢 Kho Tầng 1
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-extrabold ${transferDirection === "F2_TO_F1"
                    ? "bg-white/20 text-white"
                    : "bg-white text-brand-ink border border-slate-200"
                    }`}
                >
                  {products.filter((p) => (Number(p.stockFloor2) || 0) > 0).length} SP
                </span>
              </button>
            </div>

            {/* BƯỚC 2: TÌM NHANH & THÊM SẢN PHẨM VÀO PHIẾU (KHÔNG ĐỔ LIST DÀI) */}
            {(() => {
              const activeTransferProdId = transferProductId;
              const selectedTransferProd = activeTransferProdId
                ? products.find((p) => p._id === activeTransferProdId)
                : undefined;
              const availVars = getProductSourceVariants(selectedTransferProd);
              const effectiveColor =
                transferColor ||
                (availVars.length > 0 && !transferSize
                  ? availVars[0].color || ""
                  : "");
              const effectiveSize =
                transferSize ||
                (availVars.length > 0 && !transferColor
                  ? availVars[0].size || ""
                  : "");

              const uniqueColorOptions: Array<{ color: string; totalStock: number }> = [];
              for (const v of availVars) {
                const cName = String(v.color || "").trim();
                const existingColor = uniqueColorOptions.find(
                  (c) => c.color.toLowerCase() === cName.toLowerCase()
                );
                const vStock = getVariantSourceFloorStock(v);
                if (existingColor) existingColor.totalStock += vStock;
                else uniqueColorOptions.push({ color: cName, totalStock: vStock });
              }

              const varsForSelectedColor =
                availVars.filter(
                  (v) =>
                    String(v.color || "").trim().toLowerCase() ===
                    String(effectiveColor || "").trim().toLowerCase()
                ).length > 0
                  ? availVars.filter(
                    (v) =>
                      String(v.color || "").trim().toLowerCase() ===
                      String(effectiveColor || "").trim().toLowerCase()
                  )
                  : availVars;

              const quickSuggestions = sourceFloorProducts.slice(0, 12);

              return (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <datalist id="transfer-size-presets">
                    {["S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"].map(
                      (sz) => (
                        <option key={sz} value={sz} />
                      )
                    )}
                  </datalist>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                    {/* Ô tìm kiếm thông minh có dropdown gợi ý */}
                    <div className="md:col-span-5 relative">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Tìm &amp; chọn SP tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={transferSearch}
                          onFocus={() => setTransferSuggestOpen(true)}
                          onBlur={() => setTimeout(() => setTransferSuggestOpen(false), 180)}
                          onChange={(e) => {
                            setTransferSearch(e.target.value);
                            setTransferSuggestOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (quickSuggestions.length > 0) {
                                const first = quickSuggestions[0];
                                handleSelectTransferProduct(first._id);
                                setTransferSearch(`${first.name} (${first.code})`);
                                setTransferSuggestOpen(false);
                              }
                            }
                          }}
                          placeholder={
                            selectedTransferProd
                              ? `${selectedTransferProd.name} (${selectedTransferProd.code})`
                              : "Gõ tên, mã gốc hoặc mã con..."
                          }
                          className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none focus:border-teal-500"
                        />
                        {(transferSearch || transferProductId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferSearch("");
                              setTransferProductId("");
                              setTransferColor("");
                              setTransferSize("");
                              setTransferSuggestOpen(true);
                            }}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                            title="Xóa lựa chọn"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {transferSuggestOpen && (
                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                          {quickSuggestions.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">
                              Không tìm thấy sản phẩm còn tồn ở kho đầu dời.
                            </div>
                          ) : (
                            quickSuggestions.map((p) => {
                              const avail = getSourceFloorStock(p);
                              const isPicked = p._id === activeTransferProdId;
                              return (
                                <button
                                  key={p._id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectTransferProduct(p._id);
                                    setTransferSearch(`${p.name} (${p.code})`);
                                    setTransferSuggestOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-teal-50 transition ${
                                    isPicked ? "bg-teal-50/80" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                                    <div className="font-mono text-[10px] text-slate-500">{p.code}</div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-teal-100 text-brand-ink font-mono font-bold text-[11px] shrink-0">
                                    Tồn: {avail} {p.unit}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Màu sắc
                      </label>
                      {uniqueColorOptions.length > 0 ? (
                        <select
                          value={String(effectiveColor || "").trim().toLowerCase()}
                          onChange={(e) => {
                            const nextColorLower = e.target.value;
                            const matchedColorVars = availVars.filter(
                              (v) =>
                                String(v.color || "").trim().toLowerCase() ===
                                nextColorLower
                            );
                            if (matchedColorVars.length > 0) {
                              setTransferColor(matchedColorVars[0].color || "");
                              setTransferSize(matchedColorVars[0].size || "");
                            } else {
                              setTransferColor("");
                              setTransferSize("");
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-bold text-slate-900"
                        >
                          {uniqueColorOptions.map((cOpt, cIdx) => (
                            <option
                              key={`${cOpt.color}_${cIdx}`}
                              value={cOpt.color.toLowerCase()}
                            >
                              {cOpt.color || "Mặc định"} ({cOpt.totalStock})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ColorInputWithPicker
                          value={transferColor}
                          onChange={(nextColor) => setTransferColor(nextColor)}
                          placeholder="Màu sắc..."
                        />
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Size
                      </label>
                      {varsForSelectedColor.length > 0 ? (
                        <select
                          value={String(effectiveSize || "").trim().toUpperCase()}
                          onChange={(e) => {
                            const nextSizeUpper = e.target.value;
                            const matchedVar = varsForSelectedColor.find(
                              (v) =>
                                String(v.size || "").trim().toUpperCase() ===
                                nextSizeUpper
                            );
                            if (matchedVar) {
                              setTransferColor(matchedVar.color || effectiveColor || "");
                              setTransferSize(matchedVar.size || "");
                            } else {
                              setTransferSize(e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold text-slate-900"
                        >
                          {varsForSelectedColor.map((v, sIdx) => {
                            const szTrim = String(v.size || "").trim();
                            const szVal = szTrim.toUpperCase();
                            const vStock = getVariantSourceFloorStock(v);
                            return (
                              <option key={`${szVal}_${sIdx}`} value={szVal}>
                                {szTrim ? `${szTrim} (Tồn: ${vStock})` : `Không size (${vStock})`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          list="transfer-size-presets"
                          value={transferSize}
                          onChange={(e) => setTransferSize(e.target.value.toUpperCase())}
                          placeholder="VD: M, L, 41"
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold uppercase text-slate-900"
                        />
                      )}
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        SL
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={transferQty}
                        onChange={(e) =>
                          setTransferQty(Math.max(1, Math.round(Number(e.target.value) || 1)))
                        }
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 font-mono text-sm font-extrabold text-right bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={!selectedTransferProd}
                        onClick={() =>
                          handleAddTransferItem(
                            activeTransferProdId,
                            transferQty,
                            effectiveColor,
                            effectiveSize
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm vào phiếu
                      </button>
                    </div>
                  </div>

                  {/* Sản phẩm đang chọn + chip Màu/Size để bấm 1 chạm thêm nhanh */}
                  {selectedTransferProd && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          Đang chọn: <span className="text-brand-ink">{selectedTransferProd.name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          ({selectedTransferProd.code} · Tồn {getSourceFloorStock(selectedTransferProd)} {selectedTransferProd.unit})
                        </span>
                      </div>

                      {availVars.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {availVars.map((v, vIdx) => {
                            const vStock = getVariantSourceFloorStock(v);
                            const isSelectedVar =
                              String(v.color || "").trim().toLowerCase() ===
                              String(effectiveColor || "").trim().toLowerCase() &&
                              String(v.size || "").trim().toUpperCase() ===
                              String(effectiveSize || "").trim().toUpperCase();
                            const hexes = resolveVariantColorHexes(v.color, v.colorHexes);
                            return (
                              <button
                                key={`${v.color}-${v.size}-${vIdx}`}
                                type="button"
                                onClick={() => {
                                  setTransferColor(v.color || "");
                                  setTransferSize(v.size || "");
                                  handleAddTransferItem(
                                    activeTransferProdId,
                                    1,
                                    v.color || "",
                                    v.size || ""
                                  );
                                }}
                                style={getColorBoxBorderStyle(
                                  hexes,
                                  isSelectedVar ? "#eef2ff" : "#ffffff",
                                  2
                                )}
                                title="Bấm để thêm +1 biến thể này vào phiếu"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${isSelectedVar
                                  ? "ring-1 ring-indigo-600 text-indigo-950"
                                  : "border-slate-200 text-slate-800 hover:bg-indigo-50"
                                  }`}
                              >
                                <ColorSwatchBadge
                                  hexes={v.colorHexes}
                                  colorName={v.color || "Mặc định"}
                                  size="xs"
                                />
                                <span>{v.color || "Mặc định"}</span>
                                {Boolean(v.size?.trim()) && (
                                  <span className="font-mono text-brand-ink">· {v.size?.trim()}</span>
                                )}
                                <span className="font-mono text-brand-ink">({vStock})</span>
                                <span className="text-[10px] text-brand-ink font-extrabold">+1</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* BƯỚC 3: BẢNG CÁC SẢN PHẨM TRONG PHIẾU DỜI KHO & XÁC NHẬN */}
            <form onSubmit={handleCreateTransfer} className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase text-indigo-900">
                  3. Danh sách sản phẩm trong Phiếu Dời Kho ({transferItems.length} mặt hàng · Tổng SL:{" "}
                  {transferItems.reduce((s, i) => s + i.quantity, 0)})
                </label>
                {transferItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransferItems([])}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Xóa toàn bộ danh sách chọn
                  </button>
                )}
              </div>

              {transferItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  Chưa có sản phẩm nào trong phiếu. Hãy bấm chọn các sản phẩm hoặc Màu sắc từ{" "}
                  <strong>
                    {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                  </strong>{" "}
                  ở trên để thêm vào phiếu dời kho.
                </div>
              ) : (
                <div className="overflow-x-auto border border-indigo-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-indigo-950 text-white uppercase">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3">Mã hàng</th>
                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                        <th className="py-2.5 px-3">Màu sắc</th>
                        <th className="py-2.5 px-3">Size (Kích cỡ)</th>
                        <th className="py-2.5 px-3 text-center">ĐVT</th>
                        <th className="py-2.5 px-3 text-right">
                          Tồn tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                        </th>
                        <th className="py-2.5 px-3 text-right w-36">Số lượng cần dời *</th>
                        <th className="py-2.5 px-3 text-center w-16">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferItems.map((item, idx) => {
                        const prod = products.find((p) => p._id === item.productId);
                        if (!prod) return null;
                        const itemKey = getTransferItemKey(
                          item.productId,
                          item.color,
                          item.size
                        );
                        const prodVars = getProductSourceVariants(prod);
                        const uniqueColors = Array.from(
                          new Set(
                            prodVars.map((v) => String(v.color || "").trim())
                          )
                        );
                        const sizesForColor =
                          prodVars.filter(
                            (v) =>
                              String(v.color || "").trim().toLowerCase() ===
                              String(item.color || "").trim().toLowerCase()
                          ).length > 0
                            ? prodVars.filter(
                              (v) =>
                                String(v.color || "").trim().toLowerCase() ===
                                String(item.color || "").trim().toLowerCase()
                            )
                            : prodVars;

                        const matchedVar = (prod.variants || []).find(
                          (v) =>
                            String(v.color || "").trim().toLowerCase() ===
                            String(item.color || "").trim().toLowerCase() &&
                            String(v.size || "").trim().toUpperCase() ===
                            String(item.size || "").trim().toUpperCase()
                        );
                        const maxAvail = getSourceVariantFloorStock(
                          prod,
                          item.color,
                          item.size
                        );
                        const childCode =
                          item.color || item.size
                            ? variantCodeFor(
                              prod.code,
                              item.color,
                              item.size
                            )
                            : prod.code;
                        const hexes = resolveVariantColorHexes(
                          item.color,
                          matchedVar?.colorHexes
                        );

                        return (
                          <tr key={itemKey} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              <div>{childCode}</div>
                              {(item.color || item.size) && (
                                <div className="text-[10px] font-normal text-slate-400">
                                  Mã gốc: {prod.code}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {prod.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.color ? (
                                  <span
                                    style={getColorBoxBorderStyle(
                                      hexes,
                                      "var(--box-bg, #f8fafc)",
                                      2
                                    )}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-800"
                                  >
                                    <ColorSwatchBadge
                                      hexes={matchedVar?.colorHexes}
                                      colorName={item.color}
                                      size="xs"
                                    />
                                    <span>{item.color}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    Mặc định
                                  </span>
                                )}

                                {uniqueColors.length > 1 && (
                                  <select
                                    value={String(item.color || "")
                                      .trim()
                                      .toLowerCase()}
                                    onChange={(e) => {
                                      const nextColorLower = e.target.value;
                                      const matchedColorVars = prodVars.filter(
                                        (v) =>
                                          String(v.color || "")
                                            .trim()
                                            .toLowerCase() === nextColorLower
                                      );
                                      if (matchedColorVars.length > 0) {
                                        const keepSameSize =
                                          matchedColorVars.find(
                                            (v) =>
                                              String(v.size || "")
                                                .trim()
                                                .toUpperCase() ===
                                              String(item.size || "")
                                                .trim()
                                                .toUpperCase()
                                          ) || matchedColorVars[0];
                                        handleUpdateTransferItemVariant(
                                          itemKey,
                                          keepSameSize.color || "",
                                          keepSameSize.size || ""
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded border border-slate-300 text-[11px] bg-white font-semibold text-slate-700"
                                    title="Đổi màu sắc cần dời"
                                  >
                                    {uniqueColors.map((cName, cIdx) => (
                                      <option
                                        key={`${cName}_${cIdx}`}
                                        value={cName.toLowerCase()}
                                      >
                                        Đổi màu: {cName || "Mặc định"}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Boolean(item.size?.trim()) ? (
                                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-brand-ink font-mono text-xs font-extrabold">
                                    {item.size?.trim()}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    —
                                  </span>
                                )}

                                {sizesForColor.length > 1 ? (
                                  <select
                                    value={String(item.size || "")
                                      .trim()
                                      .toUpperCase()}
                                    onChange={(e) => {
                                      const nextSizeUpper = e.target.value;
                                      const picked = sizesForColor.find(
                                        (v) =>
                                          String(v.size || "")
                                            .trim()
                                            .toUpperCase() === nextSizeUpper
                                      );
                                      if (picked) {
                                        handleUpdateTransferItemVariant(
                                          itemKey,
                                          picked.color || item.color || "",
                                          picked.size || ""
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded border border-indigo-300 text-[11px] bg-white font-mono font-bold text-indigo-900"
                                    title="Chọn / đổi Size cần dời"
                                  >
                                    {sizesForColor.map((v, sIdx) => {
                                      const sz = String(v.size || "").trim();
                                      return (
                                        <option
                                          key={`${sz}_${sIdx}`}
                                          value={sz.toUpperCase()}
                                        >
                                          {sz
                                            ? `Size ${sz} (Tồn: ${getVariantSourceFloorStock(
                                              v
                                            )})`
                                            : `Không size (Tồn: ${getVariantSourceFloorStock(
                                              v
                                            )})`}
                                        </option>
                                      );
                                    })}
                                  </select>
                                ) : prodVars.length === 0 ? (
                                  <input
                                    type="text"
                                    list="transfer-size-presets"
                                    value={item.size || ""}
                                    onChange={(e) =>
                                      handleUpdateTransferItemVariant(
                                        itemKey,
                                        item.color || "",
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    placeholder="Chọn size..."
                                    className="w-24 px-2 py-1 rounded border border-slate-300 text-[11px] bg-white font-mono font-bold uppercase text-slate-800"
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">{prod.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-ink">
                              {maxAvail}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min={1}
                                max={maxAvail}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateTransferItemQty(
                                    itemKey,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg border-2 border-indigo-400 font-mono font-extrabold text-right text-sm text-indigo-950"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTransferItem(itemKey)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                title="Xóa khỏi phiếu"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Ghi chú Phiếu Xuất Kho (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="VD: Dời hàng xuống Kho Tầng 1 để bổ sung quầy bán..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div className="md:col-span-4">
                  <button
                    type="submit"
                    disabled={transferItems.length === 0}
                    className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Xác nhận Tạo Phiếu Xuất Kho ({transferItems.length} dòng)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}

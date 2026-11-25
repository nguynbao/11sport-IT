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

export function SetLinkModal({ vm }: { vm: InventoryViewModel }) {
  const {
    products,
    allCatalogProducts,
    setLinkModalProduct,
    setSetLinkModalProduct,
    setLinkMode,
    setSetLinkMode,
    selectedParentSetId,
    setSelectedParentSetId,
    packSizeInput,
    setPackSizeInput,
    setLinkSearch,
    setSetLinkSearch,
    setChildMode,
    setSetChildMode,
    selectedExistingRetailId,
    setSelectedExistingRetailId,
    newRetailName,
    setNewRetailName,
    newRetailUnit,
    setNewRetailUnit,
    newRetailSellingPrice,
    setNewRetailSellingPrice,
    modalUnpackCount,
    setModalUnpackCount,
    modalUnpackWarehouse,
    setModalUnpackWarehouse,
    savingSetLink,
    unpackingLoadingId,
    handleQuickUnpackSet,
    handleSaveSetLink,
    handleClearSetLink,
  } = vm;

  return (
    <>
      {/* MODAL CẤU HÌNH LIÊN KẾT & TỰ ĐỘNG TÁCH SẢN PHẨM BỘ ↔ SẢN PHẨM LẺ */}
      {setLinkModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 bg-white text-slate-900 border-b border-slate-200 rounded-t-2xl flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-brand-ink">
                  Cơ chế Tự động Tách Bộ ↔ Bán Lẻ — 11Sport
                </div>
                <h3 className="text-sm font-extrabold mt-0.5 text-slate-900">
                  🔗 Cấu hình Bộ ↔ Lẻ: {setLinkModalProduct.name} ({setLinkModalProduct.code})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSetLinkModalProduct(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleSaveSetLink} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>💡 Cách hoạt động tự động (không cần chỉnh tay khi hết hàng lẻ):</span>
                </div>
                <p className="text-[11px] text-teal-900 leading-relaxed">
                  Khi <b>Sản phẩm Lẻ</b> được gắn với <b>Sản phẩm Bộ/Hộp gốc</b> (ví dụ: 1 Ống = 12 Quả, 1 Hộp = 60 Cái):
                  nếu khách mua lẻ tại POS mà tồn lẻ ở Kho Tầng 1 đã hết hoặc thiếu, hệ thống sẽ{" "}
                  <b>tự động trừ -1 ở Sản phẩm Bộ (Kho Tầng 1)</b>, <b>cộng +N vào Sản phẩm Lẻ</b> rồi xuất bán ngay và ghi Sổ kho đầy đủ.
                </p>
              </div>

              {/* Chọn vai trò của sản phẩm đang mở */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSetLinkMode("AS_RETAIL")}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${setLinkMode === "AS_RETAIL"
                    ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-extrabold text-xs">
                    🔹 Sản phẩm này là SẢN PHẨM LẺ
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-85">
                    Chọn 1 Sản phẩm Bộ/Hộp gốc trong kho để tự động rút hàng khi mã lẻ này hết tồn.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSetLinkMode("AS_SET")}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${setLinkMode === "AS_SET"
                    ? "border-teal-600 bg-teal-50 text-teal-950 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="font-extrabold text-xs">
                    📦 Sản phẩm này là SẢN PHẨM BỘ / HỘP
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-85">
                    Tạo nhanh mã Sản phẩm Lẻ mới từ Bộ này hoặc gắn với 1 mã Sản phẩm Lẻ có sẵn.
                  </div>
                </button>
              </div>

              {setLinkMode === "AS_RETAIL" ? (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block font-extrabold text-slate-800 mb-1">
                      1. Chọn Sản phẩm Bộ / Hộp / Ống gốc trong kho:
                    </label>
                    <input
                      type="text"
                      value={setLinkSearch}
                      onChange={(e) => setSetLinkSearch(e.target.value)}
                      placeholder="Gõ tìm tên hoặc mã Sản phẩm Bộ/Hộp..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white mb-2"
                    />
                    <select
                      value={selectedParentSetId}
                      onChange={(e) => setSelectedParentSetId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    >
                      <option value="">-- Chọn Sản phẩm Bộ / Hộp gốc --</option>
                      {(allCatalogProducts.length > 0 ? allCatalogProducts : products)
                        .filter((cand) => {
                          if (cand._id === setLinkModalProduct._id) return false;
                          if (!setLinkSearch.trim()) return true;
                          const q = setLinkSearch.trim().toLowerCase();
                          return (
                            cand.code.toLowerCase().includes(q) ||
                            cand.name.toLowerCase().includes(q) ||
                            (cand.unit || "").toLowerCase().includes(q)
                          );
                        })
                        .map((cand) => (
                          <option key={cand._id} value={cand._id}>
                            [{cand.code}] {cand.name} — ĐVT: {cand.unit} (Tồn T1:{" "}
                            {cand.stockFloor1 ?? cand.stock ?? 0} {cand.unit}
                            {(cand.stockFloor2 ?? 0) > 0 ? `, T2: ${cand.stockFloor2}` : ""})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block font-extrabold text-slate-800 mb-1">
                        2. Tỷ lệ quy đổi (1 Bộ/Hộp = bao nhiêu {setLinkModalProduct.unit}?):
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={packSizeInput}
                        onChange={(e) =>
                          setPackSizeInput(Math.max(1, Math.round(Number(e.target.value) || 1)))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold text-slate-900"
                      />
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 font-bold">
                      Quy ước: Trừ <b>-1 Bộ/Hộp</b> → Tự động cộng{" "}
                      <b>
                        +{packSizeInput} {setLinkModalProduct.unit}
                      </b>{" "}
                      vào mã <span className="font-mono">{setLinkModalProduct.code}</span>
                    </div>
                  </div>

                  {setLinkModalProduct.parentSetProductId && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">
                        Đang liên kết với:{" "}
                        <b className="font-mono text-slate-900">
                          {setLinkModalProduct.parentSetProductCode ||
                            setLinkModalProduct.parentSetProductId}
                        </b>
                      </span>
                      <button
                        type="button"
                        disabled={savingSetLink}
                        onClick={() => handleClearSetLink(setLinkModalProduct._id)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] cursor-pointer"
                      >
                        Gỡ liên kết Bộ ↔ Lẻ
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSetChildMode("CREATE_NEW_RETAIL")}
                      className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${setChildMode === "CREATE_NEW_RETAIL"
                        ? "bg-teal-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                        }`}
                    >
                      ✨ Tạo nhanh Sản phẩm Lẻ mới từ Bộ này
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetChildMode("EXISTING_RETAIL")}
                      className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition cursor-pointer ${setChildMode === "EXISTING_RETAIL"
                        ? "bg-teal-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                        }`}
                    >
                      🔗 Chọn Sản phẩm Lẻ đã có sẵn trong kho
                    </button>
                  </div>

                  {setChildMode === "CREATE_NEW_RETAIL" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Tên Sản phẩm Lẻ mới:
                        </label>
                        <input
                          type="text"
                          value={newRetailName}
                          onChange={(e) => setNewRetailName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Đơn vị tính Lẻ (VD: Cái, Quả, Đôi, Chiếc):
                        </label>
                        <input
                          type="text"
                          value={newRetailUnit}
                          onChange={(e) => setNewRetailUnit(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Số lượng lẻ trong 1 {setLinkModalProduct.unit}:
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={packSizeInput}
                          onChange={(e) => {
                            const nextPack = Math.max(1, Math.round(Number(e.target.value) || 1));
                            setPackSizeInput(nextPack);
                            if (setLinkModalProduct.sellingPrice > 0) {
                              setNewRetailSellingPrice(
                                Math.ceil(setLinkModalProduct.sellingPrice / nextPack / 1000) * 1000
                              );
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold"
                        />
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Giá niêm yết / 1 {newRetailUnit || "Cái"} (VND):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            newRetailSellingPrice > 0 ? formatNumberDots(newRetailSellingPrice) : ""
                          }
                          placeholder="0"
                          onChange={(e) =>
                            setNewRetailSellingPrice(parseNumberDots(e.target.value))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold text-brand-ink"
                        />
                      </div>
                      <div className="p-2.5 rounded-lg bg-teal-100/80 border border-teal-300 text-teal-950 font-semibold flex items-center">
                        <span>
                          1 {setLinkModalProduct.unit} ={" "}
                          <b>
                            {packSizeInput} {newRetailUnit || "Cái"}
                          </b>{" "}
                          • Giá vốn lẻ tự tính:{" "}
                          <b>
                            {formatVND(
                              Math.round(
                                (Number(setLinkModalProduct.costPrice) || 0) /
                                Math.max(1, packSizeInput)
                              )
                            )}
                          </b>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Chọn Sản phẩm Lẻ có sẵn trong kho:
                        </label>
                        <input
                          type="text"
                          value={setLinkSearch}
                          onChange={(e) => setSetLinkSearch(e.target.value)}
                          placeholder="Gõ tìm tên hoặc mã Sản phẩm Lẻ..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white mb-2"
                        />
                        <select
                          value={selectedExistingRetailId}
                          onChange={(e) => setSelectedExistingRetailId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          <option value="">-- Chọn Sản phẩm Lẻ --</option>
                          {(allCatalogProducts.length > 0 ? allCatalogProducts : products)
                            .filter((cand) => {
                              if (cand._id === setLinkModalProduct._id) return false;
                              if (!setLinkSearch.trim()) return true;
                              const q = setLinkSearch.trim().toLowerCase();
                              return (
                                cand.code.toLowerCase().includes(q) ||
                                cand.name.toLowerCase().includes(q)
                              );
                            })
                            .map((cand) => (
                              <option key={cand._id} value={cand._id}>
                                [{cand.code}] {cand.name} — ĐVT: {cand.unit} (Tồn lẻ T1:{" "}
                                {cand.stockFloor1 ?? cand.stock ?? 0})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-extrabold text-slate-800 mb-1">
                          Số lượng lẻ trong 1 {setLinkModalProduct.unit}:
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={packSizeInput}
                          onChange={(e) =>
                            setPackSizeInput(Math.max(1, Math.round(Number(e.target.value) || 1)))
                          }
                          className="w-40 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-extrabold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Khu vực Tách bộ chủ động ngay trong Modal nếu đã có liên kết */}
              {((setLinkModalProduct.parentSetProductId &&
                (setLinkModalProduct.packSize || 0) > 0) ||
                (Array.isArray(setLinkModalProduct.linkedRetailProducts) &&
                  setLinkModalProduct.linkedRetailProducts.length > 0)) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                    <div className="font-extrabold text-amber-950 flex items-center justify-between">
                      <span>⚡ Tách Bộ Sang Lẻ Ngay Lập Tức (Chủ động bày kệ)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={modalUnpackWarehouse}
                        onChange={(e) =>
                          setModalUnpackWarehouse(e.target.value as WarehouseFloor)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold text-slate-800"
                      >
                        <option value="FLOOR_1">🏢 Tách tại Kho Tầng 1</option>
                        <option value="FLOOR_2">🏬 Tách tại Kho Tầng 2</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span>Số bộ tách:</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={modalUnpackCount}
                          onChange={(e) =>
                            setModalUnpackCount(
                              Math.max(1, Math.round(Number(e.target.value) || 1))
                            )
                          }
                          className="w-20 px-2 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-extrabold text-center"
                        />
                      </div>
                      {setLinkModalProduct.parentSetProductId &&
                        (setLinkModalProduct.packSize || 0) > 0 && (
                          <button
                            type="button"
                            disabled={unpackingLoadingId === setLinkModalProduct._id}
                            onClick={() =>
                              handleQuickUnpackSet(
                                setLinkModalProduct._id,
                                modalUnpackCount,
                                modalUnpackWarehouse
                              )
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold cursor-pointer"
                          >
                            ⚡ Tách {modalUnpackCount}{" "}
                            {setLinkModalProduct.parentSetUnit || "Bộ"} → +
                            {modalUnpackCount * (setLinkModalProduct.packSize || 1)}{" "}
                            {setLinkModalProduct.unit}
                          </button>
                        )}
                      {Array.isArray(setLinkModalProduct.linkedRetailProducts) &&
                        setLinkModalProduct.linkedRetailProducts.map((ret) => (
                          <button
                            key={ret._id}
                            type="button"
                            disabled={unpackingLoadingId === ret._id}
                            onClick={() =>
                              handleQuickUnpackSet(
                                ret._id,
                                modalUnpackCount,
                                modalUnpackWarehouse
                              )
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold cursor-pointer"
                          >
                            ⚡ Tách {modalUnpackCount} {setLinkModalProduct.unit} → +
                            {modalUnpackCount * ret.packSize} {ret.unit} ({ret.code})
                          </button>
                        ))}
                    </div>
                  </div>
                )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSetLinkModalProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingSetLink}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold cursor-pointer"
                >
                  {savingSetLink ? "Đang lưu..." : "💾 Lưu cấu hình Bộ ↔ Lẻ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}

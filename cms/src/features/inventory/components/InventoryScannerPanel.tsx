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


export function InventoryScannerPanel({ vm }: { vm: InventoryViewModel }) {
  const {
    showScannerPanel,
    scannerEnabled,
    setScannerEnabled,
    scannerInput,
    setScannerInput,
    scannedCheckCounts,
    setScannedCheckCounts,
    setScannedVariantCounts,
    lastScannedProdId,
    setLastScannedProdId,
    setLastScannedVariantCode,
    onlyShowScanned,
    setOnlyShowScanned,
    lastScanFeedback,
    setLastScanFeedback,
    handleBarcodeScanInCms,
  } = vm;

  return (
    <>
            {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN CMS */}
            {(showScannerPanel || Object.keys(scannedCheckCounts).length > 0 || lastScanFeedback) && (
              <div className="rounded-xl border border-teal-300 bg-teal-50/50 p-3 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <ScanBarcode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-teal-950">
                          Máy Quét Label — Kiểm Hàng &amp; Đối Chiếu Tồn Kho
                        </span>
                        <button
                          type="button"
                          onClick={() => setScannerEnabled((v) => !v)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                            scannerEnabled ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {scannerEnabled ? "● ĐANG BẬT TỰ ĐỘNG" : "○ ĐÃ TẮT"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Bắn mã vạch hoặc nhập tay để cộng +1 kiểm đếm và tự động bung dòng biến thể Màu/Size.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!scannerInput.trim()) return;
                        handleBarcodeScanInCms(scannerInput);
                        setScannerInput("");
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        data-barcode-input="true"
                        value={scannerInput}
                        onChange={(e) => setScannerInput(e.target.value)}
                        placeholder="Quét hoặc gõ mã SP + Enter..."
                        className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border border-teal-400 bg-white text-xs font-mono font-bold text-slate-900 uppercase focus:border-teal-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold whitespace-nowrap cursor-pointer"
                      >
                        +1 Kiểm
                      </button>
                    </form>

                    {Object.keys(scannedCheckCounts).length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOnlyShowScanned((v) => !v)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                            onlyShowScanned
                              ? "bg-teal-700 text-white border-teal-700"
                              : "bg-white text-brand-ink border-teal-300 hover:bg-teal-50"
                          }`}
                        >
                          {onlyShowScanned
                            ? `Đang lọc mã đã quét (${Object.keys(scannedCheckCounts).length})`
                            : `Chỉ hiện mã đã quét (${Object.keys(scannedCheckCounts).length})`}
                        </button>
                        {lastScannedProdId && (scannedCheckCounts[lastScannedProdId] || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setScannedCheckCounts((prev) => {
                                const cur = prev[lastScannedProdId] || 0;
                                const copy = { ...prev };
                                if (cur <= 1) delete copy[lastScannedProdId];
                                else copy[lastScannedProdId] = cur - 1;
                                return copy;
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setScannedCheckCounts({});
                            setScannedVariantCounts({});
                            setLastScannedProdId(null);
                            setLastScannedVariantCode(null);
                            setOnlyShowScanned(false);
                            setLastScanFeedback(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          Reset bộ đếm
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {lastScanFeedback && (
                  <div
                    className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                      lastScanFeedback.type === "success"
                        ? "bg-teal-100/90 border-teal-300 text-teal-950"
                        : lastScanFeedback.type === "warning"
                          ? "bg-amber-100/90 border-amber-300 text-amber-950"
                          : "bg-red-100/90 border-red-300 text-red-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {lastScanFeedback.type === "error" ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
                      )}
                      <span className="truncate">{lastScanFeedback.message}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {lastScanFeedback.time}
                    </span>
                  </div>
                )}
              </div>
            )}
    </>
  );
}

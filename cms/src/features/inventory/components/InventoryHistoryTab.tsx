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
import { CmsRoleBadge } from "./CmsRoleBadge";
import { HistoryMovementsView } from "./HistoryMovementsView";
import { HistoryImportsView } from "./HistoryImportsView";
import { HistoryTransfersView } from "./HistoryTransfersView";

export function InventoryHistoryTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    historyView,
    setHistoryView,
    transfersList,
    activeWarehouseLabel,
    filteredMovements,
    filteredImports,
  } = vm;

  return (
    <>
      {subTab === "HISTORY" && (
        <div className="space-y-4">
          {/* Thanh chuyển 3 góc nhìn Lịch sử kho */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setHistoryView("IMPORTS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "IMPORTS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Phiếu nhập kho</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "IMPORTS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {filteredImports.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryView("MOVEMENTS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "MOVEMENTS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sổ xuất nhập tồn</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "MOVEMENTS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {filteredMovements.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryView("TRANSFERS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  historyView === "TRANSFERS"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Lịch sử chuyển tầng (PXK)</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    historyView === "TRANSFERS" ? "bg-white/20 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {new Set(transfersList.map((m) => m.referenceCode || m._id)).size}
                </span>
              </button>
            </div>

            <span className="text-xs text-slate-500">
              Đang lọc theo: <strong className="text-brand-ink">{activeWarehouseLabel}</strong>
            </span>
          </div>

      <HistoryMovementsView vm={vm} />
      <HistoryImportsView vm={vm} />
      <HistoryTransfersView vm={vm} />
        </div>
      )}

    </>
  );
}


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

import { AdminBatchImportTable } from "./AdminBatchImportTable";

export function AdminBatchImportModal({ vm }: { vm: InventoryViewModel }) {
  const {
    categories,
    brandOptions,
    showAdminImportModal,
    setShowAdminImportModal,
    adminImportNote,
    setAdminImportNote,
    newProdWarehouse,
    setNewProdWarehouse,
    adminImportRows,
    setAdminImportRows,
    importFilterCatId,
    setImportFilterCatId,
    importFilterBrandId,
    setImportFilterBrandId,
    importingAdminFile,
    submittingAdminImport,
    setAdminFileImportMode,
    adminFileInputRef,
    setShowCodeCreator,
    catalogByCode,
    variantCodeFor,
    setShowLabelModal,
    setLabelItems,
    handleDownloadAdminSampleCsv,
    handleAdminImportFileChange,
    handleSubmitAdminBatchImport,
  } = vm;

  return (
    <>
      {/* MODAL POPUP NHẬP KHO DÀNH CHO ADMIN (HỖ TRỢ NHẬP NHIỀU DÒNG & IMPORT EXCEL / CSV / PDF) */}
      {showAdminImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[1440px] max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Popup */}
            <div className="px-5 py-3.5 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-slate-900">
                  <Plus className="w-4 h-4 text-brand-ink" />
                  <span>Nhập Kho Sản Phẩm — Chọn Sản phẩm & Biến thể từ Danh mục</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Chọn sản phẩm/biến thể đã tạo sẵn (hoặc quét mã vạch), nhập <strong>Số lượng</strong> và <strong>Giá nhập</strong> là xong. Hàng mới chưa có trong danh mục thì bấm <strong>+ Tạo SP mới</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminImportModal(false)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitAdminBatchImport}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Input file ẩn để đọc .xlsx, .csv, .pdf */}
              <input
                ref={adminFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.pdf,.txt"
                onChange={handleAdminImportFileChange}
                className="hidden"
              />

              {/* Khung Ghi chú, Chọn Kho & Bộ lọc nhanh Category / Thương hiệu */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Ghi chú Phiếu nhập kho
                  </label>
                  <input
                    type="text"
                    value={adminImportNote}
                    onChange={(e) => setAdminImportNote(e.target.value)}
                    placeholder="VD: Nhập lô hàng Giày Asics & Vợt Kamito đợt mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Category gợi ý
                  </label>
                  <select
                    value={importFilterCatId}
                    onChange={(e) => {
                      setImportFilterCatId(e.target.value);
                      setImportFilterBrandId("");
                    }}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        [{c.skuCode || c.code}] {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Lọc Thương hiệu gợi ý
                  </label>
                  <select
                    value={importFilterBrandId}
                    onChange={(e) => setImportFilterBrandId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">Tất cả Thương hiệu</option>
                    {brandOptions
                      .filter(
                        (b) =>
                          !importFilterCatId ||
                          b.isSystem ||
                          (b.categoryIds || []).map(String).includes(importFilterCatId)
                      )
                      .map((b) => (
                        <option key={b._id} value={b._id}>
                          [{b.code}] {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold uppercase text-brand-ink mb-1">
                    Nhập vào Kho (Chọn Tầng) *
                  </label>
                  <select
                    value={newProdWarehouse}
                    onChange={(e) =>
                      setNewProdWarehouse(
                        e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-teal-600 text-sm font-bold text-slate-900 bg-teal-50/40"
                  >
                    <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                    <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                  </select>
                </div>
              </div>

              {/* Thanh công cụ gọn: + Tạo SP mới (nếu chưa có), Import File, In Tem & Tick xác nhận */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCodeCreator(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    title="Nếu mặt hàng mới về chưa có trong danh mục, bấm để khai báo SP chuẩn mã rồi tự động đưa vào phiếu nhập"
                  >
                    <CopyPlus className="w-4 h-4" />
                    <span>+ Tạo SP mới (chưa có trong danh mục)</span>
                  </button>

                  <button
                    type="button"
                    disabled={importingAdminFile}
                    onClick={() => {
                      setAdminFileImportMode("replace");
                      adminFileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-teal-400" />
                    <span>
                      {importingAdminFile
                        ? "Đang đọc file..."
                        : "📄 Import PDF / Excel"}
                    </span>
                  </button>

                  {adminImportRows.some((r) => r.productName.trim() !== "") && (
                    <button
                      type="button"
                      disabled={importingAdminFile}
                      onClick={() => {
                        setAdminFileImportMode("append");
                        adminFileInputRef.current?.click();
                      }}
                      className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Nối thêm file</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadAdminSampleCsv}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>File Mẫu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const valid = adminImportRows.filter((r) => r.productName.trim() !== "");
                      if (valid.length === 0) {
                        alert("Chưa có dòng sản phẩm nào để in tem mã vạch!");
                        return;
                      }
                      const printable = valid.filter((it) => {
                        if (!it.productCode) return false;
                        const prod = catalogByCode.get(it.productCode.toUpperCase());
                        if (!prod) return false;
                        if (!prod.versionCode || (!it.color && !it.size)) return true;
                        return Boolean(findVariantByColorSize(prod, it.color, it.size));
                      });
                      if (printable.length === 0) {
                        alert(
                          "Các dòng chưa có mã do hệ thống sinh (biến thể mới). Hãy Hoàn thành nhập kho trước rồi in tem."
                        );
                        return;
                      }
                      if (printable.length < valid.length) {
                        alert(
                          `${valid.length - printable.length} dòng là biến thể mới chưa có mã — sẽ bỏ qua khi in. Hoàn thành nhập kho để hệ thống sinh mã.`
                        );
                      }
                      setLabelItems(
                        printable.map((it, idx) => {
                          const baseCode = it.productCode;
                          const childCode = variantCodeFor(baseCode, it.color, it.size);
                          const matchedProd = catalogByCode.get(baseCode.toUpperCase());
                          const matchedVariant = findVariantByColorSize(matchedProd, it.color, it.size);
                          const resolvedSellPrice =
                            Number(it.sellingPrice) > 0
                              ? Number(it.sellingPrice)
                              : matchedProd
                                ? variantEffectiveSellingPrice(matchedProd, matchedVariant)
                                : 0;
                          return {
                            id: `${childCode}_${idx}`,
                            code: childCode,
                            productCode: baseCode,
                            productName: it.productName,
                            color: it.color,
                            size: it.size,
                            sellingPrice: resolvedSellPrice,
                            unit: it.unit,
                            defaultQty: Math.max(1, Number(it.quantity || 1)),
                          };
                        })
                      );
                      setShowLabelModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      🖨️ In Tem ({adminImportRows.filter((r) => r.productName.trim() !== "").length})
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink font-bold">
                    Xác nhận: {adminImportRows.filter((r) => r.isConfirmed).length}/
                    {adminImportRows.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-600 text-white font-bold">
                    Tổng vốn:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.costPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-700 text-white font-bold">
                    Tổng niêm yết:{" "}
                    {formatVND(
                      adminImportRows.reduce(
                        (s, r) => s + (Number(r.sellingPrice) || 0) * (Number(r.quantity) || 0),
                        0
                      )
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminImportRows((prev) =>
                        prev.map((r) => ({ ...r, isConfirmed: true }))
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Tick xác nhận tất cả
                  </button>
                </div>
              </div>

      <AdminBatchImportTable vm={vm} />
              {/* Footer Popup */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Mặc định cột <strong>Xác nhận</strong> không tick. Vui lòng tick các dòng cần nhập hoặc bấm{" "}
                  <strong>Tick xác nhận tất cả</strong> trước khi hoàn thành.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminImportModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdminImport}
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submittingAdminImport
                        ? "Đang nhập kho..."
                        : `✅ Hoàn thành Nhập Kho (${adminImportRows.filter(
                          (r) =>
                            (r.productName.trim() !== "" || r.productCode.trim() !== "") &&
                            r.isConfirmed
                        ).length} dòng đã tick)`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALIST GỢI Ý MÀU SẮC & SIZE CHO CMS (GIỐNG WEB) */}
      <datalist id="cms-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="cms-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

    </>
  );
}


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

export function InventoryHistoryTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    setSubTab,
    historyView,
    setHistoryView,
    activeWarehouse,
    movements,
    importsList,
    expandedImportId,
    setExpandedImportId,
    movementType,
    setMovementType,
    setMovPage,
    movPageSize,
    setMovPageSize,
    setImpPage,
    impPageSize,
    setImpPageSize,
    variantCodeFor,
    transfersList,
    expandedTransferCode,
    setExpandedTransferCode,
    setDetailModalReceipt,
    handleDeleteImportReceipt,
    productByCode,
    activeWarehouseLabel,
    filteredMovements,
    movTotalPages,
    safeMovPage,
    pagedMovements,
    filteredImports,
    impTotalPages,
    safeImpPage,
    pagedImports,
    renderPaginationBar,
  } = vm;

  return (
    <>
      {/* SUB-TAB 3: LỊCH SỬ KHO (GOM PHIẾU NHẬP KHO + SỔ XUẤT NHẬP TỒN + LỊCH SỬ CHUYỂN TẦNG) */}
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

          {/* GÓC NHÌN 2: SỔ XUẤT NHẬP TỒN (STOCK MOVEMENTS) */}
          {historyView === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Xuất Nhập Tồn —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                    ? "🏬 Kho Tầng 2"
                    : "📊 Cả 2 Kho"}
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm Kho tầng, Số lượng, Giá vốn, Giá niêm yết, mã chứng từ và nhân viên thực hiện.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ExportExcelButton
                onExport={() => exportMovements(movements, movementType)}
                disabled={movements.length === 0}
              />
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
              >
                <option value="">Tất cả loại giao dịch</option>
                <option value="IMPORT">IMPORT (Nhập kho)</option>
                <option value="SALE">SALE (Bán hàng)</option>
                <option value="RETURN">RETURN (Trả hàng)</option>
                <option value="EXCHANGE_IN">EXCHANGE_IN (Nhận hàng đổi)</option>
                <option value="EXCHANGE_OUT">EXCHANGE_OUT (Xuất hàng đổi)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Điều chỉnh kho)</option>
                <option value="TRANSFER">TRANSFER (Xuất kho chuyển tầng PXK)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Kho tầng</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Sản phẩm</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Biến động</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Tồn sau GD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết (VND)</th>
                  <th className="py-3 px-3">Người thực hiện (Vai trò)</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedMovements.map((m) => {
                  const fallbackProd = productByCode.get(m.productCode);
                  const cost = Number(m.costPrice ?? fallbackProd?.costPrice ?? 0);
                  const sell = Number(m.sellingPrice ?? fallbackProd?.sellingPrice ?? 0);
                  const loc = m.warehouseLocation || "FLOOR_1";
                  return (
                    <tr key={m._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${loc === "FLOOR_2"
                            ? "bg-teal-100 text-brand-ink"
                            : "bg-teal-100 text-brand-ink"
                            }`}
                        >
                          {loc === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">{m.type}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{m.productName}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {m.productCode}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-extrabold ${m.quantityChange > 0 ? "text-brand-ink" : "text-red-600"
                          }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {m.balanceAfter}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                        {cost > 0 ? formatVND(cost) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-ink whitespace-nowrap">
                        {sell > 0 ? formatVND(sell) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">
                            {m.performedByName || "Hệ thống"}
                          </span>
                          <CmsRoleBadge role={m.performedByRole} compact />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-brand-ink whitespace-nowrap">
                        {m.referenceCode || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{m.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {renderPaginationBar({
            totalItems: filteredMovements.length,
            page: safeMovPage,
            totalPages: movTotalPages,
            pageSize: movPageSize,
            onPageChange: setMovPage,
            onPageSizeChange: setMovPageSize,
            itemLabel: "bút toán sổ kho",
          })}
        </div>
      )}

      {/* GÓC NHÌN 1: DANH SÁCH PHIẾU NHẬP KHO */}
      {historyView === "IMPORTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Lịch sử Phiếu Nhập Kho —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                    ? "🏬 Kho Tầng 2"
                    : "📊 Cả 2 Kho"}
              </h3>
              <p className="text-xs text-slate-500">
                Bấm vào dòng phiếu hoặc nút <strong>Chi tiết</strong> để xem đầy đủ từng biến thể (Màu • Size • Mã con), Số lượng, Giá vốn và Người thực hiện.
              </p>
            </div>
            <ExportExcelButton
              label="Xuất Excel"
              onExport={() => exportImports(importsList)}
              disabled={importsList.length === 0}
            />
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Mã Phiếu</th>
                  <th className="py-3 px-3">Kho nhận</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Số dòng</th>
                  <th className="py-3 px-3 text-right">Tổng SL thực nhận</th>
                  <th className="py-3 px-3 text-right">Tổng giá vốn</th>
                  <th className="py-3 px-3 text-right">Tổng theo giá niêm yết</th>
                  <th className="py-3 px-3">Người lập (Vai trò)</th>
                  <th className="py-3 px-3">Người kiểm (chiếc)</th>
                  <th className="py-3 px-3">Người hoàn thành (Vai trò)</th>
                  <th className="py-3 px-3">Ngày tạo</th>
                  <th className="py-3 px-2 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedImports.map((imp) => {
                  const items: any[] = imp.items || [];
                  const totalQty = items.reduce(
                    (s, it) => s + (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                    0
                  );
                  const totalCost = items.reduce(
                    (s, it) =>
                      s +
                      (Number(it.costPrice) || 0) *
                      (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                    0
                  );
                  const totalSell = items.reduce((s, it) => {
                    const p = productByCode.get(it.productCode);
                    const sellPrice = Number(it.sellingPrice || p?.sellingPrice || 0);
                    return (
                      s + sellPrice * (Number(it.actualQuantity ?? it.expectedQuantity) || 0)
                    );
                  }, 0);
                  const isExpanded = expandedImportId === imp._id;
                  const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";

                  return (
                    <React.Fragment key={imp._id}>
                      <tr
                        onClick={() =>
                          setExpandedImportId(isExpanded ? null : imp._id)
                        }
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {imp.code || imp.receiptCode || imp._id}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${wh === "FLOOR_2"
                              ? "bg-teal-100 text-brand-ink"
                              : "bg-teal-100 text-brand-ink"
                              }`}
                          >
                            {wh === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${imp.status === "COMPLETED"
                              ? "bg-teal-100 text-brand-ink"
                              : imp.status === "CHECKING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-teal-100 text-brand-ink"
                              }`}
                          >
                            {imp.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {items.length}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                          {totalQty}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                          {formatVND(totalCost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-brand-ink whitespace-nowrap">
                          {formatVND(totalSell)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {imp.createdByName || "-"}
                            </span>
                            <CmsRoleBadge role={imp.createdByRole} compact />
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {(() => {
                            const byName = new Map<string, { qty: number; role?: string }>();
                            items.forEach((it: any) =>
                              (it.scanCounts || []).forEach((s: any) => {
                                const prev = byName.get(s.name) || { qty: 0, role: s.role };
                                byName.set(s.name, {
                                  qty: prev.qty + (Number(s.quantity) || 0),
                                  role: s.role || prev.role,
                                });
                              })
                            );
                            if (byName.size === 0) {
                              const checkerSet = new Map<string, string | undefined>();
                              items.forEach((it: any) => {
                                if (it.checkedByName) {
                                  checkerSet.set(it.checkedByName, it.checkedByRole);
                                }
                              });
                              if (checkerSet.size === 0) return "-";
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(checkerSet.entries()).map(([n, r]) => (
                                    <span key={n} className="inline-flex items-center gap-1">
                                      <span className="font-medium text-slate-700">{n}</span>
                                      <CmsRoleBadge role={r} compact />
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(byName.entries()).map(([n, info]) => (
                                  <span key={n} className="inline-flex items-center gap-1">
                                    <span className="font-medium text-slate-800">
                                      {n} ({info.qty})
                                    </span>
                                    <CmsRoleBadge role={info.role} compact />
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {imp.completedByName ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">
                                {imp.completedByName}
                              </span>
                              <CmsRoleBadge role={imp.completedByRole} compact />
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(imp.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalReceipt(imp);
                              }}
                              className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-brand-ink font-bold text-[11px] inline-flex items-center gap-1"
                              title="Xem chi tiết phiếu nhập kho"
                            >
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteImportReceipt(imp, e)}
                              className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                              title="Xóa phiếu nhập"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 inline" />
                            ) : (
                              <ChevronDown className="w-4 h-4 inline" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={12} className="p-3">
                            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                    Người lập: <strong>{imp.createdByName || "-"}</strong>{" "}
                                    <CmsRoleBadge role={imp.createdByRole} />
                                  </span>
                                  {imp.completedByName && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                      · Người hoàn thành: <strong>{imp.completedByName}</strong>{" "}
                                      <CmsRoleBadge role={imp.completedByRole} />
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDetailModalReceipt(imp)}
                                  className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Mở bảng Xem lại chi tiết đầy đủ
                                </button>
                              </div>
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                                  <tr>
                                    <th className="py-2 px-2.5 text-center">STT</th>
                                    <th className="py-2 px-2.5">Mã hàng</th>
                                    <th className="py-2 px-2.5">Tên sản phẩm</th>
                                    <th className="py-2 px-2.5 text-center">ĐVT</th>
                                    <th className="py-2 px-2.5 text-right">SL Dự kiến</th>
                                    <th className="py-2 px-2.5 text-right">SL Thực nhận</th>
                                    <th className="py-2 px-2.5 text-right">Giá vốn (VND)</th>
                                    <th className="py-2 px-2.5 text-right">Giá niêm yết</th>
                                    <th className="py-2 px-2.5 text-right">Thành tiền (Giá vốn)</th>
                                    <th className="py-2 px-2.5">Người kiểm dòng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {items.map((it: any, idx: number) => {
                                    const prod = productByCode.get(it.productCode);
                                    const qty = Number(it.actualQuantity ?? it.expectedQuantity) || 0;
                                    const cost = Number(it.costPrice || prod?.costPrice || 0);
                                    const sell = Number(it.sellingPrice || prod?.sellingPrice || 0);
                                    const varLabel = [it.color, it.size].filter(Boolean).join(" · ");
                                    return (
                                      <tr key={idx}>
                                        <td className="py-1.5 px-2.5 text-center font-mono">
                                          {it.stt || idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono font-bold">
                                          <div>{it.variantCode || it.productCode}</div>
                                          {it.variantCode && it.variantCode !== it.productCode && (
                                            <div className="text-[10px] font-normal text-slate-400">
                                              Gốc: {it.productCode}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-semibold">
                                          <div>{it.productName}</div>
                                          {varLabel && (
                                            <div className="text-[10px] font-bold text-brand-ink">
                                              {varLabel}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">{it.unit}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono">
                                          {it.expectedQuantity}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-brand-ink">
                                          {qty}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-amber-800">
                                          {formatVND(cost)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-brand-ink">
                                          {sell > 0 ? formatVND(sell) : "Chưa đặt (0 VND)"}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                                          {formatVND(qty * cost)}
                                        </td>
                                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                                          {Array.isArray(it.scanCounts) && it.scanCounts.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {it.scanCounts.map((sc: any, sIdx: number) => (
                                                <span key={sIdx} className="inline-flex items-center gap-1">
                                                  <span>
                                                    {sc.name} ({sc.quantity})
                                                  </span>
                                                  <CmsRoleBadge role={sc.role} compact />
                                                </span>
                                              ))}
                                            </div>
                                          ) : it.checkedByName ? (
                                            <span className="inline-flex items-center gap-1">
                                              <span>{it.checkedByName}</span>
                                              <CmsRoleBadge role={it.checkedByRole} compact />
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {renderPaginationBar({
            totalItems: filteredImports.length,
            page: safeImpPage,
            totalPages: impTotalPages,
            pageSize: impPageSize,
            onPageChange: setImpPage,
            onPageSizeChange: setImpPageSize,
            itemLabel: "phiếu nhập kho",
          })}
        </div>
      )}

          {/* GÓC NHÌN 3: LỊCH SỬ PHIẾU XUẤT KHO CHUYỂN TẦNG (PXK) */}
          {historyView === "TRANSFERS" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Lịch sử Phiếu Xuất Kho Chuyển Tầng (PXK)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mỗi phiếu xuất kho chuyển tầng (<code>PXK-...</code>) gom nhiều sản phẩm / màu sắc. Bấm vào dòng phiếu để xem chi tiết.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab("TRANSFER")}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Tạo phiếu chuyển tầng mới
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-3 px-3">Mã Phiếu Xuất</th>
                      <th className="py-3 px-3">Thời gian</th>
                      <th className="py-3 px-3">Từ Kho (Đầu dời)</th>
                      <th className="py-3 px-3">Sang Kho (Đích)</th>
                      <th className="py-3 px-3 text-right">Số mặt hàng</th>
                      <th className="py-3 px-3 text-right">Tổng SL dời</th>
                      <th className="py-3 px-3">Người thực hiện</th>
                      <th className="py-3 px-3">Ghi chú</th>
                      <th className="py-3 px-3 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const groupedMap = new Map<string, StockMovement[]>();
                      transfersList.forEach((m) => {
                        const code = m.referenceCode || m._id;
                        const list = groupedMap.get(code) || [];
                        list.push(m);
                        groupedMap.set(code, list);
                      });
                      const receiptGroups = Array.from(groupedMap.entries());

                      if (receiptGroups.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-400">
                              Chưa có phiếu xuất kho chuyển tầng nào.
                            </td>
                          </tr>
                        );
                      }

                      return receiptGroups.map(([refCode, items]) => {
                        const first = items[0];
                        const totalQty = items.reduce(
                          (s, it) => s + Math.abs(Number(it.quantityChange) || 0),
                          0
                        );
                        const isExpanded = expandedTransferCode === refCode;

                        return (
                          <React.Fragment key={refCode}>
                            <tr
                              onClick={() =>
                                setExpandedTransferCode(isExpanded ? null : refCode)
                              }
                              className="hover:bg-indigo-50/40 cursor-pointer transition"
                            >
                              <td className="py-3 px-3 font-mono font-extrabold text-brand-ink">
                                {refCode}
                              </td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                {formatDateTime(first.createdAt)}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                                {first.fromWarehouse === "FLOOR_2"
                                  ? "🏬 Kho Tầng 2"
                                  : "🏢 Kho Tầng 1"}
                              </td>
                              <td className="py-3 px-3 font-bold text-brand-ink whitespace-nowrap">
                                {first.toWarehouse === "FLOOR_2"
                                  ? "🏬 Kho Tầng 2"
                                  : "🏢 Kho Tầng 1"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {items.length} SP
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-brand-ink">
                                {totalQty}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                                {first.performedByName || "Quản trị viên"}
                              </td>
                              <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                                {first.note || "-"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-brand-ink font-bold text-[11px]">
                                  {isExpanded ? (
                                    <>
                                      Ẩn <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      Xem ({items.length}) <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </span>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-indigo-50/30">
                                <td colSpan={9} className="p-3.5">
                                  <div className="border border-indigo-200 rounded-xl overflow-x-auto bg-white shadow-sm">
                                    <div className="bg-indigo-950 text-white px-3.5 py-2 text-[11px] font-bold flex flex-wrap items-center justify-between gap-2">
                                      <span>
                                        Chi tiết Phiếu Xuất Kho Chuyển Tầng: {refCode} (
                                        {first.fromWarehouse === "FLOOR_2"
                                          ? "Kho Tầng 2 → Kho Tầng 1"
                                          : "Kho Tầng 1 → Kho Tầng 2"}
                                        )
                                      </span>
                                      <span>
                                        Người thực hiện: {first.performedByName || "Quản trị viên"} ·{" "}
                                        {formatDateTime(first.createdAt)}
                                      </span>
                                    </div>
                                    <table className="w-full text-[11px] text-left">
                                      <thead className="bg-slate-100 text-slate-800 uppercase border-b border-slate-200">
                                        <tr>
                                          <th className="py-2 px-3 text-center w-12">STT</th>
                                          <th className="py-2 px-3">Mã hàng</th>
                                          <th className="py-2 px-3">Tên sản phẩm</th>
                                          <th className="py-2 px-3">Màu sắc</th>
                                          <th className="py-2 px-3 text-center">Size</th>
                                          <th className="py-2 px-3 text-center">ĐVT</th>
                                          <th className="py-2 px-3">Từ Kho</th>
                                          <th className="py-2 px-3">Sang Kho</th>
                                          <th className="py-2 px-3 text-right">Số lượng dời</th>
                                          <th className="py-2 px-3">Ghi chú</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200">
                                        {items.map((it, idx) => {
                                          const prod = productByCode.get(it.productCode);
                                          const itColor = String(it.color || "").trim();
                                          const itSize = String(it.size || "").trim();
                                          const childCode =
                                            itColor || itSize
                                              ? variantCodeFor(
                                                  it.productCode,
                                                  itColor,
                                                  itSize
                                                )
                                              : it.productCode;
                                          const matchedVar = (prod?.variants || []).find(
                                            (v) =>
                                              String(v.color || "").trim().toLowerCase() ===
                                              itColor.toLowerCase()
                                          );
                                          const hexes = resolveVariantColorHexes(
                                            itColor,
                                            matchedVar?.colorHexes
                                          );
                                          return (
                                            <tr key={it._id || idx} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 text-center font-mono">
                                                {idx + 1}
                                              </td>
                                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                                <div>{childCode}</div>
                                                {(itColor || itSize) && (
                                                  <div className="text-[10px] font-normal text-slate-400">
                                                    Gốc: {it.productCode}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-slate-900">
                                                {it.productName}
                                              </td>
                                              <td className="py-2 px-3">
                                                {itColor ? (
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
                                                      colorName={itColor}
                                                      size="xs"
                                                    />
                                                    <span>{itColor}</span>
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400">-</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {Boolean(itSize) ? (
                                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-brand-ink border border-indigo-200 font-mono font-extrabold">
                                                    {itSize}
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400">—</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {(it as any).unit || prod?.unit || "Cái"}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-slate-700">
                                                {it.fromWarehouse === "FLOOR_2"
                                                  ? "🏬 Kho Tầng 2"
                                                  : "🏢 Kho Tầng 1"}
                                              </td>
                                              <td className="py-2 px-3 font-semibold text-brand-ink">
                                                {it.toWarehouse === "FLOOR_2"
                                                  ? "🏬 Kho Tầng 2"
                                                  : "🏢 Kho Tầng 1"}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-extrabold text-brand-ink">
                                                {Math.abs(Number(it.quantityChange) || 0)}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600">
                                                {it.note || "-"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </>
  );
}

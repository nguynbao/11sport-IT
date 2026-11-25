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

export function ImportReceiptDetailModal({ vm }: { vm: InventoryViewModel }) {
  const {
    variantCodeFor,
    detailModalReceipt,
    setDetailModalReceipt,
    productByCode,
  } = vm;

  return (
    <>
      {/* MODAL XEM LẠI CHI TIẾT KHI NHẬP HÀNG VÀO KHO */}
      {detailModalReceipt && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailModalReceipt(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-brand-ink">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Chi Tiết Nhập Hàng Vào Kho:{" "}
                      <span className="font-mono text-brand-ink">
                        {detailModalReceipt.code ||
                          detailModalReceipt.receiptCode ||
                          detailModalReceipt._id}
                      </span>
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${detailModalReceipt.status === "COMPLETED"
                        ? "bg-teal-50 text-brand-ink border border-teal-200"
                        : detailModalReceipt.status === "CHECKING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-teal-50 text-brand-ink border border-teal-200"
                        }`}
                    >
                      {detailModalReceipt.status === "COMPLETED"
                        ? "ĐÃ HOÀN THÀNH"
                        : detailModalReceipt.status === "CHECKING"
                          ? "ĐANG KIỂM HÀNG"
                          : detailModalReceipt.status}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {detailModalReceipt.targetWarehouse === "FLOOR_2"
                        ? "🏬 Kho Tầng 2"
                        : "🏢 Kho Tầng 1"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thời gian tạo: {formatDateTime(detailModalReceipt.createdAt)}
                    {detailModalReceipt.completedAt
                      ? ` · Hoàn thành: ${formatDateTime(detailModalReceipt.completedAt)}`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Thông tin Người nhập / Người kiểm / Người hoàn thành */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-purple-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    1. Người lập phiếu / Người nhập
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                    <span>{detailModalReceipt.createdByName || "Quản trị viên"}</span>
                    <CmsRoleBadge role={detailModalReceipt.createdByRole || "ADMIN"} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lúc: {formatDateTime(detailModalReceipt.createdAt)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    2. Nhân sự kiểm đếm thực tế
                  </div>
                  <div className="font-bold text-slate-900 flex flex-wrap gap-1.5">
                    {(() => {
                      const items: any[] = detailModalReceipt.items || [];
                      const byName = new Map<string, { qty: number; role?: string }>();
                      items.forEach((it) =>
                        (it.scanCounts || []).forEach((s: any) => {
                          const prev = byName.get(s.name) || { qty: 0, role: s.role };
                          byName.set(s.name, {
                            qty: prev.qty + (Number(s.quantity) || 0),
                            role: s.role || prev.role,
                          });
                        })
                      );
                      if (byName.size > 0) {
                        return Array.from(byName.entries()).map(([n, info]) => (
                          <span
                            key={n}
                            className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-teal-200"
                          >
                            <span>
                              {n} ({info.qty} SP)
                            </span>
                            <CmsRoleBadge role={info.role} compact />
                          </span>
                        ));
                      }
                      const checkers = new Map<string, string | undefined>();
                      items.forEach((it) => {
                        if (it.checkedByName) {
                          checkers.set(it.checkedByName, it.checkedByRole);
                        }
                      });
                      if (checkers.size > 0) {
                        return Array.from(checkers.entries()).map(([n, r]) => (
                          <span
                            key={n}
                            className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-teal-200"
                          >
                            <span>{n}</span>
                            <CmsRoleBadge role={r} compact />
                          </span>
                        ));
                      }
                      return <span className="text-slate-400 italic">Chưa ghi nhận quét mã</span>;
                    })()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    3. Người xác nhận hoàn thành
                  </div>
                  {detailModalReceipt.completedByName ? (
                    <>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        <span>{detailModalReceipt.completedByName}</span>
                        <CmsRoleBadge role={detailModalReceipt.completedByRole} />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Lúc: {formatDateTime(detailModalReceipt.completedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 italic py-1">
                      Phiếu chưa hoàn thành nhập kho
                    </div>
                  )}
                </div>
              </div>

              {detailModalReceipt.note && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <strong>Ghi chú phiếu nhập:</strong> {detailModalReceipt.note}
                </div>
              )}

              {/* Bảng chi tiết mặt hàng */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">STT</th>
                      <th className="py-2.5 px-3">Mã hàng</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-3 text-center">ĐVT</th>
                      <th className="py-2.5 px-3 text-right">SL Dự kiến</th>
                      <th className="py-2.5 px-3 text-right">SL Thực nhập</th>
                      <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                      <th className="py-2.5 px-3 text-right">Giá vốn (VND)</th>
                      <th className="py-2.5 px-3 text-right">Giá niêm yết (VND)</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền vốn</th>
                      <th className="py-2.5 px-3">Người kiểm dòng</th>
                      <th className="py-2.5 px-3">Ghi chú dòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(detailModalReceipt.items || []).map((it: any, idx: number) => {
                      const prod = productByCode.get(it.productCode);
                      const expQty = Number(it.expectedQuantity) || 0;
                      const actQty = Number(it.actualQuantity ?? it.expectedQuantity) || 0;
                      const diff = actQty - expQty;
                      const cost = Number(it.costPrice || prod?.costPrice || 0);
                      const sell = Number(it.sellingPrice || prod?.sellingPrice || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                            {it.stt || idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            <div>
                              {it.variantCode || variantCodeFor(it.productCode, it.color, it.size)}
                            </div>
                            {(it.color || it.size) && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Gốc: {it.productCode}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {it.productName}
                          </td>
                          <td className="py-2 px-3 text-center">{it.unit || "Cái"}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {expQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-brand-ink">
                            {actQty}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {diff === 0 ? (
                              <span className="text-brand-ink">Khớp (0)</span>
                            ) : (
                              <span className={diff > 0 ? "text-brand-ink" : "text-red-600"}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                            {formatVND(cost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-brand-ink whitespace-nowrap">
                            {formatVND(sell)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatVND(actQty * cost)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {Array.isArray(it.scanCounts) && it.scanCounts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {it.scanCounts.map((sc: any, sIdx: number) => (
                                  <div key={sIdx} className="inline-flex items-center gap-1">
                                    <span className="font-semibold text-slate-800">
                                      {sc.name} ({sc.quantity})
                                    </span>
                                    <CmsRoleBadge role={sc.role} compact />
                                  </div>
                                ))}
                              </div>
                            ) : it.checkedByName ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="font-semibold text-slate-800">
                                  {it.checkedByName}
                                </span>
                                <CmsRoleBadge role={it.checkedByRole} compact />
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {it.discrepancyNote || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase">
                        Tổng cộng ({(detailModalReceipt.items || []).length} mặt hàng):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {(detailModalReceipt.items || []).reduce(
                          (s: number, it: any) => s + (Number(it.expectedQuantity) || 0),
                          0
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-brand-ink">
                        {(detailModalReceipt.items || []).reduce(
                          (s: number, it: any) =>
                            s + (Number(it.actualQuantity ?? it.expectedQuantity) || 0),
                          0
                        )}
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                        {formatVND(
                          (detailModalReceipt.items || []).reduce(
                            (s: number, it: any) =>
                              s +
                              (Number(it.actualQuantity ?? it.expectedQuantity) || 0) *
                              (Number(
                                it.costPrice ||
                                productByCode.get(it.productCode)?.costPrice ||
                                0
                              ) || 0),
                            0
                          )
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailModalReceipt(null)}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { formatDateTime,formatVND } from "@/shared/utils/format";
import {
ChevronDown,
ChevronUp,
Eye,
Trash2
} from "lucide-react";
import React from "react";
import { exportImports } from "../exports";
import { InventoryViewModel } from "../hooks/useInventoryModule";
import { CmsRoleBadge } from "./CmsRoleBadge";

export function HistoryImportsView({ vm }: { vm: InventoryViewModel }) {
  const {
    historyView,
    activeWarehouse,
    importsList,
    expandedImportId,
    setExpandedImportId,
    setImpPage,
    impPageSize,
    setImpPageSize,
    setDetailModalReceipt,
    handleDeleteImportReceipt,
    productByCode,
    filteredImports,
    impTotalPages,
    safeImpPage,
    pagedImports,
    renderPaginationBar,
  } = vm;

  return (
    <>
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
            <table data-cards className="w-full text-xs text-left">
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
                              <table data-cards className="w-full text-[11px] text-left">
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

    </>
  );
}

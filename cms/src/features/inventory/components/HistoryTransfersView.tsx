"use client";

import { StockMovement } from "@/shared/types";
import {
ColorSwatchBadge,
getColorBoxBorderStyle,
resolveVariantColorHexes
} from "@/shared/ui/ColorSwatchPicker";
import { formatDateTime } from "@/shared/utils/format";
import {
ArrowLeftRight,
ChevronDown,
ChevronUp
} from "lucide-react";
import React from "react";
import { InventoryViewModel } from "../hooks/useInventoryModule";

export function HistoryTransfersView({ vm }: { vm: InventoryViewModel }) {
  const {
    setSubTab,
    historyView,
    variantCodeFor,
    transfersList,
    expandedTransferCode,
    setExpandedTransferCode,
    productByCode,
  } = vm;

  return (
    <>
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
    </>
  );
}

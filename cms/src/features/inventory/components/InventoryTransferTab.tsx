"use client";

import {
ColorSwatchBadge,
getColorBoxBorderStyle,
resolveVariantColorHexes
} from "@/shared/ui/ColorSwatchPicker";
import {
ArrowLeftRight,
History,
Trash2
} from "lucide-react";
import { InventoryViewModel } from "../hooks/useInventoryModule";

import { TransferProductPicker } from "./TransferProductPicker";

export function InventoryTransferTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    setSubTab,
    setHistoryView,
    products,
    variantCodeFor,
    transferDirection,
    transferItems,
    setTransferItems,
    transferNote,
    setTransferNote,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    getSourceVariantFloorStock,
    getTransferItemKey,
    handleChangeTransferDirection,
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

      <TransferProductPicker vm={vm} />
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


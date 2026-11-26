"use client";

import { Eye, Printer } from "lucide-react";
import type { Product, ProductVariant } from "@/shared/types";
import { formatNumberDots, formatVND, parseNumberDots } from "@/shared/utils/format";
import { OPEN_ROW_DETAIL_EVENT } from "@/shared/ui/MobileRowDetailModal";
import { getFloor1Stock } from "../utils/stock";
import InventoryVariantsCell from "./InventoryVariantsCell";
import InventoryMobileVariantsExpand from "./InventoryMobileVariantsExpand";
import type { InventoryRowShared } from "./InventoryRow";

type Props = InventoryRowShared & {
  pagedProducts: Product[];
};

export default function InventoryMobileCards({
  pagedProducts,
  effectiveWarehouse,
  canSeeCostPrice,
  isSales,
  isAdmin,
  expandedProdIds,
  newVariantDrafts,
  setNewVariantDrafts,
  addingVariantProdId,
  lastScannedProdId,
  lastScannedVariantCode,
  scannedCheckCounts,
  scannedVariantCounts,
  priceEdits,
  setPriceEdits,
  handleSaveAllPriceChanges,
  toggleExpandProduct,
  handleAddVariantToProduct,
  variantCodeFor,
  setLabelModalItems,
  expandProductToPrintLabelItems,
}: Props) {
  const openDetailModal = (p: Product, idx: number, catName: string, f1: number, f2: number) => {
    const variants: ProductVariant[] = Array.isArray(p.variants) ? p.variants : [];
    const variantLines = variants
      .filter((v) => v.color || v.size)
      .map((v) => {
        const label = [v.color, v.size ? `Size ${v.size}` : ""].filter(Boolean).join(" - ");
        const qty =
          effectiveWarehouse === "FLOOR_1"
            ? Number(v.stockFloor1 || 0)
            : effectiveWarehouse === "FLOOR_2"
              ? Number(v.stockFloor2 || 0)
              : Number(v.stock || 0);
        return `• ${label}: ${qty} ${p.unit}`;
      });

    const fields = [
      { label: "STT", text: `#${idx + 1}` },
      { label: "Mã SP (chung)", text: p.code },
      ...(p.legacyCode && p.legacyCode !== p.code
        ? [{ label: "Mã cũ", text: p.legacyCode, fullWidth: true }]
        : []),
      { label: "Tên hàng hóa", text: p.name, fullWidth: true },
      { label: "Danh mục", text: catName },
      { label: "Thương hiệu", text: p.brandName || p.brand || "Không hãng" },
      { label: "Đơn vị tính", text: p.unit },
      ...(effectiveWarehouse === "FLOOR_1"
        ? [{ label: "Tồn Kho Tầng 1", text: `${f1} ${p.unit}` }]
        : effectiveWarehouse === "FLOOR_2"
          ? [{ label: "Tồn Kho Tầng 2", text: `${f2} ${p.unit}` }]
          : [
              { label: "Tồn Tầng 1 / Tầng 2", text: `T1: ${f1} · T2: ${f2} (Tổng: ${p.stock})` },
            ]),
      ...(canSeeCostPrice ? [{ label: "Giá vốn", text: formatVND(p.costPrice) }] : []),
      { label: "Giá niêm yết", text: formatVND(priceEdits[p._id] ?? p.sellingPrice) },
      ...(variantLines.length > 0
        ? [
            {
              label: `Phân loại (${variantLines.length} mã con)`,
              text: variantLines.join("\n"),
              fullWidth: true,
            },
          ]
        : []),
      ...(p.note ? [{ label: "Ghi chú", text: p.note, fullWidth: true }] : []),
    ];

    window.dispatchEvent(
      new CustomEvent(OPEN_ROW_DETAIL_EVENT, {
        detail: { title: `${p.code} — ${p.name}`, fields },
      })
    );
  };

  return (
    <div className="space-y-3">
      {pagedProducts.map((p, idx) => {
        const catName =
          p.categoryName || (typeof p.categoryId === "object" && p.categoryId?.name) || "Mặc định";
        const brandLabel = p.brandName || p.brand || "Không hãng";
        const f1 = getFloor1Stock(p);
        const f2 = Number(p.stockFloor2) || 0;
        const variants: ProductVariant[] = Array.isArray(p.variants) ? p.variants : [];
        const isExpanded = expandedProdIds.has(p._id);
        const scannedQty = scannedCheckCounts[p._id] || 0;
        const currentPrice = priceEdits[p._id] ?? Number(p.sellingPrice || 0);
        const isPriceEdited =
          priceEdits[p._id] !== undefined && priceEdits[p._id] !== Number(p.sellingPrice || 0);

        return (
          <div
            key={p._id}
            className={`rounded-2xl border p-3.5 space-y-2.5 shadow-2xs transition-colors ${
              lastScannedProdId === p._id
                ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-300"
                : scannedQty > 0
                  ? "bg-blue-50/30 border-blue-200"
                  : "bg-white border-slate-200"
            }`}
          >
            {/* Hàng 1: STT + Mã SP nằm chung 1 hàng */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs font-extrabold">
                  #{idx + 1}
                </span>
                <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-brand-ink border border-blue-200 truncate">
                  {p.code}
                </span>
              </div>
              {scannedQty > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold font-mono shrink-0">
                  Đã quét: {scannedQty}
                </span>
              )}
            </div>

            {/* Hàng 2: Tên hàng hóa & Phân loại */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 text-sm leading-snug">{p.name}</div>
              {p.note && <div className="text-[11px] text-slate-500">{p.note}</div>}
              <div className="overflow-x-auto">
                <table className="w-full [&_td]:!p-0">
                  <tbody>
                    <tr>
                      <InventoryVariantsCell
                        p={p}
                        variants={variants}
                        effectiveWarehouse={effectiveWarehouse}
                        isExpanded={isExpanded}
                        lastScannedVariantCode={lastScannedVariantCode}
                        scannedVariantCounts={scannedVariantCounts}
                        variantCodeFor={variantCodeFor}
                        toggleExpandProduct={toggleExpandProduct}
                      />
                    </tr>
                  </tbody>
                </table>
              </div>
              {isExpanded && (
                <div className="pt-1">
                  <InventoryMobileVariantsExpand
                    p={p}
                    variants={variants}
                    isSales={isSales}
                    isAdmin={isAdmin}
                    priceEdits={priceEdits}
                    lastScannedVariantCode={lastScannedVariantCode}
                    scannedVariantCounts={scannedVariantCounts}
                    newVariantDrafts={newVariantDrafts}
                    setNewVariantDrafts={setNewVariantDrafts}
                    addingVariantProdId={addingVariantProdId}
                    variantCodeFor={variantCodeFor}
                    handleAddVariantToProduct={handleAddVariantToProduct}
                    expandProductToPrintLabelItems={expandProductToPrintLabelItems}
                    setLabelModalItems={setLabelModalItems}
                  />
                </div>
              )}
            </div>

            {/* Hàng 3: Danh mục + Thương hiệu nằm chung 1 hàng */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-slate-200 text-xs">
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Danh mục
                </span>
                <span className="font-semibold text-slate-700 truncate block">{catName}</span>
              </div>
              <div className="min-w-0 text-right">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Thương hiệu
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {p.brandCode ? `[${p.brandCode}] ` : ""}
                  {brandLabel}
                </span>
              </div>
            </div>

            {/* Hàng 4: ĐVT + Tồn kho nằm chung 1 hàng */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 mr-1.5">ĐVT:</span>
                <span className="font-semibold text-slate-700">{p.unit}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-extrabold">
                {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-brand-ink border border-blue-200">
                    T1: {f1}
                  </span>
                )}
                {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                    T2: {f2}
                  </span>
                )}
                {effectiveWarehouse === "ALL" && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-900">
                    Tổng: {p.stock}
                  </span>
                )}
              </div>
            </div>

            {/* Hàng 5: Giá tiền nằm bên phải */}
            <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5 text-xs">
              {canSeeCostPrice && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Giá vốn</span>
                  <span className="font-mono font-semibold text-slate-600 text-right">
                    {formatVND(p.costPrice)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-slate-500">Giá niêm yết</span>
                {canSeeCostPrice ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberDots(currentPrice)}
                    onChange={(e) =>
                      setPriceEdits((prev) => ({
                        ...prev,
                        [p._id]: parseNumberDots(e.target.value),
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAllPriceChanges();
                    }}
                    className={`w-36 px-2.5 py-1.5 rounded-lg border text-right font-mono font-extrabold text-sm ${
                      isPriceEdited
                        ? "border-blue-600 bg-blue-50 text-brand-ink"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  />
                ) : (
                  <span className="font-mono font-extrabold text-sm text-brand-ink text-right">
                    {formatVND(currentPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Hàng 6: In tem + Xem chi tiết nằm chung 1 hàng */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLabelModalItems(expandProductToPrintLabelItems(p))}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-brand-ink border border-blue-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In tem</span>
              </button>
              <button
                type="button"
                onClick={() => openDetailModal(p, idx, catName, f1, f2)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Xem chi tiết</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Printer } from "lucide-react";
import type { Product, ProductVariant } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import {
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import AddVariantForm from "./AddVariantForm";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<
  InventoryCtx,
  | "isSales"
  | "isAdmin"
  | "priceEdits"
  | "variantCodeFor"
  | "scannedVariantCounts"
  | "lastScannedVariantCode"
  | "setLabelModalItems"
  | "expandProductToPrintLabelItems"
  | "newVariantDrafts"
  | "setNewVariantDrafts"
  | "addingVariantProdId"
  | "handleAddVariantToProduct"
> & { p: Product; variants: ProductVariant[] };

export default function InventoryMobileVariantsExpand({
  p,
  variants,
  isSales,
  isAdmin,
  priceEdits,
  variantCodeFor,
  scannedVariantCounts,
  lastScannedVariantCode,
  setLabelModalItems,
  expandProductToPrintLabelItems,
  newVariantDrafts,
  setNewVariantDrafts,
  addingVariantProdId,
  handleAddVariantToProduct,
}: Props) {
  const draft = newVariantDrafts[p._id] || {
    color: "",
    size: "",
    quantity: 0,
    floor: "FLOOR_1" as const,
  };
  const basePrice = Number(priceEdits[p._id] ?? p.sellingPrice ?? 0);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2.5">
      <div className="space-y-0.5">
        <div className="text-xs font-extrabold text-slate-800 break-words">
          Mã con Size &amp; Màu sắc ({variants.length})
        </div>
        <div className="text-[11px] text-slate-500">
          Giá niêm yết gốc:{" "}
          <strong className="font-mono text-brand-ink">{formatVND(basePrice)}</strong>
        </div>
      </div>

      {variants.length === 0 ? (
        <div className="py-3 px-2 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-400">
          Chưa chia biến thể Màu/Size riêng (Tổng tồn: {p.stock} {p.unit}).
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map((v, vIdx) => {
            const childCode = variantCodeFor(p.code, v.color, v.size);
            const vScanned = scannedVariantCounts[p._id]?.[childCode] || 0;
            const vSellPrice =
              Number(v.sellingPrice || 0) > 0 ? Number(v.sellingPrice) : basePrice;

            return (
              <div
                key={v.variantKey || vIdx}
                className={`rounded-xl border p-2.5 space-y-2 text-xs ${
                  lastScannedVariantCode === childCode
                    ? "bg-blue-50 border-blue-400"
                    : "bg-white border-slate-200"
                }`}
              >
                {/* Hàng 1: #STT + Mã con + Badge quét */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                      #{vIdx + 1}
                    </span>
                    <span className="font-mono text-[11px] font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded truncate">
                      {childCode}
                    </span>
                  </div>
                  {vScanned > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold shrink-0">
                      Quét: {vScanned}
                    </span>
                  )}
                </div>

                {/* Hàng 2: Màu sắc + Size */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    style={getColorBoxBorderStyle(
                      resolveVariantColorHexes(v.color, v.colorHexes),
                      "var(--box-bg, #f8fafc)",
                      2
                    )}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-800"
                  >
                    <ColorSwatchBadge
                      hexes={v.colorHexes}
                      colorName={v.color || "Mặc định"}
                      size="xs"
                    />
                    <span>{v.color || "Mặc định"}</span>
                  </span>
                  {v.size?.trim() && (
                    <span className="font-mono font-bold text-brand-ink">
                      Size: {v.size.trim()}
                    </span>
                  )}
                </div>

                {/* Hàng 3: Tồn kho + Giá (phải) */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-slate-200">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                      T1: {v.stockFloor1}
                    </span>
                    {!isSales && (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          T2: {v.stockFloor2}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900">
                          Tổng: {v.stock}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-right font-mono font-extrabold text-slate-900">
                    {formatVND(vSellPrice)}
                    {Number(v.sellingPrice || 0) > 0 && (
                      <span className="block text-[9px] font-sans font-bold text-amber-600">
                        Giá riêng
                      </span>
                    )}
                  </div>
                </div>

                {/* Hàng 4: Nút In mã con */}
                <button
                  type="button"
                  onClick={() => setLabelModalItems(expandProductToPrintLabelItems(p, v))}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In mã {childCode}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <AddVariantForm
          p={p}
          draft={draft}
          setNewVariantDrafts={setNewVariantDrafts}
          addingVariantProdId={addingVariantProdId}
          handleAddVariantToProduct={handleAddVariantToProduct}
        />
      )}
    </div>
  );
}

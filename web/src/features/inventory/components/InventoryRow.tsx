import { Printer } from "lucide-react";
import type { Product, ProductVariant } from "@/shared/types";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { getFloor1Stock } from "../utils/stock";
import InventoryVariantsCell from "./InventoryVariantsCell";
import VariantExpandPanel from "./VariantExpandPanel";
import type { InventoryCtx } from "./inventoryCtx";

export type InventoryRowShared = Pick<InventoryCtx, "effectiveWarehouse" | "canSeeCostPrice" | "colCount" | "isSales" | "isAdmin" | "expandedProdIds" | "newVariantDrafts" | "setNewVariantDrafts" | "addingVariantProdId" | "lastScannedProdId" | "lastScannedVariantCode" | "scannedCheckCounts" | "scannedVariantCounts" | "priceEdits" | "setPriceEdits" | "handleSaveAllPriceChanges" | "toggleExpandProduct" | "handleAddVariantToProduct" | "variantCodeFor" | "setLabelModalItems" | "expandProductToPrintLabelItems">;

type Props = InventoryRowShared & { p: Product; idx: number };

export default function InventoryRow({
  p,
  idx,
  effectiveWarehouse,
  canSeeCostPrice,
  colCount,
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
  const catName =
    p.categoryName ||
    (typeof p.categoryId === "object" && p.categoryId?.name) ||
    "Mặc định";
  const f1 = getFloor1Stock(p);
  const f2 = Number(p.stockFloor2) || 0;
  const variants: ProductVariant[] = Array.isArray(p.variants) ? p.variants : [];
  const isExpanded = expandedProdIds.has(p._id);
  const scannedQty = scannedCheckCounts[p._id] || 0;
  const sysStockForCompare =
    effectiveWarehouse === "FLOOR_1"
      ? f1
      : effectiveWarehouse === "FLOOR_2"
        ? f2
        : Number(p.stock || 0);

  return (
    <>
      <tr
        className={`hover:bg-slate-50 transition-colors ${lastScannedProdId === p._id
          ? "bg-blue-100/80 ring-2 ring-inset ring-blue-500"
          : scannedQty > 0
            ? "bg-blue-50/40"
            : ""
          }`}
      >
        <td className="py-3 px-3 font-mono text-xs text-slate-500">
          {idx + 1}
        </td>
        <td className="py-3 px-3">
          <div className="flex flex-col items-start gap-1">
            <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-blue-50 text-brand-ink border border-blue-200 whitespace-nowrap">
              {p.code}
            </span>
            {(p.brandName || p.brand || p.versionName) && (
              <span className="text-[10px] font-semibold text-slate-500">
                {p.brandCode ? `[${p.brandCode}] ` : ""}
                {p.brandName || p.brand || ""}
                {p.versionName ? ` · ${p.versionName}` : ""}
              </span>
            )}
            {p.legacyCode && p.legacyCode !== p.code && (
              <span className="text-[10px] text-slate-400" title="Mã cũ trước chuẩn hoá — vẫn quét được">
                Mã cũ: {p.legacyCode}
              </span>
            )}
            {scannedQty > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${scannedQty === sysStockForCompare
                  ? "bg-blue-600 text-white border-blue-700"
                  : scannedQty > sysStockForCompare
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-teal-100 text-teal-900 border-teal-300"
                  }`}
              >
                Đã quét: {scannedQty}/{sysStockForCompare}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3">
          <div className="font-semibold text-slate-900">{p.name}</div>
          {p.brand && (
            <span className="inline-block mt-0.5 text-[11px] font-bold text-slate-500">
              Hãng: {p.brand}
            </span>
          )}
          {p.note && (
            <div className="mt-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              📝 {p.note}
            </div>
          )}
        </td>
        <InventoryVariantsCell
          p={p}
          variants={variants}
          isExpanded={isExpanded}
          effectiveWarehouse={effectiveWarehouse}
          variantCodeFor={variantCodeFor}
          scannedVariantCounts={scannedVariantCounts}
          lastScannedVariantCode={lastScannedVariantCode}
          toggleExpandProduct={toggleExpandProduct}
        />
        <td className="py-3 px-3 text-xs text-slate-600">{catName}</td>
        <td className="py-3 px-2 text-center text-xs">{p.unit}</td>
        {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
          <td className="py-3 px-3 text-right font-mono font-extrabold bg-blue-50/30">
            <span
              className={`px-2.5 py-1 rounded-full text-xs ${f1 > 0
                ? "bg-blue-100 text-brand-ink"
                : "bg-red-50 text-red-600"
                }`}
            >
              {f1}
            </span>
          </td>
        )}
        {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
          <td className="py-3 px-3 text-right font-mono font-extrabold bg-blue-50/30">
            <span
              className={`px-2.5 py-1 rounded-full text-xs ${f2 > 0
                ? "bg-blue-100 text-brand-ink"
                : "bg-slate-100 text-slate-500"
                }`}
            >
              {f2}
            </span>
          </td>
        )}
        {effectiveWarehouse === "ALL" && (
          <td className="py-3 px-3 text-right font-mono font-extrabold">
            <span className="px-2.5 py-1 rounded-full text-xs bg-slate-200 text-slate-900">
              {p.stock}
            </span>
          </td>
        )}
        {canSeeCostPrice && (
          <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-amber-800 font-semibold">
            {Number(p.costPrice) > 0 ? (
              formatVND(p.costPrice)
            ) : (
              <span className="text-xs text-slate-400">0 VND</span>
            )}
          </td>
        )}
        <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
          {canSeeCostPrice ? (
            <div className="flex items-center justify-end gap-1.5">
              <div className="relative w-36">
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    (priceEdits[p._id] !== undefined
                      ? priceEdits[p._id]
                      : Number(p.sellingPrice || 0)) > 0
                      ? formatNumberDots(
                        priceEdits[p._id] !== undefined
                          ? priceEdits[p._id]
                          : p.sellingPrice
                      )
                      : ""
                  }
                  onChange={(e) =>
                    setPriceEdits((prev) => ({
                      ...prev,
                      [p._id]: parseNumberDots(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveAllPriceChanges();
                    }
                  }}
                  placeholder="Nhập giá niêm yết..."
                  className={`w-full pl-2 pr-9 py-1.5 rounded-lg border text-right text-xs font-mono font-bold focus:border-blue-600 focus:outline-none ${priceEdits[p._id] !== undefined &&
                    priceEdits[p._id] !== Number(p.sellingPrice || 0)
                    ? "border-blue-500 bg-blue-50/70 text-blue-950 ring-1 ring-blue-400"
                    : (priceEdits[p._id] ?? p.sellingPrice) > 0
                      ? "border-slate-300 bg-white text-slate-900"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                />
                <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                  VND
                </span>
              </div>
            </div>
          ) : p.sellingPrice > 0 ? (
            <span className="font-bold text-slate-900">
              {formatVND(p.sellingPrice)}
            </span>
          ) : (
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Chưa có giá
            </span>
          )}
        </td>
        <td className="py-3 px-3 text-center">
          <button
            type="button"
            onClick={() => setLabelModalItems(expandProductToPrintLabelItems(p))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-brand-ink border border-blue-200 text-xs font-bold transition"
            title="In tem mã vạch theo từng Mã con (Màu + Size)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In tem</span>
          </button>
        </td>
      </tr>

      {isExpanded && (
        <VariantExpandPanel
          p={p}
          variants={variants}
          colCount={colCount}
          isSales={isSales}
          isAdmin={isAdmin}
          priceEdits={priceEdits}
          variantCodeFor={variantCodeFor}
          scannedVariantCounts={scannedVariantCounts}
          lastScannedVariantCode={lastScannedVariantCode}
          setLabelModalItems={setLabelModalItems}
          expandProductToPrintLabelItems={expandProductToPrintLabelItems}
          newVariantDrafts={newVariantDrafts}
          setNewVariantDrafts={setNewVariantDrafts}
          addingVariantProdId={addingVariantProdId}
          handleAddVariantToProduct={handleAddVariantToProduct}
        />
      )}
    </>
  );
}

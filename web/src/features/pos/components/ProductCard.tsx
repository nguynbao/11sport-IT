import type { Product } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { Plus, Sparkles } from "lucide-react";
import { productDisplayPrice } from "../types";
import type { PosCtx } from "../hooks/usePosTab";
import { ProductCardVariants } from "./ProductCardVariants";

type ProductCardProps = Pick<
  PosCtx,
  "getDirectFloor1Stock" | "getFloor1Stock" | "getCategoryName"
  | "getProductPromotions" | "handleSelectProductForPos" | "expandedCardVarIds" | "getCartVariantQty" | "handleAddToCart"
  | "toggleExpandCardVariants" | "setVariantPickerProduct"
> & {
  p: Product;
};

export function ProductCard({
  p,
  getDirectFloor1Stock,
  getFloor1Stock,
  getCategoryName,
  getProductPromotions,
  handleSelectProductForPos,
  expandedCardVarIds,
  getCartVariantQty,
  handleAddToCart,
  toggleExpandCardVariants,
  setVariantPickerProduct,
}: ProductCardProps) {
    const directFloor1 = getDirectFloor1Stock(p);
    const unpackableFloor1 = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    const floor1Stock = getFloor1Stock(p);
    const displayPrice = productDisplayPrice(p);
    const canSell = displayPrice.price > 0 && floor1Stock > 0;
    const catName = getCategoryName(p);
    const matchedPromos = getProductPromotions(p);
    const namedVariants = (p.variants || []).filter((v) => v.color || v.size);

    return (
      <div
        key={p._id}
        onClick={() => canSell && handleSelectProductForPos(p)}
        className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${canSell
          ? "border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer bg-white"
          : "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
          }`}
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200 truncate">
              {catName}
            </span>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded whitespace-nowrap ${directFloor1 > 0
                  ? "bg-blue-50 text-brand-ink border border-blue-200"
                  : unpackableFloor1 > 0
                    ? "bg-amber-50 text-amber-800 border border-amber-300"
                    : "bg-red-50 text-red-600 border border-red-200"
                  }`}
              >
                {directFloor1 > 0
                  ? `🏢 Kho Tầng 1: ${directFloor1} ${p.unit}`
                  : unpackableFloor1 > 0
                    ? `⚡ Tồn lẻ: 0 • Tự tách từ ${p.parentSetStockFloor1} ${p.parentSetUnit || "Bộ"}`
                    : `🏢 Kho Tầng 1: 0 ${p.unit}`}
              </span>
              {unpackableFloor1 > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-950 border border-amber-300 whitespace-nowrap">
                  📦 +{p.parentSetStockFloor1} {p.parentSetUnit || "Bộ"} (= +{unpackableFloor1}{" "}
                  {p.unit})
                </span>
              )}
            </div>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm mt-2 break-words">
            {p.name}
          </h3>
          <div className="font-mono text-[10px] font-bold text-slate-500 mt-0.5 break-all">
            Mã: {p.code}
          </div>
          {p.note && (
            <div className="mt-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 break-words">
              📝 {p.note}
            </div>
          )}

          {/* Hiển thị thông minh phân loại theo từng Nhóm Màu sắc & chip Size gọn gàng */}
          <ProductCardVariants
            namedVariants={namedVariants}
            expandedCardVarIds={expandedCardVarIds}
            p={p}
            getCartVariantQty={getCartVariantQty}
            canSell={canSell}
            handleAddToCart={handleAddToCart}
            toggleExpandCardVariants={toggleExpandCardVariants}
            setVariantPickerProduct={setVariantPickerProduct}
          />

          {matchedPromos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {matchedPromos.map((mp) => (
                <span
                  key={mp._id}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300"
                >
                  <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>KM: {mp.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {displayPrice.price > 0 ? (
            <span className="font-mono font-extrabold text-brand-ink text-base">
              {displayPrice.minPrice > 0 && displayPrice.maxPrice > displayPrice.minPrice ? (
                <>{formatVND(displayPrice.minPrice)} – {formatVND(displayPrice.maxPrice)}</>
              ) : (
                formatVND(displayPrice.price)
              )}
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Chưa có giá niêm yết (0 VND)
            </span>
          )}

          <button
            type="button"
            disabled={!canSell}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectProductForPos(p);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${canSell
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-slate-200 text-slate-500"
              }`}
          >
            <Plus className="w-3.5 h-3.5" />{" "}
            {namedVariants.length > 1 ? "Chọn Size/Màu" : "Chọn bán"}
          </button>
        </div>
      </div>
    );
}

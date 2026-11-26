import { ProductCard } from "./ProductCard";
import type { Product } from "@/shared/types";
import { formatNumberDots } from "@/shared/utils/format";
import { Package } from "lucide-react";
import { ColorSwatchBadge, getColorBoxBorderStyle, resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import { productDisplayPrice } from "../types";
import type { PosCtx } from "../hooks/usePosTab";

type CatalogGridProps = Pick<
  PosCtx,
  "loadingProducts" | "catalogViewMode" | "getFloor1Stock" | "getCartQty"
  | "handleSelectProductForPos" | "getDirectFloor1Stock" | "getCategoryName"
  | "getProductPromotions" | "expandedCardVarIds"
  | "getCartVariantQty" | "handleAddToCart" | "toggleExpandCardVariants"
  | "setVariantPickerProduct"
> & {
  paginatedCatalogProducts: Product[];
};

export function CatalogGrid({
  loadingProducts,
  paginatedCatalogProducts,
  catalogViewMode,
  getFloor1Stock,
  getCartQty,
  handleSelectProductForPos,
  getDirectFloor1Stock,
  getCategoryName,
  getProductPromotions,
  expandedCardVarIds,
  getCartVariantQty,
  handleAddToCart,
  toggleExpandCardVariants,
  setVariantPickerProduct,
}: CatalogGridProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-1">
                  {loadingProducts ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Đang tải danh mục hàng hóa...
                    </div>
                  ) : paginatedCatalogProducts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Không tìm thấy sản phẩm phù hợp.
                    </div>
                  ) : catalogViewMode === "COMPACT" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {paginatedCatalogProducts.map((p) => {
                        const floor1Stock = getFloor1Stock(p);
                        const displayPrice = productDisplayPrice(p);
                        const canSell =
                          displayPrice.price > 0 && floor1Stock > 0;
                        const inCartQty = getCartQty(p._id);
                        const namedVars = (p.variants || []).filter(
                          (v) => v.color || v.size
                        );

                        return (
                          <button
                            key={p._id}
                            type="button"
                            disabled={!canSell}
                            onClick={() =>
                              canSell && handleSelectProductForPos(p)
                            }
                            title={`${p.name} (${p.code}) • Tồn Tầng 1: ${floor1Stock} ${p.unit}`}
                            className={`group text-left p-2.5 rounded-xl border transition flex flex-col gap-1.5 relative ${
                              inCartQty > 0
                                ? "border-blue-500 bg-blue-50/40 shadow-xs"
                                : canSell
                                  ? "border-slate-200 hover:border-blue-400 hover:shadow-xs bg-white"
                                  : "border-slate-200 opacity-50 cursor-not-allowed bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Thumbnail / Icon đại diện */}
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 flex flex-col items-center justify-center shrink-0 text-brand-ink font-mono font-extrabold text-[10px] overflow-hidden">
                                <Package className="w-4 h-4 text-brand-ink mb-0.5" />
                                <span className="text-[9px] text-slate-500">
                                  SL:{floor1Stock}
                                </span>
                              </div>

                              {/* Tên SP + Giá bán màu xanh lá */}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
                                  {p.name}
                                </div>
                                <div className="font-mono font-extrabold text-xs text-brand-ink mt-0.5 flex items-center gap-1">
                                  <span>
                                    {displayPrice.minPrice > 0 && displayPrice.maxPrice > displayPrice.minPrice
                                      ? `${formatNumberDots(displayPrice.minPrice)} – ${formatNumberDots(displayPrice.maxPrice)}`
                                      : formatNumberDots(displayPrice.price)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Hiển thị các hộp label màu sắc có border theo đúng màu cấu hình (giống ảnh mẫu) */}
                            {namedVars.length > 0 && (() => {
                              const byColor = new Map<string, { stock: number; hexes?: string[] }>();
                              for (const v of namedVars) {
                                const cKey = (v.color || "").trim() || "Mặc định";
                                const prev = byColor.get(cKey) || { stock: 0, hexes: v.colorHexes };
                                prev.stock += Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                                if (!prev.hexes && Array.isArray(v.colorHexes) && v.colorHexes.length > 0) {
                                  prev.hexes = v.colorHexes;
                                }
                                byColor.set(cKey, prev);
                              }
                              const colorEntries = Array.from(byColor.entries());
                              return (
                                <div className="space-y-1 pt-0.5">
                                  {colorEntries.slice(0, 2).map(([cLabel, info]) => {
                                    const cHexes = resolveVariantColorHexes(cLabel, info.hexes);
                                    return (
                                      <div
                                        key={cLabel}
                                        style={getColorBoxBorderStyle(cHexes, "var(--box-bg, #f8fafc)", 2)}
                                        className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 flex items-center justify-between gap-1.5 text-[10px]"
                                      >
                                        <span className="font-extrabold text-slate-800 flex items-center gap-1 truncate">
                                          <ColorSwatchBadge hexes={cHexes} colorName={cLabel} size="xs" />
                                          <span className="truncate">{cLabel}:</span>
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 font-mono font-extrabold text-brand-ink shrink-0">
                                          ({info.stock})
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {colorEntries.length > 2 && (
                                    <div className="text-[10px] font-bold text-slate-500 text-right">
                                      +{colorEntries.length - 2} màu khác
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {inCartQty > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-blue-600 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                                {inCartQty}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 pr-1">
                      {paginatedCatalogProducts.map((p) =>
                        <ProductCard
                          key={p._id}
                          p={p}
                          getDirectFloor1Stock={getDirectFloor1Stock}
                          getFloor1Stock={getFloor1Stock}
                          getCategoryName={getCategoryName}
                          getProductPromotions={getProductPromotions}
                          handleSelectProductForPos={handleSelectProductForPos}
                          expandedCardVarIds={expandedCardVarIds}
                          getCartVariantQty={getCartVariantQty}
                          handleAddToCart={handleAddToCart}
                          toggleExpandCardVariants={toggleExpandCardVariants}
                          setVariantPickerProduct={setVariantPickerProduct}
                        />
                      )}
                    </div>
                  )}
                </div>
  );
}

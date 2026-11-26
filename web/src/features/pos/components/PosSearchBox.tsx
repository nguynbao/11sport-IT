import { formatNumberDots } from "@/shared/utils/format";
import { Search, X } from "lucide-react";
import { ColorSwatchBadge, getColorBoxBorderStyle, resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import { productDisplayPrice } from "../types";
import type { PosCtx } from "../hooks/usePosTab";

type PosSearchBoxProps = Pick<
  PosCtx,
  "searchBoxRef" | "search" | "setShowSearchDropdown" | "setSearch" | "setCatalogPage"
  | "handleBarcodeScanForPos" | "showSearchDropdown" | "filteredAndSortedProducts"
  | "getFloor1Stock" | "handleSelectProductForPos"
> & {
};

export function PosSearchBox({
  searchBoxRef,
  search,
  setShowSearchDropdown,
  setSearch,
  setCatalogPage,
  handleBarcodeScanForPos,
  showSearchDropdown,
  filteredAndSortedProducts,
  getFloor1Stock,
  handleSelectProductForPos,
}: PosSearchBoxProps) {
  return (
    <div ref={searchBoxRef} className="relative w-full sm:w-80 md:w-96 pb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onFocus={() => setShowSearchDropdown(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSearchDropdown(true);
                    setCatalogPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && search.trim()) {
                      e.preventDefault();
                      handleBarcodeScanForPos(search.trim());
                      setSearch("");
                      setShowSearchDropdown(false);
                    } else if (e.key === "Escape") {
                      setShowSearchDropdown(false);
                    }
                  }}
                  placeholder="Tìm hàng hóa (F3)"
                  className="w-full h-9 pl-9 pr-8 rounded-md bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setShowSearchDropdown(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Dropdown gợi ý sản phẩm Kho Tầng 1 */}
                {showSearchDropdown && search.trim().length > 0 && (
                  <div className="pos-search-dropdown absolute left-0 right-0 top-10 z-50 bg-white dark:!bg-[#2D2D2D] text-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:!border-[#505050] max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {filteredAndSortedProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Không tìm thấy sản phẩm &ldquo;{search}&rdquo; trong Kho Tầng 1.
                      </div>
                    ) : (
                      filteredAndSortedProducts.slice(0, 12).map((p) => {
                        const floor1Stock = getFloor1Stock(p);
                        const namedVars = (p.variants || []).filter(
                          (v) => v.color || v.size
                        );
                        const canSell = floor1Stock > 0;
                        return (
                          <div
                            key={p._id}
                            onClick={() => {
                              if (!canSell) return;
                              handleSelectProductForPos(p);
                              setShowSearchDropdown(false);
                            }}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                              canSell
                                ? "hover:bg-blue-50 cursor-pointer"
                                : "opacity-50 cursor-not-allowed bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {p.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono font-semibold text-brand-ink">
                                  {p.code}
                                </span>
                                <span>•</span>
                                <span>
                                  Tồn T1: {floor1Stock} {p.unit}
                                </span>
                                {namedVars.length > 0 && (() => {
                                  const byCol = new Map<string, { stock: number; hexes?: string[] }>();
                                  for (const v of namedVars) {
                                    const ck = (v.color || "").trim() || "Mặc định";
                                    const cur = byCol.get(ck) || { stock: 0, hexes: v.colorHexes };
                                    cur.stock += Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                                    if (!cur.hexes && Array.isArray(v.colorHexes) && v.colorHexes.length > 0) {
                                      cur.hexes = v.colorHexes;
                                    }
                                    byCol.set(ck, cur);
                                  }
                                  return Array.from(byCol.entries())
                                    .slice(0, 3)
                                    .map(([cLabel, info]) => {
                                      const cHexes = resolveVariantColorHexes(cLabel, info.hexes);
                                      return (
                                        <span
                                          key={cLabel}
                                          style={getColorBoxBorderStyle(cHexes, "var(--box-bg, #f8fafc)", 2)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 font-bold text-[10px] border border-slate-200"
                                        >
                                          <ColorSwatchBadge hexes={cHexes} colorName={cLabel} size="xs" />
                                          <span>{cLabel}:</span>
                                          <span className="font-mono text-brand-ink">({info.stock})</span>
                                        </span>
                                      );
                                    });
                                })()}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-extrabold text-xs sm:text-sm text-brand-ink">
                                {(() => {
                                  const dp = productDisplayPrice(p);
                                  return dp.minPrice > 0 && dp.maxPrice > dp.minPrice
                                    ? `${formatNumberDots(dp.minPrice)} – ${formatNumberDots(dp.maxPrice)}`
                                    : formatNumberDots(dp.price || p.sellingPrice);
                                })()}
                              </div>
                              <div className="text-[10px] text-brand-ink font-bold">
                                {namedVars.length > 1
                                  ? "Chọn Size/Màu"
                                  : "+ Thêm vào đơn"}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
  );
}

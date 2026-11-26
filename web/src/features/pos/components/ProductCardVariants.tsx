import type { Product, ProductVariant } from "@/shared/types";
import { formatVariantLabel } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ColorSwatchBadge, getColorBoxBorderStyle, resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import type { PosCtx } from "../hooks/usePosTab";

type ProductCardVariantsProps = Pick<
  PosCtx,
  "expandedCardVarIds" | "getCartVariantQty"
  | "handleAddToCart" | "toggleExpandCardVariants" | "setVariantPickerProduct"
> & {
  namedVariants: ProductVariant[];
  p: Product;
  canSell: boolean;
};

export function ProductCardVariants({
  namedVariants,
  expandedCardVarIds,
  p,
  getCartVariantQty,
  canSell,
  handleAddToCart,
  toggleExpandCardVariants,
  setVariantPickerProduct,
}: ProductCardVariantsProps) {
  return (
    <>
      {namedVariants.length > 0 && (() => {
            const byColor = new Map<string, ProductVariant[]>();
            for (const v of namedVariants) {
              const cKey = (v.color || "").trim() || "Mặc định";
              const list = byColor.get(cKey) || [];
              list.push(v);
              byColor.set(cKey, list);
            }
            // Sắp xếp các size tăng dần trong từng nhóm màu
            const colorGroups = Array.from(byColor.entries()).map(([colorLabel, vars]) => {
              const sortedVars = [...vars].sort((a, b) => {
                const sa = parseFloat(String(a.size || "").replace(",", "."));
                const sb = parseFloat(String(b.size || "").replace(",", "."));
                if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
                return String(a.size || "").localeCompare(String(b.size || ""), "vi");
              });
              const groupStock = sortedVars.reduce(
                (s, v) => s + Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0),
                0
              );
              return { colorLabel, vars: sortedVars, groupStock };
            });

            const isCardExpanded = expandedCardVarIds.has(p._id);
            const MAX_GROUPS_COLLAPSED = 2;
            const MAX_VARS_COLLAPSED = 6;
            const hasMany =
              colorGroups.length > MAX_GROUPS_COLLAPSED ||
              namedVariants.length > MAX_VARS_COLLAPSED;
            const visibleGroups =
              hasMany && !isCardExpanded
                ? colorGroups.slice(0, MAX_GROUPS_COLLAPSED)
                : colorGroups;
            const hiddenGroupCount = Math.max(0, colorGroups.length - visibleGroups.length);

            return (
              <div className="mt-2 space-y-1.5">
                {visibleGroups.map(({ colorLabel, vars, groupStock }) => {
                  const showAllSizes = isCardExpanded || vars.length <= 6;
                  const displayVars = showAllSizes ? vars : vars.slice(0, 5);
                  const hiddenSizes = Math.max(0, vars.length - displayVars.length);
                  const explicitGroupHexes = vars.find(
                    (v) => Array.isArray(v.colorHexes) && v.colorHexes.length > 0
                  )?.colorHexes;
                  const groupHexes = resolveVariantColorHexes(colorLabel, explicitGroupHexes);

                  return (
                    <div
                      key={colorLabel}
                      style={getColorBoxBorderStyle(groupHexes, "var(--box-bg, #f8fafc)", 2)}
                      className={`rounded-lg bg-slate-50/90 border border-slate-200/80 px-2.5 py-1.5 space-y-1.5 ${
                        groupStock > 0 ? "" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                          <ColorSwatchBadge
                            hexes={groupHexes}
                            colorName={colorLabel}
                            size="xs"
                          />
                          <span className="break-words leading-tight">{colorLabel}</span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                          Tồn: <strong className={groupStock > 0 ? "text-brand-ink" : "text-slate-400"}>{groupStock}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {displayVars.map((v, idx) => {
                          const vStock = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                          const inCart = getCartVariantQty(p._id, v.color, v.size);
                          const childCode =
                            v.variantCode ||
                            resolveVariantCode(p, p.code, v.color, v.size);
                          return (
                            <button
                              key={`${v.color}-${v.size}-${idx}`}
                              type="button"
                              disabled={!canSell || vStock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(p, v.color, v.size);
                              }}
                              title={`Mã con: ${childCode} • Bấm để thêm nhanh ${formatVariantLabel(v.color, v.size)}`}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition shrink-0 ${vStock <= 0
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                                : inCart > 0
                                  ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                  : "bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-900 border-slate-300 shadow-2xs"
                                }`}
                            >
                              {Boolean(v.size?.trim()) && (
                                <span className="font-extrabold tracking-tight">
                                  {v.size.trim()}
                                </span>
                              )}
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  vStock <= 0
                                    ? "text-slate-400"
                                    : inCart > 0
                                      ? "text-amber-200"
                                      : "text-brand-ink"
                                }`}
                              >
                                ({vStock})
                              </span>
                              {inCart > 0 && (
                                <span className="px-1 rounded bg-white/20 text-white font-mono text-[9px]">
                                  ✓{inCart}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {hiddenSizes > 0 && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpandCardVariants(p._id, e)}
                            className="inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 transition shrink-0"
                          >
                            +{hiddenSizes} size...
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {hasMany && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => toggleExpandCardVariants(p._id, e)}
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-ink hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition"
                    >
                      {isCardExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>Thu gọn ({namedVariants.length} mã con)</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>
                            Xem đủ {namedVariants.length} mã con ({colorGroups.length} màu
                            {hiddenGroupCount > 0 ? ` · ẩn ${hiddenGroupCount} màu` : ""})
                          </span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVariantPickerProduct(p);
                      }}
                      className="text-[10px] font-bold text-brand-ink hover:underline"
                    >
                      Bảng chọn nhanh →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
    </>
  );
}

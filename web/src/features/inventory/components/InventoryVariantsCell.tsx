import { ChevronDown, ChevronRight } from "lucide-react";
import type { Product, ProductVariant } from "@/shared/types";
import {
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "effectiveWarehouse" | "variantCodeFor" | "scannedVariantCounts" | "lastScannedVariantCode" | "toggleExpandProduct"> & { p: Product; variants: ProductVariant[]; isExpanded: boolean };

export default function InventoryVariantsCell({ p, variants, isExpanded, effectiveWarehouse, variantCodeFor, scannedVariantCounts, lastScannedVariantCode, toggleExpandProduct }: Props) {
  return (
    <td className="py-3 px-3">
      <div className="space-y-1.5">
        {variants.length > 0 ? (() => {
          const byColor = new Map<string, ProductVariant[]>();
          for (const v of variants) {
            const cKey = (v.color || "").trim() || "Mặc định";
            const list = byColor.get(cKey) || [];
            list.push(v);
            byColor.set(cKey, list);
          }
          const colorGroups = Array.from(byColor.entries()).map(([colorLabel, vars]) => {
            const sortedVars = [...vars].sort((a, b) => {
              const sa = parseFloat(String(a.size || "").replace(",", "."));
              const sb = parseFloat(String(b.size || "").replace(",", "."));
              if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
              return String(a.size || "").localeCompare(String(b.size || ""), "vi");
            });
            return { colorLabel, vars: sortedVars };
          });

          const MAX_GROUPS_PREVIEW = 2;
          const visibleGroups = isExpanded
            ? colorGroups
            : colorGroups.slice(0, MAX_GROUPS_PREVIEW);
          const hiddenGroupsCount = Math.max(
            0,
            colorGroups.length - visibleGroups.length
          );

          return (
            <div className="space-y-1">
              {visibleGroups.map(({ colorLabel, vars }) => {
                const displayVars = isExpanded ? vars : vars.slice(0, 6);
                const hiddenVarsCount = Math.max(0, vars.length - displayVars.length);
                const explicitGroupHexes = vars.find(
                  (v) => Array.isArray(v.colorHexes) && v.colorHexes.length > 0
                )?.colorHexes;
                const groupHexes = resolveVariantColorHexes(
                  colorLabel,
                  explicitGroupHexes
                );
                return (
                  <div
                    key={colorLabel}
                    style={getColorBoxBorderStyle(groupHexes, "var(--box-bg, #f8fafc)", 2)}
                    className="flex flex-wrap items-center gap-1 bg-slate-50/90 border border-slate-200/80 rounded-md px-2 py-1"
                  >
                    <span className="text-[11px] font-extrabold text-slate-800 mr-1 flex items-center gap-1.5">
                      <ColorSwatchBadge
                        hexes={groupHexes}
                        colorName={colorLabel}
                        size="xs"
                      />
                      <span>{colorLabel}:</span>
                    </span>
                    {displayVars.map((v, vIdx) => {
                      const vQty =
                        effectiveWarehouse === "FLOOR_1"
                          ? v.stockFloor1
                          : effectiveWarehouse === "FLOOR_2"
                            ? v.stockFloor2
                            : v.stock;
                      const childCode =
                        v.variantCode ||
                        variantCodeFor(p.code, v.color, v.size);
                      const vScanned = scannedVariantCounts[p._id]?.[childCode] || 0;
                      return (
                        <span
                          key={`${v.variantKey || vIdx}`}
                          title={`Mã con: ${childCode}`}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${lastScannedVariantCode === childCode
                            ? "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300"
                            : vQty > 0
                              ? "bg-white text-brand-ink border-blue-200"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                            }`}
                        >
                          {Boolean(v.size?.trim()) && (
                            <span>{v.size.trim()}</span>
                          )}
                          <span className="font-mono font-extrabold">({vQty})</span>
                          {vScanned > 0 && (
                            <span className="ml-0.5 px-1 rounded bg-teal-700 text-white font-mono text-[9px]">
                              Quét:{vScanned}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {hiddenVarsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandProduct(p._id)}
                        className="text-[10px] font-extrabold text-brand-ink hover:underline px-1"
                      >
                        +{hiddenVarsCount} size...
                      </button>
                    )}
                  </div>
                );
              })}
              {hiddenGroupsCount > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpandProduct(p._id)}
                  className="text-[10px] font-extrabold text-brand-ink bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition"
                >
                  +{hiddenGroupsCount} màu khác ({variants.length} mã con)...
                </button>
              )}
            </div>
          );
        })() : (
          <span className="text-xs text-slate-400 italic">
            Chưa chia Size/Màu
          </span>
        )}
        <div>
          <button
            type="button"
            onClick={() => toggleExpandProduct(p._id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>
              {isExpanded
                ? "Thu gọn bảng mã con"
                : `Chi tiết (${variants.length} mã con) / +Size,Màu`}
            </span>
          </button>
        </div>
      </div>
    </td>
  );
}

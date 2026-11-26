import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PreviewCodeResult } from "@/shared/types";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { EMPTY_VARIANT, toCode } from "./productCodeCreatorTypes";
import type { CreatorVariantDraft } from "./productCodeCreatorTypes";

interface Props {
  variants: CreatorVariantDraft[];
  setVariants: React.Dispatch<React.SetStateAction<CreatorVariantDraft[]>>;
  updateVariant: (idx: number, patch: Partial<CreatorVariantDraft>) => void;
  previewVariantFor: (v: CreatorVariantDraft) => NonNullable<PreviewCodeResult["variants"]>[number] | undefined;
  isEditing: boolean;
  canSeeCost: boolean;
  canSetSellingPrice: boolean;
  sellingPrice: number;
  costPrice: number;
  colorSuggestions: string[];
  sizeSuggestions: string[];
}

export default function ProductCodeCreatorVariantsTable({
  variants,
  setVariants,
  updateVariant,
  previewVariantFor,
  isEditing,
  canSeeCost,
  canSetSellingPrice,
  sellingPrice,
  costPrice,
  colorSuggestions,
  sizeSuggestions,
}: Props) {
  return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold uppercase text-slate-700">
                4. Biến thể (Màu + Size) — giá riêng tuỳ chọn, trống = dùng giá mặc định
              </h3>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      ...EMPTY_VARIANT,
                      color: prev[prev.length - 1]?.color || "",
                      colorCode: prev[prev.length - 1]?.colorCode || "",
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm biến thể
              </button>
            </div>
            <datalist id="pcc-colors">
              {colorSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="pcc-sizes">
              {sizeSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-2 text-left">Màu *</th>
                    <th className="py-2 px-2 text-left">Mã màu (2–3)</th>
                    <th className="py-2 px-2 text-left">Size</th>
                    {canSetSellingPrice && <th className="py-2 px-2 text-right">Giá niêm yết riêng</th>}
                    {canSeeCost && <th className="py-2 px-2 text-right">Giá vốn riêng</th>}
                    {isEditing && <th className="py-2 px-2 text-center">Tồn hiện tại</th>}
                    <th className="py-2 px-2 text-left">Mã con (server)</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {variants.map((v, idx) => {
                    const pv = previewVariantFor(v);
                    const vStock = Number(v.stock ?? 0);
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Màu biến thể ${idx + 1}`}
                            list="pcc-colors"
                            value={v.color}
                            onChange={(e) => updateVariant(idx, { color: e.target.value })}
                            placeholder="VD: Đỏ"
                            className="w-32 px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Mã màu biến thể ${idx + 1}`}
                            value={v.colorCode}
                            maxLength={3}
                            onChange={(e) => updateVariant(idx, { colorCode: toCode(e.target.value, 3) })}
                            placeholder={pv?.colorCode ? pv.colorCode : "Tự gợi ý"}
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-mono font-bold"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Size biến thể ${idx + 1}`}
                            list="pcc-sizes"
                            value={v.size}
                            onChange={(e) => updateVariant(idx, { size: e.target.value.toUpperCase() })}
                            placeholder="VD: 40"
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-bold"
                          />
                        </td>
                        {canSetSellingPrice && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá niêm yết biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.sellingPrice ? formatNumberDots(v.sellingPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { sellingPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={sellingPrice ? formatNumberDots(sellingPrice) : "= giá niêm yết"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {canSeeCost && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá vốn biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.costPrice ? formatNumberDots(v.costPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { costPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={costPrice ? formatNumberDots(costPrice) : "= giá vốn"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {isEditing && (
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-600">
                            {vStock}
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-mono font-extrabold text-brand-ink">
                          {pv?.variantCode || <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            aria-label={`Xoá biến thể ${idx + 1}`}
                            disabled={isEditing && vStock > 0}
                            title={
                              isEditing && vStock > 0
                                ? `Biến thể đang có tồn (${vStock}) — không thể xoá`
                                : "Xoá dòng biến thể này"
                            }
                            onClick={() =>
                              setVariants((prev) =>
                                prev.length <= 1 ? [{ ...EMPTY_VARIANT }] : prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
  );
}

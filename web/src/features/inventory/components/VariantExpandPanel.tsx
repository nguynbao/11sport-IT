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

type Props = Pick<InventoryCtx, "colCount" | "isSales" | "isAdmin" | "priceEdits" | "variantCodeFor" | "scannedVariantCounts" | "lastScannedVariantCode" | "setLabelModalItems" | "expandProductToPrintLabelItems" | "newVariantDrafts" | "setNewVariantDrafts" | "addingVariantProdId" | "handleAddVariantToProduct"> & { p: Product; variants: ProductVariant[] };

export default function VariantExpandPanel({ p, variants, colCount, isSales, isAdmin, priceEdits, variantCodeFor, scannedVariantCounts, lastScannedVariantCode, setLabelModalItems, expandProductToPrintLabelItems, newVariantDrafts, setNewVariantDrafts, addingVariantProdId, handleAddVariantToProduct }: Props) {
  const draft = newVariantDrafts[p._id] || {
    color: "",
    size: "",
    quantity: 0,
    floor: "FLOOR_1" as const,
  };

  return (
    <tr className="bg-slate-50/90">
      <td colSpan={colCount} className="px-6 py-3.5 border-l-4 border-blue-600">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-slate-800">
              Bảng phân loại Size & Màu sắc của mã{" "}
              <span className="font-mono text-brand-ink">{p.code}</span> ({p.name})
            </div>
            <span className="text-[11px] text-slate-500">
              Mỗi thuộc tính (Màu + Size) có <b className="font-mono text-brand-ink">Mã con riêng</b> để in tem &amp; quét kiểm kho • Giá niêm yết:{" "}
              <b className="font-mono text-brand-ink">
                {formatVND(Number(priceEdits[p._id] ?? p.sellingPrice ?? 0))}
              </b>
            </span>
          </div>

          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Mã con</th>
                  <th className="py-2 px-3 text-left">Màu sắc</th>
                  <th className="py-2 px-3 text-left">Size</th>
                  <th className="py-2 px-3 text-right">Giá niêm yết</th>
                  <th className="py-2 px-3 text-right text-brand-ink">
                    🏢 Tồn Kho Tầng 1
                  </th>
                  {!isSales && (
                    <th className="py-2 px-3 text-right text-brand-ink">
                      🏬 Tồn Kho Tầng 2
                    </th>
                  )}
                  {!isSales && (
                    <th className="py-2 px-3 text-right">Tổng tồn biến thể</th>
                  )}
                  <th className="py-2 px-3 text-center">In tem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSales ? 7 : 9}
                      className="py-3 px-3 text-center text-slate-400"
                    >
                      Sản phẩm này hiện chưa chia biến thể Màu/Size riêng (Tổng tồn:{" "}
                      {p.stock} {p.unit}).
                    </td>
                  </tr>
                ) : (
                  variants.map((v, vIdx) => {
                    const childCode = variantCodeFor(
                      p.code,
                      v.color,
                      v.size
                    );
                    const vScanned =
                      scannedVariantCounts[p._id]?.[childCode] || 0;
                    return (
                      <tr
                        key={v.variantKey || vIdx}
                        className={
                          lastScannedVariantCode === childCode
                            ? "bg-blue-50"
                            : ""
                        }
                      >
                        <td className="py-2 px-3 text-slate-400">{vIdx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono font-extrabold text-brand-ink bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            {childCode}
                          </span>
                          {vScanned > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold">
                              Đã quét: {vScanned}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800">
                          <span
                            style={getColorBoxBorderStyle(
                              resolveVariantColorHexes(v.color, v.colorHexes),
                              "var(--box-bg, #f8fafc)",
                              2
                            )}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            <ColorSwatchBadge
                              hexes={v.colorHexes}
                              colorName={v.color || "Mặc định"}
                              size="xs"
                            />
                            <span>{v.color || "Mặc định"}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-brand-ink">
                          {v.size?.trim() || ""}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatVND(
                            Number(v.sellingPrice || 0) > 0
                              ? Number(v.sellingPrice)
                              : Number(priceEdits[p._id] ?? p.sellingPrice ?? 0)
                          )}
                          {Number(v.sellingPrice || 0) > 0 && (
                            <div className="text-[9px] font-sans font-bold text-amber-600">Giá riêng</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-brand-ink">
                          {v.stockFloor1}
                        </td>
                        {!isSales && (
                          <td className="py-2 px-3 text-right font-mono font-bold text-brand-ink">
                            {v.stockFloor2}
                          </td>
                        )}
                        {!isSales && (
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                            {v.stock}
                          </td>
                        )}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setLabelModalItems(
                                expandProductToPrintLabelItems(p, v)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 text-[11px] font-bold"
                          >
                            <Printer className="w-3 h-3" /> In mã {childCode}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
      </td>
    </tr>
  );
}

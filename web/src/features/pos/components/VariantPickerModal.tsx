import type { ProductVariant } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { Search, X } from "lucide-react";
import { ColorSwatchBadge, resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import { productDisplayPrice } from "../types";
import type { PosCtx } from "../hooks/usePosTab";
import { VariantColorGroup } from "./VariantColorGroup";

type VariantPickerModalProps = Pick<
  PosCtx,
  "variantPickerProduct" | "pickerSearch" | "pickerColorFilter" | "setVariantPickerProduct" | "setPickerColorFilter" | "setPickerSearch"
  | "getCartVariantQty" | "handleAddToCart" | "setLastScanBanner"
> & {
};

export function VariantPickerModal({
  variantPickerProduct,
  pickerSearch,
  pickerColorFilter,
  setVariantPickerProduct,
  setPickerColorFilter,
  setPickerSearch,
  getCartVariantQty,
  handleAddToCart,
  setLastScanBanner,
}: VariantPickerModalProps) {
  return (
    <>
      {variantPickerProduct && (() => {
        const allVars = variantPickerProduct.variants || [];
        const colorSet = new Map<string, number>();
        for (const v of allVars) {
          const c = (v.color || "").trim() || "Mặc định";
          const vF1 = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
          colorSet.set(c, (colorSet.get(c) || 0) + vF1);
        }
        const colorTabs = Array.from(colorSet.entries());
        const qNorm = pickerSearch.trim().toLowerCase();
        const filteredVars = allVars
          .map((v, originalIdx) => ({ v, originalIdx }))
          .filter(({ v }) => {
            const c = (v.color || "").trim() || "Mặc định";
            if (pickerColorFilter !== "ALL" && c !== pickerColorFilter) return false;
            if (!qNorm) return true;
            const childCode =
              v.variantCode ||
              resolveVariantCode(variantPickerProduct, variantPickerProduct.code, v.color, v.size);
            const text = `${c} ${v.size || ""} ${childCode}`.toLowerCase();
            return text.includes(qNorm);
          });

        // Gom nhóm theo Màu sắc để không lặp lại tên màu ở từng ô và giúp Size luôn hiển thị to, rõ
        const groupedModalColors = (() => {
          const map = new Map<string, { v: ProductVariant; originalIdx: number }[]>();
          for (const item of filteredVars) {
            const c = (item.v.color || "").trim() || "Mặc định";
            const list = map.get(c) || [];
            list.push(item);
            map.set(c, list);
          }
          return Array.from(map.entries()).map(([colorName, items]) => {
            const sortedItems = [...items].sort((a, b) => {
              const sa = parseFloat(String(a.v.size || "").replace(",", "."));
              const sb = parseFloat(String(b.v.size || "").replace(",", "."));
              if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
              return String(a.v.size || "").localeCompare(String(b.v.size || ""), "vi");
            });
            const totalStock = sortedItems.reduce(
              (sum, it) => sum + Math.max(0, Number(it.v.stockFloor1 ?? it.v.stock) || 0),
              0
            );
            const explicitHexes = sortedItems.find(
              (it) => Array.isArray(it.v.colorHexes) && it.v.colorHexes.length > 0
            )?.v.colorHexes;
            const colorHexes = resolveVariantColorHexes(colorName, explicitHexes);
            return { colorName, items: sortedItems, totalStock, colorHexes };
          });
        })();

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
              <div className="px-5 py-3.5 bg-blue-600 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-blue-100 font-bold">
                      Mã SP chung: {variantPickerProduct.code}
                    </span>
                    <span className="text-[11px] font-mono bg-white/15 px-2 py-0.5 rounded text-white font-semibold">
                      {allVars.length} mã con · {colorTabs.length} màu
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg mt-0.5 break-words">
                    {variantPickerProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantPickerProduct(null)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                  <span>
                    Bấm trực tiếp vào <strong>ô Size</strong> bên dưới từng màu để thêm vào giỏ:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-base">
                    Giá: {formatVND(productDisplayPrice(variantPickerProduct).price)}
                    {productDisplayPrice(variantPickerProduct).hasVariantPrices ? " (theo biến thể)" : ""}
                  </span>
                </div>

                {/* Bộ lọc nhanh theo Màu sắc + Ô tìm kiếm Size/Mã con */}
                {(colorTabs.length > 1 || allVars.length > 6) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPickerColorFilter("ALL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${pickerColorFilter === "ALL"
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                          }`}
                      >
                        Tất cả màu ({allVars.length})
                      </button>
                      {colorTabs.map(([cName, cStock]) => {
                        const explicitHexes = allVars.find(
                          (v) =>
                            ((v.color || "").trim() || "Mặc định") === cName &&
                            Array.isArray(v.colorHexes) &&
                            v.colorHexes.length > 0
                        )?.colorHexes;
                        const cHexes = resolveVariantColorHexes(cName, explicitHexes);
                        const isSelectedTab = pickerColorFilter === cName;
                        return (
                          <button
                            key={cName}
                            type="button"
                            onClick={() => setPickerColorFilter(cName)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${isSelectedTab
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : cStock > 0
                                ? "bg-white text-slate-900 border-slate-300 hover:bg-blue-50 hover:border-blue-400"
                                : "bg-white text-slate-400 border-slate-200 opacity-70"
                              }`}
                          >
                            <ColorSwatchBadge hexes={cHexes} colorName={cName} size="xs" />
                            <span>{cName}</span>
                            <span
                              className={`font-mono text-xs px-1.5 py-0.2 rounded font-black ${isSelectedTab
                                ? "bg-white/20 text-white"
                                : cStock > 0
                                  ? "bg-slate-100 text-slate-900"
                                  : "bg-slate-100 text-slate-400"
                                }`}
                            >
                              {cStock}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative w-full sm:w-52 shrink-0">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Lọc size, màu, mã con..."
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5">
                {groupedModalColors.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Không có phân loại nào khớp bộ lọc.
                  </div>
                ) : (
                  groupedModalColors.map(({ colorName, items, totalStock, colorHexes }) => {
                    return (
                      <VariantColorGroup
                        key={colorName}
                        colorName={colorName}
                        totalStock={totalStock}
                        colorHexes={colorHexes}
                        items={items}
                        variantPickerProduct={variantPickerProduct}
                        getCartVariantQty={getCartVariantQty}
                        handleAddToCart={handleAddToCart}
                        setLastScanBanner={setLastScanBanner}
                        setVariantPickerProduct={setVariantPickerProduct}
                      />
                    );
                  })
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setVariantPickerProduct(null)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

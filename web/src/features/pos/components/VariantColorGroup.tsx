import type { Product, ProductVariant } from "@/shared/types";
import { formatVND, formatVariantLabel } from "@/shared/utils/format";
import { resolveVariantCode, variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import { playScannerBeep } from "@/shared/lib/barcodeScanner";
import { Plus } from "lucide-react";
import { ColorSwatchBadge } from "@/shared/ui/ColorSwatchPicker";
import type { PosCtx } from "../hooks/usePosTab";

type VariantColorGroupProps = Pick<
  PosCtx,
  "getCartVariantQty" | "handleAddToCart" | "setLastScanBanner"
  | "setVariantPickerProduct"
> & {
  colorName: string;
  totalStock: number;
  colorHexes: string[];
  items: { v: ProductVariant; originalIdx: number; }[];
  variantPickerProduct: Product;
};

export function VariantColorGroup({
  colorName,
  totalStock,
  colorHexes,
  items,
  variantPickerProduct,
  getCartVariantQty,
  handleAddToCart,
  setLastScanBanner,
  setVariantPickerProduct,
}: VariantColorGroupProps) {
  return (
    <div
                        key={colorName}
                        className={`rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 ${
                          totalStock <= 0 ? "opacity-55" : ""
                        }`}
                      >
                        {/* Tiêu đề Nhóm Màu */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <ColorSwatchBadge hexes={colorHexes} colorName={colorName} size="sm" />
                            <span className="font-extrabold text-base text-slate-900 break-words">
                              {colorName}
                            </span>
                            {items.some((x) => Boolean(x.v.size?.trim())) && (
                              <span className="text-xs font-medium text-slate-500 shrink-0">
                                ({items.filter((x) => Boolean(x.v.size?.trim())).length} size)
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-mono font-black text-slate-900 px-2.5 py-1 rounded-lg bg-slate-100 shrink-0 whitespace-nowrap">
                            Tồn T1: {totalStock} {variantPickerProduct.unit}
                          </span>
                        </div>

                        {/* Lưới các ô chọn Size rộng rãi, không bị rớt chữ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {items.map(({ v, originalIdx }) => {
                            const vFloor1 = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                            const inCartQty = getCartVariantQty(
                              variantPickerProduct._id,
                              v.color,
                              v.size
                            );
                            const canPick = vFloor1 > 0 && inCartQty < vFloor1;
                            const childCode =
                              v.variantCode ||
                              resolveVariantCode(variantPickerProduct, variantPickerProduct.code,
                                v.color,
                                v.size
                              );
                            const displayPrice = variantEffectiveSellingPrice(variantPickerProduct, v);

                            return (
                              <button
                                key={`${v.color}-${v.size}-${originalIdx}`}
                                type="button"
                                disabled={!canPick}
                                title={`Mã con: ${childCode} • ${formatVariantLabel(v.color, v.size)}`}
                                onClick={() => {
                                  const added = handleAddToCart(variantPickerProduct, v.color, v.size);
                                  if (added) {
                                    playScannerBeep("success");
                                    const vLabel = formatVariantLabel(v.color, v.size);
                                    setLastScanBanner({
                                      type: "success",
                                      code: variantPickerProduct.code,
                                      message: `Đã chọn ${vLabel} của "${variantPickerProduct.name}" (+1 vào giỏ hàng)`,
                                      time: new Date().toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                      }),
                                    });
                                    setVariantPickerProduct(null);
                                  }
                                }}
                                className={`relative p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                                  canPick
                                    ? inCartQty > 0
                                      ? "border-blue-600 bg-blue-50/60 hover:bg-blue-100/80 hover:shadow-md cursor-pointer shadow-2xs"
                                      : "border-slate-200 hover:border-blue-600 hover:bg-blue-50/80 hover:shadow-md bg-white cursor-pointer shadow-2xs"
                                    : "border-slate-200 bg-slate-100/70 opacity-55 cursor-not-allowed"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  {Boolean(v.size?.trim()) ? (
                                    <div className="flex items-baseline gap-1.5 min-w-0">
                                      <span className="text-[11px] font-bold uppercase text-slate-500 shrink-0">
                                        Size
                                      </span>
                                      <span
                                        className={`font-mono text-xl font-black leading-none ${
                                          vFloor1 <= 0
                                            ? "text-slate-400 line-through"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {v.size.trim()}
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      className={`text-base font-black leading-none ${
                                        vFloor1 <= 0
                                          ? "text-slate-400 line-through"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {v.color || colorName}
                                    </span>
                                  )}

                                  <span
                                    className={`text-xs font-mono font-bold whitespace-nowrap shrink-0 ${
                                      vFloor1 > 0 ? "text-slate-900" : "text-slate-400"
                                    }`}
                                  >
                                    {vFloor1 > 0
                                      ? `Còn ${vFloor1} ${variantPickerProduct.unit}`
                                      : "Hết hàng"}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                  <span className="text-sm font-mono font-black text-slate-900 whitespace-nowrap">
                                    {formatVND(displayPrice)}
                                  </span>

                                  {inCartQty > 0 ? (
                                    <span className="text-xs font-mono font-bold text-white bg-blue-600 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                                      Đã chọn: {inCartQty}
                                    </span>
                                  ) : canPick ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shrink-0 whitespace-nowrap">
                                      <Plus className="w-3 h-3" /> Chọn
                                    </span>
                                  ) : null}
                                </div>

                                <div className="font-mono text-[10px] text-slate-500 truncate">
                                  {childCode}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
  );
}

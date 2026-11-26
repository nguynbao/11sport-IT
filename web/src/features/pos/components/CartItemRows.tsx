import { formatNumberDots, formatVariantLabel } from "@/shared/utils/format";
import { resolveVariantCode, findVariantByColorSize } from "@/shared/utils/productCode";
import { Plus, Minus, Trash2, X, MoreVertical } from "lucide-react";
import { ColorSwatchBadge, getColorBoxBorderStyle, resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import { getCartLineKey } from "../types";
import type { PosCtx } from "../hooks/usePosTab";
import { CartItemDiscountPanel } from "./CartItemDiscountPanel";

type CartItemRowsProps = Pick<
  PosCtx,
  "cart" | "getVariantFloor1Stock" | "getItemPricing" | "expandedDiscountKey"
  | "handleChangeQty" | "getDirectFloor1Stock" | "handleChangeItemDesiredPrice"
  | "setExpandedDiscountKey" | "handleChangeItemDiscount"
>;

export function CartItemRows({
  cart,
  getVariantFloor1Stock,
  getItemPricing,
  expandedDiscountKey,
  handleChangeQty,
  getDirectFloor1Stock,
  handleChangeItemDesiredPrice,
  setExpandedDiscountKey,
  handleChangeItemDiscount,
}: CartItemRowsProps) {
  return (
    <>
      {cart.map((item, idx) => {
            const floor1Max = getVariantFloor1Stock(
              item.product,
              item.color,
              item.size
            );
            const pricing = getItemPricing(item);
            const vLabel = formatVariantLabel(item.color, item.size);
            const matchedVar = findVariantByColorSize(
              item.product,
              item.color,
              item.size
            );
            const itemColorHexes = item.color
              ? resolveVariantColorHexes(item.color, matchedVar?.colorHexes)
              : [];
            const lineKey = getCartLineKey(
              item.product._id,
              item.color,
              item.size
            );
            const displayCode =
              resolveVariantCode(
                item.product,
                item.product.code,
                item.color,
                item.size
              ) || item.product.code;
            const isDiscountOpen = expandedDiscountKey === lineKey;

            return (
              <div
                key={lineKey}
                className="bg-white rounded-xl shadow-xs border border-slate-200/90 px-3 py-2 transition hover:border-blue-400"
              >
                {/* Bố cục 1 dòng gọn gàng cho cả Bán nhanh & Bán thường */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 text-xs sm:text-sm">
                  <span className="w-5 text-center font-bold text-slate-700 shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeQty(
                        item.product._id,
                        0,
                        item.color,
                        item.size
                      )
                    }
                    title="Xóa sản phẩm khỏi đơn"
                    className="text-slate-400 hover:text-red-600 transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs text-slate-600 w-24 sm:w-28 truncate shrink-0">
                    {displayCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap leading-snug">
                      <span className="truncate">{item.product.name}</span>
                      {vLabel && (
                        <span
                          style={
                            itemColorHexes.length > 0
                              ? getColorBoxBorderStyle(
                                  itemColorHexes,
                                  "var(--box-bg, #f8fafc)",
                                  2
                                )
                              : undefined
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 shrink-0"
                        >
                          {itemColorHexes.length > 0 && (
                            <ColorSwatchBadge
                              hexes={itemColorHexes}
                              colorName={item.color}
                              size="xs"
                            />
                          )}
                          <span>{vLabel}</span>
                        </span>
                      )}
                      {item.autoPromoName && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-brand-ink border border-blue-200 shrink-0">
                          🎉 {item.autoPromoName}
                        </span>
                      )}
                    </div>
                    {item.quantity > getDirectFloor1Stock(item.product) &&
                      (item.product.packSize || 0) > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                          ⚡ Tự tách{" "}
                          {Math.ceil(
                            (item.quantity -
                              getDirectFloor1Stock(item.product)) /
                              (item.product.packSize || 1)
                          )}{" "}
                          {item.product.parentSetUnit || "Bộ"} khi TT
                        </div>
                      )}
                  </div>

                  {/* Cụm Số lượng gọn gàng: [-] [Input gạch chân đỏ] [+] */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeQty(
                          item.product._id,
                          item.quantity - 1,
                          item.color,
                          item.size
                        )
                      }
                      className="w-6 h-6 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={floor1Max}
                      value={item.quantity}
                      onChange={(e) =>
                        handleChangeQty(
                          item.product._id,
                          Math.max(1, Number(e.target.value)),
                          item.color,
                          item.size
                        )
                      }
                      className="w-10 text-center font-mono font-bold text-slate-900 border-b-2 border-red-500 focus:border-blue-600 focus:outline-none py-0.5 bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeQty(
                          item.product._id,
                          item.quantity + 1,
                          item.color,
                          item.size
                        )
                      }
                      title="Tăng số lượng (+1)"
                      className="w-6 h-6 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Đơn giá */}
                  <div className="w-24 sm:w-28 shrink-0 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        item.discountInputMode === "PRICE" &&
                        item.customPriceText !== undefined
                          ? item.customPriceText
                          : formatNumberDots(pricing.unitPrice)
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        handleChangeItemDesiredPrice(
                          item.product._id,
                          e.target.value,
                          item.color,
                          item.size
                        )
                      }
                      title="Nhập trực tiếp đơn giá muốn bán cho SP này"
                      className="w-full text-right font-mono font-semibold text-slate-800 border-b border-slate-300 focus:border-blue-600 focus:outline-none py-0.5 bg-transparent"
                    />
                    {pricing.discountPerUnit > 0 && (
                      <div className="text-[10px] font-mono text-rose-600">
                        Gốc:{" "}
                        <span className="line-through">
                          {formatNumberDots(pricing.originalUnitPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thành tiền */}
                  <div className="w-20 sm:w-24 text-right font-mono font-extrabold text-slate-900 shrink-0">
                    {formatNumberDots(pricing.lineTotal)}
                  </div>

                  {/* Nút ⋮ mở tuỳ chọn giảm giá SP */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDiscountKey((prev) =>
                        prev === lineKey ? null : lineKey
                      )
                    }
                    title="Tùy chọn giảm giá theo % hoặc số tiền cho sản phẩm này"
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition shrink-0 ${
                      isDiscountOpen || pricing.discountAmount > 0
                        ? "bg-blue-50 text-brand-ink"
                        : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Ngăn kéo chỉnh Giảm giá SP theo % / VND khi bấm vào dấu ⋮ */}
                <CartItemDiscountPanel isDiscountOpen={isDiscountOpen} item={item} handleChangeItemDiscount={handleChangeItemDiscount} pricing={pricing} />
              </div>
            );
          })}
    </>
  );
}

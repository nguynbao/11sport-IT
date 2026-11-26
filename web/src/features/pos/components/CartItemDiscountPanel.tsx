import type { DiscountType } from "@/shared/types";
import { formatVND, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { Tag } from "lucide-react";
import type { CartItem } from "../types";
import type { PosCtx } from "../hooks/usePosTab";

type CartItemDiscountPanelProps = Pick<
  PosCtx,
  "handleChangeItemDiscount"
> & {
  isDiscountOpen: boolean;
  item: CartItem;
  pricing: { originalUnitPrice: number; discountPerUnit: number; unitPrice: number; discountAmount: number; lineTotal: number; };
};

export function CartItemDiscountPanel({
  isDiscountOpen,
  item,
  handleChangeItemDiscount,
  pricing,
}: CartItemDiscountPanelProps) {
  return (
    <>
      {isDiscountOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/80 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-bold text-slate-700">
                        Giảm giá dòng SP:
                      </span>
                      <select
                        value={item.discountType}
                        onChange={(e) => {
                          const val = e.target.value as DiscountType;
                          handleChangeItemDiscount(
                            item.product._id,
                            val,
                            0,
                            item.color,
                            item.size,
                            val as "NONE" | "PERCENT" | "AMOUNT",
                            ""
                          );
                        }}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="NONE">Không giảm</option>
                        <option value="PERCENT">Theo %</option>
                        <option value="AMOUNT">Theo số tiền (VND/SP)</option>
                      </select>

                      {item.discountType === "PERCENT" && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discountValue || ""}
                            onChange={(e) =>
                              handleChangeItemDiscount(
                                item.product._id,
                                "PERCENT",
                                Number(e.target.value),
                                item.color,
                                item.size,
                                "PERCENT"
                              )
                            }
                            placeholder="0"
                            className="w-16 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                          />
                          <span className="font-bold text-rose-700">%</span>
                        </div>
                      )}

                      {item.discountType === "AMOUNT" &&
                        item.discountInputMode !== "PRICE" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                item.discountValue > 0
                                  ? formatNumberDots(item.discountValue)
                                  : ""
                              }
                              onChange={(e) =>
                                handleChangeItemDiscount(
                                  item.product._id,
                                  "AMOUNT",
                                  parseNumberDots(e.target.value),
                                  item.color,
                                  item.size,
                                  "AMOUNT"
                                )
                              }
                              placeholder="Số tiền giảm"
                              className="w-28 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                            />
                            <span className="font-bold text-rose-700">đ/SP</span>
                          </div>
                        )}
                    </div>

                    {pricing.discountAmount > 0 && (
                      <span className="font-mono font-bold text-rose-600">
                        Đã giảm: −{formatVND(pricing.discountAmount)}
                      </span>
                    )}
                  </div>
                )}
    </>
  );
}

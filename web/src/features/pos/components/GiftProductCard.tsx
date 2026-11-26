import type { Product } from "@/shared/types";
import { formatVND } from "@/shared/utils/format";
import { Plus, Minus, Gift, Pin } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";

type GiftProductCardProps = Pick<
  PosCtx,
  "togglePinGiftProduct" | "handleChangeGiftQty" | "handleAddGiftProduct"
> & {
  p: Product;
  isPinned: boolean;
  catName: string;
  remainingForGift: number;
  inGiftCart: number;
};

export function GiftProductCard({
  p,
  isPinned,
  catName,
  remainingForGift,
  togglePinGiftProduct,
  inGiftCart,
  handleChangeGiftQty,
  handleAddGiftProduct,
}: GiftProductCardProps) {
  return (
    <div
                        key={p._id}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${isPinned
                          ? "border-amber-400 bg-amber-50/40 shadow-xs"
                          : "border-slate-200 bg-white hover:border-amber-400"
                          }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                                {catName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                                Tồn T1: {remainingForGift} {p.unit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePinGiftProduct(p._id)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 border transition shrink-0 ${isPinned
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                            >
                              <Pin className="w-3 h-3" />
                              {isPinned ? "Đã ghim" : "Ghim"}
                            </button>
                          </div>

                          <div className="font-semibold text-slate-900 text-xs sm:text-sm break-words">
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            Mã: {p.code}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="font-mono text-xs">
                            <span className="line-through text-slate-400 mr-1.5">
                              {formatVND(p.sellingPrice)}
                            </span>
                            <span className="font-extrabold text-amber-700">0 VND</span>
                          </div>

                          {inGiftCart > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleChangeGiftQty(p._id, inGiftCart - 1)}
                                className="w-7 h-7 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center font-bold"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 font-mono font-extrabold text-xs text-amber-800">
                                Đang tặng: {inGiftCart}
                              </span>
                              <button
                                type="button"
                                disabled={inGiftCart >= remainingForGift}
                                onClick={() => handleAddGiftProduct(p)}
                                className="w-7 h-7 rounded bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white flex items-center justify-center font-bold"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={remainingForGift <= 0}
                              onClick={() => handleAddGiftProduct(p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${remainingForGift > 0
                                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                            >
                              <Gift className="w-3.5 h-3.5" />
                              Chọn tặng
                            </button>
                          )}
                        </div>
                      </div>
  );
}

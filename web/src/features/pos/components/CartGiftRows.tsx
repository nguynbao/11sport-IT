import { Plus, Minus, Trash2 } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";

type CartGiftRowsProps = Pick<
  PosCtx,
  "giftCart" | "getFloor1Stock" | "getCartQty" | "handleChangeGiftQty"
>;

export function CartGiftRows({
  giftCart,
  getFloor1Stock,
  getCartQty,
  handleChangeGiftQty,
}: CartGiftRowsProps) {
  return (
    <>
      {giftCart.map((gItem, gIdx) => {
        const floor1Max = Math.max(
          0,
          getFloor1Stock(gItem.product) - getCartQty(gItem.product._id)
        );
        const promoBadge = (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
            {gItem.isAutoPromo ? `🎁 ${gItem.promoName || "CTKM"}` : "🎁 Hàng tặng (0đ)"}
          </span>
        );
        const qtyControls = (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleChangeGiftQty(gItem.product._id, gItem.quantity - 1)}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded hover:bg-amber-100 text-amber-800 flex items-center justify-center"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={floor1Max}
              value={gItem.quantity}
              onChange={(e) =>
                handleChangeGiftQty(gItem.product._id, Math.max(1, Number(e.target.value)))
              }
              className="w-12 text-center font-mono font-bold text-amber-950 border-b-2 border-amber-500 bg-transparent py-0.5"
            />
            <button
              type="button"
              onClick={() => handleChangeGiftQty(gItem.product._id, gItem.quantity + 1)}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded hover:bg-amber-100 text-amber-800 flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        );

        return (
          <div
            key={`gift_${gItem.product._id}`}
            className="bg-amber-50/90 rounded-xl shadow-xs border border-amber-200 px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm"
          >
            {/* Mobile (< sm) */}
            <div className="sm:hidden space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-amber-800 shrink-0">G{gIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleChangeGiftQty(gItem.product._id, 0)}
                    className="text-amber-600 hover:text-red-600 transition shrink-0"
                    title="Xóa hàng tặng"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs font-semibold text-amber-900 truncate">
                    {gItem.product.code}
                  </span>
                </div>
                {promoBadge}
              </div>
              <div className="font-semibold text-slate-900 text-[13px] leading-snug break-words">
                {gItem.product.name}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-amber-200">
                {qtyControls}
                <span className="font-mono font-extrabold text-amber-700">0đ</span>
              </div>
            </div>

            {/* Desktop (>= sm) */}
            <div className="hidden sm:flex flex-nowrap items-center gap-3">
              <span className="w-5 text-center font-bold text-amber-800 shrink-0">
                G{gIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => handleChangeGiftQty(gItem.product._id, 0)}
                className="text-amber-600 hover:text-red-600 transition shrink-0"
                title="Xóa hàng tặng"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs text-amber-900 w-32 truncate shrink-0">
                {gItem.product.code}
              </span>
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">{gItem.product.name}</span>
                {promoBadge}
              </div>
              {qtyControls}
              <div className="w-24 text-right font-mono font-extrabold text-amber-700 shrink-0">
                0
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

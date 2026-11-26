import { ScanLine } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";
import { CartItemRows } from "./CartItemRows";
import { CartGiftRows } from "./CartGiftRows";

type CartListProps = Pick<
  PosCtx,
  "cart" | "giftCart" | "liveDrafts" | "activeDraftId" | "posSubView"
  | "getVariantFloor1Stock" | "getItemPricing" | "expandedDiscountKey"
  | "handleChangeQty" | "getDirectFloor1Stock" | "handleChangeItemDesiredPrice"
  | "setExpandedDiscountKey" | "handleChangeItemDiscount" | "getFloor1Stock"
  | "getCartQty" | "handleChangeGiftQty"
>;

export function CartList({
  cart,
  giftCart,
  liveDrafts,
  activeDraftId,
  posSubView,
  getVariantFloor1Stock,
  getItemPricing,
  expandedDiscountKey,
  handleChangeQty,
  getDirectFloor1Stock,
  handleChangeItemDesiredPrice,
  setExpandedDiscountKey,
  handleChangeItemDiscount,
  getFloor1Stock,
  getCartQty,
  handleChangeGiftQty,
}: CartListProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
      {cart.length === 0 && giftCart.length === 0 ? (
        <div className="flex-1 bg-white/70 dark:bg-[#363636] rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-ink flex items-center justify-center">
            <ScanLine className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <div className="text-sm font-bold text-slate-700">
              Chưa có sản phẩm nào trong Hóa đơn{" "}
              {liveDrafts.find((d) => d.id === activeDraftId)?.seq ?? 1}
            </div>
            <p className="text-xs text-slate-500">
              {posSubView === "CATALOG"
                ? "Bấm chọn sản phẩm ở khung danh mục bên phải, quét mã vạch hoặc tìm kiếm ở thanh trên cùng."
                : "Quét mã vạch sản phẩm, gõ tìm kiếm ở thanh trên cùng hoặc chuyển sang chế độ Bán thường để chọn hàng hóa."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <CartItemRows
            cart={cart}
            getVariantFloor1Stock={getVariantFloor1Stock}
            getItemPricing={getItemPricing}
            expandedDiscountKey={expandedDiscountKey}
            handleChangeQty={handleChangeQty}
            getDirectFloor1Stock={getDirectFloor1Stock}
            handleChangeItemDesiredPrice={handleChangeItemDesiredPrice}
            setExpandedDiscountKey={setExpandedDiscountKey}
            handleChangeItemDiscount={handleChangeItemDiscount}
          />

          {/* Danh sách Hàng tặng kèm (nếu có) */}
          <CartGiftRows giftCart={giftCart} getFloor1Stock={getFloor1Stock} getCartQty={getCartQty} handleChangeGiftQty={handleChangeGiftQty} />
        </>
      )}
    </div>
  );
}

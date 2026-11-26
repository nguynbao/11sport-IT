import { Search, Gift, Pin, X } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";
import { GiftProductCard } from "./GiftProductCard";

type GiftModalProps = Pick<
  PosCtx,
  "showGiftModal" | "setShowGiftModal" | "giftSearch" | "setGiftSearch"
  | "giftCategoryId" | "setGiftCategoryId" | "floor1Products" | "pinnedFloor1Count"
  | "categories" | "getCategoryId" | "popupGiftProducts" | "pinnedGiftIds"
  | "getFloor1Stock" | "getCartQty" | "getGiftQty" | "getCategoryName"
  | "togglePinGiftProduct" | "handleChangeGiftQty" | "handleAddGiftProduct"
  | "giftUnitsCount" | "giftCart"
> & {
};

export function GiftModal({
  showGiftModal,
  setShowGiftModal,
  giftSearch,
  setGiftSearch,
  giftCategoryId,
  setGiftCategoryId,
  floor1Products,
  pinnedFloor1Count,
  categories,
  getCategoryId,
  popupGiftProducts,
  pinnedGiftIds,
  getFloor1Stock,
  getCartQty,
  getGiftQty,
  getCategoryName,
  togglePinGiftProduct,
  handleChangeGiftQty,
  handleAddGiftProduct,
  giftUnitsCount,
  giftCart,
}: GiftModalProps) {
  return (
    <>
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 sm:px-6 bg-amber-600 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Chọn Sản Phẩm Tặng Kèm (Kho Tầng 1)
                  </h3>
                  <p className="text-[11px] text-amber-100">
                    Hàng tặng tính giá 0 VND · Hiển thị trên Bill · Trừ trực tiếp tồn Kho Tầng 1
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={giftSearch}
                  onChange={(e) => setGiftSearch(e.target.value)}
                  placeholder="Tìm tên hoặc mã sản phẩm tặng..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-5">
                <select
                  value={giftCategoryId}
                  onChange={(e) => setGiftCategoryId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 focus:border-amber-600 focus:outline-none"
                >
                  <option value="">
                    📂 Tất cả sản phẩm · Ưu tiên đã ghim ({floor1Products.length})
                  </option>
                  <option value="PINNED">
                    📌 Chỉ sản phẩm đã ghim ({pinnedFloor1Count})
                  </option>
                  {categories.map((cat) => {
                    const count = floor1Products.filter(
                      (p) => getCategoryId(p) === cat._id
                    ).length;
                    return (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
              {popupGiftProducts.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <Pin className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">
                    {giftCategoryId === "PINNED" && !giftSearch.trim()
                      ? "Chưa có sản phẩm tặng nào được ghim"
                      : "Không tìm thấy sản phẩm phù hợp trong Kho Tầng 1"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {popupGiftProducts.map((p) => {
                    const isPinned = pinnedGiftIds.includes(p._id);
                    const floor1Stock = getFloor1Stock(p);
                    const inSaleCart = getCartQty(p._id);
                    const inGiftCart = getGiftQty(p._id);
                    const remainingForGift = Math.max(0, floor1Stock - inSaleCart);
                    const catName = getCategoryName(p);

                    return (
                      <GiftProductCard
                        key={p._id}
                        p={p}
                        isPinned={isPinned}
                        catName={catName}
                        remainingForGift={remainingForGift}
                        togglePinGiftProduct={togglePinGiftProduct}
                        inGiftCart={inGiftCart}
                        handleChangeGiftQty={handleChangeGiftQty}
                        handleAddGiftProduct={handleAddGiftProduct}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Đã chọn tặng:{" "}
                <strong className="text-amber-700 font-mono">
                  {giftUnitsCount} sản phẩm
                </strong>{" "}
                ({giftCart.length} mặt hàng · 0 VND)
              </div>
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition"
              >
                Xong / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { CartList } from "./CartList";
import { formatNumberDots } from "@/shared/utils/format";
import { Gift, Sparkles, Pencil } from "lucide-react";
import type { Order } from "@/shared/types";
import type { PosCtx } from "../hooks/usePosTab";
import { SavedDraftsPanel } from "./SavedDraftsPanel";

type PosLeftColumnProps = Pick<
  PosCtx,
  "posSubView" | "appliedPromosSummary" | "cart" | "giftCart" | "liveDrafts"
  | "activeDraftId" | "getVariantFloor1Stock" | "getItemPricing" | "expandedDiscountKey"
  | "handleChangeQty" | "getDirectFloor1Stock" | "handleChangeItemDesiredPrice"
  | "setExpandedDiscountKey" | "handleChangeItemDiscount" | "getFloor1Stock"
  | "getCartQty" | "handleChangeGiftQty" | "savedDraftOrders" | "setPosSubView"
  | "loadingSavedDrafts" | "editingServerDraftOrder" | "handleLoadServerDraftToPos"
  | "handleQuickConfirmServerDraft" | "handleDeleteServerDraft" | "note" | "setNote"
  | "setGiftSearch" | "setGiftCategoryId" | "setShowGiftModal" | "giftUnitsCount"
  | "subtotal"
> & {
  onOpenInvoice: (order: Order) => void;
  totalCartUnits: number;
};

export function PosLeftColumn({
  posSubView,
  appliedPromosSummary,
  cart,
  giftCart,
  liveDrafts,
  activeDraftId,
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
  savedDraftOrders,
  setPosSubView,
  loadingSavedDrafts,
  editingServerDraftOrder,
  handleLoadServerDraftToPos,
  handleQuickConfirmServerDraft,
  onOpenInvoice,
  handleDeleteServerDraft,
  note,
  setNote,
  setGiftSearch,
  setGiftCategoryId,
  setShowGiftModal,
  giftUnitsCount,
  totalCartUnits,
  subtotal,
}: PosLeftColumnProps) {
  return (
    <div
              className={`${
                posSubView === "CATALOG" ? "lg:col-span-7" : "lg:col-span-8"
              } flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden`}
            >
              <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                {/* Banner Chương trình khuyến mãi tự động áp dụng */}
                {appliedPromosSummary.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-ink shrink-0" />
                      <span>
                        🎉 Khuyến mãi tự động ({appliedPromosSummary.length}):
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {appliedPromosSummary.map((ap) => (
                        <span
                          key={ap._id}
                          className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-blue-200 font-bold text-brand-ink"
                        >
                          {ap.name}
                          {ap.multiplier > 1 ? ` (×${ap.multiplier})` : ""}:{" "}
                          {ap.details.join(" · ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ở cả Bán nhanh (FAST) và Bán thường (CATALOG), cột trái đều hiển thị danh sách sản phẩm trong đơn */}
                {(posSubView === "FAST" || posSubView === "CATALOG") &&
                  <CartList cart={cart} giftCart={giftCart} liveDrafts={liveDrafts} activeDraftId={activeDraftId} posSubView={posSubView} getVariantFloor1Stock={getVariantFloor1Stock} getItemPricing={getItemPricing} expandedDiscountKey={expandedDiscountKey} handleChangeQty={handleChangeQty} getDirectFloor1Stock={getDirectFloor1Stock} handleChangeItemDesiredPrice={handleChangeItemDesiredPrice} setExpandedDiscountKey={setExpandedDiscountKey} handleChangeItemDiscount={handleChangeItemDiscount} getFloor1Stock={getFloor1Stock} getCartQty={getCartQty} handleChangeGiftQty={handleChangeGiftQty} />}

                {/* CHẾ ĐỘ 3: DANH SÁCH HÓA ĐƠN NHÁP ĐÃ LƯU TRÊN HỆ THỐNG */}
                <SavedDraftsPanel
                  posSubView={posSubView}
                  savedDraftOrders={savedDraftOrders}
                  setPosSubView={setPosSubView}
                  loadingSavedDrafts={loadingSavedDrafts}
                  editingServerDraftOrder={editingServerDraftOrder}
                  liveDrafts={liveDrafts}
                  handleLoadServerDraftToPos={handleLoadServerDraftToPos}
                  handleQuickConfirmServerDraft={handleQuickConfirmServerDraft}
                  onOpenInvoice={onOpenInvoice}
                  handleDeleteServerDraft={handleDeleteServerDraft}
                />
              </div>

              {/* Thanh Ghi chú đơn hàng + Nút Tặng SP dưới đáy cột trái */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-[160px]">
                  <Pencil className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú đơn hàng"
                    className="w-full text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setGiftSearch("");
                      setGiftCategoryId("");
                      setShowGiftModal(true);
                    }}
                    title="Chọn sản phẩm tặng kèm (0đ)"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ Tặng SP</span>
                    {giftUnitsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[10px] font-extrabold">
                        {giftUnitsCount}
                      </span>
                    )}
                  </button>

                  {posSubView === "CATALOG" && (
                    <div className="flex items-center gap-4 text-xs sm:text-sm shrink-0 pl-3 border-l border-slate-200">
                      <span className="text-slate-700 font-medium">
                        Tổng tiền hàng
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {totalCartUnits}
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 text-sm sm:text-base">
                        {formatNumberDots(subtotal)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}

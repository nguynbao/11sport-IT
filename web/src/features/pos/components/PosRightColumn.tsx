import { CheckoutForm } from "./CheckoutForm";
import type { Product } from "@/shared/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Order } from "@/shared/types";
import type { PosCtx } from "../hooks/usePosTab";
import { CatalogToolbar } from "./CatalogToolbar";
import { CatalogGrid } from "./CatalogGrid";

type PosRightColumnProps = Pick<
  PosCtx,
  "posSubView" | "customerPhone" | "phoneTypedByUserRef" | "setCustomerPhone"
  | "setIsExistingCustomer" | "setCustomerOrders" | "setCustomerDebtSummary"
  | "setShowCheckoutDrawer" | "setCatalogViewMode" | "setCatalogPage"
  | "catalogViewMode" | "setShowCategoryFilterPopover" | "selectedCategoryId"
  | "showCategoryFilterPopover" | "setSortBy" | "customerName" | "setCustomerName"
  | "lookingUp" | "isExistingCustomer" | "customerOrders" | "setSelectedCategoryId"
  | "floor1Products" | "categories" | "getCategoryId" | "loadingProducts"
  | "getFloor1Stock" | "getCartQty" | "handleSelectProductForPos"
  | "getDirectFloor1Stock" | "getCategoryName" | "getProductPromotions" | "expandedCardVarIds" | "getCartVariantQty" | "handleAddToCart"
  | "toggleExpandCardVariants" | "setVariantPickerProduct" | "cart" | "giftCart"
  | "handleCreateOrder" | "nowClock" | "errorMsg" | "successMsg"
  | "editingServerDraftOrder" | "removeDraft" | "activeDraftId" | "customerDebtSummary"
  | "rawSubtotal" | "itemDiscountTotal" | "setBillDiscountType"
  | "setBillDiscountInputMode" | "setBillCustomPriceText" | "setIsManualBillDiscount"
  | "billDiscountInputMode" | "billDiscountType" | "setBillDiscountValue" | "subtotal"
  | "billPriceInputRef" | "billDiscountValue" | "billCustomPriceText"
  | "billDiscountAmount" | "paymentMethod" | "cardFeePercent" | "cardFee"
  | "totalAmount" | "setPaymentMethod" | "setHasCardFee" | "setCardFeePercent"
  | "splitPayments" | "setSplitPayments" | "setShowSplitDropdown" | "showSplitDropdown"
  | "setDebtDueDate" | "debtDueDate" | "submitting" | "savingDraft"
  | "handleSaveOrderAsDraft"
> & {
  paginatedCatalogProducts: Product[];
  safeCatalogPage: number;
  totalCatalogPages: number;
  staffName: string;
  onOpenInvoice: (order: Order) => void;
  totalCartUnits: number;
};

export function PosRightColumn({
  posSubView,
  customerPhone,
  phoneTypedByUserRef,
  setCustomerPhone,
  setIsExistingCustomer,
  setCustomerOrders,
  setCustomerDebtSummary,
  setShowCheckoutDrawer,
  setCatalogViewMode,
  setCatalogPage,
  catalogViewMode,
  setShowCategoryFilterPopover,
  selectedCategoryId,
  showCategoryFilterPopover,
  setSortBy,
  customerName,
  setCustomerName,
  lookingUp,
  isExistingCustomer,
  customerOrders,
  setSelectedCategoryId,
  floor1Products,
  categories,
  getCategoryId,
  loadingProducts,
  paginatedCatalogProducts,
  getFloor1Stock,
  getCartQty,
  handleSelectProductForPos,
  getDirectFloor1Stock,
  getCategoryName,
  getProductPromotions,
  expandedCardVarIds,
  getCartVariantQty,
  handleAddToCart,
  toggleExpandCardVariants,
  setVariantPickerProduct,
  safeCatalogPage,
  totalCatalogPages,
  cart,
  giftCart,
  handleCreateOrder,
  staffName,
  nowClock,
  errorMsg,
  successMsg,
  editingServerDraftOrder,
  removeDraft,
  activeDraftId,
  customerDebtSummary,
  onOpenInvoice,
  totalCartUnits,
  rawSubtotal,
  itemDiscountTotal,
  setBillDiscountType,
  setBillDiscountInputMode,
  setBillCustomPriceText,
  setIsManualBillDiscount,
  billDiscountInputMode,
  billDiscountType,
  setBillDiscountValue,
  subtotal,
  billPriceInputRef,
  billDiscountValue,
  billCustomPriceText,
  billDiscountAmount,
  paymentMethod,
  cardFeePercent,
  cardFee,
  totalAmount,
  setPaymentMethod,
  setHasCardFee,
  setCardFeePercent,
  splitPayments,
  setSplitPayments,
  setShowSplitDropdown,
  showSplitDropdown,
  setDebtDueDate,
  debtDueDate,
  submitting,
  savingDraft,
  handleSaveOrderAsDraft,
}: PosRightColumnProps) {
  return (
    <>
      {posSubView === "CATALOG" ? (
              /* CHẾ ĐỘ BÁN THƯỜNG (GIỐNG ẢNH 1): Cột phải (5 cột) là Lưới chọn sản phẩm nhanh + Phân trang + Nút THANH TOÁN mở Drawer */
              <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
                {/* Thanh trên cùng của cột phải Bán thường: Tìm khách hàng (F4) + Các nút Lọc Danh mục / Chế độ hiển thị */}
                <CatalogToolbar
                  customerPhone={customerPhone}
                  phoneTypedByUserRef={phoneTypedByUserRef}
                  setCustomerPhone={setCustomerPhone}
                  setIsExistingCustomer={setIsExistingCustomer}
                  setCustomerOrders={setCustomerOrders}
                  setCustomerDebtSummary={setCustomerDebtSummary}
                  setShowCheckoutDrawer={setShowCheckoutDrawer}
                  setCatalogViewMode={setCatalogViewMode}
                  setCatalogPage={setCatalogPage}
                  catalogViewMode={catalogViewMode}
                  setShowCategoryFilterPopover={setShowCategoryFilterPopover}
                  selectedCategoryId={selectedCategoryId}
                  showCategoryFilterPopover={showCategoryFilterPopover}
                  setSortBy={setSortBy}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  lookingUp={lookingUp}
                  isExistingCustomer={isExistingCustomer}
                  customerOrders={customerOrders}
                  setSelectedCategoryId={setSelectedCategoryId}
                  floor1Products={floor1Products}
                  categories={categories}
                  getCategoryId={getCategoryId}
                />

                {/* Lưới sản phẩm bên phải (3 cột gọn gàng chuẩn ảnh 1 hoặc thẻ chi tiết) */}
                <CatalogGrid
                  loadingProducts={loadingProducts}
                  paginatedCatalogProducts={paginatedCatalogProducts}
                  catalogViewMode={catalogViewMode}
                  getFloor1Stock={getFloor1Stock}
                  getCartQty={getCartQty}
                  handleSelectProductForPos={handleSelectProductForPos}
                  getDirectFloor1Stock={getDirectFloor1Stock}
                  getCategoryName={getCategoryName}
                  getProductPromotions={getProductPromotions}
                  expandedCardVarIds={expandedCardVarIds}
                  getCartVariantQty={getCartVariantQty}
                  handleAddToCart={handleAddToCart}
                  toggleExpandCardVariants={toggleExpandCardVariants}
                  setVariantPickerProduct={setVariantPickerProduct}
                />

                {/* Chân cột phải Bán thường: Phân trang `< 1/2 >` bên trái + Nút `THANH TOÁN` lớn bên phải (giống hệt ảnh 1) */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                    <button
                      type="button"
                      disabled={safeCatalogPage <= 1}
                      onClick={() =>
                        setCatalogPage((prev) => Math.max(1, prev - 1))
                      }
                      className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-semibold px-1">
                      {safeCatalogPage}/{totalCatalogPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCatalogPage >= totalCatalogPages}
                      onClick={() =>
                        setCatalogPage((prev) =>
                          Math.min(totalCatalogPages, prev + 1)
                        )
                      }
                      className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0 && giftCart.length === 0}
                    onClick={() => setShowCheckoutDrawer(true)}
                    className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-sm sm:text-base uppercase tracking-wide shadow-md transition text-center"
                  >
                    THANH TOÁN
                  </button>
                </div>
              </div>
            ) : (
              /* CHẾ ĐỘ BÁN NHANH (FAST) / NHÁP: Cột phải (4 cột) hiển thị trực tiếp Panel Khách hàng & Thanh toán */
              <div className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
                {<CheckoutForm inDrawer={false} handleCreateOrder={handleCreateOrder} staffName={staffName} nowClock={nowClock} setShowCheckoutDrawer={setShowCheckoutDrawer} customerName={customerName} customerPhone={customerPhone} errorMsg={errorMsg} successMsg={successMsg} editingServerDraftOrder={editingServerDraftOrder} removeDraft={removeDraft} activeDraftId={activeDraftId} phoneTypedByUserRef={phoneTypedByUserRef} setCustomerPhone={setCustomerPhone} setIsExistingCustomer={setIsExistingCustomer} setCustomerOrders={setCustomerOrders} setCustomerDebtSummary={setCustomerDebtSummary} setCustomerName={setCustomerName} lookingUp={lookingUp} isExistingCustomer={isExistingCustomer} customerOrders={customerOrders} customerDebtSummary={customerDebtSummary} onOpenInvoice={onOpenInvoice} totalCartUnits={totalCartUnits} rawSubtotal={rawSubtotal} itemDiscountTotal={itemDiscountTotal} setBillDiscountType={setBillDiscountType} setBillDiscountInputMode={setBillDiscountInputMode} setBillCustomPriceText={setBillCustomPriceText} setIsManualBillDiscount={setIsManualBillDiscount} billDiscountInputMode={billDiscountInputMode} billDiscountType={billDiscountType} setBillDiscountValue={setBillDiscountValue} subtotal={subtotal} billPriceInputRef={billPriceInputRef} billDiscountValue={billDiscountValue} billCustomPriceText={billCustomPriceText} billDiscountAmount={billDiscountAmount} paymentMethod={paymentMethod} cardFeePercent={cardFeePercent} cardFee={cardFee} totalAmount={totalAmount} setPaymentMethod={setPaymentMethod} setHasCardFee={setHasCardFee} setCardFeePercent={setCardFeePercent} splitPayments={splitPayments} setSplitPayments={setSplitPayments} setShowSplitDropdown={setShowSplitDropdown} showSplitDropdown={showSplitDropdown} setDebtDueDate={setDebtDueDate} debtDueDate={debtDueDate} submitting={submitting} cart={cart} giftCart={giftCart} savingDraft={savingDraft} handleSaveOrderAsDraft={handleSaveOrderAsDraft} />}
              </div>
            )}
    </>
  );
}

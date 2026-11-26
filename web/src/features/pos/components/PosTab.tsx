"use client";

import { getStoredUser } from "@/shared/api/client";
import { type PosTabProps } from "../types";
import { usePosTab } from "../hooks/usePosTab";
import { CheckoutForm } from "./CheckoutForm";
import { PosHeader } from "./PosHeader";
import { PosLeftColumn } from "./PosLeftColumn";
import { PosRightColumn } from "./PosRightColumn";
import { PosServicesModeBar } from "./PosServicesModeBar";
import { PosScanBanner } from "./PosScanBanner";
import { PosBottomModeBar } from "./PosBottomModeBar";
import { VariantPickerModal } from "./VariantPickerModal";
import { GiftModal } from "./GiftModal";

export default function PosTab({ onOpenInvoice }: PosTabProps) {
  const {
    posMode,
    setPosMode,
    posSubView,
    setPosSubView,
    showCheckoutDrawer,
    setShowCheckoutDrawer,
    showCategoryFilterPopover,
    setShowCategoryFilterPopover,
    catalogViewMode,
    setCatalogViewMode,
    catalogPage,
    setCatalogPage,
    showSearchDropdown,
    setShowSearchDropdown,
    expandedDiscountKey,
    setExpandedDiscountKey,
    nowClock,
    searchBoxRef,
    billPriceInputRef,
    serviceMeta,
    setServiceMeta,
    categories,
    appliedPromosSummary,
    setIsManualBillDiscount,
    selectedCategoryId,
    setSelectedCategoryId,
    setSortBy,
    search,
    setSearch,
    loadingProducts,
    scannerEnabled,
    setScannerEnabled,
    lastScanBanner,
    setLastScanBanner,
    cart,
    giftCart,
    variantPickerProduct,
    setVariantPickerProduct,
    pickerColorFilter,
    setPickerColorFilter,
    pickerSearch,
    setPickerSearch,
    expandedCardVarIds,
    toggleExpandCardVariants,
    showGiftModal,
    setShowGiftModal,
    giftSearch,
    setGiftSearch,
    giftCategoryId,
    setGiftCategoryId,
    pinnedGiftIds,
    billDiscountType,
    setBillDiscountType,
    billDiscountValue,
    setBillDiscountValue,
    billDiscountInputMode,
    setBillDiscountInputMode,
    billCustomPriceText,
    setBillCustomPriceText,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    isExistingCustomer,
    setIsExistingCustomer,
    customerOrders,
    setCustomerOrders,
    customerDebtSummary,
    setCustomerDebtSummary,
    lookingUp,
    paymentMethod,
    setPaymentMethod,
    splitPayments,
    setSplitPayments,
    debtDueDate,
    setDebtDueDate,
    showSplitDropdown,
    setShowSplitDropdown,
    setHasCardFee,
    cardFeePercent,
    setCardFeePercent,
    note,
    setNote,
    submitting,
    errorMsg,
    successMsg,
    savingDraft,
    savedDraftOrders,
    loadingSavedDrafts,
    editingServerDraftOrder,
    activeDraftId,
    liveDrafts,
    handleSwitchDraft,
    handleAddDraft,
    removeDraft,
    handleCloseDraft,
    getDirectFloor1Stock,
    getFloor1Stock,
    getVariantFloor1Stock,
    getCategoryName,
    getCategoryId,
    phoneTypedByUserRef,
    togglePinGiftProduct,
    floor1Products,
    filteredAndSortedProducts,
    getCartQty,
    getCartVariantQty,
    getGiftQty,
    getProductPromotions,
    handleSelectProductForPos,
    handleAddToCart,
    handleBarcodeScanForPos,
    handleChangeQty,
    handleAddGiftProduct,
    handleChangeGiftQty,
    pinnedFloor1Count,
    popupGiftProducts,
    handleChangeItemDiscount,
    handleChangeItemDesiredPrice,
    getItemPricing,
    giftUnitsCount,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountAmount,
    cardFee,
    totalAmount,
    handleCreateOrder,
    handleSaveOrderAsDraft,
    handleLoadServerDraftToPos,
    handleQuickConfirmServerDraft,
    handleDeleteServerDraft,
  } = usePosTab({ onOpenInvoice });


  const staffName = getStoredUser()?.fullName || "Nhân viên bán hàng";
  const CATALOG_PAGE_SIZE = catalogViewMode === "COMPACT" ? 18 : 6;
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(filteredAndSortedProducts.length / CATALOG_PAGE_SIZE)
  );
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const paginatedCatalogProducts = filteredAndSortedProducts.slice(
    (safeCatalogPage - 1) * CATALOG_PAGE_SIZE,
    safeCatalogPage * CATALOG_PAGE_SIZE
  );
  const totalCartUnits = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div>
      {posMode === "SERVICES" ? (
        <PosServicesModeBar
          onSelectProductsMode={() => setPosMode("PRODUCTS")}
          serviceMeta={serviceMeta}
          onMetaChange={setServiceMeta}
        />
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-[#ebedf0] flex flex-col lg:h-[calc(100dvh-90px)] lg:max-h-[calc(100dvh-90px)] min-h-[540px]">
          {/* ==================== THANH HEADER XANH LÁ CHỦ ĐẠO (11 SPORT) ==================== */}
          <PosHeader
            searchBoxRef={searchBoxRef}
            search={search}
            setShowSearchDropdown={setShowSearchDropdown}
            setSearch={setSearch}
            setCatalogPage={setCatalogPage}
            handleBarcodeScanForPos={handleBarcodeScanForPos}
            showSearchDropdown={showSearchDropdown}
            filteredAndSortedProducts={filteredAndSortedProducts}
            getFloor1Stock={getFloor1Stock}
            handleSelectProductForPos={handleSelectProductForPos}
            setScannerEnabled={setScannerEnabled}
            scannerEnabled={scannerEnabled}
            liveDrafts={liveDrafts}
            activeDraftId={activeDraftId}
            handleSwitchDraft={handleSwitchDraft}
            submitting={submitting}
            handleCloseDraft={handleCloseDraft}
            handleAddDraft={handleAddDraft}
          />

          {/* Thông báo quét mã vạch gần nhất (nếu có) */}
          {lastScanBanner && (
            <PosScanBanner
              banner={lastScanBanner}
              onDismiss={() => setLastScanBanner(null)}
            />
          )}

          {/* ==================== VÙNG NỘI DUNG CHÍNH ==================== */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-2.5 sm:p-3 min-h-0 overflow-hidden">
            {/* ==================== CỘT TRÁI: GIỎ HÀNG (7 CỘT Ở BÁN THƯỜNG, 8 CỘT Ở BÁN NHANH) ==================== */}
            <PosLeftColumn
              posSubView={posSubView}
              appliedPromosSummary={appliedPromosSummary}
              cart={cart}
              giftCart={giftCart}
              liveDrafts={liveDrafts}
              activeDraftId={activeDraftId}
              getVariantFloor1Stock={getVariantFloor1Stock}
              getItemPricing={getItemPricing}
              expandedDiscountKey={expandedDiscountKey}
              handleChangeQty={handleChangeQty}
              getDirectFloor1Stock={getDirectFloor1Stock}
              handleChangeItemDesiredPrice={handleChangeItemDesiredPrice}
              setExpandedDiscountKey={setExpandedDiscountKey}
              handleChangeItemDiscount={handleChangeItemDiscount}
              getFloor1Stock={getFloor1Stock}
              getCartQty={getCartQty}
              handleChangeGiftQty={handleChangeGiftQty}
              savedDraftOrders={savedDraftOrders}
              setPosSubView={setPosSubView}
              loadingSavedDrafts={loadingSavedDrafts}
              editingServerDraftOrder={editingServerDraftOrder}
              handleLoadServerDraftToPos={handleLoadServerDraftToPos}
              handleQuickConfirmServerDraft={handleQuickConfirmServerDraft}
              onOpenInvoice={onOpenInvoice}
              handleDeleteServerDraft={handleDeleteServerDraft}
              note={note}
              setNote={setNote}
              setGiftSearch={setGiftSearch}
              setGiftCategoryId={setGiftCategoryId}
              setShowGiftModal={setShowGiftModal}
              giftUnitsCount={giftUnitsCount}
              totalCartUnits={totalCartUnits}
              subtotal={subtotal}
            />

            {/* ==================== CỘT PHẢI: TÙY THEO CHẾ ĐỘ BÁN NHANH HAY BÁN THƯỜNG ==================== */}
            <PosRightColumn
              posSubView={posSubView}
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
              loadingProducts={loadingProducts}
              paginatedCatalogProducts={paginatedCatalogProducts}
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
              safeCatalogPage={safeCatalogPage}
              totalCatalogPages={totalCatalogPages}
              cart={cart}
              giftCart={giftCart}
              handleCreateOrder={handleCreateOrder}
              staffName={staffName}
              nowClock={nowClock}
              errorMsg={errorMsg}
              successMsg={successMsg}
              editingServerDraftOrder={editingServerDraftOrder}
              removeDraft={removeDraft}
              activeDraftId={activeDraftId}
              customerDebtSummary={customerDebtSummary}
              onOpenInvoice={onOpenInvoice}
              totalCartUnits={totalCartUnits}
              rawSubtotal={rawSubtotal}
              itemDiscountTotal={itemDiscountTotal}
              setBillDiscountType={setBillDiscountType}
              setBillDiscountInputMode={setBillDiscountInputMode}
              setBillCustomPriceText={setBillCustomPriceText}
              setIsManualBillDiscount={setIsManualBillDiscount}
              billDiscountInputMode={billDiscountInputMode}
              billDiscountType={billDiscountType}
              setBillDiscountValue={setBillDiscountValue}
              subtotal={subtotal}
              billPriceInputRef={billPriceInputRef}
              billDiscountValue={billDiscountValue}
              billCustomPriceText={billCustomPriceText}
              billDiscountAmount={billDiscountAmount}
              paymentMethod={paymentMethod}
              cardFeePercent={cardFeePercent}
              cardFee={cardFee}
              totalAmount={totalAmount}
              setPaymentMethod={setPaymentMethod}
              setHasCardFee={setHasCardFee}
              setCardFeePercent={setCardFeePercent}
              splitPayments={splitPayments}
              setSplitPayments={setSplitPayments}
              setShowSplitDropdown={setShowSplitDropdown}
              showSplitDropdown={showSplitDropdown}
              setDebtDueDate={setDebtDueDate}
              debtDueDate={debtDueDate}
              submitting={submitting}
              savingDraft={savingDraft}
              handleSaveOrderAsDraft={handleSaveOrderAsDraft}
            />
          </div>

          {/* ==================== SLIDE-OVER DRAWER THANH TOÁN KHI Ở CHẾ ĐỘ BÁN THƯỜNG (GIỐNG ẢNH 2) ==================== */}
          {showCheckoutDrawer && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex justify-end"
              onClick={() => setShowCheckoutDrawer(false)}
            >
              <div
                className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {<CheckoutForm inDrawer={true} handleCreateOrder={handleCreateOrder} staffName={staffName} nowClock={nowClock} setShowCheckoutDrawer={setShowCheckoutDrawer} customerName={customerName} customerPhone={customerPhone} errorMsg={errorMsg} successMsg={successMsg} editingServerDraftOrder={editingServerDraftOrder} removeDraft={removeDraft} activeDraftId={activeDraftId} phoneTypedByUserRef={phoneTypedByUserRef} setCustomerPhone={setCustomerPhone} setIsExistingCustomer={setIsExistingCustomer} setCustomerOrders={setCustomerOrders} setCustomerDebtSummary={setCustomerDebtSummary} setCustomerName={setCustomerName} lookingUp={lookingUp} isExistingCustomer={isExistingCustomer} customerOrders={customerOrders} customerDebtSummary={customerDebtSummary} onOpenInvoice={onOpenInvoice} totalCartUnits={totalCartUnits} rawSubtotal={rawSubtotal} itemDiscountTotal={itemDiscountTotal} setBillDiscountType={setBillDiscountType} setBillDiscountInputMode={setBillDiscountInputMode} setBillCustomPriceText={setBillCustomPriceText} setIsManualBillDiscount={setIsManualBillDiscount} billDiscountInputMode={billDiscountInputMode} billDiscountType={billDiscountType} setBillDiscountValue={setBillDiscountValue} subtotal={subtotal} billPriceInputRef={billPriceInputRef} billDiscountValue={billDiscountValue} billCustomPriceText={billCustomPriceText} billDiscountAmount={billDiscountAmount} paymentMethod={paymentMethod} cardFeePercent={cardFeePercent} cardFee={cardFee} totalAmount={totalAmount} setPaymentMethod={setPaymentMethod} setHasCardFee={setHasCardFee} setCardFeePercent={setCardFeePercent} splitPayments={splitPayments} setSplitPayments={setSplitPayments} setShowSplitDropdown={setShowSplitDropdown} showSplitDropdown={showSplitDropdown} setDebtDueDate={setDebtDueDate} debtDueDate={debtDueDate} submitting={submitting} cart={cart} giftCart={giftCart} savingDraft={savingDraft} handleSaveOrderAsDraft={handleSaveOrderAsDraft} />}
              </div>
            </div>
          )}

          {/* ==================== THANH CHẾ ĐỘ BÁN HÀNG DƯỚI ĐÁY (BÁN NHANH / BÁN THƯỜNG / HÓA ĐƠN NHÁP) ==================== */}
          <PosBottomModeBar
            posSubView={posSubView}
            savedDraftsCount={savedDraftOrders.length}
            floor1ProductsCount={floor1Products.length}
            onSelectFast={() => {
              setPosSubView("FAST");
              setShowCheckoutDrawer(false);
            }}
            onSelectCatalog={() => setPosSubView("CATALOG")}
            onSelectDrafts={() => {
              setPosSubView("DRAFTS");
              setShowCheckoutDrawer(false);
            }}
          />

      {/* POPUP CHỌN PHÂN LOẠI (MÀU SẮC & SIZE) KHI QUÉT MÃ CHUNG HOẶC BẤM CHỌN BÁN */}
      <VariantPickerModal
        variantPickerProduct={variantPickerProduct}
        pickerSearch={pickerSearch}
        pickerColorFilter={pickerColorFilter}
        setVariantPickerProduct={setVariantPickerProduct}
        setPickerColorFilter={setPickerColorFilter}
        setPickerSearch={setPickerSearch}
        getCartVariantQty={getCartVariantQty}
        handleAddToCart={handleAddToCart}
        setLastScanBanner={setLastScanBanner}
      />

      {/* POPUP CHỌN SẢN PHẨM TẶNG KÈM */}
      <GiftModal
        showGiftModal={showGiftModal}
        setShowGiftModal={setShowGiftModal}
        giftSearch={giftSearch}
        setGiftSearch={setGiftSearch}
        giftCategoryId={giftCategoryId}
        setGiftCategoryId={setGiftCategoryId}
        floor1Products={floor1Products}
        pinnedFloor1Count={pinnedFloor1Count}
        categories={categories}
        getCategoryId={getCategoryId}
        popupGiftProducts={popupGiftProducts}
        pinnedGiftIds={pinnedGiftIds}
        getFloor1Stock={getFloor1Stock}
        getCartQty={getCartQty}
        getGiftQty={getGiftQty}
        getCategoryName={getCategoryName}
        togglePinGiftProduct={togglePinGiftProduct}
        handleChangeGiftQty={handleChangeGiftQty}
        handleAddGiftProduct={handleAddGiftProduct}
        giftUnitsCount={giftUnitsCount}
        giftCart={giftCart}
      />
        </div>
      )}
    </div>
  );
}

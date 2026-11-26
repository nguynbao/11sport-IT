"use client";

import { useShiftHandover } from "../hooks/useShiftHandover";
import type { ShiftHandoverModalProps } from "../utils/shiftHandoverTypes";
import ShiftHandoverHeader from "./shiftHandover/ShiftHandoverHeader";
import ShiftHandoverMessages from "./shiftHandover/ShiftHandoverMessages";
import CategoryTotalsSection from "./shiftHandover/CategoryTotalsSection";
import ProductFilterSection from "./shiftHandover/ProductFilterSection";
import { CashSection, NoteSection } from "./shiftHandover/CashNoteSections";
import { LateReasonSection, CheckoutTimeNotice } from "./shiftHandover/LateReasonAndNotice";
import ShiftHandoverFooter from "./shiftHandover/ShiftHandoverFooter";

export default function ShiftHandoverModal(props: ShiftHandoverModalProps) {
  const { onClose } = props;
  const h = useShiftHandover(props);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
      <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
        <ShiftHandoverHeader
          checkedCategories={h.checkedCategories}
          isReachedCheckoutTime={h.isReachedCheckoutTime}
          effectiveEndLabel={h.effectiveEndLabel}
          onClose={onClose}
        />

        <form onSubmit={h.handleConfirmSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <ShiftHandoverMessages errorMsg={h.errorMsg} savedNotice={h.savedNotice} />

          <div className="space-y-3">
            <CategoryTotalsSection
              date={h.dailyCheck?.date}
              checkedCategories={h.checkedCategories}
              loading={h.loading}
              summaries={h.summaries}
              actualTotals={h.actualTotals}
              unitBreakdownByCategory={h.unitBreakdownByCategory}
              setSelectedCategoryFilter={h.setSelectedCategoryFilter}
              setSelectedUnitFilter={h.setSelectedUnitFilter}
              setShowProductFilterSection={h.setShowProductFilterSection}
              handleAdjustTotal={h.handleAdjustTotal}
              handleDirectTotalChange={h.handleDirectTotalChange}
            />

            {!h.loading && h.allCheckProducts.length > 0 && (
              <ProductFilterSection
                  allCheckProducts={h.allCheckProducts}
                  filteredCheckProducts={h.filteredCheckProducts}
                  filteredTotalQty={h.filteredTotalQty}
                  unitStats={h.unitStats}
                  checkedCategories={h.checkedCategories}
                  selectedUnitFilter={h.selectedUnitFilter}
                  selectedCategoryFilter={h.selectedCategoryFilter}
                  productSearch={h.productSearch}
                  showProductFilterSection={h.showProductFilterSection}
                  setSelectedUnitFilter={h.setSelectedUnitFilter}
                  setSelectedCategoryFilter={h.setSelectedCategoryFilter}
                  setProductSearch={h.setProductSearch}
                  setShowProductFilterSection={h.setShowProductFilterSection}
                />
            )}
          </div>

          <CashSection cashBalance={h.cashBalance} setCashBalance={h.setCashBalance} />

          <NoteSection
            note={h.note}
            setNote={h.setNote}
            diffCategoriesCount={h.diffCategoriesCount}
          />

          {h.isLateSubmit && (
            <LateReasonSection
              diffLateMinutes={h.diffLateMinutes}
              effectiveEndLabel={h.effectiveEndLabel}
              lateReason={h.lateReason}
              setLateReason={h.setLateReason}
            />
          )}

          <CheckoutTimeNotice
            isReachedCheckoutTime={h.isReachedCheckoutTime}
            effectiveEndLabel={h.effectiveEndLabel}
          />

          <ShiftHandoverFooter
            isPending={h.existingHandover?.status === "PENDING"}
            submitting={h.submitting}
            loading={h.loading}
            isReachedCheckoutTime={h.isReachedCheckoutTime}
            shiftCode={h.shiftCode}
            effectiveEndLabel={h.effectiveEndLabel}
            onClose={onClose}
            handleSaveDraft={h.handleSaveDraft}
          />
        </form>
      </div>
    </div>
  );
}

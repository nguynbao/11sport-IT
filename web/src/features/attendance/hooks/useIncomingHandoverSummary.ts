import { useState, useEffect } from "react";
import type { DailyHandoverCategorySummary, ShiftHandoverRecord } from "@/shared/types";
import { fetchDailyHandoverCheckApi } from "@/features/pos";

export function useIncomingHandoverSummary({
  showIncomingHandoverPopup,
  pendingHandoverToConfirm,
}: {
  showIncomingHandoverPopup: boolean;
  pendingHandoverToConfirm: ShiftHandoverRecord | null;
}) {
  const [incomingSummaries, setIncomingSummaries] = useState<DailyHandoverCategorySummary[]>([]);
  const [incomingCheckCategories, setIncomingCheckCategories] = useState<string[]>([]);
  const [incomingCheckLoading, setIncomingCheckLoading] = useState(false);
  const [incomingActualTotals, setIncomingActualTotals] = useState<Record<string, number>>({});

  // Tải thông tin tổng số lượng kiểm tra (Vợt + ...) của phiếu bàn giao đang chờ xác nhận
  useEffect(() => {
    if (!showIncomingHandoverPopup || !pendingHandoverToConfirm) return;
    let cancelled = false;
    const loadIncomingSummary = async () => {
      setIncomingCheckLoading(true);
      try {
        const checkData = await fetchDailyHandoverCheckApi(pendingHandoverToConfirm.date);
        if (cancelled) return;

        let catSummaries: DailyHandoverCategorySummary[] = Array.isArray(checkData.categorySummaries)
          ? checkData.categorySummaries
          : [];

        if (catSummaries.length === 0) {
          const prods = Array.isArray(checkData.products) ? checkData.products : [];
          const cats = Array.isArray(checkData.checkedCategories)
            ? checkData.checkedCategories
            : ["Vợt"];
          catSummaries = cats.map((catName, idx) => {
            const matching = prods.filter((p) => p.categoryName === catName);
            return {
              categoryId: catName,
              categoryCode: catName.toUpperCase(),
              categoryName: catName,
              isPrimaryCategory: idx === 0,
              unit: matching[0]?.unit || "Cái",
              productCount: matching.length,
              expectedTotalQty: matching.reduce(
                (sum, p) => sum + (Number(p.stockQtyFloor1) || 0),
                0
              ),
            };
          });
        }

        setIncomingSummaries(catSummaries);
        setIncomingCheckCategories(
          Array.isArray(checkData.checkedCategories) && checkData.checkedCategories.length > 0
            ? checkData.checkedCategories
            : Array.isArray(pendingHandoverToConfirm.checkedCategories)
            ? pendingHandoverToConfirm.checkedCategories
            : ["Vợt"]
        );

        const initTotals: Record<string, number> = {};
        for (const s of catSummaries) {
          const key = s.categoryCode || s.categoryName;
          initTotals[key] = 0;
        }
        setIncomingActualTotals(initTotals);
      } catch {
        if (!cancelled) {
          setIncomingSummaries([]);
        }
      } finally {
        if (!cancelled) {
          setIncomingCheckLoading(false);
        }
      }
    };
    loadIncomingSummary();
    return () => {
      cancelled = true;
    };
  }, [showIncomingHandoverPopup, pendingHandoverToConfirm?._id, pendingHandoverToConfirm?.date]);
  return {
    incomingSummaries,
    incomingCheckCategories,
    incomingCheckLoading,
    incomingActualTotals,
    setIncomingActualTotals,
  };
}

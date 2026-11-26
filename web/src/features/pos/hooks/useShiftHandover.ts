import React, { useState, useEffect, useMemo } from "react";
import type {
  DailyHandoverCategorySummary,
  DailyHandoverCheckData,
  ShiftHandoverCategoryCount,
} from "@/shared/types";
import { createHandoverApi, fetchDailyHandoverCheckApi } from "../api";
import type { ShiftHandoverModalProps } from "../utils/shiftHandoverTypes";
import {
  buildFallbackSummaries,
  computeShiftTiming,
  computeUnitBreakdownByCategory,
  computeUnitStats,
  filterCheckProducts,
  type CheckProduct,
} from "../utils/shiftHandover";

export function useShiftHandover({
  shiftCode = "SHIFT_1",
  existingHandover = null,
  canConfirmCheckout,
  shiftEndLabel,
  onSavedDraft,
  onSuccess,
}: ShiftHandoverModalProps) {
  const [cashBalance, setCashBalance] = useState<number>(
    existingHandover ? Number(existingHandover.cashBalance || 0) : 0
  );
  const [note, setNote] = useState<string>(existingHandover?.notes || "");
  const [lateReason, setLateReason] = useState<string>(
    existingHandover?.lateCheckoutReason || ""
  );
  const [dailyCheck, setDailyCheck] = useState<DailyHandoverCheckData | null>(null);
  const [summaries, setSummaries] = useState<DailyHandoverCategorySummary[]>([]);
  const [actualTotals, setActualTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [productSearch, setProductSearch] = useState<string>("");
  const [showProductFilterSection, setShowProductFilterSection] = useState<boolean>(true);

  const { effectiveEndLabel, isReachedCheckoutTime, diffLateMinutes, isLateSubmit } =
    computeShiftTiming(shiftCode, canConfirmCheckout, shiftEndLabel);

  useEffect(() => {
    loadDailyCheckSummary();
  }, [existingHandover?._id]);

  const loadDailyCheckSummary = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyHandoverCheckApi();
      setDailyCheck(data);

      // Lấy danh sách tổng theo mặt hàng kiểm trong ngày (tất cả bao gồm size, màu)
      let catSummaries: DailyHandoverCategorySummary[] = Array.isArray(data.categorySummaries)
        ? data.categorySummaries
        : [];

      if (catSummaries.length === 0) {
        catSummaries = buildFallbackSummaries(data);
      }

      setSummaries(catSummaries);

      // Khởi tạo số lượng tổng: nếu đã có bản nháp (existingHandover) thì lấy số đã lưu, nếu chưa thì mặc định bằng 0
      const savedMap = new Map<string, number>();
      if (existingHandover && Array.isArray(existingHandover.categoryCounts)) {
        for (const c of existingHandover.categoryCounts) {
          if (c.categoryCode) savedMap.set(c.categoryCode, Number(c.actualTotalQty));
          if (c.categoryName) savedMap.set(c.categoryName, Number(c.actualTotalQty));
        }
      }

      const initTotals: Record<string, number> = {};
      for (const s of catSummaries) {
        const key = s.categoryCode || s.categoryName;
        const savedVal =
          savedMap.get(s.categoryCode) ?? savedMap.get(s.categoryName);
        initTotals[key] =
          typeof savedVal === "number" && !Number.isNaN(savedVal)
            ? savedVal
            : 0;
      }
      setActualTotals(initTotals);

      if (existingHandover) {
        setCashBalance(Number(existingHandover.cashBalance || 0));
        setNote(existingHandover.notes || "");
        if (existingHandover.lateCheckoutReason) {
          setLateReason(existingHandover.lateCheckoutReason);
        }
      }
    } catch {
      setErrorMsg("Không thể tải thông tin tổng số lượng kiểm hàng hôm nay");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustTotal = (key: string, delta: number) => {
    setActualTotals((prev) => {
      const current = prev[key] ?? 0;
      return { ...prev, [key]: Math.max(0, current + delta) };
    });
  };

  const handleDirectTotalChange = (key: string, rawVal: string) => {
    const cleaned = rawVal.replace(/\D/g, "");
    const num = cleaned === "" ? 0 : Math.max(0, Number(cleaned));
    setActualTotals((prev) => ({ ...prev, [key]: num }));
  };

  const buildPayload = (isDraft: boolean) => {
    const categoryCounts: ShiftHandoverCategoryCount[] = summaries.map((s) => {
      const key = s.categoryCode || s.categoryName;
      const actualTotalQty = actualTotals[key] ?? 0;
      return {
        categoryId: s.categoryId,
        categoryCode: s.categoryCode,
        categoryName: s.categoryName,
        expectedTotalQty: s.expectedTotalQty,
        actualTotalQty,
        unit: s.unit || "Cái",
        productCount: s.productCount,
        note: note.trim(),
      };
    });

    const totalCheckedQty = summaries.reduce((sum, s) => sum + s.expectedTotalQty, 0);

    return {
      date: dailyCheck?.date,
      shiftCode,
      isDraft,
      cashBalance: Number(cashBalance) || 0,
      checkedCategories:
        dailyCheck?.checkedCategories || summaries.map((s) => s.categoryName),
      totalCheckedProducts: totalCheckedQty,
      categoryCounts,
      notes: note.trim(),
      lateCheckoutReason: !isDraft && isLateSubmit ? lateReason.trim() : undefined,
      requireLateReason: !isDraft && isLateSubmit,
    };
  };

  const handleSaveDraft = async () => {
    setErrorMsg("");
    setSavedNotice("");
    setSubmitting(true);
    try {
      const res = await createHandoverApi(buildPayload(true));
      setSavedNotice("Đã lưu bản nháp kiểm hàng! Bạn có thể cập nhật tiếp trong ca.");
      if (onSavedDraft) {
        onSavedDraft(res.handover);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể lưu bản nháp kiểm hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSavedNotice("");

    if (!isReachedCheckoutTime) {
      await handleSaveDraft();
      return;
    }

    if (isLateSubmit && !lateReason.trim()) {
      setErrorMsg(
        `Bạn đang gửi bàn giao & check-out trễ ${diffLateMinutes} phút (quá 5 phút sau ${effectiveEndLabel}). Vui lòng nhập lý do check-out trễ!`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createHandoverApi(buildPayload(false));
      onSuccess(res.handover, isLateSubmit ? lateReason.trim() : "");
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi gửi biên bản bàn giao ca");
    } finally {
      setSubmitting(false);
    }
  };

  const checkedCategories =
    dailyCheck?.checkedCategories || summaries.map((s) => s.categoryName);
  const diffCategoriesCount = summaries.filter((s) => {
    const key = s.categoryCode || s.categoryName;
    return (actualTotals[key] ?? 0) !== s.expectedTotalQty;
  }).length;

  const allCheckProducts: CheckProduct[] = useMemo(
    () => (Array.isArray(dailyCheck?.products) ? dailyCheck.products : []),
    [dailyCheck]
  );

  const unitStats = useMemo(
    () => computeUnitStats(allCheckProducts, selectedCategoryFilter),
    [allCheckProducts, selectedCategoryFilter]
  );

  const unitBreakdownByCategory = useMemo(
    () => computeUnitBreakdownByCategory(allCheckProducts),
    [allCheckProducts]
  );

  const filteredCheckProducts = useMemo(
    () =>
      filterCheckProducts(
        allCheckProducts,
        selectedCategoryFilter,
        selectedUnitFilter,
        productSearch
      ),
    [allCheckProducts, selectedCategoryFilter, selectedUnitFilter, productSearch]
  );

  const filteredTotalQty = useMemo(
    () =>
      filteredCheckProducts.reduce((sum, p) => sum + (Number(p.stockQtyFloor1) || 0), 0),
    [filteredCheckProducts]
  );

  return {
    shiftCode,
    existingHandover,
    cashBalance,
    setCashBalance,
    note,
    setNote,
    lateReason,
    setLateReason,
    dailyCheck,
    summaries,
    actualTotals,
    loading,
    submitting,
    errorMsg,
    savedNotice,
    selectedUnitFilter,
    setSelectedUnitFilter,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    productSearch,
    setProductSearch,
    showProductFilterSection,
    setShowProductFilterSection,
    effectiveEndLabel,
    isReachedCheckoutTime,
    diffLateMinutes,
    isLateSubmit,
    handleAdjustTotal,
    handleDirectTotalChange,
    handleSaveDraft,
    handleConfirmSubmit,
    checkedCategories,
    diffCategoriesCount,
    allCheckProducts,
    unitStats,
    unitBreakdownByCategory,
    filteredCheckProducts,
    filteredTotalQty,
  };
}

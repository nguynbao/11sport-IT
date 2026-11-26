import { useState, useEffect, useCallback, useMemo } from "react";
import type { Category, Order, Product, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import {
  buildFallbackPushProducts,
  type PushProductRow,
  type PushProductsReportResponse,
} from "../utils/pushProducts";

export function useMarketingPushProducts() {
  const [rows, setRows] = useState<PushProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quickRange, setQuickRange] = useState<"ALL" | "TODAY" | "YESTERDAY" | "7D" | "30D" | "MONTH">("ALL");

  const [pushFilter, setPushFilter] = useState<"ALL" | "ZERO_SALES" | "HIGH_CAPITAL" | "FLOOR2_ONLY" | "NO_PRICE">("ALL");
  const [pushSearch, setPushSearch] = useState("");
  const [pushPage, setPushPage] = useState(1);
  const [pushPageSize, setPushPageSize] = useState(15);

  const debouncedSearch = useDebounce(pushSearch, 200);

  const toDateInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSelectQuickRange = (range: typeof quickRange) => {
    setQuickRange(range);
    const now = new Date();
    if (range === "ALL") {
      setFromDate("");
      setToDate("");
    } else if (range === "TODAY") {
      const s = toDateInput(now);
      setFromDate(s);
      setToDate(s);
    } else if (range === "YESTERDAY") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const s = toDateInput(y);
      setFromDate(s);
      setToDate(s);
    } else if (range === "7D") {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setFromDate(toDateInput(past));
      setToDate(toDateInput(now));
    } else if (range === "30D") {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      setFromDate(toDateInput(past));
      setToDate(toDateInput(now));
    } else if (range === "MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toDateInput(firstDay));
      setToDate(toDateInput(now));
    }
  };

  const loadPushProducts = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      if (categoryId) q.set("categoryId", categoryId);

      try {
        const res = await apiRequest<PushProductsReportResponse>(
          `/reports/push-products${q.toString() ? `?${q.toString()}` : ""}`
        );
        if (res.data?.needsPushProducts) {
          setRows(res.data.needsPushProducts);
          if (Array.isArray(res.data.categories)) {
            setCategories(res.data.categories);
          }
          return;
        }
      } catch {
        // Fallback nếu server chưa cập nhật route mới
      }

      const [catRes, prodRes, ordRes, retRes] = await Promise.all([
        apiRequest<Category[]>("/categories").catch(() => ({ data: [] })),
        apiRequest<Product[]>("/products").catch(() => ({ data: [] })),
        apiRequest<Order[]>("/orders").catch(() => ({ data: [] })),
        apiRequest<ReturnReceipt[]>("/returns").catch(() => ({ data: [] })),
      ]);
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(catList);
      const fallback = buildFallbackPushProducts(
        Array.isArray(prodRes.data) ? prodRes.data : [],
        catList,
        Array.isArray(ordRes.data) ? ordRes.data : [],
        Array.isArray(retRes.data) ? retRes.data : [],
        { from: fromDate, to: toDate, categoryId }
      );
      setRows(fallback);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryId]);

  useEffect(() => {
    loadPushProducts();
  }, [loadPushProducts]);

  useEffect(() => {
    setPushPage(1);
  }, [debouncedSearch, pushFilter, pushPageSize, fromDate, toDate, categoryId]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      zeroSales: rows.filter((p) => p.netSoldQty === 0).length,
      highCapital: rows.filter((p) => p.inventoryCostValue >= 2000000).length,
      floor2Only: rows.filter((p) => p.stockFloor1 === 0 && p.stockFloor2 > 0).length,
      noPrice: rows.filter((p) => p.sellingPrice <= 0).length,
      totalStock: rows.reduce((s, p) => s + p.stock, 0),
      totalCapital: rows.reduce((s, p) => s + p.inventoryCostValue, 0),
    };
  }, [rows]);

  const filteredPushProducts = useMemo(() => {
    const byType = rows.filter((p) => {
      if (pushFilter === "ZERO_SALES") return p.netSoldQty === 0;
      if (pushFilter === "HIGH_CAPITAL") return p.inventoryCostValue >= 2000000;
      if (pushFilter === "FLOOR2_ONLY") return p.stockFloor1 === 0 && p.stockFloor2 > 0;
      if (pushFilter === "NO_PRICE") return p.sellingPrice <= 0;
      return true;
    });
    const q = debouncedSearch.trim();
    if (!q) return byType;
    return filterAndRankBySearch(byType, q, (p) => [
      { text: p.productCode, weight: 1.5 },
      { text: p.productName, weight: 1.3 },
      { text: p.categoryName, weight: 0.9 },
    ]);
  }, [rows, debouncedSearch, pushFilter]);

  const pushTotalPages = Math.max(1, Math.ceil(filteredPushProducts.length / pushPageSize));
  const pagedPushProducts = filteredPushProducts.slice(
    (pushPage - 1) * pushPageSize,
    pushPage * pushPageSize
  );

  return {
    rows,
    setRows,
    categories,
    setCategories,
    loading,
    setLoading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    categoryId,
    setCategoryId,
    quickRange,
    setQuickRange,
    pushFilter,
    setPushFilter,
    pushSearch,
    setPushSearch,
    pushPage,
    setPushPage,
    pushPageSize,
    setPushPageSize,
    debouncedSearch,
    handleSelectQuickRange,
    loadPushProducts,
    counts,
    filteredPushProducts,
    pushTotalPages,
    pagedPushProducts,
  };
}

export type MarketingPushState = ReturnType<typeof useMarketingPushProducts>;

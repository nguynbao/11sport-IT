import { useEffect, useCallback, useMemo, useRef } from "react";
import type { Product, Category, Order, Promotion, ServiceOrdersMeta } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { cleanPhoneDigits } from "@/shared/utils/format";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { PINNED_GIFTS_STORAGE_KEY } from "../types";
import type { PosStateSlice } from "./usePosState";

/** Catalog, tồn kho tầng 1, danh mục, khuyến mãi, tra cứu khách */
export function usePosCatalog(s: PosStateSlice) {
  const {
    categories,
    setCategories,
    setActivePromotions,
    search,
    giftSearch,
    customerPhone,
    setLoadingProducts,
    setProducts,
    setAllCatalogProducts,
    setErrorMsg,
    setServiceMeta,
    setLoadingSavedDrafts,
    setSavedDraftOrders,
    setCustomerOrders,
    setPinnedGiftIds,
    products,
    selectedCategoryId,
    sortBy,
    setIsExistingCustomer,
    setCustomerDebtSummary,
    setLookingUp,
    activeDraftIdRef,
    setCustomerName,
  } = s;
  const getDirectFloor1Stock = (p: Product): number => {
    const f1 = Number(p.stockFloor1);
    const f2 = Number(p.stockFloor2);
    const total = Math.max(0, Number(p.stock) || 0);
    if (
      p.stockFloor1 === undefined ||
      p.stockFloor1 === null ||
      ((isNaN(f1) || f1 === 0) && (isNaN(f2) || f2 === 0) && total > 0)
    ) {
      return total;
    }
    return Math.max(0, f1 || 0);
  };

  const getFloor1Stock = (p: Product): number => {
    const direct = getDirectFloor1Stock(p);
    const unpackable = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    return direct + unpackable;
  };

  const getVariantFloor1Stock = (
    p: Product,
    color?: string,
    size?: string
  ): number => {
    const unpackable = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    if (Array.isArray(p.variants) && p.variants.length > 0 && (color || size)) {
      const cNorm = String(color || "").trim().toLowerCase();
      const sNorm = String(size || "").trim().toUpperCase();
      const matched = p.variants.find(
        (v) =>
          String(v.color || "").trim().toLowerCase() === cNorm &&
          String(v.size || "").trim().toUpperCase() === sNorm
      );
      if (matched) {
        return Math.max(0, Number(matched.stockFloor1 ?? matched.stock) || 0) + unpackable;
      }
    }
    return getFloor1Stock(p);
  };

  const getCategoryName = (p: Product): string => {
    if (p.categoryName) return p.categoryName;
    if (typeof p.categoryId === "object" && p.categoryId?.name) {
      return p.categoryId.name;
    }
    const rawId = String(p.categoryId || "").trim();
    const found = categories.find(
      (c) =>
        c._id === rawId ||
        (p.categoryCode && c.code?.toLowerCase() === p.categoryCode.toLowerCase()) ||
        (rawId && (c.code?.toLowerCase() === rawId.toLowerCase() || c.name?.toLowerCase() === rawId.toLowerCase()))
    );
    return found?.name || "Khác";
  };

  const getCategoryId = (p: Product): string => {
    if (typeof p.categoryId === "object" && p.categoryId?._id) {
      return p.categoryId._id;
    }
    const rawId = String(p.categoryId || "").trim();
    if (rawId && categories.some((c) => c._id === rawId)) {
      return rawId;
    }
    const byCodeOrName = categories.find(
      (c) =>
        (p.categoryCode && c.code?.toLowerCase() === p.categoryCode.toLowerCase()) ||
        (p.categoryName && c.name?.toLowerCase() === p.categoryName.toLowerCase()) ||
        (rawId && (c.code?.toLowerCase() === rawId.toLowerCase() || c.name?.toLowerCase() === rawId.toLowerCase()))
    );
    return byCodeOrName?._id || rawId;
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  }, []);

  const fetchActivePromotions = useCallback(async () => {
    try {
      const res = await apiRequest<Promotion[]>("/promotions?activeOnly=true");
      setActivePromotions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  }, []);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedGiftSearch = useDebounce(giftSearch, 300);
  const debouncedCustomerPhone = useDebounce(customerPhone, 500);
  const phoneTypedByUserRef = useRef(false);

  const fetchSellableProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const q = new URLSearchParams();
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
      if (!debouncedSearch.trim()) {
        setAllCatalogProducts(list);
      } else {
        setAllCatalogProducts((prev) => {
          if (prev.length === 0) return list;
          const byId = new Map(prev.map((p) => [p._id, p]));
          list.forEach((p) => byId.set(p._id, p));
          return Array.from(byId.values());
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setLoadingProducts(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCategories();
    fetchActivePromotions();
    apiRequest("/service-orders")
      .then((res) => {
        if (res.meta) setServiceMeta(res.meta as unknown as ServiceOrdersMeta);
      })
      .catch(() => {});
  }, [fetchCategories, fetchActivePromotions]);

  const fetchSavedDraftOrders = useCallback(async () => {
    setLoadingSavedDrafts(true);
    try {
      const res = await apiRequest<Order[]>("/orders?status=DRAFT");
      setSavedDraftOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    } finally {
      setLoadingSavedDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedDraftOrders();
  }, [fetchSavedDraftOrders]);

  // Tự động làm mới danh sách bản nháp khi qua 00:00 sang ngày mới
  useEffect(() => {
    let lastDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    const timer = setInterval(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (today !== lastDay) {
        lastDay = today;
        setSavedDraftOrders([]);
        setCustomerOrders([]);
        fetchSavedDraftOrders();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchSavedDraftOrders]);

  useEffect(() => {
    fetchSellableProducts();
  }, [fetchSellableProducts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PINNED_GIFTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPinnedGiftIds(parsed.map(String));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const togglePinGiftProduct = (productId: string) => {
    setPinnedGiftIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [productId, ...prev];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(PINNED_GIFTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const floor1Products = useMemo(() => {
    return products.filter((p) => getFloor1Stock(p) > 0);
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    const categoryFiltered = floor1Products.filter((p) => {
      if (selectedCategoryId && getCategoryId(p) !== selectedCategoryId) {
        return false;
      }
      return true;
    });

    const hasSearch = search.trim().length > 0;
    const searched = hasSearch
      ? filterAndRankBySearch(categoryFiltered, search, (p) => [
        { text: p.code, weight: 1.5 },
        { text: p.barcode, weight: 1.5 },
        { text: p.name, weight: 1.3 },
        { text: p.brand, weight: 1.1 },
        { text: getCategoryName(p), weight: 0.9 },
        { text: p.categoryCode, weight: 0.9 },
        {
          text: (p.variants || [])
            .map(
              (v) =>
                `${v.variantCode || resolveVariantCode(p, p.code, v.color, v.size)} ${v.color} ${v.size}`
            )
            .join(" "),
          weight: 1.4,
        },
        { text: p.unit, weight: 0.6 },
      ])
      : categoryFiltered;

    if (hasSearch && sortBy === "CATEGORY") {
      return searched;
    }

    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortBy === "CATEGORY") {
        const catA = getCategoryName(a);
        const catB = getCategoryName(b);
        const cmpCat = catA.localeCompare(catB, "vi");
        if (cmpCat !== 0) return cmpCat;
        return a.name.localeCompare(b.name, "vi");
      }
      if (sortBy === "NAME_ASC") {
        return a.name.localeCompare(b.name, "vi");
      }
      if (sortBy === "PRICE_ASC") {
        return (Number(a.sellingPrice) || 0) - (Number(b.sellingPrice) || 0);
      }
      if (sortBy === "PRICE_DESC") {
        return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
      }
      if (sortBy === "STOCK_DESC") {
        return getFloor1Stock(b) - getFloor1Stock(a);
      }
      return 0;
    });

    return sorted;
  }, [floor1Products, selectedCategoryId, search, sortBy, categories]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();
    filteredAndSortedProducts.forEach((p) => {
      const catName = getCategoryName(p);
      const list = groups.get(catName) || [];
      list.push(p);
      groups.set(catName, list);
    });
    return Array.from(groups.entries());
  }, [filteredAndSortedProducts, categories]);

  const handleLookupPhone = async (phoneValue: string) => {
    const clean = cleanPhoneDigits(phoneValue);
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
      return;
    }
    setLookingUp(true);
    const draftIdAtStart = activeDraftIdRef.current;
    try {
      const res = await apiRequest<any>(`/customers/lookup?phone=${encodeURIComponent(clean)}`);
      if (activeDraftIdRef.current !== draftIdAtStart) return;
      const customer = res.data?.customer || res.data;
      const orders = res.data?.orders || [];
      if (customer && (customer.fullName || customer.name || customer.customerName)) {
        setCustomerName(customer.fullName || customer.name || customer.customerName);
        setIsExistingCustomer(true);
        setCustomerOrders(Array.isArray(orders) ? orders : []);
        setCustomerDebtSummary(res.data?.debtSummary || null);
      } else {
        setIsExistingCustomer(false);
        setCustomerOrders([]);
        setCustomerDebtSummary(null);
      }
    } catch {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
    } finally {
      setLookingUp(false);
    }
  };

  useEffect(() => {
    if (!phoneTypedByUserRef.current) return;
    const clean = cleanPhoneDigits(debouncedCustomerPhone);
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
      return;
    }
    handleLookupPhone(debouncedCustomerPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCustomerPhone]);

  return {
    getDirectFloor1Stock,
    getFloor1Stock,
    getVariantFloor1Stock,
    getCategoryName,
    getCategoryId,
    fetchCategories,
    fetchActivePromotions,
    debouncedSearch,
    debouncedGiftSearch,
    debouncedCustomerPhone,
    phoneTypedByUserRef,
    fetchSellableProducts,
    fetchSavedDraftOrders,
    togglePinGiftProduct,
    floor1Products,
    filteredAndSortedProducts,
    groupedByCategory,
    handleLookupPhone,
  };
}

export type PosCatalogSlice = ReturnType<typeof usePosCatalog>;

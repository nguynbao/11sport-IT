import { apiRequest } from "@/shared/api/client";
import { DEBOUNCE_MS } from "@/config/listing";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { paginateItems } from "@/shared/utils/pagination";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { Category,Order,Product,ProductSalesAnalysisRow,ReturnReceipt } from "@/shared/types";
import { useCallback,useEffect,useMemo,useState } from "react";
import { parseLocalDateBound } from "../utils";
import { API_ENDPOINTS } from "@/shared/api/endpoints";


interface PushProductsReportResponse {
  summary: {
    totalPushProducts: number;
    zeroSalesCount: number;
    highCapitalCount: number;
    floor2OnlyCount: number;
    noPriceCount: number;
    totalPushStock: number;
    totalPushCapitalValue: number;
  };
  needsPushProducts: ProductSalesAnalysisRow[];
  categories: Category[];
}

function buildFallbackPushProducts(
  products: Product[],
  categories: Category[],
  orders: Order[],
  returns: ReturnReceipt[],
  filters: { from: string; to: string; categoryId: string }
): ProductSalesAnalysisRow[] {
  const fromDate = parseLocalDateBound(filters.from, false);
  const toDate = parseLocalDateBound(filters.to, true);
  const inRange = (d?: string | Date | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    if (isNaN(t)) return false;
    if (fromDate && t < fromDate.getTime()) return false;
    if (toDate && t > toDate.getTime()) return false;
    return true;
  };

  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(String(c._id), c.name));

  const getProdCatId = (p?: Product) => {
    if (!p) return "";
    return typeof p.categoryId === "object" ? String(p.categoryId?._id || "") : String(p.categoryId || "");
  };

  const prodById = new Map<string, Product>();
  const prodByCode = new Map<string, Product>();
  products.forEach((p) => {
    prodById.set(String(p._id), p);
    prodByCode.set(String(p.code), p);
  });

  const soldMap = new Map<string, { soldQty: number; giftQty: number; returnedQty: number; exchangeOutQty: number; revenue: number; cogs: number; orderIds: Set<string>; lastSoldAt: string | null }>();

  products.forEach((p) => {
    if (filters.categoryId && getProdCatId(p) !== filters.categoryId) return;
    soldMap.set(String(p._id), {
      soldQty: 0,
      giftQty: 0,
      returnedQty: 0,
      exchangeOutQty: 0,
      revenue: 0,
      cogs: 0,
      orderIds: new Set(),
      lastSoldAt: null,
    });
  });

  for (const o of orders) {
    if (o.status === "DRAFT") continue;
    if (!inRange(o.createdAt)) continue;
    for (const it of o.items || []) {
      const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (!p) continue;
      if (filters.categoryId && getProdCatId(p) !== filters.categoryId) continue;
      const st = soldMap.get(String(p._id));
      if (!st) continue;
      const qty = Number(it.quantity) || 0;
      const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
      if (isGift) st.giftQty += qty;
      else {
        st.soldQty += qty;
        st.revenue += Number(it.lineTotal) || 0;
      }
      st.cogs += qty * (Number(p.costPrice) || 0);
      st.orderIds.add(String(o._id));
      if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
        st.lastSoldAt = o.createdAt;
      }
    }
  }

  for (const r of returns) {
    if (!inRange(r.createdAt)) continue;
    for (const it of r.returnItems || []) {
      const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (!p) continue;
      const st = soldMap.get(String(p._id));
      if (!st) continue;
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const unitCost = Number(p.costPrice) || 0;
      st.returnedQty += qty;
      st.revenue = Math.max(0, st.revenue - line);
      if (it.condition === "GOOD" || (it as { restocked?: boolean }).restocked) {
        st.cogs = Math.max(0, st.cogs - qty * unitCost);
      }
    }
    for (const it of r.exchangeItems || []) {
      const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (!p) continue;
      const st = soldMap.get(String(p._id));
      if (!st) continue;
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const unitCost = Number(p.costPrice) || 0;
      st.exchangeOutQty += qty;
      st.revenue += line;
      st.cogs += qty * unitCost;
    }
  }

  const rows: ProductSalesAnalysisRow[] = [];
  products.forEach((p) => {
    const cId = getProdCatId(p);
    if (filters.categoryId && cId !== filters.categoryId) return;
    const st = soldMap.get(String(p._id));
    const stockFloor1 = Number(p.stockFloor1 ?? p.stock ?? 0);
    const stockFloor2 = Number(p.stockFloor2 ?? 0);
    const stock = Number(p.stock ?? stockFloor1 + stockFloor2);
    if (stock <= 0) return;

    const sellingPrice = Number(p.sellingPrice ?? 0);
    const costPrice = Number(p.costPrice ?? 0);
    const netSoldQty = Math.max(0, (st?.soldQty || 0) + (st?.exchangeOutQty || 0) - (st?.returnedQty || 0));
    const inventoryCostValue = stock * costPrice;
    const inventorySellValue = stock * sellingPrice;

    const pushReasons: string[] = [];
    let suggestedAction = "";
    let pushScore = 0;

    if (sellingPrice <= 0) {
      pushReasons.push("Chưa đặt giá niêm yết (0 VND)");
      suggestedAction = "Cập nhật giá niêm yết trong Quản lý Kho để POS có thể bán";
      pushScore += 100;
    }
    if (stockFloor1 === 0 && stockFloor2 > 0) {
      pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${p.unit || "Cái"})`);
      if (!suggestedAction) {
        suggestedAction = "Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày";
      }
      pushScore += 80 + Math.min(40, stockFloor2 * 2);
    }
    if (netSoldQty === 0) {
      pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${p.unit || "Cái"})`);
      if (!suggestedAction) {
        suggestedAction =
          stock >= 10
            ? "Tồn kho cao chưa phát sinh đơn — Nên chạy khuyến mãi giảm giá % hoặc tặng kèm combo"
            : "Trưng bày nổi bật tại quầy Tầng 1 hoặc tư vấn ưu tiên cho khách";
      }
      pushScore += 50 + Math.min(50, stock * 3);
    } else if (stock >= netSoldQty * 5 && stock >= 6) {
      pushReasons.push(
        `Tồn kho cao gấp ${Math.round(stock / netSoldQty)} lần lượng bán (Tồn ${stock} / Bán ${netSoldQty})`
      );
      if (!suggestedAction) {
        suggestedAction = "Tốc độ tiêu thụ chậm so với lượng tồn — Nên giảm giá nhẹ hoặc đẩy mạnh giới thiệu";
      }
      pushScore += 30 + Math.min(40, stock * 2);
    }
    if (inventoryCostValue >= 3000000 && netSoldQty <= 1) {
      pushReasons.push(`Đọng vốn lớn (${Math.round((inventoryCostValue / 1000000) * 10) / 10}tr VND)`);
      pushScore += 35;
    }

    if (pushScore <= 0) return;

    const rev = st?.revenue || 0;
    const cogs = st?.cogs || 0;
    const profit = rev - cogs;
    rows.push({
      productId: String(p._id),
      productCode: p.code,
      productName: p.name,
      categoryId: cId,
      categoryName: p.categoryName || catMap.get(cId) || "Chưa phân loại",
      unit: p.unit || "Cái",
      soldQty: st?.soldQty || 0,
      giftQty: st?.giftQty || 0,
      returnedQty: st?.returnedQty || 0,
      netSoldQty,
      revenue: rev,
      cogs,
      grossProfit: profit,
      marginPercent: rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
      orderCount: st?.orderIds.size || 0,
      lastSoldAt: st?.lastSoldAt || null,
      sellingPrice,
      costPrice,
      stockFloor1,
      stockFloor2,
      stock,
      inventoryCostValue,
      inventorySellValue,
      restockAlert: "",
      pushScore,
      pushReasons,
      suggestedAction,
    });
  });

  return rows.sort((a, b) => {
    if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
    if (b.inventoryCostValue !== a.inventoryCostValue) return b.inventoryCostValue - a.inventoryCostValue;
    return b.stock - a.stock;
  });
}


export function useMarketingPushProducts(onNavigateToInventory?: (searchCode?: string) => void) {
  const [rows, setRows] = useState<ProductSalesAnalysisRow[]>([]);
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

  const debouncedSearch = useDebounce(pushSearch, DEBOUNCE_MS.LOCAL);

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
        apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE).catch(() => ({ data: [] })),
        apiRequest<Product[]>(API_ENDPOINTS.PRODUCTS.BASE).catch(() => ({ data: [] })),
        apiRequest<Order[]>(API_ENDPOINTS.ORDERS.BASE).catch(() => ({ data: [] })),
        apiRequest<ReturnReceipt[]>(API_ENDPOINTS.RETURNS.BASE).catch(() => ({ data: [] })),
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

  const pushPg = paginateItems(filteredPushProducts, pushPage, pushPageSize);
  const pushTotalPages = pushPg.totalPages;
  const pagedPushProducts = pushPg.items;


  return {
    categories,
    loading,
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
    handleSelectQuickRange,
    loadPushProducts,
    counts,
    filteredPushProducts,
    pushTotalPages,
    pagedPushProducts,
  };
}

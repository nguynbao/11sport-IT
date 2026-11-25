import { apiRequest } from "@/shared/api/client";
import { DEBOUNCE_MS } from "@/config/listing";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { paginateItems } from "@/shared/utils/pagination";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { Category,Order,Product,ReturnReceipt,RevenueDashboardData,ServiceOrder } from "@/shared/types";
import { useCallback,useEffect,useMemo,useState } from "react";
import { buildClientFallbackDashboard } from "../fallbackDashboard";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export interface RevenueDashboardProps {
  onNavigateToInventory?: (searchCode?: string) => void;
  onNavigateToDebts?: () => void;
}

export function useRevenueDashboard({ onNavigateToInventory, onNavigateToDebts }: RevenueDashboardProps) {
  const [data, setData] = useState<RevenueDashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [quickRange, setQuickRange] = useState<
    "ALL" | "TODAY" | "YESTERDAY" | "7D" | "30D" | "MONTH"
  >("ALL");

  // Tuỳ chọn hiển thị Biểu đồ Doanh thu
  const [chartType, setChartType] = useState<"COLUMN" | "AREA" | "HORIZONTAL">("COLUMN");
  const [chartGroupBy, setChartGroupBy] = useState<"HOUR" | "DAY" | "MONTH">("DAY");

  // Sắp xếp & Lọc bảng sản phẩm bán chạy
  const [topSortBy, setTopSortBy] = useState<"QTY" | "REVENUE" | "PROFIT">("QTY");
  const [topSearch, setTopSearch] = useState("");
  const [topPage, setTopPage] = useState(1);
  const [topPageSize, setTopPageSize] = useState(10);

  // Lọc bảng sản phẩm cần đẩy mạnh
  const [pushFilter, setPushFilter] = useState<
    "ALL" | "ZERO_SALES" | "HIGH_CAPITAL" | "FLOOR2_ONLY" | "NO_PRICE"
  >("ALL");
  const [pushSearch, setPushSearch] = useState("");
  const [pushPage, setPushPage] = useState(1);
  const [pushPageSize, setPushPageSize] = useState(10);

  // Phân trang bảng doanh thu theo ngày
  const [dailyPage, setDailyPage] = useState(1);
  const dailyPageSize = 10;

  // Thống kê Công nợ (Mua trước trả sau) — Chỉ hiển thị thông tin trên Dashboard
  const [debtTab, setDebtTab] = useState<"CUSTOMERS" | "ORDERS">("ORDERS");
  const [debtFilter, setDebtFilter] = useState<
    "HAS_DEBT" | "OVERDUE" | "UNPAID" | "PARTIAL" | "SETTLED" | "ALL"
  >("HAS_DEBT");
  const [debtSearch, setDebtSearch] = useState("");
  const [expandedCustomerPhone, setExpandedCustomerPhone] = useState<string | null>(null);

  // Bố cục tab gọn gàng cho Dashboard Doanh thu (tránh trải dài nhiều khu cùng lúc)
  const [dashboardView, setDashboardView] = useState<
    "OVERVIEW" | "PRODUCTS" | "SERVICES" | "DEBTS"
  >("OVERVIEW");
  const [structureView, setStructureView] = useState<"PAYMENT" | "CATEGORY">("PAYMENT");
  const [showDailyTable, setShowDailyTable] = useState(false);

  const toDateInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSelectQuickRange = (
    range: "ALL" | "TODAY" | "YESTERDAY" | "7D" | "30D" | "MONTH"
  ) => {
    setQuickRange(range);
    const now = new Date();
    if (range === "ALL") {
      setFromDate("");
      setToDate("");
      setChartGroupBy("DAY");
    } else if (range === "TODAY") {
      const todayStr = toDateInput(now);
      setFromDate(todayStr);
      setToDate(todayStr);
      setChartGroupBy("HOUR");
    } else if (range === "YESTERDAY") {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = toDateInput(yest);
      setFromDate(yestStr);
      setToDate(yestStr);
      setChartGroupBy("HOUR");
    } else if (range === "7D") {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setFromDate(toDateInput(past));
      setToDate(toDateInput(now));
      setChartGroupBy("DAY");
    } else if (range === "30D") {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      setFromDate(toDateInput(past));
      setToDate(toDateInput(now));
      setChartGroupBy("DAY");
    } else if (range === "MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toDateInput(firstDay));
      setToDate(toDateInput(now));
      setChartGroupBy("DAY");
    }
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      if (categoryId) q.set("categoryId", categoryId);
      if (paymentMethod) q.set("paymentMethod", paymentMethod);

      const catRes = await apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE).catch(() => ({ data: [] }));
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(catList);

      try {
        const res = await apiRequest<RevenueDashboardData>(
          `${API_ENDPOINTS.REPORTS.REVENUE_DASHBOARD}?${q.toString()}`
        );
        if (res.data?.summary) {
          setData(res.data);
          return;
        }
      } catch {
        // Fallback nếu server chưa cập nhật endpoint mới
      }

      const [ordRes, retRes, prodRes, svcRes] = await Promise.all([
        apiRequest<Order[]>(API_ENDPOINTS.ORDERS.BASE),
        apiRequest<ReturnReceipt[]>(API_ENDPOINTS.RETURNS.BASE),
        apiRequest<Product[]>(API_ENDPOINTS.PRODUCTS.BASE),
        apiRequest<ServiceOrder[]>(API_ENDPOINTS.SERVICES.ORDERS).catch(() => ({ data: [] })),
      ]);
      const fallback = buildClientFallbackDashboard(
        Array.isArray(ordRes.data) ? ordRes.data : [],
        Array.isArray(retRes.data) ? retRes.data : [],
        Array.isArray(prodRes.data) ? prodRes.data : [],
        catList,
        { from: fromDate, to: toDate, categoryId, paymentMethod },
        Array.isArray(svcRes.data) ? svcRes.data : []
      );
      setData(fallback);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryId, paymentMethod]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Debounce từ khóa tìm kiếm bảng Top Bán chạy và bảng Cần đẩy bán (350ms)
  const debouncedTopSearch = useDebounce(topSearch, DEBOUNCE_MS.LOCAL);
  const debouncedPushSearch = useDebounce(pushSearch, DEBOUNCE_MS.LOCAL);
  const debouncedDebtSearch = useDebounce(debtSearch, DEBOUNCE_MS.LOCAL);

  // Reset trang khi lọc
  useEffect(() => {
    setTopPage(1);
  }, [topSortBy, debouncedTopSearch, fromDate, toDate, categoryId, paymentMethod, topPageSize]);

  useEffect(() => {
    setPushPage(1);
  }, [pushFilter, debouncedPushSearch, fromDate, toDate, categoryId, paymentMethod, pushPageSize]);

  const sortedTopProducts = useMemo(() => {
    if (!data?.topSellingProducts) return [];
    const q = debouncedTopSearch.trim();
    const base = q
      ? filterAndRankBySearch(data.topSellingProducts, q, (p) => [
        { text: p.productCode, weight: 1.5 },
        { text: p.productName, weight: 1.3 },
        { text: p.categoryName, weight: 0.9 },
      ])
      : [...data.topSellingProducts];

    // Nếu người dùng không tìm kiếm, hoặc chọn tiêu chí sắp xếp cụ thể thì sắp xếp theo tiêu chí đó
    if (!q) {
      base.sort((a, b) => {
        if (topSortBy === "REVENUE") return b.revenue - a.revenue;
        if (topSortBy === "PROFIT") return b.grossProfit - a.grossProfit;
        if (b.netSoldQty !== a.netSoldQty) return b.netSoldQty - a.netSoldQty;
        return b.revenue - a.revenue;
      });
    }
    return base;
  }, [data?.topSellingProducts, debouncedTopSearch, topSortBy]);

  const filteredPushProducts = useMemo(() => {
    if (!data?.needsPushProducts) return [];
    const byType = data.needsPushProducts.filter((p) => {
      if (pushFilter === "ZERO_SALES") return p.netSoldQty === 0;
      if (pushFilter === "HIGH_CAPITAL") return p.inventoryCostValue >= 2000000;
      if (pushFilter === "FLOOR2_ONLY") return p.stockFloor1 === 0 && p.stockFloor2 > 0;
      if (pushFilter === "NO_PRICE") return p.sellingPrice <= 0;
      return true;
    });
    const q = debouncedPushSearch.trim();
    if (!q) return byType;
    return filterAndRankBySearch(byType, q, (p) => [
      { text: p.productCode, weight: 1.5 },
      { text: p.productName, weight: 1.3 },
      { text: p.categoryName, weight: 0.9 },
    ]);
  }, [data?.needsPushProducts, debouncedPushSearch, pushFilter]);

  const topPg = paginateItems(sortedTopProducts, topPage, topPageSize);
  const topTotalPages = topPg.totalPages;
  const pagedTopProducts = topPg.items;

  const pushPg = paginateItems(filteredPushProducts, pushPage, pushPageSize);
  const pushTotalPages = pushPg.totalPages;
  const pagedPushProducts = pushPg.items;

  const reversedDaily = useMemo(() => {
    return [...(data?.dailyTrend || [])].reverse();
  }, [data?.dailyTrend]);
  const dailyPg = paginateItems(reversedDaily, dailyPage, dailyPageSize);
  const dailyTotalPages = dailyPg.totalPages;
  const pagedDaily = dailyPg.items;

  // Dữ liệu chuỗi thời gian cho Biểu đồ (Theo giờ / Theo ngày / Theo tháng)
  const chartSeries = useMemo(() => {
    const raw = data?.dailyTrend || [];
    if (chartGroupBy === "HOUR") {
      const hourlyRaw = data?.hourlyTrend || [];
      const activeDateLabel = (fromDate || toDate || toDateInput(new Date()))
        .split("-")
        .reverse()
        .join("/");
      const filteredHours = hourlyRaw.filter((h) => {
        const hr = Number(h.hour.slice(0, 2));
        return (hr >= 7 && hr <= 21) || h.orders > 0 || h.netRevenue !== 0;
      });
      return filteredHours.map((h) => ({
        key: h.hour,
        label: `${h.hour.slice(0, 2)}h`,
        fullLabel: `${h.hour} (${activeDateLabel})`,
        orders: h.orders,
        unitsSold: h.unitsSold,
        netRevenue: h.cashCollected ?? h.netRevenue,
        grossProfit: h.grossProfit,
        cogs: h.cogs,
      }));
    }

    if (chartGroupBy === "DAY") {
      return raw.slice(-31).map((d) => ({
        key: d.date,
        label: d.date.slice(5).split("-").reverse().join("/"),
        fullLabel: d.date.split("-").reverse().join("/"),
        orders: d.orders,
        unitsSold: d.unitsSold,
        netRevenue: d.cashCollected ?? d.netRevenue,
        grossProfit: d.grossProfit,
        cogs: d.cogs,
      }));
    }

    const monthMap = new Map<
      string,
      {
        key: string;
        label: string;
        fullLabel: string;
        orders: number;
        unitsSold: number;
        netRevenue: number;
        grossProfit: number;
        cogs: number;
      }
    >();

    // Tạo khung 6 tháng gần nhất để biểu đồ Theo Tháng luôn có chuỗi so sánh
    const refNow = toDate ? new Date(`${toDate}T12:00:00`) : new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refNow.getFullYear(), refNow.getMonth() - i, 1);
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const ym = `${yyyy}-${mm}`;
      monthMap.set(ym, {
        key: ym,
        label: `T${Number(mm)}/${yyyy.slice(2)}`,
        fullLabel: `Tháng ${mm}/${yyyy}`,
        orders: 0,
        unitsSold: 0,
        netRevenue: 0,
        grossProfit: 0,
        cogs: 0,
      });
    }

    raw.forEach((d) => {
      const ym = d.date.slice(0, 7); // YYYY-MM
      const [yyyy, mm] = ym.split("-");
      if (!monthMap.has(ym)) {
        monthMap.set(ym, {
          key: ym,
          label: `T${Number(mm)}/${yyyy.slice(2)}`,
          fullLabel: `Tháng ${mm}/${yyyy}`,
          orders: 0,
          unitsSold: 0,
          netRevenue: 0,
          grossProfit: 0,
          cogs: 0,
        });
      }
      const m = monthMap.get(ym)!;
      m.orders += d.orders;
      m.unitsSold += d.unitsSold;
      m.netRevenue += d.cashCollected ?? d.netRevenue;
      m.grossProfit += d.grossProfit;
      m.cogs += d.cogs;
    });
    return Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [data?.dailyTrend, data?.hourlyTrend, chartGroupBy, fromDate, toDate]);

  const maxSeriesRevenue = useMemo(() => {
    if (chartSeries.length === 0) return 1;
    return Math.max(1, ...chartSeries.map((d) => Math.max(0, d.netRevenue, d.grossProfit)));
  }, [chartSeries]);

  const avgSeriesRevenue = useMemo(() => {
    if (chartSeries.length === 0) return 0;
    const sum = chartSeries.reduce((acc, d) => acc + Math.max(0, d.netRevenue), 0);
    return Math.round(sum / chartSeries.length);
  }, [chartSeries]);

  // Top 8 sản phẩm có doanh thu cao nhất để vẽ biểu đồ so sánh
  const top8RevenueProducts = useMemo(() => {
    if (!data?.topSellingProducts) return [];
    return [...data.topSellingProducts]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [data?.topSellingProducts]);

  const maxTop8Rev = useMemo(() => {
    if (top8RevenueProducts.length === 0) return 1;
    return Math.max(1, ...top8RevenueProducts.map((p) => p.revenue));
  }, [top8RevenueProducts]);

  const filteredDebtOrders = useMemo(() => {
    const list = data?.debtManagement?.orders || [];
    const byStatus = list.filter((o) => {
      if (debtFilter === "HAS_DEBT") return o.debtAmount > 0;
      if (debtFilter === "OVERDUE") return o.isOverdue && o.debtAmount > 0;
      if (debtFilter === "UNPAID") return o.debtStatus === "UNPAID" && o.debtAmount > 0;
      if (debtFilter === "PARTIAL") return o.debtStatus === "PARTIAL" && o.debtAmount > 0;
      if (debtFilter === "SETTLED") return o.debtStatus === "SETTLED" || o.debtAmount === 0;
      return true;
    });
    const q = debouncedDebtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (o) => [
      { text: o.orderCode, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      { text: o.customerPhone, weight: 1.4 },
    ]);
  }, [data?.debtManagement?.orders, debtFilter, debtSearch]);

  const filteredDebtCustomers = useMemo(() => {
    const list = data?.debtManagement?.customers || [];
    const byStatus = list.filter((c) => {
      if (debtFilter === "HAS_DEBT") return c.totalDebtAmount > 0;
      if (debtFilter === "OVERDUE") return c.overdueOrders > 0 && c.totalDebtAmount > 0;
      if (debtFilter === "SETTLED") return c.totalDebtAmount === 0;
      return true;
    });
    const q = debtSearch.trim();
    if (!q) return byStatus;
    return filterAndRankBySearch(byStatus, q, (c) => [
      { text: c.customerName, weight: 1.4 },
      { text: c.phone, weight: 1.5 },
    ]);
  }, [data?.debtManagement?.customers, debtFilter, debtSearch]);

  const s = data?.summary;
  const dm = data?.debtManagement;


  return {
    data,
    categories,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    categoryId,
    setCategoryId,
    paymentMethod,
    setPaymentMethod,
    quickRange,
    setQuickRange,
    chartType,
    setChartType,
    chartGroupBy,
    setChartGroupBy,
    topSortBy,
    setTopSortBy,
    topSearch,
    setTopSearch,
    topPage,
    setTopPage,
    topPageSize,
    setTopPageSize,
    dailyPage,
    setDailyPage,
    debtTab,
    setDebtTab,
    debtFilter,
    setDebtFilter,
    debtSearch,
    setDebtSearch,
    expandedCustomerPhone,
    setExpandedCustomerPhone,
    dashboardView,
    setDashboardView,
    structureView,
    setStructureView,
    showDailyTable,
    setShowDailyTable,
    handleSelectQuickRange,
    loadDashboard,
    sortedTopProducts,
    topTotalPages,
    pagedTopProducts,
    reversedDaily,
    dailyTotalPages,
    pagedDaily,
    chartSeries,
    maxSeriesRevenue,
    avgSeriesRevenue,
    top8RevenueProducts,
    maxTop8Rev,
    filteredDebtOrders,
    filteredDebtCustomers,
    s,
    dm,
  };
}

export type RevenueDashboardViewModel = ReturnType<typeof useRevenueDashboard>;

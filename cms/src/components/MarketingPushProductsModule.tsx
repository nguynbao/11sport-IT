"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { exportPushProducts } from "@/lib/exports";
import {
  ProductSalesAnalysisRow,
  Category,
  Product,
  Order,
  ReturnReceipt,
  apiRequest,
  formatVND,
  useDebounce,
  filterAndRankBySearch,
} from "@/lib/api";
import {
  Rocket,
  Search,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Boxes,
  DollarSign,
  TrendingDown,
  Tag,
} from "lucide-react";

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

function parseLocalDateBound(raw: string | undefined | null, isEnd: boolean): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return isEnd ? new Date(y, mo, d, 23, 59, 59, 999) : new Date(y, mo, d, 0, 0, 0, 0);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  if (isEnd) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
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
      if (st) st.returnedQty += Number(it.quantity) || 0;
    }
    for (const it of r.exchangeItems || []) {
      const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (!p) continue;
      const st = soldMap.get(String(p._id));
      if (st) st.exchangeOutQty += Number(it.quantity) || 0;
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
      pushReasons.push("Chưa đặt giá bán (0 VND)");
      suggestedAction = "Cập nhật giá bán lẻ trong Quản lý Kho để POS có thể bán";
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

export default function MarketingPushProductsModule() {
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

  return (
    <div className="space-y-6">
      {/* HEADER & BỘ LỌC KỲ QUAN SÁT */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-amber-400 flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5" />
              Phân hệ Marketing & Chiến dịch Đẩy hàng — 11Sport
            </div>
            <h2 className="text-lg font-extrabold mt-0.5">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Quan sát trực tiếp các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, hoặc đang nằm ở Kho Tầng 2 cần lên chiến dịch nội dung & khuyến mãi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPushProducts}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
              Làm mới dữ liệu
            </button>
            {filteredPushProducts.length > 0 && (
              <ExportExcelButton
                label="Xuất Excel SP Cần đẩy mạnh"
                onExport={() => exportPushProducts(filteredPushProducts, fromDate, toDate)}
              />
            )}
          </div>
        </div>

        {/* Bộ lọc kỳ quan sát & Category */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-800 items-end">
          <div className="lg:col-span-6">
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
              Chọn nhanh kỳ quan sát lượng bán
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "ALL", label: "Toàn thời gian" },
                  { id: "TODAY", label: "Hôm nay" },
                  { id: "YESTERDAY", label: "Hôm qua" },
                  { id: "7D", label: "7 ngày qua" },
                  { id: "30D", label: "30 ngày qua" },
                  { id: "MONTH", label: "Tháng này" },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectQuickRange(btn.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    quickRange === btn.id
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setQuickRange("ALL");
                  setFromDate(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setQuickRange("ALL");
                  setToDate(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Lọc theo Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-semibold"
            >
              <option value="">Tất cả Category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
              <Calendar className="w-3.5 h-3.5" />
              Kỳ đang quan sát:{" "}
              {fromDate || toDate
                ? `${fromDate ? fromDate.split("-").reverse().join("/") : "Đầu kỳ"} → ${
                    toDate ? toDate.split("-").reverse().join("/") : "Hiện tại"
                  }`
                : "Toàn thời gian"}
            </span>
          </div>
          {(fromDate || toDate || categoryId || pushFilter !== "ALL" || pushSearch) && (
            <button
              type="button"
              onClick={() => {
                setCategoryId("");
                setPushFilter("ALL");
                setPushSearch("");
                handleSelectQuickRange("ALL");
              }}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Xóa bộ lọc (Xem toàn bộ)
            </button>
          )}
        </div>
      </div>

      {/* 4 THẺ KPI TỔNG QUAN CHO MARKETING */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setPushFilter("ALL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ALL" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              1. Tổng SP Cần Đẩy Mạnh
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Rocket className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {counts.all} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng lượng tồn cần đẩy: <strong className="text-slate-800">{counts.totalStock}</strong> sản phẩm
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("ZERO_SALES")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ZERO_SALES" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              2. Chưa Bán Được Chiếc Nào
            </span>
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 mt-2">
            {counts.zeroSales} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            SL bán trong kỳ = 0 · Cần chạy nội dung / khuyến mãi
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("HIGH_CAPITAL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "HIGH_CAPITAL" ? "border-amber-600 ring-2 ring-amber-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              3. Đọng Vốn Cao (≥ 2tr)
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-800 mt-2">
            {counts.highCapital} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng vốn tồn đọng: <strong className="text-amber-800 font-mono">{formatVND(counts.totalCapital)}</strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("FLOOR2_ONLY")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "FLOOR2_ONLY" ? "border-purple-600 ring-2 ring-purple-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              4. Nằm Ở Kho Tầng 2 (T1 = 0)
            </span>
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-700 mt-2">
            {counts.floor2Only} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Chưa có hàng trưng bày tại Showroom Tầng 1
          </div>
        </button>
      </div>

      {/* BẢNG CHI TIẾT CÁC SẢN PHẨM ĐANG CẦN ĐẨY MẠNH (MỞ HOÀN TOÀN CHO MARKETING QUAN SÁT) */}
      <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 mb-1">
              <Rocket className="w-3.5 h-3.5 text-amber-600" />
              CẦN ĐẨY MẠNH BÁN HÀNG / TỐI ƯU KHO
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h3>
            <p className="text-xs text-slate-500">
              Hệ thống tự động phát hiện các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, đang nằm ở Kho Tầng 2 mà Tầng 1 = 0, hoặc chưa đặt giá bán.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={pushSearch}
                onChange={(e) => setPushSearch(e.target.value)}
                placeholder="Tìm mã, tên SP hoặc danh mục..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <select
              value={pushFilter}
              onChange={(e) => setPushFilter(e.target.value as typeof pushFilter)}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-xs font-bold text-slate-900"
            >
              <option value="ALL">Tất cả SP cần đẩy mạnh ({counts.all})</option>
              <option value="ZERO_SALES">Chưa bán được chiếc nào ({counts.zeroSales})</option>
              <option value="HIGH_CAPITAL">Đọng vốn cao ≥ 2tr ({counts.highCapital})</option>
              <option value="FLOOR2_ONLY">Tầng 1 = 0, nằm ở Tầng 2 ({counts.floor2Only})</option>
              <option value="NO_PRICE">Chưa đặt giá bán ({counts.noPrice})</option>
            </select>

            <select
              value={pushPageSize}
              onChange={(e) => setPushPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value={10}>10 dòng / trang</option>
              <option value={15}>15 dòng / trang</option>
              <option value={30}>30 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-3">Mã & Tên sản phẩm</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Tồn kho hiện tại</th>
                <th className="py-3 px-3 text-right">Đã bán trong kỳ</th>
                <th className="py-3 px-3 text-right">Giá gốc / Giá bán</th>
                <th className="py-3 px-3 text-right bg-amber-950 text-amber-300">
                  Vốn đang đọng
                </th>
                <th className="py-3 px-3">Lý do cần đẩy mạnh</th>
                <th className="py-3 px-3">Đề xuất hành động Marketing / Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-semibold">
                    Đang tải danh sách sản phẩm cần đẩy mạnh...
                  </td>
                </tr>
              ) : pagedPushProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Không có sản phẩm nào khớp với điều kiện lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pagedPushProducts.map((p, idx) => (
                  <tr
                    key={p.productId || p.productCode}
                    className="hover:bg-amber-50/30 transition"
                  >
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                      {(pushPage - 1) * pushPageSize + idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{p.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {p.productCode}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="font-extrabold text-slate-900">
                        {p.stock} {p.unit}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        🏢 T1: <b className="text-emerald-700">{p.stockFloor1}</b> · 🏬 T2:{" "}
                        <b className="text-purple-700">{p.stockFloor2}</b>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      {p.netSoldQty} {p.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="text-slate-600">Gốc: {formatVND(p.costPrice)}</div>
                      <div className="font-bold text-emerald-700">
                        Bán: {formatVND(p.sellingPrice)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                      {formatVND(p.inventoryCostValue)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        {p.pushReasons.map((reason, rIdx) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold text-[11px]"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[11px] font-semibold text-slate-800">
                        💡 {p.suggestedAction}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {filteredPushProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600">
            <span>
              Hiển thị{" "}
              <strong>
                {(pushPage - 1) * pushPageSize + 1}–
                {Math.min(pushPage * pushPageSize, filteredPushProducts.length)}
              </strong>{" "}
              trên tổng <strong>{filteredPushProducts.length}</strong> sản phẩm cần đẩy mạnh
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pushPage <= 1}
                onClick={() => setPushPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <span className="px-3 py-1.5 font-mono font-bold text-slate-900">
                Trang {pushPage} / {pushTotalPages}
              </span>
              <button
                type="button"
                disabled={pushPage >= pushTotalPages}
                onClick={() => setPushPage((p) => Math.min(pushTotalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                Tiếp <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

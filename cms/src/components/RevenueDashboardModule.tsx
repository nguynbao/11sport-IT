"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { exportRevenueDashboard } from "@/lib/exports";
import {
  RevenueDashboardData,
  ProductSalesAnalysisRow,
  Category,
  Order,
  ReturnReceipt,
  Product,
  apiRequest,
  formatVND,
} from "@/lib/api";
import {
  TrendingUp,
  Flame,
  Rocket,
  DollarSign,
  ShoppingBag,
  PackageCheck,
  AlertTriangle,
  Search,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
} from "lucide-react";

interface Props {
  onNavigateToInventory?: (searchCode?: string) => void;
}

function parseLocalDateBound(raw: string | undefined | null, isEnd: boolean): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return isEnd
      ? new Date(y, mo, d, 23, 59, 59, 999)
      : new Date(y, mo, d, 0, 0, 0, 0);
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  if (isEnd) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Tính toán dự phòng phía client nếu server chưa có endpoint /reports/revenue-dashboard */
function buildClientFallbackDashboard(
  orders: Order[],
  returns: ReturnReceipt[],
  products: Product[],
  categories: Category[],
  filters: { from: string; to: string; categoryId: string; paymentMethod: string }
): RevenueDashboardData {
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

  const prodById = new Map<string, Product>();
  const prodByCode = new Map<string, Product>();
  products.forEach((p) => {
    prodById.set(String(p._id), p);
    prodByCode.set(String(p.code), p);
  });

  const filterCatId = filters.categoryId || "";
  const filterPayMethod = filters.paymentMethod ? filters.paymentMethod.toUpperCase() : "";

  const getProdCatId = (p?: Product) => {
    if (!p) return "";
    return typeof p.categoryId === "object" ? String(p.categoryId?._id || "") : String(p.categoryId || "");
  };

  const filteredOrders = orders.filter((o) => {
    if (!inRange(o.createdAt)) return false;
    if (filterPayMethod && o.paymentMethod !== filterPayMethod) return false;
    if (filterCatId) {
      const hasCat = (o.items || []).some((it) => {
        const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        return p && getProdCatId(p) === filterCatId;
      });
      if (!hasCat) return false;
    }
    return true;
  });

  const filteredReturns = returns.filter((r) => {
    if (!inRange(r.createdAt)) return false;
    if (filterPayMethod && r.refundMethod !== filterPayMethod) return false;
    if (filterCatId) {
      const hasCat =
        (r.returnItems || []).some((it: any) => {
          const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
          return p && getProdCatId(p) === filterCatId;
        }) ||
        (r.exchangeItems || []).some((it: any) => {
          const p = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
          return p && getProdCatId(p) === filterCatId;
        });
      if (!hasCat) return false;
    }
    return true;
  });

  let grossRevenue = 0;
  let itemDiscountTotal = 0;
  let billDiscountTotal = 0;
  let cardFeeTotal = 0;
  let orderRevenue = 0;
  let totalUnitsSold = 0;
  let totalGiftUnits = 0;
  let estimatedCogs = 0;

  interface ProdStat {
    productId: string;
    productCode: string;
    productName: string;
    categoryId: string;
    categoryName: string;
    unit: string;
    soldQty: number;
    giftQty: number;
    returnedQty: number;
    exchangeOutQty: number;
    revenue: number;
    cogs: number;
    orderIds: Set<string>;
    lastSoldAt: string | null;
  }

  const prodStats = new Map<string, ProdStat>();
  const ensureProdStat = (pId: string, pCode: string, pName: string, unit: string): ProdStat => {
    const prod = prodById.get(pId) || prodByCode.get(pCode);
    const key = prod ? String(prod._id) : pCode || pId;
    if (!prodStats.has(key)) {
      const cId = getProdCatId(prod);
      prodStats.set(key, {
        productId: prod ? String(prod._id) : pId,
        productCode: prod ? prod.code : pCode,
        productName: prod ? prod.name : pName,
        categoryId: cId,
        categoryName: prod?.categoryName || catMap.get(cId) || "Chưa phân loại",
        unit: prod ? prod.unit : unit || "Cái",
        soldQty: 0,
        giftQty: 0,
        returnedQty: 0,
        exchangeOutQty: 0,
        revenue: 0,
        cogs: 0,
        orderIds: new Set<string>(),
        lastSoldAt: null,
      });
    }
    return prodStats.get(key)!;
  };

  products.forEach((p) => {
    if (filterCatId && getProdCatId(p) !== filterCatId) return;
    ensureProdStat(String(p._id), p.code, p.name, p.unit);
  });

  const dailyMap = new Map<
    string,
    {
      date: string;
      orders: number;
      unitsSold: number;
      grossRevenue: number;
      discountTotal: number;
      orderRevenue: number;
      returnImpact: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
    }
  >();

  const ensureDay = (d: string | Date) => {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        date: key,
        orders: 0,
        unitsSold: 0,
        grossRevenue: 0,
        discountTotal: 0,
        orderRevenue: 0,
        returnImpact: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }
    return dailyMap.get(key)!;
  };

  if (fromDate && toDate && toDate.getTime() >= fromDate.getTime()) {
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000));
    if (diffDays <= 62) {
      const cur = new Date(fromDate);
      while (cur.getTime() <= toDate.getTime()) {
        ensureDay(cur);
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const hourlyMap = new Map<
    string,
    {
      hour: string;
      orders: number;
      unitsSold: number;
      grossRevenue: number;
      discountTotal: number;
      orderRevenue: number;
      returnImpact: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
    }
  >();

  const ensureHour = (d: string | Date) => {
    const dt = new Date(d);
    const hh = String(dt.getHours()).padStart(2, "0");
    const key = `${hh}:00`;
    if (!hourlyMap.has(key)) {
      hourlyMap.set(key, {
        hour: key,
        orders: 0,
        unitsSold: 0,
        grossRevenue: 0,
        discountTotal: 0,
        orderRevenue: 0,
        returnImpact: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }
    return hourlyMap.get(key)!;
  };

  const paymentStats: Record<string, { method: string; label: string; orders: number; revenue: number }> = {
    CASH: { method: "CASH", label: "Tiền mặt", orders: 0, revenue: 0 },
    BANKING: { method: "BANKING", label: "Chuyển khoản", orders: 0, revenue: 0 },
    CARD: { method: "CARD", label: "Quẹt thẻ", orders: 0, revenue: 0 },
    OTHER: { method: "OTHER", label: "Khác", orders: 0, revenue: 0 },
  };

  for (const o of filteredOrders) {
    const day = ensureDay(o.createdAt);
    const hr = ensureHour(o.createdAt);
    day.orders += 1;
    hr.orders += 1;

    const orderSub = Number(o.subtotal) || 0;
    const orderBillDisc = Number(o.billDiscountAmount) || 0;
    const orderCardFee = Number(o.cardFee) || 0;
    const orderTotal = Number(o.totalAmount) || 0;

    let orderIncludedGross = 0;
    let orderIncludedItemDisc = 0;
    let orderIncludedLineTotal = 0;
    let orderIncludedCogs = 0;
    let orderIncludedUnits = 0;

    for (const it of o.items || []) {
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;

      const qty = Number(it.quantity) || 0;
      const isGift = Boolean(it.isGift) || it.discountType === "GIFT";
      const origPrice = Number(it.originalUnitPrice ?? it.unitPrice) || 0;
      const lineTotal = Number(it.lineTotal) || 0;
      const itemDisc = Number(it.discountAmount) || 0;
      const unitCost = Number(prod?.costPrice) || 0;

      const billDiscShare =
        !isGift && orderSub > 0 ? Math.round((lineTotal / orderSub) * orderBillDisc) : 0;
      const netItemRev = Math.max(0, lineTotal - billDiscShare);
      const itemCogs = qty * unitCost;

      if (isGift) {
        totalGiftUnits += qty;
      } else {
        totalUnitsSold += qty;
        orderIncludedUnits += qty;
        orderIncludedGross += origPrice * qty;
        orderIncludedItemDisc += itemDisc;
        orderIncludedLineTotal += lineTotal;
      }
      orderIncludedCogs += itemCogs;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      if (isGift) {
        st.giftQty += qty;
      } else {
        st.soldQty += qty;
        st.revenue += netItemRev;
      }
      st.cogs += itemCogs;
      st.orderIds.add(String(o._id));
      if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
        st.lastSoldAt = o.createdAt;
      }
    }

    const effectiveBillDisc = filterCatId
      ? orderSub > 0
        ? Math.round((orderIncludedLineTotal / orderSub) * orderBillDisc)
        : 0
      : orderBillDisc;
    const effectiveCardFee = filterCatId ? 0 : orderCardFee;
    const effectiveOrderRev = filterCatId
      ? Math.max(0, orderIncludedLineTotal - effectiveBillDisc)
      : orderTotal;

    grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    itemDiscountTotal += filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0;
    billDiscountTotal += effectiveBillDisc;
    cardFeeTotal += effectiveCardFee;
    orderRevenue += effectiveOrderRev;
    estimatedCogs += orderIncludedCogs;

    day.unitsSold += orderIncludedUnits;
    day.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    day.discountTotal +=
      (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
    day.orderRevenue += effectiveOrderRev;
    day.netRevenue += effectiveOrderRev;
    day.cogs += orderIncludedCogs;
    day.grossProfit = day.netRevenue - day.cogs;

    hr.unitsSold += orderIncludedUnits;
    hr.grossRevenue += filterCatId ? orderIncludedGross : Number(o.rawSubtotal ?? o.subtotal) || 0;
    hr.discountTotal +=
      (filterCatId ? orderIncludedItemDisc : Number(o.itemDiscountTotal) || 0) + effectiveBillDisc;
    hr.orderRevenue += effectiveOrderRev;
    hr.netRevenue += effectiveOrderRev;
    hr.cogs += orderIncludedCogs;
    hr.grossProfit = hr.netRevenue - hr.cogs;

    const pm = paymentStats[o.paymentMethod] || paymentStats.OTHER;
    pm.orders += 1;
    pm.revenue += effectiveOrderRev;
  }

  let returnTotal = 0;
  let exchangeTotal = 0;
  let netReturnImpact = 0;
  let totalUnitsReturned = 0;

  for (const r of filteredReturns) {
    const day = ensureDay(r.createdAt);
    const hr = ensureHour(r.createdAt);
    let rRetTotal = 0;
    let rExTotal = 0;
    let rCogsImpact = 0;

    for (const it of r.returnItems || []) {
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const unitCost = Number(prod?.costPrice) || 0;
      totalUnitsReturned += qty;
      rRetTotal += line;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      st.returnedQty += qty;
      st.revenue = Math.max(0, st.revenue - line);
      if (it.condition === "GOOD" || it.restocked) {
        st.cogs = Math.max(0, st.cogs - qty * unitCost);
        rCogsImpact -= qty * unitCost;
      }
    }

    for (const it of r.exchangeItems || []) {
      const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
      if (filterCatId && (!prod || getProdCatId(prod) !== filterCatId)) continue;
      const qty = Number(it.quantity) || 0;
      const line = Number(it.lineTotal) || 0;
      const unitCost = Number(prod?.costPrice) || 0;
      rExTotal += line;

      const st = ensureProdStat(String(it.productId), it.productCode, it.productName, it.unit);
      st.exchangeOutQty += qty;
      st.revenue += line;
      st.cogs += qty * unitCost;
      rCogsImpact += qty * unitCost;
    }

    const diff = filterCatId ? rExTotal - rRetTotal : Number(r.netDifference) || 0;
    returnTotal += filterCatId ? rRetTotal : Number(r.returnTotal) || 0;
    exchangeTotal += filterCatId ? rExTotal : Number(r.exchangeTotal) || 0;
    netReturnImpact += diff;
    estimatedCogs = Math.max(0, estimatedCogs + rCogsImpact);

    day.returnImpact += diff;
    day.netRevenue += diff;
    day.cogs = Math.max(0, day.cogs + rCogsImpact);
    day.grossProfit = day.netRevenue - day.cogs;

    hr.returnImpact += diff;
    hr.netRevenue += diff;
    hr.cogs = Math.max(0, hr.cogs + rCogsImpact);
    hr.grossProfit = hr.netRevenue - hr.cogs;
  }

  const netRevenue = orderRevenue + netReturnImpact;
  const grossProfit = netRevenue - estimatedCogs;
  const grossMarginPercent =
    netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;
  const totalOrders = filteredOrders.length;
  const paidOrders = filteredOrders.filter((o) => o.status === "PAID").length;
  const returnedOrders = filteredOrders.filter((o) => o.status !== "PAID").length;
  const avgOrderValue = totalOrders > 0 ? Math.round(orderRevenue / totalOrders) : 0;

  const byPaymentMethod = Object.values(paymentStats).map((pm) => ({
    ...pm,
    sharePercent: orderRevenue > 0 ? Math.round((pm.revenue / orderRevenue) * 1000) / 10 : 0,
  }));

  const catStatsMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
    }
  >();

  prodStats.forEach((st) => {
    const netUnits = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
    if (netUnits === 0 && st.revenue === 0) return;
    const key = st.categoryId || "UNCATEGORIZED";
    if (!catStatsMap.has(key)) {
      catStatsMap.set(key, {
        categoryId: key,
        categoryName: st.categoryName,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }
    const cRow = catStatsMap.get(key)!;
    cRow.unitsSold += netUnits;
    cRow.revenue += st.revenue;
    cRow.cogs += st.cogs;
    cRow.grossProfit = cRow.revenue - cRow.cogs;
  });

  const totalCatRev = Array.from(catStatsMap.values()).reduce((s, c) => s + c.revenue, 0);
  const byCategory = Array.from(catStatsMap.values())
    .map((c) => ({
      ...c,
      sharePercent: totalCatRev > 0 ? Math.round((c.revenue / totalCatRev) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const allProductRows: ProductSalesAnalysisRow[] = Array.from(prodStats.values()).map((st) => {
    const prod = prodById.get(st.productId) || prodByCode.get(st.productCode);
    const stockFloor1 = Number(prod?.stockFloor1 ?? prod?.stock ?? 0);
    const stockFloor2 = Number(prod?.stockFloor2 ?? 0);
    const stock = stockFloor1 + stockFloor2;
    const sellingPrice = Number(prod?.sellingPrice ?? 0);
    const costPrice = Number(prod?.costPrice ?? 0);
    const netSoldQty = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
    const profit = st.revenue - st.cogs;
    const marginPercent = st.revenue > 0 ? Math.round((profit / st.revenue) * 1000) / 10 : 0;
    const inventoryCostValue = stock * costPrice;
    const inventorySellValue = stock * sellingPrice;

    let restockAlert = "";
    if (netSoldQty > 0) {
      if (stock === 0) {
        restockAlert = "Hết hàng toàn kho — Cần nhập thêm gấp";
      } else if (stockFloor1 === 0 && stockFloor2 > 0) {
        restockAlert = `Hết hàng Tầng 1 (Tầng 2 còn ${stockFloor2}) — Cần xuất chuyển tầng xuống Tầng 1`;
      } else if (stockFloor1 <= 2 && stockFloor2 > 0) {
        restockAlert = `Tầng 1 sắp hết (còn ${stockFloor1}, Tầng 2 có ${stockFloor2}) — Nên dời thêm từ Tầng 2`;
      } else if (stock <= 3) {
        restockAlert = `Sắp hết hàng (Tổng tồn còn ${stock}) — Nên nhập bổ sung`;
      }
    }

    const pushReasons: string[] = [];
    let suggestedAction = "";
    let pushScore = 0;

    if (stock > 0) {
      if (sellingPrice <= 0) {
        pushReasons.push("Chưa đặt giá bán (0 VND)");
        suggestedAction = "Cập nhật giá bán lẻ trong Quản lý Kho để POS có thể bán";
        pushScore += 100;
      }
      if (stockFloor1 === 0 && stockFloor2 > 0) {
        pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${st.unit})`);
        if (!suggestedAction) {
          suggestedAction = "Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày";
        }
        pushScore += 80 + Math.min(40, stockFloor2 * 2);
      }
      if (netSoldQty === 0) {
        pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${st.unit})`);
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
        pushReasons.push(
          `Đọng vốn lớn (${Math.round((inventoryCostValue / 1000000) * 10) / 10}tr VND)`
        );
        pushScore += 35;
      }
    }

    return {
      productId: st.productId,
      productCode: st.productCode,
      productName: st.productName,
      categoryId: st.categoryId,
      categoryName: st.categoryName,
      unit: st.unit,
      soldQty: st.soldQty,
      giftQty: st.giftQty,
      returnedQty: st.returnedQty,
      netSoldQty,
      revenue: st.revenue,
      cogs: st.cogs,
      grossProfit: profit,
      marginPercent,
      orderCount: st.orderIds.size,
      lastSoldAt: st.lastSoldAt,
      sellingPrice,
      costPrice,
      stockFloor1,
      stockFloor2,
      stock,
      inventoryCostValue,
      inventorySellValue,
      restockAlert,
      pushScore,
      pushReasons,
      suggestedAction,
    };
  });

  const topSellingProducts = allProductRows
    .filter((r) => r.netSoldQty > 0 || r.soldQty > 0)
    .sort((a, b) => {
      if (b.netSoldQty !== a.netSoldQty) return b.netSoldQty - a.netSoldQty;
      return b.revenue - a.revenue;
    });

  const needsPushProducts = allProductRows
    .filter((r) => r.stock > 0 && r.pushScore > 0)
    .sort((a, b) => {
      if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
      if (b.inventoryCostValue !== a.inventoryCostValue)
        return b.inventoryCostValue - a.inventoryCostValue;
      return b.stock - a.stock;
    });

  if (!fromDate && !toDate) {
    const latestKey = Array.from(dailyMap.keys()).sort().pop();
    const anchor = latestKey ? parseLocalDateBound(latestKey, false) || new Date() : new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      ensureDay(d);
    }
  }

  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const hourlyTrend = Array.from(hourlyMap.values()).sort((a, b) =>
    a.hour.localeCompare(b.hour)
  );

  return {
    summary: {
      grossRevenue,
      itemDiscountTotal,
      billDiscountTotal,
      totalDiscount: itemDiscountTotal + billDiscountTotal,
      cardFeeTotal,
      orderRevenue,
      returnTotal,
      exchangeTotal,
      netReturnImpact,
      netRevenue,
      estimatedCogs,
      grossProfit,
      grossMarginPercent,
      totalOrders,
      paidOrders,
      returnedOrders,
      avgOrderValue,
      totalUnitsSold,
      totalGiftUnits,
      totalUnitsReturned,
    },
    byPaymentMethod,
    byCategory,
    dailyTrend,
    hourlyTrend,
    topSellingProducts,
    needsPushProducts,
  };
}

const CHART_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#6366f1", // indigo-500
];

function formatShortVND(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}tr`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

/** Biểu đồ Tròn Donut (SVG) hiển thị tỷ trọng trực quan */
function SvgDonutChart({
  items,
  centerLabel,
  centerValue,
}: {
  items: { label: string; value: number; sharePercent: number; color: string; sub?: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const activeItems = items.filter((i) => i.value > 0);
  const total = activeItems.reduce((s, i) => s + i.value, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="#e2e8f0"
            strokeWidth="18"
          />
          {total > 0 &&
            activeItems.map((item, idx) => {
              const pct = item.value / total;
              const strokeDasharray = `${pct * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativePercent * circumference;
              cumulativePercent += pct;
              return (
                <circle
                  key={idx}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="18"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">{centerLabel}</span>
          <span className="text-xs font-black font-mono text-slate-900 mt-0.5">{centerValue}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-bold text-slate-800 truncate">{item.label}</span>
              {item.sub && <span className="text-[10px] text-slate-400 shrink-0">({item.sub})</span>}
            </div>
            <div className="font-mono text-right shrink-0">
              <span className="font-extrabold text-slate-900">{formatShortVND(item.value)}</span>
              <span className="ml-1.5 text-[11px] font-bold text-slate-500">
                ({item.sharePercent}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RevenueDashboardModule({ onNavigateToInventory }: Props) {
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

      const catRes = await apiRequest<Category[]>("/categories").catch(() => ({ data: [] }));
      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(catList);

      try {
        const res = await apiRequest<RevenueDashboardData>(
          `/reports/revenue-dashboard?${q.toString()}`
        );
        if (res.data?.summary) {
          setData(res.data);
          return;
        }
      } catch {
        // Fallback nếu server chưa cập nhật endpoint mới
      }

      const [ordRes, retRes, prodRes] = await Promise.all([
        apiRequest<Order[]>("/orders"),
        apiRequest<ReturnReceipt[]>("/returns"),
        apiRequest<Product[]>("/products"),
      ]);
      const fallback = buildClientFallbackDashboard(
        Array.isArray(ordRes.data) ? ordRes.data : [],
        Array.isArray(retRes.data) ? retRes.data : [],
        Array.isArray(prodRes.data) ? prodRes.data : [],
        catList,
        { from: fromDate, to: toDate, categoryId, paymentMethod }
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

  // Reset trang khi lọc
  useEffect(() => {
    setTopPage(1);
  }, [topSortBy, topSearch, fromDate, toDate, categoryId, paymentMethod, topPageSize]);

  useEffect(() => {
    setPushPage(1);
  }, [pushFilter, pushSearch, fromDate, toDate, categoryId, paymentMethod, pushPageSize]);

  const sortedTopProducts = useMemo(() => {
    if (!data?.topSellingProducts) return [];
    const q = topSearch.trim().toLowerCase();
    return data.topSellingProducts
      .filter((p) => {
        if (!q) return true;
        return (
          p.productName.toLowerCase().includes(q) ||
          p.productCode.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (topSortBy === "REVENUE") return b.revenue - a.revenue;
        if (topSortBy === "PROFIT") return b.grossProfit - a.grossProfit;
        if (b.netSoldQty !== a.netSoldQty) return b.netSoldQty - a.netSoldQty;
        return b.revenue - a.revenue;
      });
  }, [data?.topSellingProducts, topSearch, topSortBy]);

  const filteredPushProducts = useMemo(() => {
    if (!data?.needsPushProducts) return [];
    const q = pushSearch.trim().toLowerCase();
    return data.needsPushProducts.filter((p) => {
      if (q) {
        const match =
          p.productName.toLowerCase().includes(q) ||
          p.productCode.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (pushFilter === "ZERO_SALES") return p.netSoldQty === 0;
      if (pushFilter === "HIGH_CAPITAL") return p.inventoryCostValue >= 2000000;
      if (pushFilter === "FLOOR2_ONLY") return p.stockFloor1 === 0 && p.stockFloor2 > 0;
      if (pushFilter === "NO_PRICE") return p.sellingPrice <= 0;
      return true;
    });
  }, [data?.needsPushProducts, pushSearch, pushFilter]);

  const topTotalPages = Math.max(1, Math.ceil(sortedTopProducts.length / topPageSize));
  const pagedTopProducts = sortedTopProducts.slice(
    (topPage - 1) * topPageSize,
    topPage * topPageSize
  );

  const pushTotalPages = Math.max(1, Math.ceil(filteredPushProducts.length / pushPageSize));
  const pagedPushProducts = filteredPushProducts.slice(
    (pushPage - 1) * pushPageSize,
    pushPage * pushPageSize
  );

  const reversedDaily = useMemo(() => {
    return [...(data?.dailyTrend || [])].reverse();
  }, [data?.dailyTrend]);
  const dailyTotalPages = Math.max(1, Math.ceil(reversedDaily.length / dailyPageSize));
  const pagedDaily = reversedDaily.slice(
    (dailyPage - 1) * dailyPageSize,
    dailyPage * dailyPageSize
  );

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
        netRevenue: h.netRevenue,
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
        netRevenue: d.netRevenue,
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
      m.netRevenue += d.netRevenue;
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

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* BANNER & BỘ LỌC KỲ DOANH THU */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Báo cáo Quản trị & Phân tích Kinh doanh — 11Sport
            </div>
            <h2 className="text-lg font-extrabold mt-0.5">
              Dashboard Doanh Thu Chi Tiết · Sản Phẩm Bán Chạy & Cần Đẩy Mạnh
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              Làm mới
            </button>
            {data && (
              <ExportExcelButton
                label="Xuất Excel Doanh thu & SP"
                onExport={() => exportRevenueDashboard(data, fromDate, toDate)}
              />
            )}
          </div>
        </div>

        {/* Bộ lọc thời gian, Category & Hình thức thanh toán */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-800 items-end">
          <div className="lg:col-span-5">
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
              Chọn nhanh kỳ thống kê
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    quickRange === btn.id
                      ? "bg-emerald-500 text-slate-950 shadow"
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
                  const nextFrom = e.target.value;
                  setQuickRange("ALL");
                  setFromDate(nextFrom);
                  if (nextFrom && nextFrom === toDate) {
                    setChartGroupBy("HOUR");
                  } else {
                    setChartGroupBy("DAY");
                  }
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
                  const nextTo = e.target.value;
                  setQuickRange("ALL");
                  setToDate(nextTo);
                  if (nextTo && fromDate === nextTo) {
                    setChartGroupBy("HOUR");
                  } else {
                    setChartGroupBy("DAY");
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
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

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Hình thức thanh toán
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-semibold"
            >
              <option value="">Tất cả thanh toán</option>
              <option value="CASH">Tiền mặt (CASH)</option>
              <option value="BANKING">Chuyển khoản (BANKING)</option>
              <option value="CARD">Quẹt thẻ (CARD)</option>
              <option value="OTHER">Khác (OTHER)</option>
            </select>
          </div>
        </div>

        {/* Thanh hiển thị trạng thái kỳ thống kê đang áp dụng */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
              <Calendar className="w-3.5 h-3.5" />
              Kỳ đang xem:{" "}
              {fromDate || toDate
                ? `${fromDate ? fromDate.split("-").reverse().join("/") : "Đầu kỳ"} → ${
                    toDate ? toDate.split("-").reverse().join("/") : "Hiện tại"
                  }`
                : "Toàn thời gian"}
            </span>
            <span className="text-slate-400">
              Tìm thấy <strong className="text-white font-mono">{s?.totalOrders || 0}</strong> đơn hàng hợp lệ · Doanh thu thuần:{" "}
              <strong className="text-emerald-400 font-mono">{formatVND(s?.netRevenue || 0)}</strong> · Lãi gộp:{" "}
              <strong className="text-blue-400 font-mono">{formatVND(s?.grossProfit || 0)}</strong>
            </span>
          </div>
          {(fromDate || toDate || categoryId || paymentMethod) && (
            <button
              type="button"
              onClick={() => {
                setCategoryId("");
                setPaymentMethod("");
                handleSelectQuickRange("ALL");
              }}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline"
            >
              Xóa bộ lọc (Xem toàn bộ)
            </button>
          )}
        </div>
      </div>

      {/* HÀNG 1: 4 THẺ KPI DOANH THU & LỢI NHUẬN TRỌNG TÂM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              1. Doanh thu thuần (Thực thu)
            </span>
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-2">
            {formatVND(s?.netRevenue || 0)}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Tiền hàng niêm yết:</span>
              <span className="font-mono font-bold text-slate-800">
                {formatVND(s?.grossRevenue || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tổng giảm giá (SP + Bill):</span>
              <span className="font-mono font-bold text-amber-700">
                -{formatVND(s?.totalDiscount || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Chênh lệch Trả/Đổi hàng:</span>
              <span
                className={`font-mono font-bold ${
                  (s?.netReturnImpact || 0) < 0 ? "text-red-600" : "text-slate-700"
                }`}
              >
                {(s?.netReturnImpact || 0) >= 0 ? "+" : ""}
                {formatVND(s?.netReturnImpact || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-emerald-400">
              2. Lãi gộp thực tế (Gross Profit)
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Biên lãi: {s?.grossMarginPercent || 0}%
            </span>
          </div>
          <div
            className={`text-2xl font-black font-mono mt-2 ${
              (s?.grossProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatVND(s?.grossProfit || 0)}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span>Doanh thu thuần:</span>
              <span className="font-mono font-bold text-white">
                {formatVND(s?.netRevenue || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Giá vốn hàng bán (COGS):</span>
              <span className="font-mono font-bold text-amber-300">
                {formatVND(s?.estimatedCogs || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Phí quẹt thẻ thu hộ (3%):</span>
              <span className="font-mono font-bold text-slate-300">
                {formatVND(s?.cardFeeTotal || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              3. Tổng số đơn & Trung bình đơn
            </span>
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {(s?.totalOrders || 0).toLocaleString("vi-VN")} đơn
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Giá trị đơn TB (AOV):</span>
              <span className="font-mono font-extrabold text-blue-700">
                {formatVND(s?.avgOrderValue || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Đơn hoàn tất nguyên vẹn:</span>
              <span className="font-mono font-bold text-emerald-700">
                {s?.paidOrders || 0} đơn
              </span>
            </div>
            <div className="flex justify-between">
              <span>Đơn có phát sinh trả/đổi:</span>
              <span className="font-mono font-bold text-amber-700">
                {s?.returnedOrders || 0} đơn
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              4. Sản lượng bán & Hàng tặng
            </span>
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {(s?.totalUnitsSold || 0).toLocaleString("vi-VN")} SP bán
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Hàng tặng khuyến mãi (0đ):</span>
              <span className="font-mono font-bold text-purple-700">
                {s?.totalGiftUnits || 0} SP
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hàng khách trả lại:</span>
              <span className="font-mono font-bold text-red-600">
                {s?.totalUnitsReturned || 0} SP
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mặt hàng có doanh số:</span>
              <span className="font-mono font-bold text-emerald-700">
                {data?.topSellingProducts.length || 0} mã SP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HÀNG 2: CÁC BIỂU ĐỒ DOANH THU TRỰC QUAN & CƠ CẤU THANH TOÁN / CATEGORY */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Cột trái: Biểu đồ Doanh thu (Cột đứng / Đường miền / Thanh ngang) & Bảng diễn biến */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Biểu đồ Doanh thu & Lợi nhuận chi tiết
              </h3>
              <p className="text-xs text-slate-500">
                Theo dõi xu hướng doanh thu thuần, giá vốn và lãi gộp theo Giờ, Ngày hoặc Tháng.
              </p>
            </div>

            {/* Bộ nút chuyển đổi Kiểu Biểu đồ & Nhóm thời gian */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartGroupBy("HOUR")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    chartGroupBy === "HOUR"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Theo Giờ
                </button>
                <button
                  type="button"
                  onClick={() => setChartGroupBy("DAY")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    chartGroupBy === "DAY"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Theo Ngày
                </button>
                <button
                  type="button"
                  onClick={() => setChartGroupBy("MONTH")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    chartGroupBy === "MONTH"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Theo Tháng
                </button>
              </div>

              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartType("COLUMN")}
                  className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${
                    chartType === "COLUMN"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Biểu đồ Cột
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("AREA")}
                  className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${
                    chartType === "AREA"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" /> Biểu đồ Đường
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("HORIZONTAL")}
                  className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${
                    chartType === "HORIZONTAL"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Thanh ngang
                </button>
              </div>
            </div>
          </div>

          {/* KHU VỰC BIỂU ĐỒ DOANH THU */}
          {chartSeries.length > 0 ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold uppercase text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {chartGroupBy === "HOUR"
                    ? `Biểu đồ theo khung giờ (${chartSeries.length} mốc giờ)`
                    : chartGroupBy === "DAY"
                    ? `Biểu đồ ${chartSeries.length} ngày trong kỳ`
                    : `Biểu đồ doanh thu qua ${chartSeries.length} tháng`}{" "}
                  · TB:{" "}
                  <strong className="text-slate-800 font-mono">
                    {formatVND(avgSeriesRevenue)}
                  </strong>
                </span>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Doanh thu thuần
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-indigo-700">
                    <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Lãi gộp
                  </span>
                </div>
              </div>

              {/* CHẾ ĐỘ 1: BIỂU ĐỒ CỘT ĐỨNG ĐÔI (COLUMN CHART) */}
              {chartType === "COLUMN" && (
                <div className="pt-3 pb-1 overflow-hidden">
                  <div className="flex items-stretch gap-2">
                    {/* Cột nhãn trục Y cố định bên trái */}
                    <div className="w-11 shrink-0 h-56 flex flex-col justify-between text-right pr-1 pb-1 select-none">
                      {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono text-slate-400 leading-none"
                        >
                          {formatShortVND(Math.round(maxSeriesRevenue * ratio))}
                        </span>
                      ))}
                    </div>

                    {/* Vùng vẽ các cột tràn đều 100% chiều ngang, không tràn khung */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`relative h-56 flex items-end border-b border-slate-300 pb-1 ${
                          chartSeries.length > 20
                            ? "gap-0.5 sm:gap-1"
                            : chartSeries.length > 12
                            ? "gap-1 sm:gap-1.5"
                            : "gap-2 sm:gap-3"
                        }`}
                      >
                        {/* Đường lưới ngang tham chiếu */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1">
                          {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                            <div
                              key={idx}
                              className="border-b border-dashed border-slate-200/90 w-full"
                            />
                          ))}
                        </div>

                        {chartSeries.map((d) => {
                          const hasRev = d.netRevenue > 0;
                          const hasProf = d.grossProfit > 0;
                          const revH = hasRev
                            ? Math.min(
                                100,
                                Math.max(6, Math.round((d.netRevenue / maxSeriesRevenue) * 100))
                              )
                            : 2;
                          const profH = hasProf
                            ? Math.min(
                                100,
                                Math.max(4, Math.round((d.grossProfit / maxSeriesRevenue) * 100))
                              )
                            : 0;
                          return (
                            <div
                              key={d.key}
                              className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group relative z-10"
                            >
                              {/* Tooltip chi tiết khi di chuột */}
                              <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute bottom-full mb-2 z-30 bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl whitespace-nowrap border border-slate-700 left-1/2 -translate-x-1/2">
                                <div className="font-extrabold text-emerald-300 border-b border-slate-700 pb-1 mb-1">
                                  {d.fullLabel} ({d.orders} đơn · {d.unitsSold} SP)
                                </div>
                                <div className="font-mono flex justify-between gap-3">
                                  <span className="text-slate-300">Doanh thu:</span>
                                  <strong className="text-emerald-400">
                                    {formatVND(d.netRevenue)}
                                  </strong>
                                </div>
                                <div className="font-mono flex justify-between gap-3">
                                  <span className="text-slate-300">Giá vốn:</span>
                                  <span className="text-amber-300">{formatVND(d.cogs)}</span>
                                </div>
                                <div className="font-mono flex justify-between gap-3">
                                  <span className="text-slate-300">Lãi gộp:</span>
                                  <strong className="text-indigo-300">
                                    {formatVND(d.grossProfit)}
                                  </strong>
                                </div>
                              </div>

                              {/* Cặp cột Doanh thu & Lãi gộp bám sát đáy */}
                              <div className="relative w-full max-w-[34px] h-[86%] flex items-end justify-center gap-0.5 sm:gap-1">
                                {/* Nhãn giá trị nằm ngay trên đỉnh cột có doanh thu */}
                                {hasRev && (
                                  <span
                                    className="
                                      absolute left-1/2 -translate-x-1/2 mb-1
                                      text-[9px] sm:text-[10px] font-mono font-extrabold text-emerald-800
                                      whitespace-nowrap pointer-events-none
                                    "
                                    style={{ bottom: `${Math.max(revH, profH)}%` }}
                                  >
                                    {formatShortVND(d.netRevenue)}
                                  </span>
                                )}

                                <div
                                  className={`flex-1 rounded-t-sm sm:rounded-t-md transition-all ${
                                    hasRev
                                      ? "bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300 shadow-sm"
                                      : "bg-slate-200/80"
                                  }`}
                                  style={{ height: `${revH}%` }}
                                />
                                { (hasProf || chartSeries.length <= 16) && (
                                  <div
                                    className={`flex-1 rounded-t-sm sm:rounded-t-md transition-all ${
                                      hasProf
                                        ? "bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 group-hover:to-indigo-300 shadow-sm"
                                        : "bg-transparent"
                                    }`}
                                    style={{ height: `${profH}%` }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Nhãn trục X tự động giản lược khi có nhiều ngày */}
                      <div
                        className={`flex items-center pt-2 ${
                          chartSeries.length > 20
                            ? "gap-0.5 sm:gap-1"
                            : chartSeries.length > 12
                            ? "gap-1 sm:gap-1.5"
                            : "gap-2 sm:gap-3"
                        }`}
                      >
                        {chartSeries.map((d, idx) => {
                          const n = chartSeries.length;
                          const step = n > 22 ? 3 : n > 12 ? 2 : 1;
                          const showLabel =
                            idx === 0 ||
                            idx === n - 1 ||
                            (idx % step === 0 && n - 1 - idx >= Math.ceil(step / 2));
                          return (
                            <div
                              key={d.key}
                              className="flex-1 min-w-0 text-center font-mono text-[9px] sm:text-[10px] font-bold text-slate-600 overflow-visible"
                            >
                              {showLabel ? (
                                <span className="inline-block whitespace-nowrap">
                                  {d.label}
                                </span>
                              ) : (
                                <span className="text-slate-300">·</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CHẾ ĐỘ 2: BIỂU ĐỒ ĐƯỜNG & MIỀN (SVG AREA / LINE CHART - FULL WIDTH KHÔNG PADDING 2 BÊN) */}
              {chartType === "AREA" && (
                <div className="pt-3 pb-1">
                  <div className="flex items-stretch gap-2">
                    {/* Cột nhãn trục Y cố định sát lề trái */}
                    <div className="w-11 shrink-0 h-56 flex flex-col justify-between text-right pr-1 pb-1 select-none">
                      {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono text-slate-400 leading-none"
                        >
                          {formatShortVND(Math.round(maxSeriesRevenue * ratio))}
                        </span>
                      ))}
                    </div>

                    {/* Vùng đồ thị kéo sát 100% mép trái - phải (bỏ hoàn toàn padding 2 bên) */}
                    <div className="flex-1 min-w-0">
                      <div className="relative h-56 w-full border-b border-slate-300">
                        {/* Đường lưới ngang */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                          {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                            <div
                              key={idx}
                              className="border-b border-dashed border-slate-200/90 w-full"
                            />
                          ))}
                        </div>

                        {/* SVG đường & miền phủ kín 100% chiều rộng từ x=0 đến x=1000 */}
                        <svg
                          viewBox="0 0 1000 200"
                          preserveAspectRatio="none"
                          className="w-full h-full block overflow-visible"
                        >
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                            </linearGradient>
                            <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>

                          {(() => {
                            const n = chartSeries.length;
                            const getX = (idx: number) =>
                              n === 1 ? 500 : (idx / (n - 1)) * 1000;
                            const getRevY = (v: number) =>
                              196 - (Math.max(0, v) / maxSeriesRevenue) * 184;
                            const getProfY = (v: number) =>
                              196 - (Math.max(0, v) / maxSeriesRevenue) * 184;

                            const revPoints =
                              n === 1
                                ? `0,${getRevY(chartSeries[0].netRevenue)} 500,${getRevY(
                                    chartSeries[0].netRevenue
                                  )} 1000,${getRevY(chartSeries[0].netRevenue)}`
                                : chartSeries
                                    .map((d, i) => `${getX(i)},${getRevY(d.netRevenue)}`)
                                    .join(" ");
                            const profPoints =
                              n === 1
                                ? `0,${getProfY(chartSeries[0].grossProfit)} 500,${getProfY(
                                    chartSeries[0].grossProfit
                                  )} 1000,${getProfY(chartSeries[0].grossProfit)}`
                                : chartSeries
                                    .map((d, i) => `${getX(i)},${getProfY(d.grossProfit)}`)
                                    .join(" ");

                            const revArea = `0,200 ${revPoints} 1000,200`;
                            const profArea = `0,200 ${profPoints} 1000,200`;

                            return (
                              <>
                                <polygon points={revArea} fill="url(#revGrad)" />
                                <polygon points={profArea} fill="url(#profGrad)" />
                                <polyline
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="2.5"
                                  vectorEffect="non-scaling-stroke"
                                  points={revPoints}
                                />
                                <polyline
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="2"
                                  strokeDasharray="5 3"
                                  vectorEffect="non-scaling-stroke"
                                  points={profPoints}
                                />
                              </>
                            );
                          })()}
                        </svg>

                        {/* Các nút chấm tròn (Dots) & Tooltip chuẩn tỷ lệ 1:1 không bị méo */}
                        <div className="absolute inset-0 pointer-events-none">
                          {chartSeries.map((d, i) => {
                            const n = chartSeries.length;
                            const leftPct = n === 1 ? 50 : (i / (n - 1)) * 100;
                            const revBottomPct =
                              2 + (Math.max(0, d.netRevenue) / maxSeriesRevenue) * 92;
                            const profBottomPct =
                              2 + (Math.max(0, d.grossProfit) / maxSeriesRevenue) * 92;
                            const hasVal = d.netRevenue > 0 || d.grossProfit > 0;

                            return (
                              <div
                                key={d.key}
                                className="absolute top-0 bottom-0 group pointer-events-auto"
                                style={{
                                  left: `${leftPct}%`,
                                  width: n > 20 ? "14px" : "22px",
                                  transform: "translateX(-50%)",
                                }}
                              >
                                {/* Đường gióng dọc khi hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-emerald-500/50" />

                                {/* Tooltip chi tiết khi hover */}
                                <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl whitespace-nowrap border border-slate-700">
                                  <div className="font-extrabold text-emerald-300 border-b border-slate-700 pb-1 mb-1">
                                    {d.fullLabel} ({d.orders} đơn · {d.unitsSold} SP)
                                  </div>
                                  <div className="font-mono flex justify-between gap-3">
                                    <span className="text-slate-300">Doanh thu:</span>
                                    <strong className="text-emerald-400">
                                      {formatVND(d.netRevenue)}
                                    </strong>
                                  </div>
                                  <div className="font-mono flex justify-between gap-3">
                                    <span className="text-slate-300">Giá vốn:</span>
                                    <span className="text-amber-300">{formatVND(d.cogs)}</span>
                                  </div>
                                  <div className="font-mono flex justify-between gap-3">
                                    <span className="text-slate-300">Lãi gộp:</span>
                                    <strong className="text-indigo-300">
                                      {formatVND(d.grossProfit)}
                                    </strong>
                                  </div>
                                </div>

                                {/* Nhãn số trên đỉnh điểm có doanh thu */}
                                {d.netRevenue > 0 && (
                                  <span
                                    className="absolute left-1/2 -translate-x-1/2 mb-2 text-[9px] sm:text-[10px] font-mono font-extrabold text-emerald-800 whitespace-nowrap"
                                    style={{ bottom: `${revBottomPct}%` }}
                                  >
                                    {formatShortVND(d.netRevenue)}
                                  </span>
                                )}

                                {/* Điểm tròn Doanh thu */}
                                <span
                                  className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-125 ${
                                    hasVal
                                      ? "w-2.5 h-2.5 bg-emerald-600"
                                      : "w-1.5 h-1.5 bg-emerald-400/70"
                                  }`}
                                  style={{ bottom: `${revBottomPct}%` }}
                                />

                                {/* Điểm tròn Lãi gộp */}
                                {(d.grossProfit > 0 || n <= 14) && (
                                  <span
                                    className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border border-white shadow-sm ${
                                      d.grossProfit > 0
                                        ? "w-2 h-2 bg-indigo-600"
                                        : "w-1.5 h-1.5 bg-indigo-400/60"
                                    }`}
                                    style={{ bottom: `${profBottomPct}%` }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Nhãn trục X bám sát từ mép trái đến mép phải, tự động giản lược khi có 30 ngày */}
                      <div className="relative h-6 mt-2 w-full select-none">
                        {chartSeries.map((d, idx) => {
                          const n = chartSeries.length;
                          const step = n > 22 ? 3 : n > 12 ? 2 : 1;
                          const showLabel =
                            idx === 0 ||
                            idx === n - 1 ||
                            (idx % step === 0 && n - 1 - idx >= Math.ceil(step / 2));
                          if (!showLabel) return null;
                          const leftPct = n === 1 ? 50 : (idx / (n - 1)) * 100;
                          const alignClass =
                            idx === 0
                              ? "translate-x-0"
                              : idx === n - 1
                              ? "-translate-x-full"
                              : "-translate-x-1/2";
                          return (
                            <span
                              key={d.key}
                              className={`absolute top-0 font-mono text-[9px] sm:text-[10px] font-bold text-slate-600 whitespace-nowrap ${alignClass}`}
                              style={{ left: `${leftPct}%` }}
                            >
                              {d.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CHẾ ĐỘ 3: BIỂU ĐỒ THANH NGANG (BẢN CŨ QUEN THUỘC) */}
              {chartType === "HORIZONTAL" && (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {[...chartSeries].reverse().map((d) => {
                    const revPct = Math.min(
                      100,
                      Math.max(2, Math.round((Math.max(0, d.netRevenue) / maxSeriesRevenue) * 100))
                    );
                    const profPct = Math.min(
                      100,
                      Math.max(
                        d.grossProfit !== 0 ? 3 : 0,
                        Math.round((Math.abs(d.grossProfit) / maxSeriesRevenue) * 100)
                      )
                    );
                    return (
                      <div key={d.key} className="text-xs space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {d.fullLabel}
                            <span className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {d.orders} đơn · {d.unitsSold} SP
                            </span>
                          </span>
                          <span className="text-right">
                            <strong className="text-emerald-700">{formatVND(d.netRevenue)}</strong>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className={`font-bold ${d.grossProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                              Lãi: {formatVND(d.grossProfit)}
                            </span>
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${revPct}%` }}
                            />
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                d.grossProfit >= 0 ? "bg-blue-600" : "bg-red-500"
                              }`}
                              style={{ width: `${profPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Chưa có dữ liệu giao dịch trong khoảng thời gian này.
            </div>
          )}

          {/* Bảng chi tiết theo ngày */}
          {reversedDaily.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Ngày</th>
                      <th className="py-2.5 px-2.5 text-right">Số đơn</th>
                      <th className="py-2.5 px-2.5 text-right">SL bán</th>
                      <th className="py-2.5 px-3 text-right">Tiền hàng</th>
                      <th className="py-2.5 px-3 text-right text-amber-300">Giảm giá</th>
                      <th className="py-2.5 px-3 text-right text-emerald-300">Doanh thu thuần</th>
                      <th className="py-2.5 px-3 text-right">Giá vốn</th>
                      <th className="py-2.5 px-3 text-right text-indigo-300">Lãi gộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pagedDaily.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50 font-mono">
                        <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {d.date.split("-").reverse().join("/")}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold">{d.orders}</td>
                        <td className="py-2 px-2.5 text-right">{d.unitsSold}</td>
                        <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                          {formatVND(d.grossRevenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-700 whitespace-nowrap">
                          {d.discountTotal > 0 ? `-${formatVND(d.discountTotal)}` : "0 VND"}
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                          {formatVND(d.netRevenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                          {formatVND(d.cogs)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-extrabold whitespace-nowrap ${
                            d.grossProfit >= 0 ? "text-indigo-700" : "text-red-600"
                          }`}
                        >
                          {formatVND(d.grossProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dailyTotalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Trang <strong>{dailyPage}</strong> / {dailyTotalPages} ({reversedDaily.length} ngày)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={dailyPage <= 1}
                      onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={dailyPage >= dailyTotalPages}
                      onClick={() => setDailyPage((p) => Math.min(dailyTotalPages, p + 1))}
                      className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold"
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cột phải: Biểu đồ Tròn Donut & Cơ cấu Thanh toán / Category */}
        <div className="xl:col-span-5 space-y-5">
          {/* Biểu đồ Tròn & Chi tiết theo phương thức thanh toán */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Biểu đồ Doanh thu theo Hình thức Thanh toán
            </h3>

            <SvgDonutChart
              centerLabel="Tổng đơn thu"
              centerValue={formatShortVND(s?.orderRevenue || 0)}
              items={(data?.byPaymentMethod || []).map((pm, idx) => ({
                label: pm.label,
                value: pm.revenue,
                sharePercent: pm.sharePercent,
                sub: `${pm.orders} đơn`,
                color: CHART_COLORS[idx % CHART_COLORS.length],
              }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(data?.byPaymentMethod || []).map((pm) => (
                <div
                  key={pm.method}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{pm.label}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                      {pm.sharePercent}%
                    </span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-900">
                    {formatVND(pm.revenue)}
                  </div>
                  <div className="text-[11px] text-slate-500">{pm.orders} đơn hàng</div>
                </div>
              ))}
            </div>
          </div>

          {/* Biểu đồ Tròn & Tỷ trọng theo Category */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Biểu đồ Tỷ trọng Doanh thu & Lãi gộp theo Danh mục (Category)
            </h3>
            {data?.byCategory && data.byCategory.length > 0 ? (
              <>
                <SvgDonutChart
                  centerLabel="Danh mục"
                  centerValue={`${data.byCategory.length} nhóm`}
                  items={data.byCategory.map((c, idx) => ({
                    label: c.categoryName,
                    value: c.revenue,
                    sharePercent: c.sharePercent,
                    sub: `${c.unitsSold} SP`,
                    color: CHART_COLORS[idx % CHART_COLORS.length],
                  }))}
                />

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 pt-1">
                  {data.byCategory.map((c, idx) => (
                    <div
                      key={c.categoryId}
                      className="p-3 rounded-xl border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          {c.categoryName}{" "}
                          <span className="font-mono text-slate-500 font-normal">
                            ({c.unitsSold} SP)
                          </span>
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatVND(c.revenue)} ({c.sharePercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(3, c.sharePercent))}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                        <span>Giá vốn: {formatVND(c.cogs)}</span>
                        <span className="font-bold text-indigo-700">
                          Lãi gộp: {formatVND(c.grossProfit)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Chưa có doanh thu theo danh mục trong kỳ này.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HÀNG 2.5: BIỂU ĐỒ TOP 8 SẢN PHẨM MANG LẠI DOANH THU & LÃI GỘP CAO NHẤT */}
      {top8RevenueProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-600" />
                Biểu đồ Top Sản Phẩm Đóng Góp Doanh Thu & Lãi Gộp Cao Nhất
              </h3>
              <p className="text-xs text-slate-500">
                So sánh trực quan doanh thu thuần và lợi nhuận gộp của các mặt hàng chủ lực trong kỳ.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Doanh thu thuần
              </span>
              <span className="inline-flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> Lãi gộp thực tế
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {top8RevenueProducts.map((p, idx) => {
              const revPct = Math.min(100, Math.max(4, Math.round((p.revenue / maxTop8Rev) * 100)));
              const profPct = Math.min(
                100,
                Math.max(
                  p.grossProfit !== 0 ? 4 : 0,
                  Math.round((Math.abs(p.grossProfit) / maxTop8Rev) * 100)
                )
              );
              return (
                <div
                  key={p.productId || p.productCode}
                  className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2 text-xs shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">
                      <span className="font-mono text-emerald-700 mr-1.5">#{idx + 1}</span>
                      {p.productName}{" "}
                      <span className="font-mono text-[11px] text-slate-500 font-normal">
                        ({p.netSoldQty} {p.unit})
                      </span>
                    </span>
                    <span className="font-mono shrink-0">
                      <strong className="text-emerald-700">{formatShortVND(p.revenue)}</strong>
                      <span className="text-slate-300 mx-1.5">|</span>
                      <strong className={p.grossProfit >= 0 ? "text-blue-600" : "text-red-600"}>
                        Lãi {formatShortVND(p.grossProfit)}
                      </strong>
                    </span>
                  </div>

                  {/* 2 Thanh riêng biệt đồng nhất chiều cao (h-2.5): Thanh 1 (Doanh thu - Xanh lá) & Thanh 2 (Lãi gộp - Xanh lam / Đỏ) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-[10px] font-semibold text-slate-500 shrink-0">
                        Doanh thu
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${revPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-[10px] font-semibold text-slate-500 shrink-0">
                        Lãi gộp
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            p.grossProfit >= 0 ? "bg-blue-600" : "bg-red-500"
                          }`}
                          style={{ width: `${profPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HÀNG 3: BẢNG 1 — TOP SẢN PHẨM ĐANG BÁN CHẠY (BEST SELLERS) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              TOP BEST SELLERS
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Các Sản Phẩm Đang Bán Chạy Nhất ({sortedTopProducts.length} sản phẩm phát sinh doanh số)
            </h3>
            <p className="text-xs text-slate-500">
              Xếp hạng mặt hàng chủ lực mang lại doanh số cao nhất, kèm kiểm tra tồn kho Kho Tầng 1 / Tầng 2 để kịp thời bổ sung hàng lên kệ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên SP bán chạy..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <select
              value={topSortBy}
              onChange={(e) => setTopSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-bold text-slate-800"
            >
              <option value="QTY">Xếp theo: Số lượng bán nhiều nhất</option>
              <option value="REVENUE">Xếp theo: Doanh thu cao nhất</option>
              <option value="PROFIT">Xếp theo: Lãi gộp cao nhất</option>
            </select>

            <select
              value={topPageSize}
              onChange={(e) => setTopPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-3 text-center w-14">Hạng</th>
                <th className="py-3 px-3">Mã & Tên sản phẩm</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right bg-emerald-950 text-emerald-300">
                  SL Đã bán
                </th>
                <th className="py-3 px-3 text-right">Số đơn</th>
                <th className="py-3 px-3 text-right">Doanh thu thuần</th>
                <th className="py-3 px-3 text-right">Lãi gộp (Biên %)</th>
                <th className="py-3 px-3 text-right">Tồn Tầng 1 / Tầng 2</th>
                <th className="py-3 px-3">Tình trạng tồn & Gợi ý bổ sung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedTopProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Chưa có sản phẩm nào phát sinh doanh số khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                pagedTopProducts.map((p, idx) => {
                  const rank = (topPage - 1) * topPageSize + idx + 1;
                  return (
                    <tr key={p.productId || p.productCode} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-center font-mono font-black">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${
                            rank === 1
                              ? "bg-amber-400 text-slate-950 shadow"
                              : rank === 2
                              ? "bg-slate-300 text-slate-900"
                              : rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{p.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{p.productCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {p.categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono bg-emerald-50/40">
                        <div className="font-black text-sm text-emerald-700">
                          {p.netSoldQty} {p.unit}
                        </div>
                        {p.giftQty > 0 && (
                          <div className="text-[10px] text-purple-700 font-semibold">
                            (+{p.giftQty} tặng 0đ)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                        {p.orderCount} đơn
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {formatVND(p.revenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        <div
                          className={`font-extrabold ${
                            p.grossProfit >= 0 ? "text-indigo-700" : "text-red-600"
                          }`}
                        >
                          {formatVND(p.grossProfit)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Biên lãi: <strong>{p.marginPercent}%</strong>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          Tổng: {p.stock} {p.unit}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          🏢 T1: <b className="text-emerald-700">{p.stockFloor1}</b> · 🏬 T2:{" "}
                          <b className="text-purple-700">{p.stockFloor2}</b>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {p.restockAlert ? (
                          <div className="flex items-start gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{p.restockAlert}</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                            ✓ Đủ hàng bán tại Tầng 1
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang bảng Bán chạy */}
        {sortedTopProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
            <span>
              Hiển thị{" "}
              <strong>
                {(topPage - 1) * topPageSize + 1}–
                {Math.min(topPage * topPageSize, sortedTopProducts.length)}
              </strong>{" "}
              trên tổng <strong>{sortedTopProducts.length}</strong> sản phẩm bán chạy
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={topPage <= 1}
                onClick={() => setTopPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <span className="px-3 py-1.5 font-mono font-bold text-slate-900">
                Trang {topPage} / {topTotalPages}
              </span>
              <button
                type="button"
                disabled={topPage >= topTotalPages}
                onClick={() => setTopPage((p) => Math.min(topTotalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
              >
                Tiếp <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HÀNG 4: BẢNG 2 — SẢN PHẨM ĐANG CẦN ĐẨY MẠNH (SLOW-MOVING / ĐỌNG VỐN / CẦN CHUYỂN TẦNG) */}
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
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={pushSearch}
                onChange={(e) => setPushSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên SP cần đẩy mạnh..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <select
              value={pushFilter}
              onChange={(e) => setPushFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50 text-xs font-bold text-slate-900"
            >
              <option value="ALL">Tất cả SP cần đẩy mạnh ({data?.needsPushProducts.length || 0})</option>
              <option value="ZERO_SALES">Chưa bán được chiếc nào (0 SP)</option>
              <option value="HIGH_CAPITAL">Đọng vốn lớn (≥ 2.000.000đ)</option>
              <option value="FLOOR2_ONLY">Tầng 1 hết hàng, còn ở Kho Tầng 2</option>
              <option value="NO_PRICE">Chưa đặt giá bán (Giá bán = 0đ)</option>
            </select>

            <select
              value={pushPageSize}
              onChange={(e) => setPushPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
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
                <th className="py-3 px-3">Đề xuất hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedPushProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không có sản phẩm nào thuộc nhóm cần đẩy mạnh theo bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pagedPushProducts.map((p, idx) => {
                  const stt = (pushPage - 1) * pushPageSize + idx + 1;
                  return (
                    <tr key={p.productId || p.productCode} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                        {stt}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{p.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{p.productCode}</div>
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
                        <div
                          className={`font-bold ${
                            p.sellingPrice <= 0 ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
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
                              • {reason}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[11px] font-semibold text-slate-800 mb-1.5">
                          💡 {p.suggestedAction}
                        </div>
                        {onNavigateToInventory && (
                          <button
                            type="button"
                            onClick={() => onNavigateToInventory(p.productCode)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            Xử lý trong Kho <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang bảng Cần đẩy mạnh */}
        {filteredPushProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
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

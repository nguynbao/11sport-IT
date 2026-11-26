import { parseLocalDateBound } from "./utils";
import type { Product, ProductSalesAnalysisRow } from "@/shared/types";

export function computeFallbackProductAndCategoryStats(deps: {
  products: Product[];
  prodById: Map<string, Product>;
  prodByCode: Map<string, Product>;
  prodStats: Map<string, any>;
  catMap: Map<string, string>;
  getProdCatId: (p?: Product) => string;
  isProductOnlyCatFilter: boolean;
  serviceRevenue: number;
  totalServiceUnits: number;
  fromDate: Date | null;
  toDate: Date | null;
  dailyMap: Map<string, any>;
  ensureDay: (d: string | Date) => any;
}) {
  const {
    products,
    prodById,
    prodByCode,
    prodStats,
    catMap,
    getProdCatId,
    isProductOnlyCatFilter,
    serviceRevenue,
    totalServiceUnits,
    fromDate,
    toDate,
    dailyMap,
    ensureDay,
  } = deps;

  const catStatsMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      unitsSold: number;
      revenue: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
    }
  >();

  prodStats.forEach((st) => {
    const netUnits = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
    if (netUnits === 0 && st.revenue === 0 && st.cogs === 0) return;
    const key = st.categoryId || "UNCATEGORIZED";
    if (!catStatsMap.has(key)) {
      catStatsMap.set(key, {
        categoryId: key,
        categoryName: st.categoryName,
        unitsSold: 0,
        revenue: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }
    const cRow = catStatsMap.get(key)!;
    cRow.unitsSold += netUnits;
    cRow.revenue += st.revenue;
    cRow.netRevenue += st.revenue;
    cRow.cogs += st.cogs;
    cRow.grossProfit = cRow.revenue - cRow.cogs;
  });

  if (!isProductOnlyCatFilter && (serviceRevenue > 0 || totalServiceUnits > 0)) {
    catStatsMap.set("SERVICE", {
      categoryId: "SERVICE",
      categoryName: "Dịch vụ (Căng vợt / Sửa chữa)",
      unitsSold: totalServiceUnits,
      revenue: serviceRevenue,
      netRevenue: serviceRevenue,
      cogs: 0,
      grossProfit: serviceRevenue,
    });
  }

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
        pushReasons.push("Chưa đặt giá niêm yết (0 VND)");
        suggestedAction = "Cập nhật giá niêm yết trong Quản lý Kho để POS có thể bán";
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


  return {
    byCategory,
    topSellingProducts,
    needsPushProducts,
  };
}

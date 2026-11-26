import type { Category, Order, Product, ReturnReceipt } from "@/shared/types";

export interface PushProductRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  soldQty: number;
  giftQty: number;
  returnedQty: number;
  netSoldQty: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
  lastSoldAt: string | null;
  sellingPrice: number;
  costPrice: number;
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  inventoryCostValue: number;
  inventorySellValue: number;
  restockAlert: string;
  pushScore: number;
  pushReasons: string[];
  suggestedAction: string;
}

export interface PushProductsReportResponse {
  summary: {
    totalPushProducts: number;
    zeroSalesCount: number;
    highCapitalCount: number;
    floor2OnlyCount: number;
    noPriceCount: number;
    totalPushStock: number;
    totalPushCapitalValue: number;
  };
  needsPushProducts: PushProductRow[];
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

export function buildFallbackPushProducts(
  products: Product[],
  categories: Category[],
  orders: Order[],
  returns: ReturnReceipt[],
  filters: { from: string; to: string; categoryId: string }
): PushProductRow[] {
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

  const soldMap = new Map<
    string,
    {
      soldQty: number;
      giftQty: number;
      returnedQty: number;
      exchangeOutQty: number;
      revenue: number;
      cogs: number;
      orderIds: Set<string>;
      lastSoldAt: string | null;
    }
  >();

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

  const rows: PushProductRow[] = [];
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


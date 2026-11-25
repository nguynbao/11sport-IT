import {
  staffRepo,
  orderRepo,
  returnExchangeRepo,
  importReceiptRepo,
  stockMovementRepo,
  productRepo,
  categoryRepo,
  serviceOrderRepo,
} from "../../repositories";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";
import { floorLabel, getFloorStocks } from "../inventory";
import { normalizePhoneDigits } from "../../shared/search";
import {
  extractOrderDebtMeta,
  parseLocalDateBound,
  emptySales,
  emptyWarehouse,
  SalesActivity,
  WarehouseActivity,
} from "./reports.helpers";

export async function getReportsPushProducts(ctx: ServiceContext, query: Record<string, any>): Promise<ServiceResult> {
  if (!['CEO', 'MARKETING', 'ADMIN', 'ACCOUNTANT'].includes(ctx.user?.role || '')) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Chỉ Giám đốc (CEO), bộ phận Marketing (MARKETING), Quản lý (ADMIN) hoặc Kế toán (ACCOUNTANT) được xem danh sách sản phẩm cần đẩy mạnh'
      );
    }

    const { from, to, categoryId } = query;
    const fromDate = parseLocalDateBound(from, false);
    const toDate = parseLocalDateBound(to, true);

    const inRange = (d?: Date | string | null) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      if (isNaN(t)) return false;
      if (fromDate && t < fromDate.getTime()) return false;
      if (toDate && t > toDate.getTime()) return false;
      return true;
    };

    const [orders, returns, products, categories] = await Promise.all([
      orderRepo.find({}, { createdAt: -1 }),
      returnExchangeRepo.find({}, { createdAt: -1 }),
      productRepo.find({}, { createdAt: -1 }),
      categoryRepo.find({}, { createdAt: 1 }),
    ]);

    const catMap = new Map<string, string>();
    categories.forEach((c) => catMap.set(String(c._id), c.name));

    const prodById = new Map<string, any>();
    const prodByCode = new Map<string, any>();
    products.forEach((p) => {
      prodById.set(String(p._id), p);
      prodByCode.set(String(p.code), p);
    });

    const filterCatId = categoryId ? String(categoryId) : '';

    interface PushProdStat {
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
      lastSoldAt: Date | null;
    }

    const prodStats = new Map<string, PushProdStat>();
    const ensureProdStat = (
      pId: string,
      pCode: string,
      pName: string,
      unit: string
    ): PushProdStat => {
      const prod = prodById.get(pId) || prodByCode.get(pCode);
      const key = prod ? String(prod._id) : pCode || pId;
      if (!prodStats.has(key)) {
        const cId = prod ? String(prod.categoryId || '') : '';
        prodStats.set(key, {
          productId: prod ? String(prod._id) : pId,
          productCode: prod ? prod.code : pCode,
          productName: prod ? prod.name : pName,
          categoryId: cId,
          categoryName: catMap.get(cId) || 'Chưa phân loại',
          unit: prod ? prod.unit : unit || 'Cái',
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
      if (filterCatId && String(p.categoryId) !== filterCatId) return;
      ensureProdStat(String(p._id), p.code, p.name, p.unit);
    });

    for (const o of orders) {
      if (o.status === 'DRAFT' || !inRange(o.createdAt)) continue;
      const orderSub = Number(o.subtotal) || 0;
      const orderBillDisc = Number(o.billDiscountAmount) || 0;

      for (const it of o.items || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const isGift = Boolean(it.isGift) || it.discountType === 'GIFT';
        const lineTotal = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const billDiscShare =
          !isGift && orderSub > 0 ? Math.round((lineTotal / orderSub) * orderBillDisc) : 0;
        const netItemRev = Math.max(0, lineTotal - billDiscShare);

        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        if (isGift) {
          st.giftQty += qty;
        } else {
          st.soldQty += qty;
          st.revenue += netItemRev;
        }
        st.cogs += qty * unitCost;
        st.orderIds.add(String(o._id));
        if (!st.lastSoldAt || new Date(o.createdAt) > new Date(st.lastSoldAt)) {
          st.lastSoldAt = new Date(o.createdAt);
        }
      }
    }

    for (const r of returns) {
      if (!inRange(r.createdAt)) continue;
      for (const it of r.returnItems || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.returnedQty += qty;
        st.revenue = Math.max(0, st.revenue - line);
        if (it.condition === 'GOOD' || it.restocked) {
          st.cogs = Math.max(0, st.cogs - qty * unitCost);
        }
      }
      for (const it of r.exchangeItems || []) {
        const prod = prodById.get(String(it.productId)) || prodByCode.get(String(it.productCode));
        if (filterCatId && (!prod || String(prod.categoryId) !== filterCatId)) continue;
        const qty = Number(it.quantity) || 0;
        const line = Number(it.lineTotal) || 0;
        const unitCost = Number(prod?.costPrice) || 0;
        const st = ensureProdStat(
          String(it.productId),
          it.productCode,
          it.productName,
          it.unit
        );
        st.exchangeOutQty += qty;
        st.revenue += line;
        st.cogs += qty * unitCost;
      }
    }

    const allProductRows = Array.from(prodStats.values()).map((st) => {
      const prod = prodById.get(st.productId) || prodByCode.get(st.productCode);
      const floors = prod ? getFloorStocks(prod) : { stockFloor1: 0, stockFloor2: 0, stock: 0 };
      const stockFloor1 = floors.stockFloor1;
      const stockFloor2 = floors.stockFloor2;
      const stock = floors.stock;
      const sellingPrice = Number(prod?.sellingPrice ?? 0);
      const costPrice = Number(prod?.costPrice ?? 0);
      const netSoldQty = Math.max(0, st.soldQty + st.exchangeOutQty - st.returnedQty);
      const profit = st.revenue - st.cogs;
      const marginPercent = st.revenue > 0 ? Math.round((profit / st.revenue) * 1000) / 10 : 0;
      const inventoryCostValue = stock * costPrice;
      const inventorySellValue = stock * sellingPrice;

      const pushReasons: string[] = [];
      let suggestedAction = '';
      let pushScore = 0;

      if (stock > 0) {
        if (sellingPrice <= 0) {
          pushReasons.push('Chưa đặt giá bán (0 VND)');
          suggestedAction = 'Cập nhật giá bán lẻ trong Quản lý Kho để POS có thể bán';
          pushScore += 100;
        }
        if (stockFloor1 === 0 && stockFloor2 > 0) {
          pushReasons.push(`Tầng 1 = 0, đang nằm ở Kho Tầng 2 (${stockFloor2} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction = 'Lập Phiếu Xuất Kho Chuyển Tầng đưa hàng từ Tầng 2 xuống Tầng 1 trưng bày';
          }
          pushScore += 80 + Math.min(40, stockFloor2 * 2);
        }
        if (netSoldQty === 0) {
          pushReasons.push(`Chưa bán được chiếc nào trong kỳ (Tồn: ${stock} ${st.unit})`);
          if (!suggestedAction) {
            suggestedAction =
              stock >= 10
                ? 'Tồn kho cao chưa phát sinh đơn — Nên chạy khuyến mãi giảm giá % hoặc tặng kèm combo'
                : 'Trưng bày nổi bật tại quầy Tầng 1 hoặc tư vấn ưu tiên cho khách';
          }
          pushScore += 50 + Math.min(50, stock * 3);
        } else if (stock >= netSoldQty * 5 && stock >= 6) {
          pushReasons.push(
            `Tồn kho cao gấp ${Math.round(stock / netSoldQty)} lần lượng bán (Tồn ${stock} / Bán ${netSoldQty})`
          );
          if (!suggestedAction) {
            suggestedAction = 'Tốc độ tiêu thụ chậm so với lượng tồn — Nên giảm giá nhẹ hoặc đẩy mạnh giới thiệu';
          }
          pushScore += 30 + Math.min(40, stock * 2);
        }

        if (inventoryCostValue >= 3000000 && netSoldQty <= 1) {
          pushReasons.push(`Đọng vốn lớn (${Math.round((inventoryCostValue / 1000000) * 10) / 10}tr VND)`);
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
        restockAlert: '',
        pushScore,
        pushReasons,
        suggestedAction,
      };
    });

    const needsPushProducts = allProductRows
      .filter((r) => r.stock > 0 && r.pushScore > 0)
      .sort((a, b) => {
        if (b.pushScore !== a.pushScore) return b.pushScore - a.pushScore;
        if (b.inventoryCostValue !== a.inventoryCostValue)
          return b.inventoryCostValue - a.inventoryCostValue;
        return b.stock - a.stock;
      });

    const summary = {
      totalPushProducts: needsPushProducts.length,
      zeroSalesCount: needsPushProducts.filter((p) => p.netSoldQty === 0).length,
      highCapitalCount: needsPushProducts.filter((p) => p.inventoryCostValue >= 2000000).length,
      floor2OnlyCount: needsPushProducts.filter((p) => p.stockFloor1 === 0 && p.stockFloor2 > 0).length,
      noPriceCount: needsPushProducts.filter((p) => p.sellingPrice <= 0).length,
      totalPushStock: needsPushProducts.reduce((s, p) => s + p.stock, 0),
      totalPushCapitalValue: needsPushProducts.reduce((s, p) => s + p.inventoryCostValue, 0),
    };

    return ok({
        summary,
        needsPushProducts,
        categories,
      }, {
        from: from || null,
        to: to || null,
        categoryId: categoryId || null,
      });
}

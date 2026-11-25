import { filterAndRankBySearch } from "@/shared/lib/search";
import { paginateItems } from "@/shared/utils/pagination";
import type { Product } from "@/shared/types";
import { useEffect,useMemo } from "react";
import type { InventoryState } from "./useInventoryState";

export function useInventoryDerived(deps: {
  state: InventoryState;
  floor1ImportedCodes: Set<string>;
  floor2ImportedCodes: Set<string>;
  isProductChanged: (p: Product) => boolean;
  variantCodeFor: (baseCode?: string, color?: string, size?: string) => string;
}) {
  const { state, floor1ImportedCodes, floor2ImportedCodes, isProductChanged, variantCodeFor } = deps;
  const {
    activeWarehouse,
    showZeroFloorItems,
    quickStockFilter,
    products,
    movements,
    reportRows,
    importsList,
    search,
    categoryId,
    brandFilter,
    brandOptions,
    fromDate,
    toDate,
    movementType,
    prodPage,
    setProdPage,
    prodPageSize,
    reportPage,
    setReportPage,
    reportPageSize,
    movPage,
    setMovPage,
    movPageSize,
    impPage,
    setImpPage,
    impPageSize,
    editingFloor1,
    editingFloor2,
    editingCosts,
    editingPrices,
    scannedCheckCounts,
    onlyShowScanned,
  } = state;

  const displayedProducts = useMemo(() => {
    const byFloor = products.filter((p) => {
      if (onlyShowScanned && !scannedCheckCounts[p._id]) {
        return false;
      }
      const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
      const f2 = Number(p.stockFloor2 ?? 0);
      if (activeWarehouse === "FLOOR_1") {
        if (showZeroFloorItems || scannedCheckCounts[p._id]) return true;
        return (
          f1 > 0 ||
          (Number(p.maxUnpackableFloor1) || 0) > 0 ||
          floor1ImportedCodes.has(p.code) ||
          !floor2ImportedCodes.has(p.code)
        );
      }
      if (activeWarehouse === "FLOOR_2") {
        if (showZeroFloorItems || scannedCheckCounts[p._id]) return true;
        return f2 > 0 || floor2ImportedCodes.has(p.code);
      }
      return true;
    }).filter((p) => {
      if (!brandFilter) return true;
      if (p.brandId) return String(p.brandId) === brandFilter;
      // Sản phẩm cũ chưa gắn brandId: khớp theo tên hãng / alias
      const b = brandOptions.find((x) => x._id === brandFilter);
      if (!b) return false;
      const norm = (t?: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
      return keys.has(norm(p.brand));
    }).filter((p) => {
      if (quickStockFilter === "ALL") return true;
      const f1 = Number(editingFloor1[p._id] ?? p.stockFloor1 ?? p.stock ?? 0);
      const f2 = Number(editingFloor2[p._id] ?? p.stockFloor2 ?? 0);
      const q = activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : f1 + f2;
      if (quickStockFilter === "IN_STOCK") return q > 0;
      if (quickStockFilter === "ZERO_STOCK") return q <= 0;
      if (quickStockFilter === "MISSING_PRICE") {
        const sp = Number(editingPrices[p._id] ?? p.sellingPrice ?? 0);
        const cp = Number(editingCosts[p._id] ?? p.costPrice ?? 0);
        return sp <= 0 || cp <= 0;
      }
      if (quickStockFilter === "CHANGED") return isProductChanged(p);
      return true;
    });
    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.legacyCode, weight: 1.2 },
      { text: p.brandName || p.brand, weight: 1.1 },
      { text: p.versionName, weight: 1.2 },
      { text: p.name, weight: 1.3 },
      { text: p.note, weight: 0.9 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.unit, weight: 0.6 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
          text: `${v.variantCode || variantCodeFor(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""} size ${v.size || ""}`,
          weight: 1.4,
        }))
        : []),
    ]);
  }, [
    products,
    activeWarehouse,
    showZeroFloorItems,
    importsList,
    search,
    onlyShowScanned,
    scannedCheckCounts,
    brandFilter,
    brandOptions,
    quickStockFilter,
    editingFloor1,
    editingFloor2,
    editingPrices,
    editingCosts,
    isProductChanged,
  ]);

  // Thống kê tổng hợp riêng cho Kho Tầng 1, Kho Tầng 2 và Kho đang chọn
  const totalFloor1Qty = products.reduce(
    (s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0),
    0
  );
  const totalFloor2Qty = products.reduce(
    (s, p) => s + (Number(p.stockFloor2) || 0),
    0
  );
  const getActiveQty = (p: Product) => {
    const f1 = Number(p.stockFloor1 ?? p.stock ?? 0);
    const f2 = Number(p.stockFloor2 ?? 0);
    if (activeWarehouse === "FLOOR_1") return f1;
    if (activeWarehouse === "FLOOR_2") return f2;
    return f1 + f2;
  };

  const totalStockQty = displayedProducts.reduce((s, p) => s + getActiveQty(p), 0);
  const totalCostInventoryValue = displayedProducts.reduce(
    (s, p) => s + getActiveQty(p) * (Number(editingCosts[p._id] ?? p.costPrice) || 0),
    0
  );
  const totalSellInventoryValue = displayedProducts.reduce(
    (s, p) => s + getActiveQty(p) * (Number(editingPrices[p._id] ?? p.sellingPrice) || 0),
    0
  );
  const totalExpectedMargin = totalSellInventoryValue - totalCostInventoryValue;

  // Map tra cứu nhanh sản phẩm theo mã/id cho Phiếu nhập
  const productByCode = new Map(products.map((p) => [p.code, p]));
  const activeWarehouseLabel =
    activeWarehouse === "FLOOR_1"
      ? "🏢 Kho Tầng 1"
      : activeWarehouse === "FLOOR_2"
        ? "🏬 Kho Tầng 2"
        : "📊 Tổng hợp Cả 2 Kho (Tầng 1 + Tầng 2)";

  // Reset trang về 1 khi thay đổi bộ lọc
  useEffect(() => {
    setProdPage(1);
  }, [activeWarehouse, showZeroFloorItems, search, categoryId, prodPageSize]);

  useEffect(() => {
    setReportPage(1);
  }, [activeWarehouse, fromDate, toDate, categoryId, reportPageSize]);

  useEffect(() => {
    setMovPage(1);
  }, [activeWarehouse, movementType, fromDate, toDate, movPageSize]);

  useEffect(() => {
    setImpPage(1);
  }, [activeWarehouse, impPageSize]);

  const prodPg = paginateItems(displayedProducts, prodPage, prodPageSize);
  const prodTotalPages = prodPg.totalPages;
  const safeProdPage = prodPg.page;
  const pagedProducts = prodPg.items;


  const filteredReportRows = reportRows.filter((r) => {
    if (activeWarehouse === "FLOOR_1") {
      return (
        (Number(r.stockFloor1 ?? r.closingStock) || 0) > 0 ||
        floor1ImportedCodes.has(r.productCode)
      );
    }
    if (activeWarehouse === "FLOOR_2") {
      return (
        (Number(r.stockFloor2) || 0) > 0 ||
        floor2ImportedCodes.has(r.productCode)
      );
    }
    return true;
  });
  const reportPg = paginateItems(filteredReportRows, reportPage, reportPageSize);
  const reportTotalPages = reportPg.totalPages;
  const safeReportPage = reportPg.page;
  const pagedReportRows = reportPg.items;

  const filteredMovements = movements.filter((m) => {
    if (activeWarehouse === "ALL") return true;
    const loc = m.warehouseLocation || "FLOOR_1";
    return loc === activeWarehouse;
  });
  const movPg = paginateItems(filteredMovements, movPage, movPageSize);
  const movTotalPages = movPg.totalPages;
  const safeMovPage = movPg.page;
  const pagedMovements = movPg.items;

  const filteredImports = importsList.filter((imp) => {
    if (activeWarehouse === "ALL") return true;
    const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
    return wh === activeWarehouse;
  });
  const impPg = paginateItems(filteredImports, impPage, impPageSize);
  const impTotalPages = impPg.totalPages;
  const safeImpPage = impPg.page;
  const pagedImports = impPg.items;



  return {
    displayedProducts,
    totalFloor1Qty,
    totalFloor2Qty,
    getActiveQty,
    totalStockQty,
    totalCostInventoryValue,
    totalSellInventoryValue,
    totalExpectedMargin,
    productByCode,
    activeWarehouseLabel,
    prodTotalPages,
    safeProdPage,
    pagedProducts,
    filteredReportRows,
    reportTotalPages,
    safeReportPage,
    pagedReportRows,
    filteredMovements,
    movTotalPages,
    safeMovPage,
    pagedMovements,
    filteredImports,
    impTotalPages,
    safeImpPage,
    pagedImports,
  };
}

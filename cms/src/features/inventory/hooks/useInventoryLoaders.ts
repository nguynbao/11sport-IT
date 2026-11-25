import { useCallback, useEffect, useMemo } from "react";
import { apiRequest } from "@/shared/api/client";
import { fetchBrandsApi } from "@/shared/api/catalogLookup";
import { resolveVariantCode } from "@/shared/utils/productCode";
import type { Brand, Category, InventoryReportRow, Product, ProductVariant, StockMovement } from "@/shared/types";
import type { InventoryState } from "./useInventoryState";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export function useInventoryLoaders(state: InventoryState) {
  const {
    subTab,
    historyView,
    products,
    setProducts,
    categories,
    setCategories,
    movements,
    setMovements,
    setReportRows,
    setImportsList,
    search,
    categoryId,
    setBrandOptions,
    fromDate,
    toDate,
    movementType,
    setEditingNames,
    setEditingNotes,
    setEditingCats,
    setEditingUnits,
    setEditingFloor1,
    setEditingFloor2,
    setEditingCosts,
    setEditingPrices,
    setNewProdCatId,
    setAdminImportRows,
    allCatalogProducts,
    setAllCatalogProducts,
    setEditingVariants,
    setTransfersList,
    setLoading,
    debouncedSearch,
  } = state;

  const catalogByCode = useMemo(() => {
    const m = new Map<string, Product>();
    const add = (code: string | undefined, p: Product) => {
      const k = String(code || "").trim().toUpperCase();
      if (k && !m.has(k)) m.set(k, p);
    };
    [...products, ...allCatalogProducts].forEach((p) => {
      add(p.code, p);
      add(p.legacyCode, p);
      (p.legacyCodes || []).forEach((c) => add(c, p));
    });
    return m;
  }, [products, allCatalogProducts]);
  const variantCodeFor = (baseCode?: string, color?: string, size?: string): string =>
    resolveVariantCode(catalogByCode.get(String(baseCode || "").trim().toUpperCase()), baseCode, color, size);

  // Quản lý Phân loại (Màu sắc • Size • Tồn kho từng tầng) & In Tem Label


  // Tách tải danh mục & phiếu nhập ra riêng để không gọi lại mỗi khi gõ tìm kiếm sản phẩm
  const loadCategoriesAndImports = useCallback(async () => {
    try {
      const [catRes, impRes, movRes, allProdRes] = await Promise.all([
        apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE),
        apiRequest<any[]>(API_ENDPOINTS.IMPORTS.BASE),
        apiRequest<StockMovement[]>("/inventory/movements?type=IMPORT"),
        apiRequest<Product[]>(API_ENDPOINTS.PRODUCTS.BASE),
      ]);
      const cList = Array.isArray(catRes.data) ? catRes.data : [];
      const iList = Array.isArray(impRes.data) ? impRes.data : [];
      const mList = Array.isArray(movRes.data) ? movRes.data : [];
      const pList = Array.isArray(allProdRes.data) ? allProdRes.data : [];
      setCategories(cList);
      fetchBrandsApi()
        .then(setBrandOptions)
        .catch(() => undefined);
      setImportsList(iList);
      setAllCatalogProducts(pList);
      setMovements((prev) => (prev.length > 0 ? prev : mList));
      if (cList.length > 0) {
        const firstId = cList[0]._id;
        setNewProdCatId((prev) => prev || firstId);
        setAdminImportRows((prev) =>
          prev.map((r) => (r.categoryId ? r : { ...r, categoryId: firstId }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const loadProductsAndCats = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (categoryId) q.set("categoryId", categoryId);
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());

      const prodRes = await apiRequest<Product[]>(`${API_ENDPOINTS.PRODUCTS.BASE}?${q.toString()}`);
      const pList = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(pList);
      if (!categoryId && !debouncedSearch.trim()) {
        setAllCatalogProducts(pList);
      }

      const nameMap: Record<string, string> = {};
      const noteMap: Record<string, string> = {};
      const catMap: Record<string, string> = {};
      const unitMap: Record<string, string> = {};
      const f1Map: Record<string, number> = {};
      const f2Map: Record<string, number> = {};
      const costMap: Record<string, number> = {};
      const priceMap: Record<string, number> = {};
      const varMap: Record<string, ProductVariant[]> = {};
      pList.forEach((p) => {
        nameMap[p._id] = p.name || "";
        noteMap[p._id] = p.note || "";
        catMap[p._id] =
          typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
        unitMap[p._id] = p.unit || "Cái";
        f1Map[p._id] = Number(p.stockFloor1 ?? p.stock ?? 0);
        f2Map[p._id] = Number(p.stockFloor2 ?? 0);
        costMap[p._id] = Number(p.costPrice || 0);
        priceMap[p._id] = Number(p.sellingPrice || 0);
        varMap[p._id] = Array.isArray(p.variants)
          ? p.variants.map((v) => ({
            ...v,
            variantKey: v.variantKey,
            variantCode: v.variantCode,
            barcode: v.barcode,
            color: v.color || "",
            colorHexes: Array.isArray(v.colorHexes) ? v.colorHexes : [],
            size: v.size || "",
            stockFloor1: Number(v.stockFloor1 ?? 0),
            stockFloor2: Number(v.stockFloor2 ?? 0),
            stock: Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0))),
          }))
          : [];
      });
      setEditingNames(nameMap);
      setEditingNotes(noteMap);
      setEditingCats(catMap);
      setEditingUnits(unitMap);
      setEditingFloor1(f1Map);
      setEditingFloor2(f2Map);
      setEditingCosts(costMap);
      setEditingPrices(priceMap);
      setEditingVariants(varMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryId, debouncedSearch]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      if (categoryId) q.set("categoryId", categoryId);
      const res = await apiRequest<any>(`${API_ENDPOINTS.INVENTORY.REPORT}?${q.toString()}`);
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.items || res.data?.rows || [];
      setReportRows(list);
    } catch {
      setReportRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, categoryId]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (movementType) q.set("type", movementType);
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      const res = await apiRequest<StockMovement[]>(
        `${API_ENDPOINTS.INVENTORY.MOVEMENTS}?${q.toString()}`
      );
      setMovements(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [movementType, fromDate, toDate]);

  const loadImports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>(API_ENDPOINTS.IMPORTS.BASE);
      setImportsList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setImportsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<StockMovement[]>(API_ENDPOINTS.INVENTORY.TRANSFERS);
      setTransfersList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTransfersList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategoriesAndImports();
  }, [loadCategoriesAndImports]);

  useEffect(() => {
    loadProductsAndCats();
  }, [loadProductsAndCats]);

  useEffect(() => {
    if (subTab === "REPORT") loadReport();
    if (subTab === "HISTORY") {
      if (historyView === "IMPORTS") loadImports();
      if (historyView === "MOVEMENTS") loadMovements();
      if (historyView === "TRANSFERS") loadTransfers();
    }
    if (subTab === "TRANSFER") loadTransfers();
  }, [subTab, historyView, loadReport, loadMovements, loadImports, loadTransfers]);



  return {
    catalogByCode,
    variantCodeFor,
    loadCategoriesAndImports,
    loadProductsAndCats,
    loadReport,
    loadMovements,
    loadImports,
    loadTransfers,
  };
}

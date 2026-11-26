import { useState, useEffect, useCallback, useMemo } from "react";
import type { Brand, Category, Product } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { fetchBrandsApi } from "@/shared/api/catalogLookup";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { getFloor1Stock } from "../utils/stock";

export function useInventoryData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeWarehouse, setActiveWarehouse] = useState<"FLOOR_1" | "FLOOR_2" | "ALL">("FLOOR_1");
  const [floor1Codes, setFloor1Codes] = useState<Set<string>>(new Set());
  const [floor2Codes, setFloor2Codes] = useState<Set<string>>(new Set());
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  const [brandFilter, setBrandFilter] = useState("");
  const [brandOptions, setBrandOptions] = useState<Brand[]>([]);

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
    resolveVariantCode(
      catalogByCode.get(String(baseCode || "").trim().toUpperCase()),
      baseCode,
      color,
      size
    );

  const currentUser = getStoredUser();
  const isSales = currentUser?.role === "SALES";
  const canSeeCostPrice = currentUser?.role === "CEO" || currentUser?.role === "ADMIN";
  const isAdmin = currentUser?.role === "CEO" || currentUser?.role === "ADMIN";
  const canCreateProduct = isAdmin || currentUser?.role === "ACCOUNTANT";

  const debouncedSearch = useDebounce(search, 400);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
      fetchBrandsApi()
        .then(setBrandOptions)
        .catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const loadImportFloorCodes = useCallback(async () => {
    try {
      const impRes = await apiRequest<any[]>("/imports").catch(() => ({ data: [] as any[] }));
      const f1 = new Set<string>();
      const f2 = new Set<string>();
      (Array.isArray(impRes.data) ? impRes.data : []).forEach((imp: any) => {
        if (imp.status !== "COMPLETED") return;
        const wh = imp.targetWarehouse === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1";
        (imp.items || []).forEach((it: any) => {
          if (wh === "FLOOR_2") f2.add(it.productCode);
          else f1.add(it.productCode);
        });
      });
      setFloor1Codes(f1);
      setFloor2Codes(f2);
    } catch {
      // ignore
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedCategory) q.set("categoryId", selectedCategory);
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
      setTotalProducts(res.meta?.totalProducts ?? list.length);
      setTotalStock(
        res.meta?.totalStock ?? list.reduce((sum, p) => sum + Number(p.stock || 0), 0)
      );
      if (!selectedCategory && !debouncedSearch.trim()) {
        setAllCatalogProducts(list);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch]);

  const loadAllCatalog = useCallback(async () => {
    try {
      const res = await apiRequest<Product[]>("/products");
      if (Array.isArray(res.data)) {
        setAllCatalogProducts(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadImportFloorCodes();
    loadAllCatalog();
  }, [loadImportFloorCodes, loadAllCatalog]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totalStockFloor1 = products.reduce((s, p) => s + getFloor1Stock(p), 0);
  const totalStockFloor2 = products.reduce((s, p) => s + (Number(p.stockFloor2) || 0), 0);
  const effectiveWarehouse = isSales ? "FLOOR_1" : activeWarehouse;

  return {
    products,
    setProducts,
    categories,
    selectedCategory,
    setSelectedCategory,
    search,
    setSearch,
    totalProducts,
    totalStock,
    loading,
    activeWarehouse,
    setActiveWarehouse,
    floor1Codes,
    floor2Codes,
    allCatalogProducts,
    setAllCatalogProducts,
    brandFilter,
    setBrandFilter,
    brandOptions,
    variantCodeFor,
    currentUser,
    isSales,
    canSeeCostPrice,
    isAdmin,
    canCreateProduct,
    loadInventory,
    totalStockFloor1,
    totalStockFloor2,
    effectiveWarehouse,
  };
}

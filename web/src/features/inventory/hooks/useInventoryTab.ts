import { useState, useEffect, useCallback, useMemo } from "react";
import type { Brand, Category, Product, ProductVariant } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import {
  addProductVariantsApi,
  fetchBrandsApi,
  lookupProductByCodeApi,
} from "@/shared/api/catalogLookup";
import { resolveVariantCode } from "@/shared/utils/productCode";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import type { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import type { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import { resolveVariantColorHexes } from "@/shared/ui/ColorSwatchPicker";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/shared/lib/barcodeScanner";

export function useInventoryTab() {
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
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [savingBatch, setSavingBatch] = useState(false);
  const [priceStatusMsg, setPriceStatusMsg] = useState<string | null>(null);

  const [expandedProdIds, setExpandedProdIds] = useState<Set<string>>(new Set());
  const [newVariantDrafts, setNewVariantDrafts] = useState<
    Record<
      string,
      {
        color: string;
        colorHexes?: string[];
        size: string;
        quantity: number;
        floor: "FLOOR_1" | "FLOOR_2";
      }
    >
  >({});
  const [addingVariantProdId, setAddingVariantProdId] = useState<string | null>(null);

  const [labelModalItems, setLabelModalItems] = useState<BarcodeLabelItem[] | null>(null);
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  const [brandFilter, setBrandFilter] = useState("");
  const [brandOptions, setBrandOptions] = useState<Brand[]>([]);
  const [showCodeCreator, setShowCodeCreator] = useState(false);

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

  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [showScannerPanel, setShowScannerPanel] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannedCheckCounts, setScannedCheckCounts] = useState<Record<string, number>>({});
  const [scannedVariantCounts, setScannedVariantCounts] = useState<
    Record<string, Record<string, number>>
  >({});
  const [lastScannedProdId, setLastScannedProdId] = useState<string | null>(null);
  const [lastScannedVariantCode, setLastScannedVariantCode] = useState<string | null>(null);
  const [onlyShowScanned, setOnlyShowScanned] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);

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

  const handleCodeCreatorDone = async (result: ProductCodeCreatorResult) => {
    setPriceStatusMsg(
      result.mode === "CREATED"
        ? `Đã tạo sản phẩm "${result.product.name}" mã ${result.product.code}. Nhập tồn qua phiếu nhập kho.`
        : `Đã thêm ${result.variants.length} biến thể vào sản phẩm ${result.product.code}.`
    );
    setAllCatalogProducts((prev) => [
      result.product,
      ...prev.filter((p) => p._id !== result.product._id),
    ]);
    await loadInventory();
  };

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

  const changedPriceProducts = useMemo(() => {
    return products.filter(
      (p) => priceEdits[p._id] !== undefined && priceEdits[p._id] !== Number(p.sellingPrice || 0)
    );
  }, [products, priceEdits]);

  const handleSaveAllPriceChanges = async () => {
    if (changedPriceProducts.length === 0 || savingBatch) return;
    setSavingBatch(true);
    setPriceStatusMsg(null);
    try {
      const updatedMap: Record<string, number> = {};
      for (const p of changedPriceProducts) {
        const nextPrice = priceEdits[p._id];
        const res = await apiRequest<Product>(`/products/${p._id}`, {
          method: "PATCH",
          body: JSON.stringify({ sellingPrice: nextPrice }),
        });
        updatedMap[p._id] = res.data?.sellingPrice ?? nextPrice;
      }
      setProducts((prev) =>
        prev.map((item) =>
          updatedMap[item._id] !== undefined
            ? { ...item, sellingPrice: updatedMap[item._id] }
            : item
        )
      );
      setPriceEdits((prev) => {
        const copy = { ...prev };
        changedPriceProducts.forEach((p) => delete copy[p._id]);
        return copy;
      });
      setPriceStatusMsg(
        `Đã lưu thành công giá niêm yết của ${changedPriceProducts.length} mặt hàng.`
      );
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật giá niêm yết");
    } finally {
      setSavingBatch(false);
    }
  };

  const toggleExpandProduct = (prodId: string) => {
    setExpandedProdIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  const handleAddVariantToProduct = async (product: Product) => {
    const draft = newVariantDrafts[product._id] || {
      color: "",
      colorHexes: [],
      size: "",
      quantity: 0,
      floor: "FLOOR_1" as const,
    };
    const cleanColor = draft.color.trim();
    const cleanSize = draft.size.trim().toUpperCase();
    const qty = Math.max(0, Math.round(Number(draft.quantity) || 0));

    if (!cleanColor && !cleanSize) {
      alert("Vui lòng nhập Màu sắc hoặc Size để thêm phân loại!");
      return;
    }

    setAddingVariantProdId(product._id);
    try {
      if (product.versionCode) {
        const updated = await addProductVariantsApi(product._id, [
          {
            color: cleanColor,
            size: cleanSize,
            colorHexes: resolveVariantColorHexes(cleanColor, draft.colorHexes),
          },
        ]);
        if (isAdmin && qty > 0) {
          const nextVariants = (updated.variants || []).map((v) => {
            const isNew =
              String(v.color || "").trim().toLowerCase() === cleanColor.toLowerCase() &&
              String(v.size || "").trim().toUpperCase() === cleanSize;
            const f1 = Number(v.stockFloor1 || 0) + (isNew && draft.floor === "FLOOR_1" ? qty : 0);
            const f2 = Number(v.stockFloor2 || 0) + (isNew && draft.floor === "FLOOR_2" ? qty : 0);
            return {
              color: v.color,
              colorHexes: v.colorHexes,
              size: v.size,
              stockFloor1: f1,
              stockFloor2: f2,
            };
          });
          await apiRequest(`/products/${product._id}`, {
            method: "PATCH",
            body: JSON.stringify({ variants: nextVariants, allowDirectStock: true }),
          });
        }
        setNewVariantDrafts((prev) => ({
          ...prev,
          [product._id]: { color: "", colorHexes: [], size: "", quantity: 0, floor: "FLOOR_1" },
        }));
        await loadInventory();
        setPriceStatusMsg(
          `Đã thêm phân loại (${[cleanColor, cleanSize ? `Size ${cleanSize}` : ""].filter(Boolean).join(" - ")}) vào mã ${product.code}.`
        );
        return;
      }
      const catId =
        typeof product.categoryId === "object" ? product.categoryId?._id : product.categoryId;
      await apiRequest(`/products`, {
        method: "POST",
        body: JSON.stringify({
          code: product.code,
          name: product.name,
          brand: product.brand || "",
          categoryId: catId,
          unit: product.unit,
          color: cleanColor,
          colorHexes: resolveVariantColorHexes(cleanColor, draft.colorHexes),
          size: cleanSize,
          quantity: isAdmin ? qty : 0,
          targetWarehouse: draft.floor,
          upsertIfExists: true,
        }),
      });
      setNewVariantDrafts((prev) => ({
        ...prev,
        [product._id]: { color: "", colorHexes: [], size: "", quantity: 0, floor: "FLOOR_1" },
      }));
      await loadInventory();
      setPriceStatusMsg(
        `Đã thêm phân loại (${[cleanColor, cleanSize ? `Size ${cleanSize}` : ""].filter(Boolean).join(" - ")}) vào mã ${product.code}.`
      );
    } catch (err: any) {
      alert(describeApiError(err, "Không thể thêm phân loại Màu/Size"));
    } finally {
      setAddingVariantProdId(null);
    }
  };

  const getFloor1Stock = (p: Product): number => {
    const f1 = Number(p.stockFloor1);
    const f2 = Number(p.stockFloor2 || 0);
    const legacyStock = Number(p.stock || 0);
    if (p.stockFloor1 === undefined || p.stockFloor1 === null || Number.isNaN(f1)) {
      return Math.max(0, legacyStock - f2);
    }
    if (f1 === 0 && f2 === 0 && legacyStock > 0) {
      return legacyStock;
    }
    return f1;
  };

  const totalStockFloor1 = products.reduce((s, p) => s + getFloor1Stock(p), 0);
  const totalStockFloor2 = products.reduce((s, p) => s + (Number(p.stockFloor2) || 0), 0);
  const effectiveWarehouse = isSales ? "FLOOR_1" : activeWarehouse;

  const expandProductToPrintLabelItems = useCallback(
    (p: Product, specificVariant?: ProductVariant): BarcodeLabelItem[] => {
      const f1 = getFloor1Stock(p);
      const effSellPrice = Number(priceEdits[p._id] ?? p.sellingPrice ?? 0);
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const namedVariants = variants.filter((v) => v.color || v.size);

      if (specificVariant) {
        const childCode = variantCodeFor(p.code, specificVariant.color, specificVariant.size);
        const vQty =
          effectiveWarehouse === "FLOOR_1"
            ? specificVariant.stockFloor1
            : effectiveWarehouse === "FLOOR_2"
              ? specificVariant.stockFloor2
              : specificVariant.stock;
        return [
          {
            id: `${p._id}_${childCode}`,
            code: childCode,
            productCode: p.code,
            productName: p.name,
            color: specificVariant.color,
            size: specificVariant.size,
            sellingPrice:
              Number(specificVariant.sellingPrice || 0) > 0
                ? Number(specificVariant.sellingPrice)
                : effSellPrice,
            unit: p.unit,
            defaultQty: Math.max(1, Number(vQty) || 1),
          },
        ];
      }

      if (namedVariants.length > 0) {
        return namedVariants.map((v, idx) => {
          const childCode = variantCodeFor(p.code, v.color, v.size);
          const vQty =
            effectiveWarehouse === "FLOOR_1"
              ? v.stockFloor1
              : effectiveWarehouse === "FLOOR_2"
                ? v.stockFloor2
                : v.stock;
          return {
            id: `${p._id}_${childCode}_${idx}`,
            code: childCode,
            productCode: p.code,
            productName: p.name,
            color: v.color,
            size: v.size,
            sellingPrice:
              Number(v.sellingPrice || 0) > 0 ? Number(v.sellingPrice) : effSellPrice,
            unit: p.unit,
            defaultQty: Math.max(1, Number(vQty) || 1),
          };
        });
      }

      return [
        {
          id: p._id,
          code: p.code,
          productCode: p.code,
          productName: p.name,
          sellingPrice: effSellPrice,
          unit: p.unit,
          defaultQty: Math.max(1, f1 || p.stock || 1),
        },
      ];
    },
    [effectiveWarehouse, priceEdits]
  );

  const handleBarcodeScanForInventoryCheck = useCallback(
    async (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;
      let scanRes = findProductAndVariantByScannedBarcode(pool, rawTrimmed);

      if (!scanRes) {
        try {
          const hit = await lookupProductByCodeApi(rawTrimmed);
          if (hit?.product) {
            const v = hit.variant;
            scanRes = {
              product: hit.product,
              matchedVariant: v
                ? {
                    ...v,
                    variantCode: v.variantCode || v.barcode || hit.product.code,
                    stockFloor1: Number(v.stockFloor1 || 0),
                    stockFloor2: Number(v.stockFloor2 || 0),
                    stock: Number(v.stock || 0),
                  }
                : undefined,
              isVariantExactMatch: Boolean(v),
            };
          }
        } catch {
          // ignore
        }
      }

      if (!scanRes) {
        try {
          const freshRes = await apiRequest<Product[]>("/products");
          const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
          if (freshPool.length > 0) {
            setAllCatalogProducts(freshPool);
            scanRes = findProductAndVariantByScannedBarcode(freshPool, rawTrimmed);
          }
        } catch {
          // ignore
        }
      }

      if (!scanRes) {
        playScannerBeep("error");
        const cleaned = cleanBarcodeCode(rawTrimmed);
        setLastScanFeedback({
          type: "error",
          code: cleaned || rawTrimmed,
          message: `Không tìm thấy sản phẩm hoặc mã con "${rawTrimmed}" trong kho.`,
          time: nowStr,
        });
        return;
      }

      const { product, matchedVariant } = scanRes;

      setExpandedProdIds((prev) => {
        const next = new Set(prev);
        next.add(product._id);
        return next;
      });
      setLastScannedProdId(product._id);

      const prevCount = scannedCheckCounts[product._id] || 0;
      const nextCount = prevCount + 1;
      setScannedCheckCounts((prev) => ({
        ...prev,
        [product._id]: nextCount,
      }));

      if (matchedVariant && (matchedVariant.color || matchedVariant.size)) {
        const childCode =
          matchedVariant.variantCode ||
          variantCodeFor(product.code, matchedVariant.color, matchedVariant.size);
        setLastScannedVariantCode(childCode);
        const prevVarCount = scannedVariantCounts[product._id]?.[childCode] || 0;
        const nextVarCount = prevVarCount + 1;
        setScannedVariantCounts((prev) => ({
          ...prev,
          [product._id]: {
            ...(prev[product._id] || {}),
            [childCode]: nextVarCount,
          },
        }));

        const varSysStock =
          effectiveWarehouse === "FLOOR_1"
            ? Number(matchedVariant.stockFloor1 || 0)
            : effectiveWarehouse === "FLOOR_2"
              ? Number(matchedVariant.stockFloor2 || 0)
              : Number(matchedVariant.stock || 0);

        const isOver = varSysStock > 0 && nextVarCount > varSysStock;
        const isExact = varSysStock > 0 && nextVarCount === varSysStock;
        playScannerBeep(isOver ? "warning" : "success");

        const attrDesc = [
          matchedVariant.color,
          matchedVariant.size ? `Size ${matchedVariant.size}` : "",
        ]
          .filter(Boolean)
          .join(" - ");

        setLastScanFeedback({
          type: isOver ? "warning" : "success",
          code: childCode,
          message: `[${childCode}] ${product.name} (${attrDesc}) • Đã quét mã con: ${nextVarCount} / Tồn biến thể: ${varSysStock} ${product.unit}${
            isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextVarCount - varSysStock})` : ""
          }`,
          time: nowStr,
        });
        return;
      }

      setLastScannedVariantCode(null);
      const sysStock =
        effectiveWarehouse === "FLOOR_1"
          ? getFloor1Stock(product)
          : effectiveWarehouse === "FLOOR_2"
            ? Number(product.stockFloor2 || 0)
            : Number(product.stock || 0);

      const isOver = sysStock > 0 && nextCount > sysStock;
      const isExact = sysStock > 0 && nextCount === sysStock;
      playScannerBeep(isOver ? "warning" : "success");

      setLastScanFeedback({
        type: isOver ? "warning" : "success",
        code: product.code,
        message: `[${product.code}] ${product.name} • Đã quét kiểm: ${nextCount} / Tồn hệ thống: ${sysStock} ${product.unit}${
          isExact ? " (✓ ĐÃ KHỚP ĐỦ)" : isOver ? ` (⚠️ DƯ +${nextCount - sysStock})` : ""
        }`,
        time: nowStr,
      });
    },
    [allCatalogProducts, products, scannedCheckCounts, scannedVariantCounts, effectiveWarehouse]
  );

  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !labelModalItems,
    onScan: (code) => {
      handleBarcodeScanForInventoryCheck(code);
    },
  });

  const displayedProducts = useMemo(() => {
    const byFloor = products
      .filter((p) => {
        if (onlyShowScanned && !scannedCheckCounts[p._id]) {
          return false;
        }
        const f1 = getFloor1Stock(p);
        const f2 = Number(p.stockFloor2) || 0;
        if (isSales) {
          return f1 > 0 || Boolean(scannedCheckCounts[p._id]);
        }
        if (effectiveWarehouse === "FLOOR_1") {
          return (
            f1 > 0 ||
            floor1Codes.has(p.code) ||
            !floor2Codes.has(p.code) ||
            Boolean(scannedCheckCounts[p._id])
          );
        }
        if (effectiveWarehouse === "FLOOR_2") {
          return f2 > 0 || floor2Codes.has(p.code) || Boolean(scannedCheckCounts[p._id]);
        }
        return true;
      })
      .filter((p) => {
        if (!brandFilter) return true;
        if (p.brandId) return String(p.brandId) === brandFilter;
        const b = brandOptions.find((x) => x._id === brandFilter);
        if (!b) return false;
        const norm = (t?: string) =>
          String(t || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
        return keys.has(norm(p.brand));
      });

    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.barcode, weight: 1.5 },
      { text: p.legacyCode, weight: 1.2 },
      { text: p.versionName, weight: 1.2 },
      { text: p.name, weight: 1.3 },
      { text: p.note, weight: 0.9 },
      { text: p.brandName || p.brand, weight: 1.1 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.categoryCode, weight: 0.9 },
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
    isSales,
    effectiveWarehouse,
    floor1Codes,
    floor2Codes,
    search,
    onlyShowScanned,
    scannedCheckCounts,
    brandFilter,
    brandOptions,
  ]);

  const colCount = (canSeeCostPrice ? 10 : 9) + (effectiveWarehouse === "ALL" ? 2 : 0);

  return {
    products,
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
    priceEdits,
    setPriceEdits,
    savingBatch,
    priceStatusMsg,
    expandedProdIds,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    labelModalItems,
    setLabelModalItems,
    brandFilter,
    setBrandFilter,
    brandOptions,
    showCodeCreator,
    setShowCodeCreator,
    variantCodeFor,
    scannerEnabled,
    setScannerEnabled,
    showScannerPanel,
    setShowScannerPanel,
    scannerInput,
    setScannerInput,
    scannedCheckCounts,
    setScannedCheckCounts,
    scannedVariantCounts,
    setScannedVariantCounts,
    lastScannedProdId,
    setLastScannedProdId,
    lastScannedVariantCode,
    setLastScannedVariantCode,
    onlyShowScanned,
    setOnlyShowScanned,
    lastScanFeedback,
    setLastScanFeedback,
    currentUser,
    isSales,
    canSeeCostPrice,
    isAdmin,
    canCreateProduct,
    handleCodeCreatorDone,
    loadInventory,
    changedPriceProducts,
    handleSaveAllPriceChanges,
    toggleExpandProduct,
    handleAddVariantToProduct,
    getFloor1Stock,
    totalStockFloor1,
    totalStockFloor2,
    effectiveWarehouse,
    expandProductToPrintLabelItems,
    handleBarcodeScanForInventoryCheck,
    displayedProducts,
    colCount,
  };
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Product,
  ProductVariant,
  Category,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  getStoredUser,
  useDebounce,
  filterAndRankBySearch,
  generateVariantProductCode,
} from "@/lib/api";
import BarcodeLabelModal, { BarcodeLabelItem } from "./BarcodeLabelModal";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/lib/barcodeScanner";
import {
  Package,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Save,
  CheckCircle2,
  Printer,
  ChevronDown,
  ChevronRight,
  Plus,
  ScanBarcode,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

export default function InventoryTab() {
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

  // Mở rộng xem/thêm Màu sắc & Size của từng Mã sản phẩm
  const [expandedProdIds, setExpandedProdIds] = useState<Set<string>>(new Set());
  const [newVariantDrafts, setNewVariantDrafts] = useState<
    Record<string, { color: string; size: string; quantity: number; floor: "FLOOR_1" | "FLOOR_2" }>
  >({});
  const [addingVariantProdId, setAddingVariantProdId] = useState<string | null>(null);

  // Modal in tem mã vạch (Label)
  const [labelModalItems, setLabelModalItems] = useState<BarcodeLabelItem[] | null>(null);

  // ===== MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO =====
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
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

  // Saler (role SALES) chỉ được thấy Giá bán & Số lượng ở Kho Tầng 1, KHÔNG được thấy Giá gốc hay Kho Tầng 2
  const currentUser = getStoredUser();
  const isSales = currentUser?.role === "SALES";
  const canSeeCostPrice =
    currentUser?.role === "ADMIN" || currentUser?.role === "WAREHOUSE";
  const isAdmin = currentUser?.role === "ADMIN";

  const debouncedSearch = useDebounce(search, 400);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
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
          updatedMap[item._id] !== undefined ? { ...item, sellingPrice: updatedMap[item._id] } : item
        )
      );
      setPriceEdits((prev) => {
        const copy = { ...prev };
        changedPriceProducts.forEach((p) => delete copy[p._id]);
        return copy;
      });
      setPriceStatusMsg(`Đã lưu thành công giá bán của ${changedPriceProducts.length} mặt hàng.`);
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật giá bán");
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
          size: cleanSize,
          quantity: isAdmin ? qty : 0,
          targetWarehouse: draft.floor,
          upsertIfExists: true,
        }),
      });
      setNewVariantDrafts((prev) => ({
        ...prev,
        [product._id]: { color: "", size: "", quantity: 0, floor: "FLOOR_1" },
      }));
      await loadInventory();
      setPriceStatusMsg(
        `Đã thêm phân loại (${[cleanColor, cleanSize ? `Size ${cleanSize}` : ""].filter(Boolean).join(" - ")}) vào mã ${product.code}.`
      );
    } catch (err: any) {
      alert(err?.message || "Không thể thêm phân loại Màu/Size");
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
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const namedVariants = variants.filter((v) => v.color || v.size);

      if (specificVariant) {
        const childCode =
          specificVariant.variantCode ||
          generateVariantProductCode(p.code, specificVariant.color, specificVariant.size);
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
            sellingPrice: p.sellingPrice,
            unit: p.unit,
            defaultQty: Math.max(1, Number(vQty) || 1),
          },
        ];
      }

      if (namedVariants.length > 0) {
        return namedVariants.map((v, idx) => {
          const childCode =
            v.variantCode || generateVariantProductCode(p.code, v.color, v.size);
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
            sellingPrice: p.sellingPrice,
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
          sellingPrice: p.sellingPrice,
          unit: p.unit,
          defaultQty: Math.max(1, f1 || p.stock || 1),
        },
      ];
    },
    [effectiveWarehouse]
  );

  const handleBarcodeScanForInventoryCheck = useCallback(
    (rawInput: string) => {
      const rawTrimmed = String(rawInput || "").trim();
      if (!rawTrimmed) return;
      const nowStr = new Date().toLocaleTimeString("vi-VN");
      const pool = allCatalogProducts.length > 0 ? allCatalogProducts : products;
      const scanRes = findProductAndVariantByScannedBarcode(pool, rawTrimmed);

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

      // Tự động mở rộng bảng phân loại Màu/Size của sản phẩm vừa quét
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
          generateVariantProductCode(product.code, matchedVariant.color, matchedVariant.size);
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
    const byFloor = products.filter((p) => {
      if (onlyShowScanned && !scannedCheckCounts[p._id]) {
        return false;
      }
      const f1 = getFloor1Stock(p);
      const f2 = Number(p.stockFloor2) || 0;
      if (isSales) {
        return f1 > 0 || Boolean(scannedCheckCounts[p._id]);
      }
      if (effectiveWarehouse === "FLOOR_1") {
        return f1 > 0 || floor1Codes.has(p.code) || !floor2Codes.has(p.code) || Boolean(scannedCheckCounts[p._id]);
      }
      if (effectiveWarehouse === "FLOOR_2") {
        return f2 > 0 || floor2Codes.has(p.code) || Boolean(scannedCheckCounts[p._id]);
      }
      return true;
    });

    if (!search.trim()) return byFloor;
    return filterAndRankBySearch(byFloor, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.barcode, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: p.brand, weight: 1.1 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.categoryCode, weight: 0.9 },
      { text: p.unit, weight: 0.6 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            text: `${v.variantCode || generateVariantProductCode(p.code, v.color, v.size)} ${v.color || ""} ${v.size || ""} size ${v.size || ""}`,
            weight: 1.4,
          }))
        : []),
    ]);
  }, [products, isSales, effectiveWarehouse, floor1Codes, floor2Codes, search, onlyShowScanned, scannedCheckCounts]);

  const colCount = (canSeeCostPrice ? 10 : 9) + (effectiveWarehouse === "ALL" ? 2 : 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* BỘ CHUYỂN KHO TẦNG 1 & KHO TẦNG 2 (Ẩn Kho Tầng 2 đối với Saler) */}
      {!isSales && (
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Phân chia Quản lý 2 Kho độc lập • 1 Mã chung chia theo Màu & Size
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              Đang xem:{" "}
              {effectiveWarehouse === "FLOOR_1"
                ? "🏢 Kho Tầng 1 (Kho bán lẻ & trưng bày)"
                : effectiveWarehouse === "FLOOR_2"
                ? "🏬 Kho Tầng 2 (Kho dự trữ)"
                : "📊 Xem gộp cả 2 Kho (Tầng 1 + Tầng 2)"}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveWarehouse("FLOOR_1")}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
                effectiveWarehouse === "FLOOR_1"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                  : "bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <span>🏢 KHO TẦNG 1</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                  effectiveWarehouse === "FLOOR_1"
                    ? "bg-white text-emerald-800"
                    : "bg-emerald-200 text-emerald-900"
                }`}
              >
                {totalStockFloor1.toLocaleString("vi-VN")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWarehouse("FLOOR_2")}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
                effectiveWarehouse === "FLOOR_2"
                  ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                  : "bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100"
              }`}
            >
              <span>🏬 KHO TẦNG 2</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                  effectiveWarehouse === "FLOOR_2"
                    ? "bg-white text-blue-800"
                    : "bg-blue-200 text-blue-900"
                }`}
              >
                {totalStockFloor2.toLocaleString("vi-VN")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWarehouse("ALL")}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border-2 ${
                effectiveWarehouse === "ALL"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
              }`}
            >
              <span>📊 GỘP 2 KHO</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                  effectiveWarehouse === "ALL"
                    ? "bg-white text-slate-900"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {totalStock.toLocaleString("vi-VN")}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Thẻ KPI Tổng số sản phẩm & Tổng tồn kho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {effectiveWarehouse === "FLOOR_1"
                ? "Số Mã SP Kho Tầng 1"
                : effectiveWarehouse === "FLOOR_2"
                ? "Số Mã SP Kho Tầng 2"
                : "Tổng số Mã sản phẩm chung"}
            </p>
            <p className="text-2xl md:text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {displayedProducts.length}
            </p>
          </div>
          <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {effectiveWarehouse === "FLOOR_1"
                ? "🏢 Tồn Kho Tầng 1"
                : effectiveWarehouse === "FLOOR_2"
                ? "🏬 Tồn Kho Tầng 2"
                : "Tổng tồn cả 2 kho"}
            </p>
            <p className="text-2xl md:text-3xl font-extrabold font-mono text-emerald-600 mt-1">
              {effectiveWarehouse === "FLOOR_1"
                ? totalStockFloor1
                : effectiveWarehouse === "FLOOR_2"
                ? totalStockFloor2
                : totalStock}
            </p>
          </div>
          <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 md:p-5 shadow-sm flex flex-col justify-center sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-bold uppercase text-emerald-400">
            Quy chuẩn 1 Mã Chung • Đa Màu & Size (v2.8)
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Mỗi dòng sản phẩm dùng <b>1 Mã IN HOA VIẾT LIỀN</b> duy nhất (in lên tem mã vạch). Bấm vào từng dòng để xem hoặc thêm chi tiết <b>Màu sắc • Size • Số lượng</b>.
          </p>
        </div>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
        {/* THANH MÁY QUÉT LABEL — QUÉT KIỂM HÀNG & ĐỐI CHIẾU TỒN KHO TRÊN KỆ */}
        <div className="mb-4 rounded-xl border-2 border-emerald-500/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 p-3 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ScanBarcode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                    Máy Quét Label — Quét Kiểm Hàng &amp; Đối Chiếu Tồn Kho
                  </span>
                  <button
                    type="button"
                    onClick={() => setScannerEnabled((v) => !v)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition ${
                      scannerEnabled
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {scannerEnabled ? "● ĐANG BẬT MÁY QUÉT (TỰ ĐỘNG)" : "○ ĐÃ TẮT MÁY QUÉT"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Cầm máy quét bắn trực tiếp tem mã vạch trên kệ để <b>đếm số lượng thực tế (+1 mỗi lần quét)</b>, tự động bung phân loại Màu/Size và đối chiếu tồn kho (tự khử lỗi bộ gõ Tiếng Việt Unikey).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!scannerInput.trim()) return;
                  handleBarcodeScanForInventoryCheck(scannerInput);
                  setScannerInput("");
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  data-barcode-input="true"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value.toUpperCase())}
                  placeholder="Quét hoặc gõ mã SP + Enter..."
                  className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border-2 border-emerald-400 bg-white text-xs font-mono font-extrabold text-slate-900 uppercase focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold whitespace-nowrap shadow-xs"
                >
                  +1 Kiểm
                </button>
              </form>

              {Object.keys(scannedCheckCounts).length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOnlyShowScanned((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition ${
                      onlyShowScanned
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {onlyShowScanned
                      ? `Đang lọc mã đã quét (${Object.keys(scannedCheckCounts).length})`
                      : `Chỉ hiện mã đã quét (${Object.keys(scannedCheckCounts).length})`}
                  </button>
                  {lastScannedProdId && (scannedCheckCounts[lastScannedProdId] || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setScannedCheckCounts((prev) => {
                          const cur = prev[lastScannedProdId] || 0;
                          const copy = { ...prev };
                          if (cur <= 1) delete copy[lastScannedProdId];
                          else copy[lastScannedProdId] = cur - 1;
                          return copy;
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1"
                      title="Trừ 1 số lượng kiểm của mã vừa quét"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCheckCounts({});
                      setScannedVariantCounts({});
                      setLastScannedProdId(null);
                      setLastScannedVariantCode(null);
                      setOnlyShowScanned(false);
                      setLastScanFeedback(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold"
                  >
                    Reset bộ đếm
                  </button>
                </>
              )}
            </div>
          </div>

          {lastScanFeedback && (
            <div
              className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                lastScanFeedback.type === "success"
                  ? "bg-emerald-100/90 border-emerald-300 text-emerald-950"
                  : lastScanFeedback.type === "warning"
                    ? "bg-amber-100/90 border-amber-300 text-amber-950"
                    : "bg-red-100/90 border-red-300 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {lastScanFeedback.type === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span className="truncate">{lastScanFeedback.message}</span>
              </div>
              <span className="text-[10px] font-mono opacity-75 shrink-0">
                {lastScanFeedback.time}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã SP, tên hàng, màu sắc, size..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 shrink-0 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 sm:flex-none min-w-0 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Tất cả Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-start md:self-auto">
            {displayedProducts.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setLabelModalItems(
                    displayedProducts.flatMap((p) => expandProductToPrintLabelItems(p))
                  )
                }
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>In Tem Mã Con ({displayedProducts.length})</span>
              </button>
            )}

            {canSeeCostPrice && (
              <>
                {changedPriceProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPriceEdits({})}
                    disabled={savingBatch}
                    className="min-h-[40px] px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition"
                  >
                    Hoàn tác ({changedPriceProducts.length})
                  </button>
                )}
                <button
                  type="button"
                  disabled={changedPriceProducts.length === 0 || savingBatch}
                  onClick={handleSaveAllPriceChanges}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm ${
                    changedPriceProducts.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {savingBatch
                    ? "Đang lưu..."
                    : changedPriceProducts.length > 0
                    ? `Lưu thay đổi (${changedPriceProducts.length})`
                    : "Lưu thay đổi"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={loadInventory}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Làm mới
            </button>
          </div>
        </div>

        {priceStatusMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{priceStatusMsg}</span>
          </div>
        )}

        {/* Bảng tồn kho */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
          <table className="w-full min-w-[920px] text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="py-3 px-3 w-10">STT</th>
                <th className="py-3 px-3">Mã SP Chung (Barcode)</th>
                <th className="py-3 px-3">Tên hàng hóa</th>
                <th className="py-3 px-3">Phân loại (Màu sắc • Size : SL)</th>
                <th className="py-3 px-3">Danh mục</th>
                <th className="py-3 px-2 text-center">ĐVT</th>
                {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
                  <th className="py-3 px-3 text-right text-emerald-300">🏢 Tầng 1</th>
                )}
                {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
                  <th className="py-3 px-3 text-right text-blue-300">🏬 Tầng 2</th>
                )}
                {effectiveWarehouse === "ALL" && (
                  <th className="py-3 px-3 text-right">Tổng 2 Kho</th>
                )}
                {canSeeCostPrice && (
                  <th className="py-3 px-3 text-right">Giá gốc</th>
                )}
                <th className="py-3 px-3 text-right">Giá bán niêm yết</th>
                <th className="py-3 px-3 text-center">Tem Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-slate-500">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-slate-500">
                    Không có mặt hàng nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((p, idx) => {
                  const catName =
                    p.categoryName ||
                    (typeof p.categoryId === "object" && p.categoryId?.name) ||
                    "Mặc định";
                  const f1 = getFloor1Stock(p);
                  const f2 = Number(p.stockFloor2) || 0;
                  const variants: ProductVariant[] = Array.isArray(p.variants) ? p.variants : [];
                  const isExpanded = expandedProdIds.has(p._id);
                  const draft = newVariantDrafts[p._id] || {
                    color: "",
                    size: "",
                    quantity: 0,
                    floor: "FLOOR_1" as const,
                  };

                  const scannedQty = scannedCheckCounts[p._id] || 0;
                  const sysStockForCompare =
                    effectiveWarehouse === "FLOOR_1"
                      ? f1
                      : effectiveWarehouse === "FLOOR_2"
                        ? f2
                        : Number(p.stock || 0);

                  return (
                    <React.Fragment key={p._id}>
                      <tr
                        className={`hover:bg-slate-50 transition-colors ${
                          lastScannedProdId === p._id
                            ? "bg-emerald-100/80 ring-2 ring-inset ring-emerald-500"
                            : scannedQty > 0
                              ? "bg-emerald-50/40"
                              : ""
                        }`}
                      >
                        <td className="py-3 px-3 font-mono text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                              {p.code}
                            </span>
                            {scannedQty > 0 && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                                  scannedQty === sysStockForCompare
                                    ? "bg-emerald-600 text-white border-emerald-700"
                                    : scannedQty > sysStockForCompare
                                      ? "bg-amber-500 text-white border-amber-600"
                                      : "bg-teal-100 text-teal-900 border-teal-300"
                                }`}
                              >
                                Đã quét: {scannedQty}/{sysStockForCompare}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.brand && (
                            <span className="inline-block mt-0.5 text-[11px] font-bold text-slate-500">
                              Hãng: {p.brand}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {variants.length > 0 ? (
                              variants.map((v, vIdx) => {
                                const vQty =
                                  effectiveWarehouse === "FLOOR_1"
                                    ? v.stockFloor1
                                    : effectiveWarehouse === "FLOOR_2"
                                    ? v.stockFloor2
                                    : v.stock;
                                const childCode =
                                  v.variantCode ||
                                  generateVariantProductCode(p.code, v.color, v.size);
                                const vScanned = scannedVariantCounts[p._id]?.[childCode] || 0;
                                const label =
                                  [v.color, v.size ? `Size ${v.size}` : ""]
                                    .filter(Boolean)
                                    .join(" - ") || "Mặc định";
                                return (
                                  <span
                                    key={`${v.variantKey || vIdx}`}
                                    title={`Mã con: ${childCode}`}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                      lastScannedVariantCode === childCode
                                        ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300"
                                        : vQty > 0
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-slate-100 text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    <span className="font-mono text-[10px] opacity-85">[{childCode}]</span>
                                    <span>{label}:</span>
                                    <span className="font-mono font-extrabold">{vQty}</span>
                                    {vScanned > 0 && (
                                      <span className="ml-0.5 px-1 rounded bg-teal-700 text-white font-mono text-[9px]">
                                        Quét:{vScanned}
                                      </span>
                                    )}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Chưa chia Size/Màu
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleExpandProduct(p._id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              <span>{isExpanded ? "Thu gọn" : "Chi tiết / +Size,Màu"}</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600">{catName}</td>
                        <td className="py-3 px-2 text-center text-xs">{p.unit}</td>
                        {(effectiveWarehouse === "FLOOR_1" || effectiveWarehouse === "ALL") && (
                          <td className="py-3 px-3 text-right font-mono font-extrabold bg-emerald-50/30">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                f1 > 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {f1}
                            </span>
                          </td>
                        )}
                        {(effectiveWarehouse === "FLOOR_2" || effectiveWarehouse === "ALL") && (
                          <td className="py-3 px-3 text-right font-mono font-extrabold bg-blue-50/30">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                f2 > 0
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {f2}
                            </span>
                          </td>
                        )}
                        {effectiveWarehouse === "ALL" && (
                          <td className="py-3 px-3 text-right font-mono font-extrabold">
                            <span className="px-2.5 py-1 rounded-full text-xs bg-slate-200 text-slate-900">
                              {p.stock}
                            </span>
                          </td>
                        )}
                        {canSeeCostPrice && (
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-amber-800 font-semibold">
                            {Number(p.costPrice) > 0 ? (
                              formatVND(p.costPrice)
                            ) : (
                              <span className="text-xs text-slate-400">0 VND</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                          {canSeeCostPrice ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="relative w-36">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={
                                    (priceEdits[p._id] !== undefined
                                      ? priceEdits[p._id]
                                      : Number(p.sellingPrice || 0)) > 0
                                      ? formatNumberDots(
                                          priceEdits[p._id] !== undefined
                                            ? priceEdits[p._id]
                                            : p.sellingPrice
                                        )
                                      : ""
                                  }
                                  onChange={(e) =>
                                    setPriceEdits((prev) => ({
                                      ...prev,
                                      [p._id]: parseNumberDots(e.target.value),
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveAllPriceChanges();
                                    }
                                  }}
                                  placeholder="Nhập giá bán..."
                                  className={`w-full pl-2 pr-9 py-1.5 rounded-lg border text-right text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none ${
                                    priceEdits[p._id] !== undefined &&
                                    priceEdits[p._id] !== Number(p.sellingPrice || 0)
                                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-400"
                                      : (priceEdits[p._id] ?? p.sellingPrice) > 0
                                      ? "border-slate-300 bg-white text-slate-900"
                                      : "border-amber-300 bg-amber-50 text-amber-900"
                                  }`}
                                />
                                <span className="absolute right-2 top-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                                  VND
                                </span>
                              </div>
                            </div>
                          ) : p.sellingPrice > 0 ? (
                            <span className="font-bold text-slate-900">
                              {formatVND(p.sellingPrice)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              Chưa có giá
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setLabelModalItems(expandProductToPrintLabelItems(p))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition"
                            title="In tem mã vạch theo từng Mã con (Màu + Size)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>In tem</span>
                          </button>
                        </td>
                      </tr>

                      {/* Bảng con: Chi tiết Màu sắc • Size • Tồn kho & Thêm phân loại */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={colCount} className="px-6 py-3.5 border-l-4 border-blue-600">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-extrabold text-slate-800">
                                  Bảng phân loại Size & Màu sắc của mã{" "}
                                  <span className="font-mono text-blue-700">{p.code}</span> ({p.name})
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  Mỗi thuộc tính (Màu + Size) có <b className="font-mono text-indigo-700">Mã con riêng</b> để in tem &amp; quét kiểm kho chính xác
                                </span>
                              </div>

                              <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                      <th className="py-2 px-3 text-left">#</th>
                                      <th className="py-2 px-3 text-left">Mã con (Barcode In Tem)</th>
                                      <th className="py-2 px-3 text-left">Màu sắc</th>
                                      <th className="py-2 px-3 text-left">Size</th>
                                      <th className="py-2 px-3 text-right text-emerald-700">
                                        🏢 Tồn Kho Tầng 1
                                      </th>
                                      {!isSales && (
                                        <th className="py-2 px-3 text-right text-blue-700">
                                          🏬 Tồn Kho Tầng 2
                                        </th>
                                      )}
                                      {!isSales && (
                                        <th className="py-2 px-3 text-right">Tổng tồn biến thể</th>
                                      )}
                                      <th className="py-2 px-3 text-center">In tem mã con</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {variants.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={isSales ? 6 : 8}
                                          className="py-3 px-3 text-center text-slate-400"
                                        >
                                          Sản phẩm này hiện chưa chia biến thể Màu/Size riêng (Tổng tồn:{" "}
                                          {p.stock} {p.unit}).
                                        </td>
                                      </tr>
                                    ) : (
                                      variants.map((v, vIdx) => {
                                        const childCode =
                                          v.variantCode ||
                                          generateVariantProductCode(p.code, v.color, v.size);
                                        const vScanned =
                                          scannedVariantCounts[p._id]?.[childCode] || 0;
                                        return (
                                          <tr
                                            key={v.variantKey || vIdx}
                                            className={
                                              lastScannedVariantCode === childCode
                                                ? "bg-emerald-50"
                                                : ""
                                            }
                                          >
                                            <td className="py-2 px-3 text-slate-400">{vIdx + 1}</td>
                                            <td className="py-2 px-3">
                                              <span className="font-mono font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                                {childCode}
                                              </span>
                                              {vScanned > 0 && (
                                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold">
                                                  Đã quét: {vScanned}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 font-bold text-slate-800">
                                              {v.color || "Mặc định"}
                                            </td>
                                            <td className="py-2 px-3 font-mono font-bold text-indigo-700">
                                              {v.size || "FREESIZE"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                              {v.stockFloor1}
                                            </td>
                                            {!isSales && (
                                              <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                                                {v.stockFloor2}
                                              </td>
                                            )}
                                            {!isSales && (
                                              <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                                                {v.stock}
                                              </td>
                                            )}
                                            <td className="py-2 px-3 text-center">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setLabelModalItems(
                                                    expandProductToPrintLabelItems(p, v)
                                                  )
                                                }
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold"
                                              >
                                                <Printer className="w-3 h-3" /> In mã {childCode}
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Form thêm nhanh Màu / Size mới cho mã này */}
                              {isAdmin && (
                                <div className="flex flex-wrap items-end gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                      Màu sắc mới
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.color}
                                      onChange={(e) =>
                                        setNewVariantDrafts((prev) => ({
                                          ...prev,
                                          [p._id]: { ...draft, color: e.target.value },
                                        }))
                                      }
                                      placeholder="VD: Đỏ, Trắng, Đen..."
                                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-36"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                      Size mới
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.size}
                                      onChange={(e) =>
                                        setNewVariantDrafts((prev) => ({
                                          ...prev,
                                          [p._id]: { ...draft, size: e.target.value.toUpperCase() },
                                        }))
                                      }
                                      placeholder="VD: S, M, L, XL, 42..."
                                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-28 font-mono uppercase"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                      Số lượng nhập thêm
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={draft.quantity}
                                      onChange={(e) =>
                                        setNewVariantDrafts((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...draft,
                                            quantity: Math.max(0, Number(e.target.value) || 0),
                                          },
                                        }))
                                      }
                                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs w-28 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                      Kho tầng
                                    </label>
                                    <select
                                      value={draft.floor}
                                      onChange={(e) =>
                                        setNewVariantDrafts((prev) => ({
                                          ...prev,
                                          [p._id]: {
                                            ...draft,
                                            floor:
                                              e.target.value === "FLOOR_2" ? "FLOOR_2" : "FLOOR_1",
                                          },
                                        }))
                                      }
                                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                                    >
                                      <option value="FLOOR_1">🏢 Kho Tầng 1</option>
                                      <option value="FLOOR_2">🏬 Kho Tầng 2</option>
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={addingVariantProdId === p._id}
                                    onClick={() => handleAddVariantToProduct(p)}
                                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>
                                      {addingVariantProdId === p._id
                                        ? "Đang thêm..."
                                        : "Thêm Size / Màu"}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal In Tem Mã Vạch (Label Printer) */}
      <BarcodeLabelModal
        open={Boolean(labelModalItems)}
        onClose={() => setLabelModalItems(null)}
        items={labelModalItems || []}
        title="In Tem Mã Vạch Sản Phẩm (Máy In Label)"
      />
    </div>
  );
}

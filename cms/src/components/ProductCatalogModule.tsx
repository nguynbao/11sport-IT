"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brand,
  Category,
  Product,
  ProductVariant,
  addProductVariantsApi,
  apiRequest,
  describeApiError,
  fetchBrandsApi,
  filterAndRankBySearch,
  formatNumberDots,
  formatVND,
  getStoredUser,
  parseNumberDots,
  resolveVariantCode,
  useDebounce,
  variantEffectiveCostPrice,
  variantEffectiveSellingPrice,
} from "@/lib/api";
import ProductCodeCreatorModal, { ProductCodeCreatorResult } from "./ProductCodeCreatorModal";
import BarcodeLabelModal, { BarcodeLabelItem } from "./BarcodeLabelModal";
import ExportExcelButton from "./ExportExcelButton";
import { exportProducts } from "@/lib/exports";
import {
  ColorInputWithPicker,
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "./ColorSwatchPicker";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const COMMON_COLORS = [
  "Đỏ",
  "Đen",
  "Trắng",
  "Xanh Dương",
  "Xanh Đen",
  "Xanh Lá",
  "Vàng",
  "Hồng",
  "Xám",
  "Tím",
  "Cam",
  "Kem",
];

const COMMON_SIZES = [
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "FREESIZE",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
];

type StockStatusFilter = "ALL" | "IN_STOCK" | "ZERO_STOCK" | "NEW_SCHEME";

export default function ProductCatalogModule() {
  const [canSeeCost, setCanSeeCost] = useState(true);
  useEffect(() => {
    setCanSeeCost(String(getStoredUser()?.role || "").toUpperCase() !== "SALES");
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterStatus, setFilterStatus] = useState<StockStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Modals & messages
  const [showCodeCreator, setShowCodeCreator] = useState(false);
  const [editingProductModal, setEditingProductModal] = useState<Product | null>(null);
  const [labelItems, setLabelItems] = useState<BarcodeLabelItem[]>([]);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editing state per product
  const [expandedProdId, setExpandedProdId] = useState<string | null>(null);
  const [editingBase, setEditingBase] = useState<
    Record<string, { name: string; unit: string; costPrice: number; sellingPrice: number; note: string }>
  >({});
  const [savingProdId, setSavingProdId] = useState<string | null>(null);

  // New variant draft per product
  const [newVariantDrafts, setNewVariantDrafts] = useState<
    Record<
      string,
      {
        color: string;
        colorCode: string;
        colorHexes?: string[];
        size: string;
        costPrice: number;
        sellingPrice: number;
      }
    >
  >({});
  const [addingVariantProdId, setAddingVariantProdId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c._id, c));
    return m;
  }, [categories]);

  const brandMap = useMemo(() => {
    const m = new Map<string, Brand>();
    brands.forEach((b) => m.set(b._id, b));
    return m;
  }, [brands]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, brandList] = await Promise.all([
        apiRequest<Product[]>("/products"),
        apiRequest<Category[]>("/categories"),
        fetchBrandsApi(),
      ]);
      const pList = Array.isArray(prodRes.data) ? prodRes.data : [];
      const cList = Array.isArray(catRes.data) ? catRes.data : [];
      setProducts(pList);
      setCategories(cList);
      setBrands(brandList);

      const baseMap: Record<
        string,
        { name: string; unit: string; costPrice: number; sellingPrice: number; note: string }
      > = {};
      pList.forEach((p) => {
        baseMap[p._id] = {
          name: p.name || "",
          unit: p.unit || "Cái",
          costPrice: Number(p.costPrice || 0),
          sellingPrice: Number(p.sellingPrice || 0),
          note: p.note || "",
        };
      });
      setEditingBase(baseMap);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không tải được danh sách sản phẩm.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const catId = typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
      if (filterCategoryId && catId !== filterCategoryId) return false;
      if (filterBrandId) {
        if (p.brandId) {
          if (String(p.brandId) !== filterBrandId) return false;
        } else {
          const b = brandMap.get(filterBrandId);
          if (!b) return false;
          const norm = (t?: string) =>
            String(t || "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
          const keys = new Set([norm(b.name), norm(b.code), ...(b.aliases || []).map(norm)]);
          if (!keys.has(norm(p.brand))) return false;
        }
      }
      const totalStock = Number(p.stock ?? (Number(p.stockFloor1 || 0) + Number(p.stockFloor2 || 0)));
      if (filterStatus === "IN_STOCK" && totalStock <= 0) return false;
      if (filterStatus === "ZERO_STOCK" && totalStock > 0) return false;
      if (filterStatus === "NEW_SCHEME" && !p.versionCode) return false;
      return true;
    });

    if (!debouncedSearch.trim()) return filtered;
    return filterAndRankBySearch(filtered, debouncedSearch, (p) => [
      { text: p.code, weight: 1.6 },
      { text: p.legacyCode, weight: 1.3 },
      { text: p.name, weight: 1.4 },
      { text: p.versionName, weight: 1.3 },
      { text: p.versionCode, weight: 1.3 },
      { text: p.brandName || p.brand, weight: 1.1 },
      { text: p.brandCode, weight: 1.1 },
      { text: p.categoryName, weight: 0.9 },
      { text: p.note, weight: 0.9 },
      ...(Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            text: `${v.variantCode || ""} ${v.color || ""} ${v.size || ""}`,
            weight: 1.4,
          }))
        : []),
    ]);
  }, [products, filterCategoryId, filterBrandId, filterStatus, debouncedSearch, brandMap]);

  const handleCodeCreatorDone = (result: ProductCodeCreatorResult) => {
    setStatusMsg({
      type: "success",
      text:
        result.mode === "CREATED"
          ? `Đã tạo sản phẩm "${result.product.name}" — Mã gốc: ${result.product.code} (${result.variants.length} biến thể, tồn ban đầu = 0).`
          : result.mode === "UPDATED"
            ? `Đã cập nhật sản phẩm "${result.product.name}" — Mã gốc: ${result.product.code} (${(result.product.variants || []).length} biến thể).`
            : `Đã bổ sung ${result.variants.length} biến thể vào sản phẩm ${result.product.code}.`,
    });
    setEditingProductModal(null);
    setExpandedProdId(result.product._id);
    loadAll();
  };

  const handleSaveBaseProduct = async (p: Product) => {
    const draft = editingBase[p._id];
    if (!draft) return;
    if (!draft.name.trim()) {
      setStatusMsg({ type: "error", text: `Tên sản phẩm (${p.code}) không được để trống.` });
      return;
    }
    setSavingProdId(p._id);
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${p._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          unit: draft.unit.trim() || "Cái",
          note: String(draft.note || "").trim(),
          sellingPrice: Math.max(0, Math.round(Number(draft.sellingPrice || 0))),
          ...(canSeeCost ? { costPrice: Math.max(0, Math.round(Number(draft.costPrice || 0))) } : {}),
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật thông tin, ghi chú & giá mặc định cho sản phẩm "${draft.name.trim()}" (${p.code}).`,
      });
      await loadAll();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không thể lưu thay đổi sản phẩm.") });
    } finally {
      setSavingProdId(null);
    }
  };

  const handleSaveVariantPrice = async (
    prod: Product,
    v: ProductVariant,
    field: "sellingPrice" | "costPrice",
    value: number
  ) => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next === Math.max(0, Number(v[field] || 0))) return;
    if (!v.variantKey && !v.variantCode) return;
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${prod._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          variantPrices: [
            {
              ...(v.variantKey ? { variantKey: v.variantKey } : { variantCode: v.variantCode }),
              [field]: next,
            },
          ],
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã lưu ${field === "sellingPrice" ? "giá niêm yết" : "giá vốn"} riêng cho biến thể ${v.variantCode || `${v.color} ${v.size}`}${next === 0 ? " (dùng giá mặc định)" : ""}.`,
      });
      await loadAll();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không lưu được giá riêng của biến thể.") });
    }
  };

  const handleAddVariant = async (prod: Product) => {
    const draft = newVariantDrafts[prod._id] || {
      color: "",
      colorCode: "",
      colorHexes: [],
      size: "",
      costPrice: 0,
      sellingPrice: 0,
    };
    const color = draft.color.trim();
    const colorCode = draft.colorCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    const size = draft.size.trim().toUpperCase();
    if (!color) {
      setStatusMsg({ type: "error", text: "Vui lòng nhập Màu sắc cho biến thể mới." });
      return;
    }
    if (colorCode && !/^[A-Z0-9]{2,3}$/.test(colorCode)) {
      setStatusMsg({ type: "error", text: "Mã màu phải gồm 2–3 ký tự A-Z, 0-9." });
      return;
    }
    setAddingVariantProdId(prod._id);
    setStatusMsg(null);
    try {
      await addProductVariantsApi(prod._id, [
        {
          color,
          ...(colorCode ? { colorCode } : {}),
          colorHexes: resolveVariantColorHexes(color, draft.colorHexes),
          size,
          ...(draft.sellingPrice > 0 ? { sellingPrice: draft.sellingPrice } : {}),
          ...(canSeeCost && draft.costPrice > 0 ? { costPrice: draft.costPrice } : {}),
        },
      ]);
      setNewVariantDrafts((prev) => ({
        ...prev,
        [prod._id]: {
          color,
          colorCode,
          colorHexes: draft.colorHexes,
          size: "",
          costPrice: 0,
          sellingPrice: 0,
        },
      }));
      setStatusMsg({
        type: "success",
        text: `Đã thêm biến thể (${color}${size ? ` - Size ${size}` : ""}) vào sản phẩm ${prod.code}!`,
      });
      await loadAll();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không thêm được biến thể mới.") });
    } finally {
      setAddingVariantProdId(null);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Bạn có chắc chắn muốn XÓA sản phẩm "${prod.name}" (Mã: ${prod.code}) khỏi danh mục không?`)
    ) {
      return;
    }
    setStatusMsg(null);
    try {
      await apiRequest(`/products/${prod._id}`, { method: "DELETE" });
      setStatusMsg({
        type: "success",
        text: `Đã xóa sản phẩm "${prod.name}" (${prod.code}) khỏi danh mục.`,
      });
      await loadAll();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: describeApiError(err, "Không thể xóa sản phẩm đã có giao dịch/tồn kho."),
      });
    }
  };

  const buildLabelItems = (prod: Product, specificVariant?: ProductVariant): BarcodeLabelItem[] => {
    const vars = (prod.variants || []).filter((v) => v.color || v.size);
    if (specificVariant) {
      const code = resolveVariantCode(prod, prod.code, specificVariant.color, specificVariant.size);
      return [
        {
          id: `${prod._id}_${code}`,
          code,
          productCode: prod.code,
          productName: prod.name,
          color: specificVariant.color,
          size: specificVariant.size,
          sellingPrice: variantEffectiveSellingPrice(prod, specificVariant),
          unit: prod.unit || "Cái",
          defaultQty: Math.max(1, Number(specificVariant.stock || 1)),
        },
      ];
    }
    if (vars.length > 0) {
      return vars.map((v, idx) => {
        const code = resolveVariantCode(prod, prod.code, v.color, v.size);
        return {
          id: `${prod._id}_${code}_${idx}`,
          code,
          productCode: prod.code,
          productName: prod.name,
          color: v.color,
          size: v.size,
          sellingPrice: variantEffectiveSellingPrice(prod, v),
          unit: prod.unit || "Cái",
          defaultQty: Math.max(1, Number(v.stock || 1)),
        };
      });
    }
    return [
      {
        id: prod._id,
        code: prod.code,
        productCode: prod.code,
        productName: prod.name,
        sellingPrice: Number(prod.sellingPrice || 0),
        unit: prod.unit || "Cái",
        defaultQty: Math.max(1, Number(prod.stock || 1)),
      },
    ];
  };

  const handleOpenPrintLabel = (prod: Product, specificVariant?: ProductVariant) => {
    setLabelItems(buildLabelItems(prod, specificVariant));
    setShowLabelModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Banner hướng dẫn */}
      <div className="bg-white text-slate-900 rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-0.5">
            <div className="font-extrabold text-sm text-slate-900">
              Danh mục Sản phẩm Chuẩn Mã (CATEGORY + BRAND + VERSION + MÀU + SIZE)
            </div>
            <p className="text-slate-600">
              Khai báo trước Mã gốc, các biến thể (Màu • Size), Giá vốn &amp; Giá niêm yết tại đây. Khi hàng về kho, chỉ cần vào{" "}
              <strong className="text-teal-700">Quản lý Kho → + Nhập kho</strong> để chọn sẵn sản phẩm và nhập số lượng.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCodeCreator(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs inline-flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm Sản phẩm mới</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role={statusMsg.type === "error" ? "alert" : "status"}
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Khung bộ lọc & danh sách sản phẩm */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            <span>Danh sách Sản phẩm ({visibleProducts.length}/{products.length} mã gốc)</span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã gốc, mã con, tên, ghi chú..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <select
              aria-label="Lọc theo danh mục"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Tất cả Category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.skuCode ? `[${c.skuCode}] ` : ""}
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc theo thương hiệu"
              value={filterBrandId}
              onChange={(e) => setFilterBrandId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Tất cả Thương hiệu</option>
              {brands
                .filter(
                  (b) =>
                    !filterCategoryId ||
                    b.isSystem ||
                    (b.categoryIds || []).map(String).includes(filterCategoryId)
                )
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
            </select>

            <select
              aria-label="Lọc theo trạng thái"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StockStatusFilter)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="NEW_SCHEME">Chuẩn mã v5.0 (có Version)</option>
              <option value="IN_STOCK">Đang có tồn kho (&gt; 0)</option>
              <option value="ZERO_STOCK">Chưa nhập tồn (= 0)</option>
            </select>

            <ExportExcelButton
              onExport={() => exportProducts(visibleProducts, { hideCost: !canSeeCost })}
              disabled={visibleProducts.length === 0}
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3">Mã gốc &amp; Mã cũ</th>
                <th className="py-3 px-3 min-w-[260px]">Tên sản phẩm, Ghi chú &amp; Biến thể</th>
                <th className="py-3 px-3">Category • Brand • Version</th>
                <th className="py-3 px-2.5 text-center w-20">ĐVT</th>
                {canSeeCost && <th className="py-3 px-3 text-right w-36">Giá vốn</th>}
                <th className="py-3 px-3 text-right w-36">Giá niêm yết</th>
                <th className="py-3 px-3 text-center w-24">Tồn hiện tại</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={canSeeCost ? 9 : 8} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Đang tải danh mục sản phẩm...
                  </td>
                </tr>
              )}
              {!loading && visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={canSeeCost ? 9 : 8} className="py-8 text-center text-slate-500">
                    Chưa có sản phẩm nào khớp bộ lọc. Bấm <strong>+ Thêm Sản phẩm mới</strong> để khai báo.
                  </td>
                </tr>
              )}
              {visibleProducts.map((p, idx) => {
                const catId =
                  typeof p.categoryId === "object" ? p.categoryId?._id || "" : String(p.categoryId || "");
                const cat = categoryMap.get(catId);
                const brand = p.brandId ? brandMap.get(String(p.brandId)) : undefined;
                const baseEdit = editingBase[p._id] || {
                  name: p.name || "",
                  unit: p.unit || "Cái",
                  costPrice: Number(p.costPrice || 0),
                  sellingPrice: Number(p.sellingPrice || 0),
                  note: p.note || "",
                };
                const isBaseChanged =
                  baseEdit.name.trim() !== String(p.name || "").trim() ||
                  baseEdit.unit.trim() !== String(p.unit || "Cái").trim() ||
                  String(baseEdit.note || "").trim() !== String(p.note || "").trim() ||
                  Number(baseEdit.costPrice || 0) !== Number(p.costPrice || 0) ||
                  Number(baseEdit.sellingPrice || 0) !== Number(p.sellingPrice || 0);

                const prodVariants = Array.isArray(p.variants) ? p.variants : [];
                const isExpanded = expandedProdId === p._id;
                const newVarDraft = newVariantDrafts[p._id] || {
                  color: "",
                  colorCode: "",
                  colorHexes: [],
                  size: "",
                  costPrice: 0,
                  sellingPrice: 0,
                };
                const totalStock = Number(
                  p.stock ?? (Number(p.stockFloor1 || 0) + Number(p.stockFloor2 || 0))
                );

                return (
                  <React.Fragment key={p._id}>
                    <tr className={`hover:bg-slate-50 ${isExpanded ? "bg-indigo-50/30" : ""}`}>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 align-top">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono font-extrabold text-slate-900 text-xs">{p.code}</div>
                        {p.legacyCode && p.legacyCode !== p.code && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Mã cũ: {p.legacyCode}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top space-y-1.5">
                        <input
                          type="text"
                          value={baseEdit.name}
                          onChange={(e) =>
                            setEditingBase((prev) => ({
                              ...prev,
                              [p._id]: { ...baseEdit, name: e.target.value },
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveBaseProduct(p);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-bold text-slate-900 bg-white"
                        />
                        <div className="relative">
                          <FileText className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={baseEdit.note || ""}
                            onChange={(e) =>
                              setEditingBase((prev) => ({
                                ...prev,
                                [p._id]: { ...baseEdit, note: e.target.value },
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveBaseProduct(p);
                              }
                            }}
                            placeholder="Ghi chú sản phẩm (VD: chất liệu, bảo hành, tư vấn size...)"
                            className={`w-full pl-7 pr-2.5 py-1 rounded border text-[11px] transition ${
                              baseEdit.note
                                ? "border-amber-200 bg-amber-50/40 text-slate-800 font-medium"
                                : "border-slate-200 bg-slate-50/60 text-slate-600 placeholder:text-slate-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedProdId(isExpanded ? null : p._id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold transition cursor-pointer ${
                              isExpanded
                                ? "bg-indigo-600 text-white border-indigo-700"
                                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200"
                            }`}
                          >
                            <span>
                              🎨 {prodVariants.length} biến thể (Màu/Size) · + Thêm biến thể
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {prodVariants.slice(0, 4).map((v, vIdx) => {
                            const vCode = resolveVariantCode(p, p.code, v.color, v.size);
                            return (
                              <span
                                key={`${vCode}_${vIdx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                                title={`Mã con: ${vCode}`}
                              >
                                <span className="font-bold text-slate-900">{v.color}</span>
                                {v.size && <span className="text-indigo-700 font-mono">• {v.size}</span>}
                                <span className="font-mono text-slate-500">[{vCode}]</span>
                              </span>
                            );
                          })}
                          {prodVariants.length > 4 && (
                            <span className="text-[10px] text-slate-500 font-bold">
                              +{prodVariants.length - 4} biến thể...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-bold text-[11px]">
                            {cat?.skuCode ? `[${cat.skuCode}] ` : ""}
                            {cat?.name || p.categoryName || "—"}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-bold text-[11px]">
                            {p.brandCode || brand?.code ? `[${p.brandCode || brand?.code}] ` : ""}
                            {p.brandName || brand?.name || p.brand || "NN"}
                          </span>
                        </div>
                        {(p.versionName || p.versionCode) && (
                          <div className="text-[11px] text-slate-600">
                            Version: <strong className="text-slate-900">{p.versionName || "—"}</strong>{" "}
                            {p.versionCode && (
                              <span className="font-mono font-bold text-indigo-700">({p.versionCode})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2.5 text-center align-top">
                        <input
                          type="text"
                          value={baseEdit.unit}
                          onChange={(e) =>
                            setEditingBase((prev) => ({
                              ...prev,
                              [p._id]: { ...baseEdit, unit: e.target.value },
                            }))
                          }
                          className="w-16 px-2 py-1.5 rounded border border-slate-300 text-center font-semibold"
                        />
                      </td>
                      {canSeeCost && (
                        <td className="py-3 px-3 text-right align-top">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={baseEdit.costPrice > 0 ? formatNumberDots(baseEdit.costPrice) : ""}
                            placeholder="0"
                            onChange={(e) =>
                              setEditingBase((prev) => ({
                                ...prev,
                                [p._id]: { ...baseEdit, costPrice: parseNumberDots(e.target.value) },
                              }))
                            }
                            className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3 text-right align-top">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={baseEdit.sellingPrice > 0 ? formatNumberDots(baseEdit.sellingPrice) : ""}
                          placeholder="0"
                          onChange={(e) =>
                            setEditingBase((prev) => ({
                              ...prev,
                              [p._id]: { ...baseEdit, sellingPrice: parseNumberDots(e.target.value) },
                            }))
                          }
                          className="w-28 px-2 py-1.5 rounded border border-teal-300 text-right font-mono font-bold text-teal-900"
                        />
                      </td>
                      <td className="py-3 px-3 text-center align-top font-mono font-extrabold text-slate-800">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            totalStock > 0
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {totalStock} {baseEdit.unit || p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProductModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Sửa đầy đủ Danh mục, Thương hiệu, Version, Mã Version, Tên SP, Giá và các Biến thể Màu/Size"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Sửa
                          </button>
                          {isBaseChanged && (
                            <>
                              <button
                                type="button"
                                disabled={savingProdId === p._id}
                                onClick={() => handleSaveBaseProduct(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {savingProdId === p._id ? "Lưu..." : "Lưu"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingBase((prev) => ({
                                    ...prev,
                                    [p._id]: {
                                      name: p.name || "",
                                      unit: p.unit || "Cái",
                                      costPrice: Number(p.costPrice || 0),
                                      sellingPrice: Number(p.sellingPrice || 0),
                                      note: p.note || "",
                                    },
                                  }))
                                }
                                title="Hoàn tác thay đổi chưa lưu"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPrintLabel(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="In tem nhãn mã vạch cho sản phẩm này"
                          >
                            <Printer className="w-3.5 h-3.5" /> In tem
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 inline-flex items-center justify-center cursor-pointer"
                            title="Xóa sản phẩm (khi chưa phát sinh giao dịch)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-indigo-50/40">
                        <td colSpan={canSeeCost ? 9 : 8} className="p-4">
                          <div className="bg-white rounded-xl border-2 border-indigo-200 p-4 space-y-4 shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="font-extrabold text-indigo-950 text-xs">
                                  Danh sách Biến thể (Màu • Size • Mã con) của SP:{" "}
                                  <span className="font-mono text-indigo-700">{p.code}</span> — {p.name}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Giá riêng của biến thể nếu để trống (hoặc 0) sẽ tự động dùng Giá vốn (
                                  {formatVND(baseEdit.costPrice)}) và Giá niêm yết ({formatVND(baseEdit.sellingPrice)}) mặc định của sản phẩm gốc.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingProductModal(p)}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Sửa Category / Brand / Version / Biến thể
                              </button>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px]">
                                  <tr>
                                    <th className="py-2 px-3 w-10 text-center">#</th>
                                    <th className="py-2 px-3">Mã con (variantCode)</th>
                                    <th className="py-2 px-3">Màu sắc &amp; Mã màu</th>
                                    <th className="py-2 px-3">Size</th>
                                    {canSeeCost && <th className="py-2 px-3 text-right">Giá vốn riêng</th>}
                                    <th className="py-2 px-3 text-right">Giá niêm yết riêng</th>
                                    <th className="py-2 px-3 text-center">Tồn hiện tại</th>
                                    <th className="py-2 px-3 text-right">In tem lẻ</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {prodVariants.length === 0 ? (
                                    <tr>
                                      <td colSpan={canSeeCost ? 8 : 7} className="py-4 text-center text-slate-400">
                                        Chưa có biến thể nào. Hãy thêm biến thể (Màu / Size) ở khung bên dưới.
                                      </td>
                                    </tr>
                                  ) : (
                                    prodVariants.map((v, vIdx) => {
                                      const vCode = resolveVariantCode(p, p.code, v.color, v.size);
                                      const hexes = resolveVariantColorHexes(v.color, v.colorHexes);
                                      const effCost = variantEffectiveCostPrice(p, v);
                                      const effSell = variantEffectiveSellingPrice(p, v);
                                      const vStock =
                                        Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0)));
                                      return (
                                        <tr key={`${vCode}_${vIdx}`} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                                            {vIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-extrabold text-indigo-700">
                                            {vCode}
                                          </td>
                                          <td className="py-2 px-3">
                                            <div
                                              style={getColorBoxBorderStyle(hexes, "#f8fafc", 2)}
                                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-50"
                                            >
                                              <ColorSwatchBadge hexes={hexes} colorName={v.color} size="xs" />
                                              <span className="font-bold text-slate-900">{v.color}</span>
                                              {v.colorCode && (
                                                <span className="font-mono text-[10px] text-slate-500">
                                                  ({v.colorCode})
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 font-mono font-extrabold text-slate-900">
                                            {v.size || "—"}
                                          </td>
                                          {canSeeCost && (
                                            <td className="py-2 px-3 text-right">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                defaultValue={
                                                  Number(v.costPrice || 0) > 0
                                                    ? formatNumberDots(Number(v.costPrice))
                                                    : ""
                                                }
                                                key={`vcost_${p._id}_${vIdx}_${v.costPrice || 0}`}
                                                placeholder={`Mặc định: ${formatNumberDots(effCost)}`}
                                                onBlur={(e) =>
                                                  handleSaveVariantPrice(
                                                    p,
                                                    v,
                                                    "costPrice",
                                                    parseNumberDots(e.target.value)
                                                  )
                                                }
                                                className="w-32 px-2 py-1 rounded border border-slate-300 font-mono text-right"
                                              />
                                            </td>
                                          )}
                                          <td className="py-2 px-3 text-right">
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              defaultValue={
                                                Number(v.sellingPrice || 0) > 0
                                                  ? formatNumberDots(Number(v.sellingPrice))
                                                  : ""
                                              }
                                              key={`vsell_${p._id}_${vIdx}_${v.sellingPrice || 0}`}
                                              placeholder={`Mặc định: ${formatNumberDots(effSell)}`}
                                              onBlur={(e) =>
                                                handleSaveVariantPrice(
                                                  p,
                                                  v,
                                                  "sellingPrice",
                                                  parseNumberDots(e.target.value)
                                                )
                                              }
                                              className="w-32 px-2 py-1 rounded border border-teal-300 font-mono text-right text-teal-900 font-bold"
                                            />
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                            {vStock} (T1: {v.stockFloor1 || 0} · T2: {v.stockFloor2 || 0})
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPrintLabel(p, v)}
                                              className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <Printer className="w-3 h-3" /> In tem
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Form thêm biến thể mới vào sản phẩm */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  + Màu sắc mới *
                                </label>
                                <ColorInputWithPicker
                                  listId="catalog-color-suggestions"
                                  value={newVarDraft.color}
                                  colorHexes={newVarDraft.colorHexes}
                                  onChange={(nextColor, nextHexes) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        color: nextColor,
                                        colorHexes: nextHexes,
                                      },
                                    }))
                                  }
                                  placeholder="VD: Đỏ, Trắng..."
                                  className="w-48"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Mã màu (2–3 ký tự)
                                </label>
                                <input
                                  type="text"
                                  maxLength={3}
                                  value={newVarDraft.colorCode}
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        colorCode: e.target.value
                                          .toUpperCase()
                                          .replace(/[^A-Z0-9]/g, "")
                                          .slice(0, 3),
                                      },
                                    }))
                                  }
                                  placeholder="Tự gợi ý"
                                  className="w-24 px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold text-xs bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Size
                                </label>
                                <input
                                  type="text"
                                  list="catalog-size-suggestions"
                                  value={newVarDraft.size}
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        size: e.target.value.toUpperCase(),
                                      },
                                    }))
                                  }
                                  placeholder="VD: 40, L, XL..."
                                  className="w-24 px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold text-xs uppercase bg-white"
                                />
                              </div>
                              {canSeeCost && (
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                    Giá vốn riêng (tuỳ chọn)
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newVarDraft.costPrice > 0 ? formatNumberDots(newVarDraft.costPrice) : ""}
                                    onChange={(e) =>
                                      setNewVariantDrafts((prev) => ({
                                        ...prev,
                                        [p._id]: {
                                          ...newVarDraft,
                                          costPrice: parseNumberDots(e.target.value),
                                        },
                                      }))
                                    }
                                    placeholder="= giá vốn"
                                    className="w-28 px-2.5 py-1.5 rounded border border-slate-300 font-mono text-right text-xs bg-white"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Giá niêm yết riêng (tuỳ chọn)
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={
                                    newVarDraft.sellingPrice > 0 ? formatNumberDots(newVarDraft.sellingPrice) : ""
                                  }
                                  onChange={(e) =>
                                    setNewVariantDrafts((prev) => ({
                                      ...prev,
                                      [p._id]: {
                                        ...newVarDraft,
                                        sellingPrice: parseNumberDots(e.target.value),
                                      },
                                    }))
                                  }
                                  placeholder="= giá niêm yết"
                                  className="w-28 px-2.5 py-1.5 rounded border border-slate-300 font-mono text-right text-xs bg-white"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={addingVariantProdId === p._id}
                                onClick={() => handleAddVariant(p)}
                                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {addingVariantProdId === p._id
                                  ? "Đang thêm..."
                                  : "+ Thêm biến thể (Màu/Size)"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="catalog-color-suggestions">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="catalog-size-suggestions">
        {COMMON_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <ProductCodeCreatorModal
        open={showCodeCreator || Boolean(editingProductModal)}
        onClose={() => {
          setShowCodeCreator(false);
          setEditingProductModal(null);
        }}
        categories={categories}
        defaultCategoryId={filterCategoryId || undefined}
        editingProduct={editingProductModal}
        canSeeCost={canSeeCost}
        onDone={handleCodeCreatorDone}
        colorSuggestions={COMMON_COLORS}
        sizeSuggestions={COMMON_SIZES}
      />

      <BarcodeLabelModal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        items={labelItems}
        title="In Tem Nhãn Mã Vạch (Danh mục Sản phẩm)"
      />
    </div>
  );
}

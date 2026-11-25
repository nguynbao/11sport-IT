
import { apiRequest,getStoredUser } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { filterAndRankBySearch,useDebounce } from "@/shared/lib/search";
import { Brand,Category,Product,ProductVariant } from "@/shared/types";
import { BarcodeLabelItem } from "@/shared/ui/BarcodeLabelModal";
import {
resolveVariantColorHexes
} from "@/shared/ui/ColorSwatchPicker";
import { ProductCodeCreatorResult } from "@/shared/ui/ProductCodeCreatorModal";
import { resolveVariantCode,variantEffectiveSellingPrice } from "@/shared/utils/productCode";
import { useCallback,useEffect,useMemo,useState } from "react";
import { addProductVariantsApi,fetchBrandsApi } from "../api";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export const COMMON_COLORS = [
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

export const COMMON_SIZES = [
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

export type StockStatusFilter = "ALL" | "IN_STOCK" | "ZERO_STOCK" | "NEW_SCHEME";

export function useProductCatalog() {
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
        apiRequest<Product[]>(API_ENDPOINTS.PRODUCTS.BASE),
        apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE),
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
      await apiRequest(API_ENDPOINTS.PRODUCTS.byId(p._id), {
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
      await apiRequest(API_ENDPOINTS.PRODUCTS.byId(prod._id), {
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
      await apiRequest(API_ENDPOINTS.PRODUCTS.byId(prod._id), { method: "DELETE" });
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


  return {
    canSeeCost,
    products,
    categories,
    brands,
    loading,
    filterCategoryId,
    setFilterCategoryId,
    filterBrandId,
    setFilterBrandId,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    showCodeCreator,
    setShowCodeCreator,
    editingProductModal,
    setEditingProductModal,
    labelItems,
    showLabelModal,
    setShowLabelModal,
    statusMsg,
    setStatusMsg,
    expandedProdId,
    setExpandedProdId,
    editingBase,
    setEditingBase,
    savingProdId,
    newVariantDrafts,
    setNewVariantDrafts,
    addingVariantProdId,
    categoryMap,
    brandMap,
    visibleProducts,
    handleCodeCreatorDone,
    handleSaveBaseProduct,
    handleSaveVariantPrice,
    handleAddVariant,
    handleDeleteProduct,
    handleOpenPrintLabel,
  };
}

export type ProductCatalogViewModel = ReturnType<typeof useProductCatalog>;

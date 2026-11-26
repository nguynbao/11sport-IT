import { addProductVariantsApi,fetchBrandsApi,previewProductCodeApi } from "@/shared/api/catalogLookup";
import { apiRequest } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Brand,Category,PreviewCodeResult,Product } from "@/shared/types";
import { useEffect,useMemo,useRef,useState } from "react";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export interface CreatorVariantDraft {
  variantKey?: string;
  color: string;
  colorCode: string;
  size: string;
  sellingPrice: number;
  costPrice: number;
  stockFloor1?: number;
  stockFloor2?: number;
  stock?: number;
}

export interface ProductCodeCreatorResult {
  product: Product;
  /** Biến thể vừa tạo/thêm/sửa (để caller thêm dòng vào phiếu nhập hoặc làm mới danh sách) */
  variants: { color: string; size: string; variantCode?: string; sellingPrice?: number; costPrice?: number }[];
  mode: "CREATED" | "VARIANTS_ADDED" | "UPDATED";
}

export interface ProductCodeCreatorProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  defaultCategoryId?: string;
  /** Nếu truyền sản phẩm vào => chuyển sang chế độ Sửa Sản phẩm & Biến thể */
  editingProduct?: Product | null;
  /** Ẩn giá vốn (role SALES) */
  canSeeCost: boolean;
  /** Cho phép đặt giá bán (role có quyền sửa giá bán) */
  canSetSellingPrice?: boolean;
  onDone: (result: ProductCodeCreatorResult) => void;
  colorSuggestions?: string[];
  sizeSuggestions?: string[];
}

export const EMPTY_VARIANT: CreatorVariantDraft = {
  color: "",
  colorCode: "",
  size: "",
  sellingPrice: 0,
  costPrice: 0,
  stockFloor1: 0,
  stockFloor2: 0,
  stock: 0,
};

export const toCode = (v: string, max: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

export function useProductCodeCreator({
  open,
  onClose,
  categories,
  defaultCategoryId,
  editingProduct = null,
  canSeeCost,
  canSetSellingPrice = true,
  onDone,
  colorSuggestions = [],
  sizeSuggestions = [],
}: ProductCodeCreatorProps) {
  const isEditing = Boolean(editingProduct);
  const activeCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.status === "ACTIVE" ||
          (editingProduct &&
            c._id ===
              (typeof editingProduct.categoryId === "object"
                ? editingProduct.categoryId?._id
                : String(editingProduct.categoryId || "")))
      ),
    [categories, editingProduct]
  );

  const [categoryId, setCategoryId] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Đôi");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [note, setNote] = useState("");
  const [variants, setVariants] = useState<CreatorVariantDraft[]>([{ ...EMPTY_VARIANT }]);
  const [preview, setPreview] = useState<PreviewCodeResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{ _id: string; code: string; name?: string } | null>(null);
  const previewSeq = useRef(0);

  // Nạp dữ liệu khi mở modal (chế độ Tạo mới hoặc Sửa sản phẩm)
  useEffect(() => {
    if (!open) return;
    if (editingProduct) {
      const catId =
        typeof editingProduct.categoryId === "object"
          ? editingProduct.categoryId?._id || ""
          : String(editingProduct.categoryId || "");
      setCategoryId(catId || defaultCategoryId || activeCategories[0]?._id || "");
      setBrandId(editingProduct.brandId ? String(editingProduct.brandId) : "");
      const rawBrandName = String(editingProduct.brandName || editingProduct.brand || "").trim();
      let defaultVerName = String(editingProduct.versionName || "").trim();
      if (!defaultVerName && editingProduct.name) {
        const rawName = String(editingProduct.name).trim();
        if (rawBrandName && rawName.toLowerCase().startsWith(rawBrandName.toLowerCase())) {
          defaultVerName = rawName.slice(rawBrandName.length).trim();
        }
        if (!defaultVerName) defaultVerName = rawName;
      }
      setVersionName(defaultVerName);
      setVersionCode(editingProduct.versionCode || "");
      setName(editingProduct.name || "");
      setUnit(editingProduct.unit || "Cái");
      setSellingPrice(Number(editingProduct.sellingPrice || 0));
      setCostPrice(Number(editingProduct.costPrice || 0));
      setNote(editingProduct.note || "");
      const existingVars = Array.isArray(editingProduct.variants)
        ? editingProduct.variants.filter((v) => v.color || v.size)
        : [];
      if (existingVars.length > 0) {
        setVariants(
          existingVars.map((v) => ({
            variantKey: v.variantKey,
            color: v.color || "",
            colorCode: v.colorCode || "",
            size: v.size || "",
            sellingPrice: Number(v.sellingPrice || 0),
            costPrice: Number(v.costPrice || 0),
            stockFloor1: Number(v.stockFloor1 || 0),
            stockFloor2: Number(v.stockFloor2 || 0),
            stock: Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0))),
          }))
        );
      } else {
        setVariants([{ ...EMPTY_VARIANT }]);
      }
      setError("");
      setDuplicate(null);
    } else {
      setCategoryId((prev) => prev || defaultCategoryId || activeCategories[0]?._id || "");
      setNote("");
    }
  }, [open, editingProduct, defaultCategoryId, activeCategories]);

  // Brand thuộc Category đã chọn (+ NN hệ thống)
  useEffect(() => {
    if (!open || !categoryId) {
      setBrands([]);
      return;
    }
    let cancelled = false;
    setBrandsLoading(true);
    fetchBrandsApi({ categoryId, status: "ACTIVE" })
      .then((list) => {
        if (cancelled) return;
        setBrands(list);
        setBrandId((prev) => {
          if (prev && list.some((b) => b._id === prev)) return prev;
          if (editingProduct) {
            const norm = (t?: string) =>
              String(t || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            const targetBrand = norm(editingProduct.brandName || editingProduct.brand);
            if (targetBrand) {
              const matched = list.find(
                (b) =>
                  norm(b.name) === targetBrand ||
                  norm(b.code) === targetBrand ||
                  (b.aliases || []).some((a) => norm(a) === targetBrand)
              );
              if (matched) return matched._id;
            }
            const nn = list.find((b) => b.isSystem || b.code === "NN");
            if (nn) return nn._id;
          }
          return "";
        });
      })
      .catch((err) => !cancelled && setError(describeApiError(err, "Không tải được thương hiệu.")))
      .finally(() => !cancelled && setBrandsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, categoryId, editingProduct]);

  const namedVariants = variants.filter((v) => v.color.trim() || v.size.trim());
  const previewKey = JSON.stringify({
    categoryId,
    brandId,
    versionName: versionName.trim(),
    versionCode,
    variants: namedVariants.map((v) => [v.color.trim(), v.colorCode, v.size.trim()]),
  });
  const debouncedKey = useDebounce(previewKey);

  useEffect(() => {
    if (!open) return;
    const k = JSON.parse(debouncedKey) as {
      categoryId: string;
      brandId: string;
      versionName: string;
      versionCode: string;
      variants: [string, string, string][];
    };
    if (!k.categoryId || !k.brandId || !k.versionName) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    previewProductCodeApi({
      categoryId: k.categoryId,
      brandId: k.brandId,
      versionName: k.versionName,
      ...(k.versionCode ? { versionCode: k.versionCode } : {}),
      variants: k.variants.map(([color, colorCode, size]) => ({
        color,
        ...(colorCode ? { colorCode } : {}),
        size,
      })),
    })
      .then((res) => {
        if (seq !== previewSeq.current) return;
        setPreview(res);
        setPreviewError("");
      })
      .catch((err) => {
        if (seq !== previewSeq.current) return;
        setPreview(null);
        setPreviewError(describeApiError(err, "Không xem trước được mã."));
      })
      .finally(() => seq === previewSeq.current && setPreviewLoading(false));
  }, [debouncedKey, open]);

  const selectedBrand = brands.find((b) => b._id === brandId);

  const reset = () => {
    setBrandId("");
    setVersionName("");
    setVersionCode("");
    setName("");
    setSellingPrice(0);
    setCostPrice(0);
    setNote("");
    setVariants([{ ...EMPTY_VARIANT }]);
    setPreview(null);
    setPreviewError("");
    setError("");
    setDuplicate(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const updateVariant = (idx: number, patch: Partial<CreatorVariantDraft>) =>
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const validate = (): string => {
    if (!categoryId) return "Chọn danh mục.";
    if (!brandId) return "Chọn thương hiệu.";
    if (!versionName.trim()) return "Nhập tên Version (tên mẫu).";
    if (versionCode && !/^[A-Z0-9]{1,6}$/.test(versionCode)) return "Version code gồm 1–6 ký tự A-Z, 0-9.";
    for (const v of namedVariants) {
      if (!v.color.trim()) return "Mỗi biến thể cần có Màu.";
      if (v.colorCode && !/^[A-Z0-9]{2,3}$/.test(v.colorCode)) return `Mã màu "${v.colorCode}" phải gồm 2–3 ký tự.`;
    }
    const keys = new Set<string>();
    for (const v of namedVariants) {
      const k = `${v.color.trim().toLowerCase()}|${v.size.trim().toUpperCase()}`;
      if (keys.has(k)) return `Biến thể ${v.color} / ${v.size || "—"} bị trùng.`;
      keys.add(k);
    }
    return "";
  };

  const variantPayload = () =>
    namedVariants.map((v) => ({
      ...(v.variantKey ? { variantKey: v.variantKey } : {}),
      color: v.color.trim(),
      ...(v.colorCode ? { colorCode: v.colorCode } : {}),
      size: v.size.trim().toUpperCase(),
      ...(canSetSellingPrice && v.sellingPrice > 0 ? { sellingPrice: v.sellingPrice } : {}),
      ...(canSeeCost && v.costPrice > 0 ? { costPrice: v.costPrice } : {}),
      ...(isEditing
        ? {
            stockFloor1: Number(v.stockFloor1 || 0),
            stockFloor2: Number(v.stockFloor2 || 0),
            stock: Number(v.stock ?? (Number(v.stockFloor1 || 0) + Number(v.stockFloor2 || 0))),
            sellingPrice: Math.max(0, Number(v.sellingPrice || 0)),
            ...(canSeeCost ? { costPrice: Math.max(0, Number(v.costPrice || 0)) } : {}),
          }
        : {}),
    }));

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setSubmitting(true);
    try {
      if (isEditing && editingProduct) {
        const res = await apiRequest<Product>(API_ENDPOINTS.PRODUCTS.byId(editingProduct._id), {
          method: "PATCH",
          body: JSON.stringify({
            allowRecode: true,
            allowDirectStock: true,
            categoryId,
            brandId,
            versionName: versionName.trim(),
            ...(versionCode ? { versionCode } : {}),
            name:
              name.trim() ||
              `${selectedBrand && !selectedBrand.isSystem ? selectedBrand.name + " " : ""}${versionName.trim()}`.trim(),
            unit: unit.trim() || "Cái",
            note: note.trim(),
            ...(canSetSellingPrice ? { sellingPrice: Math.max(0, sellingPrice) } : {}),
            ...(canSeeCost ? { costPrice: Math.max(0, costPrice) } : {}),
            variants: variantPayload(),
          }),
        });
        onDone({ product: res.data, variants: variantPayload(), mode: "UPDATED" });
        reset();
        onClose();
        return;
      }

      const res = await apiRequest<Product>(API_ENDPOINTS.PRODUCTS.BASE, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          brandId,
          versionName: versionName.trim(),
          ...(versionCode ? { versionCode } : {}),
          ...(name.trim() ? { name: name.trim() } : {}),
          unit: unit.trim() || "Cái",
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(canSetSellingPrice ? { sellingPrice: Math.max(0, sellingPrice) } : {}),
          ...(canSeeCost ? { costPrice: Math.max(0, costPrice) } : {}),
          quantity: 0,
          variants: variantPayload(),
        }),
      });
      onDone({ product: res.data, variants: variantPayload(), mode: "CREATED" });
      reset();
      onClose();
    } catch (err: any) {
      if (err?.code === "PRODUCT_DUPLICATE") {
        const f = err?.fields || {};
        setDuplicate({
          _id: String(f.existingProductId || preview?.duplicate?._id || ""),
          code: String(f.existingProductCode || preview?.duplicate?.code || ""),
          name: preview?.duplicate?.name,
        });
      }
      setError(describeApiError(err, isEditing ? "Không cập nhật được sản phẩm." : "Không tạo được sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVariantsToExisting = async (productId: string) => {
    if (submitting || !productId) return;
    setError("");
    const payload = variantPayload();
    if (payload.length === 0) {
      setError("Nhập ít nhất 1 biến thể (Màu/Size) để thêm vào sản phẩm đã có.");
      return;
    }
    setSubmitting(true);
    try {
      const product = await addProductVariantsApi(productId, payload);
      onDone({ product, variants: payload, mode: "VARIANTS_ADDED" });
      reset();
      onClose();
    } catch (err: any) {
      setError(describeApiError(err, "Không thêm được biến thể."));
    } finally {
      setSubmitting(false);
    }
  };

  // early null return handled in ProductCodeCreatorModal

  const rawDup =
    duplicate ||
    (preview?.duplicate
      ? { _id: preview.duplicate._id, code: preview.duplicate.code, name: preview.duplicate.name }
      : null);
  const dup =
    rawDup && editingProduct && String(rawDup._id) === String(editingProduct._id) ? null : rawDup;
  const conflicts = (preview?.conflicts || []).filter(
    (c) => !editingProduct || c.productCode !== editingProduct.code
  );
  const previewVariantFor = (v: CreatorVariantDraft) =>
    (preview?.variants || []).find(
      (pv) =>
        pv.color.trim().toLowerCase() === v.color.trim().toLowerCase() &&
        String(pv.size || "").trim().toUpperCase() === v.size.trim().toUpperCase()
    );


  return {
    editingProduct,
    canSeeCost,
    canSetSellingPrice,
    colorSuggestions,
    sizeSuggestions,
    isEditing,
    activeCategories,
    categoryId,
    setCategoryId,
    brands,
    brandsLoading,
    brandId,
    setBrandId,
    versionName,
    setVersionName,
    versionCode,
    setVersionCode,
    name,
    setName,
    unit,
    setUnit,
    sellingPrice,
    setSellingPrice,
    costPrice,
    setCostPrice,
    note,
    setNote,
    variants,
    setVariants,
    preview,
    previewLoading,
    previewError,
    submitting,
    error,
    setDuplicate,
    selectedBrand,
    handleClose,
    updateVariant,
    handleSubmit,
    handleAddVariantsToExisting,
    dup,
    conflicts,
    previewVariantFor,
  };
}

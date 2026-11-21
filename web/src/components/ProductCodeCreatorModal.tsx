"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brand,
  Category,
  PreviewCodeResult,
  Product,
  addProductVariantsApi,
  apiRequest,
  describeApiError,
  fetchBrandsApi,
  formatNumberDots,
  parseNumberDots,
  previewProductCodeApi,
  useDebounce,
} from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

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

interface Props {
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

const EMPTY_VARIANT: CreatorVariantDraft = {
  color: "",
  colorCode: "",
  size: "",
  sellingPrice: 0,
  costPrice: 0,
  stockFloor1: 0,
  stockFloor2: 0,
  stock: 0,
};

const toCode = (v: string, max: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

/**
 * v5.0 — Tạo hoặc Sửa sản phẩm theo quy chuẩn mã CATE + BRAND + VERSION + MÀU + SIZE.
 * Chọn Category → Brand (chỉ brand thuộc Category) → Version → biến thể (Màu/mã màu/Size/giá riêng).
 * Mã gốc & mã con được SERVER xem trước (POST /products/preview-code) và sinh khi lưu.
 */
export default function ProductCodeCreatorModal({
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
}: Props) {
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
  const debouncedKey = useDebounce(previewKey, 400);

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
        const res = await apiRequest<Product>(`/products/${editingProduct._id}`, {
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

      const res = await apiRequest<Product>("/products", {
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

  if (!open) return null;

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

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 flex items-start justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pcc-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="pcc-title" className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="w-5 h-5 text-blue-600" />
                <span>
                  Sửa Sản phẩm &amp; Biến thể:{" "}
                  <span className="font-mono text-blue-700">{editingProduct?.code}</span> —{" "}
                  {editingProduct?.name}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span>Tạo sản phẩm chuẩn mã (Cate + Brand + Version + Màu + Size)</span>
              </>
            )}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="pcc-cat" className="block font-bold uppercase text-slate-600 mb-1">
                1. Danh mục *
              </label>
              <select
                id="pcc-cat"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setDuplicate(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
              >
                <option value="">-- Chọn danh mục --</option>
                {activeCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.skuCode ? `[${c.skuCode}] ` : `[${c.code.charAt(0)}] `}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pcc-brand" className="block font-bold uppercase text-slate-600 mb-1">
                2. Thương hiệu * {brandsLoading && <Loader2 className="w-3 h-3 inline animate-spin" />}
              </label>
              <select
                id="pcc-brand"
                value={brandId}
                disabled={!categoryId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setDuplicate(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold disabled:bg-slate-100"
              >
                <option value="">-- Chọn thương hiệu --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
              {categoryId && !brandsLoading && brands.length <= 1 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Chưa có thương hiệu cho danh mục này — thêm ở “Danh mục &amp; Thương hiệu”.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="pcc-vname" className="block font-bold uppercase text-slate-600 mb-1">
                3. Version (tên mẫu) *
              </label>
              <input
                id="pcc-vname"
                type="text"
                value={versionName}
                onChange={(e) => {
                  setVersionName(e.target.value);
                  setDuplicate(null);
                }}
                placeholder="VD: Solution Speed FF4"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="pcc-vcode" className="block font-bold uppercase text-slate-600 mb-1">
                Version code (≤ 6)
              </label>
              <input
                id="pcc-vcode"
                type="text"
                value={versionCode}
                maxLength={6}
                onChange={(e) => {
                  setVersionCode(toCode(e.target.value, 6));
                  setDuplicate(null);
                }}
                placeholder={
                  preview?.suggestedVersionCode ? `Gợi ý: ${preview.suggestedVersionCode}` : "Tự gợi ý"
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
              {preview?.suggestedVersionCode && !versionCode && (
                <button
                  type="button"
                  onClick={() => setVersionCode(preview.suggestedVersionCode)}
                  className="mt-1 text-[11px] text-blue-700 font-bold hover:underline cursor-pointer"
                >
                  Dùng gợi ý {preview.suggestedVersionCode}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="pcc-name" className="block font-bold uppercase text-slate-600 mb-1">
                Tên hiển thị sản phẩm
              </label>
              <input
                id="pcc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  selectedBrand && versionName
                    ? `${selectedBrand.isSystem ? "" : selectedBrand.name + " "}${versionName}`
                    : "Mặc định: Thương hiệu + Version"
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="pcc-unit" className="block font-bold uppercase text-slate-600 mb-1">
                ĐVT
              </label>
              <input
                id="pcc-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {canSetSellingPrice && (
                <div>
                  <label htmlFor="pcc-sell" className="block font-bold uppercase text-slate-600 mb-1">
                    Giá niêm yết
                  </label>
                  <input
                    id="pcc-sell"
                    type="text"
                    inputMode="numeric"
                    value={sellingPrice ? formatNumberDots(sellingPrice) : ""}
                    onChange={(e) => setSellingPrice(parseNumberDots(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 text-right font-bold"
                  />
                </div>
              )}
              {canSeeCost && (
                <div>
                  <label htmlFor="pcc-cost" className="block font-bold uppercase text-slate-600 mb-1">
                    Giá vốn
                  </label>
                  <input
                    id="pcc-cost"
                    type="text"
                    inputMode="numeric"
                    value={costPrice ? formatNumberDots(costPrice) : ""}
                    onChange={(e) => setCostPrice(parseNumberDots(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 text-right font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="pcc-note" className="block font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Ghi chú sản phẩm (tuỳ chọn)
            </label>
            <input
              id="pcc-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Form ôm chân nên tư vấn tăng 0.5 size, hàng bảo hành 6 tháng, chất liệu lưới thoáng khí..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold uppercase text-slate-700">
                4. Biến thể (Màu + Size) — giá riêng tuỳ chọn, trống = dùng giá mặc định
              </h3>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      ...EMPTY_VARIANT,
                      color: prev[prev.length - 1]?.color || "",
                      colorCode: prev[prev.length - 1]?.colorCode || "",
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm biến thể
              </button>
            </div>
            <datalist id="pcc-colors">
              {colorSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="pcc-sizes">
              {sizeSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-2 text-left">Màu *</th>
                    <th className="py-2 px-2 text-left">Mã màu (2–3)</th>
                    <th className="py-2 px-2 text-left">Size</th>
                    {canSetSellingPrice && <th className="py-2 px-2 text-right">Giá niêm yết riêng</th>}
                    {canSeeCost && <th className="py-2 px-2 text-right">Giá vốn riêng</th>}
                    {isEditing && <th className="py-2 px-2 text-center">Tồn hiện tại</th>}
                    <th className="py-2 px-2 text-left">Mã con (server)</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {variants.map((v, idx) => {
                    const pv = previewVariantFor(v);
                    const vStock = Number(v.stock ?? 0);
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Màu biến thể ${idx + 1}`}
                            list="pcc-colors"
                            value={v.color}
                            onChange={(e) => updateVariant(idx, { color: e.target.value })}
                            placeholder="VD: Đỏ"
                            className="w-32 px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Mã màu biến thể ${idx + 1}`}
                            value={v.colorCode}
                            maxLength={3}
                            onChange={(e) => updateVariant(idx, { colorCode: toCode(e.target.value, 3) })}
                            placeholder={pv?.colorCode ? pv.colorCode : "Tự gợi ý"}
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-mono font-bold"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            aria-label={`Size biến thể ${idx + 1}`}
                            list="pcc-sizes"
                            value={v.size}
                            onChange={(e) => updateVariant(idx, { size: e.target.value.toUpperCase() })}
                            placeholder="VD: 40"
                            className="w-20 px-2 py-1.5 rounded border border-slate-300 font-bold"
                          />
                        </td>
                        {canSetSellingPrice && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá niêm yết biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.sellingPrice ? formatNumberDots(v.sellingPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { sellingPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={sellingPrice ? formatNumberDots(sellingPrice) : "= giá niêm yết"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {canSeeCost && (
                          <td className="py-1.5 px-2 text-right">
                            <input
                              aria-label={`Giá vốn biến thể ${idx + 1}`}
                              inputMode="numeric"
                              value={v.costPrice ? formatNumberDots(v.costPrice) : ""}
                              onChange={(e) =>
                                updateVariant(idx, { costPrice: parseNumberDots(e.target.value) })
                              }
                              placeholder={costPrice ? formatNumberDots(costPrice) : "= giá vốn"}
                              className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right"
                            />
                          </td>
                        )}
                        {isEditing && (
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-600">
                            {vStock}
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-mono font-extrabold text-indigo-700">
                          {pv?.variantCode || <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            aria-label={`Xoá biến thể ${idx + 1}`}
                            disabled={isEditing && vStock > 0}
                            title={
                              isEditing && vStock > 0
                                ? `Biến thể đang có tồn (${vStock}) — không thể xoá`
                                : "Xoá dòng biến thể này"
                            }
                            onClick={() =>
                              setVariants((prev) =>
                                prev.length <= 1 ? [{ ...EMPTY_VARIANT }] : prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Xem trước mã do server sinh */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2" aria-live="polite">
            <div className="flex items-center gap-2 font-bold text-slate-700 uppercase">
              Mã gốc chuẩn mới (server xem trước) {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            {preview ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.categoryCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.brandCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.versionCode}
                  </span>
                  =
                  <span className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-extrabold">
                    {preview.code}
                  </span>
                </div>
                {isEditing && editingProduct && preview.code !== editingProduct.code && (
                  <p className="text-[11px] text-blue-700 font-semibold">
                    ℹ️ Mã gốc sẽ đổi từ <strong className="font-mono">{editingProduct.code}</strong> sang{" "}
                    <strong className="font-mono">{preview.code}</strong> (mã cũ được tự động lưu vào{" "}
                    <code className="font-mono">legacyCode</code> để vẫn quét được tem cũ).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">
                {previewError || "Chọn Danh mục, Thương hiệu và nhập Version để xem mã."}
              </p>
            )}
            {preview && previewError === "" && conflicts.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  Mã trùng với sản phẩm khác (R10) — hãy sửa Version code hoặc mã màu:
                  <ul className="list-disc ml-4 font-mono">
                    {conflicts.map((c, i) => (
                      <li key={i}>
                        {c.code} ↔ SP {c.productCode}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {dup && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold flex flex-wrap items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Đã có sản phẩm cùng Danh mục + Thương hiệu + Version:{" "}
                  <span className="font-mono">{dup.code}</span>
                  {dup.name ? ` — ${dup.name}` : ""}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    disabled={submitting || !dup._id}
                    onClick={() => handleAddVariantsToExisting(dup._id)}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center gap-1 cursor-pointer"
                  >
                    <CopyPlus className="w-3.5 h-3.5" /> Thêm biến thể vào sản phẩm này
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-bold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || Boolean(dup) || conflicts.length > 0}
            className={`px-5 py-2 rounded-lg disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
              isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              <Save className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isEditing ? "Lưu cập nhật Sản phẩm" : "Tạo sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}

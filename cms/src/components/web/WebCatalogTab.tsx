"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatVND } from "@/lib/api";
import {
  extractWebImageUrl,
  resolveWebMediaUrl,
  slugifyVietnamese,
  uploadWebImageFile,
  WebBrandItem,
  WebCategoryItem,
  WebProductItem,
} from "@/lib/webApi";
import {
  ImageUploadField,
  MultiImageUploadField,
  SeoCharacterBar,
  TabEmptyState,
  TabFeedbackBanner,
  TabLoadingState,
} from "./WebShared";
import { Eye, EyeOff, Loader2, Pencil, Search, Star, UploadCloud, X } from "lucide-react";

type SubMode = "PRODUCTS" | "CATEGORIES" | "BRANDS";

function VariantImageCard({
  item,
  onChange,
}: {
  item: { variantKey?: string; color: string; size?: string; imageUrl: string };
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadWebImageFile(file);
      if (url) onChange(url);
    } catch (err: any) {
      alert("Tải ảnh thất bại: " + (err?.message || "Lỗi"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isCloudinary = Boolean(
    item.imageUrl && (item.imageUrl.includes("res.cloudinary.com") || item.imageUrl.includes("cloudinary"))
  );
  const displayUrl = item.imageUrl ? resolveWebMediaUrl(item.imageUrl) : "";

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={`${item.color} ${item.size || ""}`.trim()}
              className="w-full h-full object-contain p-0.5"
            />
            {isCloudinary && (
              <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-[7px] font-bold text-white text-center leading-tight">
                CDN
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-400 font-bold text-center leading-tight">Chưa có ảnh</span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-slate-800 truncate">{item.color || "Màu mặc định"}</div>
        <div className="text-[11px] font-medium text-emerald-700 truncate">
          {item.size ? `Phiên bản: ${item.size}` : "Tiêu chuẩn"}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 hover:text-teal-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="Tải ảnh biến thể lên Cloudinary"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5" />
          )}
          <span>{item.imageUrl ? "Đổi" : "Tải"}</span>
        </button>
        {item.imageUrl && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
            title="Gỡ ảnh này"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function WebCatalogTab() {
  const [mode, setMode] = useState<SubMode>("PRODUCTS");
  const [products, setProducts] = useState<WebProductItem[]>([]);
  const [categories, setCategories] = useState<WebCategoryItem[]>([]);
  const [brands, setBrands] = useState<WebBrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pubFilter, setPubFilter] = useState<"ALL" | "true" | "false">("ALL");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal Product
  const [editProd, setEditProd] = useState<WebProductItem | null>(null);
  const [pSlug, setPSlug] = useState("");
  const [pPublished, setPPublished] = useState(false);
  const [pFeatured, setPFeatured] = useState(false);
  const [pCompareAt, setPCompareAt] = useState(0);
  const [pImages, setPImages] = useState<string[]>([]);
  const [pVariants, setPVariants] = useState<{ variantKey: string; color: string; size: string; imageUrl: string }[]>([]);
  const [pShortDesc, setPShortDesc] = useState("");
  const [pDescHtml, setPDescHtml] = useState("");
  const [pSeoTitle, setPSeoTitle] = useState("");
  const [pSeoDesc, setPSeoDesc] = useState("");

  // Modal Category / Brand
  const [editTax, setEditTax] = useState<{
    kind: "CATEGORY" | "BRAND";
    item: WebCategoryItem | WebBrandItem;
  } | null>(null);
  const [tSlug, setTSlug] = useState("");
  const [tImg, setTImg] = useState("");
  const [tPublished, setTPublished] = useState(false);
  const [tSortOrder, setTSortOrder] = useState(0);
  const [tDescHtml, setTDescHtml] = useState("");
  const [tSeoTitle, setTSeoTitle] = useState("");
  const [tSeoDesc, setTSeoDesc] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "PRODUCTS") {
        const qs = new URLSearchParams();
        if (search.trim()) qs.set("q", search.trim());
        if (pubFilter !== "ALL") qs.set("isPublishedOnline", pubFilter);
        const q = qs.toString() ? `?${qs.toString()}` : "";
        const res = await apiRequest<WebProductItem[]>(`/cms/web/products${q}`);
        setProducts(Array.isArray(res.data) ? res.data : []);
      } else if (mode === "CATEGORIES") {
        const res = await apiRequest<WebCategoryItem[]>("/cms/web/categories");
        setCategories(Array.isArray(res.data) ? res.data : []);
      } else {
        const res = await apiRequest<WebBrandItem[]>("/cms/web/brands");
        setBrands(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e: any) {
      setError(e?.message || "Không tải được dữ liệu danh mục Web");
    } finally {
      setLoading(false);
    }
  }, [mode, search, pubFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEditProduct = (p: WebProductItem) => {
    setEditProd(p);
    setPSlug(p.slug || slugifyVietnamese(p.name));
    setPPublished(Boolean(p.isPublishedOnline));
    setPFeatured(Boolean(p.isFeatured));
    setPCompareAt(Number(p.compareAtPrice || 0));
    const rawImgs = (p.images || [])
      .map((img) => extractWebImageUrl(img))
      .filter(Boolean);
    setPImages(rawImgs);

    const vars = (p.variants || []).map((v) => ({
      variantKey: v.variantKey || `${v.color || ""}_${v.size || ""}`,
      color: v.color || "",
      size: v.size || "",
      imageUrl: v.imageUrl || "",
    }));
    setPVariants(vars);

    setPShortDesc(p.shortDescription || "");
    setPDescHtml(p.descriptionHtml || "");
    setPSeoTitle(p.seo?.title || "");
    setPSeoDesc(p.seo?.description || "");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProd) return;
    setSaving(true);
    setError("");
    try {
      let imgs = pImages
        .map((s) => s.trim())
        .filter(Boolean)
        .map((url, idx) => ({
          url,
          alt: editProd.name,
          isPrimary: idx === 0,
          sortOrder: idx,
        }));

      const variantImages = pVariants.map((v) => ({
        variantKey: v.variantKey,
        color: v.color,
        size: v.size,
        imageUrl: v.imageUrl,
      }));

      // Nếu ảnh sản phẩm chung chưa có, tự động lấy ảnh từ các biến thể làm gallery & ảnh đại diện
      if (imgs.length === 0) {
        imgs = Array.from(
          new Set(variantImages.map((v) => v.imageUrl).filter(Boolean))
        ).map((url, idx) => ({
          url,
          alt: editProd.name,
          isPrimary: idx === 0,
          sortOrder: idx,
        }));
      }

      await apiRequest(`/cms/web/products/${editProd._id}/web`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: pSlug,
          isPublishedOnline: pPublished,
          isFeatured: pFeatured,
          compareAtPrice: Number(pCompareAt || 0),
          images: imgs,
          variantImages,
          shortDescription: pShortDesc,
          descriptionHtml: pDescHtml,
          seo: {
            ...(editProd.seo || {}),
            title: pSeoTitle,
            description: pSeoDesc,
          },
        }),
      });
      setSuccess(`Đã cập nhật thông tin Web cho "${editProd.name}"`);
      setEditProd(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Cập nhật sản phẩm Web thất bại");
    } finally {
      setSaving(false);
    }
  };

  const toggleProductOnline = async (p: WebProductItem) => {
    setError("");
    try {
      await apiRequest(`/cms/web/products/${p._id}/web`, {
        method: "PATCH",
        body: JSON.stringify({ isPublishedOnline: !p.isPublishedOnline }),
      });
      setSuccess(`${!p.isPublishedOnline ? "Đã bật" : "Đã tắt"} bán Online: ${p.name}`);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Thao tác thất bại");
    }
  };

  const openEditTaxonomy = (kind: "CATEGORY" | "BRAND", item: WebCategoryItem | WebBrandItem) => {
    setEditTax({ kind, item });
    setTSlug(item.slug || slugifyVietnamese(item.name));
    setTImg(kind === "CATEGORY" ? (item as WebCategoryItem).imageUrl || "" : (item as WebBrandItem).logoUrl || "");
    setTPublished(Boolean(item.isPublishedOnline));
    setTSortOrder(Number(item.sortOrder || 0));
    setTDescHtml(item.descriptionHtml || "");
    setTSeoTitle(item.seo?.title || "");
    setTSeoDesc(item.seo?.description || "");
  };

  const handleSaveTaxonomy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTax) return;
    setSaving(true);
    setError("");
    try {
      const endpoint =
        editTax.kind === "CATEGORY"
          ? `/cms/web/categories/${editTax.item._id}`
          : `/cms/web/brands/${editTax.item._id}`;
      const body: Record<string, any> = {
        slug: tSlug,
        isPublishedOnline: tPublished,
        sortOrder: Number(tSortOrder || 0),
        descriptionHtml: tDescHtml,
        seo: {
          ...(editTax.item.seo || {}),
          title: tSeoTitle,
          description: tSeoDesc,
        },
      };
      if (editTax.kind === "CATEGORY") body.imageUrl = tImg;
      else body.logoUrl = tImg;

      await apiRequest(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      setSuccess(`Đã cập nhật thông tin Web cho "${editTax.item.name}"`);
      setEditTax(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
          {[
            { id: "PRODUCTS" as SubMode, label: "Sản phẩm Web" },
            { id: "CATEGORIES" as SubMode, label: "Danh mục Web" },
            { id: "BRANDS" as SubMode, label: "Thương hiệu Web" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                mode === t.id ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "PRODUCTS" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã SP, slug..."
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs w-56 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <select
              value={pubFilter}
              onChange={(e) => setPubFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="true">Đang bán Online</option>
              <option value="false">Đang ẩn trên Web</option>
            </select>
          </div>
        )}
      </div>

      <TabFeedbackBanner
        error={error}
        success={success}
        onClear={() => {
          setError("");
          setSuccess("");
        }}
      />

      {loading ? (
        <TabLoadingState />
      ) : mode === "PRODUCTS" ? (
        products.length === 0 ? (
          <TabEmptyState title="Không có sản phẩm phù hợp" />
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3">Slug Web</th>
                  <th className="p-3 text-right">Giá bán / Niêm yết</th>
                  <th className="p-3 text-right">Kho Tầng 1</th>
                  <th className="p-3 text-center">Hiển thị Web</th>
                  <th className="p-3 text-right">Sửa Web</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {p.images?.[0] ? (
                          <img
                            src={resolveWebMediaUrl(p.images[0])}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">{p.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{p.slug || "—"}</td>
                    <td className="p-3 text-right font-mono">
                      <div className="font-bold text-teal-700">{formatVND(p.sellingPrice)}</div>
                      {p.compareAtPrice ? (
                        <div className="text-[11px] line-through text-slate-400">
                          {formatVND(p.compareAtPrice)}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-700">
                      {p.stockFloor1 ?? 0}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleProductOnline(p)}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 ${
                          p.isPublishedOnline
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        {p.isPublishedOnline ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{p.isPublishedOnline ? "Đang hiện" : "Đang ẩn"}</span>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Cấu hình</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Tên</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Thứ tự</th>
                <th className="p-3">Hiển thị Web</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(mode === "CATEGORIES" ? categories : brands).map((item) => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{item.name}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-600">{item.slug || "—"}</td>
                  <td className="p-3 font-mono">{item.sortOrder ?? 0}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                        item.isPublishedOnline
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}
                    >
                      {item.isPublishedOnline ? "Đang hiện" : "Đang ẩn"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        openEditTaxonomy(mode === "CATEGORIES" ? "CATEGORY" : "BRAND", item)
                      }
                      className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sửa Web &amp; SEO</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cấu hình Sản phẩm Web */}
      {editProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">Thông tin Web: {editProd.name}</h4>
              <button type="button" onClick={() => setEditProd(null)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Slug URL *</label>
                  <input
                    type="text"
                    required
                    value={pSlug}
                    onChange={(e) => setPSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giá gạch ngang (VNĐ)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pCompareAt > 0 ? pCompareAt.toLocaleString("vi-VN") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setPCompareAt(raw ? Number(raw) : 0);
                      }}
                      placeholder="0"
                      className="w-full pl-3 pr-12 py-2 rounded-xl border border-slate-300 font-mono text-sm text-right"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      VND
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={pPublished}
                    onChange={(e) => setPPublished(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Hiển thị bán Online</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={pFeatured}
                    onChange={(e) => setPFeatured(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Sản phẩm nổi bật (Featured)</span>
                </label>
              </div>

              <MultiImageUploadField
                label="Ảnh sản phẩm"
                values={pImages}
                onChange={setPImages}
                maxImages={12}
                hint="Tải ảnh lên Cloudinary. Ảnh có huy hiệu 'Chính' là ảnh đại diện hiển thị ngoài trang chủ & danh mục."
              />

              {/* Ảnh biến thể (Màu sắc + Phiên bản cho /shop) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Ảnh biến thể theo Màu &amp; Phiên bản (cho /shop)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Mỗi màu sắc hoặc phiên bản (độ dày 14mm, 16mm...) có thể có ảnh riêng hiển thị tương ứng khi khách bấm chọn trên Website bán hàng.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {pVariants.length} biến thể
                  </span>
                </div>

                {pVariants.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Sản phẩm này chưa có biến thể nào.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {pVariants.map((v, idx) => (
                      <VariantImageCard
                        key={v.variantKey || idx}
                        item={v}
                        onChange={(url) => {
                          setPVariants((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, imageUrl: url } : item))
                          );
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={pShortDesc}
                  onChange={(e) => setPShortDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả chi tiết (HTML)</label>
                <textarea
                  rows={4}
                  value={pDescHtml}
                  onChange={(e) => setPDescHtml(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <SeoCharacterBar
                  label="SEO Title"
                  value={pSeoTitle}
                  min={50}
                  max={60}
                  onChange={setPSeoTitle}
                  placeholder="Tiêu đề chuẩn SEO 50-60 ký tự"
                />
                <SeoCharacterBar
                  label="Meta Description"
                  value={pSeoDesc}
                  min={150}
                  max={160}
                  multiline
                  onChange={setPSeoDesc}
                  placeholder="Mô tả chuẩn SEO 150-160 ký tự"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProd(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu thông tin Web"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Danh mục / Thương hiệu Web */}
      {editTax && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                Cấu hình Web: {editTax.item.name}
              </h4>
              <button type="button" onClick={() => setEditTax(null)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTaxonomy} className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Slug URL *</label>
                  <input
                    type="text"
                    required
                    value={tSlug}
                    onChange={(e) => setTSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Thứ tự</label>
                  <input
                    type="number"
                    value={tSortOrder}
                    onChange={(e) => setTSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={tPublished}
                  onChange={(e) => setTPublished(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Hiển thị trên Website</span>
              </label>

              <ImageUploadField
                label={editTax.kind === "CATEGORY" ? "Ảnh đại diện danh mục" : "Logo thương hiệu"}
                value={tImg}
                onChange={setTImg}
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả SEO (HTML)</label>
                <textarea
                  rows={3}
                  value={tDescHtml}
                  onChange={(e) => setTDescHtml(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <SeoCharacterBar label="SEO Title" value={tSeoTitle} min={50} max={60} onChange={setTSeoTitle} />
                <SeoCharacterBar
                  label="Meta Description"
                  value={tSeoDesc}
                  min={150}
                  max={160}
                  multiline
                  onChange={setTSeoDesc}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTax(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

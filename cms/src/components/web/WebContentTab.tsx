"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatDateTime } from "@/lib/api";
import {
  slugifyVietnamese,
  WebArticleCategoryItem,
  WebArticleItem,
  WebStaticPageItem,
} from "@/lib/webApi";
import {
  ImageUploadField,
  SeoCharacterBar,
  TabEmptyState,
  TabFeedbackBanner,
  TabLoadingState,
} from "./WebShared";
import { CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";

type ContentMode = "ARTICLES" | "CATEGORIES" | "PAGES";

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function WebContentTab() {
  const [mode, setMode] = useState<ContentMode>("ARTICLES");
  const [articles, setArticles] = useState<WebArticleItem[]>([]);
  const [categories, setCategories] = useState<WebArticleCategoryItem[]>([]);
  const [pages, setPages] = useState<WebStaticPageItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal Bài viết / Trang tĩnh
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<WebArticleItem | null>(null);
  const [editingPage, setEditingPage] = useState<WebStaticPageItem | null>(null);
  const [isPageMode, setIsPageMode] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PENDING_REVIEW" | "PUBLISHED">("DRAFT");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");

  // Modal Chuyên mục bài viết
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<WebArticleCategoryItem | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [artRes, catRes, pageRes] = await Promise.all([
        apiRequest<WebArticleItem[]>(
          `/cms/web/articles${statusFilter ? `?status=${statusFilter}` : ""}`
        ),
        apiRequest<WebArticleCategoryItem[]>("/cms/web/article-categories"),
        apiRequest<WebStaticPageItem[]>("/cms/web/pages"),
      ]);
      setArticles(Array.isArray(artRes.data) ? artRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setPages(Array.isArray(pageRes.data) ? pageRes.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được dữ liệu bài viết & trang tĩnh");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreateArticle = () => {
    setIsPageMode(false);
    setEditingArticle(null);
    setEditingPage(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContentHtml("");
    setThumbnailUrl("");
    setCategoryId(categories[0]?._id || "");
    setStatus("DRAFT");
    setSeoTitle("");
    setSeoDesc("");
    setShowArticleModal(true);
  };

  const openEditArticle = (a: WebArticleItem) => {
    setIsPageMode(false);
    setEditingArticle(a);
    setEditingPage(null);
    setTitle(a.title);
    setSlug(a.slug);
    setExcerpt(a.excerpt || "");
    setContentHtml(a.contentHtml || "");
    setThumbnailUrl(a.thumbnailUrl || "");
    setCategoryId(a.categoryId || "");
    setStatus(a.status);
    setSeoTitle(a.seo?.title || "");
    setSeoDesc(a.seo?.description || "");
    setShowArticleModal(true);
  };

  const openCreatePage = () => {
    setIsPageMode(true);
    setEditingArticle(null);
    setEditingPage(null);
    setTitle("");
    setSlug("");
    setContentHtml("");
    setStatus("DRAFT");
    setSeoTitle("");
    setSeoDesc("");
    setShowArticleModal(true);
  };

  const openEditPage = (p: WebStaticPageItem) => {
    setIsPageMode(true);
    setEditingArticle(null);
    setEditingPage(p);
    setTitle(p.title);
    setSlug(p.slug);
    setContentHtml(p.contentHtml || "");
    setStatus(p.status);
    setSeoTitle(p.seo?.title || "");
    setSeoDesc(p.seo?.description || "");
    setShowArticleModal(true);
  };

  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const seo = { title: seoTitle, description: seoDesc };
      if (isPageMode) {
        const payload = { title, slug, contentHtml, status, seo };
        if (editingPage) {
          await apiRequest(`/cms/web/pages/${editingPage._id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setSuccess(`Đã cập nhật trang tĩnh "${title}"`);
        } else {
          await apiRequest("/cms/web/pages", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setSuccess(`Đã tạo trang tĩnh "${title}"`);
        }
      } else {
        const payload = {
          title,
          slug,
          excerpt,
          contentHtml,
          thumbnailUrl,
          categoryId,
          status,
          seo,
        };
        if (editingArticle) {
          await apiRequest(`/cms/web/articles/${editingArticle._id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setSuccess(`Đã cập nhật bài viết "${title}"`);
        } else {
          await apiRequest("/cms/web/articles", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setSuccess(`Đã tạo bài viết "${title}"`);
        }
      }
      setShowArticleModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Lưu nội dung thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishArticle = async (id: string, name: string, isPage = false) => {
    setError("");
    try {
      await apiRequest(`/cms/web/${isPage ? "pages" : "articles"}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      setSuccess(`Đã duyệt & xuất bản "${name}"`);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Xuất bản thất bại");
    }
  };

  const handleDelete = async (path: string, name: string) => {
    if (!confirm(`Xóa "${name}"?`)) return;
    setError("");
    try {
      await apiRequest(path, { method: "DELETE" });
      setSuccess(`Đã xóa "${name}"`);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Xóa thất bại");
    }
  };

  const handleSubmitCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { name: catName, slug: catSlug, description: catDesc };
      if (editingCat) {
        await apiRequest(`/cms/web/article-categories/${editingCat._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật chuyên mục "${catName}"`);
      } else {
        await apiRequest("/cms/web/article-categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã thêm chuyên mục "${catName}"`);
      }
      setShowCatModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Lưu chuyên mục thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
          {[
            { id: "ARTICLES" as ContentMode, label: `Bài viết (${articles.length})` },
            { id: "CATEGORIES" as ContentMode, label: `Chuyên mục (${categories.length})` },
            { id: "PAGES" as ContentMode, label: `Trang tĩnh (${pages.length})` },
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

        <div className="flex flex-wrap items-center gap-2">
          {mode === "ARTICLES" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp (DRAFT)</option>
              <option value="PENDING_REVIEW">Chờ duyệt (PENDING_REVIEW)</option>
              <option value="PUBLISHED">Đã xuất bản (PUBLISHED)</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              if (mode === "ARTICLES") openCreateArticle();
              else if (mode === "PAGES") openCreatePage();
              else {
                setEditingCat(null);
                setCatName("");
                setCatSlug("");
                setCatDesc("");
                setShowCatModal(true);
              }
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>
              {mode === "ARTICLES"
                ? "Viết bài mới"
                : mode === "PAGES"
                  ? "Thêm trang tĩnh"
                  : "Thêm chuyên mục"}
            </span>
          </button>
        </div>
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
      ) : mode === "ARTICLES" ? (
        articles.length === 0 ? (
          <TabEmptyState title="Chưa có bài viết nào" />
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="p-3">Tiêu đề &amp; Slug</th>
                  <th className="p-3">Tác giả / Ngày</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articles.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{a.title}</div>
                      <div className="font-mono text-[11px] text-slate-500">/tin-tuc/{a.slug}</div>
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{a.authorName || "11 Sport"}</div>
                      <div className="text-[11px] text-slate-400">
                        {a.createdAt ? formatDateTime(a.createdAt) : "—"}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded border font-bold text-[11px] ${
                          STATUS_BADGE[a.status] || STATUS_BADGE.DRAFT
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {a.status !== "PUBLISHED" && (
                          <button
                            type="button"
                            onClick={() => handlePublishArticle(a._id, a.title, false)}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Duyệt &amp; Xuất bản</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditArticle(a)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(`/cms/web/articles/${a._id}`, a.title)}
                          className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : mode === "CATEGORIES" ? (
        categories.length === 0 ? (
          <TabEmptyState title="Chưa có chuyên mục bài viết nào" />
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="p-3">Tên chuyên mục</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3 font-mono text-slate-600">{c.slug}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(c);
                          setCatName(c.name);
                          setCatSlug(c.slug);
                          setCatDesc(c.description || "");
                          setShowCatModal(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 mr-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(`/cms/web/article-categories/${c._id}`, c.name)}
                        className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : pages.length === 0 ? (
        <TabEmptyState title="Chưa có trang tĩnh nào" desc="Tạo các trang Chính sách bảo hành, Đổi trả, Giới thiệu..." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Tiêu đề trang</th>
                <th className="p-3">Slug URL</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.title}</td>
                  <td className="p-3 font-mono text-slate-600">/{p.slug}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded border font-bold text-[11px] ${
                        STATUS_BADGE[p.status] || STATUS_BADGE.DRAFT
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {p.status !== "PUBLISHED" && (
                        <button
                          type="button"
                          onClick={() => handlePublishArticle(p._id, p.title, true)}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Xuất bản</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditPage(p)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(`/cms/web/pages/${p._id}`, p.title)}
                        className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Bài viết / Trang tĩnh */}
      {showArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {isPageMode
                  ? editingPage
                    ? "Sửa Trang tĩnh"
                    : "Tạo Trang tĩnh"
                  : editingArticle
                    ? "Sửa Bài viết"
                    : "Viết Bài mới"}
              </h4>
              <button
                type="button"
                onClick={() => setShowArticleModal(false)}
                className="p-1 rounded hover:bg-teal-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitContent} className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tiêu đề *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!editingArticle && !editingPage) setSlug(slugifyVietnamese(e.target.value));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Slug URL *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
              </div>

              {!isPageMode && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chuyên mục</label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      >
                        <option value="">-- Chọn chuyên mục --</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trạng thái</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      >
                        <option value="DRAFT">Nháp (DRAFT)</option>
                        <option value="PENDING_REVIEW">Chờ duyệt (PENDING_REVIEW)</option>
                        <option value="PUBLISHED">Xuất bản (PUBLISHED)</option>
                      </select>
                    </div>
                  </div>
                  <ImageUploadField label="Ảnh đại diện bài viết" value={thumbnailUrl} onChange={setThumbnailUrl} />
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tóm tắt</label>
                    <textarea
                      rows={2}
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </>
              )}

              {isPageMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="DRAFT">Nháp (DRAFT)</option>
                    <option value="PENDING_REVIEW">Chờ duyệt (PENDING_REVIEW)</option>
                    <option value="PUBLISHED">Xuất bản (PUBLISHED)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nội dung HTML</label>
                <textarea
                  rows={6}
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <SeoCharacterBar label="SEO Title" value={seoTitle} min={50} max={60} onChange={setSeoTitle} />
                <SeoCharacterBar
                  label="Meta Description"
                  value={seoDesc}
                  min={150}
                  max={160}
                  multiline
                  onChange={setSeoDesc}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArticleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu nội dung"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chuyên mục */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editingCat ? "Sửa Chuyên mục" : "Thêm Chuyên mục bài viết"}
              </h4>
              <button type="button" onClick={() => setShowCatModal(false)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCat} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên chuyên mục *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!editingCat) setCatSlug(slugifyVietnamese(e.target.value));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu chuyên mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

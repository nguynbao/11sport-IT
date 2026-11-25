"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { WebCategoryItem, WebHomeSectionItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";

const SECTION_TYPES = [
  { value: "HERO", label: "Banner chính đầu trang (Hero Slider)" },
  { value: "USP", label: "4 Cam kết dịch vụ (USP)" },
  { value: "FLASH_SALE", label: "Khối Flash Sale + Đếm ngược" },
  { value: "CATEGORY_GRID", label: "Khối Sản phẩm dạng Lưới (5 cột)" },
  { value: "CATEGORY_CAROUSEL", label: "Khối Sản phẩm dạng Trượt ngang (Carousel)" },
  { value: "CUSTOM_BANNER", label: "Banner quảng bá xen kẽ" },
  { value: "BRANDS", label: "Thương hiệu đối tác" },
  { value: "BLOG", label: "Tin tức & Kiến thức" },
];

export default function WebHomeSectionsTab({
  onRevalidate,
}: {
  onRevalidate: () => Promise<void>;
}) {
  const [sections, setSections] = useState<WebHomeSectionItem[]>([]);
  const [categories, setCategories] = useState<WebCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WebHomeSectionItem | null>(null);
  const [type, setType] = useState("CATEGORY_GRID");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [viewAllUrl, setViewAllUrl] = useState("");
  const [selectedCatSlug, setSelectedCatSlug] = useState("");
  const [limitCount, setLimitCount] = useState(10);
  const [isActive, setIsActive] = useState(true);

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [secRes, catRes] = await Promise.all([
        apiRequest<WebHomeSectionItem[]>("/cms/web/home-sections"),
        apiRequest<WebCategoryItem[]>("/cms/web/categories").catch(() => ({ data: [] as WebCategoryItem[] })),
      ]);
      setSections(Array.isArray(secRes.data) ? secRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách khối trang chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [picked] = next.splice(idx, 1);
    next.splice(target, 0, picked);
    setSections(next.map((s, i) => ({ ...s, sortOrder: i + 1 })));
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      return;
    }
    const next = [...sections];
    const [picked] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, picked);
    setSections(next.map((s, i) => ({ ...s, sortOrder: i + 1 })));
    setDragIdx(null);
  };

  const toggleActive = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s._id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleSaveOrderAndSync = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = sections.map((s, idx) => ({
        id: s._id,
        sortOrder: idx + 1,
        isActive: s.isActive,
      }));
      const res = await apiRequest<WebHomeSectionItem[]>("/cms/web/home-sections/reorder", {
        method: "PUT",
        body: JSON.stringify({ sections: payload }),
      });
      setSections(Array.isArray(res.data) ? res.data : sections);
      await onRevalidate();
      setSuccess("Đã lưu bố cục trang chủ & đồng bộ Website!");
    } catch (e: any) {
      setError(e?.message || "Lưu bố cục thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalError("");
    setType("CATEGORY_GRID");
    setTitle("");
    setSubtitle("");
    setViewAllUrl("");
    setSelectedCatSlug("");
    setLimitCount(10);
    setIsActive(true);
    setShowModal(true);
  };

  const openEdit = (sec: WebHomeSectionItem) => {
    setEditing(sec);
    setModalError("");
    setType(sec.type);
    setTitle(sec.title);
    setSubtitle(sec.subtitle || "");
    setViewAllUrl(sec.viewAllUrl || "");
    setSelectedCatSlug(String(sec.configJson?.categorySlug || ""));
    setLimitCount(Number(sec.configJson?.limit || 10));
    setIsActive(sec.isActive);
    setShowModal(true);
  };

  const isCategoryBlock = type === "CATEGORY_GRID" || type === "CATEGORY_CAROUSEL";

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    const prevConfig = editing?.configJson ? { ...editing.configJson } : {};
    const nextConfig: Record<string, unknown> = isCategoryBlock
      ? {
          ...prevConfig,
          categorySlug: selectedCatSlug,
          limit: Number(limitCount || 10),
        }
      : prevConfig;

    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/cms/web/home-sections/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            type,
            title,
            subtitle,
            viewAllUrl,
            configJson: nextConfig,
            isActive,
          }),
        });
        setSuccess(`Đã cập nhật khối "${title}"`);
      } else {
        await apiRequest("/cms/web/home-sections", {
          method: "POST",
          body: JSON.stringify({
            type,
            title,
            subtitle,
            viewAllUrl,
            configJson: nextConfig,
            isActive,
            sortOrder: sections.length + 1,
          }),
        });
        setSuccess(`Đã thêm khối "${title}"`);
      }
      setShowModal(false);
      await loadSections();
    } catch (err: any) {
      setModalError(err?.message || "Không thể lưu khối trang chủ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sec: WebHomeSectionItem) => {
    if (!confirm(`Xóa khối "${sec.title}" khỏi trang chủ?`)) return;
    setError("");
    try {
      await apiRequest(`/cms/web/home-sections/${sec._id}`, { method: "DELETE" });
      setSuccess(`Đã xóa khối "${sec.title}"`);
      await loadSections();
    } catch (e: any) {
      setError(e?.message || "Không thể xóa khối");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">
            Bố cục Trang chủ Website
          </h3>
          <p className="text-xs text-slate-500">
            Kéo thả hoặc bấm mũi tên để đổi thứ tự hiển thị, bật/tắt rồi bấm &quot;Lưu &amp; Đồng bộ&quot;.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khối</span>
          </button>
          <button
            type="button"
            onClick={handleSaveOrderAndSync}
            disabled={saving || sections.length === 0}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Lưu &amp; Đồng bộ</span>
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
      ) : sections.length === 0 ? (
        <TabEmptyState
          title="Chưa có khối trang chủ nào"
          desc="Bấm 'Thêm khối' để khởi tạo Banner, Flash Sale, Khối sản phẩm..."
        />
      ) : (
        <div className="space-y-2">
          {sections.map((sec, idx) => {
            const typeLabel = SECTION_TYPES.find((t) => t.value === sec.type)?.label || sec.type;
            return (
              <div
                key={sec._id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition ${
                  sec.isActive
                    ? "bg-white border-slate-200 hover:border-teal-300"
                    : "bg-slate-50 border-slate-200 opacity-65"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                  <span className="font-mono text-xs font-extrabold w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{sec.title}</div>
                    <div className="text-[11px] text-slate-500">{typeLabel}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleActive(sec._id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                      sec.isActive
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-100 border-slate-300 text-slate-600"
                    }`}
                  >
                    {sec.isActive ? "Đang bật" : "Đang ẩn"}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    title="Đưa lên"
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === sections.length - 1}
                    title="Đưa xuống"
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(sec)}
                    title="Chỉnh sửa khối"
                    className="p-2 rounded-xl border border-slate-200 text-teal-700 hover:bg-teal-50"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sec)}
                    title="Xóa khối"
                    className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editing ? `Sửa khối: ${editing.title}` : "Thêm khối trang chủ"}
              </h4>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitModal} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <TabFeedbackBanner error={modalError} onClear={() => setModalError("")} />
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kiểu hiển thị *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tiêu đề khối *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: VỢT PICKLEBALL"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả ngắn</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="VD: Tuyển chọn vợt Carbon T700 chính hãng"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              {isCategoryBlock && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chọn Danh mục</label>
                    <select
                      value={selectedCatSlug}
                      onChange={(e) => {
                        const slug = e.target.value;
                        setSelectedCatSlug(slug);
                        if (slug && !viewAllUrl) setViewAllUrl(`/danh-muc/${slug}`);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:border-teal-600 focus:outline-none"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories
                        .filter((c) => c.slug)
                        .map((c) => (
                          <option key={c._id} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số sản phẩm</label>
                    <select
                      value={limitCount}
                      onChange={(e) => setLimitCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:border-teal-600 focus:outline-none"
                    >
                      <option value={4}>4 sản phẩm</option>
                      <option value={8}>8 sản phẩm</option>
                      <option value={10}>10 sản phẩm</option>
                      <option value={12}>12 sản phẩm</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Link &quot;Xem tất cả&quot;</label>
                <input
                  type="text"
                  value={viewAllUrl}
                  onChange={(e) => setViewAllUrl(e.target.value)}
                  placeholder="/danh-muc/vot-pickleball"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Hiển thị khối này trên trang chủ</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu khối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { resolveWebMediaUrl, WebBannerItem } from "@/lib/webApi";
import {
  ImageUploadField,
  TabEmptyState,
  TabFeedbackBanner,
  TabLoadingState,
} from "./WebShared";
import { CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  ARCHIVED: "bg-red-50 text-red-700 border-red-200",
};

export default function WebBannersTab() {
  const [banners, setBanners] = useState<WebBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WebBannerItem | null>(null);
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState<"HERO" | "MID_BANNER" | "POPUP">("HERO");
  const [desktopImageUrl, setDesktopImageUrl] = useState("");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PENDING_REVIEW" | "PUBLISHED">("DRAFT");
  const [sortOrder, setSortOrder] = useState(0);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<WebBannerItem[]>("/cms/web/banners");
      setBanners(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách banner");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  const openCreate = () => {
    setEditing(null);
    setModalError("");
    setTitle("");
    setPosition("HERO");
    setDesktopImageUrl("");
    setMobileImageUrl("");
    setLinkUrl("");
    setAltText("");
    setStartDate("");
    setEndDate("");
    setStatus("DRAFT");
    setSortOrder(banners.length + 1);
    setShowModal(true);
  };

  const openEdit = (b: WebBannerItem) => {
    setEditing(b);
    setModalError("");
    setTitle(b.title);
    setPosition(b.position);
    setDesktopImageUrl(b.desktopImageUrl);
    setMobileImageUrl(b.mobileImageUrl);
    setLinkUrl(b.linkUrl || "");
    setAltText(b.altText || "");
    setStartDate(b.startDate ? b.startDate.slice(0, 16) : "");
    setEndDate(b.endDate ? b.endDate.slice(0, 16) : "");
    setStatus(b.status === "ARCHIVED" ? "DRAFT" : b.status);
    setSortOrder(b.sortOrder || 0);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopImageUrl || !mobileImageUrl) {
      setModalError("Bắt buộc phải có cả ảnh Desktop (1440x520) và ảnh Mobile (750x750).");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        title,
        position,
        desktopImageUrl,
        mobileImageUrl,
        linkUrl,
        altText,
        startDate: startDate || null,
        endDate: endDate || null,
        status,
        sortOrder: Number(sortOrder || 0),
      };
      if (editing) {
        await apiRequest(`/cms/web/banners/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật banner "${title}"`);
      } else {
        await apiRequest("/cms/web/banners", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã tạo banner "${title}"`);
      }
      setShowModal(false);
      await loadBanners();
    } catch (err: any) {
      setModalError(err?.message || "Lưu banner thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (b: WebBannerItem) => {
    setError("");
    try {
      await apiRequest(`/cms/web/banners/${b._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      setSuccess(`Đã duyệt & xuất bản banner "${b.title}"`);
      await loadBanners();
    } catch (e: any) {
      setError(e?.message || "Không thể xuất bản banner");
    }
  };

  const handleDelete = async (b: WebBannerItem) => {
    if (!confirm(`Xóa banner "${b.title}"?`)) return;
    setError("");
    try {
      await apiRequest(`/cms/web/banners/${b._id}`, { method: "DELETE" });
      setSuccess(`Đã xóa banner "${b.title}"`);
      await loadBanners();
    } catch (e: any) {
      setError(e?.message || "Xóa banner thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Quản lý Banner &amp; Slider</h3>
          <p className="text-xs text-slate-500">
            Mỗi banner bắt buộc có 2 ảnh riêng cho Desktop (1440x520) và Mobile (750x750).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Banner</span>
        </button>
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
      ) : banners.length === 0 ? (
        <TabEmptyState title="Chưa có banner nào" desc="Bấm 'Thêm Banner' để tạo slider đầu trang." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Ảnh Desktop / Mobile</th>
                <th className="p-3">Tiêu đề &amp; Vị trí</th>
                <th className="p-3">Lịch hiển thị</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {banners.map((b) => (
                <tr key={b._id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <img
                          src={resolveWebMediaUrl(b.desktopImageUrl)}
                          alt={b.title}
                          className="w-24 h-10 object-cover rounded-lg border border-slate-200 bg-slate-100"
                        />
                        {b.desktopImageUrl?.includes("res.cloudinary.com") && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-bold bg-teal-600 text-white shadow-sm">
                            CDN
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <img
                          src={resolveWebMediaUrl(b.mobileImageUrl)}
                          alt={`${b.title} mobile`}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-100"
                        />
                        {b.mobileImageUrl?.includes("res.cloudinary.com") && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-bold bg-teal-600 text-white shadow-sm">
                            CDN
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{b.title}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {b.position} · Thứ tự: {b.sortOrder}
                    </div>
                  </td>
                  <td className="p-3 text-slate-600">
                    {b.startDate || b.endDate ? (
                      <div className="font-mono text-[11px]">
                        <div>Từ: {b.startDate ? b.startDate.slice(0, 10) : "—"}</div>
                        <div>Đến: {b.endDate ? b.endDate.slice(0, 10) : "—"}</div>
                      </div>
                    ) : (
                      <span>Luôn hiển thị</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-lg border font-bold text-[11px] ${
                        STATUS_BADGE[b.status] || STATUS_BADGE.DRAFT
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {b.status !== "PUBLISHED" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(b)}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Xuất bản</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                        title="Sửa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                        title="Xóa"
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editing ? `Sửa Banner: ${editing.title}` : "Tạo Banner mới"}
              </h4>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <TabFeedbackBanner error={modalError} onClear={() => setModalError("")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tiêu đề *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vị trí</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="HERO">Hero Slider (Đầu trang)</option>
                    <option value="MID_BANNER">Banner xen kẽ (Giữa trang)</option>
                    <option value="POPUP">Popup Khuyến mãi</option>
                  </select>
                </div>
              </div>

              <ImageUploadField
                label="Ảnh Desktop (1440 x 520)"
                value={desktopImageUrl}
                onChange={setDesktopImageUrl}
                required
              />
              <ImageUploadField
                label="Ảnh Mobile (750 x 750)"
                value={mobileImageUrl}
                onChange={setMobileImageUrl}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đường dẫn khi bấm</label>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="/danh-muc/vot-pickleball"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Alt Text SEO</label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bắt đầu hiển thị</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kết thúc hiển thị</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
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
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Thứ tự</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

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
                  {saving ? "Đang lưu..." : "Lưu Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

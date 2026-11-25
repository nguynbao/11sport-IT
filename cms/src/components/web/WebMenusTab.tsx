"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api";
import { WebMenuItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Save, Trash2, X } from "lucide-react";

export default function WebMenusTab() {
  const [menus, setMenus] = useState<WebMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WebMenuItem | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [badge, setBadge] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [openInNewTab, setOpenInNewTab] = useState(false);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<WebMenuItem[]>("/cms/web/menus");
      setMenus(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách Mega Menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const rootMenus = useMemo(
    () => menus.filter((m) => !m.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [menus]
  );

  const getChildren = (pid: string) =>
    menus.filter((m) => m.parentId === pid).sort((a, b) => a.sortOrder - b.sortOrder);

  const openCreate = (presetParentId = "") => {
    setEditing(null);
    setLabel("");
    setUrl("");
    setParentId(presetParentId);
    setBadge("");
    setSortOrder(menus.length + 1);
    setIsActive(true);
    setOpenInNewTab(false);
    setShowModal(true);
  };

  const openEdit = (m: WebMenuItem) => {
    setEditing(m);
    setLabel(m.label);
    setUrl(m.url);
    setParentId(m.parentId || "");
    setBadge(m.badge || "");
    setSortOrder(m.sortOrder || 0);
    setIsActive(m.isActive !== false);
    setOpenInNewTab(Boolean(m.openInNewTab));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        label,
        url,
        parentId: parentId || null,
        badge,
        sortOrder: Number(sortOrder || 0),
        isActive,
        openInNewTab,
      };
      if (editing) {
        await apiRequest(`/cms/web/menus/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật mục menu "${label}"`);
      } else {
        await apiRequest("/cms/web/menus", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã thêm mục menu "${label}"`);
      }
      setShowModal(false);
      await loadMenus();
    } catch (err: any) {
      setError(err?.message || "Lưu menu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: WebMenuItem) => {
    if (!confirm(`Xóa mục menu "${m.label}"?`)) return;
    setError("");
    try {
      await apiRequest(`/cms/web/menus/${m._id}`, { method: "DELETE" });
      setSuccess(`Đã xóa mục menu "${m.label}"`);
      await loadMenus();
    } catch (e: any) {
      setError(e?.message || "Xóa menu thất bại");
    }
  };

  const swapSort = (siblings: WebMenuItem[], idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[target];
    setMenus((prev) =>
      prev.map((m) => {
        if (m._id === a._id) return { ...m, sortOrder: b.sortOrder };
        if (m._id === b._id) return { ...m, sortOrder: a.sortOrder };
        return m;
      })
    );
  };

  const handleSaveReorder = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = menus.map((m) => ({
        id: m._id,
        sortOrder: m.sortOrder,
        parentId: m.parentId || null,
      }));
      const res = await apiRequest<WebMenuItem[]>("/cms/web/menus/reorder", {
        method: "PUT",
        body: JSON.stringify({ menus: payload }),
      });
      setMenus(Array.isArray(res.data) ? res.data : menus);
      setSuccess("Đã lưu thứ tự cây Mega Menu!");
    } catch (e: any) {
      setError(e?.message || "Lưu thứ tự thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Cây điều hướng Mega Menu</h3>
          <p className="text-xs text-slate-500">
            Quản lý menu cha/con, nhãn nổi bật (HOT / MỚI) và thứ tự hiển thị trên Header.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate("")}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Menu cha</span>
          </button>
          <button
            type="button"
            onClick={handleSaveReorder}
            disabled={saving || menus.length === 0}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Lưu thứ tự</span>
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
      ) : rootMenus.length === 0 ? (
        <TabEmptyState title="Chưa có mục menu nào" desc="Bấm 'Thêm Menu cha' để tạo thanh điều hướng." />
      ) : (
        <div className="space-y-3">
          {rootMenus.map((parent, idx) => {
            const children = getChildren(parent._id);
            return (
              <div key={parent._id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-3.5 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderTree className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="font-extrabold text-sm text-slate-900">{parent.label}</span>
                    {parent.badge && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-mono text-[10px] font-bold">
                        {parent.badge}
                      </span>
                    )}
                    <span className="text-xs font-mono text-slate-500 truncate">{parent.url}</span>
                    {!parent.isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold">
                        Ẩn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openCreate(parent._id)}
                      className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Mục con</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => swapSort(rootMenus, idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => swapSort(rootMenus, idx, 1)}
                      disabled={idx === rootMenus.length - 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(parent)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(parent)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {children.length > 0 && (
                  <div className="divide-y divide-slate-100 pl-6 pr-3 py-1">
                    {children.map((ch, cIdx) => (
                      <div key={ch._id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-400">↳</span>
                          <span className="font-bold text-xs text-slate-800">{ch.label}</span>
                          {ch.badge && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-mono text-[10px] font-bold">
                              {ch.badge}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400 truncate">{ch.url}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => swapSort(children, cIdx, -1)}
                            disabled={cIdx === 0}
                            className="p-1 rounded border border-slate-200 text-slate-600 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => swapSort(children, cIdx, 1)}
                            disabled={cIdx === children.length - 1}
                            className="p-1 rounded border border-slate-200 text-slate-600 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(ch)}
                            className="p-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ch)}
                            className="p-1 rounded border border-slate-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editing ? `Sửa mục menu: ${editing.label}` : "Thêm mục Mega Menu"}
              </h4>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên hiển thị *</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đường dẫn (URL) *</label>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/danh-muc/vot-pickleball"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Menu cha</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                >
                  <option value="">-- Menu gốc (Cấp 1) --</option>
                  {rootMenus
                    .filter((r) => r._id !== editing?._id)
                    .map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Badge (HOT/MỚI)</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="HOT"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
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
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Hiển thị</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => setOpenInNewTab(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Mở tab mới</span>
                </label>
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
                  {saving ? "Đang lưu..." : "Lưu Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

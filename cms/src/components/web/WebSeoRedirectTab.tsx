"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, UserRole } from "@/lib/api";
import { WebProductItem, WebRedirectItem } from "@/lib/webApi";
import {
  AdminOnlyBadge,
  SeoCharacterBar,
  TabEmptyState,
  TabFeedbackBanner,
  TabLoadingState,
} from "./WebShared";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type SubTab = "SEO_AUDIT" | "REDIRECTS";

export default function WebSeoRedirectTab({ role }: { role: UserRole }) {
  const isAdmin = role === "ADMIN";
  const [subTab, setSubTab] = useState<SubTab>("SEO_AUDIT");
  const [products, setProducts] = useState<WebProductItem[]>([]);
  const [redirects, setRedirects] = useState<WebRedirectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Quick SEO edit
  const [editProd, setEditProd] = useState<WebProductItem | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");

  // Redirect modal (ADMIN ONLY)
  const [showRedirModal, setShowRedirModal] = useState(false);
  const [editingRedir, setEditingRedir] = useState<WebRedirectItem | null>(null);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<301 | 302>(301);
  const [note, setNote] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prodRes, redirRes] = await Promise.all([
        apiRequest<WebProductItem[]>("/cms/web/products"),
        apiRequest<WebRedirectItem[]>("/cms/web/redirects"),
      ]);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setRedirects(Array.isArray(redirRes.data) ? redirRes.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được dữ liệu SEO & Redirect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProd) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/cms/web/products/${editProd._id}/web`, {
        method: "PATCH",
        body: JSON.stringify({
          seo: {
            ...(editProd.seo || {}),
            title: seoTitle,
            description: seoDesc,
          },
        }),
      });
      setSuccess(`Đã cập nhật SEO cho "${editProd.name}"`);
      setEditProd(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Lưu SEO thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError("");
    try {
      const payload = { fromPath, toPath, statusCode, note, isActive: true };
      if (editingRedir) {
        await apiRequest(`/cms/web/redirects/${editingRedir._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật Redirect ${fromPath}`);
      } else {
        await apiRequest("/cms/web/redirects", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã tạo Redirect ${fromPath} → ${toPath}`);
      }
      setShowRedirModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Lưu Redirect thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRedirect = async (r: WebRedirectItem) => {
    if (!isAdmin) return;
    if (!confirm(`Xóa Redirect ${r.fromPath} → ${r.toPath}?`)) return;
    setError("");
    try {
      await apiRequest(`/cms/web/redirects/${r._id}`, { method: "DELETE" });
      setSuccess(`Đã xóa Redirect ${r.fromPath}`);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Xóa Redirect thất bại");
    }
  };

  const seoScoreBadge = (len: number, min: number, max: number) => {
    if (len === 0) return "bg-slate-100 text-slate-500 border-slate-200";
    if (len >= min && len <= max) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (len > max) return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => setSubTab("SEO_AUDIT")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              subTab === "SEO_AUDIT" ? "bg-teal-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Kiểm tra SEO Thực thể
          </button>
          <button
            type="button"
            onClick={() => setSubTab("REDIRECTS")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              subTab === "REDIRECTS" ? "bg-teal-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Quản lý 301 Redirect ({redirects.length})
          </button>
        </div>

        {subTab === "REDIRECTS" && (
          <div className="flex items-center gap-2">
            {!isAdmin && <AdminOnlyBadge text="[ADMIN ONLY] CEO chỉ được xem Redirect" />}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingRedir(null);
                  setFromPath("");
                  setToPath("");
                  setStatusCode(301);
                  setNote("");
                  setShowRedirModal(true);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm 301 Redirect</span>
              </button>
            )}
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
      ) : subTab === "SEO_AUDIT" ? (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Sản phẩm / Slug</th>
                <th className="p-3">SEO Title (50–60)</th>
                <th className="p-3">Meta Desc (150–160)</th>
                <th className="p-3 text-right">Sửa nhanh SEO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const tLen = (p.seo?.title || "").length;
                const dLen = (p.seo?.description || "").length;
                return (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">/san-pham/{p.slug || "chua-co-slug"}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] ${seoScoreBadge(
                          tLen,
                          50,
                          60
                        )}`}
                      >
                        {tLen} / 60
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] ${seoScoreBadge(
                          dLen,
                          150,
                          160
                        )}`}
                      >
                        {dLen} / 160
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditProd(p);
                          setSeoTitle(p.seo?.title || "");
                          setSeoDesc(p.seo?.description || "");
                        }}
                        className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Tối ưu SEO</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : redirects.length === 0 ? (
        <TabEmptyState title="Chưa có cấu hình 301 Redirect nào" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Từ đường dẫn (Cũ)</th>
                <th className="p-3">Đến đường dẫn (Mới)</th>
                <th className="p-3">Mã HTTP</th>
                <th className="p-3">Ghi chú</th>
                {isAdmin && <th className="p-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {redirects.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-800">{r.fromPath}</td>
                  <td className="p-3 font-mono text-teal-700">{r.toPath}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold">
                      {r.statusCode}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{r.note || "—"}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRedir(r);
                          setFromPath(r.fromPath);
                          setToPath(r.toPath);
                          setStatusCode(r.statusCode);
                          setNote(r.note || "");
                          setShowRedirModal(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 mr-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRedirect(r)}
                        className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">Tối ưu SEO: {editProd.name}</h4>
              <button type="button" onClick={() => setEditProd(null)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSeo} className="p-5 space-y-4">
              <SeoCharacterBar label="SEO Title" value={seoTitle} min={50} max={60} onChange={setSeoTitle} />
              <SeoCharacterBar
                label="Meta Description"
                value={seoDesc}
                min={150}
                max={160}
                multiline
                onChange={setSeoDesc}
              />
              <div className="flex justify-end gap-2">
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
                  {saving ? "Đang lưu..." : "Lưu SEO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRedirModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editingRedir ? "Sửa 301 Redirect" : "Thêm 301 Redirect"}
              </h4>
              <button
                type="button"
                onClick={() => setShowRedirModal(false)}
                className="p-1 rounded hover:bg-teal-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRedirect} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Từ đường dẫn *</label>
                <input
                  type="text"
                  required
                  value={fromPath}
                  onChange={(e) => setFromPath(e.target.value)}
                  placeholder="/san-pham-cu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đến đường dẫn *</label>
                <input
                  type="text"
                  required
                  value={toPath}
                  onChange={(e) => setToPath(e.target.value)}
                  placeholder="/san-pham/san-pham-moi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã HTTP</label>
                <select
                  value={statusCode}
                  onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                >
                  <option value={301}>301 — Chuyển hướng vĩnh viễn</option>
                  <option value={302}>302 — Chuyển hướng tạm thời</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRedirModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu Redirect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

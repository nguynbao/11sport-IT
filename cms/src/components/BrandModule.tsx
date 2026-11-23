"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Brand,
  Category,
  apiRequest,
  describeApiError,
  filterAndRankBySearch,
  getStoredUser,
  useDebounce,
} from "@/lib/api";
import ExportExcelButton from "./ExportExcelButton";
import { exportBrands } from "@/lib/exports";
import {
  Tags,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Pencil,
  X,
  Lock,
  Search,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";

const CODE_RE = /^[A-Z0-9]{2,4}$/;

interface BrandForm {
  code: string;
  name: string;
  aliases: string;
  categoryIds: string[];
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: BrandForm = { code: "", name: "", aliases: "", categoryIds: [], status: "ACTIVE" };

export default function BrandModule() {
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    const role = getStoredUser()?.role;
    setCanManage(role === "CEO" || role === "ADMIN" || role === "ACCOUNTANT");
  }, []);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c._id, c));
    return m;
  }, [categories]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterCategoryId) qs.set("categoryId", filterCategoryId);
      if (filterStatus) qs.set("status", filterStatus);
      const q = qs.toString();
      const [bRes, cRes] = await Promise.all([
        apiRequest<Brand[]>(`/brands${q ? `?${q}` : ""}`),
        categories.length ? Promise.resolve({ data: categories }) : apiRequest<Category[]>("/categories"),
      ]);
      setBrands(Array.isArray(bRes.data) ? bRes.data : []);
      if (!categories.length) setCategories(Array.isArray(cRes.data) ? (cRes.data as Category[]) : []);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không tải được danh sách thương hiệu.") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategoryId, filterStatus]);

  const visibleBrands = useMemo(() => {
    if (!debouncedSearch.trim()) return brands;
    return filterAndRankBySearch(brands, debouncedSearch, (b) => [
      { text: b.code, weight: 1.5 },
      { text: b.name, weight: 1.4 },
      ...(b.aliases || []).map((a) => ({ text: a, weight: 1.1 })),
    ]);
  }, [brands, debouncedSearch]);

  const stats = useMemo(() => {
    const active = brands.filter((b) => b.status === "ACTIVE").length;
    const totalProducts = brands.reduce((s, b) => s + Number(b.productCount || 0), 0);
    return { total: brands.length, active, inactive: brands.length - active, totalProducts };
  }, [brands]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const startEdit = (b: Brand) => {
    setEditing(b);
    setStatusMsg(null);
    setForm({
      code: b.code,
      name: b.name,
      aliases: (b.aliases || []).join(", "),
      categoryIds: (b.categoryIds || []).map(String),
      status: b.status,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleCategory = (id: string) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((x) => x !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const activeCategories = categories.filter((c) => c.status === "ACTIVE" || form.categoryIds.includes(c._id));

  const selectAllCategories = () => {
    setForm((prev) => ({
      ...prev,
      categoryIds: activeCategories.map((c) => c._id),
    }));
  };

  const clearAllCategories = () => {
    setForm((prev) => ({ ...prev, categoryIds: [] }));
  };

  const parseAliases = (raw: string) =>
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setStatusMsg(null);
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const isSystem = Boolean(editing?.isSystem);
    if (!name) {
      setStatusMsg({ type: "error", text: "Vui lòng nhập tên thương hiệu." });
      return;
    }
    if (code && !CODE_RE.test(code)) {
      setStatusMsg({ type: "error", text: "Mã thương hiệu phải gồm 2–4 ký tự A-Z, 0-9." });
      return;
    }
    if (!isSystem && form.categoryIds.length === 0) {
      setStatusMsg({ type: "error", text: "Chọn ít nhất 1 danh mục cho thương hiệu." });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, any> = { name, aliases: parseAliases(form.aliases), allowRecode: true };
        if (!isSystem) {
          body.categoryIds = form.categoryIds;
          body.status = form.status;
          if (code && code !== editing.code) body.code = code;
        }
        await apiRequest(`/brands/${editing._id}`, { method: "PATCH", body: JSON.stringify(body) });
        setStatusMsg({ type: "success", text: `Đã cập nhật thương hiệu "${name}".` });
      } else {
        await apiRequest(`/brands`, {
          method: "POST",
          body: JSON.stringify({
            ...(code ? { code } : {}),
            name,
            aliases: parseAliases(form.aliases),
            categoryIds: form.categoryIds,
            status: form.status,
          }),
        });
        setStatusMsg({ type: "success", text: `Đã thêm thương hiệu "${name}".` });
      }
      resetForm();
      loadAll();
    } catch (err: any) {
      let text = describeApiError(err, "Lỗi khi lưu thương hiệu.");
      if (err?.code === "BRAND_CATEGORY_IN_USE" && Array.isArray(err?.fields?.categoryIds)) {
        const names = err.fields.categoryIds.map((id: string) => categoryMap.get(String(id))?.name || id);
        text += ` (Danh mục đang dùng: ${names.join(", ")})`;
      }
      setStatusMsg({ type: "error", text });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (b: Brand) => {
    setStatusMsg(null);
    try {
      await apiRequest(`/brands/${b._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      setStatusMsg({ type: "success", text: `Đã cập nhật trạng thái thương hiệu "${b.name}".` });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Lỗi khi cập nhật trạng thái.") });
    }
  };

  const handleDelete = async (b: Brand) => {
    setStatusMsg(null);
    if (typeof window !== "undefined" && !window.confirm(`Xoá thương hiệu "${b.name}" (${b.code})?`)) return;
    try {
      await apiRequest(`/brands/${b._id}`, { method: "DELETE" });
      setStatusMsg({ type: "success", text: `Đã xoá thương hiệu "${b.name}".` });
      if (editing?._id === b._id) resetForm();
      loadAll();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: describeApiError(err, "Không thể xoá thương hiệu.") });
    }
  };

  const lockSystem = Boolean(editing?.isSystem);

  return (
    <div className="space-y-6">
      <div className="bg-teal-50/80 border border-teal-200 text-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-brand-ink shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="text-brand-ink uppercase">Quy tắc Thương hiệu (R6 &amp; R11):</strong> Mã 2–4 ký tự
            A-Z, 0-9 nằm trong mã sản phẩm nên <strong>không đổi được khi đã có sản phẩm</strong>. Thương hiệu đang có sản
            phẩm không xoá được, chỉ <strong>Ngừng sử dụng</strong>. Thương hiệu hệ thống <strong>NN</strong> (không hãng)
            dùng cho mọi danh mục và bị khoá.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-white text-brand-ink border border-teal-200 font-bold">
            Đang dùng: {stats.active}
          </span>
          {stats.inactive > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-white text-slate-600 border border-slate-200 font-bold">
              Ngừng dùng: {stats.inactive}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-white text-brand-ink border border-indigo-200 font-bold">
            Tổng SP: {stats.totalProducts}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div
          role={statusMsg.type === "error" ? "alert" : "status"}
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-200 text-brand-ink"
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

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className={`rounded-xl border shadow-sm p-5 space-y-4 transition ${
            editing ? "bg-teal-50/40 border-teal-300" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4 text-brand-ink" /> : <Plus className="w-4 h-4 text-brand-ink" />}
              {editing ? `Sửa thương hiệu ${editing.code}` : "Thêm thương hiệu"}
              {lockSystem && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Hệ thống — chỉ sửa tên/alias
                </span>
              )}
            </h3>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Huỷ sửa
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="brand-code" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Mã Brand (2–4)
              </label>
              <input
                id="brand-code"
                type="text"
                value={form.code}
                maxLength={4}
                disabled={lockSystem}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                placeholder={editing ? "" : "VD: ASC (trống = gợi ý)"}
                title="2–4 ký tự A-Z, 0-9. Để trống khi thêm mới, server tự gợi ý từ tên."
                className="w-44 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="brand-name" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Tên thương hiệu *
              </label>
              <input
                id="brand-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="VD: Asics"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="brand-aliases" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Tên gọi khác (alias, cách nhau dấu phẩy)
              </label>
              <input
                id="brand-aliases"
                type="text"
                value={form.aliases}
                onChange={(e) => setForm((p) => ({ ...p, aliases: e.target.value }))}
                placeholder="VD: ASICS, Asic"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <div>
              <label htmlFor="brand-status" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Trạng thái
              </label>
              <select
                id="brand-status"
                value={form.status}
                disabled={lockSystem}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold disabled:bg-slate-100"
              >
                <option value="ACTIVE">Đang dùng</option>
                <option value="INACTIVE">Ngừng sử dụng</option>
              </select>
            </div>
          </div>
          {!lockSystem && (
            <fieldset className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-xs font-bold uppercase text-slate-600">
                  Thuộc danh mục * ({form.categoryIds.length}/{activeCategories.length} đã chọn)
                </legend>
                {activeCategories.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllCategories}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3 text-brand-ink" /> Chọn tất cả
                    </button>
                    {form.categoryIds.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllCategories}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Square className="w-3 h-3" /> Bỏ chọn hết
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeCategories.map((c) => {
                  const checked = form.categoryIds.includes(c._id);
                  return (
                    <label
                      key={c._id}
                      className={`cursor-pointer px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition ${
                        checked
                          ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleCategory(c._id)} />
                      {c.skuCode && <span className="font-mono opacity-80">[{c.skuCode}]</span>}
                      {c.name}
                    </label>
                  );
                })}
                {activeCategories.length === 0 && (
                  <span className="text-xs text-slate-500">Chưa có danh mục — tạo ở tab Danh mục trước.</span>
                )}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2.5 rounded-lg disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                editing ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? "Lưu thay đổi" : "Thêm thương hiệu"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Tags className="w-5 h-5 text-brand-ink" />
            Danh sách thương hiệu ({visibleBrands.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Tìm thương hiệu"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã, tên, alias..."
                className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs w-56"
              />
            </div>
            <select
              aria-label="Lọc theo danh mục"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.skuCode ? `[${c.skuCode}] ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc theo trạng thái"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "ACTIVE" | "INACTIVE")}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Mọi trạng thái</option>
              <option value="ACTIVE">Đang dùng</option>
              <option value="INACTIVE">Ngừng sử dụng</option>
            </select>
            <ExportExcelButton
              onExport={() => exportBrands(visibleBrands, categoryMap)}
              disabled={visibleBrands.length === 0}
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Mã</th>
                <th className="py-3 px-4">Tên / Alias</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4 text-center">Số sản phẩm</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                {canManage && <th className="py-3 px-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && visibleBrands.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Đang tải...
                  </td>
                </tr>
              )}
              {!loading && visibleBrands.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không có thương hiệu phù hợp.
                  </td>
                </tr>
              )}
              {visibleBrands.map((b, idx) => {
                const count = Number(b.productCount || 0);
                return (
                  <tr key={b._id} className={`hover:bg-slate-50 ${editing?._id === b._id ? "bg-teal-50" : ""}`}>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-extrabold text-slate-900">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {b.code}
                        {b.isSystem && <Lock className="w-3 h-3 text-slate-400" aria-label="Thương hiệu hệ thống" />}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.name}</div>
                      {(b.aliases || []).length > 0 && (
                        <div className="text-[11px] text-slate-500">{(b.aliases || []).join(", ")}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.isSystem ? (
                        <span className="text-slate-500 italic">Mọi danh mục</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(b.categoryIds || []).map((id) => {
                            const c = categoryMap.get(String(id));
                            return (
                              <span
                                key={String(id)}
                                className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-semibold"
                              >
                                {c?.skuCode ? `[${c.skuCode}] ` : ""}
                                {c ? c.name : String(id)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-extrabold text-slate-800">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] ${
                          count > 0 ? "bg-indigo-50 text-brand-ink" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count} SP
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          b.status === "ACTIVE" ? "bg-teal-100 text-brand-ink" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {b.status === "ACTIVE" ? "Đang dùng" : "Ngừng sử dụng"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-200 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Sửa
                        </button>
                        {!b.isSystem && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(b)}
                              className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                                b.status === "ACTIVE"
                                  ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                                  : "bg-teal-100 hover:bg-teal-200 text-teal-900"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {b.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt lại"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b)}
                              title={count > 0 ? "Thương hiệu đang có sản phẩm — hệ thống sẽ chặn xoá (R11)" : "Xoá thương hiệu"}
                              className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                                count > 0
                                  ? "bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  : "bg-red-50 hover:bg-red-100 text-red-600"
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Xoá
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

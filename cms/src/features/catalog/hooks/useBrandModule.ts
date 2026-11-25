
import React, { useEffect, useMemo, useState } from "react";
import { Brand, Category } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { filterAndRankBySearch, useDebounce } from "@/shared/lib/search";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportBrands } from "../exports";
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

export const CODE_RE = /^[A-Z0-9]{2,4}$/;

export interface BrandForm {
  code: string;
  name: string;
  aliases: string;
  categoryIds: string[];
  status: "ACTIVE" | "INACTIVE";
}

export const EMPTY_FORM: BrandForm = {
  code: "",
  name: "",
  aliases: "",
  categoryIds: [],
  status: "ACTIVE",
};

export function useBrandModule() {
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


  return {
    canManage,
    categories,
    loading,
    saving,
    form,
    setForm,
    editing,
    filterCategoryId,
    setFilterCategoryId,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    statusMsg,
    setStatusMsg,
    categoryMap,
    visibleBrands,
    stats,
    resetForm,
    startEdit,
    toggleCategory,
    activeCategories,
    selectAllCategories,
    clearAllCategories,
    handleSubmit,
    handleToggleStatus,
    handleDelete,
    lockSystem,
  };
}

export type BrandModuleViewModel = ReturnType<typeof useBrandModule>;

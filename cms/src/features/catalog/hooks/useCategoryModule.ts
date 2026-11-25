
import React, { useState, useEffect, useMemo } from "react";
import { Category } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { describeApiError } from "@/shared/api/errors";
import { filterAndRankBySearch, useDebounce } from "@/shared/lib/search";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportCategories } from "../exports";
import {
  FolderKanban,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Pencil,
  Save,
  X,
  Search,
  RotateCcw,
} from "lucide-react";



export function useCategoryModule() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");

  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [editingSku, setEditingSku] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      const list = Array.isArray(res.data) ? res.data : [];
      setCategories(list);
      const codeMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      const skuMap: Record<string, string> = {};
      list.forEach((c) => {
        codeMap[c._id] = c.code;
        nameMap[c._id] = c.name;
        skuMap[c._id] = c.skuCode || "";
      });
      setEditingCodes(codeMap);
      setEditingNames(nameMap);
      setEditingSku(skuMap);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const visibleCategories = useMemo(() => {
    const base = categories.filter((c) => !filterStatus || c.status === filterStatus);
    if (!debouncedSearch.trim()) return base;
    return filterAndRankBySearch(base, debouncedSearch, (c) => [
      { text: c.skuCode, weight: 1.6 },
      { text: c.code, weight: 1.5 },
      { text: c.name, weight: 1.4 },
    ]);
  }, [categories, filterStatus, debouncedSearch]);

  const stats = useMemo(() => {
    const active = categories.filter((c) => c.status === "ACTIVE").length;
    const inactive = categories.length - active;
    const totalProducts = categories.reduce((s, c) => s + Number(c.productCount || 0), 0);
    return { total: categories.length, active, inactive, totalProducts };
  }, [categories]);

  const resetForm = () => {
    setEditingCat(null);
    setCode("");
    setName("");
    setSkuCode("");
    setStatus("ACTIVE");
  };

  const resetRow = (cat: Category) => {
    setEditingCodes((prev) => ({ ...prev, [cat._id]: cat.code }));
    setEditingSku((prev) => ({ ...prev, [cat._id]: cat.skuCode || "" }));
    setEditingNames((prev) => ({ ...prev, [cat._id]: cat.name }));
  };

  const startEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setStatusMsg(null);
    setCode(cat.code || "");
    setSkuCode(cat.skuCode || "");
    setName(cat.name || "");
    setStatus(cat.status || "ACTIVE");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingForm) return;
    setStatusMsg(null);
    if (!code.trim() || !name.trim()) return;
    const sku = skuCode.trim().toUpperCase();
    if (sku && !/^[A-Z0-9]{1,3}$/.test(sku)) {
      setStatusMsg({ type: "error", text: "Mã Cate phải gồm 1–3 ký tự A-Z, 0-9." });
      return;
    }
    setSavingForm(true);
    try {
      if (editingCat) {
        await apiRequest(`/categories/${editingCat._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            status,
            ...(sku ? { skuCode: sku } : {}),
            allowRecode: true,
          }),
        });
        setStatusMsg({
          type: "success",
          text: `Đã cập nhật Danh mục "${name.trim()}" (${code.trim().toUpperCase()}) thành công!`,
        });
      } else {
        await apiRequest("/categories", {
          method: "POST",
          body: JSON.stringify({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            status,
            ...(sku ? { skuCode: sku } : {}),
          }),
        });
        setStatusMsg({
          type: "success",
          text: "Đã tạo Category mới thành công!",
        });
      }
      resetForm();
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: describeApiError(err, editingCat ? "Lỗi khi cập nhật Category." : "Lỗi khi tạo Category."),
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleUpdateCategory = async (cat: Category, nextStatus?: "ACTIVE" | "INACTIVE") => {
    setStatusMsg(null);
    const nextCode = String(editingCodes[cat._id] ?? cat.code ?? "").trim().toUpperCase();
    const nextName = String(editingNames[cat._id] ?? cat.name ?? "").trim();
    const nextSku = String(editingSku[cat._id] ?? cat.skuCode ?? "").trim().toUpperCase();
    const skuChanged = nextSku !== String(cat.skuCode || "");
    if (!nextCode || !nextName) {
      setStatusMsg({ type: "error", text: "Mã Category và Tên Category không được để trống." });
      return;
    }
    if (skuChanged && !/^[A-Z0-9]{1,3}$/.test(nextSku)) {
      setStatusMsg({ type: "error", text: "Mã Cate phải gồm 1–3 ký tự A-Z, 0-9." });
      return;
    }
    try {
      await apiRequest(`/categories/${cat._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: nextCode,
          name: nextName,
          status: nextStatus || cat.status,
          ...(skuChanged ? { skuCode: nextSku } : {}),
          allowRecode: true,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật Category "${nextName}" (${nextCode}) thành công!`,
      });
      if (editingCat?._id === cat._id) resetForm();
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: describeApiError(err, "Lỗi khi cập nhật Category."),
      });
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    setStatusMsg(null);
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Bạn có chắc muốn xóa Category "${cat.name}" (${cat.code})?`)
    ) {
      return;
    }
    try {
      await apiRequest(`/categories/${cat._id}`, {
        method: "DELETE",
      });
      setStatusMsg({
        type: "success",
        text: `Đã xóa Category "${cat.name}" thành công!`,
      });
      if (editingCat?._id === cat._id) resetForm();
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: describeApiError(
          err,
          "Không thể xóa Category đang có sản phẩm; chỉ được ngừng sử dụng (BR-02)."
        ),
      });
    }
  };


  return {
    categories,
    code,
    setCode,
    name,
    setName,
    skuCode,
    setSkuCode,
    status,
    setStatus,
    editingCat,
    savingForm,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    editingCodes,
    setEditingCodes,
    editingNames,
    setEditingNames,
    editingSku,
    setEditingSku,
    statusMsg,
    setStatusMsg,
    visibleCategories,
    stats,
    resetForm,
    resetRow,
    startEditCategory,
    handleSubmitForm,
    handleUpdateCategory,
    handleDeleteCategory,
  };
}

export type CategoryModuleViewModel = ReturnType<typeof useCategoryModule>;

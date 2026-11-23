"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Category, apiRequest, describeApiError, filterAndRankBySearch, useDebounce } from "@/lib/api";
import ExportExcelButton from "./ExportExcelButton";
import { exportCategories } from "@/lib/exports";
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

export default function CategoryModule() {
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

  return (
    <div className="space-y-6">
      <div className="bg-teal-50/80 border border-teal-200 text-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-brand-ink shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="text-brand-ink uppercase">
              Quy tắc Nghiệp vụ Category (BR-01 &amp; BR-02):
            </strong>{" "}
            Bấm nút <strong>Sửa</strong> ở cột Thao tác (hoặc sửa trực tiếp trên dòng rồi bấm <strong>Lưu</strong>) để chỉnh sửa{" "}
            <strong>Mã Category</strong>, <strong>Mã Cate (1–3 ký tự sinh SKU)</strong> và <strong>Tên Category</strong>. Không cho phép xóa vĩnh viễn Category đang có sản phẩm; chỉ chuyển sang{" "}
            <strong>Ngừng sử dụng (INACTIVE)</strong>.
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

      {/* Form Thêm / Sửa Category */}
      <form
        onSubmit={handleSubmitForm}
        className={`rounded-xl border shadow-sm p-5 space-y-4 transition ${
          editingCat ? "bg-teal-50/40 border-teal-300" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            {editingCat ? (
              <Pencil className="w-4 h-4 text-brand-ink" />
            ) : (
              <Plus className="w-4 h-4 text-brand-ink" />
            )}
            {editingCat
              ? `Đang sửa Danh mục: ${editingCat.name} (${editingCat.code})`
              : "Thêm Danh mục (Category) mới"}
          </h3>
          {editingCat && (
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
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Mã Category (IN HOA) *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VD: GIAY_CHAY_BO"
              className="w-48 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Mã Cate sinh SKU (1–3 ký tự)
            </label>
            <input
              type="text"
              value={skuCode}
              maxLength={3}
              onChange={(e) =>
                setSkuCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="VD: G (trống = tự gợi ý)"
              title="Mã ngắn đứng đầu mã sản phẩm (VD: G cho Giày, V cho Vợt)."
              className="w-44 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Tên Category *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Giày Chạy Bộ Chuyên Nghiệp"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Trạng thái
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold"
            >
              <option value="ACTIVE">Đang dùng (ACTIVE)</option>
              <option value="INACTIVE">Ngừng sử dụng (INACTIVE)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={savingForm}
            className={`px-5 py-2.5 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
              editingCat
                ? "bg-teal-600 hover:bg-teal-700"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {editingCat ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {savingForm
              ? "Đang lưu..."
              : editingCat
                ? "Lưu cập nhật Danh mục"
                : "Thêm Category"}
          </button>
        </div>
      </form>

      {/* Bảng Category */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-brand-ink" />
            Danh sách Category ({visibleCategories.length}/{categories.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Tìm danh mục"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã Cate, mã hoặc tên..."
                className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs w-56"
              />
            </div>

            <select
              aria-label="Lọc trạng thái danh mục"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "ACTIVE" | "INACTIVE")}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Mọi trạng thái ({categories.length})</option>
              <option value="ACTIVE">Đang dùng ({stats.active})</option>
              <option value="INACTIVE">Ngừng sử dụng ({stats.inactive})</option>
            </select>

            <ExportExcelButton
              onExport={() => exportCategories(visibleCategories)}
              disabled={visibleCategories.length === 0}
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Mã Category</th>
                <th className="py-3 px-4">Mã Cate (SKU 1–3 ký tự)</th>
                <th className="py-3 px-4">Tên Category (Sửa trực tiếp)</th>
                <th className="py-3 px-4 text-center">Số sản phẩm</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleCategories.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không có danh mục nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {visibleCategories.map((cat, idx) => {
                const count = Number(cat.productCount || 0);
                const isRowChanged =
                  String(editingCodes[cat._id] ?? cat.code).trim().toUpperCase() !== cat.code ||
                  String(editingSku[cat._id] ?? cat.skuCode ?? "").trim().toUpperCase() !==
                    String(cat.skuCode || "") ||
                  String(editingNames[cat._id] ?? cat.name).trim() !== cat.name;
                return (
                  <tr
                    key={cat._id}
                    className={`hover:bg-slate-50 transition ${
                      editingCat?._id === cat._id
                        ? "bg-teal-50/50"
                        : isRowChanged
                          ? "bg-amber-50/40"
                          : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={editingCodes[cat._id] ?? cat.code}
                        onChange={(e) =>
                          setEditingCodes((prev) => ({
                            ...prev,
                            [cat._id]: e.target.value.toUpperCase(),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateCategory(cat);
                          }
                        }}
                        className="w-36 px-2.5 py-1.5 rounded border border-slate-300 font-mono text-xs font-bold text-slate-900 uppercase bg-white"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={editingSku[cat._id] ?? cat.skuCode ?? ""}
                        maxLength={3}
                        title="Mã Cate 1–3 ký tự A-Z, 0-9 đứng đầu Mã sản phẩm"
                        onChange={(e) =>
                          setEditingSku((prev) => ({
                            ...prev,
                            [cat._id]: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateCategory(cat);
                          }
                        }}
                        className="w-20 px-2 py-1.5 rounded border border-indigo-200 font-mono text-xs font-extrabold text-center text-brand-ink bg-indigo-50/50"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingNames[cat._id] ?? cat.name}
                          onChange={(e) =>
                            setEditingNames((prev) => ({
                              ...prev,
                              [cat._id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleUpdateCategory(cat);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold w-64 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat)}
                          className={`px-3 py-1.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                            isRowChanged
                              ? "bg-teal-600 hover:bg-teal-700 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Lưu
                        </button>
                        {isRowChanged && (
                          <button
                            type="button"
                            onClick={() => resetRow(cat)}
                            title="Hoàn tác thay đổi trên dòng này"
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
                          cat.status === "ACTIVE"
                            ? "bg-teal-100 text-brand-ink"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {cat.status === "ACTIVE"
                          ? "Đang dùng (ACTIVE)"
                          : "Ngừng sử dụng (INACTIVE)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEditCategory(cat)}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink border border-teal-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sửa
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCategory(
                            cat,
                            cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                          cat.status === "ACTIVE"
                            ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                            : "bg-teal-100 hover:bg-teal-200 text-teal-900"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {cat.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt lại"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        title={
                          count > 0
                            ? "Category đang có sản phẩm — Hệ thống sẽ chặn xóa theo BR-02"
                            : "Xóa Category rỗng"
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                          count > 0
                            ? "bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            : "bg-red-50 hover:bg-red-100 text-red-600"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </button>
                    </td>
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

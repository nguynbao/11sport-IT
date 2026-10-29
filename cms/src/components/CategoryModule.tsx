"use client";

import React, { useState, useEffect } from "react";
import { Category, apiRequest } from "@/lib/api";
import {
  FolderKanban,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

export default function CategoryModule() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      const list = Array.isArray(res.data) ? res.data : [];
      setCategories(list);
      const map: Record<string, string> = {};
      list.forEach((c) => {
        map[c._id] = c.name;
      });
      setEditingNames(map);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!code.trim() || !name.trim()) return;
    try {
      await apiRequest("/categories", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          status: "ACTIVE",
        }),
      });
      setCode("");
      setName("");
      setStatusMsg({
        type: "success",
        text: "Đã tạo Category mới thành công!",
      });
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi tạo Category.",
      });
    }
  };

  const handleUpdateCategory = async (cat: Category, nextStatus?: "ACTIVE" | "INACTIVE") => {
    setStatusMsg(null);
    try {
      await apiRequest(`/categories/${cat._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingNames[cat._id] || cat.name,
          status: nextStatus || cat.status,
        }),
      });
      setStatusMsg({
        type: "success",
        text: `Đã cập nhật Category "${cat.code}" thành công!`,
      });
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Lỗi khi cập nhật Category.",
      });
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    setStatusMsg(null);
    try {
      await apiRequest(`/categories/${cat._id}`, {
        method: "DELETE",
      });
      setStatusMsg({
        type: "success",
        text: `Đã xóa Category "${cat.name}" thành công!`,
      });
      loadCategories();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text:
          err?.message ||
          "Không thể xóa Category đang có sản phẩm; chỉ được ngừng sử dụng (BR-02).",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
        <div className="text-xs">
          <strong className="text-amber-400 uppercase">
            Quy tắc Nghiệp vụ Category (BR-01 & BR-02):
          </strong>{" "}
          Không cho phép xóa vĩnh viễn Category đang có sản phẩm gắn kèm (`productCount &gt; 0`); chỉ cho phép chuyển trạng thái sang{" "}
          <strong>Ngừng sử dụng (INACTIVE)</strong>.
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Form thêm Category */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-end gap-4"
      >
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
            className="w-52 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs font-bold"
          />
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
            Tên Category *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Giày Chạy Bộ Chuyên Nghiệp"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Thêm Category
        </button>
      </form>

      {/* Bảng Category */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
          <FolderKanban className="w-5 h-5 text-emerald-600" />
          Danh sách Category ({categories.length})
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="py-3 px-4">Mã Category</th>
                <th className="py-3 px-4">Tên Category (Sửa trực tiếp)</th>
                <th className="py-3 px-4 text-center">Số sản phẩm</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categories.map((cat) => {
                const count = Number(cat.productCount || 0);
                return (
                  <tr key={cat._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {cat.code}
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
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold w-64"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat)}
                          className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                        >
                          Lưu tên
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-extrabold text-slate-800">
                      {count} SP
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          cat.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {cat.status === "ACTIVE"
                          ? "Đang dùng (ACTIVE)"
                          : "Ngừng sử dụng (INACTIVE)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCategory(
                            cat,
                            cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${
                          cat.status === "ACTIVE"
                            ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                            : "bg-emerald-100 hover:bg-emerald-200 text-emerald-900"
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
                        className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${
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

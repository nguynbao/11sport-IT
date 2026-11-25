"use client";


import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import {
AlertCircle,
CheckCircle2,
CheckSquare,
Loader2,
Lock,
Pencil,
Plus,
Power,
Search,
ShieldAlert,
Square,
Tags,
Trash2,
X,
} from "lucide-react";
import { exportBrands } from "../exports";
import { useBrandModule } from "../hooks/useBrandModule";


export default function BrandModule() {
  const vm = useBrandModule();
  const {
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
  } = vm;

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


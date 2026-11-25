"use client";

import { ServiceOrderStatus } from "@/shared/types";
import { formatNumberDots,formatVND,parseNumberDots } from "@/shared/utils/format";
import {
Edit3,
Plus,
Power,
Search,
Trash2
} from "lucide-react";
import { ServiceManagementViewModel } from "../hooks/useServiceManagement";
const STATUS_INFO: Record<
  ServiceOrderStatus,
  { label: string; badgeCls: string }
> = {
  RECEIVED: {
    label: "Đã tiếp nhận",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-200",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-300",
  },
  READY: {
    label: "Đã xong (Chờ lấy)",
    badgeCls: "bg-teal-50 text-brand-ink border-teal-300",
  },
  RETURNED: {
    label: "Đã trả khách",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeCls: "bg-red-50 text-red-600 border-red-200",
  },
};

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toInputDate(raw?: string | null): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ServiceTypesTab({ vm }: { vm: ServiceManagementViewModel }) {
  const {
    canManageServices,
    subTab,
    serviceTypes,
    loadingTypes,
    typeSearch,
    setTypeSearch,
    editingType,
    setEditingType,
    typeCode,
    setTypeCode,
    typeName,
    setTypeName,
    typeDefaultPrice,
    setTypeDefaultPrice,
    typeUnit,
    setTypeUnit,
    typeDesc,
    setTypeDesc,
    savingType,
    resetTypeForm,
    handleSaveServiceType,
    handleToggleTypeStatus,
    handleDeleteType,
  } = vm;

  return (
    <>
      {/* TAB 2: DANH MỤC LOẠI DỊCH VỤ */}
      {/* ================================================== */}
      {canManageServices && subTab === "TYPES" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* FORM TẠO / SỬA LOẠI DỊCH VỤ */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-100">
                {editingType
                  ? `Chỉnh sửa: ${editingType.name}`
                  : "Tạo Loại Dịch Vụ Mới"}
              </h2>

              <form onSubmit={handleSaveServiceType} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên loại dịch vụ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="VD: Đan vợt / Căng vợt cầu lông"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {!editingType && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mã dịch vụ (Tự sinh nếu để trống)
                    </label>
                    <input
                      type="text"
                      value={typeCode}
                      onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                      placeholder="VD: DV_DAN_VOT"
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Giá mặc định (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberDots(typeDefaultPrice)}
                      onChange={(e) =>
                        setTypeDefaultPrice(parseNumberDots(e.target.value))
                      }
                      className="w-full px-3 py-2 text-sm font-mono font-extrabold text-brand-ink bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đơn vị tính
                    </label>
                    <input
                      type="text"
                      value={typeUnit}
                      onChange={(e) => setTypeUnit(e.target.value)}
                      placeholder="Cây / Đôi / Lần"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả / Ghi chú
                  </label>
                  <textarea
                    rows={3}
                    value={typeDesc}
                    onChange={(e) => setTypeDesc(e.target.value)}
                    placeholder="Mô tả quy chuẩn dịch vụ..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {editingType && (
                    <button
                      type="button"
                      onClick={resetTypeForm}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingType}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {editingType ? "Lưu cập nhật" : "Tạo Loại Dịch Vụ"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* BẢNG DANH SÁCH LOẠI DỊCH VỤ */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Danh Sách Loại Dịch Vụ ({serviceTypes.length})
                </h2>
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    placeholder="Tìm mã hoặc tên dịch vụ..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase font-extrabold">
                      <th className="py-3 px-3">Mã DV</th>
                      <th className="py-3 px-3">Tên loại dịch vụ</th>
                      <th className="py-3 px-3 text-right">Giá mặc định</th>
                      <th className="py-3 px-3 text-center">ĐVT</th>
                      <th className="py-3 px-3 text-center">Số đơn</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingTypes ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Đang tải danh mục dịch vụ...
                        </td>
                      </tr>
                    ) : serviceTypes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Chưa có loại dịch vụ nào.
                        </td>
                      </tr>
                    ) : (
                      serviceTypes.map((st) => (
                        <tr key={st._id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            {st.code}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900">
                              {st.name}
                            </div>
                            {st.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {st.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-brand-ink">
                            {formatVND(st.defaultPrice)}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-600">
                            {st.unit || "Cây"}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {st.orderCount || 0}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                st.status === "ACTIVE"
                                  ? "bg-teal-50 text-brand-ink border border-teal-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {st.status === "ACTIVE"
                                ? "Đang hoạt động"
                                : "Ngừng sử dụng"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingType(st);
                                  setTypeCode(st.code);
                                  setTypeName(st.name);
                                  setTypeDefaultPrice(st.defaultPrice);
                                  setTypeUnit(st.unit || "Cây");
                                  setTypeDesc(st.description || "");
                                }}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                title="Sửa loại dịch vụ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleTypeStatus(st)}
                                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700"
                                title={
                                  st.status === "ACTIVE"
                                    ? "Ngừng sử dụng"
                                    : "Kích hoạt lại"
                                }
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteType(st)}
                                className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                                title="Xóa loại dịch vụ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

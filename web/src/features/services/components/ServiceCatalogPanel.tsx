"use client";

import React from "react";
import type { PosServiceState } from "../hooks/usePosService";
import { formatVND } from "@/shared/utils/format";
import { Plus } from "lucide-react";

export default function ServiceCatalogPanel({ s }: { s: PosServiceState }) {
  const {
    handleAddServiceType,
    loadingTypes,
    serviceTypes,
  } = s;

  return (
    <>
            {/* 1. CHỌN LOẠI DỊCH VỤ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                  1. Chọn Loại Dịch Vụ ({serviceTypes.length})
                </label>
                <span className="text-[11px] text-slate-500">
                  Bấm để thêm vào phiếu (sửa giá trực tiếp bên dưới)
                </span>
              </div>

              {loadingTypes ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  Đang tải danh mục dịch vụ...
                </div>
              ) : serviceTypes.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Chưa có loại dịch vụ nào hoạt động. Quản lý có thể tạo thêm loại dịch vụ trong trang CMS.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                  {serviceTypes.map((st) => (
                    <button
                      key={st._id}
                      type="button"
                      onClick={() => handleAddServiceType(st)}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/70 transition flex flex-col justify-between group bg-slate-50/70 cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 line-clamp-1">
                          {st.name}
                        </div>
                        {st.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {st.description}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-brand-ink">
                          {formatVND(st.defaultPrice)}/{st.unit || "Cây"}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-brand-ink">
                          <Plus className="w-3.5 h-3.5" /> Thêm
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
    </>
  );
}

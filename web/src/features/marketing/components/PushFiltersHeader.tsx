import React from "react";
import { Rocket, Calendar, RefreshCw } from "lucide-react";
import type { MarketingPushState } from "../hooks/useMarketingPushProducts";

export default function PushFiltersHeader({ p }: { p: MarketingPushState }) {
  const { categories, loading, fromDate, setFromDate, toDate, setToDate, categoryId, setCategoryId, quickRange, setQuickRange, pushFilter, setPushFilter, pushSearch, setPushSearch, handleSelectQuickRange, loadPushProducts, filteredPushProducts } = p;
  return (
      <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5" />
              Phân hệ Marketing & Chiến dịch Đẩy hàng — 11Sport
            </div>
            <h2 className="text-base sm:text-lg font-extrabold mt-0.5 text-slate-900">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Quan sát trực tiếp các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, hoặc đang nằm ở Kho Tầng 2 cần lên chiến dịch nội dung & khuyến mãi.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPushProducts}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
            Làm mới dữ liệu
          </button>
        </div>

        {/* Bộ lọc kỳ quan sát & Category */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-200 items-end">
          <div className="lg:col-span-6">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
              Chọn nhanh kỳ quan sát lượng bán
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "ALL", label: "Toàn thời gian" },
                  { id: "TODAY", label: "Hôm nay" },
                  { id: "YESTERDAY", label: "Hôm qua" },
                  { id: "7D", label: "7 ngày qua" },
                  { id: "30D", label: "30 ngày qua" },
                  { id: "MONTH", label: "Tháng này" },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectQuickRange(btn.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    quickRange === btn.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setQuickRange("ALL");
                  setFromDate(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setQuickRange("ALL");
                  setToDate(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Lọc theo Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả Category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-brand-ink font-bold">
              <Calendar className="w-3.5 h-3.5" />
              Kỳ đang quan sát:{" "}
              {fromDate || toDate
                ? `${fromDate ? fromDate.split("-").reverse().join("/") : "Đầu kỳ"} → ${
                    toDate ? toDate.split("-").reverse().join("/") : "Hiện tại"
                  }`
                : "Toàn thời gian"}
            </span>
          </div>
          {(fromDate || toDate || categoryId || pushFilter !== "ALL" || pushSearch) && (
            <button
              type="button"
              onClick={() => {
                setCategoryId("");
                setPushFilter("ALL");
                setPushSearch("");
                handleSelectQuickRange("ALL");
              }}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Xóa bộ lọc (Xem toàn bộ)
            </button>
          )}
        </div>
      </div>

  );
}

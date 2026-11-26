"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { formatVND } from "@/shared/utils/format";
import {
AlertTriangle,
Boxes,
Calendar,
ChevronLeft,
ChevronRight,
DollarSign,
RefreshCw,
Rocket,
Search,
Tag,
TrendingDown,
} from "lucide-react";
import { exportPushProducts } from "../exports";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { useMarketingPushProducts } from "../hooks/useMarketingPushProducts";

export default function MarketingPushProductsModule({
  onNavigateToInventory,
}: {
  onNavigateToInventory?: (searchCode?: string) => void;
}) {
  const {
    categories,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    categoryId,
    setCategoryId,
    quickRange,
    setQuickRange,
    pushFilter,
    setPushFilter,
    pushSearch,
    setPushSearch,
    pushPage,
    setPushPage,
    pushPageSize,
    setPushPageSize,
    handleSelectQuickRange,
    loadPushProducts,
    counts,
    filteredPushProducts,
    pushTotalPages,
    pagedPushProducts,
  } = useMarketingPushProducts(onNavigateToInventory);

  return (
    <div className="space-y-6">
      {/* HEADER & BỘ LỌC KỲ QUAN SÁT */}
      <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-brand-ink flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5" />
              Phân hệ Marketing & Chiến dịch Đẩy hàng — 11Sport
            </div>
            <h2 className="text-lg font-extrabold mt-0.5 text-slate-900">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Quan sát trực tiếp các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, hoặc đang nằm ở Kho Tầng 2 cần lên chiến dịch nội dung & khuyến mãi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPushProducts}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
              Làm mới dữ liệu
            </button>
            {filteredPushProducts.length > 0 && (
              <ExportExcelButton
                label="Xuất Excel SP Cần đẩy mạnh"
                onExport={() => exportPushProducts(filteredPushProducts, fromDate, toDate)}
              />
            )}
          </div>
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
                      ? "bg-teal-600 text-white shadow-xs"
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
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-teal-500 focus:outline-none"
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
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-teal-500 focus:outline-none"
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
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:border-teal-500 focus:outline-none"
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-brand-ink font-bold">
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

      {/* 4 THẺ KPI TỔNG QUAN CHO MARKETING */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setPushFilter("ALL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ALL" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              1. Tổng SP Cần Đẩy Mạnh
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Rocket className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {counts.all} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng lượng tồn cần đẩy: <strong className="text-slate-800">{counts.totalStock}</strong> sản phẩm
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("ZERO_SALES")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "ZERO_SALES" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              2. Chưa Bán Được Chiếc Nào
            </span>
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 mt-2">
            {counts.zeroSales} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            SL bán trong kỳ = 0 · Cần chạy nội dung / khuyến mãi
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("HIGH_CAPITAL")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "HIGH_CAPITAL" ? "border-amber-600 ring-2 ring-amber-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              3. Đọng Vốn Cao (≥ 2tr)
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-800 mt-2">
            {counts.highCapital} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng vốn tồn đọng: <strong className="text-amber-800 font-mono">{formatVND(counts.totalCapital)}</strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPushFilter("FLOOR2_ONLY")}
          className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition cursor-pointer ${
            pushFilter === "FLOOR2_ONLY" ? "border-purple-600 ring-2 ring-purple-600/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500">
              4. Nằm Ở Kho Tầng 2 (T1 = 0)
            </span>
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-700 mt-2">
            {counts.floor2Only} mặt hàng
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Chưa có hàng trưng bày tại Showroom Tầng 1
          </div>
        </button>
      </div>

      {/* BẢNG CHI TIẾT CÁC SẢN PHẨM ĐANG CẦN ĐẨY MẠNH (MỞ HOÀN TOÀN CHO MARKETING QUAN SÁT) */}
      <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 mb-1">
              <Rocket className="w-3.5 h-3.5 text-amber-600" />
              CẦN ĐẨY MẠNH BÁN HÀNG / TỐI ƯU KHO
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h3>
            <p className="text-xs text-slate-500">
              Hệ thống tự động phát hiện các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, đang nằm ở Kho Tầng 2 mà Tầng 1 = 0, hoặc chưa đặt giá niêm yết.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={pushSearch}
                onChange={(e) => setPushSearch(e.target.value)}
                placeholder="Tìm mã, tên SP hoặc danh mục..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <select
              value={pushFilter}
              onChange={(e) => setPushFilter(e.target.value as typeof pushFilter)}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-xs font-bold text-slate-900"
            >
              <option value="ALL">Tất cả SP cần đẩy mạnh ({counts.all})</option>
              <option value="ZERO_SALES">Chưa bán được chiếc nào ({counts.zeroSales})</option>
              <option value="HIGH_CAPITAL">Đọng vốn cao ≥ 2tr ({counts.highCapital})</option>
              <option value="FLOOR2_ONLY">Tầng 1 = 0, nằm ở Tầng 2 ({counts.floor2Only})</option>
              <option value="NO_PRICE">Chưa đặt giá niêm yết ({counts.noPrice})</option>
            </select>

            <select
              value={pushPageSize}
              onChange={(e) => setPushPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value={10}>10 dòng / trang</option>
              <option value={15}>15 dòng / trang</option>
              <option value={30}>30 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table data-cards className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-3">Mã & Tên sản phẩm</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Tồn kho hiện tại</th>
                <th className="py-3 px-3 text-right">Đã bán trong kỳ</th>
                <th className="py-3 px-3 text-right">Giá vốn / Giá niêm yết</th>
                <th className="py-3 px-3 text-right bg-amber-950 text-amber-300">
                  Vốn đang đọng
                </th>
                <th className="py-3 px-3">Lý do cần đẩy mạnh</th>
                <th className="py-3 px-3">Đề xuất hành động Marketing / Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-semibold">
                    Đang tải danh sách sản phẩm cần đẩy mạnh...
                  </td>
                </tr>
              ) : pagedPushProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Không có sản phẩm nào khớp với điều kiện lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pagedPushProducts.map((p, idx) => (
                  <tr
                    key={p.productId || p.productCode}
                    className="hover:bg-amber-50/30 transition"
                  >
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                      {(pushPage - 1) * pushPageSize + idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{p.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {p.productCode}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="font-extrabold text-slate-900">
                        {p.stock} {p.unit}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        🏢 T1: <b className="text-brand-ink">{p.stockFloor1}</b> · 🏬 T2:{" "}
                        <b className="text-purple-700">{p.stockFloor2}</b>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      {p.netSoldQty} {p.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="text-slate-600">Gốc: {formatVND(p.costPrice)}</div>
                      <div className="font-bold text-brand-ink">
                        Bán: {formatVND(p.sellingPrice)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                      {formatVND(p.inventoryCostValue)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        {p.pushReasons.map((reason, rIdx) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold text-[11px]"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[11px] font-semibold text-slate-800">
                        💡 {p.suggestedAction}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {filteredPushProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600">
            <span>
              Hiển thị{" "}
              <strong>
                {(pushPage - 1) * pushPageSize + 1}–
                {Math.min(pushPage * pushPageSize, filteredPushProducts.length)}
              </strong>{" "}
              trên tổng <strong>{filteredPushProducts.length}</strong> sản phẩm cần đẩy mạnh
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pushPage <= 1}
                onClick={() => setPushPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <span className="px-3 py-1.5 font-mono font-bold text-slate-900">
                Trang {pushPage} / {pushTotalPages}
              </span>
              <button
                type="button"
                disabled={pushPage >= pushTotalPages}
                onClick={() => setPushPage((p) => Math.min(pushTotalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                Tiếp <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


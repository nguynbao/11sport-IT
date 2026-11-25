"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import {
Plus,
Printer,
RotateCcw,
Save,
ScanBarcode,
Search,
X
} from "lucide-react";
import { exportProducts } from "../exports";
import { InventoryViewModel } from "../hooks/useInventoryModule";
import { QuickStockFilter } from "../types";

import { InventoryProductsTable } from "./InventoryProductsTable";
import { InventoryScannerPanel } from "./InventoryScannerPanel";

export function InventoryProductsTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    activeWarehouse,
    showZeroFloorItems,
    setShowZeroFloorItems,
    quickStockFilter,
    setQuickStockFilter,
    showScannerPanel,
    setShowScannerPanel,
    products,
    categories,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    brandFilter,
    setBrandFilter,
    brandOptions,
    setProdPage,
    prodPageSize,
    setProdPageSize,
    setShowAdminImportModal,
    canSeeCost,
    scannedCheckCounts,
    savingBatch,
    changedProducts,
    handleResetProductEdits,
    handleSaveAllProductChanges,
    handleOpenPrintLabelsForDisplayed,
    displayedProducts,
    totalStockQty,
    activeWarehouseLabel,
    prodTotalPages,
    safeProdPage,
    renderPaginationBar,
  } = vm;

  return (
    <>
      {/* SUB-TAB 1: SẢN PHẨM, SỐ LƯỢNG, GIÁ GỐC & GIÁ BÁN LẺ */}
      {subTab === "PRODUCTS" && (
        <div className="space-y-6">
          {/* Bảng danh sách sản phẩm: Chia rõ Kho Tầng 1 & Kho Tầng 2 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            {/* Hàng 1: Tiêu đề + Cụm nút tác vụ chính */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex flex-wrap items-center gap-2">
                  <span>Danh mục Sản phẩm — {activeWarehouseLabel}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-brand-ink">
                    {displayedProducts.length} mặt hàng · {totalStockQty.toLocaleString("vi-VN")} đơn vị
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeWarehouse === "FLOOR_1"
                    ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 1. Bấm sang tab 'Kho Tầng 2' ở trên để quản lý riêng Kho Tầng 2."
                    : activeWarehouse === "FLOOR_2"
                      ? "Đang xem và chỉnh sửa trực tiếp tồn kho tại Kho Tầng 2. Có thể bật 'Hiện cả SP ngoài Tầng 2' nếu muốn nhập số lượng Tầng 2 cho các mã hàng khác."
                      : "Đang xem gộp cả 2 kho: có thể chỉnh sửa riêng cột Tồn Kho Tầng 1 và Tồn Kho Tầng 2 trên cùng một dòng."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminImportModal(true)}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="Mở cửa sổ Nhập kho nhanh dành cho Admin"
                >
                  <Plus className="w-4 h-4" />
                  Nhập kho
                </button>
                {changedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                    title="Hoàn tác các thay đổi chưa lưu"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác ({changedProducts.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAllProductChanges}
                  disabled={changedProducts.length === 0 || savingBatch}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition ${
                    changedProducts.length > 0 && !savingBatch
                      ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md ring-2 ring-teal-200 cursor-pointer"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                  title={
                    changedProducts.length > 0
                      ? `Lưu toàn bộ ${changedProducts.length} sản phẩm đã thay đổi`
                      : "Chưa có thay đổi nào về số lượng hoặc thông tin sản phẩm"
                  }
                >
                  <Save className="w-4 h-4" />
                  {savingBatch
                    ? "Đang lưu..."
                    : changedProducts.length > 0
                      ? `Lưu thay đổi (${changedProducts.length} SP)`
                      : "Lưu thay đổi"}
                </button>
                <button
                  type="button"
                  disabled={displayedProducts.length === 0}
                  onClick={handleOpenPrintLabelsForDisplayed}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="In tem nhãn mã vạch"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Tem Label
                </button>
                <ExportExcelButton
                  onExport={() => exportProducts(displayedProducts, { hideCost: !canSeeCost })}
                  disabled={displayedProducts.length === 0}
                />
                <button
                  type="button"
                  onClick={() => setShowScannerPanel((v) => !v)}
                  className={`px-3 py-2 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    showScannerPanel || Object.keys(scannedCheckCounts).length > 0
                      ? "bg-teal-50 border-teal-400 text-teal-900"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Bật/tắt khung Máy quét Label kiểm hàng"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-brand-ink" />
                  <span>
                    Máy quét kiểm kho
                    {Object.keys(scannedCheckCounts).length > 0
                      ? ` (${Object.keys(scannedCheckCounts).length})`
                      : ""}
                  </span>
                </button>
              </div>
            </div>

            {/* Hàng 2: Thanh tìm kiếm + Bộ lọc Category/Brand + Quick Filter Chips */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã gốc, mã con, tên, ghi chú..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.skuCode ? `[${c.skuCode}] ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Lọc theo thương hiệu"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả Thương hiệu</option>
                  {brandOptions
                    .filter((b) => !categoryId || b.isSystem || (b.categoryIds || []).map(String).includes(categoryId))
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        [{b.code}] {b.name}
                      </option>
                    ))}
                </select>
                {activeWarehouse !== "ALL" && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showZeroFloorItems}
                      onChange={(e) => setShowZeroFloorItems(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Hiện cả SP ngoài {activeWarehouse === "FLOOR_2" ? "Tầng 2" : "Tầng 1"} ({products.length} SP)
                  </label>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: "Tất cả" },
                    { id: "IN_STOCK", label: "Còn hàng (>0)" },
                    { id: "ZERO_STOCK", label: "Hết hàng (=0)" },
                    { id: "MISSING_PRICE", label: "Chưa có giá" },
                    ...(changedProducts.length > 0
                      ? [{ id: "CHANGED" as QuickStockFilter, label: `Đang sửa (${changedProducts.length})` }]
                      : []),
                  ] as { id: QuickStockFilter; label: string }[]
                ).map((chip) => {
                  const active = quickStockFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setQuickStockFilter(chip.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        active
                          ? "bg-teal-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                {(search || categoryId || brandFilter || quickStockFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategoryId("");
                      setBrandFilter("");
                      setQuickStockFilter("ALL");
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Xoá lọc
                  </button>
                )}
              </div>
            </div>

      <InventoryScannerPanel vm={vm} />
      <InventoryProductsTable vm={vm} />

            {changedProducts.length > 0 && (
              <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white text-slate-900 shadow-xl border-2 border-teal-300">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold font-mono">
                    {changedProducts.length} SP
                  </span>
                  <span className="text-slate-700">
                    đang có thay đổi số lượng tồn kho / giá chưa lưu. Bấm <strong>Lưu thay đổi</strong> để cập nhật toàn bộ cùng lúc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetProductEdits}
                    disabled={savingBatch}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllProductChanges}
                    disabled={changedProducts.length === 0 || savingBatch}
                    className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    {savingBatch ? "Đang lưu..." : `Lưu thay đổi (${changedProducts.length} SP)`}
                  </button>
                </div>
              </div>
            )}

            {renderPaginationBar({
              totalItems: displayedProducts.length,
              page: safeProdPage,
              totalPages: prodTotalPages,
              pageSize: prodPageSize,
              onPageChange: setProdPage,
              onPageSizeChange: setProdPageSize,
              itemLabel: "mặt hàng trong kho",
            })}
          </div>
        </div>
      )}

    </>
  );
}


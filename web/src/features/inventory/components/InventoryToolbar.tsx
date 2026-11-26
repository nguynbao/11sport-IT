import { Search, Filter, RefreshCw, Save, Printer, ScanBarcode } from "lucide-react";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "search" | "setSearch" | "selectedCategory" | "setSelectedCategory" | "categories" | "brandFilter" | "setBrandFilter" | "brandOptions" | "showScannerPanel" | "setShowScannerPanel" | "scannedCheckCounts" | "displayedProducts" | "expandProductToPrintLabelItems" | "setLabelModalItems" | "canSeeCostPrice" | "changedPriceProducts" | "setPriceEdits" | "savingBatch" | "handleSaveAllPriceChanges" | "loadInventory">;

export default function InventoryToolbar({ search, setSearch, selectedCategory, setSelectedCategory, categories, brandFilter, setBrandFilter, brandOptions, showScannerPanel, setShowScannerPanel, scannedCheckCounts, displayedProducts, expandProductToPrintLabelItems, setLabelModalItems, canSeeCostPrice, changedPriceProducts, setPriceEdits, savingBatch, handleSaveAllPriceChanges, loadInventory }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã SP, tên, màu, size, ghi chú..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 shrink-0 text-slate-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-blue-600 focus:outline-none"
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
            className="flex-1 sm:flex-none min-w-0 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-blue-600 focus:outline-none"
          >
            <option value="">Tất cả Thương hiệu</option>
            {brandOptions
              .filter((b) => !selectedCategory || b.isSystem || (b.categoryIds || []).map(String).includes(selectedCategory))
              .map((b) => (
                <option key={b._id} value={b._id}>
                  [{b.code}] {b.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-start md:self-auto">
        <button
          type="button"
          onClick={() => setShowScannerPanel((v) => !v)}
          className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            showScannerPanel || Object.keys(scannedCheckCounts).length > 0
              ? "bg-blue-50 border-blue-400 text-blue-900"
              : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <ScanBarcode className="w-4 h-4 text-brand-ink" />
          <span>
            Máy quét kiểm kho
            {Object.keys(scannedCheckCounts).length > 0
              ? ` (${Object.keys(scannedCheckCounts).length})`
              : ""}
          </span>
        </button>

        {displayedProducts.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setLabelModalItems(
                displayedProducts.flatMap((p) => expandProductToPrintLabelItems(p))
              )
            }
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>In Tem ({displayedProducts.length})</span>
          </button>
        )}

        {canSeeCostPrice && (
          <>
            {changedPriceProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setPriceEdits({})}
                disabled={savingBatch}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition"
              >
                Hoàn tác ({changedPriceProducts.length})
              </button>
            )}
            <button
              type="button"
              disabled={changedPriceProducts.length === 0 || savingBatch}
              onClick={handleSaveAllPriceChanges}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm ${
                changedPriceProducts.length > 0
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {savingBatch
                ? "Đang lưu..."
                : changedPriceProducts.length > 0
                  ? `Lưu thay đổi (${changedPriceProducts.length})`
                  : "Lưu thay đổi"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={loadInventory}
          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Làm mới
        </button>
      </div>
    </div>
  );
}

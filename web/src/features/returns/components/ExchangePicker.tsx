import { Search, Plus, X, RefreshCw } from "lucide-react";
import { formatVND } from "@/shared/utils/format";
import { exchangeUnitPrice } from "../types";
import type { ReturnCtx } from "./returnCtx";

type Props = Pick<ReturnCtx, "reloadSellableProducts" | "loadingProducts" | "exchangeSearch" | "setExchangeSearch" | "handleExchangeSearchKeyDown" | "filteredExchangeOptions" | "exchangeOptions" | "selectedQtyByOptionKey" | "handleAddExchangeOption">;

export default function ExchangePicker({ reloadSellableProducts, loadingProducts, exchangeSearch, setExchangeSearch, handleExchangeSearchKeyDown, filteredExchangeOptions, exchangeOptions, selectedQtyByOptionKey, handleAddExchangeOption }: Props) {
  return (
    <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-bold text-slate-900 text-sm">
          2. Tìm & chọn sản phẩm mới xuất kho đổi cho khách (Kho Tầng 1):
        </h3>
        <p className="text-[11px] text-slate-600">
          Gõ tên sản phẩm, mã SP, mã vạch / mã biến thể, màu sắc hoặc size để tìm nhanh (hoặc quét mã vạch và nhấn Enter).
        </p>
      </div>
      <button
        type="button"
        onClick={reloadSellableProducts}
        disabled={loadingProducts}
        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? "animate-spin" : ""}`} />
        {loadingProducts ? "Đang tải..." : "Làm mới tồn kho"}
      </button>
    </div>

    {/* Ô Input Search sản phẩm để đổi */}
    <div className="relative">
      <Search className="w-4 h-4 text-brand-ink absolute left-3.5 top-3.5 pointer-events-none" />
      <input
        type="text"
        value={exchangeSearch}
        onChange={(e) => setExchangeSearch(e.target.value)}
        onKeyDown={handleExchangeSearchKeyDown}
        placeholder="Tìm sản phẩm đổi theo tên, mã SP, mã vạch, màu sắc, size..."
        className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-blue-300 bg-white text-sm font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
      />
      {exchangeSearch && (
        <button
          type="button"
          onClick={() => setExchangeSearch("")}
          className="w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 absolute right-2 top-1.5 rounded-lg hover:bg-slate-100"
          title="Xóa từ khóa"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* Danh sách kết quả gợi ý sản phẩm đổi */}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
        <span className="font-semibold">
          {exchangeSearch.trim()
            ? `Kết quả khớp "${exchangeSearch.trim()}" (${filteredExchangeOptions.length})`
            : `Gợi ý sản phẩm sẵn sàng xuất đổi tại Kho Tầng 1 (${exchangeOptions.length} phân loại)`}
        </span>
        {exchangeSearch.trim() && filteredExchangeOptions.length > 0 && (
          <span className="text-brand-ink font-semibold hidden sm:inline">
            Nhấn Enter để thêm nhanh kết quả đầu tiên
          </span>
        )}
      </div>

      {loadingProducts && exchangeOptions.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500">
          Đang tải danh sách sản phẩm Kho Tầng 1...
        </div>
      ) : filteredExchangeOptions.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500">
          {exchangeSearch.trim()
            ? `Không tìm thấy sản phẩm nào tại Kho Tầng 1 khớp với "${exchangeSearch.trim()}".`
            : "Hiện không có sản phẩm nào còn tồn khả dụng tại Kho Tầng 1."}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
          {filteredExchangeOptions.map((opt) => {
            const chosenQty = selectedQtyByOptionKey.get(opt.optionKey) || 0;
            const outOfRemaining = chosenQty >= opt.stockFloor1;
            return (
              <div
                key={opt.optionKey}
                className="px-3 py-2.5 hover:bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>{opt.product.name}</span>
                    {opt.color && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800">
                        {opt.colorHexes.length > 0 && (
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: opt.colorHexes[0] }}
                          />
                        )}
                        Màu: {opt.color}
                      </span>
                    )}
                    {opt.size && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-brand-ink">
                        Size: {opt.size}
                      </span>
                    )}
                    {chosenQty > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-brand-ink text-[10px] font-extrabold">
                        Đã chọn: {chosenQty}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="font-mono font-semibold text-slate-700">
                      {opt.variantCode}
                    </span>
                    {opt.product.brand && <span>· {opt.product.brand}</span>}
                    {opt.product.categoryName && (
                      <span>· {opt.product.categoryName}</span>
                    )}
                    <span className="text-brand-ink font-semibold">
                      · Tồn T1: {opt.directFloor1}
                      {opt.unpackableFloor1 > 0
                        ? ` (+${opt.unpackableFloor1} tách bộ)`
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="font-mono font-extrabold text-xs sm:text-sm text-brand-ink">
                    {formatVND(exchangeUnitPrice(opt))}
                  </span>
                  <button
                    type="button"
                    disabled={outOfRemaining}
                    onClick={() => handleAddExchangeOption(opt)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {outOfRemaining ? "Đã tối đa tồn" : "Chọn đổi"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}

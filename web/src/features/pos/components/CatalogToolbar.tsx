import { formatPhone, cleanPhoneDigits } from "@/shared/utils/format";
import { Search, Plus, LayoutGrid, Filter, List } from "lucide-react";
import type { PosCtx } from "../hooks/usePosTab";

type CatalogToolbarProps = Pick<
  PosCtx,
  "customerPhone" | "phoneTypedByUserRef" | "setCustomerPhone"
  | "setIsExistingCustomer" | "setCustomerOrders" | "setCustomerDebtSummary"
  | "setShowCheckoutDrawer" | "setCatalogViewMode" | "setCatalogPage"
  | "catalogViewMode" | "setShowCategoryFilterPopover" | "selectedCategoryId"
  | "showCategoryFilterPopover" | "setSortBy" | "customerName" | "setCustomerName"
  | "lookingUp" | "isExistingCustomer" | "customerOrders" | "setSelectedCategoryId"
  | "floor1Products" | "categories" | "getCategoryId"
>;

export function CatalogToolbar({
  customerPhone,
  phoneTypedByUserRef,
  setCustomerPhone,
  setIsExistingCustomer,
  setCustomerOrders,
  setCustomerDebtSummary,
  setShowCheckoutDrawer,
  setCatalogViewMode,
  setCatalogPage,
  catalogViewMode,
  setShowCategoryFilterPopover,
  selectedCategoryId,
  showCategoryFilterPopover,
  setSortBy,
  customerName,
  setCustomerName,
  lookingUp,
  isExistingCustomer,
  customerOrders,
  setSelectedCategoryId,
  floor1Products,
  categories,
  getCategoryId,
}: CatalogToolbarProps) {
  return (
    <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          phoneTypedByUserRef.current = true;
                          const formatted = formatPhone(e.target.value);
                          setCustomerPhone(formatted);
                          if (cleanPhoneDigits(formatted).length < 9) {
                            setIsExistingCustomer(false);
                            setCustomerOrders([]);
                            setCustomerDebtSummary(null);
                          }
                        }}
                        placeholder="Tìm khách hàng (F4)"
                        className="w-full h-9 pl-8 pr-8 rounded-lg bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-blue-600 font-mono text-xs sm:text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCheckoutDrawer(true)}
                        title="Nhập chi tiết tên khách hàng & thanh toán"
                        className="absolute right-2 top-2 text-slate-500 hover:text-brand-ink"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cụm 3 icon chuẩn KiotViet: Đổi chế độ hiển thị, Lọc Danh mục, Sắp xếp */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogViewMode((prev) =>
                            prev === "COMPACT" ? "DETAILED" : "COMPACT"
                          );
                          setCatalogPage(1);
                        }}
                        title={
                          catalogViewMode === "COMPACT"
                            ? "Đang ở chế độ Lưới 3 cột chuẩn KiotViet (Bấm để xem thẻ chi tiết)"
                            : "Đang ở chế độ Thẻ chi tiết (Bấm để về lưới gọn 3 cột)"
                        }
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                          catalogViewMode === "DETAILED"
                            ? "bg-blue-50 border-blue-300 text-brand-ink"
                            : "border-transparent hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShowCategoryFilterPopover((prev) => !prev)
                        }
                        title="Lọc theo Danh mục hàng hóa"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                          selectedCategoryId || showCategoryFilterPopover
                            ? "bg-blue-50 border-blue-300 text-brand-ink"
                            : "border-transparent hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSortBy((prev) =>
                            prev === "NAME_ASC"
                              ? "PRICE_ASC"
                              : prev === "PRICE_ASC"
                                ? "STOCK_DESC"
                                : "NAME_ASC"
                          );
                          setCatalogPage(1);
                        }}
                        title="Đổi cách sắp xếp sản phẩm"
                        className="w-9 h-9 rounded-lg flex items-center justify-center border border-transparent hover:bg-slate-100 text-slate-600 transition"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nếu đã nhập SĐT khách hoặc có tên khách -> hiển thị dòng tên khách nhỏ gọn */}
                  {(customerPhone || customerName) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={
                          lookingUp
                            ? "Đang tìm khách..."
                            : "Nhập họ tên khách hàng *"
                        }
                        className="flex-1 h-8 px-2.5 rounded-md bg-blue-50/60 border border-blue-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      {isExistingCustomer && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-brand-ink shrink-0">
                          Khách quen ({customerOrders.length})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Thanh chọn nhanh Danh mục (mở khi bấm nút Filter hoặc đang chọn danh mục) */}
                  {(showCategoryFilterPopover || selectedCategoryId !== "") && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1.5 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId("");
                          setCatalogPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
                          selectedCategoryId === ""
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        Tất cả ({floor1Products.length})
                      </button>
                      {categories.map((cat) => {
                        const count = floor1Products.filter(
                          (p) => getCategoryId(p) === cat._id
                        ).length;
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(cat._id);
                              setCatalogPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
                              selectedCategoryId === cat._id
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50"
                            }`}
                          >
                            {cat.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
  );
}

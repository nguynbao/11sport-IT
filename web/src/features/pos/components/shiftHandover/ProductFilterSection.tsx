import { X, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import type { CheckProduct, UnitStat } from "../../utils/shiftHandover";

interface Props {
  allCheckProducts: CheckProduct[];
  filteredCheckProducts: CheckProduct[];
  filteredTotalQty: number;
  unitStats: UnitStat[];
  checkedCategories: string[];
  selectedUnitFilter: string;
  selectedCategoryFilter: string;
  productSearch: string;
  showProductFilterSection: boolean;
  setSelectedUnitFilter: (v: string) => void;
  setSelectedCategoryFilter: (v: string) => void;
  setProductSearch: (v: string) => void;
  setShowProductFilterSection: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ProductFilterSection({
  allCheckProducts,
  filteredCheckProducts,
  filteredTotalQty,
  unitStats,
  checkedCategories,
  selectedUnitFilter,
  selectedCategoryFilter,
  productSearch,
  showProductFilterSection,
  setSelectedUnitFilter,
  setSelectedCategoryFilter,
  setProductSearch,
  setShowProductFilterSection,
}: Props) {
  return (
    <>
              <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowProductFilterSection((v) => !v)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between gap-2 text-xs font-extrabold text-slate-800 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-brand-ink" />
                    <span>Lọc Sản Phẩm Kiểm Tầng 1 Theo ĐVT ({allCheckProducts.length} mã)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    {selectedUnitFilter !== "ALL" && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-brand-ink">
                        ĐVT: {selectedUnitFilter}
                      </span>
                    )}
                    {showProductFilterSection ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {showProductFilterSection && (
                  <div className="p-3.5 space-y-3 border-t border-slate-200">
                    {/* Nút lọc nhanh theo ĐVT */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedUnitFilter("ALL")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          selectedUnitFilter === "ALL"
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Tất cả ĐVT ({allCheckProducts.filter((p) => selectedCategoryFilter === "ALL" || String(p.categoryName || "").trim() === selectedCategoryFilter).length} mã)
                      </button>
                      {unitStats.map((u) => {
                        const active = selectedUnitFilter === u.unit;
                        return (
                          <button
                            key={u.unit}
                            type="button"
                            onClick={() => setSelectedUnitFilter(u.unit)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              active
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                            }`}
                          >
                            {u.unit} · <span className="font-mono">{u.totalQty}</span> ({u.productCount} mã)
                          </button>
                        );
                      })}
                    </div>

                    {/* Tìm kiếm nhanh + lọc nhóm */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Tìm theo mã hoặc tên sản phẩm..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        {productSearch && (
                          <button
                            type="button"
                            onClick={() => setProductSearch("")}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {checkedCategories.length > 1 && (
                        <select
                          value={selectedCategoryFilter}
                          onChange={(e) => {
                            setSelectedCategoryFilter(e.target.value);
                            setSelectedUnitFilter("ALL");
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-500"
                        >
                          <option value="ALL">Tất cả nhóm</option>
                          {checkedCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      )}

                      <div className="text-[11px] font-bold text-slate-600 ml-auto">
                        Tổng lọc:{" "}
                        <span className="font-mono text-brand-ink">
                          {filteredTotalQty}{" "}
                          {selectedUnitFilter !== "ALL" ? selectedUnitFilter : "SP"}
                        </span>{" "}
                        ({filteredCheckProducts.length} mã)
                      </div>
                    </div>

                    {/* Danh sách chi tiết sản phẩm */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {filteredCheckProducts.length === 0 ? (
                        <div className="py-5 text-center text-xs text-slate-400">
                          Không có sản phẩm nào khớp bộ lọc ĐVT / từ khóa hiện tại.
                        </div>
                      ) : (
                        <>
                          {/* Mobile: danh sách thẻ gọn hiển thị đủ Mã SP, Tên, Nhóm, ĐVT và Số lượng */}
                          <div className="md:hidden divide-y divide-slate-100">
                            {filteredCheckProducts.map((p) => (
                              <div key={p._id} className="px-3 py-2 bg-white space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-[11px] font-bold text-slate-700 truncate">
                                      {p.code}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600 shrink-0">
                                      {p.categoryName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-xs font-extrabold text-brand-ink">
                                      {p.stockQtyFloor1}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200/70 text-[10px] font-bold text-slate-700">
                                      {p.unit || "Cái"}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-slate-900 leading-snug">
                                  {p.name}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop: bảng 5 cột */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sticky top-0">
                                <tr>
                                  <th className="py-2 px-2.5">Mã SP</th>
                                  <th className="py-2 px-2.5">Tên sản phẩm</th>
                                  <th className="py-2 px-2.5">Nhóm</th>
                                  <th className="py-2 px-2.5 text-center">ĐVT</th>
                                  <th className="py-2 px-2.5 text-right">Tồn T1</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredCheckProducts.map((p) => (
                                  <tr key={p._id} className="hover:bg-slate-50/80">
                                    <td className="py-1.5 px-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                                      {p.code}
                                    </td>
                                    <td className="py-1.5 px-2.5 font-semibold text-slate-900">
                                      {p.name}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                      {p.categoryName}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                        {p.unit || "Cái"}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-brand-ink whitespace-nowrap">
                                      {p.stockQtyFloor1}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
    </>
  );
}

import { Plus, Minus } from "lucide-react";
import type { DailyHandoverCategorySummary } from "@/shared/types";

interface Props {
  date?: string;
  checkedCategories: string[];
  loading: boolean;
  summaries: DailyHandoverCategorySummary[];
  actualTotals: Record<string, number>;
  unitBreakdownByCategory: Map<string, Array<{ unit: string; totalQty: number }>>;
  setSelectedCategoryFilter: (v: string) => void;
  setSelectedUnitFilter: (v: string) => void;
  setShowProductFilterSection: (v: boolean) => void;
  handleAdjustTotal: (key: string, delta: number) => void;
  handleDirectTotalChange: (key: string, rawVal: string) => void;
}

export default function CategoryTotalsSection({
  date,
  checkedCategories,
  loading,
  summaries,
  actualTotals,
  unitBreakdownByCategory,
  setSelectedCategoryFilter,
  setSelectedUnitFilter,
  setShowProductFilterSection,
  handleAdjustTotal,
  handleDirectTotalChange,
}: Props) {
  return (
    <>
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-blue-950">
                  1. Tổng Số Lượng Mặt Hàng Kiểm Hôm Nay ({date || "Hôm nay"})
                </div>
                <p className="text-[11px] text-brand-ink mt-0.5">
                  Chỉ cần nhập <b>tổng số lượng</b> của từng nhóm (đã gộp tất cả mã, size, màu tại Tầng 1):
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-extrabold shrink-0">
                {checkedCategories.join(" + ") || "Vợt"}
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Đang tải tổng số lượng mặt hàng kiểm hôm nay...
              </div>
            ) : (
              <div className="space-y-2.5">
                {summaries.map((item) => {
                  const key = item.categoryCode || item.categoryName;
                  const expected = item.expectedTotalQty;
                  const actual = actualTotals[key] ?? 0;
                  const diff = actual - expected;
                  const isDiff = diff !== 0;

                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-2xl border transition ${
                        isDiff
                          ? "bg-amber-50/70 border-amber-300"
                          : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                                item.isPrimaryCategory
                                  ? "bg-blue-600 text-white"
                                  : "bg-blue-600 text-white"
                              }`}
                            >
                              {item.categoryName}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Tổng tất cả size, màu ({item.productCount} mã)
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
                            <span className="text-slate-600">
                              Tồn Tầng 1 để đối chiếu:{" "}
                              <b className="font-mono text-sm text-slate-900">
                                {expected}
                              </b>{" "}
                              {item.unit || "Cái"}
                            </span>
                            {isDiff ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                                {diff > 0
                                  ? `Thừa +${diff} ${item.unit || "Cái"}`
                                  : `Thiếu ${diff} ${item.unit || "Cái"}`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-brand-ink font-bold text-[11px]">
                                Khớp tồn Tầng 1
                              </span>
                            )}
                          </div>

                          {/* Phân rã nhanh theo từng ĐVT nếu nhóm có nhiều ĐVT */}
                          {(unitBreakdownByCategory.get(item.categoryName)?.length || 0) > 1 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-slate-500 font-semibold">Theo ĐVT:</span>
                              {unitBreakdownByCategory.get(item.categoryName)?.map((ub) => (
                                <button
                                  key={ub.unit}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategoryFilter(item.categoryName);
                                    setSelectedUnitFilter(ub.unit);
                                    setShowProductFilterSection(true);
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-blue-400 text-slate-700 font-mono font-bold transition cursor-pointer"
                                  title={`Lọc danh sách theo ĐVT ${ub.unit}`}
                                >
                                  {ub.totalQty} {ub.unit}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Ô nhập tổng số lượng thực đếm */}
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 mb-1">
                            Tổng thực đếm
                          </span>
                          <div className="flex items-center gap-1 bg-white border border-slate-300 p-1 rounded-xl shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleAdjustTotal(key, -1)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actual}
                              onChange={(e) => handleDirectTotalChange(key, e.target.value)}
                              className={`w-16 text-center font-mono text-sm font-black bg-transparent outline-none ${
                                isDiff ? "text-amber-700" : "text-brand-ink"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustTotal(key, 1)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
    </>
  );
}

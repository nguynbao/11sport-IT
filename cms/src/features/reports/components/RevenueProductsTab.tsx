"use client";

import { formatVND } from "@/shared/utils/format";
import {
AlertTriangle,
ChevronLeft,
ChevronRight,
Flame,
PieChart,
Search
} from "lucide-react";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { RevenueDashboardViewModel } from "../hooks/useRevenueDashboard";
import { formatShortVND } from "./RevenueCharts";

export function RevenueProductsTab({ vm }: { vm: RevenueDashboardViewModel }) {
  const {
    topSortBy,
    setTopSortBy,
    topSearch,
    setTopSearch,
    topPage,
    setTopPage,
    topPageSize,
    setTopPageSize,
    dashboardView,
    sortedTopProducts,
    topTotalPages,
    pagedTopProducts,
    top8RevenueProducts,
    maxTop8Rev,
    s,
  } = vm;

  return (
    <>
      {/* TAB 2: PHÂN TÍCH SẢN PHẨM BÁN CHẠY & ĐÓNG GÓP DOANH THU */}
      {dashboardView === "PRODUCTS" && (
        <div className="space-y-5">
          {/* HÀNG 2.5: BIỂU ĐỒ TOP 8 SẢN PHẨM MANG LẠI DOANH THU & LÃI GỘP CAO NHẤT */}
          {top8RevenueProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-brand-ink" />
                    Biểu đồ Top Sản Phẩm Đóng Góp Doanh Thu & Lãi Gộp Cao Nhất
                  </h3>
                  <p className="text-xs text-slate-500">
                    So sánh trực quan doanh thu thực tế và lợi nhuận gộp của các mặt hàng chủ lực trong kỳ.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 text-brand-ink">
                    <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Doanh thu thực tế
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-brand-ink">
                    <span className="w-3 h-3 rounded-sm bg-[#212121] inline-block" /> Lãi gộp thực tế
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {top8RevenueProducts.map((p, idx) => {
                  const revPct = Math.min(100, Math.max(4, Math.round((p.revenue / maxTop8Rev) * 100)));
                  const profPct = Math.min(
                    100,
                    Math.max(
                      p.grossProfit !== 0 ? 4 : 0,
                      Math.round((Math.abs(p.grossProfit) / maxTop8Rev) * 100)
                    )
                  );
                  return (
                    <div
                      key={p.productId || p.productCode}
                      className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-teal-300 hover:shadow-md transition-all duration-200 space-y-2 text-xs shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-bold text-slate-900 truncate min-w-0">
                          <span className="font-mono text-brand-ink mr-1.5">#{idx + 1}</span>
                          {p.productName}{" "}
                          <span className="font-mono text-[11px] text-slate-500 font-normal">
                            ({p.netSoldQty} {p.unit})
                          </span>
                        </span>
                        <span className="font-mono shrink-0 whitespace-nowrap">
                          <strong className="text-brand-ink">{formatShortVND(p.revenue)}</strong>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <strong className={p.grossProfit >= 0 ? "text-brand-ink" : "text-red-600"}>
                            Lãi {formatShortVND(p.grossProfit)}
                          </strong>
                        </span>
                      </div>

                      {/* 2 Thanh riêng biệt đồng nhất chiều cao (h-2.5): Thanh 1 (Doanh thu) & Thanh 2 (Lãi gộp) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-[10px] font-semibold text-slate-500 shrink-0">
                            Doanh thu
                          </span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full animate-chart-grow-x transition-all duration-500"
                              style={{
                                width: `${revPct}%`,
                                animationDelay: `${Math.min(idx * 45, 360)}ms`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-[10px] font-semibold text-slate-500 shrink-0">
                            Lãi gộp
                          </span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full animate-chart-grow-x transition-all duration-500 ${p.grossProfit >= 0 ? "bg-[#212121]" : "bg-red-500"
                                }`}
                              style={{
                                width: `${profPct}%`,
                                animationDelay: `${Math.min(idx * 45 + 70, 430)}ms`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HÀNG 3: BẢNG 1 — TOP SẢN PHẨM ĐANG BÁN CHẠY (BEST SELLERS) */}
          <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-100 text-brand-ink mb-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  TOP BEST SELLERS
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Các Sản Phẩm Đang Bán Chạy Nhất ({sortedTopProducts.length} sản phẩm phát sinh doanh số)
                </h3>
                <p className="text-xs text-slate-500">
                  Xếp hạng mặt hàng chủ lực mang lại doanh số cao nhất, kèm kiểm tra tồn kho Kho Tầng 1 / Tầng 2 để kịp thời bổ sung hàng lên kệ.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={topSearch}
                    onChange={(e) => setTopSearch(e.target.value)}
                    placeholder="Tìm mã hoặc tên SP bán chạy..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <select
                  value={topSortBy}
                  onChange={(e) => setTopSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-bold text-slate-800"
                >
                  <option value="QTY">Xếp theo: Số lượng bán nhiều nhất</option>
                  <option value="REVENUE">Xếp theo: Doanh thu cao nhất</option>
                  <option value="PROFIT">Xếp theo: Lãi gộp cao nhất</option>
                </select>

                <select
                  value={topPageSize}
                  onChange={(e) => setTopPageSize(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                >
                  <option value={10}>10 dòng / trang</option>
                  <option value={20}>20 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                  <tr>
                    <th className="py-3 px-3 text-center w-14">Hạng</th>
                    <th className="py-3 px-3">Mã & Tên sản phẩm</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right bg-teal-950 text-teal-300">
                      SL Đã bán
                    </th>
                    <th className="py-3 px-3 text-right">Số đơn</th>
                    <th className="py-3 px-3 text-right">Doanh thu thuần</th>
                    <th className="py-3 px-3 text-right">Lãi gộp (Biên %)</th>
                    <th className="py-3 px-3 text-right">Tồn Tầng 1 / Tầng 2</th>
                    <th className="py-3 px-3">Tình trạng tồn & Gợi ý bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagedTopProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Chưa có sản phẩm nào phát sinh doanh số khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    pagedTopProducts.map((p, idx) => {
                      const rank = (topPage - 1) * topPageSize + idx + 1;
                      return (
                        <tr key={p.productId || p.productCode} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-center font-mono font-black">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${rank === 1
                                ? "bg-amber-400 text-slate-950 shadow"
                                : rank === 2
                                  ? "bg-slate-300 text-slate-900"
                                  : rank === 3
                                    ? "bg-amber-700 text-white"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                            >
                              #{rank}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{p.productName}</div>
                            <div className="font-mono text-[11px] text-slate-500">{p.productCode}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {p.categoryName}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono bg-teal-50/40">
                            <div className="font-black text-sm text-brand-ink">
                              {p.netSoldQty} {p.unit}
                            </div>
                            {p.giftQty > 0 && (
                              <div className="text-[10px] text-purple-700 font-semibold">
                                (+{p.giftQty} tặng 0đ)
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                            {p.orderCount} đơn
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                            {formatVND(p.revenue)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                            <div
                              className={`font-extrabold ${p.grossProfit >= 0 ? "text-brand-ink" : "text-red-600"
                                }`}
                            >
                              {formatVND(p.grossProfit)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Biên lãi: <strong>{p.marginPercent}%</strong>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              Tổng: {p.stock} {p.unit}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              🏢 T1: <b className="text-brand-ink">{p.stockFloor1}</b> · 🏬 T2:{" "}
                              <b className="text-purple-700">{p.stockFloor2}</b>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {p.restockAlert ? (
                              <div className="flex items-start gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{p.restockAlert}</span>
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-teal-50 text-brand-ink font-bold text-[11px]">
                                ✓ Đủ hàng bán tại Tầng 1
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang bảng Bán chạy */}
            {sortedTopProducts.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                <span>
                  Hiển thị{" "}
                  <strong>
                    {(topPage - 1) * topPageSize + 1}–
                    {Math.min(topPage * topPageSize, sortedTopProducts.length)}
                  </strong>{" "}
                  trên tổng <strong>{sortedTopProducts.length}</strong> sản phẩm bán chạy
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={topPage <= 1}
                    onClick={() => setTopPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Trước
                  </button>
                  <span className="px-3 py-1.5 font-mono font-bold text-slate-900">
                    Trang {topPage} / {topTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={topPage >= topTotalPages}
                    onClick={() => setTopPage((p) => Math.min(topTotalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1"
                  >
                    Tiếp <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

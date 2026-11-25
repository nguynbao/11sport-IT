"use client";

import { formatVND } from "@/shared/utils/format";
import {
BarChart3,
Calendar,
LineChart
} from "lucide-react";
import { PaginationBar } from "@/shared/ui/PaginationBar";
import { RevenueDashboardViewModel } from "../hooks/useRevenueDashboard";
import { RevenueBreakdownCard } from "./RevenueBreakdownCard";
import { formatShortVND } from "./RevenueCharts";
import { RevenueLineChart } from "./RevenueLineChart";

export function RevenueOverviewTab({ vm }: { vm: RevenueDashboardViewModel }) {
  const {
    chartType,
    setChartType,
    chartGroupBy,
    setChartGroupBy,
    dailyPage,
    setDailyPage,
    dashboardView,
    showDailyTable,
    setShowDailyTable,
    reversedDaily,
    dailyTotalPages,
    pagedDaily,
    chartSeries,
    maxSeriesRevenue,
    avgSeriesRevenue,
    s,
  } = vm;

  return (
    <>
      {/* TAB 1: TỔNG QUAN & BIỂU ĐỒ DOANH THU TRỰC QUAN + CƠ CẤU THANH TOÁN / CATEGORY */}
      {dashboardView === "OVERVIEW" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
          {/* Cột trái: Biểu đồ Doanh thu (Cột đứng / Đường miền / Thanh ngang) & Bảng diễn biến */}
          <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-ink" />
                Biểu đồ Doanh thu &amp; Lợi nhuận chi tiết
              </h3>

              {/* Bộ nút chuyển đổi Kiểu Biểu đồ & Nhóm thời gian */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setChartGroupBy("HOUR")}
                    className={`px-2.5 py-1 rounded-md transition ${chartGroupBy === "HOUR"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Theo Giờ
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGroupBy("DAY")}
                    className={`px-2.5 py-1 rounded-md transition ${chartGroupBy === "DAY"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Theo Ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartGroupBy("MONTH")}
                    className={`px-2.5 py-1 rounded-md transition ${chartGroupBy === "MONTH"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Theo Tháng
                  </button>
                </div>

                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setChartType("COLUMN")}
                    className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${chartType === "COLUMN"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Biểu đồ Cột
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("AREA")}
                    className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${chartType === "AREA"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <LineChart className="w-3.5 h-3.5" /> Biểu đồ Đường
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("HORIZONTAL")}
                    className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${chartType === "HORIZONTAL"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Thanh ngang
                  </button>
                </div>
              </div>
            </div>

            {/* KHU VỰC BIỂU ĐỒ DOANH THU */}
            {chartSeries.length > 0 ? (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold uppercase text-slate-500 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {chartGroupBy === "HOUR"
                      ? `Biểu đồ theo khung giờ (${chartSeries.length} mốc giờ)`
                      : chartGroupBy === "DAY"
                        ? `Biểu đồ ${chartSeries.length} ngày trong kỳ`
                        : `Biểu đồ doanh thu qua ${chartSeries.length} tháng`}{" "}
                    · TB:{" "}
                    <strong className="text-slate-800 font-mono">
                      {formatVND(avgSeriesRevenue)}
                    </strong>
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-brand-ink">
                      <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Doanh thu thực tế
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-brand-ink">
                      <span className="w-3 h-3 rounded-sm bg-[#212121] inline-block" /> Lãi gộp
                    </span>
                  </div>
                </div>

                {/* CHẾ ĐỘ 1: BIỂU ĐỒ CỘT ĐỨNG ĐÔI (COLUMN CHART) */}
                {chartType === "COLUMN" && (
                  <div className="pt-4 pb-1">
                    <div className="flex items-stretch gap-2">
                      {/* Cột nhãn trục Y cố định bên trái */}
                      <div className="w-11 shrink-0 h-56 flex flex-col justify-between text-right pr-1 pb-1 select-none">
                        {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono text-slate-400 leading-none"
                          >
                            {formatShortVND(Math.round(maxSeriesRevenue * ratio))}
                          </span>
                        ))}
                      </div>

                      {/* Vùng vẽ các cột tràn đều 100% chiều ngang */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`relative h-72 flex items-end border-b border-slate-300 pb-1 ${chartSeries.length > 20
                            ? "gap-0.5 sm:gap-1"
                            : chartSeries.length > 12
                              ? "gap-1 sm:gap-1.5"
                              : "gap-2 sm:gap-3"
                            }`}
                        >
                          {/* Đường lưới ngang tham chiếu */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1">
                            {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                              <div
                                key={idx}
                                className="border-b border-dashed border-slate-200/90 w-full"
                              />
                            ))}
                          </div>

                          {chartSeries.map((d, barIdx) => {
                            const hasRev = d.netRevenue > 0;
                            const hasProf = d.grossProfit > 0;
                            const revH = hasRev
                              ? Math.min(
                                100,
                                Math.max(6, Math.round((d.netRevenue / maxSeriesRevenue) * 100))
                              )
                              : 2;
                            const profH = hasProf
                              ? Math.min(
                                100,
                                Math.max(4, Math.round((d.grossProfit / maxSeriesRevenue) * 100))
                              )
                              : 0;
                            const edgePosClass =
                              barIdx <= 1
                                ? "left-0"
                                : barIdx >= chartSeries.length - 2
                                  ? "right-0"
                                  : "left-1/2 -translate-x-1/2";
                            const vertPosClass =
                              revH > 62 ? "top-1" : "bottom-[58%]";
                            return (
                              <div
                                key={d.key}
                                className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group relative z-10 hover:z-30 rounded-t-lg hover:bg-teal-500/5 transition-colors duration-200"
                              >
                                {/* Tooltip chi tiết gọn gàng khi di chuột */}
                                <div
                                  className={`invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-150 absolute ${vertPosClass} ${edgePosClass} z-40 w-max min-w-[165px] max-w-[215px] bg-slate-900/95 text-white text-[11px] rounded-xl px-2.5 py-2 shadow-xl border border-slate-700`}
                                >
                                  <div className="font-extrabold text-teal-300 border-b border-slate-700 pb-1 mb-1 truncate">
                                    {d.fullLabel} · {d.orders} đơn
                                  </div>
                                  <div className="font-mono flex justify-between gap-2.5 text-[10px]">
                                    <span className="text-slate-300">Doanh thu:</span>
                                    <strong className="text-teal-400">
                                      {formatVND(d.netRevenue)}
                                    </strong>
                                  </div>
                                  <div className="font-mono flex justify-between gap-2.5 text-[10px]">
                                    <span className="text-slate-300">Giá vốn:</span>
                                    <span className="text-amber-300">{formatVND(d.cogs)}</span>
                                  </div>
                                  <div className="font-mono flex justify-between gap-2.5 text-[10px]">
                                    <span className="text-slate-300">Lãi gộp:</span>
                                    <strong className="text-indigo-300">
                                      {formatVND(d.grossProfit)}
                                    </strong>
                                  </div>
                                </div>

                                {/* Cặp cột Doanh thu & Lãi gộp bám sát đáy */}
                                <div className="relative w-full max-w-[34px] h-[86%] flex items-end justify-center gap-0.5 sm:gap-1">
                                  {/* Nhãn giá trị nằm ngay trên đỉnh cột có doanh thu */}
                                  {hasRev && (
                                    <span
                                      className="
                                      absolute left-1/2 -translate-x-1/2 mb-1
                                      text-[9px] sm:text-[10px] font-mono font-extrabold text-brand-ink
                                      whitespace-nowrap pointer-events-none transition-transform duration-200 group-hover:-translate-y-0.5
                                    "
                                      style={{ bottom: `${Math.max(revH, profH)}%` }}
                                    >
                                      {formatShortVND(d.netRevenue)}
                                    </span>
                                  )}

                                  <div
                                    className={`flex-1 rounded-t-sm sm:rounded-t-md animate-chart-grow-y transition-all duration-300 ${hasRev
                                      ? "bg-gradient-to-t from-teal-600 to-teal-400 group-hover:from-teal-500 group-hover:to-teal-300 group-hover:scale-x-110 group-hover:shadow-md shadow-sm"
                                      : "bg-slate-200/80"
                                      }`}
                                    style={{
                                      height: `${revH}%`,
                                      animationDelay: `${Math.min(barIdx * 25, 350)}ms`,
                                    }}
                                  />
                                  {(hasProf || chartSeries.length <= 16) && (
                                    <div
                                      className={`flex-1 rounded-t-sm sm:rounded-t-md animate-chart-grow-y transition-all duration-300 ${hasProf
                                        ? "bg-gradient-to-t from-[#212121] to-[#474748] group-hover:from-[#2D2D2D] group-hover:to-[#6B6B6B] group-hover:scale-x-110 group-hover:shadow-md shadow-sm"
                                        : "bg-transparent"
                                        }`}
                                      style={{
                                        height: `${profH}%`,
                                        animationDelay: `${Math.min(barIdx * 25 + 60, 410)}ms`,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Nhãn trục X tự động giản lược khi có nhiều ngày */}
                        <div
                          className={`flex items-center pt-2 ${chartSeries.length > 20
                            ? "gap-0.5 sm:gap-1"
                            : chartSeries.length > 12
                              ? "gap-1 sm:gap-1.5"
                              : "gap-2 sm:gap-3"
                            }`}
                        >
                          {chartSeries.map((d, idx) => {
                            const n = chartSeries.length;
                            const step = n > 22 ? 3 : n > 12 ? 2 : 1;
                            const showLabel =
                              idx === 0 ||
                              idx === n - 1 ||
                              (idx % step === 0 && n - 1 - idx >= Math.ceil(step / 2));
                            return (
                              <div
                                key={d.key}
                                className="flex-1 min-w-0 text-center font-mono text-[9px] sm:text-[10px] font-bold text-slate-600 overflow-visible"
                              >
                                {showLabel ? (
                                  <span className="inline-block whitespace-nowrap">
                                    {d.label}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

      <RevenueLineChart vm={vm} />

                {/* CHẾ ĐỘ 3: BIỂU ĐỒ THANH NGANG (BẢN CŨ QUEN THUỘC) */}
                {chartType === "HORIZONTAL" && (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {[...chartSeries].reverse().map((d, barIdx) => {
                      const revPct = Math.min(
                        100,
                        Math.max(2, Math.round((Math.max(0, d.netRevenue) / maxSeriesRevenue) * 100))
                      );
                      const profPct = Math.min(
                        100,
                        Math.max(
                          d.grossProfit !== 0 ? 3 : 0,
                          Math.round((Math.abs(d.grossProfit) / maxSeriesRevenue) * 100)
                        )
                      );
                      return (
                        <div
                          key={d.key}
                          className="text-xs space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200/80 hover:border-teal-300 hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0 truncate">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{d.fullLabel}</span>
                              <span className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                {d.orders} đơn · {d.unitsSold} SP
                              </span>
                            </span>
                            <span className="text-right shrink-0 whitespace-nowrap">
                              <strong className="text-brand-ink">{formatVND(d.netRevenue)}</strong>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className={`font-bold ${d.grossProfit >= 0 ? "text-brand-ink" : "text-red-600"}`}>
                                Lãi: {formatVND(d.grossProfit)}
                              </span>
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 rounded-full animate-chart-grow-x transition-all duration-500"
                                style={{
                                  width: `${revPct}%`,
                                  animationDelay: `${Math.min(barIdx * 35, 350)}ms`,
                                }}
                              />
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full animate-chart-grow-x transition-all duration-500 ${d.grossProfit >= 0 ? "bg-teal-600" : "bg-red-500"
                                  }`}
                                style={{
                                  width: `${profPct}%`,
                                  animationDelay: `${Math.min(barIdx * 35 + 70, 420)}ms`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Chưa có dữ liệu giao dịch trong khoảng thời gian này.
              </div>
            )}

            {/* Bảng chi tiết theo ngày (Thu gọn mặc định để Overview vừa 1 màn hình) */}
            {reversedDaily.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDailyTable((v) => !v)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <Calendar className="w-3.5 h-3.5 text-brand-ink" />
                    <span>
                      {showDailyTable
                        ? `Ẩn bảng chi tiết theo ngày (${reversedDaily.length} ngày)`
                        : `Xem bảng chi tiết theo ngày (${reversedDaily.length} ngày)`}
                    </span>
                  </button>
                </div>

                {showDailyTable && (
                  <>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Ngày</th>
                            <th className="py-2.5 px-2.5 text-right">Số đơn</th>
                            <th className="py-2.5 px-2.5 text-right">SL bán</th>
                            <th className="py-2.5 px-3 text-right">Tiền hàng</th>
                            <th className="py-2.5 px-3 text-right text-amber-700">Giảm giá</th>
                            <th className="py-2.5 px-3 text-right text-brand-ink">Doanh thu thuần</th>
                            <th className="py-2.5 px-3 text-right text-brand-ink">Thực thu</th>
                            <th className="py-2.5 px-3 text-right">Giá vốn</th>
                            <th className="py-2.5 px-3 text-right text-brand-ink">Lãi gộp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {pagedDaily.map((d) => (
                            <tr key={d.date} className="hover:bg-slate-50 font-mono">
                              <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                {d.date.split("-").reverse().join("/")}
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold">{d.orders}</td>
                              <td className="py-2 px-2.5 text-right">{d.unitsSold}</td>
                              <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                                {formatVND(d.grossRevenue)}
                              </td>
                              <td className="py-2 px-3 text-right text-amber-700 whitespace-nowrap">
                                {d.discountTotal > 0 ? `-${formatVND(d.discountTotal)}` : "0 VND"}
                              </td>
                              <td className="py-2 px-3 text-right font-extrabold text-brand-ink whitespace-nowrap">
                                {formatVND(d.netRevenue)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-brand-ink whitespace-nowrap">
                                {d.cashCollected !== undefined ? formatVND(d.cashCollected) : "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                                {formatVND(d.cogs)}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-extrabold whitespace-nowrap ${d.grossProfit >= 0 ? "text-brand-ink" : "text-red-600"
                                  }`}
                              >
                                {formatVND(d.grossProfit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <PaginationBar
                      totalItems={reversedDaily.length}
                      page={dailyPage}
                      totalPages={dailyTotalPages}
                      pageSize={15}
                      onPageChange={setDailyPage}
                      itemLabel="ngày"
                    />
                  </>
                )}
              </div>
            )}
          </div>

      <RevenueBreakdownCard vm={vm} />
        </div>
      )}

    </>
  );
}


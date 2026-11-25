"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { exportRevenueDashboard } from "../exports";
import { parseLocalDateBound, extractClientOrderDebtMeta } from "@/features/reports/utils";
import { RevenueDashboardData, ProductSalesAnalysisRow, DebtOrderRow, DebtCustomerSummary, Category, Order, ServiceOrder, ReturnReceipt, Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatVND, formatDateTime, formatPhone, formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { useDebounce, filterAndRankBySearch } from "@/shared/lib/search";
import {
  TrendingUp,
  Flame,
  Rocket,
  DollarSign,
  ShoppingBag,
  PackageCheck,
  AlertTriangle,
  Search,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
  CheckCircle2,
  Clock,
  Users,
  Wallet,
  Wrench,
  X,
  FileText,
} from "lucide-react";
import { RevenueDashboardViewModel } from "../hooks/useRevenueDashboard";
import { CHART_COLORS, formatShortVND, AnimatedNumber, SvgDonutChart } from "./RevenueCharts";

export function RevenueLineChart({ vm }: { vm: RevenueDashboardViewModel }) {
  const {
    chartType,
    chartSeries,
    maxSeriesRevenue,
    s,
  } = vm;

  return (
    <>
                {/* CHẾ ĐỘ 2: BIỂU ĐỒ ĐƯỜNG & MIỀN (SVG AREA / LINE CHART - FULL WIDTH KHÔNG PADDING 2 BÊN) */}
                {chartType === "AREA" && (
                  <div className="pt-3 pb-1">
                    <div className="flex items-stretch gap-2">
                      {/* Cột nhãn trục Y cố định sát lề trái */}
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

                      {/* Vùng đồ thị kéo sát 100% mép trái - phải (bỏ hoàn toàn padding 2 bên) */}
                      <div className="flex-1 min-w-0">
                        <div className="relative h-56 w-full border-b border-slate-300">
                          {/* Đường lưới ngang */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                              <div
                                key={idx}
                                className="border-b border-dashed border-slate-200/90 w-full"
                              />
                            ))}
                          </div>

                          {/* SVG đường & miền phủ kín 100% chiều rộng từ x=0 đến x=1000 */}
                          <svg
                            viewBox="0 0 1000 200"
                            preserveAspectRatio="none"
                            className="w-full h-full block overflow-visible animate-chart-reveal-x"
                          >
                            <defs>
                              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#E8B020" stopOpacity="0.38" />
                                <stop offset="100%" stopColor="#E8B020" stopOpacity="0.02" />
                              </linearGradient>
                              <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#212121" stopOpacity="0.32" />
                                <stop offset="100%" stopColor="#212121" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>

                            {(() => {
                              const n = chartSeries.length;
                              const getX = (idx: number) =>
                                n === 1 ? 500 : (idx / (n - 1)) * 1000;
                              const getRevY = (v: number) =>
                                196 - (Math.max(0, v) / maxSeriesRevenue) * 184;
                              const getProfY = (v: number) =>
                                196 - (Math.max(0, v) / maxSeriesRevenue) * 184;

                              const revPoints =
                                n === 1
                                  ? `0,${getRevY(chartSeries[0].netRevenue)} 500,${getRevY(
                                    chartSeries[0].netRevenue
                                  )} 1000,${getRevY(chartSeries[0].netRevenue)}`
                                  : chartSeries
                                    .map((d, i) => `${getX(i)},${getRevY(d.netRevenue)}`)
                                    .join(" ");
                              const profPoints =
                                n === 1
                                  ? `0,${getProfY(chartSeries[0].grossProfit)} 500,${getProfY(
                                    chartSeries[0].grossProfit
                                  )} 1000,${getProfY(chartSeries[0].grossProfit)}`
                                  : chartSeries
                                    .map((d, i) => `${getX(i)},${getProfY(d.grossProfit)}`)
                                    .join(" ");

                              const revArea = `0,200 ${revPoints} 1000,200`;
                              const profArea = `0,200 ${profPoints} 1000,200`;

                              return (
                                <>
                                  <polygon points={revArea} fill="url(#revGrad)" />
                                  <polygon points={profArea} fill="url(#profGrad)" />
                                  <polyline
                                    fill="none"
                                    stroke="#E8B020"
                                    strokeWidth="2.5"
                                    vectorEffect="non-scaling-stroke"
                                    points={revPoints}
                                  />
                                  <polyline
                                    fill="none"
                                    stroke="#212121"
                                    strokeWidth="2"
                                    strokeDasharray="5 3"
                                    vectorEffect="non-scaling-stroke"
                                    points={profPoints}
                                  />
                                </>
                              );
                            })()}
                          </svg>

                          {/* Các nút chấm tròn (Dots) & Tooltip chuẩn tỷ lệ 1:1 không bị méo */}
                          <div className="absolute inset-0 pointer-events-none">
                            {chartSeries.map((d, i) => {
                              const n = chartSeries.length;
                              const leftPct = n === 1 ? 50 : (i / (n - 1)) * 100;
                              const revBottomPct =
                                2 + (Math.max(0, d.netRevenue) / maxSeriesRevenue) * 92;
                              const profBottomPct =
                                2 + (Math.max(0, d.grossProfit) / maxSeriesRevenue) * 92;
                              const hasVal = d.netRevenue > 0 || d.grossProfit > 0;

                              return (
                                <div
                                  key={d.key}
                                  className="absolute top-0 bottom-0 group pointer-events-auto"
                                  style={{
                                    left: `${leftPct}%`,
                                    width: n > 20 ? "14px" : "22px",
                                    transform: "translateX(-50%)",
                                  }}
                                >
                                  {/* Đường gióng dọc khi hover */}
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-teal-500/50" />

                                  {/* Tooltip chi tiết khi hover */}
                                  <div
                                    className={`invisible opacity-0 group-hover:visible group-hover:opacity-100 pointer-events-none transition-all duration-150 absolute top-1 ${i <= 1
                                      ? "left-0"
                                      : i >= n - 2
                                        ? "right-0"
                                        : "left-1/2 -translate-x-1/2"
                                      } z-40 w-max min-w-[165px] max-w-[215px] bg-slate-900/95 text-white text-[11px] rounded-xl px-2.5 py-2 shadow-xl border border-slate-700`}
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

                                  {/* Nhãn số trên đỉnh điểm có doanh thu */}
                                  {d.netRevenue > 0 && (
                                    <span
                                      className="absolute left-1/2 -translate-x-1/2 mb-2 text-[9px] sm:text-[10px] font-mono font-extrabold text-brand-ink whitespace-nowrap"
                                      style={{ bottom: `${revBottomPct}%` }}
                                    >
                                      {formatShortVND(d.netRevenue)}
                                    </span>
                                  )}

                                  {/* Điểm tròn Doanh thu */}
                                  <span
                                    className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-125 ${hasVal
                                      ? "w-2.5 h-2.5 bg-teal-600"
                                      : "w-1.5 h-1.5 bg-teal-400/70"
                                      }`}
                                    style={{ bottom: `${revBottomPct}%` }}
                                  />

                                  {/* Điểm tròn Lãi gộp */}
                                  {(d.grossProfit > 0 || n <= 14) && (
                                    <span
                                      className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border border-white shadow-sm ${d.grossProfit > 0
                                        ? "w-2 h-2 bg-[#212121]"
                                        : "w-1.5 h-1.5 bg-[#212121]/60"
                                        }`}
                                      style={{ bottom: `${profBottomPct}%` }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Nhãn trục X bám sát từ mép trái đến mép phải, tự động giản lược khi có 30 ngày */}
                        <div className="relative h-6 mt-2 w-full select-none">
                          {chartSeries.map((d, idx) => {
                            const n = chartSeries.length;
                            const step = n > 22 ? 3 : n > 12 ? 2 : 1;
                            const showLabel =
                              idx === 0 ||
                              idx === n - 1 ||
                              (idx % step === 0 && n - 1 - idx >= Math.ceil(step / 2));
                            if (!showLabel) return null;
                            const leftPct = n === 1 ? 50 : (idx / (n - 1)) * 100;
                            const alignClass =
                              idx === 0
                                ? "translate-x-0"
                                : idx === n - 1
                                  ? "-translate-x-full"
                                  : "-translate-x-1/2";
                            return (
                              <span
                                key={d.key}
                                className={`absolute top-0 font-mono text-[9px] sm:text-[10px] font-bold text-slate-600 whitespace-nowrap ${alignClass}`}
                                style={{ left: `${leftPct}%` }}
                              >
                                {d.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
    </>
  );
}

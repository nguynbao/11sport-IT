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

export function RevenueBreakdownCard({ vm }: { vm: RevenueDashboardViewModel }) {
  const {
    data,
    categoryId,
    structureView,
    setStructureView,
    s,
  } = vm;

  return (
    <>
          {/* Cột phải: Cơ cấu Thanh toán & Danh mục gộp gọn 1 Card có nút chuyển */}
          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                {structureView === "PAYMENT" ? (
                  <>
                    <CreditCard className="w-4 h-4 text-brand-ink" />
                    Cơ cấu Thanh toán
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-brand-ink" />
                    Tỷ trọng Danh mục
                  </>
                )}
              </h3>

              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStructureView("PAYMENT")}
                  className={`px-2.5 py-1 rounded-md transition ${structureView === "PAYMENT"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Thanh toán
                </button>
                <button
                  type="button"
                  onClick={() => setStructureView("CATEGORY")}
                  className={`px-2.5 py-1 rounded-md transition ${structureView === "CATEGORY"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Danh mục
                </button>
              </div>
            </div>

            {structureView === "PAYMENT" ? (
              <div className="space-y-3">

                <SvgDonutChart
                  stacked
                  centerLabel="Tổng đơn thu"
                  centerValue={formatShortVND(s?.orderRevenue || 0)}
                  items={(data?.byPaymentMethod || []).map((pm, idx) => ({
                    label: pm.label,
                    value: pm.revenue,
                    sharePercent: pm.sharePercent,
                    sub: `${pm.orders} đơn`,
                    color: CHART_COLORS[idx % CHART_COLORS.length],
                  }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {(data?.byPaymentMethod || []).map((pm) => (
                    <div
                      key={pm.method}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-teal-300 hover:shadow-xs transition-all space-y-1 min-w-0"
                    >
                      <div className="flex items-center justify-between gap-1.5 text-xs">
                        <span className="font-bold text-slate-800 truncate">{pm.label}</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-brand-ink font-bold shrink-0">
                          {pm.sharePercent}%
                        </span>
                      </div>
                      <div className="font-mono font-extrabold text-sm text-slate-900 truncate">
                        {formatVND(pm.revenue)}
                      </div>
                      <div className="text-[11px] text-slate-500">{pm.orders} đơn hàng</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.byCategory && data.byCategory.length > 0 ? (
                  <>
                    <SvgDonutChart
                      stacked
                      centerLabel="Danh mục"
                      centerValue={`${data.byCategory.length} nhóm`}
                      items={data.byCategory.map((c, idx) => ({
                        label: c.categoryName,
                        value: c.revenue,
                        sharePercent: c.sharePercent,
                        sub: `${c.unitsSold} SP`,
                        color: CHART_COLORS[idx % CHART_COLORS.length],
                      }))}
                    />

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 pt-1">
                      {data.byCategory.map((c, idx) => (
                        <div
                          key={c.categoryId}
                          className="p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-xs transition-all space-y-1.5 min-w-0"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                            <span className="font-extrabold text-slate-900 flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              <span className="truncate">{c.categoryName}</span>
                              <span className="font-mono text-slate-500 font-normal shrink-0 whitespace-nowrap">
                                ({c.unitsSold} SP)
                              </span>
                            </span>
                            <span className="font-mono font-bold text-brand-ink shrink-0 whitespace-nowrap">
                              {formatShortVND(c.revenue)} ({c.sharePercent}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full animate-chart-grow-x"
                              style={{
                                width: `${Math.min(100, Math.max(3, c.sharePercent))}%`,
                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                animationDelay: `${Math.min(idx * 45, 360)}ms`,
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-mono">
                            <span>Giá vốn: {formatVND(c.cogs)}</span>
                            <span className="font-bold text-brand-ink">
                              Lãi gộp: {formatVND(c.grossProfit)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Chưa có doanh thu theo danh mục trong kỳ này.
                  </div>
                )}
              </div>
            )}
          </div>
    </>
  );
}

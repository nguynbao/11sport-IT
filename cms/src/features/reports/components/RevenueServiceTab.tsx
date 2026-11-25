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

export function RevenueServiceTab({ vm }: { vm: RevenueDashboardViewModel }) {
  const {
    data,
    dashboardView,
    s,
  } = vm;

  return (
    <>
      {/* TAB 3: KHỐI THỐNG KÊ RIÊNG MẢNG LÀM DỊCH VỤ (CĂNG VỢT / SỬA CHỮA) */}
      {dashboardView === "SERVICES" && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-brand-ink text-[11px] font-extrabold uppercase">
                <Wrench className="w-3.5 h-3.5" />
                Thống kê Doanh thu &amp; Thực thu Mảng Dịch vụ
              </div>
              <h3 className="font-extrabold text-slate-900 text-base mt-1">
                Tổng quan Doanh thu Dịch vụ (Tính khi tạo đơn) &amp; Thực thu (Tính sau khi hoàn thành)
              </h3>
              <p className="text-xs text-slate-500">
                Doanh thu dịch vụ được ghi nhận ngay theo ngày tạo phiếu (Giá vốn = 0đ, 100% vào Lãi gộp). Thực thu dịch vụ chỉ kết chuyển vào quỹ sau khi đơn dịch vụ đã hoàn thành trả khách (<strong>Đã trả khách</strong>).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
              <div className="text-xs font-bold text-indigo-900">
                1. Doanh thu thuần Dịch vụ (Theo ngày tạo)
              </div>
              <div className="text-xl font-black font-mono text-brand-ink mt-1">
                {formatVND(s?.serviceRevenue || 0)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-600 flex justify-between">
                <span>Giá gốc DV: {formatVND(s?.serviceGrossRevenue || 0)}</span>
                <span>Giảm: -{formatVND(s?.serviceDiscountTotal || 0)}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200">
              <div className="text-xs font-bold text-teal-900">
                2. Thực thu Dịch vụ (Đã hoàn thành)
              </div>
              <div className="text-xl font-black font-mono text-brand-ink mt-1">
                {formatVND(s?.serviceCashCollected || 0)}
              </div>
              <div className="mt-1.5 text-[11px] text-brand-ink">
                Đã hoàn thành trả khách:{" "}
                <strong>{s?.completedServiceOrdersCount || 0}</strong> đơn
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="text-xs font-bold text-amber-900">
                3. Đang làm / Chờ hoàn thành
              </div>
              <div className="text-xl font-black font-mono text-amber-700 mt-1">
                {formatVND(s?.servicePendingCollection || 0)}
              </div>
              <div className="mt-1.5 text-[11px] text-amber-800">
                Chưa kết chuyển thực thu:{" "}
                <strong>{s?.activeServiceOrdersCount || 0}</strong> đơn đang xử lý
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-700">
                4. Tổng số phiếu &amp; Lượt dịch vụ
              </div>
              <div className="text-xl font-black font-mono text-slate-900 mt-1">
                {s?.serviceOrdersCount || 0} phiếu ({s?.totalServiceUnits || 0} lượt)
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">
                Phí thẻ DV thu hộ: +{formatVND(s?.serviceCardFeeCollected || 0)}
              </div>
            </div>
          </div>

          {data?.serviceStats?.byServiceType && data.serviceStats.byServiceType.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Mã DV</th>
                    <th className="py-2.5 px-3.5">Tên loại dịch vụ</th>
                    <th className="py-2.5 px-3.5 text-center">Số phiếu</th>
                    <th className="py-2.5 px-3.5 text-center">Số lượng</th>
                    <th className="py-2.5 px-3.5 text-right">Doanh thu thuần</th>
                    <th className="py-2.5 px-3.5 text-right">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.serviceStats.byServiceType.map((row) => (
                    <tr key={row.serviceCode} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-brand-ink">
                        {row.serviceCode}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        {row.serviceName}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono">
                        {row.orderCount} đơn
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono font-bold">
                        {row.quantity} {row.unit}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-extrabold text-brand-ink">
                        {formatVND(row.revenue)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-600">
                        {row.sharePercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </>
  );
}

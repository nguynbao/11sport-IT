"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { formatVND } from "@/shared/utils/format";
import {
BarChart3,
CheckCircle2,
CreditCard,
DollarSign,
Flame,
Layers,
PackageCheck,
RefreshCw,
ShoppingBag,
TrendingUp,
Wallet,
Wrench
} from "lucide-react";
import { exportRevenueDashboard } from "../exports";
import { RevenueDashboardProps,useRevenueDashboard } from "../hooks/useRevenueDashboard";
import { AnimatedNumber,formatShortVND } from "./RevenueCharts";
import { RevenueDebtTab } from "./RevenueDebtTab";
import { RevenueOverviewTab } from "./RevenueOverviewTab";
import { RevenueProductsTab } from "./RevenueProductsTab";
import { RevenueServiceTab } from "./RevenueServiceTab";

export default function RevenueDashboardModule(props: RevenueDashboardProps) {
  const vm = useRevenueDashboard(props);
  const {
    data,
    categories,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    categoryId,
    setCategoryId,
    paymentMethod,
    setPaymentMethod,
    quickRange,
    setQuickRange,
    setChartGroupBy,
    dashboardView,
    setDashboardView,
    handleSelectQuickRange,
    loadDashboard,
    sortedTopProducts,
    s,
    dm,
  } = vm;

  return (
    <div className="space-y-2.5">
      {/* BANNER & BỘ LỌC KỲ DOANH THU (GỌN 2 HÀNG) */}
      <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 px-4 py-2.5 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-teal-50 text-brand-ink border border-teal-200 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Dashboard Doanh Thu &amp; Phân Tích Kinh Doanh
              </h2>
              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-brand-ink">
                  {fromDate || toDate
                    ? `${fromDate ? fromDate.split("-").reverse().join("/") : "Đầu kỳ"} → ${toDate ? toDate.split("-").reverse().join("/") : "Hiện tại"
                    }`
                    : "Toàn thời gian"}
                </span>
                <span>·</span>
                <span>
                  <strong className="text-slate-900 font-mono">{s?.totalOrders || 0}</strong> đơn
                </span>
                <span>·</span>
                <span>
                  DT thuần: <strong className="text-brand-ink font-mono">{formatVND(s?.netRevenue || 0)}</strong>
                </span>
                <span>·</span>
                <span>
                  Lãi gộp: <strong className="text-brand-ink font-mono">{formatVND(s?.grossProfit || 0)}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(fromDate || toDate || categoryId || paymentMethod) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryId("");
                  setPaymentMethod("");
                  handleSelectQuickRange("ALL");
                }}
                className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold"
              >
                Xóa bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-ink" : "text-brand-ink"}`} />
              Làm mới
            </button>
            {data && (
              <ExportExcelButton
                label="Xuất Excel"
                onExport={() => exportRevenueDashboard(data, fromDate, toDate)}
              />
            )}
          </div>
        </div>

        {/* Bộ lọc thời gian, Category & Hình thức thanh toán trên 1 hàng gọn */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: "Toàn bộ" },
                { id: "TODAY", label: "Hôm nay" },
                { id: "YESTERDAY", label: "Hôm qua" },
                { id: "7D", label: "7 ngày" },
                { id: "30D", label: "30 ngày" },
                { id: "MONTH", label: "Tháng này" },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSelectQuickRange(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${quickRange === btn.id
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              onChange={(e) => {
                const nextFrom = e.target.value;
                setQuickRange("ALL");
                setFromDate(nextFrom);
                if (nextFrom && nextFrom === toDate) {
                  setChartGroupBy("HOUR");
                } else {
                  setChartGroupBy("DAY");
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-teal-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={toDate}
              onChange={(e) => {
                const nextTo = e.target.value;
                setQuickRange("ALL");
                setToDate(nextTo);
                if (nextTo && fromDate === nextTo) {
                  setChartGroupBy("HOUR");
                } else {
                  setChartGroupBy("DAY");
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:border-teal-500 focus:outline-none"
            />
            <select
              aria-label="Lọc theo Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:border-teal-500 focus:outline-none"
            >
              <option value="">Tất cả Danh mục</option>
              <option value="SERVICE">🔧 Dịch vụ</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Hình thức thanh toán"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold focus:border-teal-500 focus:outline-none"
            >
              <option value="">Tất cả thanh toán</option>
              <option value="CASH">Tiền mặt</option>
              <option value="BANKING">Chuyển khoản</option>
              <option value="CARD">Quẹt thẻ</option>
              <option value="OTHER">Khác</option>
              <option value="DEBT">Công nợ</option>
            </select>
          </div>
        </div>
      </div>

      {/* HÀNG 1: 4 THẺ KPI TỔNG QUAN GỌN GÀNG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {/* Ô 1: Doanh thu thuần (Hệ thống POS) */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600">
              1. Doanh thu thuần (POS)
            </span>
            <span className="p-1 rounded-lg bg-teal-50 text-brand-ink">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.netRevenue || 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Giá niêm yết (SP + Quà)</span>
              <span className="font-mono font-bold text-slate-900">
                Nợ: {formatShortVND(s?.outstandingDebtInPeriod || 0)}
              </span>
            </div>
            {(s?.returnGoodsTotal || 0) > 0 || (s?.exchangeGoodsTotal || 0) > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>Đổi: <strong className="text-slate-900">+{formatShortVND(s?.exchangeGoodsTotal || 0)}</strong></span>
                <span>Trả: <strong className="text-slate-900">-{formatShortVND(s?.returnGoodsTotal || 0)}</strong></span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Gồm đơn công nợ &amp; trị giá quà niêm yết
              </div>
            )}
          </div>
        </div>

        {/* Ô 2: Doanh thu thực tế (Dòng tiền thực thu) */}
        <div className="relative group bg-white rounded-xl border-2 border-teal-500 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-brand-ink">
              2. Doanh thu thực tế
            </span>
            <span className="p-1 rounded-lg bg-teal-50 text-brand-ink">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            {s?.cashCollected === null ? (
              "— (Theo DM)"
            ) : (
              <AnimatedNumber
                value={s?.actualRevenue ?? s?.cashCollected ?? s?.collectedRevenue ?? 0}
                formatter={formatVND}
              />
            )}
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Thực thu khi mua:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatShortVND(s?.cashAtPurchase || 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Thu nợ: <strong className="text-slate-900">+{formatShortVND(s?.debtCollectedInPeriod || 0)}</strong></span>
              <span>Hoàn: <strong className="text-slate-900">-{formatShortVND(s?.cashRefunded || 0)}</strong></span>
            </div>
          </div>
        </div>

        {/* Ô 3: Các khoản giảm trừ doanh thu */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600">
              3. Giảm trừ doanh thu
            </span>
            <span className="p-1 rounded-lg bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.deductionsTotal ?? s?.giftRetailValue ?? 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Trị giá niêm yết quà tặng (<strong className="text-slate-900">{s?.totalGiftUnits || 0}</strong> SP)</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Giảm giá SP &amp; Bill:</span>
              <span className="font-mono font-bold text-slate-900">{formatShortVND(s?.totalDiscount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Ô 4: Giá vốn hàng bán (COGS) */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
              4. Giá vốn (COGS)
              {s?.cogsEstimated && (
                <span
                  title="Có đơn cũ ước tính theo giá vốn hiện tại"
                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold normal-case"
                >
                  Ước tính
                </span>
              )}
            </span>
            <span className="p-1 rounded-lg bg-slate-100 text-slate-700">
              <PackageCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.estimatedCogs || 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Vốn SP bán:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatShortVND(s?.salesCogs ?? Math.max(0, (s?.estimatedCogs || 0) - (s?.giftCogs || 0)))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Vốn quà tặng:</span>
              <span className="font-mono font-bold text-slate-900">{formatShortVND(s?.giftCogs || 0)}</span>
            </div>
          </div>
        </div>

        {/* Ô 5: Lợi nhuận gộp (LN Gộp) */}
        <div className="relative group bg-white border-2 border-teal-500 hover:shadow-md text-slate-900 rounded-xl px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-brand-ink">
              5. Lợi nhuận gộp
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-teal-50 text-brand-ink border border-teal-200">
              Biên: {s?.grossMarginPercent || 0}%
            </span>
          </div>
          <div
            className={`text-xl sm:text-[22px] font-black font-mono mt-1 ${(s?.grossProfit || 0) >= 0 ? "text-slate-900" : "text-red-600"
              }`}
          >
            <AnimatedNumber value={s?.grossProfit || 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 text-xs text-slate-600">
            = Thực thu (<strong className="text-slate-900">{formatShortVND(s?.actualRevenue ?? s?.cashCollected ?? 0)}</strong>) − Giảm trừ (<strong className="text-slate-900">{formatShortVND(s?.deductionsTotal ?? s?.giftRetailValue ?? 0)}</strong>) − COGS (<strong className="text-slate-900">{formatShortVND(s?.estimatedCogs || 0)}</strong>)
          </div>
        </div>

        {/* Ô 6: Doanh thu dịch vụ (Tách riêng) */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600">
              6. Doanh thu dịch vụ
            </span>
            <button
              type="button"
              onClick={() => setDashboardView("SERVICES")}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-ink border border-teal-200 hover:bg-teal-100 cursor-pointer"
            >
              Tách riêng
            </button>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.serviceRevenue || 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Thực thu DV (đã trả khách):</span>
              <span className="font-mono font-bold text-slate-900">
                {formatShortVND(s?.serviceCashCollected || 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span><strong className="text-slate-900">{s?.serviceOrdersCount || 0}</strong> phiếu · <strong className="text-slate-900">{s?.totalServiceUnits || 0}</strong> lượt</span>
              <span>Ngoài DT bán hàng</span>
            </div>
          </div>
        </div>

        {/* Ô 7: Phí thẻ & Cổng thanh toán (VNPAY / POS) */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600">
              7. Phí thẻ (VNPAY / POS)
            </span>
            <span className="p-1 rounded-lg bg-slate-100 text-slate-700">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.cardFeeNet ?? s?.cardFeeTotal ?? 0} formatter={formatVND} />
          </div>
          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Thu hộ: <strong className="text-slate-900">+{formatShortVND(s?.cardFeeCollected || 0)}</strong></span>
              <span>Hoàn: <strong className="text-slate-900">-{formatShortVND(s?.cardFeeRefunded || 0)}</strong></span>
            </div>
            <div className="text-xs text-slate-500">
              Ngoài doanh thu · Không trừ vào giá bán
            </div>
          </div>
        </div>

        {/* Ô 8: Đơn hàng, Sản lượng & Tổng nợ */}
        <div className="relative group bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:shadow-md px-3.5 py-2.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-600">
              8. Đơn hàng &amp; Công nợ
            </span>
            <span className="p-1 rounded-lg bg-teal-50 text-brand-ink">
              <ShoppingBag className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-[22px] font-black font-mono text-slate-900 mt-1">
            <AnimatedNumber value={s?.totalOrders || 0} /> đơn · <AnimatedNumber value={s?.totalUnitsSold || 0} /> SP
          </div>
          <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-0 right-0 top-full mt-1.5 z-30 bg-teal-50 rounded-xl border border-slate-200 shadow-xl p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>AOV: <strong className="font-mono text-slate-900">{formatShortVND(s?.avgOrderValue || 0)}</strong></span>
              <span>Đổi: <strong className="text-slate-900">{s?.totalUnitsReturned || 0} SP</strong></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Dư nợ toàn shop:</span>
              <button
                type="button"
                onClick={() => setDashboardView("DEBTS")}
                className="font-mono font-black text-slate-900 hover:text-brand-ink hover:underline cursor-pointer"
              >
                {formatShortVND(dm?.summary?.totalOutstandingDebt || 0)} ({dm?.summary?.activeDebtOrdersCount || 0} đơn)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* THANH CHUYỂN GÓC NHÌN GỌN GÀNG (TRÁNH XÉ THÀNH QUÁ NHIỀU KHU TRÊN 1 MÀN HÌNH) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDashboardView("OVERVIEW")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${dashboardView === "OVERVIEW"
            ? "bg-teal-600 text-white shadow-xs"
            : "text-slate-700 hover:bg-slate-100"
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>1. Tổng quan &amp; Biểu đồ</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView("PRODUCTS")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${dashboardView === "PRODUCTS"
            ? "bg-teal-600 text-white shadow-xs"
            : "text-slate-700 hover:bg-slate-100"
            }`}
        >
          <Flame className="w-4 h-4" />
          <span>2. Sản phẩm Bán chạy ({sortedTopProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView("SERVICES")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${dashboardView === "SERVICES"
            ? "bg-teal-600 text-white shadow-xs"
            : "text-slate-700 hover:bg-slate-100"
            }`}
        >
          <Wrench className="w-4 h-4" />
          <span>3. Mảng Dịch vụ</span>
          {(s?.serviceOrdersCount || 0) > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${dashboardView === "SERVICES"
                ? "bg-white/20 text-white"
                : "bg-indigo-100 text-brand-ink"
                }`}
            >
              {s?.serviceOrdersCount} phiếu
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDashboardView("DEBTS")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${dashboardView === "DEBTS"
            ? "bg-teal-600 text-white shadow-xs"
            : "text-slate-700 hover:bg-slate-100"
            }`}
        >
          <Wallet className="w-4 h-4" />
          <span>4. Thống kê Công nợ</span>
          {(dm?.summary?.activeDebtOrdersCount || 0) > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${dashboardView === "DEBTS"
                ? "bg-white/20 text-white"
                : "bg-amber-100 text-amber-800"
                }`}
            >
              {dm?.summary?.activeDebtOrdersCount} đơn
            </span>
          )}
        </button>
      </div>

      <RevenueServiceTab vm={vm} />
      <RevenueDebtTab vm={vm} />
      <RevenueOverviewTab vm={vm} />
      <RevenueProductsTab vm={vm} />
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatDateTime, formatVND } from "@/lib/api";
import { WebDashboardData } from "@/lib/webApi";
import { TabFeedbackBanner, TabLoadingState, TabEmptyState } from "./WebShared";
import {
  TrendingUp,
  ShoppingCart,
  QrCode,
  MessageSquareMore,
  RefreshCw,
  Award,
  History,
} from "lucide-react";

export default function WebDashboardTab({
  onJumpTab,
}: {
  onJumpTab?: (tabId: string) => void;
}) {
  const [data, setData] = useState<WebDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      const res = await apiRequest<WebDashboardData>(`/cms/web/dashboard${q}`);
      setData(res.data);
    } catch (e: any) {
      setError(e?.message || "Không thể tải dữ liệu Dashboard Website");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const codOrdersCount = data ? Math.max(0, data.totalOrders - data.qrOrdersCount) : 0;
  const qrShare = data && data.totalOrders > 0 ? Math.round((data.qrOrdersCount / data.totalOrders) * 100) : 0;
  const maxProductRev = data?.topProducts?.length
    ? Math.max(...data.topProducts.map((p) => p.revenue || 0), 1)
    : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Từ ngày:</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:border-teal-600 focus:outline-none"
          />
          <label className="text-xs font-bold text-slate-600 ml-1">Đến ngày:</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:border-teal-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới số liệu</span>
        </button>
      </div>

      <TabFeedbackBanner error={error} onClear={() => setError("")} />

      {loading && !data ? (
        <TabLoadingState label="Đang tổng hợp KPI Online..." />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/60">
              <div className="flex items-center justify-between text-teal-800">
                <span className="text-xs font-bold uppercase">Doanh thu Online</span>
                <TrendingUp className="w-4 h-4 text-teal-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900">
                {formatVND(data.totalRevenue)}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-teal-700">
                {data.paidOrdersCount} đơn hợp lệ / {data.totalOrders} tổng đơn
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-bold uppercase">Tổng đơn Online</span>
                <ShoppingCart className="w-4 h-4 text-teal-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900">
                {data.totalOrders}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                QR: {data.qrOrdersCount} đơn · COD: {codOrdersCount} đơn
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-bold uppercase">Tỷ lệ thành công QR</span>
                <QrCode className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-emerald-700">
                {data.qrSuccessRate}%
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, data.qrSuccessRate)}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onJumpTab?.("reviews")}
              className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-left hover:bg-amber-50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-xs font-bold uppercase">Đánh giá chờ duyệt</span>
                <MessageSquareMore className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-amber-900">
                {data.pendingReviewsCount}
              </div>
              <p className="mt-1 text-[11px] font-bold text-amber-700">
                Bấm để kiểm duyệt ngay →
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Top 10 Sản phẩm bán chạy Online
                  </h3>
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  Tỷ trọng QR {qrShare}% / COD {100 - qrShare}%
                </div>
              </div>

              {data.topProducts.length === 0 ? (
                <TabEmptyState
                  title="Chưa có dữ liệu đơn Online trong kỳ"
                  desc="Khi phát sinh đơn hàng từ storefront shop/, top sản phẩm sẽ hiển thị tại đây."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Sản phẩm</th>
                        <th className="py-2 pr-3 text-right">SL bán</th>
                        <th className="py-2 text-right">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topProducts.map((item, idx) => {
                        const pct = Math.round(((item.revenue || 0) / maxProductRev) * 100);
                        return (
                          <tr key={item.productId} className="hover:bg-slate-50">
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 pr-3">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              <div className="mt-1 h-1.5 w-full max-w-[220px] bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-teal-700">
                              {formatVND(item.revenue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-teal-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Thao tác gần nhất</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpTab?.("audit-logs")}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  Xem tất cả
                </button>
              </div>
              {data.recentAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Chưa có nhật ký thao tác.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recentAuditLogs.map((log) => (
                    <div key={log._id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">{log.actorName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 line-clamp-2">{log.diffSummary}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(log.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

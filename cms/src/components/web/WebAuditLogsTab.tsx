"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatDateTime } from "@/lib/api";
import { WebAuditLogItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

export default function WebAuditLogsTab() {
  const [logs, setLogs] = useState<WebAuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (entityType) qs.set("entityType", entityType);
      if (action) qs.set("action", action);
      const res = await apiRequest<WebAuditLogItem[]>(`/cms/web/audit-logs?${qs.toString()}`);
      setLogs(Array.isArray(res.data) ? res.data : []);
      setTotal(Number(res.meta?.total || 0));
    } catch (e: any) {
      setError(e?.message || "Không tải được nhật ký thao tác");
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entityType}
            onChange={(e) => {
              setPage(1);
              setEntityType(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
          >
            <option value="">Tất cả đối tượng</option>
            <option value="WebBanner">Banner</option>
            <option value="WebHomeSection">Bố cục trang chủ</option>
            <option value="WebMenu">Mega Menu</option>
            <option value="ProductWeb">Sản phẩm Web</option>
            <option value="WebArticle">Bài viết</option>
            <option value="WebReview">Đánh giá</option>
            <option value="WebRedirect">301 Redirect</option>
            <option value="WebSiteSetting">Cài đặt Site</option>
            <option value="OrderOnline">Đơn hàng Online</option>
            <option value="WebCache">Cache Revalidate</option>
          </select>
          <select
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
          >
            <option value="">Tất cả hành động</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="PUBLISH">PUBLISH</option>
            <option value="MODERATE">MODERATE</option>
            <option value="REORDER">REORDER</option>
            <option value="REVALIDATE">REVALIDATE</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </div>

      <TabFeedbackBanner error={error} onClear={() => setError("")} />

      {loading ? (
        <TabLoadingState />
      ) : logs.length === 0 ? (
        <TabEmptyState title="Chưa có nhật ký thao tác nào" />
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Người thực hiện</th>
                  <th className="p-3">Hành động</th>
                  <th className="p-3">Đối tượng</th>
                  <th className="p-3">Chi tiết thay đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900">{l.actorName}</span>
                      <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 font-bold">
                        {l.actorRole}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{l.entityType}</td>
                    <td className="p-3 text-slate-700">{l.diffSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Trang <strong>{page}</strong> / {totalPages} (Tổng {total} bản ghi)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

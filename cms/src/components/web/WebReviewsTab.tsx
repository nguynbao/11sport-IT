"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatDateTime } from "@/lib/api";
import { resolveWebMediaUrl, WebReviewItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import { Check, CheckCircle2, Star, X } from "lucide-react";

export default function WebReviewsTab() {
  const [reviews, setReviews] = useState<WebReviewItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiRequest<WebReviewItem[]>(`/cms/web/reviews${q}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setReviews(list);
      const map: Record<string, string> = {};
      list.forEach((r) => {
        map[r._id] = r.adminReply || "";
      });
      setReplyMap(map);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const moderate = async (r: WebReviewItem, status: "APPROVED" | "REJECTED") => {
    setError("");
    try {
      await apiRequest(`/cms/web/reviews/${r._id}/moderate`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          adminReply: replyMap[r._id] || "",
        }),
      });
      setSuccess(
        `${status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"} đánh giá của ${r.customerName}`
      );
      await loadReviews();
    } catch (e: any) {
      setError(e?.message || "Xử lý đánh giá thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Kiểm duyệt Đánh giá Khách hàng</h3>
          <p className="text-xs text-slate-500">
            Duyệt hoặc từ chối đánh giá trước khi hiển thị công khai và tính điểm sao sản phẩm.
          </p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
          {[
            { id: "PENDING" as const, label: "Chờ duyệt" },
            { id: "APPROVED" as const, label: "Đã duyệt" },
            { id: "REJECTED" as const, label: "Đã từ chối" },
            { id: "" as const, label: "Tất cả" },
          ].map((t) => (
            <button
              key={t.id || "ALL"}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === t.id ? "bg-teal-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <TabFeedbackBanner
        error={error}
        success={success}
        onClear={() => {
          setError("");
          setSuccess("");
        }}
      />

      {loading ? (
        <TabLoadingState />
      ) : reviews.length === 0 ? (
        <TabEmptyState title="Không có đánh giá nào trong mục này" />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{r.customerName}</span>
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Đã mua hàng
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < r.rating ? "fill-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    SP: <strong className="text-slate-700">{r.productName || r.productId}</strong> ·{" "}
                    {r.createdAt ? formatDateTime(r.createdAt) : "—"}
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {r.status}
                </span>
              </div>

              <p className="text-sm text-slate-800">{r.comment}</p>

              {r.images && r.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.images.map((img, i) => (
                    <img
                      key={i}
                      src={resolveWebMediaUrl(img)}
                      alt="Review"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={replyMap[r._id] || ""}
                  onChange={(e) => setReplyMap((prev) => ({ ...prev, [r._id]: e.target.value }))}
                  placeholder="Nhập phản hồi của 11 Sport (tùy chọn)..."
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => moderate(r, "APPROVED")}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Duyệt hiển thị</span>
                </button>
                <button
                  type="button"
                  onClick={() => moderate(r, "REJECTED")}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>Từ chối</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

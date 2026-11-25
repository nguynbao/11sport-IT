"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, formatVND } from "@/lib/api";
import { WebPromotionItem } from "@/lib/webApi";
import { TabEmptyState, TabFeedbackBanner, TabLoadingState } from "./WebShared";
import { PauseCircle, Pencil, PlayCircle, Plus, X, Zap } from "lucide-react";

export default function WebPromotionsTab() {
  const [items, setItems] = useState<WebPromotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WebPromotionItem | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT" | "NONE">("PERCENT");
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(100);
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadPromos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<WebPromotionItem[]>("/cms/web/promotions");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách khuyến mãi Online");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setDiscountType("PERCENT");
    setDiscountValue(10);
    setMinOrderAmount(0);
    setMaxDiscountAmount(0);
    setUsageLimit(100);
    setIsFlashSale(false);
    setStatus("ACTIVE");
    setStartDate("");
    setEndDate("");
    setShowModal(true);
  };

  const openEdit = (p: WebPromotionItem) => {
    setEditing(p);
    setCode(p.code);
    setName(p.name);
    setDescription(p.description || "");
    setDiscountType(p.discountType || "PERCENT");
    setDiscountValue(Number(p.discountValue || 0));
    setMinOrderAmount(Number(p.minOrderAmount || 0));
    setMaxDiscountAmount(Number(p.maxDiscountAmount || 0));
    setUsageLimit(Number(p.usageLimit || 0));
    setIsFlashSale(Boolean(p.isFlashSale));
    setStatus(p.status || "ACTIVE");
    setStartDate(p.startDate ? p.startDate.slice(0, 16) : "");
    setEndDate(p.endDate ? p.endDate.slice(0, 16) : "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description,
        applyChannels: ["ONLINE"],
        discountType,
        discountValue: Number(discountValue || 0),
        minOrderAmount: Number(minOrderAmount || 0),
        maxDiscountAmount: Number(maxDiscountAmount || 0),
        usageLimit: Number(usageLimit || 0),
        isFlashSale,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (editing) {
        await apiRequest(`/cms/web/promotions/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã cập nhật khuyến mãi "${payload.code}"`);
      } else {
        await apiRequest("/cms/web/promotions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Đã tạo khuyến mãi Online "${payload.code}"`);
      }
      setShowModal(false);
      await loadPromos();
    } catch (err: any) {
      setError(err?.message || "Lưu khuyến mãi thất bại");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p: WebPromotionItem) => {
    const nextStatus = p.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setError("");
    try {
      await apiRequest(`/cms/web/promotions/${p._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`Đã ${nextStatus === "ACTIVE" ? "kích hoạt" : "tạm dừng"} mã ${p.code}`);
      await loadPromos();
    } catch (e: any) {
      setError(e?.message || "Cập nhật trạng thái thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Khuyến mãi &amp; Coupon Online</h3>
          <p className="text-xs text-slate-500">
            Quản lý mã giảm giá, Flash Sale và giới hạn lượt dùng áp dụng riêng cho kênh Online.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Coupon Online</span>
        </button>
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
      ) : items.length === 0 ? (
        <TabEmptyState title="Chưa có khuyến mãi Online nào" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="p-3">Mã Coupon</th>
                <th className="p-3">Chương trình</th>
                <th className="p-3">Mức giảm &amp; ĐK</th>
                <th className="p-3 text-center">Lượt dùng</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <span className="font-mono font-extrabold px-2 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {p.code}
                    </span>
                    {p.isFlashSale && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        <Zap className="w-3 h-3" /> Flash Sale
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    {p.description && <div className="text-[11px] text-slate-500">{p.description}</div>}
                  </td>
                  <td className="p-3 font-mono">
                    <div className="font-bold text-teal-700">
                      {p.discountType === "PERCENT"
                        ? `Giảm ${p.discountValue || 0}%`
                        : p.discountType === "AMOUNT"
                          ? `Giảm ${formatVND(p.discountValue || 0)}`
                          : "Quà tặng"}
                    </div>
                    {p.minOrderAmount ? (
                      <div className="text-[11px] text-slate-500">Đơn từ {formatVND(p.minOrderAmount)}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-center font-mono">
                    {p.usedCount || 0} / {p.usageLimit || "∞"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded border font-bold text-[11px] ${
                        p.status === "ACTIVE"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-100 border-slate-200 text-slate-500"
                      }`}
                    >
                      {p.status === "ACTIVE" ? "Đang chạy" : "Tạm dừng"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleStatus(p)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                        title={p.status === "ACTIVE" ? "Tạm dừng" : "Kích hoạt"}
                      >
                        {p.status === "ACTIVE" ? (
                          <PauseCircle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <PlayCircle className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-5 py-3.5 flex items-center justify-between">
              <h4 className="font-extrabold text-sm">
                {editing ? `Sửa Coupon: ${editing.code}` : "Tạo Coupon Online mới"}
              </h4>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-teal-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Coupon *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SALE11"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="ACTIVE">Đang chạy (ACTIVE)</option>
                    <option value="PAUSED">Tạm dừng (PAUSED)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên chương trình *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Loại giảm</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="PERCENT">Phần trăm (%)</option>
                    <option value="AMOUNT">Số tiền cố định (₫)</option>
                    <option value="NONE">Quà tặng kèm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giá trị giảm</label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đơn tối thiểu (₫)</label>
                  <input
                    type="number"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giới hạn lượt</label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Từ ngày</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đến ngày</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isFlashSale}
                  onChange={(e) => setIsFlashSale(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Đánh dấu chương trình Flash Sale</span>
              </label>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô tả</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {saving ? "Đang lưu..." : "Lưu Khuyến mãi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

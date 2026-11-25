"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Promotion, PromotionConditionType, PromotionDiscountType, Product, Category } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatVND, formatNumberDots, parseNumberDots, formatDateTime } from "@/shared/utils/format";
import { filterAndRankBySearch } from "@/shared/lib/search";
import {
  Gift,
  Plus,
  Search,
  Calendar,
  Infinity as InfinityIcon,
  Tag,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Pencil,
  Trash2,
  X,
  Layers,
  ShoppingBag,
  Sparkles,
  Clock,
  Check,
} from "lucide-react";
function toDateTimeLocalInput(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
import { PromotionModuleViewModel } from "../hooks/usePromotionModule";
import { PromotionConditionFields } from "./PromotionConditionFields";
import { PromotionRewardFields } from "./PromotionRewardFields";

export function PromotionFormModal({ vm }: { vm: PromotionModuleViewModel }) {
  const {
    errorMsg,
    showModal,
    setShowModal,
    editingPromo,
    submitting,
    name,
    setName,
    description,
    setDescription,
    status,
    setStatus,
    isPermanent,
    setIsPermanent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    applyQuickDuration,
    filteredConditionProducts,
    filteredGiftProducts,
    handleSubmitForm,
  } = vm;

  return (
    <>
      {/* MODAL TẠO / SỬA CHƯƠNG TRÌNH KHUYẾN MÃI */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-teal-600 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingPromo
                      ? `Chỉnh sửa Chương trình Khuyến mãi (${editingPromo.code})`
                      : "Tạo Chương trình Khuyến mãi mới"}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Khi Sales bấm thêm sản phẩm vào giỏ hàng POS, hệ thống sẽ tự động kiểm tra và thêm phụ kiện tặng kèm / giảm giá theo cấu hình dưới đây
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-teal-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Form */}
            <form
              onSubmit={handleSubmitForm}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
            >
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* PHẦN 1: THÔNG TIN CƠ BẢN & THỜI GIAN CHƯƠNG TRÌNH */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-brand-ink" />
                  1. Thông tin Chương trình & Thời gian hiệu lực
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên chương trình khuyến mãi *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Mua Vợt Pickleball mặc định tặng kèm 1 Quấn cán..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Trạng thái kích hoạt
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as "ACTIVE" | "PAUSED")
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="ACTIVE">🟢 Đang bật (ACTIVE)</option>
                      <option value="PAUSED">⏸ Tạm dừng (PAUSED)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả / Ghi chú cho Sales (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="VD: Áp dụng cho mọi khách mua lẻ tại quầy..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                {/* Chọn Thời gian chạy: Chạy vĩnh viễn vs Có thời hạn */}
                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700">
                    Thời gian chạy chương trình:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsPermanent(true)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${isPermanent
                          ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                    >
                      <InfinityIcon className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-xs font-extrabold">
                          Chạy vĩnh viễn (Không giới hạn ngày)
                        </div>
                        <div
                          className={`text-[11px] ${isPermanent ? "text-teal-100" : "text-slate-500"
                            }`}
                        >
                          Luôn tự động áp dụng khi chương trình đang bật
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPermanent(false)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${!isPermanent
                          ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                    >
                      <Calendar className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-xs font-extrabold">
                          Cài đặt thời gian bắt đầu / kết thúc
                        </div>
                        <div
                          className={`text-[11px] ${!isPermanent ? "text-teal-100" : "text-slate-500"
                            }`}
                        >
                          Tự động kích hoạt khi đến hạn & tự ngắt khi hết hạn
                        </div>
                      </div>
                    </button>
                  </div>

                  {!isPermanent && (
                    <div className="p-3.5 rounded-xl bg-white border border-teal-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-teal-900">
                          Chọn khoảng thời gian hiệu lực:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => applyQuickDuration(7)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink text-[11px] font-bold border border-teal-200"
                          >
                            + 7 ngày tới
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDuration(30)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-ink text-[11px] font-bold border border-teal-200"
                          >
                            + 30 ngày tới
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Bắt đầu từ ngày / giờ
                          </label>
                          <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Kết thúc vào ngày / giờ
                          </label>
                          <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

      <PromotionConditionFields vm={vm} />
      <PromotionRewardFields vm={vm} />
              {/* Footer Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md transition"
                >
                  {submitting
                    ? "Đang lưu..."
                    : editingPromo
                      ? "Lưu cập nhật Chương trình"
                      : "Tạo Chương trình Khuyến mãi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


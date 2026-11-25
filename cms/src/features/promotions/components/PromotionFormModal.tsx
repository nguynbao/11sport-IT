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

export function PromotionFormModal({ vm }: { vm: PromotionModuleViewModel }) {
  const {
    products,
    categories,
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
    conditionType,
    setConditionType,
    conditionProductIds,
    setConditionProductIds,
    conditionCategoryIds,
    minQuantity,
    setMinQuantity,
    minOrderAmount,
    setMinOrderAmount,
    condProdSearch,
    setCondProdSearch,
    condProdCatId,
    setCondProdCatId,
    giftItems,
    multiplyGiftByConditionQty,
    setMultiplyGiftByConditionQty,
    giftProdSearch,
    setGiftProdSearch,
    giftProdCatId,
    setGiftProdCatId,
    itemDiscountType,
    setItemDiscountType,
    itemDiscountValue,
    setItemDiscountValue,
    billDiscountType,
    setBillDiscountType,
    billDiscountValue,
    setBillDiscountValue,
    getFloor1Stock,
    getCategoryName,
    productById,
    applyQuickDuration,
    toggleConditionProduct,
    toggleConditionCategory,
    handleAddGiftItem,
    handleChangeGiftItemQty,
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

              {/* PHẦN 2: ĐIỀU KIỆN MUA SẢN PHẨM GÌ */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-brand-ink" />
                  2. Điều kiện áp dụng (Khi khách mua sản phẩm gì?)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConditionType("BUY_PRODUCTS")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${conditionType === "BUY_PRODUCTS"
                        ? "bg-teal-600 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                  >
                    <div>🛍️ Mua Sản phẩm cụ thể</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${conditionType === "BUY_PRODUCTS"
                          ? "text-slate-300"
                          : "text-slate-500"
                        }`}
                    >
                      Chọn 1 hoặc nhiều sản phẩm trong kho
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionType("BUY_CATEGORY")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${conditionType === "BUY_CATEGORY"
                        ? "bg-teal-600 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                  >
                    <div>📂 Mua theo Danh mục (Category)</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${conditionType === "BUY_CATEGORY"
                          ? "text-slate-300"
                          : "text-slate-500"
                        }`}
                    >
                      VD: Cứ mua bất kỳ sản phẩm thuộc danh mục Vợt
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionType("ALL_PRODUCTS")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${conditionType === "ALL_PRODUCTS"
                        ? "bg-teal-600 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                  >
                    <div>🌐 Tất cả sản phẩm / Toàn đơn</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${conditionType === "ALL_PRODUCTS"
                          ? "text-slate-300"
                          : "text-slate-500"
                        }`}
                    >
                      Áp dụng cho mọi sản phẩm hoặc theo tổng tiền đơn
                    </div>
                  </button>
                </div>

                {/* Chọn sản phẩm điều kiện nếu BUY_PRODUCTS */}
                {conditionType === "BUY_PRODUCTS" && (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Đã chọn ({conditionProductIds.length}) sản phẩm điều kiện:
                      </span>
                      <div className="flex items-center gap-2">
                        {filteredConditionProducts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredConditionProducts.map(
                                (p) => p._id
                              );
                              setConditionProductIds((prev) =>
                                Array.from(new Set([...prev, ...ids]))
                              );
                            }}
                            className="text-[11px] font-bold text-brand-ink hover:underline"
                          >
                            + Chọn tất cả SP đang lọc ({filteredConditionProducts.length})
                          </button>
                        )}
                        {conditionProductIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setConditionProductIds([])}
                            className="text-[11px] font-bold text-red-600 hover:underline"
                          >
                            Bỏ chọn hết
                          </button>
                        )}
                      </div>
                    </div>

                    {conditionProductIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-teal-50/60 border border-teal-200">
                        {conditionProductIds.map((pid) => {
                          const prod = productById.get(pid);
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-900 text-xs font-semibold"
                            >
                              <span>{prod?.name || pid}</span>
                              <button
                                type="button"
                                onClick={() => toggleConditionProduct(pid)}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-7 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={condProdSearch}
                          onChange={(e) => setCondProdSearch(e.target.value)}
                          placeholder="Tìm sản phẩm điều kiện (VD: Vợt Joola, Selkirk...)"
                          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <select
                          value={condProdCatId}
                          onChange={(e) => setCondProdCatId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                        >
                          <option value="">📂 Tất cả danh mục ({products.length})</option>
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {filteredConditionProducts.map((p) => {
                        const checked = conditionProductIds.includes(p._id);
                        return (
                          <div
                            key={p._id}
                            onClick={() => toggleConditionProduct(p._id)}
                            className={`px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition ${checked
                                ? "bg-teal-50 font-bold text-teal-900"
                                : "hover:bg-slate-50 text-slate-800"
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${checked
                                    ? "bg-teal-600 border-teal-600 text-white"
                                    : "border-slate-300 bg-white"
                                  }`}
                              >
                                {checked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-slate-500">
                                {formatVND(p.sellingPrice)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                T1: {getFloor1Stock(p)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chọn danh mục điều kiện nếu BUY_CATEGORY */}
                {conditionType === "BUY_CATEGORY" && (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="text-xs font-bold text-slate-800">
                      Chọn danh mục (Category) được áp dụng chương trình:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map((cat) => {
                        const checked = conditionCategoryIds.includes(cat._id);
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => toggleConditionCategory(cat._id)}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition ${checked
                                ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                          >
                            <span className="truncate">{cat.name}</span>
                            {checked && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Số lượng tối thiểu & Giá trị đơn tối thiểu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số lượng sản phẩm mua tối thiểu để kích hoạt
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minQuantity}
                      onChange={(e) =>
                        setMinQuantity(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Giá trị đơn tối thiểu (VND · Để 0 nếu không yêu cầu)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        minOrderAmount > 0 ? formatNumberDots(minOrderAmount) : ""
                      }
                      onChange={(e) =>
                        setMinOrderAmount(parseNumberDots(e.target.value))
                      }
                      placeholder="0 VND (Không yêu cầu)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 3: ƯU ĐÃI TỰ ĐỘNG (TẶNG KÈM PHỤ KIỆN / GIẢM TIỀN) */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  3. Quyền lợi Khuyến mãi (Tự động tặng kèm phụ kiện hoặc Giảm tiền khi thêm giỏ hàng)
                </div>

                {/* 3A. Tặng kèm sản phẩm / phụ kiện */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      A. Mặc định Tặng kèm Phụ kiện / Sản phẩm (0 VND · Trừ Kho Tầng 1)
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={multiplyGiftByConditionQty}
                        onChange={(e) =>
                          setMultiplyGiftByConditionQty(e.target.checked)
                        }
                        className="rounded border-amber-400"
                      />
                      Nhân số lượng quà tặng theo số lượng mua (Mua 1 tặng 1 → Mua 2 tặng 2)
                    </label>
                  </div>

                  {/* Danh sách quà tặng đã chọn */}
                  {giftItems.length > 0 ? (
                    <div className="divide-y divide-amber-100 border border-amber-200 rounded-xl bg-amber-50/40">
                      {giftItems.map((g) => {
                        const prod = productById.get(g.productId);
                        return (
                          <div
                            key={g.productId}
                            className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900">
                                {prod?.name || g.productId}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Giá niêm yết: {formatVND(prod?.sellingPrice || 0)} → Tặng 0 VND · Tồn T1:{" "}
                                {prod ? getFloor1Stock(prod) : 0} {prod?.unit || "Cái"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-600">
                                SL tặng:
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={g.quantity}
                                onChange={(e) =>
                                  handleChangeGiftItemQty(
                                    g.productId,
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-14 px-2 py-1 rounded border border-amber-300 bg-white font-mono font-bold text-center text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeGiftItemQty(g.productId, 0)
                                }
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Chưa chọn sản phẩm/phụ kiện tặng kèm. Tìm và bấm <strong>+ Chọn tặng</strong> ở danh sách dưới đây nếu chương trình có tặng quà.
                    </div>
                  )}

                  {/* Tìm & chọn phụ kiện tặng kèm */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={giftProdSearch}
                        onChange={(e) => setGiftProdSearch(e.target.value)}
                        placeholder="Tìm phụ kiện / sản phẩm tặng kèm (VD: Quấn cán, Dán viền...)"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <select
                        value={giftProdCatId}
                        onChange={(e) => setGiftProdCatId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="">📂 Tất cả danh mục ({products.length})</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredGiftProducts.map((p) => {
                      const selectedGift = giftItems.find(
                        (g) => g.productId === p._id
                      );
                      return (
                        <div
                          key={p._id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-amber-50/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {getCategoryName(p)} · Giá: {formatVND(p.sellingPrice)} · Tồn T1:{" "}
                              {getFloor1Stock(p)} {p.unit}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddGiftItem(p._id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition ${selectedGift
                                ? "bg-amber-600 text-white"
                                : "bg-amber-100 hover:bg-amber-200 text-amber-900"
                              }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {selectedGift
                              ? `Đang tặng (${selectedGift.quantity})`
                              : "Chọn tặng"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3B & 3C: Giảm giá trên sản phẩm mua & Giảm giá tổng Bill */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Giảm giá sản phẩm */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-rose-600" />
                      B. Tự động Giảm giá trên Sản phẩm mua
                    </div>
                    <select
                      value={itemDiscountType}
                      onChange={(e) => {
                        setItemDiscountType(
                          e.target.value as PromotionDiscountType
                        );
                        setItemDiscountValue(0);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="NONE">Không giảm giá SP</option>
                      <option value="PERCENT">Giảm theo % trên từng SP</option>
                      <option value="AMOUNT">Giảm số tiền (VND / 1 SP)</option>
                    </select>

                    {itemDiscountType === "PERCENT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={itemDiscountValue || ""}
                          onChange={(e) =>
                            setItemDiscountValue(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          placeholder="VD: 10"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          % / SP
                        </span>
                      </div>
                    )}

                    {itemDiscountType === "AMOUNT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            itemDiscountValue > 0
                              ? formatNumberDots(itemDiscountValue)
                              : ""
                          }
                          onChange={(e) =>
                            setItemDiscountValue(parseNumberDots(e.target.value))
                          }
                          placeholder="VD: 50.000"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          VND / SP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Giảm giá tổng Bill */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-rose-600" />
                      C. Tự động Giảm giá trên Tổng Bill
                    </div>
                    <select
                      value={billDiscountType}
                      onChange={(e) => {
                        setBillDiscountType(
                          e.target.value as PromotionDiscountType
                        );
                        setBillDiscountValue(0);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="NONE">Không giảm tổng Bill</option>
                      <option value="PERCENT">Giảm tổng Bill theo %</option>
                      <option value="AMOUNT">Giảm tổng Bill số tiền (VND)</option>
                    </select>

                    {billDiscountType === "PERCENT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={billDiscountValue || ""}
                          onChange={(e) =>
                            setBillDiscountValue(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          placeholder="VD: 5"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          % Bill
                        </span>
                      </div>
                    )}

                    {billDiscountType === "AMOUNT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            billDiscountValue > 0
                              ? formatNumberDots(billDiscountValue)
                              : ""
                          }
                          onChange={(e) =>
                            setBillDiscountValue(parseNumberDots(e.target.value))
                          }
                          placeholder="VD: 100.000"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          VND
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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

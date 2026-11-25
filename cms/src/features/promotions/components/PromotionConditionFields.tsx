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

export function PromotionConditionFields({ vm }: { vm: PromotionModuleViewModel }) {
  const {
    products,
    categories,
    name,
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
    getFloor1Stock,
    productById,
    toggleConditionProduct,
    toggleConditionCategory,
    filteredConditionProducts,
  } = vm;

  return (
    <>
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

    </>
  );
}

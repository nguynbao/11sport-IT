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

export function PromotionRewardFields({ vm }: { vm: PromotionModuleViewModel }) {
  const {
    products,
    categories,
    name,
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
    handleAddGiftItem,
    handleChangeGiftItemQty,
    filteredGiftProducts,
  } = vm;

  return (
    <>
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

    </>
  );
}

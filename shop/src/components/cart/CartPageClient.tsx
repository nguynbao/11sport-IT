"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift, Minus, Plus, Tag, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPriceByCurrency, resolveMediaUrl } from "@/lib/format";
import {
  calculatePerVariantCartPricing,
  DEFAULT_GIFT_TIERS,
} from "@/lib/pricingAndSearch";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import type { CartPriceResponse } from "@/types/storefront";

const DEFAULT_FREESHIP_THRESHOLD = 0;

export function CartPageClient() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const currency = useCurrencyStore((s) => s.currency);

  const [mounted, setMounted] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [pricing, setPricing] = useState<CartPriceResponse | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem("11sport_checkout_prefs");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          couponCode?: string;
          selectedGiftProductId?: string;
        };
        if (parsed.couponCode) {
          setCouponInput(parsed.couponCode);
          setAppliedCoupon(parsed.couponCode);
        }
        if (parsed.selectedGiftProductId) {
          setSelectedGiftId(parsed.selectedGiftProductId);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const syncCartPrice = useCallback(
    async (coupon: string, giftId: string) => {
      if (!items.length) {
        setPricing(null);
        return;
      }
      setLoadingPrice(true);
      try {
        const res = await apiFetch<{ data: CartPriceResponse }>(
          "/public/cart/price",
          {
            method: "POST",
            body: JSON.stringify({
              items: items.map((i) => ({
                productId: i.productId,
                variantKey: i.variantId,
                quantity: i.quantity,
              })),
              couponCode: coupon || undefined,
              selectedGiftProductId: giftId || undefined,
            }),
          }
        );
        if (res?.data) {
          setPricing(res.data);
          if (
            res.data.eligibleGifts?.length > 0 &&
            !res.data.eligibleGifts.some((g) => g.productId === giftId)
          ) {
            setSelectedGiftId(res.data.eligibleGifts[0].productId);
          }
        }
      } catch {
        setPricing(null);
      } finally {
        setLoadingPrice(false);
      }
    },
    [items]
  );

  useEffect(() => {
    if (!mounted) return;
    syncCartPrice(appliedCoupon, selectedGiftId);
  }, [mounted, items, appliedCoupon, selectedGiftId, syncCartPrice]);

  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(
        "11sport_checkout_prefs",
        JSON.stringify({
          couponCode: appliedCoupon || undefined,
          selectedGiftProductId: selectedGiftId || undefined,
        })
      );
    } catch {
      // Ignore
    }
  }, [mounted, appliedCoupon, selectedGiftId]);

  if (!mounted) {
    return <div className="h-64 bg-[#f8f9f5] animate-pulse" />;
  }

  // Empty Cart 1:1 mipik.vn
  if (items.length === 0) {
    return (
      <div className="py-14 sm:py-20 px-4 text-center space-y-5 bg-white">
        <p className="text-[15px] text-[#333333]">
          Chưa có sản phẩm nào trong giỏ hàng.
        </p>
        <Link
          href="/vot-pickleball"
          className="inline-flex items-center justify-center h-[39px] px-7 rounded-none bg-[linear-gradient(90deg,#224e40_0%,#224e40_52%,#b5c7be_100%)] text-white text-[13px] font-bold uppercase tracking-wider transition-opacity hover:opacity-95 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
        >
          QUAY TRỞ LẠI CỬA HÀNG
        </Link>
      </div>
    );
  }

  const localSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const localPricing = calculatePerVariantCartPricing(
    items.map((item) => ({
      productId: item.productId,
      variantKey: item.variantId,
      quantity: item.quantity,
      regularPrice: item.price,
      bulkTiers:
        item.price > 500_000
          ? [
              {
                minQty: 3,
                unitPrice: Math.max(0, item.price - 100_000),
                label: "Mua từ 3 sản phẩm cùng biến thể",
              },
              {
                minQty: 5,
                unitPrice: Math.max(0, item.price - 200_000),
                label: "Mua từ 5 sản phẩm cùng biến thể",
              },
            ]
          : [],
    }))
  );

  const rawSubtotal = pricing?.rawSubtotal ?? localSubtotal;
  const tierDiscountTotal =
    pricing?.tierDiscountTotal ?? localPricing.bulkDiscountSaved;
  const couponDiscount = pricing?.couponDiscount ?? 0;
  const freeShipThreshold =
    pricing?.freeShipThreshold ?? DEFAULT_FREESHIP_THRESHOLD;
  const shippingFee =
    pricing?.shippingFee ?? (rawSubtotal >= freeShipThreshold ? 0 : 30_000);
  const totalAmount =
    pricing?.totalAmount ??
    Math.max(0, rawSubtotal - tierDiscountTotal - couponDiscount + shippingFee);
  const eligibleGifts =
    pricing?.eligibleGifts ??
    (localPricing.unlockedGift
      ? [
          {
            productId: `local-gift-${localPricing.unlockedGift.minQty}`,
            productName: localPricing.unlockedGift.rewardTitle,
            quantity: 1,
          },
        ]
      : []);

  const activeGift =
    eligibleGifts.find((g) => g.productId === selectedGiftId) ||
    eligibleGifts[0] ||
    null;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const nextMilestone = localPricing.nextGiftTier;
  const progressPct = Math.min(
    100,
    Math.round((totalQty / (nextMilestone?.minQty || 5)) * 100)
  );

  return (
    <div className="space-y-10">
      {/* 7:5 Divided Flatsome Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 items-start">
        {/* LEFT 7 COLS: Cart Table + Continue/Update Buttons */}
        <div className="lg:col-span-7 lg:border-r lg:border-[#ececec] lg:pr-8">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b-[3px] border-[#ececec] text-[#777777] text-[12px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 text-left">SẢN PHẨM</th>
                  <th className="hidden sm:table-cell py-2.5 text-right whitespace-nowrap pl-3">
                    GIÁ
                  </th>
                  <th className="py-2.5 text-center whitespace-nowrap pl-3">
                    SỐ LƯỢNG
                  </th>
                  <th className="hidden sm:table-cell py-2.5 text-right whitespace-nowrap pl-3">
                    TẠM TÍNH
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#ececec]">
                {items.map((item) => {
                  const lineCalc = localPricing.lines.find(
                    (l) =>
                      l.productId === item.productId &&
                      l.variantKey === item.variantId
                  );
                  const effectiveUnit =
                    lineCalc?.effectiveUnitPrice ?? item.price;
                  const lineSubtotal =
                    lineCalc?.lineSubtotal ?? item.price * item.quantity;

                  return (
                    <tr key={item.variantId}>
                      {/* Product cell */}
                      <td className="py-4 pr-2 align-middle">
                        <div className="flex items-center gap-3">
                          {/* Desktop Remove Circle Button */}
                          <button
                            type="button"
                            onClick={() => removeItem(item.variantId)}
                            aria-label={`Xóa ${item.name}`}
                            className="hidden sm:inline-flex w-6 h-6 rounded-full border border-[#cccccc] text-[#888888] hover:border-[#0a0a0a] hover:text-[#0a0a0a] items-center justify-center shrink-0 transition-colors"
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>

                          {/* Square Image + Mobile Remove Overlay */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => removeItem(item.variantId)}
                              aria-label={`Xóa ${item.name}`}
                              className="sm:hidden absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full border border-[#cccccc] bg-white text-[#666666] inline-flex items-center justify-center shadow-sm"
                            >
                              <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <Link
                              href={`/${item.slug}`}
                              className="relative block w-[64px] h-[64px] sm:w-[74px] sm:h-[74px] bg-white border border-[#eeeeee] overflow-hidden"
                            >
                              {resolveMediaUrl(item.imageUrl) ? (
                                <Image
                                  src={resolveMediaUrl(item.imageUrl)}
                                  alt={item.name}
                                  fill
                                  sizes="74px"
                                  className="object-contain p-1"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#888888]">
                                  11Sport
                                </div>
                              )}
                            </Link>
                          </div>

                          {/* Product Name, Variant & Mobile inline qty × price */}
                          <div className="min-w-0 space-y-0.5">
                            <Link
                              href={`/${item.slug}`}
                              className="text-[13.5px] sm:text-[14px] font-medium text-[#224e40] hover:text-[#186746] line-clamp-2 leading-snug block"
                            >
                              {item.name}
                            </Link>
                            {(item.colorName || item.sizeName) && (
                              <p className="text-[12px] text-[#777777]">
                                {[item.colorName, item.sizeName]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {lineCalc?.appliedBulkTierMinQty && (
                              <p className="text-[11.5px] font-semibold text-[#204b3e]">
                                Giá sỉ bậc {lineCalc.appliedBulkTierMinQty}+:{" "}
                                {formatPriceByCurrency(effectiveUnit, currency)}/sp
                              </p>
                            )}
                            <p className="sm:hidden text-[12.5px] text-[#555555] pt-0.5 tabular-nums">
                              {item.quantity} ×{" "}
                              <strong className="text-[#0a0a0a]">
                                {formatPriceByCurrency(effectiveUnit, currency)}
                              </strong>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Desktop Unit Price */}
                      <td className="hidden sm:table-cell py-4 pl-3 text-right font-bold text-[#0a0a0a] tabular-nums whitespace-nowrap align-middle">
                        {formatPriceByCurrency(effectiveUnit, currency)}
                      </td>

                      {/* Quantity Capsule Stepper */}
                      <td className="py-4 pl-3 text-center align-middle">
                        <div className="inline-flex items-center h-[36px] rounded-full border border-[#dddddd] bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            aria-label={`Giảm số lượng ${item.name}`}
                            className="w-7 sm:w-8 h-full inline-flex items-center justify-center text-[#555555] hover:bg-[#f5f5f5]"
                          >
                            <Minus className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <span className="w-7 sm:w-8 text-center text-[13px] font-semibold text-[#0a0a0a] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            aria-label={`Tăng số lượng ${item.name}`}
                            className="w-7 sm:w-8 h-full inline-flex items-center justify-center text-[#555555] hover:bg-[#f5f5f5]"
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </td>

                      {/* Desktop Line Subtotal */}
                      <td className="hidden sm:table-cell py-4 pl-3 text-right font-bold text-[#0a0a0a] tabular-nums whitespace-nowrap align-middle">
                        {formatPriceByCurrency(lineSubtotal, currency)}
                      </td>
                    </tr>
                  );
                })}

                {/* Unlocked Gift Table Row (1:1 mipik.vn: non-removable 0đ row) */}
                {activeGift && (
                  <tr className="bg-[#f8f9f5]/55">
                    <td className="py-4 pr-2 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="hidden sm:inline-block w-6 shrink-0" />
                        <div className="w-[64px] h-[64px] sm:w-[74px] sm:h-[74px] bg-white border border-[#dce5da] shrink-0 flex items-center justify-center text-[11px] font-bold uppercase text-[#204b3e] text-center p-1">
                          Quà tặng
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[13.5px] sm:text-[14px] font-semibold text-[#204b3e] leading-snug">
                            {activeGift.productName}
                          </p>
                          <p className="text-[12px] text-[#4a6b5d]">
                            Quà tặng 11Sport: Miễn phí
                          </p>
                          <p className="sm:hidden text-[12.5px] text-[#555555] pt-0.5 tabular-nums">
                            1 × <strong className="text-[#0a0a0a]">0₫</strong>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell py-4 pl-3 text-right font-bold text-[#0a0a0a] tabular-nums align-middle">
                      0₫
                    </td>
                    <td className="py-4 pl-3 text-center font-medium text-[#555555] tabular-nums align-middle">
                      {activeGift.quantity || 1}
                    </td>
                    <td className="hidden sm:table-cell py-4 pl-3 text-right font-bold text-[#0a0a0a] tabular-nums align-middle">
                      0₫
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Continue Shopping & Update Cart Actions */}
          <div className="pt-5 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3">
            <Link
              href="/vot-pickleball"
              className="inline-flex items-center justify-center h-[39px] px-4 rounded-none border border-[#224e40] bg-[linear-gradient(90deg,#d8e5de_0%,#edf2ee_50%,#f8eee9_100%)] hover:brightness-95 text-[#142e25] text-[12.5px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
            >
              ← TIẾP TỤC XEM SẢN PHẨM
            </Link>

            <button
              type="button"
              onClick={() => syncCartPrice(appliedCoupon, selectedGiftId)}
              disabled={loadingPrice}
              className="inline-flex items-center justify-center h-[39px] px-5 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[12.5px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {loadingPrice ? "ĐANG CẬP NHẬT..." : "CẬP NHẬT GIỎ HÀNG"}
            </button>
          </div>
        </div>

        {/* RIGHT 5 COLS: TỔNG CỘNG GIỎ HÀNG + COUPON BELOW CTA */}
        <aside className="lg:col-span-5 lg:pl-8 space-y-5">
          <div>
            <h2 className="text-[13.5px] font-bold uppercase tracking-wider text-[#0a0a0a] border-b-[3px] border-[#ececec] pb-2.5">
              TỔNG CỘNG GIỎ HÀNG
            </h2>

            <div className="divide-y divide-[#ececec] text-[13.5px]">
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-[#555555]">Tạm tính</span>
                <span className="font-bold text-[#0a0a0a] tabular-nums">
                  {formatPriceByCurrency(rawSubtotal, currency)}
                </span>
              </div>

              {tierDiscountTotal > 0 && (
                <div className="py-3 flex items-center justify-between gap-3 text-[#204b3e]">
                  <span>Tiết kiệm Giá Mua Nhiều</span>
                  <span className="font-bold tabular-nums">
                    -{formatPriceByCurrency(tierDiscountTotal, currency)}
                  </span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="py-3 flex items-center justify-between gap-3 text-[#204b3e]">
                  <span>Mã ưu đãi</span>
                  <span className="font-bold tabular-nums">
                    -{formatPriceByCurrency(couponDiscount, currency)}
                  </span>
                </div>
              )}

              <div className="py-3 flex items-start justify-between gap-4">
                <span className="text-[#555555] shrink-0">Vận chuyển</span>
                <div className="text-right space-y-1">
                  <p className="font-medium text-[#333333]">
                    {shippingFee === 0
                      ? "Miễn phí vận chuyển"
                      : formatPriceByCurrency(shippingFee, currency)}
                  </p>
                  <p className="text-[12px] text-[#777777] leading-snug max-w-[230px] ml-auto">
                    Các tùy chọn vận chuyển sẽ được cập nhật trong quá trình
                    thanh toán.
                  </p>
                </div>
              </div>

              <div className="py-3.5 border-b-2 border-[#ececec] flex items-center justify-between gap-3">
                <span className="font-bold text-[#333333]">Tổng</span>
                <span className="text-[15.5px] font-bold text-[#0a0a0a] tabular-nums">
                  {loadingPrice ? "..." : formatPriceByCurrency(totalAmount, currency)}
                </span>
              </div>
            </div>

            <div className="pt-4">
              <Link
                href="/thanh-toan"
                className="w-full h-[42px] rounded-none inline-flex items-center justify-center bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
              >
                TIẾN HÀNH THANH TOÁN
              </Link>
            </div>
          </div>

          {/* Coupon Form Below Checkout CTA (1:1 mipik.vn) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedCoupon(couponInput.trim().toUpperCase());
            }}
            className="pt-2 space-y-3"
          >
            <div className="flex items-center gap-2 pb-2 border-b-[3px] border-[#ececec] text-[13.5px] font-bold text-[#333333]">
              <Tag className="w-4 h-4 text-[#888888]" aria-hidden="true" />
              <label htmlFor="cart-coupon">Mã ưu đãi</label>
            </div>

            <input
              id="cart-coupon"
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Nhập mã giảm giá"
              className="w-full h-[39px] px-3 rounded-none border border-[#dddddd] bg-white text-[13.5px] text-[#0a0a0a] placeholder:text-[#999999] focus:outline-none focus:border-[#224e40]"
            />

            <button
              type="submit"
              className="w-full h-[39px] rounded-none bg-[#f7f7f7] hover:bg-[#eeeeee] border border-[#dddddd] text-[13.5px] font-medium text-[#555555] transition-colors"
            >
              Áp dụng
            </button>

            {pricing?.couponError && (
              <p className="text-xs text-[#dd3333] font-medium">
                {pricing.couponError}
              </p>
            )}
            {pricing?.couponApplied && (
              <p className="text-xs text-[#204b3e] font-bold">
                Đã áp dụng mã {pricing.couponApplied.code}:{" "}
                {pricing.couponApplied.name}
              </p>
            )}
          </form>
        </aside>
      </div>

      {/* FULL-WIDTH BELOW: 11SPORT EXCLUSIVE REWARDS (#f8f9f5 / #dce5da / 14px) */}
      <section className="max-w-[1100px] mx-auto rounded-[14px] bg-[#f8f9f5] border border-[#dce5da] p-5 sm:p-6 text-[#204b3e] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e2ebe1]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#4a6b5d]">
              11SPORT EXCLUSIVE REWARDS
            </p>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#204b3e] mt-0.5">
              Chọn quà tặng của bạn
            </h2>
          </div>
          <span className="px-3.5 py-1 rounded-full bg-[#204b3e] text-white text-xs font-bold uppercase tracking-wide tabular-nums">
            {eligibleGifts.length > 0 ? "1 / 1 QUÀ" : "0 / 1 QUÀ"}
          </span>
        </div>

        {eligibleGifts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {eligibleGifts.map((gift) => {
              const isSelected =
                selectedGiftId === gift.productId || eligibleGifts.length === 1;
              return (
                <label
                  key={gift.productId}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-3 p-3.5 rounded-[9px] cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#edf5ed] border-2 border-[#204e40]"
                      : "bg-white border border-[#dce5da] hover:border-[#204e40]"
                  }`}
                >
                  <input
                    type="radio"
                    name="cart-gift"
                    value={gift.productId}
                    checked={isSelected}
                    onChange={() => setSelectedGiftId(gift.productId)}
                    className="accent-[#204e40]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-[#204b3e] leading-snug">
                      {gift.productName}
                    </p>
                    <p className="text-xs text-[#4a6b5d] mt-0.5">
                      Tự động đính kèm cùng đơn hàng · Miễn phí 0₫
                    </p>
                  </div>
                  <Gift className="w-4 h-4 text-[#204b3e] shrink-0" aria-hidden="true" />
                </label>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium">
              <span>
                {nextMilestone
                  ? `Mua thêm ${nextMilestone.itemsNeeded} sản phẩm để mở khóa: ${nextMilestone.rewardTitle}`
                  : "Chọn từ 5 sản phẩm trở lên để nhận áo Polo 11Sport Dry-Fit miễn phí."}
              </span>
              <span className="font-bold tabular-nums">
                {totalQty} / {nextMilestone?.minQty || 5} SP
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-white border border-[#dce5da] overflow-hidden">
              <div
                className="h-full bg-[#204b3e] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {DEFAULT_GIFT_TIERS.map((tier) => (
                <div
                  key={tier.minQty}
                  className="bg-white rounded-[9px] border border-[#dce5da] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-[13px]"
                >
                  <span className="font-medium text-[#204b3e]">
                    {tier.rewardTitle}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#edf5ed] text-[#204b3e] font-bold shrink-0">
                    0₫
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

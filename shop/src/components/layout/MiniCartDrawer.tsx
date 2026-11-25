"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { formatPriceByCurrency, resolveMediaUrl } from "@/lib/format";
import { calculatePerVariantCartPricing } from "@/lib/pricingAndSearch";

export function MiniCartDrawer() {
  const items = useCartStore((s) => s.items);
  const isDrawerOpen = useCartStore((s) => s.isDrawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const currency = useCurrencyStore((s) => s.currency);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  if (!mounted || !isDrawerOpen) {
    return null;
  }

  const pricing = calculatePerVariantCartPricing(
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ hàng của bạn"
    >
      <div
        className="fixed inset-0 bg-[#0a0a0a]/45"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[380px] bg-white h-full shadow-[0_12px_36px_rgba(0,0,0,0.16)] flex flex-col">
        {/* Minimal Header: GIỎ HÀNG + Close */}
        <div className="px-5 h-14 border-b border-[#ececec] flex items-center justify-between shrink-0">
          <h2 className="text-[14px] font-bold text-[#0a0a0a] uppercase tracking-wider">
            GIỎ HÀNG ({pricing.totalQuantity})
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Đóng giỏ hàng"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-[#666666] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-2 space-y-5">
              <p className="text-[14px] text-[#333333]">
                Chưa có sản phẩm nào trong giỏ hàng.
              </p>
              <Link
                href="/vot-pickleball"
                onClick={closeDrawer}
                className="inline-flex items-center justify-center h-[39px] px-6 rounded-none bg-[linear-gradient(90deg,#224e40_0%,#224e40_52%,#b5c7be_100%)] text-white text-[13px] font-bold uppercase tracking-wider transition-opacity hover:opacity-95 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
              >
                QUAY TRỞ LẠI CỬA HÀNG
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#ececec]">
              {items.map((item) => {
                const lineCalc = pricing.lines.find(
                  (l) =>
                    l.productId === item.productId &&
                    l.variantKey === item.variantId
                );
                const effectiveUnit =
                  lineCalc?.effectiveUnitPrice ?? item.price;

                return (
                  <li key={item.variantId} className="py-3.5 flex gap-3 items-start">
                    <Link
                      href={`/${item.slug}`}
                      onClick={closeDrawer}
                      className="relative w-[60px] h-[60px] bg-white border border-[#eeeeee] overflow-hidden shrink-0"
                    >
                      {resolveMediaUrl(item.imageUrl) ? (
                        <Image
                          src={resolveMediaUrl(item.imageUrl)}
                          alt={item.name}
                          fill
                          sizes="60px"
                          className="object-contain p-0.5"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#888888]">
                          11Sport
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/${item.slug}`}
                          onClick={closeDrawer}
                          className="text-[13.5px] font-medium text-[#224e40] hover:text-[#186746] line-clamp-2 leading-snug"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                          className="w-6 h-6 rounded-full border border-[#cccccc] text-[#888888] hover:border-[#0a0a0a] hover:text-[#0a0a0a] inline-flex items-center justify-center shrink-0 transition-colors"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>

                      {(item.colorName || item.sizeName) && (
                        <p className="text-[11.5px] text-[#777777] mt-0.5">
                          {[item.colorName, item.sizeName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[12.5px] text-[#555555] tabular-nums">
                          {item.quantity} ×{" "}
                          <strong className="text-[#0a0a0a] font-bold">
                            {formatPriceByCurrency(effectiveUnit, currency)}
                          </strong>
                        </span>

                        <div className="inline-flex items-center border border-[#dddddd] rounded-full bg-white h-7">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            aria-label={`Giảm số lượng ${item.name}`}
                            className="w-6 h-full inline-flex items-center justify-center text-[#555555] hover:text-[#0a0a0a]"
                          >
                            <Minus className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold text-[#0a0a0a] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            aria-label={`Tăng số lượng ${item.name}`}
                            className="w-6 h-full inline-flex items-center justify-center text-[#555555] hover:text-[#0a0a0a]"
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}

              {/* Unlocked Free Gift Row (no remove button) */}
              {pricing.unlockedGift && (
                <li className="py-3.5 flex gap-3 items-start bg-[#f8f9f5]/60 -mx-5 px-5">
                  <div className="relative w-[60px] h-[60px] bg-white border border-[#dce5da] overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold uppercase text-[#204b3e] text-center p-1">
                    Quà 11Sport
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[#204b3e] leading-snug">
                      {pricing.unlockedGift.rewardTitle}
                    </p>
                    <p className="text-[11.5px] text-[#4a6b5d] mt-0.5">
                      Quà tặng 11Sport: Miễn phí
                    </p>
                    <p className="text-[12.5px] text-[#555555] mt-1 tabular-nums">
                      1 × <strong className="text-[#0a0a0a]">0₫</strong>
                    </p>
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Footer: Tổng số phụ + 2 sharp full-width #224e40 CTA buttons */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#ececec] bg-white space-y-2.5 shrink-0">
            {pricing.bulkDiscountSaved > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold text-[#224e40]">
                <span>Tiết kiệm giá mua nhiều</span>
                <span className="tabular-nums">
                  -{formatPriceByCurrency(pricing.bulkDiscountSaved, currency)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pb-1">
              <span className="text-[14px] font-bold text-[#333333]">
                Tổng số phụ:
              </span>
              <span className="text-[15px] font-bold text-[#0a0a0a] tabular-nums">
                {formatPriceByCurrency(pricing.totalPayable, currency)}
              </span>
            </div>

            <div className="space-y-2">
              <Link
                href="/gio-hang"
                onClick={closeDrawer}
                className="w-full h-[39px] rounded-none inline-flex items-center justify-center bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
              >
                XEM GIỎ HÀNG
              </Link>
              <Link
                href="/thanh-toan"
                onClick={closeDrawer}
                className="w-full h-[39px] rounded-none inline-flex items-center justify-center bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
              >
                THANH TOÁN
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Package } from "lucide-react";
import {
  calcDiscountPercent,
  formatPriceByCurrency,
  resolveMediaUrl,
} from "@/lib/format";
import { getLocaleFromPath, localizeHref, STORE_I18N } from "@/lib/i18n";
import { buildCartVariantId } from "@/lib/pricingAndSearch";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem } from "@/types/storefront";

interface ProductCardProps {
  product: ProductListItem;
  density?: "home" | "category";
}

/**
 * Product Card 1:1 with live mipik.vn:
 * - Home density: 14px radius, #ebebeb border, centered title/swatches/price, 0 CTA buttons
 * - Category density: 8px radius, #eeeeee border, left-aligned title/swatches/price, compact gradient CTA (`CHỌN` / `THÊM VÀO GIỎ HÀNG`)
 * - Top-left dark forest `-N%` pill + Bottom-left dark forest `TẶNG ÁO` (or `Mới`) pill
 */
export function ProductCard({
  product,
  density = "home",
}: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const currency = useCurrencyStore((s) => s.currency);
  const pathname = usePathname() || "/";
  const locale = getLocaleFromPath(pathname);
  const t = STORE_I18N[locale].product;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeCurrency = mounted ? currency : "VND";

  const defaultImage =
    product.thumbnailUrl ||
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    "/images/mock/paddle-joola-red.svg";

  const [selectedColorIdx, setSelectedColorIdx] = useState<number>(0);
  const colors = product.colors ?? [];
  const activeColor = colors[selectedColorIdx];
  const displayImage = activeColor?.imageUrl || defaultImage;
  const resolvedDisplayImage = resolveMediaUrl(displayImage);

  const galleryPool: string[] = [];
  for (const raw of [
    defaultImage,
    ...(product.images ?? []).map((img) => img.url),
    ...colors.map((c) => c.imageUrl),
  ]) {
    const resolved = resolveMediaUrl(raw);
    if (resolved && !galleryPool.includes(resolved)) {
      galleryPool.push(resolved);
    }
  }
  const hoverImage =
    galleryPool.find((url) => url !== resolvedDisplayImage) ?? null;

  const discountPercent = calcDiscountPercent(
    product.sellingPrice,
    product.compareAtPrice
  );

  const visibleColors = colors.slice(0, 5);
  const extraColorCount = Math.max(0, colors.length - 5);
  const productHref = localizeHref(`/${product.slug}`, locale);
  const isCategory = density === "category";

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) return;

    addItem({
      variantId: buildCartVariantId(product._id, {
        colorName: activeColor?.color,
      }),
      productId: product._id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand?.name || "11Sport",
      sku: product.code,
      imageUrl: displayImage,
      colorName: activeColor?.color,
      price: product.sellingPrice,
      compareAtPrice: product.compareAtPrice,
      quantity: 1,
      maxStock: product.stockAvailable,
    });
  };

  return (
    <article
      className={`group flex flex-col h-full bg-white p-2.5 sm:p-3 ${
        isCategory
          ? "rounded-[8px] border border-[#eeeeee] text-left"
          : "mipik-card-lift rounded-[14px] border border-[#ebebeb] text-center"
      }`}
    >
      {/* 1. Square Image Box with Top-Left Discount & Bottom-Left Gift/New Pill */}
      <Link
        href={productHref}
        className="group/img relative aspect-square bg-white rounded-lg overflow-hidden block"
      >
        {resolvedDisplayImage ? (
          <>
            <Image
              src={resolvedDisplayImage}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
              className={`object-contain p-1.5 transition-all duration-300 ease-out ${
                hoverImage
                  ? "group-hover/img:opacity-0 group-hover/img:scale-[1.03] motion-reduce:group-hover/img:opacity-100"
                  : "group-hover/img:scale-105 motion-reduce:group-hover/img:scale-100"
              }`}
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={`${product.name} - ảnh tiếp theo`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
                className="object-contain p-1.5 opacity-0 transition-all duration-300 ease-out group-hover/img:opacity-100 group-hover/img:scale-[1.03] pointer-events-none motion-reduce:hidden"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-300">
            <Package className="w-10 h-10 stroke-[1.5]" aria-hidden="true" />
          </div>
        )}

        {/* Top-left Discount Pill */}
        {discountPercent > 0 && (
          <span className="absolute top-2 left-1.5 z-10 px-2.5 py-0.5 rounded-full bg-store-forest text-white text-[11px] font-bold leading-tight whitespace-nowrap">
            -{discountPercent}%
          </span>
        )}

        {/* Top-right `Mới` pill only if product also carries `TẶNG ÁO` */}
        {product.isNew && product.hasGift && (
          <span className="absolute top-2 right-1.5 z-10 px-2.5 py-0.5 rounded-full bg-store-forest text-white text-[11px] font-bold leading-tight whitespace-nowrap">
            {t.newBadge}
          </span>
        )}

        {/* Bottom-left Gift Pill (`TẶNG ÁO`) or `Mới` */}
        {(product.hasGift || (product.isNew && !product.hasGift)) && (
          <div className="absolute bottom-2 left-1.5 z-10 flex items-center gap-1">
            {product.hasGift && (
              <span className="px-2.5 py-1 rounded-full bg-store-forest text-white text-[11px] font-bold uppercase tracking-wide leading-none whitespace-nowrap">
                {t.freeGiftBadge}
              </span>
            )}
            {product.isNew && !product.hasGift && (
              <span className="px-2.5 py-1 rounded-full bg-store-forest text-white text-[11px] font-bold leading-none whitespace-nowrap">
                {t.newBadge}
              </span>
            )}
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-ink-primary text-white text-xs font-bold">
              {t.outOfStock}
            </span>
          </div>
        )}
      </Link>

      {/* 2. Square 30x30 Color Swatches (up to 5) + Plain `+N` Overflow */}
      {visibleColors.length > 0 && (
        <div
          className={`pt-2.5 flex flex-wrap items-center gap-1.5 min-h-[38px] ${
            isCategory ? "justify-start" : "justify-center"
          }`}
        >
          {visibleColors.map((col, idx) => {
            const thumb = resolveMediaUrl(col.imageUrl || defaultImage);
            const isSelected = idx === selectedColorIdx;
            return (
              <button
                key={`${col.color}-${idx}`}
                type="button"
                onClick={() => setSelectedColorIdx(idx)}
                onMouseEnter={() => setSelectedColorIdx(idx)}
                aria-label={`Chọn màu ${col.color} cho ${product.name}`}
                aria-pressed={isSelected}
                className={`relative w-[30px] h-[30px] rounded-[3px] border overflow-hidden bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-forest ${
                  isSelected
                    ? "border-store-forest ring-1 ring-store-forest"
                    : "border-[#dcdcdc] hover:border-store-forest"
                }`}
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={col.color}
                    fill
                    sizes="30px"
                    className="object-contain p-0.5"
                  />
                ) : (
                  <span
                    className="block w-full h-full"
                    style={{ backgroundColor: col.colorHexes?.[0] || "#224E40" }}
                  />
                )}
              </button>
            );
          })}
          {extraColorCount > 0 && (
            <span className="text-xs font-bold text-ink-primary pl-0.5">
              +{extraColorCount}
            </span>
          )}
        </div>
      )}

      {/* 3. Product Title */}
      <div className={isCategory ? "pt-2" : "pt-2 px-1"}>
        <Link
          href={productHref}
          className={`text-[13.5px] sm:text-[14px] text-[#1e2c26] hover:text-store-forest line-clamp-2 min-h-[38px] block leading-snug ${
            isCategory ? "font-normal text-left" : "font-medium text-center"
          }`}
        >
          {product.name}
        </Link>
      </div>

      {/* 4. Price + Signature Compact Gradient CTA on Category Pages */}
      <div className="pt-1 mt-auto space-y-2">
        <div
          className={`flex flex-wrap items-baseline gap-x-1.5 ${
            isCategory ? "justify-start" : "justify-center"
          }`}
        >
          {discountPercent > 0 && product.compareAtPrice && (
            <span className="text-[13px] line-through text-[#9ca3af] font-normal">
              {formatPriceByCurrency(product.compareAtPrice, activeCurrency)}
            </span>
          )}
          <span className="text-[13.5px] font-bold text-[#0a0a0a]">
            {formatPriceByCurrency(product.sellingPrice, activeCurrency)}
          </span>
        </div>

        {isCategory &&
          (colors.length > 1 && product.inStock ? (
            <Link
              href={productHref}
              className="mt-1 inline-flex items-center justify-center h-[30px] px-3.5 rounded-[2px] text-[11px] font-bold uppercase tracking-wide text-white transition-all bg-[linear-gradient(90deg,#224e40,#f8eee9)] hover:bg-none hover:bg-store-forest self-start"
            >
              {t.selectOption}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!product.inStock}
              className="mt-1 inline-flex items-center justify-center h-[30px] px-3.5 rounded-[2px] text-[11px] font-bold uppercase tracking-wide text-white transition-all bg-[linear-gradient(90deg,#224e40,#f8eee9)] hover:bg-none hover:bg-store-forest disabled:opacity-50 self-start"
            >
              {!product.inStock ? t.outOfStock.toUpperCase() : t.addToCart}
            </button>
          ))}
      </div>
    </article>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Maximize2,
  Minimize,
  Minus,
  Plus,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  calcDiscountPercent,
  formatPriceByCurrency,
  resolveMediaUrl,
  type CurrencyCode,
} from "@/lib/format";
import { buildCartVariantId } from "@/lib/pricingAndSearch";
import { ProductCard } from "@/components/common/ProductCard";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import type {
  ProductDetail,
  ProductListItem,
  ReviewListResponse,
  TierPricingRule,
} from "@/types/storefront";

export interface ProductDetailClientProps {
  product: ProductDetail;
  relatedProducts: ProductListItem[];
  initialReviews?: ReviewListResponse | null;
}

interface ColorSwatchOption {
  color: string;
  colorHex?: string;
  imageUrl?: string;
}

interface GiftTile {
  eyebrow: string;
  reward: string;
}

function formatPriceDigits(amount: number | null | undefined): string {
  const safeValue =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.max(0, Math.round(amount))
      : 0;
  return new Intl.NumberFormat("vi-VN").format(safeValue);
}

function renderFormattedPrice(
  amount: number | null | undefined,
  currency: CurrencyCode,
  supClass = "text-[0.62em] ml-0.5 font-bold"
) {
  if (currency === "VND") {
    return (
      <>
        {formatPriceDigits(amount)}
        <sup className={supClass}>₫</sup>
      </>
    );
  }
  return formatPriceByCurrency(amount, currency);
}

function computeTierUnitPrice(basePrice: number, rule: TierPricingRule): number {
  const amountOff =
    typeof rule.discountAmount === "number" && rule.discountAmount > 0
      ? rule.discountAmount
      : rule.discountType === "AMOUNT" &&
        typeof rule.discountValue === "number" &&
        rule.discountValue > 0
      ? rule.discountValue
      : 0;
  if (amountOff > 0) {
    return Math.max(0, Math.round(basePrice - amountOff));
  }

  const pctOff =
    typeof rule.discountPercent === "number" && rule.discountPercent > 0
      ? rule.discountPercent
      : rule.discountType === "PERCENT" &&
        typeof rule.discountValue === "number" &&
        rule.discountValue > 0
      ? rule.discountValue
      : 0;
  if (pctOff > 0) {
    return Math.max(0, Math.round(basePrice * (1 - pctOff / 100)));
  }
  return basePrice;
}

function parseGiftTile(rawTitle: string, fallbackReward?: string): GiftTile {
  if (rawTitle.includes("→")) {
    const [left, right] = rawTitle.split("→");
    return {
      eyebrow: left.trim(),
      reward: right.trim() || fallbackReward || rawTitle,
    };
  }
  return {
    eyebrow: rawTitle.trim(),
    reward: fallbackReward?.trim() || "Quà tặng 11Sport",
  };
}

export function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const addItem = useCartStore((s) => s.addItem);
  const currency = useCurrencyStore((s) => s.currency);
  const [mounted, setMounted] = useState(false);
  const activeCurrency: CurrencyCode = mounted ? currency : "VND";
  const buyBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const primaryFallbackImage =
    product.thumbnailUrl ||
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    "/images/mock/paddle-joola-red.svg";

  const initialVariant = useMemo(() => {
    const list = product.variants ?? [];
    return list.find((v) => v.inStock) ?? list[0] ?? null;
  }, [product.variants]);

  const [selectedColor, setSelectedColor] = useState<string>(
    initialVariant?.color || product.variants?.[0]?.color || ""
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    initialVariant?.size || product.variants?.[0]?.size || ""
  );
  const [selectionCleared, setSelectionCleared] = useState<boolean>(false);
  const [variantWarning, setVariantWarning] = useState<string>("");

  // Merge colors cleanly from variants[] and product.colors[], ưu tiên ảnh theo phiên bản (size) đang chọn
  const colorOptions = useMemo<ColorSwatchOption[]>(() => {
    const map = new Map<string, ColorSwatchOption>();

    for (const v of product.variants ?? []) {
      if (!v.color) continue;
      const key = v.color.trim().toLowerCase();
      const isSelectedSize =
        Boolean(selectedSize) &&
        v.size?.trim().toLowerCase() === selectedSize.trim().toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          color: v.color.trim(),
          colorHex: v.colorHexes?.[0],
          imageUrl: v.imageUrl || primaryFallbackImage,
        });
      } else if (isSelectedSize && v.imageUrl) {
        // Cập nhật thumbnail swatch màu theo đúng phiên bản (size/độ dày) đang chọn
        const existing = map.get(key)!;
        existing.imageUrl = v.imageUrl;
      }
    }

    for (const c of product.colors ?? []) {
      if (!c.color) continue;
      const key = c.color.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          color: c.color.trim(),
          colorHex: c.colorHexes?.[0],
          imageUrl: c.imageUrl || primaryFallbackImage,
        });
      } else {
        const existing = map.get(key)!;
        if (!existing.imageUrl && c.imageUrl) existing.imageUrl = c.imageUrl;
        if (!existing.colorHex && c.colorHexes?.[0]) existing.colorHex = c.colorHexes[0];
      }
    }

    return Array.from(map.values());
  }, [product.variants, product.colors, primaryFallbackImage, selectedSize]);

  // Unique gallery list combining product images & color/variant images
  const galleryImages = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const list: string[] = [];

    const pushUrl = (raw?: string | null) => {
      const resolved = resolveMediaUrl(raw);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        list.push(resolved);
      }
    };

    pushUrl(product.thumbnailUrl);
    for (const img of product.images ?? []) {
      pushUrl(img.url);
    }
    for (const v of product.variants ?? []) {
      pushUrl(v.imageUrl);
    }
    for (const opt of colorOptions) {
      pushUrl(opt.imageUrl);
    }

    if (list.length === 0) {
      list.push("/images/mock/paddle-joola-red.svg");
    }
    return list;
  }, [product.thumbnailUrl, product.images, product.variants, colorOptions]);

  const availableSizes = useMemo<string[]>(() => {
    const allSizes = Array.from(
      new Set(
        (product.variants ?? [])
          .map((v) => v.size?.trim())
          .filter((s): s is string => Boolean(s))
      )
    );
    return allSizes;
  }, [product.variants]);

  const selectedVariant = useMemo(() => {
    if (selectionCleared) return null;
    const variants = product.variants ?? [];
    if (variants.length === 0) return null;

    if (selectedColor && selectedSize) {
      const exact = variants.find(
        (v) =>
          v.color?.trim().toLowerCase() === selectedColor.trim().toLowerCase() &&
          v.size?.trim().toLowerCase() === selectedSize.trim().toLowerCase()
      );
      if (exact) return exact;
    }
    if (selectedColor) {
      const byColor = variants.find(
        (v) => v.color?.trim().toLowerCase() === selectedColor.trim().toLowerCase()
      );
      if (byColor) return byColor;
    }
    if (selectedSize) {
      const bySize = variants.find(
        (v) => v.size?.trim().toLowerCase() === selectedSize.trim().toLowerCase()
      );
      if (bySize) return bySize;
    }
    return null;
  }, [product.variants, selectedColor, selectedSize, selectionCleared]);

  const activeColorOption = useMemo(
    () =>
      colorOptions.find(
        (c) => c.color.trim().toLowerCase() === selectedColor.trim().toLowerCase()
      ) ?? null,
    [colorOptions, selectedColor]
  );

  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<boolean>(false);
  const [lightboxPan, setLightboxPan] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mainHoverZoom, setMainHoverZoom] = useState<boolean>(false);
  const [mainHoverOrigin, setMainHoverOrigin] = useState<{
    x: number;
    y: number;
  }>({ x: 50, y: 50 });
  const [hoverPausedByControl, setHoverPausedByControl] =
    useState<boolean>(false);
  const [isDescExpanded, setIsDescExpanded] = useState<boolean>(false);
  const [isStickyVisible, setIsStickyVisible] = useState<boolean>(false);

  // Switch active gallery image when selecting a color swatch
  const syncImageToUrl = (rawUrl?: string | null) => {
    const resolved = resolveMediaUrl(rawUrl);
    if (!resolved) return;
    const idx = galleryImages.indexOf(resolved);
    if (idx >= 0) {
      setActiveImageIndex(idx);
    }
  };

  const handleSelectColor = (opt: ColorSwatchOption) => {
    setSelectionCleared(false);
    setVariantWarning("");
    setSelectedColor(opt.color);

    // Ưu tiên biến thể khớp CẢ phiên bản đang chọn và màu vừa bấm
    const exact = (product.variants ?? []).find(
      (v) =>
        v.color?.trim().toLowerCase() === opt.color.trim().toLowerCase() &&
        Boolean(selectedSize) &&
        v.size?.trim().toLowerCase() === selectedSize.trim().toLowerCase()
    );
    const matchingVariant =
      exact ||
      (product.variants ?? []).find(
        (v) => v.color?.trim().toLowerCase() === opt.color.trim().toLowerCase()
      );

    if (matchingVariant?.size && !exact) {
      setSelectedSize(matchingVariant.size);
    }
    syncImageToUrl(matchingVariant?.imageUrl || opt.imageUrl);
  };

  const handleSelectSize = (size: string) => {
    setSelectionCleared(false);
    setVariantWarning("");
    setSelectedSize(size);

    // Ưu tiên biến thể khớp CẢ màu đang chọn và phiên bản vừa bấm
    const exact = (product.variants ?? []).find(
      (v) =>
        v.size?.trim().toLowerCase() === size.trim().toLowerCase() &&
        Boolean(selectedColor) &&
        v.color?.trim().toLowerCase() === selectedColor.trim().toLowerCase()
    );
    const matchingVariant =
      exact ||
      (product.variants ?? []).find(
        (v) => v.size?.trim().toLowerCase() === size.trim().toLowerCase()
      );

    if (matchingVariant?.color && !selectedColor) {
      setSelectedColor(matchingVariant.color);
    }
    if (matchingVariant?.imageUrl) {
      syncImageToUrl(matchingVariant.imageUrl);
    }
  };

  const handleResetVariant = () => {
    setSelectionCleared(true);
    setSelectedColor("");
    setSelectedSize("");
    setVariantWarning("");
    setActiveImageIndex(0);
  };

  // Observe main Buy Box visibility for the fixed 58px Sticky Bottom Bar
  useEffect(() => {
    const el = buyBoxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openLightbox = () => {
    setLightboxZoom(false);
    setLightboxPan({ x: 50, y: 50 });
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setLightboxZoom(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors on restricted embeds
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fallback gracefully when Fullscreen API is blocked
    }
  };

  const stepImage = (delta: -1 | 1) => {
    setLightboxZoom(false);
    setActiveImageIndex((prev) => {
      if (galleryImages.length <= 1) return 0;
      return (prev + delta + galleryImages.length) % galleryImages.length;
    });
  };

  // Track Fullscreen API state + lock body scroll while Lightbox is open
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepImage(-1);
      if (e.key === "ArrowRight") stepImage(1);
      if (e.key === "+" || e.key === "=") setLightboxZoom(true);
      if (e.key === "-") setLightboxZoom(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLightboxOpen, galleryImages.length]);

  const activePrice =
    selectedVariant?.effectiveSellingPrice ?? product.sellingPrice;
  const activeComparePrice =
    selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const discountPercent = calcDiscountPercent(activePrice, activeComparePrice);
  const activeStock = selectedVariant
    ? selectedVariant.stockAvailable
    : product.stockAvailable ?? (product.inStock ? 20 : 0);
  const isAvailable = selectedVariant ? selectedVariant.inStock : product.inStock;
  const currentMainImage =
    galleryImages[activeImageIndex] || galleryImages[0] || "";

  const tierPricing = product.promotions?.tierPricing ?? [];
  const rawGiftPromotions = product.promotions?.giftPromotions;
  const hasPromoBox =
    tierPricing.length > 0 ||
    Boolean(rawGiftPromotions && rawGiftPromotions.length > 0) ||
    Boolean(product.hasGift);

  const giftTiles = useMemo<GiftTile[]>(() => {
    const promos = rawGiftPromotions ?? [];
    const tiles: GiftTile[] = promos.map((gift) => {
      const giftName =
        gift.giftProductName ||
        (Array.isArray(gift.gifts) && gift.gifts.length > 0
          ? gift.gifts
              .map((g) =>
                g.quantity && g.quantity > 1
                  ? `${g.quantity} ${g.productName}`
                  : g.productName
              )
              .join(" + ")
          : gift.name || "Quà tặng 11Sport");
      const rawTitle =
        gift.title ||
        (gift.minQuantity
          ? `Mua ${gift.minQuantity} sản phẩm → ${giftName}`
          : gift.name || giftName);
      return parseGiftTile(rawTitle, giftName);
    });
    if (product.hasGift) {
      tiles.push({
        eyebrow: "Mỗi sản phẩm",
        reward: "1 áo",
      });
    }
    return tiles;
  }, [rawGiftPromotions, product.hasGift]);

  const handleAddToCart = () => {
    if (!isAvailable) return;
    if (selectionCleared && (colorOptions.length > 0 || availableSizes.length > 0)) {
      setVariantWarning("Vui lòng chọn màu sắc / phân loại sản phẩm trước khi thêm vào giỏ.");
      return;
    }

    const colorToUse =
      selectedVariant?.color || selectedColor || colorOptions[0]?.color;
    const sizeToUse = selectedVariant?.size || selectedSize || undefined;

    addItem({
      variantId: buildCartVariantId(product._id, {
        variantKey: selectedVariant?.variantKey,
        colorName: colorToUse,
        size: sizeToUse,
        variants: product.variants,
      }),
      productId: product._id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand?.name || "11Sport",
      sku: selectedVariant?.variantCode || product.code,
      imageUrl:
        resolveMediaUrl(selectedVariant?.imageUrl || activeColorOption?.imageUrl) ||
        currentMainImage,
      colorName: colorToUse,
      sizeName: sizeToUse,
      price: activePrice,
      compareAtPrice: activeComparePrice,
      quantity,
      maxStock: activeStock,
    });
  };

  const additionalInfoRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (product.brand?.name) {
      rows.push({ label: "Thương hiệu", value: product.brand.name });
    }
    if (product.category?.name) {
      rows.push({ label: "Danh mục", value: product.category.name });
    }
    if (colorOptions.length > 0) {
      rows.push({
        label: "Màu sắc",
        value: colorOptions.map((c) => c.color).join(", "),
      });
    }
    if (availableSizes.length > 0) {
      rows.push({
        label: "Độ dày / Phiên bản",
        value: availableSizes.join(", "),
      });
    }
    if (product.code) {
      rows.push({ label: "Mã sản phẩm", value: product.code });
    }
    return rows;
  }, [product.brand?.name, product.category?.name, product.code, colorOptions, availableSizes]);

  const policyRows = [
    {
      label: "Quà tặng của 11Sport",
      value: "Tặng kèm phụ kiện chính hãng & ưu đãi quà tặng trực tiếp tại giỏ hàng.",
    },
    {
      label: "Phí giao hàng",
      value: "Miễn phí giao hàng toàn quốc cho đơn hàng từ 1.000.000₫.",
    },
    {
      label: "Bảo hành",
      value: "Bảo hành chính hãng theo tiêu chuẩn nhà sản xuất. Lỗi kỹ thuật đổi mới.",
    },
    {
      label: "Hình thức thanh toán",
      value: "Thanh toán khi nhận hàng (COD), Chuyển khoản ngân hàng / VietQR.",
    },
  ];

  const specs = product.specs ?? [];

  return (
    <div className="space-y-10 sm:space-y-12 pb-16 lg:pb-12">
      {/* =================================================================== */}
      {/* TOP 50/50 HERO: GALLERY (LEFT) + BUY BOX SUMMARY (RIGHT)            */}
      {/* =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
        {/* LEFT COLUMN: MAIN GALLERY + DESKTOP 4-COL THUMBNAIL STRIP */}
        <div className="w-full">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Phóng to ảnh ${product.name}`}
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openLightbox();
              }
            }}
            onMouseEnter={() => {
              if (
                typeof window !== "undefined" &&
                window.matchMedia?.("(hover: hover) and (pointer: fine)").matches
              ) {
                setMainHoverZoom(true);
              }
            }}
            onMouseMove={(e) => {
              if (!mainHoverZoom || hoverPausedByControl) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(
                0,
                Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
              );
              const y = Math.max(
                0,
                Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
              );
              setMainHoverOrigin({ x, y });
            }}
            onMouseLeave={() => {
              setMainHoverZoom(false);
              setHoverPausedByControl(false);
              setMainHoverOrigin({ x: 50, y: 50 });
            }}
            className="group relative aspect-square w-full bg-white rounded-[8px] border border-[#eeeeee] overflow-hidden cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#224E40]"
          >
            {currentMainImage && (
              <Image
                src={currentMainImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                style={
                  mainHoverZoom && !hoverPausedByControl
                    ? {
                        transform: "scale(1.6)",
                        transformOrigin: `${mainHoverOrigin.x}% ${mainHoverOrigin.y}%`,
                      }
                    : undefined
                }
                className="object-contain p-3 sm:p-5 transition-transform duration-200 ease-out"
              />
            )}

            {/* Top-left stacked badges (-N% / TẶNG ÁO or Mới) */}
            {(discountPercent > 0 || product.hasGift || product.isNew) && (
              <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
                {discountPercent > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-[#224E40] text-white text-xs font-bold leading-none tabular-nums">
                    -{discountPercent}%
                  </span>
                )}
                {product.hasGift && (
                  <span className="px-2.5 py-1 rounded-full bg-[#224E40] text-white text-[11px] font-bold uppercase tracking-wide leading-none">
                    TẶNG ÁO
                  </span>
                )}
                {product.isNew && !product.hasGift && (
                  <span className="px-2.5 py-1 rounded-full bg-[#224E40] text-white text-xs font-bold leading-none">
                    Mới
                  </span>
                )}
              </div>
            )}

            {/* Subtle left/right chevrons when multiple gallery photos exist */}
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepImage(-1);
                  }}
                  onMouseEnter={() => setHoverPausedByControl(true)}
                  onMouseLeave={() => setHoverPausedByControl(false)}
                  aria-label="Ảnh trước"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 border border-[#e2e8f0] text-[#1e2c26] flex items-center justify-center opacity-80 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:border-[#224E40] hover:text-[#224E40]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepImage(1);
                  }}
                  onMouseEnter={() => setHoverPausedByControl(true)}
                  onMouseLeave={() => setHoverPausedByControl(false)}
                  aria-label="Ảnh tiếp theo"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 border border-[#e2e8f0] text-[#1e2c26] flex items-center justify-center opacity-80 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:border-[#224E40] hover:text-[#224E40]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Bottom-left circular zoom button (visible on all viewports) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openLightbox();
              }}
              onMouseEnter={() => setHoverPausedByControl(true)}
              onMouseLeave={() => setHoverPausedByControl(false)}
              aria-label="Phóng to hình ảnh sản phẩm"
              className="flex absolute bottom-3 left-3 z-10 w-9 h-9 rounded-full bg-white border border-[#e0ebe6] items-center justify-center text-[#555555] hover:text-[#224E40] hover:border-[#224E40] transition-colors shadow-sm"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* 4-column thumbnail grid (Desktop only) */}
          {galleryImages.length > 1 && (
            <div className="hidden lg:grid grid-cols-4 gap-2.5 mt-3">
              {galleryImages.map((imgUrl, idx) => {
                const isActive = idx === activeImageIndex;
                return (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`Xem ảnh ${idx + 1} của ${product.name}`}
                    className={`relative aspect-square rounded-[6px] border overflow-hidden bg-white transition-all ${
                      isActive
                        ? "border-[#224E40] ring-1 ring-[#224E40]"
                        : "border-[#ebebeb] opacity-75 hover:opacity-100 hover:border-[#224E40]/50"
                    }`}
                  >
                    <Image
                      src={imgUrl}
                      alt={`${product.name} - ảnh ${idx + 1}`}
                      fill
                      sizes="140px"
                      className="object-contain p-1.5"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PLAIN H1 -> RED PRICE -> PROMO BOX -> SWATCHES -> ADD BAR -> POLICY */}
        <div className="space-y-4">
          {/* Plain H1 (no brand eyebrow, no stars, no SKU pill, no divider) */}
          <h1 className="text-[23px] sm:text-[27px] font-bold text-[#1e2c26] leading-snug tracking-tight">
            {product.name}
          </h1>

          {/* Red <del>/<ins> Price with superscript ₫ (converts dynamically for USD/PHP) */}
          <div className="flex flex-wrap items-baseline gap-2.5">
            {activeComparePrice && activeComparePrice > activePrice && (
              <del className="text-[18px] sm:text-[20px] font-normal text-[#dd3333]/65 line-through tabular-nums">
                {renderFormattedPrice(
                  activeComparePrice,
                  activeCurrency,
                  "text-[0.62em] ml-0.5 font-normal"
                )}
              </del>
            )}
            <ins className="no-underline text-[22px] sm:text-[25px] font-bold text-[#dd3333] tabular-nums">
              {renderFormattedPrice(
                activePrice,
                activeCurrency,
                "text-[0.62em] ml-0.5 font-bold"
              )}
            </ins>
          </div>

          {/* ✧ ƯU ĐÃI ĐỘC QUYỀN Mint-Sage Card (#f5f8f2) */}
          {hasPromoBox && (
            <div className="rounded-[12px] bg-[#f5f8f2] border border-[#dce8dc] p-4 sm:p-[18px] space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#e2ece2]">
                <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide text-[#204b3e]">
                  ✧ ƯU ĐÃI ĐỘC QUYỀN
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#204b3e] text-white text-[11px] font-bold uppercase tracking-wide shrink-0">
                  11SPORT
                </span>
              </div>

              {/* Bulk Pricing Rows (GIÁ MUA NHIỀU) */}
              {tierPricing.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#4a6b5d] mb-1.5">
                    GIÁ MUA NHIỀU
                  </p>
                  <div className="bg-white rounded-[8px] border border-[#e3ece3] divide-y divide-[#eef3ee]">
                    {tierPricing.map((rule, idx) => {
                      const tierUnitPrice = computeTierUnitPrice(activePrice, rule);
                      return (
                        <div
                          key={`${rule.minQty}-${idx}`}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="text-[13px] sm:text-[13.5px] font-medium text-[#1e2c26]">
                            Từ {rule.minQty} sản phẩm
                          </span>
                          <div className="text-right leading-none whitespace-nowrap">
                            <span className="text-[20px] sm:text-[22px] font-bold text-[#204b3e] tabular-nums">
                              {renderFormattedPrice(
                                tierUnitPrice,
                                activeCurrency,
                                "text-[0.58em] ml-0.5 font-bold"
                              )}
                            </span>
                            <span className="text-[11.5px] font-normal text-[#5b7268] ml-1">
                              / sản phẩm
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gift Promotions Tiles (QUÀ TẶNG KÈM THEO) */}
              {giftTiles.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#4a6b5d] mb-1.5">
                    QUÀ TẶNG KÈM THEO
                  </p>
                  <div
                    className={`grid gap-2 ${
                      giftTiles.length >= 3
                        ? "grid-cols-2 sm:grid-cols-3"
                        : "grid-cols-2"
                    }`}
                  >
                    {giftTiles.map((tile, idx) => (
                      <div
                        key={`${tile.eyebrow}-${idx}`}
                        className="bg-white rounded-[8px] border border-[#e3ece3] px-3 py-2.5 flex flex-col justify-between gap-1"
                      >
                        <span className="text-[11.5px] font-medium text-[#5b7268] leading-snug">
                          {tile.eyebrow}
                        </span>
                        <span className="text-[13.5px] sm:text-[14px] font-bold text-[#204b3e] leading-snug">
                          {tile.reward}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Promo footer link */}
              <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                <span className="text-[#5b7268]">
                  Ưu đãi tự động áp dụng trong giỏ hàng
                </span>
                <Link
                  href="/gio-hang"
                  className="font-semibold text-[#204b3e] hover:underline whitespace-nowrap shrink-0"
                >
                  Xem quà tặng ↗
                </Link>
              </div>
            </div>
          )}

          {/* Color & Variant Swatches (30x30 square image swatches + active #dd3333 ring + XÓA reset) */}
          {(colorOptions.length > 0 || availableSizes.length > 0) && (
            <div className="space-y-2.5 pt-1">
              {colorOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-[#1e2c26]">
                      Màu sắc:{" "}
                      {!selectionCleared && selectedColor ? (
                        <strong className="text-[#204b3e] font-bold">
                          {selectedColor}
                        </strong>
                      ) : (
                        <span className="text-[#888888] font-normal">
                          Chưa chọn
                        </span>
                      )}
                    </span>
                    {!selectionCleared && (selectedColor || selectedSize) && (
                      <button
                        type="button"
                        onClick={handleResetVariant}
                        className="text-[11.5px] font-semibold uppercase tracking-wide text-[#777777] hover:text-[#dd3333] underline underline-offset-2"
                      >
                        XÓA
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {colorOptions.map((opt) => {
                      const isActive =
                        !selectionCleared &&
                        selectedColor.trim().toLowerCase() ===
                          opt.color.trim().toLowerCase();
                      const thumbUrl = resolveMediaUrl(
                        opt.imageUrl || primaryFallbackImage
                      );

                      return (
                        <button
                          key={opt.color}
                          type="button"
                          onClick={() => handleSelectColor(opt)}
                          title={opt.color}
                          aria-label={`Chọn màu ${opt.color}`}
                          aria-pressed={isActive}
                          className={`relative w-[30px] h-[30px] rounded-[3px] overflow-hidden bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#224E40] ${
                            isActive
                              ? "ring-2 ring-[#dd3333] border border-[#dd3333]"
                              : "border border-[#dcdcdc] hover:border-[#224E40]"
                          }`}
                        >
                          {thumbUrl ? (
                            <Image
                              src={thumbUrl}
                              alt={opt.color}
                              fill
                              sizes="30px"
                              className="object-contain p-0.5"
                            />
                          ) : (
                            <span
                              className="block w-full h-full"
                              style={{
                                backgroundColor: opt.colorHex || "#224E40",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableSizes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[13px] font-semibold text-[#1e2c26]">
                    Phiên bản:
                  </span>
                  {availableSizes.map((size) => {
                    const isActive =
                      !selectionCleared &&
                      selectedSize.trim().toLowerCase() ===
                        size.trim().toLowerCase();
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSelectSize(size)}
                        aria-pressed={isActive}
                        className={`px-2.5 py-1 rounded-[4px] border text-xs transition-colors ${
                          isActive
                            ? "border-[#dd3333] bg-[#dd3333]/5 text-[#1e2c26] font-semibold"
                            : "border-[#dcdcdc] text-[#555555] hover:border-[#224E40]"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected Variant Live Price & Stock Strip */}
              {!selectionCleared && (selectedVariant || selectedColor) && (
                <div className="flex flex-wrap items-center gap-2 text-[13px] pt-0.5">
                  <span className="font-bold text-[#dd3333] tabular-nums">
                    {renderFormattedPrice(
                      activePrice,
                      activeCurrency,
                      "text-[0.65em] ml-0.5"
                    )}
                  </span>
                  <span className="text-[#cccccc]">·</span>
                  {isAvailable ? (
                    <span className="text-[#204b3e] font-medium">
                      Còn hàng ({activeStock})
                    </span>
                  ) : (
                    <span className="text-[#dd3333] font-medium">
                      Tạm hết hàng
                    </span>
                  )}
                </div>
              )}

              {variantWarning && (
                <p className="text-xs font-medium text-[#dd3333]">
                  {variantWarning}
                </p>
              )}
            </div>
          )}

          {/* Single Horizontal Row: `- [1] +` Pill Stepper + Single `#224E40` Pill CTA */}
          <div
            ref={buyBoxRef}
            className="flex items-center gap-3 pt-1"
          >
            <div className="inline-flex items-center h-[44px] rounded-full border border-[#d6ded6] bg-white overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Giảm số lượng"
                className="w-10 h-full flex items-center justify-center text-[#1e2c26] hover:bg-[#f5f8f2] disabled:opacity-40 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={activeStock || 99}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) {
                    setQuantity(Math.max(1, Math.min(val, activeStock || 99)));
                  }
                }}
                aria-label="Số lượng"
                className="w-10 text-center text-sm font-bold text-[#1e2c26] tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.min(activeStock || 99, q + 1))
                }
                disabled={activeStock > 0 && quantity >= activeStock}
                aria-label="Tăng số lượng"
                className="w-10 h-full flex items-center justify-center text-[#1e2c26] hover:bg-[#f5f8f2] disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className="flex-1 sm:flex-initial sm:min-w-[240px] h-[44px] px-7 rounded-full bg-[#224E40] hover:bg-[#193b30] text-white text-[13.5px] font-bold uppercase tracking-wide transition-colors disabled:bg-[#cbd5e1] disabled:text-[#64748b] whitespace-nowrap"
            >
              {isAvailable ? "THÊM VÀO GIỎ HÀNG" : "TẠM HẾT HÀNG"}
            </button>
          </div>

          {/* 4-Row Iconless Borderless Policy Table */}
          <div className="pt-2 divide-y divide-[#efefef] text-[13px] sm:text-[13.5px]">
            {policyRows.map((row) => (
              <div
                key={row.label}
                className="py-2.5 grid grid-cols-[130px_1fr] sm:grid-cols-[165px_1fr] gap-3 items-start"
              >
                <span className="font-bold text-[#1e2c26] leading-snug">
                  {row.label}
                </span>
                <span className="text-[#4a5568] leading-relaxed">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* LOWER STACKED 2-COLUMN SECTIONS (NO TABS, NO REVIEWS)               */}
      {/* =================================================================== */}

      {/* 1. MÔ TẢ (Collapsible + Embedded Specs Table + Sharp #224E40 "Xem thêm") */}
      <section className="border-t border-[#e8ece8] pt-7 sm:pt-9 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
        <div className="lg:col-span-3">
          <h2 className="text-base sm:text-[18px] font-bold uppercase tracking-wide text-[#1e2c26]">
            MÔ TẢ
          </h2>
        </div>

        <div className="lg:col-span-9">
          <div className="relative">
            <div
              className={`space-y-5 transition-all ${
                !isDescExpanded ? "max-h-[380px] overflow-hidden" : ""
              }`}
            >
              {product.shortDescription && (
                <p className="text-[14.5px] text-[#334155] leading-relaxed font-medium">
                  {product.shortDescription}
                </p>
              )}

              {product.descriptionHtml ? (
                <div
                  className="prose prose-sm sm:prose-base max-w-none prose-headings:text-[#1e2c26] prose-headings:font-bold prose-p:text-[#334155] prose-p:leading-relaxed prose-strong:text-[#1e2c26]"
                  dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                />
              ) : (
                <p className="text-[14.5px] text-[#4a5568] leading-relaxed">
                  {product.name} chính hãng phân phối tại 11Sport với đầy đủ chế độ bảo hành từ nhà sản xuất.
                </p>
              )}

              {specs.length > 0 && (
                <div className="pt-2 space-y-2.5">
                  <h3 className="text-[14px] font-bold uppercase tracking-wide text-[#1e2c26]">
                    Thông số kỹ thuật
                  </h3>
                  <div className="overflow-hidden border-y border-[#ececec]">
                    <table className="w-full text-[13.5px] border-collapse">
                      <tbody className="divide-y divide-[#ececec]">
                        {specs.map((spec, idx) => (
                          <tr key={`${spec.label}-${idx}`}>
                            <th
                              scope="row"
                              className="w-[140px] sm:w-[210px] py-2.5 pr-4 text-left font-semibold text-[#1e2c26] align-top"
                            >
                              {spec.label}
                            </th>
                            <td className="py-2.5 text-[#4a5568] align-top">
                              {spec.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {!isDescExpanded && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent"
              />
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setIsDescExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-[#224E40] hover:bg-[#193b30] text-white text-xs sm:text-[13px] font-semibold rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#224E40] focus-visible:ring-offset-2"
            >
              {isDescExpanded ? "Thu gọn" : "Xem thêm"}
            </button>
          </div>
        </div>
      </section>

      {/* 2. THÔNG TIN BỔ SUNG */}
      {additionalInfoRows.length > 0 && (
        <section className="border-t border-[#e8ece8] pt-7 sm:pt-9 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
          <div className="lg:col-span-3">
            <h2 className="text-base sm:text-[18px] font-bold uppercase tracking-wide text-[#1e2c26]">
              THÔNG TIN BỔ SUNG
            </h2>
          </div>

          <div className="lg:col-span-9">
            <div className="border-y border-[#ececec]">
              <table className="w-full text-[13.5px] border-collapse">
                <tbody className="divide-y divide-[#ececec]">
                  {additionalInfoRows.map((row) => (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="w-[140px] sm:w-[210px] py-2.5 pr-4 text-left font-semibold text-[#1e2c26] align-top"
                      >
                        {row.label}
                      </th>
                      <td className="py-2.5 text-[#555555] italic align-top">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 3. SẢN PHẨM TƯƠNG TỰ */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-[#e8ece8] pt-7 sm:pt-9 space-y-5">
          <h2 className="text-[18px] sm:text-[20px] font-bold uppercase tracking-wide text-[#1e2c26]">
            SẢN PHẨM TƯƠNG TỰ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {(relatedProducts.length >= 8
              ? relatedProducts.slice(0, 8)
              : relatedProducts.slice(0, 4)
            ).map((item) => (
              <ProductCard
                key={item._id}
                product={item}
                density="category"
              />
            ))}
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* FIXED 58PX STICKY BOTTOM ADD-TO-CART BAR (DESKTOP & MOBILE)         */}
      {/* =================================================================== */}
      <div
        aria-hidden={!isStickyVisible}
        className={`fixed bottom-0 inset-x-0 z-40 h-[58px] bg-white border-t border-[#e2e8f0] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-all duration-200 ${
          isStickyVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-container mx-auto h-full px-2.5 sm:px-5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Desktop product preview / Mobile compact unclipped price */}
          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-[4px] border border-[#eeeeee] bg-white overflow-hidden shrink-0">
              {currentMainImage && (
                <Image
                  src={currentMainImage}
                  alt={product.name}
                  fill
                  sizes="40px"
                  className="object-contain p-0.5"
                />
              )}
            </div>
            <span className="text-[13.5px] font-semibold text-[#1e2c26] truncate max-w-[340px] lg:max-w-[520px]">
              {product.name}
            </span>
          </div>

          <span className="sm:hidden text-[13.5px] font-bold text-[#dd3333] tabular-nums whitespace-nowrap shrink-0">
            {renderFormattedPrice(
              activePrice,
              activeCurrency,
              "text-[0.65em] ml-0.5"
            )}
          </span>

          {/* Right controls: unit price (desktop) + quantity + single CTA */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
            <span className="hidden sm:block text-[15px] font-bold text-[#dd3333] tabular-nums whitespace-nowrap">
              {renderFormattedPrice(
                activePrice,
                activeCurrency,
                "text-[0.65em] ml-0.5"
              )}
            </span>

            <div className="inline-flex items-center h-[36px] rounded-full border border-[#d6ded6] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Giảm số lượng thanh cố định"
                className="w-7 sm:w-8 h-full flex items-center justify-center text-[#1e2c26] hover:bg-[#f5f8f2] disabled:opacity-40"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 sm:w-7 text-center text-xs font-bold text-[#1e2c26] tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.min(activeStock || 99, q + 1))
                }
                disabled={activeStock > 0 && quantity >= activeStock}
                aria-label="Tăng số lượng thanh cố định"
                className="w-7 sm:w-8 h-full flex items-center justify-center text-[#1e2c26] hover:bg-[#f5f8f2] disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAvailable}
              tabIndex={isStickyVisible ? 0 : -1}
              className="h-[36px] px-3.5 sm:px-5 rounded-full bg-[#224E40] hover:bg-[#193b30] text-white text-[11.5px] sm:text-[13px] font-bold uppercase tracking-wide transition-colors disabled:bg-[#cbd5e1] disabled:text-[#64748b] whitespace-nowrap"
            >
              {isAvailable ? "THÊM VÀO GIỎ HÀNG" : "HẾT HÀNG"}
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* IMAGE ZOOM LIGHTBOX MODAL (PHOTOSWIPE-STYLE 1:1 MIPIK)              */}
      {/* =================================================================== */}
      {isLightboxOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Phóng to ảnh ${product.name}`}
            onClick={closeLightbox}
            className="fixed inset-0 z-[70] m-0 bg-black/90 flex items-center justify-center p-3 sm:p-8"
          >
          {/* Top toolbar: counter (left) + Zoom / Fullscreen / Close (right) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 inset-x-0 h-12 px-4 sm:px-6 flex items-center justify-between text-white/95 z-20"
          >
            <span className="text-xs sm:text-sm font-medium tabular-nums tracking-wide">
              {activeImageIndex + 1} / {galleryImages.length}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => !z)}
                aria-label={lightboxZoom ? "Thu nhỏ ảnh" : "Phóng to ảnh"}
                title={lightboxZoom ? "Thu nhỏ (2x → 1x)" : "Phóng to (2x)"}
                className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                {lightboxZoom ? (
                  <ZoomOut className="w-5 h-5" />
                ) : (
                  <ZoomIn className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={closeLightbox}
                aria-label="Đóng xem ảnh"
                title="Đóng (Esc)"
                className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(-1);
                }}
                aria-label="Ảnh trước trong trình xem"
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(1);
                }}
                aria-label="Ảnh tiếp theo trong trình xem"
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* White square stage with 1x <-> 2x cursor-tracking zoom */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoom((z) => !z);
            }}
            onMouseMove={(e) => {
              if (!lightboxZoom) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(
                0,
                Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
              );
              const y = Math.max(
                0,
                Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
              );
              setLightboxPan({ x, y });
            }}
            className={`relative w-[min(92vw,80vh)] h-[min(92vw,80vh)] bg-white overflow-hidden select-none p-4 sm:p-6 ${
              lightboxZoom ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
          >
            {currentMainImage && (
              <Image
                src={currentMainImage}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 92vw, 80vh"
                style={
                  lightboxZoom
                    ? {
                        transform: "scale(2)",
                        transformOrigin: `${lightboxPan.x}% ${lightboxPan.y}%`,
                      }
                    : undefined
                }
                className="object-contain p-4 transition-transform duration-200 ease-out"
              />
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}

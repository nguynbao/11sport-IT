"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ProductCard } from "@/components/common/ProductCard";
import { BreadcrumbBar } from "@/components/store/StorefrontDesignSystem";
import { formatPriceByCurrency } from "@/lib/format";
import { useCurrencyStore } from "@/store/currencyStore";
import type {
  BrandSummary,
  CategorySummary,
  ProductFacets,
  ProductListItem,
} from "@/types/storefront";

interface CatalogClientProps {
  products: ProductListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  facets?: ProductFacets;
  subCategories?: CategorySummary[];
  hubBrands?: BrandSummary[];
  hideBrandFilter?: boolean;
  breadcrumbs?: Array<{ name: string; href?: string }>;
  showSortToolbar?: boolean;
}

const SORT_OPTIONS = [
  { value: "featured", label: "Sắp xếp theo mức độ phổ biến" },
  { value: "bestseller", label: "Sắp xếp theo xếp hạng trung bình" },
  { value: "newest", label: "Sắp xếp theo mới nhất" },
  { value: "price_asc", label: "Sắp xếp theo giá: thấp đến cao" },
  { value: "price_desc", label: "Sắp xếp theo giá: cao đến thấp" },
];

/**
 * Full-width Product Archive Grid 1:1 with live mipik.vn:
 * - Zero 260px left sidebar
 * - Single-row header: Borderless Breadcrumb (left) + Result Count & Sort Dropdown (right)
 * - 4 columns Desktop / 3 columns Tablet / 2 columns Mobile
 * - Circular Flatsome-style Pagination
 */
export function CatalogClient({
  products,
  meta,
  breadcrumbs,
  showSortToolbar = true,
}: CatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currency = useCurrencyStore((s) => s.currency);
  const [mounted, setMounted] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setSortOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeCurrency = mounted ? currency : "VND";

  const currentBrand = searchParams.get("brand") || "";
  const currentPriceMin = searchParams.get("priceMin") || "";
  const currentPriceMax = searchParams.get("priceMax") || "";
  const currentColor = searchParams.get("color") || "";
  const currentSize = searchParams.get("size") || "";
  const currentInStock = searchParams.get("inStock") === "true";
  const currentSort = searchParams.get("sort") || "featured";

  const updateQuery = (
    updates: Record<string, string | null>,
    resetPage = true
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    if (resetPage) {
      next.delete("page");
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearAllFilters = () => {
    router.push(pathname, { scroll: false });
  };

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (currentBrand) {
    activeChips.push({
      key: "brand",
      label: `Hãng: ${currentBrand}`,
      onRemove: () => updateQuery({ brand: null }),
    });
  }
  if (currentPriceMin || currentPriceMax) {
    const minText = currentPriceMin
      ? formatPriceByCurrency(Number(currentPriceMin), activeCurrency)
      : formatPriceByCurrency(0, activeCurrency);
    const maxText = currentPriceMax
      ? formatPriceByCurrency(Number(currentPriceMax), activeCurrency)
      : "Trở lên";
    activeChips.push({
      key: "price",
      label: `Giá: ${minText} – ${maxText}`,
      onRemove: () => updateQuery({ priceMin: null, priceMax: null }),
    });
  }
  if (currentColor) {
    activeChips.push({
      key: "color",
      label: `Màu: ${currentColor}`,
      onRemove: () => updateQuery({ color: null }),
    });
  }
  if (currentSize) {
    activeChips.push({
      key: "size",
      label: `Size: ${currentSize}`,
      onRemove: () => updateQuery({ size: null }),
    });
  }
  if (currentInStock) {
    activeChips.push({
      key: "inStock",
      label: "Chỉ hiện còn hàng",
      onRemove: () => updateQuery({ inStock: null }),
    });
  }

  const countLabel =
    meta.totalPages <= 1
      ? `Hiển thị tất cả ${meta.total} kết quả`
      : `Hiển thị ${products.length} / ${meta.total} kết quả`;

  const currentSortOption =
    SORT_OPTIONS.find((opt) => opt.value === currentSort) || SORT_OPTIONS[0];

  const sortControls = showSortToolbar ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13.5px] text-ink-secondary">{countLabel}</span>
      <div ref={sortDropdownRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          aria-label="Sắp xếp sản phẩm"
          className="h-[39px] min-w-[240px] px-3.5 bg-white border border-[#d9d9d9] hover:border-store-forest text-[13.5px] font-medium text-ink-primary flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-store-forest cursor-pointer shadow-sm rounded-none"
        >
          <span className="truncate">{currentSortOption.label}</span>
          <ChevronDown
            className={`w-4 h-4 text-ink-muted transition-transform duration-200 shrink-0 ${
              sortOpen ? "rotate-180 text-store-forest" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {sortOpen && (
          <ul
            role="listbox"
            aria-label="Tùy chọn sắp xếp"
            className="absolute right-0 top-full mt-1 w-full min-w-[250px] bg-white border border-store-border-sage shadow-drawer py-1 z-30 animate-in fade-in-50 zoom-in-95 duration-150"
          >
            {SORT_OPTIONS.map((opt) => {
              const isSelected = opt.value === currentSort;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      updateQuery({ sort: opt.value });
                      setSortOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[13px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-store-surface-sage text-store-forest font-bold"
                        : "text-ink-primary hover:bg-[#f4f7f5] hover:text-store-forest"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check
                        className="w-4 h-4 text-store-forest shrink-0 ml-2"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-5">
      {/* Unified Single-Row Top Toolbar */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <BreadcrumbBar items={breadcrumbs} rightSlot={sortControls} />
      ) : sortControls ? (
        <div className="flex justify-end">{sortControls}</div>
      ) : null}

      {/* Deep-linked URL Filter Chips (only visible if filters active) */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-full bg-store-surface-sage border border-store-mint-border text-xs font-semibold text-store-forest hover:bg-store-mint-bg"
            >
              <span>{chip.label}</span>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-store-price-sale hover:underline px-2 min-h-[34px]"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* Full-Width 4-Col Desktop / 2-Col Mobile Product Grid */}
      {products.length === 0 ? (
        <div className="rounded-[8px] border border-[#eeeeee] bg-store-surface-sage py-16 px-4 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-white border border-store-border-sage flex items-center justify-center">
            <Search className="w-5 h-5 text-ink-muted" aria-hidden="true" />
          </div>
          <p className="text-base font-bold text-ink-primary">
            Không tìm thấy sản phẩm phù hợp
          </p>
          <p className="text-sm text-ink-muted">
            Vui lòng thử lại hoặc quay về danh mục Vợt Pickleball 11Sport.
          </p>
          <div className="pt-2">
            <Link
              href="/vot-pickleball"
              className="inline-flex items-center justify-center h-10 px-5 rounded-[4px] bg-store-forest text-white text-xs font-bold uppercase tracking-wider hover:bg-store-forest-hover"
            >
              Xem tất cả sản phẩm
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              density="category"
            />
          ))}
        </div>
      )}

      {/* Flatsome Circular Pagination (only when > 1 page) */}
      {meta.totalPages > 1 && (
        <nav
          aria-label="Phân trang sản phẩm"
          className="pt-4 flex items-center justify-center gap-2"
        >
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => updateQuery({ page: String(meta.page - 1) }, false)}
            aria-label="Trang trước"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-[#d9d9d9] bg-white text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-store-forest hover:bg-store-forest hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
            .slice(
              Math.max(0, meta.page - 3),
              Math.min(meta.totalPages, meta.page + 2)
            )
            .map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => updateQuery({ page: String(pageNum) }, false)}
                aria-current={pageNum === meta.page ? "page" : undefined}
                className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2 rounded-full text-sm font-bold border-2 transition-colors ${
                  pageNum === meta.page
                    ? "border-store-forest bg-store-forest text-white"
                    : "border-[#d9d9d9] bg-white text-ink-primary hover:border-store-forest hover:bg-store-forest hover:text-white"
                }`}
              >
                {pageNum}
              </button>
            ))}

          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onClick={() => updateQuery({ page: String(meta.page + 1) }, false)}
            aria-label="Trang tiếp theo"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-[#d9d9d9] bg-white text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-store-forest hover:bg-store-forest hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}

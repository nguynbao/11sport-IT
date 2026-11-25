"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BrandSummary } from "@/types/storefront";
import { resolveMediaUrl } from "@/lib/format";

interface BrandCarouselProps {
  brands: BrandSummary[];
  title?: string;
}

const ORDERED_HOME_SLUGS = [
  "kamito",
  "sypik",
  "selkirk",
  "vole",
  "joola",
  "wika",
  "kbs",
  "kaiwin",
];

/**
 * Full-bleed Brand Tile Strip 1:1 with live mipik.vn:
 * - No section title box, no rounded corners, flush 100% edge-to-edge above Footer
 * - 7 columns on Desktop, 4 columns on Mobile
 * - 1:1 square dark green #224E40 tiles separated by crisp 2px white borders
 */
export function BrandCarousel({
  brands,
  title = "Thương hiệu phân phối chính hãng",
}: BrandCarouselProps) {
  const [startOffset, setStartOffset] = useState(0);

  if (!brands.length) return null;

  const preferred = brands.filter(
    (b) => "featuredOnHome" in b && Boolean(b.featuredOnHome)
  );
  const baseList = preferred.length >= 7 ? preferred : brands;
  const sortedList = [...baseList].sort((a, b) => {
    const ia = ORDERED_HOME_SLUGS.indexOf(a.slug);
    const ib = ORDERED_HOME_SLUGS.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const displayCount = Math.min(7, sortedList.length);
  const visibleBrands = Array.from({ length: displayCount }, (_, idx) => {
    return sortedList[(startOffset + idx) % sortedList.length]!;
  });

  const canRotate = sortedList.length > 7;

  return (
    <section
      aria-label={title}
      className="group relative w-full bg-white py-[2px]"
    >
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-[2px] bg-white">
        {visibleBrands.map((brand, idx) => {
          const href =
            "rootCategorySlug" in brand &&
            typeof brand.rootCategorySlug === "string"
              ? `/${brand.rootCategorySlug}`
              : `/thuong-hieu/${brand.slug}`;
          const logo = resolveMediaUrl(brand.logoUrl);

          return (
            <Link
              key={`${brand._id}-${idx}`}
              href={href}
              className={`relative aspect-square bg-store-forest hover:bg-store-forest-hover text-white overflow-hidden flex items-center justify-center text-center transition-colors ${
                idx >= 4 ? "hidden lg:flex" : "flex"
              }`}
            >
              {logo ? (
                <Image
                  src={logo}
                  alt={brand.name}
                  fill
                  sizes="(max-width: 1024px) 25vw, 15vw"
                  className="object-cover transition-transform duration-200 hover:scale-105"
                />
              ) : (
                <span className="text-base sm:text-xl font-extrabold uppercase tracking-wider text-white">
                  {brand.name}
                </span>
              )}
              <span className="sr-only">{brand.name}</span>
            </Link>
          );
        })}
      </div>

      {canRotate && (
        <>
          <button
            type="button"
            onClick={() =>
              setStartOffset(
                (prev) => (prev - 1 + sortedList.length) % sortedList.length
              )
            }
            aria-label="Thương hiệu trước"
            className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 text-ink-primary shadow-md hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity absolute left-3 top-1/2 -translate-y-1/2 z-10"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() =>
              setStartOffset((prev) => (prev + 1) % sortedList.length)
            }
            aria-label="Thương hiệu tiếp theo"
            className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 text-ink-primary shadow-md hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-1/2 -translate-y-1/2 z-10"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}

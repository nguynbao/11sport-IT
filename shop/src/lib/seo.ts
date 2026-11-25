import type { Metadata } from "next";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://11sport.vn"
).replace(/\/+$/, "");

export const SITE_NAME = "11Sport";
export const DEFAULT_DESCRIPTION =
  "Đại lý phân phối Vợt Pickleball Joola, Selkirk, Kamito, Facolos, CRBN, Giày Asics, Skechers & Phụ kiện chính hãng 100%. Lỗi là đổi mới, freeship toàn quốc.";

export const FILTER_PARAM_KEYS = [
  "category",
  "brand",
  "priceMin",
  "priceMax",
  "minPrice",
  "maxPrice",
  "color",
  "size",
  "thickness",
  "weight",
  "inStock",
  "sort",
  "q",
  "s",
  "post_type",
] as const;

export interface CrawlPolicyResult {
  index: boolean;
  follow: boolean;
  canonicalPath: string;
  canonicalUrl: string;
}

/**
 * Google Crawl-Budget Guard (Strategy A):
 * - Clean path (no filter params, page <= 1): `index: true, follow: true`, canonical = clean path
 * - Pure pagination (`?page=2+` with zero filter params): `index: true, follow: true`, self-canonical `?page=N`
 * - Any facet filter / search / sort param (even if combined with `page=2`):
 *   `index: false, follow: true`, canonical = clean base path (consolidates link equity)
 */
export function evaluateCrawlPolicy(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): CrawlPolicyResult {
  const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const cleanBase =
    normalizedBase.length > 1
      ? normalizedBase.replace(/\/+$/, "")
      : normalizedBase;

  let hasFilterParam = false;
  for (const key of FILTER_PARAM_KEYS) {
    const val = searchParams[key];
    const nonEmpty = Array.isArray(val)
      ? val.some((v) => String(v || "").trim() !== "")
      : val !== undefined && String(val).trim() !== "";
    if (nonEmpty) {
      hasFilterParam = true;
      break;
    }
  }

  const rawPage = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page;
  const pageNum = Number(rawPage || "1");

  if (hasFilterParam) {
    return {
      index: false,
      follow: true,
      canonicalPath: cleanBase,
      canonicalUrl: `${SITE_URL}${cleanBase === "/" ? "" : cleanBase}`,
    };
  }

  if (Number.isFinite(pageNum) && pageNum > 1) {
    const pagedPath = `${cleanBase}?page=${Math.floor(pageNum)}`;
    return {
      index: true,
      follow: true,
      canonicalPath: pagedPath,
      canonicalUrl: `${SITE_URL}${pagedPath}`,
    };
  }

  return {
    index: true,
    follow: true,
    canonicalPath: cleanBase,
    canonicalUrl: `${SITE_URL}${cleanBase === "/" ? "" : cleanBase}`,
  };
}

/**
 * Resolves single-segment `/danh-muc-san-pham/<top>` to permanent `308` redirect `/<top>`,
 * while returning `null` for valid multi-segment subcategories (`/danh-muc-san-pham/thoi-trang/ao-pikpro`).
 */
export function resolveNestedCategoryRedirect(
  segments: string[],
  locale: "vi" | "en" = "vi"
): string | null {
  const clean = segments.filter(Boolean);
  if (clean.length === 1) {
    const prefix = locale === "en" ? "/en" : "";
    return `${prefix}/${clean[0]}`;
  }
  return null;
}

export interface BuildMetadataInput {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  locale?: "vi" | "en";
  searchParams?: Record<string, string | string[] | undefined>;
}

export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = "/images/mock/hero-desktop-1.svg",
  type = "website",
  noIndex = false,
  locale,
  searchParams,
}: BuildMetadataInput): Metadata {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isExplicitEnPath =
    normalizedPath === "/en" || normalizedPath.startsWith("/en/");
  const effectiveLocale: "vi" | "en" =
    locale || (isExplicitEnPath ? "en" : "vi");

  const strippedLocalePath =
    normalizedPath.replace(/^\/en(?=\/|$)/, "") || "/";

  const localizedBasePath =
    effectiveLocale === "en"
      ? strippedLocalePath === "/"
        ? "/en"
        : `/en${strippedLocalePath}`
      : strippedLocalePath;

  const crawlPolicy = searchParams
    ? evaluateCrawlPolicy(localizedBasePath, searchParams)
    : null;

  const canonicalUrl = crawlPolicy
    ? crawlPolicy.canonicalUrl
    : `${SITE_URL}${localizedBasePath === "/" ? "" : localizedBasePath}`;

  const viAlt = `${SITE_URL}${strippedLocalePath === "/" ? "" : strippedLocalePath}`;
  const enAlt = `${SITE_URL}${strippedLocalePath === "/" ? "/en" : `/en${strippedLocalePath}`}`;
  const ogImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  const shouldNoIndex = noIndex || (crawlPolicy ? !crawlPolicy.index : false);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        vi: viAlt,
        en: enAlt,
        "x-default": viAlt,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: effectiveLocale === "en" ? "en_US" : "vi_VN",
      alternateLocale: [effectiveLocale === "en" ? "vi_VN" : "en_US"],
      type,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: !shouldNoIndex,
      follow: true,
    },
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/mock/brand-tile.svg`,
    sameAs: [
      "https://www.facebook.com/11sport.pickleball",
      "https://www.instagram.com/11sport.pickleball",
      "https://www.tiktok.com/@11sport.pickleball",
      "https://zalo.me/0909888128",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+84-909-888-128",
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: ["Vietnamese", "English"],
    },
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/tim-kiem?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path.startsWith("http")
        ? item.path
        : `${SITE_URL}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  description: string;
  slug: string;
  sku: string;
  brandName: string;
  images: string[];
  price: number;
  priceCurrency?: "VND" | "USD";
  inStock: boolean;
  ratingValue?: number;
  reviewCount?: number;
  bulkTiers?: Array<{ minQty: number; unitPrice: number; label?: string }>;
}

export function buildProductJsonLd(input: ProductJsonLdInput) {
  const url = `${SITE_URL}/${input.slug}`;
  const currency = input.priceCurrency || "VND";
  const validTiers = (input.bulkTiers ?? []).filter(
    (tier) => Number.isFinite(tier.unitPrice) && tier.unitPrice > 0
  );
  const priceSpecification = validTiers.map((tier) => ({
    "@type": "UnitPriceSpecification",
    price: tier.unitPrice,
    priceCurrency: currency,
    name: tier.label || `Mua từ ${tier.minQty} sản phẩm cùng biến thể`,
    eligibleQuantity: {
      "@type": "QuantitativeValue",
      minValue: tier.minQty,
      unitCode: "C62",
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    sku: input.sku,
    image: input.images.map((img) =>
      img.startsWith("http") ? img : `${SITE_URL}${img}`
    ),
    brand: {
      "@type": "Brand",
      name: input.brandName,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: currency,
      price: input.price,
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      ...(priceSpecification.length > 0 ? { priceSpecification } : {}),
    },
    ...(input.reviewCount && input.reviewCount > 0 && input.ratingValue
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.ratingValue,
            reviewCount: input.reviewCount,
          },
        }
      : {}),
  };
}

export interface ArticleJsonLdInput {
  title: string;
  description: string;
  slug: string;
  image: string;
  publishedAt: string;
  updatedAt?: string;
  authorName?: string;
}

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
  const url = `${SITE_URL}/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: input.image.startsWith("http")
      ? input.image
      : `${SITE_URL}${input.image}`,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt || input.publishedAt,
    author: {
      "@type": "Person",
      name: input.authorName || "Ban Chuyên Môn 11Sport",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/mock/brand-tile.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

export interface LocalBusinessInput {
  name: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  telephone: string;
  openingHours?: string;
}

export function buildLocalBusinessJsonLd(branch: LocalBusinessInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SportingGoodsStore",
    name: branch.name,
    url: SITE_URL,
    telephone: branch.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.streetAddress,
      addressLocality: branch.addressLocality,
      addressRegion: branch.addressRegion,
      addressCountry: "VN",
    },
    openingHours: branch.openingHours || "Mo-Su 08:30-21:30",
  };
}

export interface SeoAuditIssue {
  code:
    | "MISSING_H1"
    | "DUPLICATE_H1"
    | "MISSING_CANONICAL"
    | "MISSING_IMG_ALT";
  message: string;
}

export function analyzeSeoHtml(html: string): {
  score: number;
  passed: boolean;
  issues: SeoAuditIssue[];
} {
  const issues: SeoAuditIssue[] = [];
  let score = 100;

  const h1Matches = Array.from(html.matchAll(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi));
  if (h1Matches.length === 0) {
    issues.push({
      code: "MISSING_H1",
      message: "Page must contain exactly one <h1> element.",
    });
    score -= 35;
  } else if (h1Matches.length > 1) {
    issues.push({
      code: "DUPLICATE_H1",
      message: `Found ${h1Matches.length} <h1> elements; strictly 1 is allowed.`,
    });
    score -= 35;
  }

  if (!/<link\b[^>]*rel=["']canonical["']/i.test(html)) {
    issues.push({
      code: "MISSING_CANONICAL",
      message: "Missing <link rel=\"canonical\"> tag.",
    });
    score -= 25;
  }

  const imgTags = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  for (const img of imgTags) {
    if (!/\balt=["'][^"']+["']/i.test(img)) {
      issues.push({
        code: "MISSING_IMG_ALT",
        message: "Found <img> without non-empty alt attribute.",
      });
      score -= 15;
      break;
    }
  }

  return {
    score: Math.max(0, score),
    passed: issues.length === 0 && score >= 90,
    issues,
  };
}

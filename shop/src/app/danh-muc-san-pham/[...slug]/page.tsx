import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  buildBreadcrumbJsonLd,
  buildMetadata,
  resolveNestedCategoryRedirect,
} from "@/lib/seo";
import { fetchCategoryDetail, fetchProducts } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { SeoDescriptionBox } from "@/components/catalog/SeoDescriptionBox";

interface NestedCategoryPageProps {
  params: { slug: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export async function generateMetadata({
  params,
  searchParams,
}: NestedCategoryPageProps): Promise<Metadata> {
  const segments = params.slug || [];
  const leafSlug = segments[segments.length - 1] || "thoi-trang";
  const { data } = await fetchCategoryDetail(leafSlug);
  const category = data?.category;
  const title = category?.name
    ? `${category.name} Chính Hãng`
    : "Danh Mục Sản Phẩm Pickleball";

  return buildMetadata({
    title,
    description:
      category?.seo?.description ||
      `Khám phá ${title} chính hãng 100%, lỗi 1 đổi 1, freeship toàn quốc.`,
    path: `/danh-muc-san-pham/${segments.join("/")}`,
    searchParams,
  });
}

export default async function NestedCategoryPage({
  params,
  searchParams,
}: NestedCategoryPageProps) {
  const segments = params.slug || [];
  const singleSegTopCategories = new Set([
    "vot-pickleball",
    "giay-pickleball",
    "balo-tui-pickleball",
    "phu-kien-pickleball",
    "bong-pickleball",
  ]);

  if (segments.length === 1 && singleSegTopCategories.has(segments[0] || "")) {
    const reqLocale = headers().get("x-locale") === "en" ? "en" : "vi";
    const redirectTarget = resolveNestedCategoryRedirect(segments, reqLocale);
    if (redirectTarget) {
      permanentRedirect(redirectTarget);
    }
  }

  const leafSlug = segments[segments.length - 1] || "thoi-trang";
  const [catResult, productsRes] = await Promise.all([
    fetchCategoryDetail(leafSlug),
    fetchProducts({
      category: leafSlug,
      brand: getParam(searchParams.brand),
      priceMin: getParam(searchParams.priceMin),
      priceMax: getParam(searchParams.priceMax),
      color: getParam(searchParams.color),
      size: getParam(searchParams.size),
      inStock: getParam(searchParams.inStock),
      sort: getParam(searchParams.sort) || "featured",
      page: getParam(searchParams.page) || "1",
      limit: 20,
    }),
  ]);

  if (catResult.notFound) {
    notFound();
  }

  const category = catResult.data?.category;
  const categoryName =
    category?.name || leafSlug.replace(/-/g, " ").toUpperCase();
  const subCategories =
    catResult.data?.subCategories || category?.subCategories || [];

  const breadcrumbs = [
    { name: "Trang chủ", path: "/" },
    ...segments.map((seg, i) => ({
      name: i === segments.length - 1 ? categoryName : seg.replace(/-/g, " "),
      path: `/danh-muc-san-pham/${segments.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-5">
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs)} />

      <h1 className="sr-only">{categoryName} Chính Hãng — 11Sport</h1>

      <Suspense
        fallback={
          <div className="h-96 rounded-xl bg-surface-muted animate-pulse" />
        }
      >
        <CatalogClient
          breadcrumbs={breadcrumbs.map((b, i) => ({
            name: b.name,
            href: i < breadcrumbs.length - 1 ? b.path : undefined,
          }))}
          products={productsRes.data}
          meta={productsRes.meta}
          facets={productsRes.facets}
          subCategories={subCategories}
        />
      </Suspense>

      <SeoDescriptionBox
        html={category?.descriptionHtml}
        title={`Thông tin về ${categoryName}`}
      />
    </div>
  );
}

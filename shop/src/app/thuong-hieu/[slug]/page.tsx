import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildBreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { fetchBrandDetail, fetchProducts } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { SeoDescriptionBox } from "@/components/catalog/SeoDescriptionBox";

interface BrandPageProps {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(
  val: string | string[] | undefined
): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

function formatSlugTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
  searchParams,
}: BrandPageProps): Promise<Metadata> {
  const { data: brand } = await fetchBrandDetail(params.slug);
  const brandName = brand?.name || formatSlugTitle(params.slug);
  const title = brand?.seo?.title || `Thương hiệu ${brandName} Chính Hãng`;
  const description =
    brand?.seo?.description ||
    `Sản phẩm ${brandName} chính hãng. Bảo hành uy tín, lỗi 1 đổi 1, freeship toàn quốc.`;

  return buildMetadata({
    title,
    description,
    path: `/thuong-hieu/${params.slug}`,
    image: brand?.seo?.ogImage || brand?.logoUrl,
    searchParams,
  });
}

export default async function BrandPage({
  params,
  searchParams,
}: BrandPageProps) {
  const [brandResult, productsRes] = await Promise.all([
    fetchBrandDetail(params.slug),
    fetchProducts({
      brand: params.slug,
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

  if (brandResult.notFound) {
    notFound();
  }

  const brand = brandResult.data;
  const brandName = brand?.name || formatSlugTitle(params.slug);

  const breadcrumbs = [
    { name: "Trang chủ", path: "/" },
    { name: `Thương hiệu ${brandName}`, path: `/thuong-hieu/${params.slug}` },
  ];

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-5">
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs)} />

      <h1 className="sr-only">{brandName} Chính Hãng — 11Sport</h1>

      <Suspense
        fallback={
          <div className="h-96 rounded-xl bg-store-surface-sage animate-pulse" />
        }
      >
        <CatalogClient
          breadcrumbs={[{ name: "Trang chủ", href: "/" }, { name: brandName }]}
          products={productsRes.data}
          meta={productsRes.meta}
          facets={productsRes.facets}
          hideBrandFilter
        />
      </Suspense>

      <SeoDescriptionBox
        html={brand?.descriptionHtml}
        title={`Giới thiệu thương hiệu ${brandName}`}
      />
    </div>
  );
}

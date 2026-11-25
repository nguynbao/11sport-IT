import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildBreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { fetchCategoryDetail, fetchProducts } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { SeoDescriptionBox } from "@/components/catalog/SeoDescriptionBox";

interface CategoryPageProps {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(val: string | string[] | undefined): string | undefined {
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
}: CategoryPageProps): Promise<Metadata> {
  const { data } = await fetchCategoryDetail(params.slug);
  const category = data?.category;
  const title =
    category?.seo?.title ||
    (category?.name
      ? `${category.name} Chính Hãng`
      : `${formatSlugTitle(params.slug)} Chính Hãng`);
  const description =
    category?.seo?.description ||
    `Mua ${category?.name || formatSlugTitle(params.slug)} chính hãng. Giá tốt, lỗi 1 đổi 1, freeship toàn quốc.`;

  return buildMetadata({
    title,
    description,
    path: `/danh-muc/${params.slug}`,
    image: category?.seo?.ogImage || category?.imageUrl,
    searchParams,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [catResult, productsRes] = await Promise.all([
    fetchCategoryDetail(params.slug),
    fetchProducts({
      category: params.slug,
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
  const categoryName = category?.name || formatSlugTitle(params.slug);
  const subCategories =
    catResult.data?.subCategories || category?.subCategories || [];
  const hubBrands = catResult.data?.brands || [];

  const breadcrumbs = [
    { name: "Trang chủ", path: "/" },
    { name: categoryName, path: `/danh-muc/${params.slug}` },
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
          breadcrumbs={[{ name: "Trang chủ", href: "/" }, { name: categoryName }]}
          products={productsRes.data}
          meta={productsRes.meta}
          facets={productsRes.facets}
          subCategories={subCategories}
          hubBrands={hubBrands}
        />
      </Suspense>

      <SeoDescriptionBox
        html={category?.descriptionHtml}
        title={`Thông tin về ${categoryName}`}
      />
    </div>
  );
}

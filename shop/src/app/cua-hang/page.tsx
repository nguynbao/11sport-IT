import { Suspense } from "react";
import type { Metadata } from "next";
import { buildBreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { fetchProducts, getAllBrandsList } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogClient } from "@/components/catalog/CatalogClient";

interface ShopAllPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export async function generateMetadata({
  searchParams,
}: ShopAllPageProps): Promise<Metadata> {
  return buildMetadata({
    title: "Cửa Hàng Vợt, Giày & Phụ Kiện Pickleball Chính Hãng",
    description:
      "Danh mục toàn bộ sản phẩm Vợt Pickleball Joola, Selkirk, Kamito, Facolos, CRBN, Giày Asics, Skechers và phụ kiện chính hãng 100%.",
    path: "/cua-hang",
    searchParams,
  });
}

export default async function ShopAllPage({ searchParams }: ShopAllPageProps) {
  const query = getParam(searchParams.q) || getParam(searchParams.s);
  const productsRes = await fetchProducts({
    category: getParam(searchParams.category),
    brand: getParam(searchParams.brand),
    priceMin: getParam(searchParams.priceMin) || getParam(searchParams.minPrice),
    priceMax: getParam(searchParams.priceMax) || getParam(searchParams.maxPrice),
    color: getParam(searchParams.color),
    size: getParam(searchParams.size) || getParam(searchParams.thickness),
    inStock: getParam(searchParams.inStock),
    q: query,
    sort: getParam(searchParams.sort) || "featured",
    page: getParam(searchParams.page) || "1",
    limit: 20,
  });

  const allBrands = getAllBrandsList();

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-5">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Trang chủ", path: "/" },
          { name: "Cửa hàng", path: "/cua-hang" },
        ])}
      />

      <h1 className="sr-only">
        {query
          ? `Kết quả tìm kiếm: "${query}"`
          : "Tất Cả Sản Phẩm Pickleball Chính Hãng — 11Sport"}
      </h1>

      <Suspense
        fallback={
          <div className="h-96 rounded-xl bg-surface-muted animate-pulse" />
        }
      >
        <CatalogClient
          breadcrumbs={[
            { name: "Trang chủ", href: "/" },
            { name: "Cửa hàng" },
          ]}
          products={productsRes.data}
          meta={productsRes.meta}
          facets={productsRes.facets}
          hubBrands={allBrands}
        />
      </Suspense>
    </div>
  );
}

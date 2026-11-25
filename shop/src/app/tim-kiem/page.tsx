import type { Metadata } from "next";
import { fetchArticles, fetchProducts } from "@/lib/storefront";
import { SearchTabsClient } from "@/components/search/SearchTabsClient";
import { PageHeroBanner } from "@/components/store/StorefrontDesignSystem";

export const metadata: Metadata = {
  title: "Tìm kiếm sản phẩm",
  description:
    "Tìm kiếm dụng cụ Pickleball, giày thể thao và bài viết tại 11Sport.",
  robots: {
    index: false,
    follow: true,
  },
};

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = getParam(searchParams.q)?.trim() || "";

  const [productsRes, articlesRes] = await Promise.all([
    fetchProducts({
      q: q || undefined,
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
    fetchArticles({ q: q || undefined, page: 1, limit: 12 }),
  ]);

  return (
    <div>
      <PageHeroBanner
        title="TÌM KIẾM"
        breadcrumbs={[
          { name: "Trang chủ", href: "/" },
          { name: q ? `Kết quả cho "${q}"` : "Tìm kiếm" },
        ]}
        tone="news"
      />

      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-7 lg:py-9 space-y-6">
        <h1 className="text-[20px] sm:text-[24px] font-bold uppercase tracking-wide text-center text-[#0a0a0a]">
          {q
            ? `KẾT QUẢ TÌM KIẾM CHO: ${q.toUpperCase()}`
            : "TÌM KIẾM SẢN PHẨM & BÀI VIẾT TẠI 11SPORT"}
        </h1>

        <SearchTabsClient
          query={q}
          products={productsRes.data}
          productMeta={productsRes.meta}
          facets={productsRes.facets}
          articles={articlesRes.data}
          articleTotal={articlesRes.meta.total}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildBreadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { fetchArticles } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import { ArticleGridCard } from "@/components/blog/ArticleViews";
import { PageHeroBanner } from "@/components/store/StorefrontDesignSystem";

interface BlogListPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({
  searchParams,
}: BlogListPageProps): Promise<Metadata> {
  return buildMetadata({
    title: "Tin Tức & Kiến Thức Pickleball Chính Hãng",
    description:
      "Hướng dẫn chọn vợt Pickleball 14mm vs 16mm, luật chơi USAPA, review vợt Joola Perseus, Selkirk Boomstik và tin tức giải đấu.",
    path: "/tin-tuc",
    searchParams,
  });
}

function getParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

const DEFAULT_CATEGORIES = [
  { name: "Tất cả", slug: "" },
  { name: "Kiến thức Pickleball", slug: "kien-thuc-pickleball" },
  { name: "Review & Đánh giá", slug: "review-danh-gia" },
  { name: "Tư vấn dụng cụ Pickleball", slug: "tu-van-dung-cu-pickleball" },
  { name: "Tin tức & Cộng đồng", slug: "tin-tuc-cong-dong" },
];

export default async function BlogListPage({
  searchParams,
}: BlogListPageProps) {
  const category = getParam(searchParams.category) || "";
  const page = Number(getParam(searchParams.page) || "1") || 1;

  const articlesRes = await fetchArticles({
    category: category || undefined,
    page,
    limit: 12,
  });

  const categories =
    articlesRes.categories && articlesRes.categories.length > 0
      ? [{ name: "Tất cả", slug: "" }, ...articlesRes.categories]
      : DEFAULT_CATEGORIES;

  const breadcrumbs = [
    { name: "Trang chủ", href: "/" },
    { name: "Tin tức" },
  ];

  return (
    <div>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Trang chủ", path: "/" },
          { name: "Tin tức", path: "/tin-tuc" },
        ])}
      />

      <PageHeroBanner
        title="TIN TỨC"
        breadcrumbs={breadcrumbs}
        tone="news"
      />

      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-9 space-y-6">
          {/* Clean Horizontal Category Links */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#ececec] pb-3.5">
            {categories.map((cat) => {
              const active = category === cat.slug;
              const href = cat.slug
                ? `/tin-tuc/${encodeURIComponent(cat.slug)}`
                : "/tin-tuc";
              return (
                <Link
                  key={cat.slug || "all"}
                  href={href}
                  className={`inline-flex items-center h-8 px-3.5 rounded-none border text-xs font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? "border-[#224e40] bg-[#224e40] text-white"
                      : "border-[#dddddd] bg-white text-[#555555] hover:border-[#224e40] hover:text-[#224e40]"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>

          {/* 3-Col Clean Editorial Grid (1:1 mipik.vn) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {articlesRes.data.map((article) => (
              <ArticleGridCard key={article._id} article={article} />
            ))}
          </div>

          {/* Pagination */}
          {articlesRes.meta.totalPages > 1 && (
            <nav
              aria-label="Phân trang bài viết"
              className="pt-4 flex items-center justify-center gap-2"
            >
              {page > 1 && (
                <Link
                  href={`/tin-tuc?page=${page - 1}`}
                  aria-label="Trang trước"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#dddddd] bg-white text-[#0a0a0a] hover:border-[#224e40]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              <span className="text-sm font-semibold px-3 text-[#0a0a0a] tabular-nums">
                Trang {page} / {articlesRes.meta.totalPages}
              </span>
              {page < articlesRes.meta.totalPages && (
                <Link
                  href={`/tin-tuc?page=${page + 1}`}
                  aria-label="Trang tiếp theo"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#dddddd] bg-white text-[#0a0a0a] hover:border-[#224e40]"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </nav>
          )}
        </div>

        <aside className="lg:col-span-3 lg:sticky lg:top-24">
          <QuickConsultForm variant="sidebar" sourceUrl="/tin-tuc" />
        </aside>
      </div>
    </div>
  );
}

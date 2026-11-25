import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildMetadata,
} from "@/lib/seo";
import { fetchArticleDetail, fetchArticles } from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import {
  ArticleDetailBody,
  ArticleGridCard,
} from "@/components/blog/ArticleViews";
import { PageHeroBanner } from "@/components/store/StorefrontDesignSystem";

interface ArticleOrCategorySlugProps {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

const BLOG_CATEGORY_MAP: Record<
  string,
  { name: string; description: string }
> = {
  "kien-thuc-pickleball": {
    name: "Kiến thức Pickleball",
    description:
      "Luật chơi, cách tính điểm, kỹ thuật Dink, Third-Shot Drop và kích thước sân Pickleball chuẩn USAPA.",
  },
  "review-danh-gia": {
    name: "Review & Đánh giá",
    description:
      "Đánh giá thực chiến các dòng vợt Pickleball Joola, Selkirk, Kamito, Facolos, CRBN mới nhất.",
  },
  "tu-van-dung-cu-pickleball": {
    name: "Tư vấn dụng cụ Pickleball",
    description:
      "Hướng dẫn chọn độ dày lõi 14mm vs 16mm, trọng lượng vợt, giày và phụ kiện theo trình độ.",
  },
  "tin-tuc-cong-dong": {
    name: "Tin tức & Cộng đồng",
    description:
      "Tin tức giải đấu PPA Tour, cộng đồng CLB và sự kiện tại hệ thống 3 showroom.",
  },
};

export async function generateMetadata({
  params,
  searchParams,
}: ArticleOrCategorySlugProps): Promise<Metadata> {
  const catMeta = BLOG_CATEGORY_MAP[params.slug];
  if (catMeta) {
    return buildMetadata({
      title: `${catMeta.name} — Tin Tức & Cẩm Nang Pickleball`,
      description: catMeta.description,
      path: `/tin-tuc/${params.slug}`,
      searchParams,
    });
  }

  const { data: article } = await fetchArticleDetail(params.slug);
  if (!article) {
    return buildMetadata({
      title: "Bài viết Pickleball",
      path: `/tin-tuc/${params.slug}`,
    });
  }

  return buildMetadata({
    title: article.seo?.title || article.title,
    description:
      article.seo?.description || article.excerpt || article.title,
    path: `/${article.slug}`,
    image: article.seo?.ogImage || article.thumbnailUrl,
    type: "article",
  });
}

export default async function NewsCategoryOrArticlePage({
  params,
}: ArticleOrCategorySlugProps) {
  const catMeta = BLOG_CATEGORY_MAP[params.slug];

  // 1. BLOG CATEGORY HUB
  if (catMeta) {
    const articlesRes = await fetchArticles({
      category: params.slug,
      limit: 12,
    });

    const breadcrumbs = [
      { name: "Trang chủ", href: "/" },
      { name: "Tin tức", href: "/tin-tuc" },
      { name: catMeta.name },
    ];

    return (
      <div>
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Tin tức", path: "/tin-tuc" },
            { name: catMeta.name, path: `/tin-tuc/${params.slug}` },
          ])}
        />

        <PageHeroBanner
          title={catMeta.name}
          breadcrumbs={breadcrumbs}
          tone="news"
        />

        <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-9 space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ececec] pb-3.5">
              <Link
                href="/tin-tuc"
                className="h-8 px-3.5 rounded-none border border-[#dddddd] bg-white text-xs font-bold uppercase tracking-wider text-[#555555] hover:border-[#224e40] hover:text-[#224e40] inline-flex items-center"
              >
                Tất cả bài viết
              </Link>
              {Object.entries(BLOG_CATEGORY_MAP).map(([slugKey, info]) => (
                <Link
                  key={slugKey}
                  href={`/tin-tuc/${slugKey}`}
                  className={`h-8 px-3.5 rounded-none border text-xs font-bold uppercase tracking-wider inline-flex items-center transition-colors ${
                    slugKey === params.slug
                      ? "border-[#224e40] bg-[#224e40] text-white"
                      : "border-[#dddddd] bg-white text-[#555555] hover:border-[#224e40] hover:text-[#224e40]"
                  }`}
                >
                  {info.name}
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {articlesRes.data.map((post) => (
                <ArticleGridCard key={post._id} article={post} />
              ))}
            </div>
          </div>

          <aside className="lg:col-span-3 lg:sticky lg:top-24">
            <QuickConsultForm
              variant="sidebar"
              sourceUrl={`/tin-tuc/${params.slug}`}
            />
          </aside>
        </div>
      </div>
    );
  }

  // 2. BLOG ARTICLE DETAIL (/tin-tuc/[post-slug])
  const { data: article, notFound: isNotFound } = await fetchArticleDetail(
    params.slug
  );
  if (isNotFound || !article) {
    notFound();
  }

  const breadcrumbs = [
    { name: "Trang chủ", path: "/" },
    { name: "Tin tức", path: "/tin-tuc" },
    ...(article.category
      ? [
          {
            name: article.category.name,
            path: `/tin-tuc/${article.category.slug}`,
          },
        ]
      : []),
    { name: article.title, path: `/tin-tuc/${params.slug}` },
  ];

  return (
    <div>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd(breadcrumbs),
          buildArticleJsonLd({
            title: article.title,
            description: article.excerpt || article.title,
            slug: article.slug,
            image: article.thumbnailUrl || "/images/mock/news-cover-1.svg",
            publishedAt: article.publishedAt || new Date().toISOString(),
            updatedAt: article.updatedAt,
            authorName: article.authorName,
          }),
        ]}
      />

      <ArticleDetailBody
        article={article}
        sourceUrl={`/tin-tuc/${article.slug}`}
      />
    </div>
  );
}

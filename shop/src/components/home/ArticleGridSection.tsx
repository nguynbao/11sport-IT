import Link from "next/link";
import Image from "next/image";
import { Newspaper } from "lucide-react";
import { resolveMediaUrl } from "@/lib/format";
import type { ArticleSummary } from "@/types/storefront";
import { BoxedSectionTitle } from "@/components/store/StorefrontDesignSystem";

interface ArticleGridSectionProps {
  articles: ArticleSummary[];
  title?: string;
}

/**
 * Store/News/ArticleCard (3:4901) inside a 3-column grid with BoxedSectionTitle.
 */
export function ArticleGridSection({
  articles,
  title = "TIN TỨC & KIẾN THỨC PICKLEBALL",
}: ArticleGridSectionProps) {
  if (!articles.length) return null;

  return (
    <section aria-label={title} className="space-y-5">
      <BoxedSectionTitle title={title} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {articles.slice(0, 3).map((article) => (
          <article
            key={article._id}
            className="group mipik-card-lift rounded-xl border border-store-border-card bg-white shadow-card overflow-hidden flex flex-col text-center"
          >
            <Link
              href={`/${article.slug}`}
              className="relative aspect-[16/9] bg-surface-muted overflow-hidden block"
            >
              {resolveMediaUrl(article.thumbnailUrl) ? (
                <Image
                  src={resolveMediaUrl(article.thumbnailUrl)}
                  alt={article.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Newspaper className="w-10 h-10 stroke-[1.5]" aria-hidden="true" />
                </div>
              )}
            </Link>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
              <div className="space-y-2">
                {article.category?.name && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-store-surface-sage text-store-forest text-xs font-bold">
                    {article.category.name}
                  </span>
                )}
                <h3 className="text-base font-extrabold text-ink-primary group-hover:text-store-forest line-clamp-2 leading-snug">
                  <Link href={`/${article.slug}`}>{article.title}</Link>
                </h3>
                {article.excerpt && (
                  <p className="text-xs sm:text-sm text-ink-muted line-clamp-2">
                    {article.excerpt}
                  </p>
                )}
              </div>
              <Link
                href={`/${article.slug}`}
                className="text-xs font-bold text-store-forest hover:underline pt-1"
              >
                Xem bài viết →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/format";
import { injectHeadingIds } from "@/lib/articleHtml";
import { ArticleToc } from "@/components/blog/ArticleToc";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import { EditorialCallout } from "@/components/store/StorefrontDesignSystem";
import type { ArticleDetail, ArticleSummary } from "@/types/storefront";

/**
 * 1:1 mipik.vn 3-col post grid card:
 * 16:9 sharp thumbnail (no overlay pill/date) -> centered title -> short divider -> centered excerpt.
 */
export function ArticleGridCard({ article }: { article: ArticleSummary }) {
  const thumb = resolveMediaUrl(article.thumbnailUrl);
  return (
    <article className="group flex flex-col text-center">
      <Link
        href={`/${article.slug}`}
        className="relative aspect-[16/9] w-full bg-[#f3f5f4] overflow-hidden block rounded-none"
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#777777]">
            11SPORT BLOG
          </div>
        )}
      </Link>

      <div className="pt-3.5 px-1 flex-1 flex flex-col items-center">
        <h2 className="text-[15px] font-semibold text-[#1e2c26] group-hover:text-[#224e40] line-clamp-2 leading-snug">
          <Link href={`/${article.slug}`}>{article.title}</Link>
        </h2>
        <span
          aria-hidden="true"
          className="block w-8 h-[2px] bg-[#dddddd] mx-auto my-2.5"
        />
        {article.excerpt && (
          <p className="text-[13px] text-[#555555] line-clamp-3 leading-relaxed">
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * 1:1 mipik.vn Article Detail layout (no blue hero banner):
 * 9:3 grid inside max-w-container -> centered breadcrumb + H1 + meta + 10px hero photo + FixedTOC + prose + sidebar consult form.
 */
export function ArticleDetailBody({
  article,
  sourceUrl,
}: {
  article: ArticleDetail;
  sourceUrl: string;
}) {
  const thumb = resolveMediaUrl(article.thumbnailUrl);
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "CẬP NHẬT MỚI";

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-7 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <article className="lg:col-span-9 space-y-6 min-w-0">
        {/* Centered Breadcrumb + Dark Forest H1 + Uppercase Meta */}
        <header className="space-y-2.5 text-center">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] text-[#777777]"
          >
            <Link href="/" className="hover:text-[#224e40]">
              Trang chủ
            </Link>
            <span>»</span>
            <Link href="/tin-tuc" className="hover:text-[#224e40]">
              Tin tức
            </Link>
            {article.category && (
              <>
                <span>»</span>
                <Link
                  href={`/tin-tuc/${article.category.slug}`}
                  className="hover:text-[#224e40]"
                >
                  {article.category.name}
                </Link>
              </>
            )}
          </nav>

          <h1 className="text-[24px] sm:text-[31px] font-bold text-[#224e40] leading-tight">
            {article.title}
          </h1>

          <p className="text-[11.5px] uppercase tracking-wider text-[#666666]">
            ĐĂNG VÀO {formattedDate.toUpperCase()} BỞI{" "}
            {(article.authorName || "11SPORT").toUpperCase()}
          </p>
        </header>

        {/* Rounded Featured Cover */}
        {thumb && (
          <div className="relative aspect-[16/7] w-full rounded-[10px] overflow-hidden bg-[#f3f5f4]">
            <Image
              src={thumb}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 72vw"
              className="object-cover"
            />
          </div>
        )}

        {/* FixedTOC Accordion */}
        <ArticleToc contentHtml={article.contentHtml} />

        {/* Article Body Prose */}
        <div
          className="prose prose-slate max-w-none prose-headings:text-[#1e2c26] prose-headings:font-bold prose-a:text-[#224e40] prose-img:rounded-[8px] text-[#333333] leading-relaxed space-y-4"
          dangerouslySetInnerHTML={{
            __html: injectHeadingIds(article.contentHtml),
          }}
        />

        <EditorialCallout>
          Người mới chuyển từ cầu lông hoặc tennis sang Pickleball nên ưu tiên
          thử trực tiếp lõi 16mm tại 3 showroom Quận 10, Phú Nhuận và Hà Nội để
          kiểm soát bóng ổn định và giảm rung chấn cổ tay.
        </EditorialCallout>

        {/* Showroom CTA Block (1:1 mipik.vn end-of-article branch card) */}
        <section className="border border-[#dce5da] bg-[#f8f9f5] p-5 space-y-2.5 text-[13.5px]">
          <h2 className="text-[15px] font-bold uppercase tracking-wide text-[#204b3e]">
            Trải nghiệm &amp; test vợt thực tế tại hệ thống 11Sport
          </h2>
          <ul className="space-y-1 text-[#333333]">
            <li>
              <strong>11Sport Quận 10:</strong> 95 Trần Thiện Chánh, Phường 12,
              Quận 10, TP.HCM ·{" "}
              <a
                href="tel:0789404331"
                className="font-bold text-[#224e40] hover:underline"
              >
                0789 404 331
              </a>
            </li>
            <li>
              <strong>11Sport Phú Nhuận:</strong> 100 Hoa Lan, Phường 2, Phú
              Nhuận, TP.HCM ·{" "}
              <a
                href="tel:0789404231"
                className="font-bold text-[#224e40] hover:underline"
              >
                0789 404 231
              </a>
            </li>
            <li>
              <strong>11Sport Hà Nội:</strong> 466 Đường Bưởi, Ngọc Hà, Ba Đình,
              Hà Nội ·{" "}
              <a
                href="tel:0913729135"
                className="font-bold text-[#224e40] hover:underline"
              >
                0913 729 135
              </a>
            </li>
          </ul>
          <p className="text-xs uppercase tracking-wider text-[#666666] pt-2 border-t border-[#dce5da]">
            TÁC GIẢ · {article.authorName || "11Sport Editorial Team"}
          </p>
        </section>
      </article>

      <aside className="lg:col-span-3 lg:sticky lg:top-24">
        <QuickConsultForm variant="sidebar" sourceUrl={sourceUrl} />
      </aside>
    </div>
  );
}

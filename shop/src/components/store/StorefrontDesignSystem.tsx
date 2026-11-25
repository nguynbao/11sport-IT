import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Sparkles,
} from "lucide-react";
import type { LocaleCode } from "@/lib/format";
import { STORE_I18N } from "@/lib/i18n";

/**
 * 1. Store/Section/BoxedTitle (3:4434)
 * Centered sharp bordered uppercase title box flanked by full-width hairlines.
 */
export function BoxedSectionTitle({
  title,
  as: Tag = "h2",
}: {
  title: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="flex items-center w-full my-2">
      <div className="flex-1 h-[1px] bg-[#e5e7eb]" />
      <div className="px-7 py-2.5 sm:py-3 border border-[#d8ddd9] bg-white rounded-none mx-0">
        <Tag className="text-[20px] sm:text-[26px] font-normal uppercase tracking-wide text-store-forest text-center leading-tight">
          {title}
        </Tag>
      </div>
      <div className="flex-1 h-[1px] bg-[#e5e7eb]" />
    </div>
  );
}

/**
 * 2. Store/Trust/GuaranteePills/Home (3:4737)
 * Full-width edge-to-edge #224E40 4-column bar divided by dashed hairlines, centered bold white 1-line text (NO icons/subtitles).
 */
export function GuaranteePillsHome({
  items,
  locale = "vi",
}: {
  items?: Array<{ title: string; description?: string }>;
  locale?: LocaleCode;
}) {
  const defaultTitles = STORE_I18N[locale].home.guarantees;

  const labels =
    locale === "vi" && items && items.length === 4
      ? items.map((it) => it.title)
      : defaultTitles;

  return (
    <section
      aria-label={locale === "en" ? "Official guarantees" : "Cam kết chính hãng"}
      className="w-full bg-store-forest text-white shadow-sm rounded-none"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {labels.map((label, idx) => (
          <div
            key={idx}
            className="min-h-[64px] px-4 py-4 flex items-center justify-center text-center text-sm font-bold text-white border-b sm:border-b-0 sm:border-r border-dashed border-white/30 last:border-0"
          >
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 3. Store/Trust/GuaranteePills/Category (3:4771)
 * 3 warm-cream #EFE4D5 guarantee pills on 1 horizontal row (Desktop & Mobile) matching live mipik.vn.
 */
export function GuaranteePillsCategory({
  locale = "vi",
}: {
  locale?: LocaleCode;
} = {}) {
  const pills =
    locale === "en"
      ? ["100% AUTHENTIC", "1-TO-1 REPLACEMENT", "FREE SHIPPING"]
      : ["CHÍNH HÃNG 100%", "LỖI LÀ ĐỔI MỚI", "FREESHIP TOÀN QUỐC"];
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-3 pb-3.5 sm:pb-4 mb-5">
      {pills.map((label) => (
        <div
          key={label}
          className="bg-[#efe4d5] rounded-[6px] px-1.5 py-2 sm:px-4 sm:py-3 flex items-center justify-center text-center text-[11px] sm:text-base font-bold uppercase tracking-normal sm:tracking-[0.5px] text-store-forest leading-snug"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

/**
 * 4. Store/Trust/DistributorBanner (3:4749)
 * Full-bleed edge-to-edge Official Distributor Certificates banner (hidden on mobile).
 */
export function DistributorBanner() {
  return (
    <section
      aria-label="Chứng nhận nhà phân phối chính hãng"
      className="hidden sm:block relative w-full overflow-hidden bg-store-forest-dark rounded-none border-0"
    >
      <div className="relative w-full aspect-[1425/490]">
        <Image
          src="https://mipik.vn/wp-content/uploads/2026/05/Chung-nhan-.jpg"
          alt="Chứng nhận đại lý phân phối chính hãng 11Sport: Joola, Selkirk, Kamito, Facolos, CRBN"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}

/**
 * 5. Store/Catalog/BrandGroupSection & BrandGroupHeader (3:4778)
 * Gradient light-mint section container (.brand-products-slider-section) & clean header bar matching live mipik.vn.
 */
export function BrandGroupSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[8px] sm:rounded-[12px] border border-[#e0ebe6] bg-[linear-gradient(135deg,#f8faf9_0%,#eef5f2_100%)] px-3.5 sm:px-5 pt-5 sm:pt-6 pb-7 sm:pb-10 mb-5 sm:mb-7">
      {children}
    </section>
  );
}

export function BrandGroupHeader({
  title,
  href,
}: {
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b-2 border-store-forest">
      <h2 className="text-lg sm:text-[20px] font-bold text-store-forest leading-tight">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 px-3.5 sm:px-[18px] py-2 border border-store-forest rounded-[6px] text-xs sm:text-sm font-semibold text-store-forest hover:bg-store-forest hover:text-white transition-colors whitespace-nowrap shrink-0"
      >
        Xem tất cả →
      </Link>
    </div>
  );
}

/**
 * 6. Store/Navigation/BreadcrumbBar (3:8002)
 * Borderless `.shop-page-title` layout matching live mipik.vn: centered on mobile without rightSlot, left-aligned on desktop.
 */
export function BreadcrumbBar({
  items,
  rightSlot,
  prevNextHref,
}: {
  items: Array<{ name: string; href?: string }>;
  rightSlot?: React.ReactNode;
  prevNextHref?: { prev?: string; next?: string };
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 py-2 bg-transparent border-0">
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1.5 text-xs sm:text-[13px] tracking-wide uppercase ${
          rightSlot
            ? "justify-start"
            : "justify-center sm:justify-start"
        }`}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={`${item.name}-${idx}`}>
              {idx > 0 && <span className="text-[#aaaaaa]">/</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  className={
                    isLast
                      ? "font-bold text-[#666666] hover:text-store-forest"
                      : "text-[#888888] hover:text-store-forest font-normal"
                  }
                >
                  {item.name}
                </Link>
              ) : (
                <span className="font-bold text-ink-primary truncate max-w-[260px] sm:max-w-md">
                  {item.name}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {rightSlot ? (
        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          {rightSlot}
        </div>
      ) : prevNextHref ? (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <Link
            href={prevNextHref.prev || "/vot-pickleball"}
            aria-label="Sản phẩm trước"
            className="w-[31px] h-[31px] rounded-full border-2 border-[#dddddd] flex items-center justify-center text-[#777777] hover:border-store-forest hover:text-store-forest transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            href={prevNextHref.next || "/vot-pickleball"}
            aria-label="Sản phẩm tiếp theo"
            className="w-[31px] h-[31px] rounded-full border-2 border-[#dddddd] flex items-center justify-center text-[#777777] hover:border-store-forest hover:text-store-forest transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 7. Store/Navigation/PageHeroBanner (3:8015)
 * Slate-blue #5E739B news/content hero banner with WCAG AA white headline & breadcrumb.
 */
export function PageHeroBanner({
  title,
  breadcrumbs,
  tone = "forest",
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ name: string; href?: string }>;
  tone?: "forest" | "news";
}) {
  const isNews = tone === "news";
  return (
    <section
      className={`w-full text-white px-3.5 sm:px-4 lg:px-5 ${
        isNews
          ? "bg-[#92a3c4] py-10 sm:py-14"
          : "bg-[#224e40] py-8 sm:py-11"
      }`}
    >
      <div className="max-w-container mx-auto space-y-1.5">
        <h1 className="text-[24px] sm:text-[30px] font-medium uppercase tracking-wide text-white leading-tight">
          {title}
        </h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-[12.5px] sm:text-[13px] text-white/95"
          >
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.name}-${i}`}>
                {i > 0 && <span className="opacity-85">»</span>}
                {b.href ? (
                  <Link href={b.href} className="hover:underline">
                    {b.name}
                  </Link>
                ) : (
                  <span>{b.name}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}

/**
 * 8. Store/Blog/EditorialCallout (3:8149)
 * Expert note box with 4px left border in #4A7C48 (.mipik-blog-note).
 */
export function EditorialCallout({
  title = "Lưu ý chuyên gia 11Sport",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-lg bg-store-surface-sage border-l-4 border-l-store-blog-note p-4 sm:p-5 space-y-1">
      <p className="text-sm font-bold text-store-forest">{title}</p>
      <div className="text-sm text-ink-secondary leading-relaxed">
        {children}
      </div>
    </aside>
  );
}

/**
 * 9. Store/Content/PolicyProseLayout (9:1357)
 * Standardized layout shared across all 4 Policy pages (/chinh-sach-van-chuyen, /hoan-tien_tra-ve, /chinh-sach-bao-mat, /quy-dinh-su-dung).
 */
export function PolicyProseLayout({
  activeSlug,
  title,
  summary,
  sections,
  callout,
  allPolicies,
}: {
  activeSlug: string;
  title: string;
  summary: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  callout: string;
  allPolicies: Array<{ slug: string; title: string }>;
}) {
  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10 space-y-6">
      <p className="text-[14.5px] text-[#333333] leading-relaxed">{summary}</p>

      <header className="space-y-2">
        <h1 className="text-[24px] sm:text-[28px] font-bold text-[#0a0a0a] leading-snug">
          {title}
        </h1>
        <p className="text-[13.5px] italic text-[#dd3333]">
          (Áp dụng cho khách hàng mua sắm trực tiếp tại hệ thống 3 showroom và đặt hàng online trên website 11Sport)
        </p>
      </header>

      <div className="space-y-6">
        {sections.map((sec) => (
          <section key={sec.heading} className="space-y-2.5">
            <h2 className="text-[16px] sm:text-[18px] font-bold text-[#0a0a0a]">
              {sec.heading}
            </h2>
            <ul className="space-y-2 text-[14.5px] text-[#333333] leading-relaxed">
              {sec.paragraphs.map((p, i) => (
                <li
                  key={i}
                  className={
                    sec.paragraphs.length > 1
                      ? "pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#333333]"
                      : ""
                  }
                >
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <EditorialCallout title="Cam kết bảo vệ quyền lợi khách hàng">
        {callout}
      </EditorialCallout>

      <nav
        aria-label="Các chính sách khác tại 11Sport"
        className="pt-4 border-t border-[#ececec] flex flex-wrap items-center gap-2"
      >
        {allPolicies.map((pol) => {
          const isActive = pol.slug === activeSlug;
          return (
            <Link
              key={pol.slug}
              href={`/${pol.slug}`}
              className={`px-3.5 py-2 text-[13px] border transition-colors ${
                isActive
                  ? "bg-[#224e40] border-[#224e40] text-white font-semibold"
                  : "bg-white border-[#dddddd] text-[#333333] hover:border-[#224e40] hover:text-[#224e40]"
              }`}
            >
              {pol.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * 10. Store/Marketing/FeatureIconCard (9:1367 & 9:1373)
 * Variant=vision-card | trade-in-step — shared across /ve-chung-toi and /thu-cu-doi-moi.
 */
export function FeatureIconCard({
  badge,
  title,
  description,
  variant = "vision-card",
}: {
  badge: string;
  title: string;
  description: string;
  variant?: "vision-card" | "trade-in-step";
}) {
  const isVision = variant === "vision-card";
  return (
    <div
      className={`rounded-xl border border-store-border-card p-6 space-y-3 shadow-card ${
        isVision ? "bg-white" : "bg-store-surface-sage"
      }`}
    >
      <div className="inline-flex items-center gap-2">
        <span className="w-10 h-10 rounded-full bg-store-forest text-white flex items-center justify-center">
          {isVision ? (
            <Shield className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          )}
        </span>
        <span className="px-3 py-1 rounded-full bg-store-mint-bg text-store-mint-ink text-xs font-extrabold uppercase tracking-wider">
          {badge}
        </span>
      </div>
      <h2 className="text-lg font-extrabold text-store-forest">{title}</h2>
      <p className="text-sm text-ink-secondary leading-relaxed">{description}</p>
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildMetadata,
  buildProductJsonLd,
} from "@/lib/seo";
import {
  fetchProductReviews,
  fetchProducts,
  fetchRelatedProducts,
  fetchStaticPage,
  resolveRootSlug,
} from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { SeoDescriptionBox } from "@/components/catalog/SeoDescriptionBox";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { ProductCard } from "@/components/common/ProductCard";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import { ArticleDetailBody } from "@/components/blog/ArticleViews";
import {
  BrandGroupHeader,
  BrandGroupSection,
  BreadcrumbBar,
  DistributorBanner,
  EditorialCallout,
  GuaranteePillsCategory,
  PolicyProseLayout,
} from "@/components/store/StorefrontDesignSystem";

interface RootSlugPageProps {
  params: { staticSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

function getParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export async function generateMetadata({
  params,
  searchParams,
}: RootSlugPageProps): Promise<Metadata> {
  const slug = params.staticSlug;
  const resolved = await resolveRootSlug(slug);

  if (resolved?.kind === "category") {
    const cat = resolved.category.category;
    return buildMetadata({
      title: `${cat.name} Chính Hãng`,
      description:
        cat.seo?.description ||
        `Đại lý phân phối ${cat.name} chính hãng 100%, lỗi 1 đổi 1, freeship toàn quốc.`,
      path: `/${slug}`,
      image: cat.imageUrl,
      searchParams,
    });
  }

  if (resolved?.kind === "brand") {
    const b = resolved.brand;
    const isShoeBrand =
      slug.startsWith("giay-") || b.rootCategorySlug?.startsWith("giay-");
    return buildMetadata({
      title: isShoeBrand
        ? `Giày Pickleball ${b.name} Chính Hãng`
        : `Vợt & Dụng cụ Pickleball ${b.name} Chính Hãng`,
      description: `Mua sản phẩm ${b.name} chính hãng 100% có tem NFC/QR xác thực, tặng quấn cán, dán viền, bao vợt và ưu đãi giá sỉ từ 3 sản phẩm.`,
      path: `/${slug}`,
      image: b.logoUrl,
      searchParams,
    });
  }

  if (resolved?.kind === "product") {
    const p = resolved.product;
    return buildMetadata({
      title: `${p.name} Chính Hãng`,
      description:
        p.shortDescription ||
        `Mua ${p.name} chính hãng 100%, giá mua nhiều từ 3 sản phẩm cùng biến thể, freeship toàn quốc.`,
      path: `/${slug}`,
      image: p.thumbnailUrl,
    });
  }

  if (resolved?.kind === "article") {
    const a = resolved.article;
    return buildMetadata({
      title: a.title,
      description: a.excerpt || a.title,
      path: `/${slug}`,
      image: a.thumbnailUrl,
      type: "article",
    });
  }

  if (resolved?.kind === "policy") {
    const pol = resolved.policy;
    return buildMetadata({
      title: pol.title,
      description: pol.summary,
      path: `/${slug}`,
    });
  }

  if (resolved?.kind === "program") {
    const prog = resolved.program;
    return buildMetadata({
      title: prog.title,
      description: prog.subtitle,
      path: `/${slug}`,
    });
  }

  const { data: staticPage } = await fetchStaticPage(slug);
  return buildMetadata({
    title: staticPage?.title || slug.replace(/-/g, " "),
    path: `/${slug}`,
  });
}

export default async function RootCanonicalDispatcherPage({
  params,
  searchParams = {},
}: RootSlugPageProps) {
  const slug = params.staticSlug;
  const resolved = await resolveRootSlug(slug);

  // 1. TOP-LEVEL CATEGORY HUB (/vot-pickleball, /giay-pickleball, /balo-tui-pickleball, /phu-kien-pickleball, /bong-pickleball)
  if (resolved?.kind === "category") {
    const cat = resolved.category.category;
    const brands = resolved.category.brands ?? [];
    const isBrandGroupedHub =
      (cat.slug === "vot-pickleball" || cat.slug === "giay-pickleball") &&
      !getParam(searchParams.brand) &&
      !getParam(searchParams.sort) &&
      !getParam(searchParams.priceMin) &&
      !getParam(searchParams.priceMax);

    const productsRes = await fetchProducts({
      category: cat.slug,
      brand: getParam(searchParams.brand),
      priceMin: getParam(searchParams.priceMin),
      priceMax: getParam(searchParams.priceMax),
      color: getParam(searchParams.color),
      size: getParam(searchParams.size),
      inStock: getParam(searchParams.inStock),
      sort: getParam(searchParams.sort) || "featured",
      page: getParam(searchParams.page) || "1",
      limit: isBrandGroupedHub ? 100 : 20,
    });

    if (isBrandGroupedHub) {
      const seenBrandSlugs = new Set<string>();
      const groupedBrands: Array<{
        slug: string;
        name: string;
        href: string;
        products: typeof productsRes.data;
      }> = [];

      for (const b of brands) {
        const brandProducts = productsRes.data.filter(
          (p) => p.brand?.slug === b.slug
        );
        if (!brandProducts.length) continue;
        seenBrandSlugs.add(b.slug);
        groupedBrands.push({
          slug: b.slug,
          name: b.name,
          href:
            "rootCategorySlug" in b && typeof b.rootCategorySlug === "string"
              ? `/${b.rootCategorySlug}`
              : `/thuong-hieu/${b.slug}`,
          products: brandProducts,
        });
      }

      for (const p of productsRes.data) {
        const bSlug = p.brand?.slug;
        if (!bSlug || seenBrandSlugs.has(bSlug)) continue;
        seenBrandSlugs.add(bSlug);
        const brandProducts = productsRes.data.filter(
          (item) => item.brand?.slug === bSlug
        );
        groupedBrands.push({
          slug: bSlug,
          name: p.brand?.name || bSlug.toUpperCase(),
          href: `/thuong-hieu/${bSlug}`,
          products: brandProducts,
        });
      }

      const isShoes = cat.slug === "giay-pickleball";

      return (
        <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-4">
          <JsonLd
            data={buildBreadcrumbJsonLd([
              { name: "Trang chủ", path: "/" },
              { name: cat.name, path: `/${slug}` },
            ])}
          />

          <h1 className="sr-only">
            {cat.name} Chính Hãng — Hệ Thống Cửa Hàng 11Sport
          </h1>

          <BreadcrumbBar
            items={[{ name: "Trang chủ", href: "/" }, { name: cat.name }]}
          />

          {cat.slug === "vot-pickleball" && <GuaranteePillsCategory />}

          <div className="space-y-1">
            {groupedBrands.map((group) => {
              const isCenteredRow = group.products.length < 4;
              return (
                <BrandGroupSection key={group.slug}>
                  <BrandGroupHeader
                    title={
                      isShoes
                        ? `Giày ${group.name}`
                        : `Vợt Pickleball ${group.name}`
                    }
                    href={group.href}
                  />
                  {isCenteredRow ? (
                    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                      {group.products.map((p) => (
                        <div
                          key={p._id}
                          className={
                            group.products.length === 1
                              ? "w-[55%] min-w-[160px] max-w-[295px] sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"
                              : "w-[calc(50%-6px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"
                          }
                        >
                          <ProductCard product={p} density="category" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {group.products.map((p) => (
                        <ProductCard
                          key={p._id}
                          product={p}
                          density="category"
                        />
                      ))}
                    </div>
                  )}
                </BrandGroupSection>
              );
            })}
          </div>

          <SeoDescriptionBox
            html={cat.descriptionHtml}
            title={`Hướng dẫn chọn mua ${cat.name} chính hãng`}
          />
        </div>
      );
    }

    return (
      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-5">
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: cat.name, path: `/${slug}` },
          ])}
        />

        <h1 className="sr-only">
          {cat.name} Chính Hãng — Hệ Thống Cửa Hàng 11Sport
        </h1>

        <Suspense
          fallback={
            <div className="h-96 rounded-xl bg-surface-muted animate-pulse" />
          }
        >
          <CatalogClient
            breadcrumbs={[{ name: "Trang chủ", href: "/" }, { name: cat.name }]}
            products={productsRes.data}
            meta={productsRes.meta}
            facets={productsRes.facets}
            subCategories={cat.subCategories}
            hubBrands={brands}
          />
        </Suspense>

        <SeoDescriptionBox
          html={cat.descriptionHtml}
          title={`Hướng dẫn chọn mua ${cat.name} chính hãng`}
        />
      </div>
    );
  }

  // 2. ROOT BRAND ARCHIVE (/vot-pickleball-joola, /vot-pickleball-selkirk, ..., /giay-asics, /giay-skechers)
  if (resolved?.kind === "brand") {
    const brand = resolved.brand;
    const productsRes = await fetchProducts({
      brand: brand.slug,
      priceMin: getParam(searchParams.priceMin),
      priceMax: getParam(searchParams.priceMax),
      color: getParam(searchParams.color),
      size: getParam(searchParams.size),
      inStock: getParam(searchParams.inStock),
      sort: getParam(searchParams.sort) || "featured",
      page: getParam(searchParams.page) || "1",
      limit: 20,
    });

    const isShoeBrand =
      slug.startsWith("giay-") || Boolean(brand.rootCategorySlug?.startsWith("giay-"));
    const parentCat = isShoeBrand
      ? { name: "Giày Pickleball", href: "/giay-pickleball" }
      : { name: "Vợt Pickleball", href: "/vot-pickleball" };

    return (
      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-5">
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: parentCat.name, path: parentCat.href },
            { name: `${parentCat.name} ${brand.name}`, path: `/${slug}` },
          ])}
        />

        <h1 className="sr-only">
          {parentCat.name} {brand.name} Chính Hãng — 11Sport
        </h1>

        <Suspense
          fallback={
            <div className="h-96 rounded-xl bg-surface-muted animate-pulse" />
          }
        >
          <CatalogClient
            breadcrumbs={[
              { name: "Trang chủ", href: "/" },
              { name: parentCat.name, href: parentCat.href },
              { name: `${parentCat.name} ${brand.name}` },
            ]}
            products={productsRes.data}
            meta={productsRes.meta}
            facets={productsRes.facets}
            hideBrandFilter
          />
        </Suspense>

        <SeoDescriptionBox
          html={brand.descriptionHtml}
          title={`Về thương hiệu ${brand.name} chính hãng`}
        />
      </div>
    );
  }

  // 3. PRODUCT DETAIL AT ROOT SLUG (/joola-perseus-power-fx, /vot-pickleball-selkirk-boomstik-st, ...)
  if (resolved?.kind === "product") {
    const product = resolved.product;
    const [relatedProducts, reviewsData] = await Promise.all([
      fetchRelatedProducts(product.slug),
      fetchProductReviews(product._id, { page: 1, limit: 10 }),
    ]);

    const brandBreadcrumb =
      product.brand && product.category?.slug === "vot-pickleball"
        ? {
            name: `Vợt Pickleball ${product.brand.name}`,
            path: `/vot-pickleball-${product.brand.slug}`,
          }
        : product.brand
        ? {
            name: product.brand.name,
            path: `/thuong-hieu/${product.brand.slug}`,
          }
        : null;

    const visibleBreadcrumbs = [
      { name: "Trang chủ", path: "/" },
      ...(product.category
        ? [
            {
              name: product.category.name,
              path: `/${product.category.slug}`,
            },
          ]
        : []),
      ...(brandBreadcrumb ? [brandBreadcrumb] : []),
    ];

    const jsonLdBreadcrumbs = [
      ...visibleBreadcrumbs,
      { name: product.name, path: `/${product.slug}` },
    ];

    const productJsonLd = buildProductJsonLd({
      name: product.name,
      description:
        product.shortDescription || `${product.name} chính hãng 100%.`,
      slug: product.slug,
      sku: product.code,
      brandName: product.brand?.name || "11Sport",
      images:
        product.images?.map((i) => i.url) ||
        (product.thumbnailUrl ? [product.thumbnailUrl] : []),
      price: product.sellingPrice,
      inStock: product.inStock,
      ratingValue: product.ratingAvg,
      reviewCount: product.ratingCount,
      bulkTiers: (product.promotions?.tierPricing ?? [])
        .map((t) => ({
          minQty: t.minQty,
          unitPrice: Math.max(0, product.sellingPrice - (t.discountAmount || 0)),
          label: t.label,
        }))
        .filter((t) => t.unitPrice > 0),
    });

    return (
      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-4 lg:py-6 space-y-4">
        <JsonLd data={[buildBreadcrumbJsonLd(jsonLdBreadcrumbs), productJsonLd]} />

        <BreadcrumbBar
          items={visibleBreadcrumbs.map((b) => ({
            name: b.name,
            href: b.path,
          }))}
          prevNextHref={{
            prev: relatedProducts[0] ? `/${relatedProducts[0].slug}` : "/vot-pickleball",
            next: relatedProducts[1] ? `/${relatedProducts[1].slug}` : "/vot-pickleball",
          }}
        />

        <ProductDetailClient
          product={product}
          relatedProducts={relatedProducts}
          initialReviews={reviewsData}
        />
      </div>
    );
  }

  // 4. EDITORIAL BLOG ARTICLE AT ROOT SLUG (/luat-choi-pickleball, /vot-pickleball-cho-nguoi-moi, ...)
  if (resolved?.kind === "article") {
    const article = resolved.article;
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
      { name: article.title, path: `/${slug}` },
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

        <ArticleDetailBody article={article} sourceUrl={`/${article.slug}`} />
      </div>
    );
  }

  // 5. POLICY PAGES (/chinh-sach-van-chuyen, /hoan-tien_tra-ve, /chinh-sach-bao-mat, /quy-dinh-su-dung)
  if (resolved?.kind === "policy") {
    const pol = resolved.policy;
    return (
      <>
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: pol.title, path: `/${pol.slug}` },
          ])}
        />
        <PolicyProseLayout
          activeSlug={pol.slug}
          title={pol.title}
          summary={pol.summary}
          sections={pol.sections}
          callout={pol.callout}
          allPolicies={resolved.allPolicies.map((p) => ({
            slug: p.slug,
            title: p.title,
          }))}
        />
      </>
    );
  }

  // 6. PROGRAM & BRAND STATIC PAGES (/ve-chung-toi, /thu-cu-doi-moi) — 1:1 mipik.vn
  if (resolved?.kind === "program") {
    const prog = resolved.program;
    const sectionHeading =
      prog.slug === "ve-chung-toi"
        ? "TẦM NHÌN - SỨ MỆNH - MỤC TIÊU"
        : "QUY TRÌNH 3 BƯỚC THU CŨ ĐỔI MỚI VỢT PICKLEBALL";

    return (
      <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10 space-y-10">
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: prog.title, path: `/${prog.slug}` },
          ])}
        />

        {/* Top 2-Col Intro + Gradient Pill Cards + Showroom Photo */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-5">
            <h1 className="text-[24px] sm:text-[30px] font-bold uppercase tracking-wide text-[#0a0a0a]">
              {prog.title}
            </h1>
            <p className="text-[14.5px] text-[#333333] leading-relaxed">
              {prog.subtitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Link
                href="/lien-he"
                className="h-[50px] px-5 rounded-[12px] bg-[linear-gradient(90deg,#224e40_0%,#5c7c70_62%,#e8dfd8_100%)] text-white text-[14.5px] font-bold flex items-center justify-center [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:opacity-95 transition-opacity"
              >
                {prog.slug === "ve-chung-toi"
                  ? "Hồ sơ năng lực"
                  : "Đăng ký định giá vợt"}
              </Link>
              <Link
                href="/lien-he"
                className="h-[50px] px-5 rounded-[12px] bg-[linear-gradient(90deg,#224e40_0%,#5c7c70_62%,#e8dfd8_100%)] text-white text-[14.5px] font-bold flex items-center justify-center [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:opacity-95 transition-opacity"
              >
                Liên hệ tư vấn
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4 relative aspect-[16/10] w-full rounded-[10px] overflow-hidden bg-[#f3f5f4]">
            <Image
              src={
                prog.slug === "thu-cu-doi-moi"
                  ? "/mock/hero-11sport-desktop-2.jpg"
                  : "/mock/hero-11sport-desktop-1.jpg"
              }
              alt={`Showroom 11Sport - ${prog.title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        </section>

        {/* Rounded Content Card with Red Vertical Accent Bar */}
        <section className="rounded-[12px] border border-[#eeeeee] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6 sm:p-8 space-y-6">
          <h2 className="border-l-[3px] border-l-[#dd3333] pl-3 text-[18px] sm:text-[20px] font-bold uppercase tracking-wide text-[#2f4f8f]">
            {sectionHeading}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {prog.cards.map((card) => (
              <div
                key={card.badge}
                className="rounded-[10px] border border-[#e5ece5] bg-[#f8f9f5] p-5 space-y-2"
              >
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#224e40] text-white text-[11px] font-bold uppercase tracking-wider">
                  {card.badge}
                </span>
                <h3 className="text-[16px] font-bold text-[#1e2c26]">
                  {card.title}
                </h3>
                <p className="text-[13.5px] text-[#4a5568] leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <EditorialCallout title="Cam kết hệ thống 11Sport">
          {prog.callout}
        </EditorialCallout>

        <DistributorBanner />

        <QuickConsultForm variant="horizontal" sourceUrl={`/${prog.slug}`} />
      </div>
    );
  }

  // 7. FALLBACK TO BACKEND STATIC PAGE (/public/pages/:slug)
  const { data: page, notFound: isNotFound } = await fetchStaticPage(slug);
  if (isNotFound || !page) {
    notFound();
  }

  return (
    <div className="max-w-container mx-auto px-4 lg:px-6 py-6 lg:py-10 space-y-6">
      <BreadcrumbBar
        items={[{ name: "Trang chủ", href: "/" }, { name: page.title }]}
      />
      <h1 className="text-2xl sm:text-3xl font-extrabold text-store-forest">
        {page.title}
      </h1>
      <article
        className="rounded-2xl border border-store-border-card bg-white p-6 sm:p-8 prose prose-slate max-w-none text-ink-secondary"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </div>
  );
}

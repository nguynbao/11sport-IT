import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { buildMetadata } from "@/lib/seo";
import { resolveMediaUrl } from "@/lib/format";
import { STORE_I18N } from "@/lib/i18n";
import { fetchHomeData } from "@/lib/storefront";
import { MotionReveal } from "@/components/common/MotionReveal";
import { ProductCard } from "@/components/common/ProductCard";
import { HeroSlider } from "@/components/home/HeroSlider";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import {
  BoxedSectionTitle,
  DistributorBanner,
  GuaranteePillsHome,
} from "@/components/store/StorefrontDesignSystem";
import type { HomeSectionItem } from "@/types/storefront";

export const metadata = buildMetadata({
  title: "11Sport — Hệ Thống Vợt & Phụ Kiện Pickleball Chính Hãng",
  description:
    "Đại lý phân phối vợt Pickleball Joola, Selkirk, Kamito, Facolos, CRBN, giày Asics, Skechers chính hãng 100% tại 11Sport. Ưu đãi giá sỉ từ 3 sản phẩm, lỗi 1 đổi 1, freeship toàn quốc.",
  path: "/",
});

function localizeHomeSectionTitle(
  rawTitle: string,
  locale: "vi" | "en"
): string {
  if (locale === "vi") return rawTitle;
  const upper = rawTitle.trim().toUpperCase();
  const en = STORE_I18N.en.home;
  if (upper.includes("VỢT") || upper.includes("PADDLE")) return en.paddles;
  if (upper.includes("THỜI TRANG") || upper.includes("FASHION")) {
    return en.fashion;
  }
  if (upper.includes("GIÀY") || upper.includes("SHOE")) return en.shoes;
  if (upper.includes("BALO") || upper.includes("TÚI") || upper.includes("BAG")) {
    return en.bags;
  }
  if (upper.includes("PHỤ KIỆN") || upper.includes("GEAR")) {
    return en.accessories;
  }
  if (upper.includes("THƯƠNG HIỆU") || upper.includes("BRAND")) {
    return en.brands;
  }
  return rawTitle;
}

export default async function HomePage() {
  const locale = headers().get("x-locale") === "en" ? "en" : "vi";
  const homeData = await fetchHomeData();

  const banners = (homeData?.banners ?? []).filter(
    (b) => resolveMediaUrl(b.desktopImageUrl) !== ""
  );
  const heroBanners = banners.filter((b) => b.position === "HERO");
  const inlineBanners = banners.filter((b) => b.position !== "HERO");
  const categoryBlocks = homeData?.categoryBlocks ?? [];
  const featuredProducts = homeData?.featuredProducts ?? [];
  const brands = homeData?.brands ?? [];
  const uspItems = homeData?.usp ?? [];

  const sections: HomeSectionItem[] =
    homeData?.homeSections && homeData.homeSections.length > 0
      ? [...homeData.homeSections].sort((a, b) => a.sortOrder - b.sortOrder)
      : [
          { _id: "hero", type: "HERO", sortOrder: 1 },
          {
            _id: "featured",
            type: "CATEGORY_GRID",
            title: "VỢT PICKLEBALL",
            viewAllUrl: "/vot-pickleball",
            sortOrder: 2,
          },
          { _id: "usp", type: "USP", sortOrder: 3 },
          { _id: "brands", type: "BRANDS", sortOrder: 4 },
        ];

  let categoryBlockIndex = 0;
  let inlineBannerIndex = 0;

  return (
    <>
      {/* Duy nhất 1 thẻ <h1> trên trang chủ */}
      <h1 className="sr-only">
        {locale === "en"
          ? "11Sport — Authorized Pickleball Paddles, Shoes & Gear Storefront"
          : "11Sport — Hệ thống phân phối Vợt, Giày & Phụ kiện Pickleball chính hãng"}
      </h1>

      <div className="bg-white">
        {sections.map((section) => {
          switch (section.type) {
            case "HERO":
              return <HeroSlider key={section._id} banners={heroBanners} />;

            case "USP":
              return (
                <div key={section._id} className="mt-2">
                  <GuaranteePillsHome items={uspItems} locale={locale} />
                  <div className="mt-[3px]">
                    <DistributorBanner />
                  </div>
                </div>
              );

            case "FLASH_SALE":
            case "BLOG":
              return null;

            case "CATEGORY_GRID":
            case "CATEGORY_CAROUSEL": {
              const block = categoryBlocks[categoryBlockIndex];
              const isFirstGrid = categoryBlockIndex === 0;
              const products = block?.products?.length
                ? block.products
                : isFirstGrid
                ? featuredProducts
                : [];
              categoryBlockIndex += 1;

              if (!products.length) return null;

              const rawTitle =
                section.title || block?.category?.name || "SẢN PHẨM NỔI BẬT";
              const title = localizeHomeSectionTitle(rawTitle, locale);

              return (
                <section
                  key={section._id}
                  className="max-w-container mx-auto px-3 sm:px-4 lg:px-5 pt-7 lg:pt-9 pb-2"
                >
                  <MotionReveal className="space-y-5" immediate={isFirstGrid}>
                    <BoxedSectionTitle title={title} />

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                      {products.slice(0, 25).map((product) => (
                        <ProductCard
                          key={product._id}
                          product={product}
                          density="home"
                        />
                      ))}
                    </div>
                  </MotionReveal>
                </section>
              );
            }

            case "CUSTOM_BANNER": {
              const banner = inlineBanners[inlineBannerIndex];
              inlineBannerIndex += 1;
              if (!banner) return null;

              const imgNode = (
                <div className="relative w-full aspect-[16/9] sm:aspect-[1440/360] overflow-hidden bg-surface-muted my-6">
                  <Image
                    src={resolveMediaUrl(banner.desktopImageUrl)}
                    alt={banner.altText || banner.title}
                    fill
                    sizes="100vw"
                    className="hidden sm:block object-cover"
                  />
                  <Image
                    src={resolveMediaUrl(
                      banner.desktopImageUrl || banner.mobileImageUrl
                    )}
                    alt={banner.altText || banner.title}
                    fill
                    sizes="100vw"
                    className="sm:hidden object-cover"
                  />
                </div>
              );

              return (
                <MotionReveal key={section._id}>
                  {banner.linkUrl ? (
                    <Link href={banner.linkUrl} className="block">
                      {imgNode}
                    </Link>
                  ) : (
                    imgNode
                  )}
                </MotionReveal>
              );
            }

            case "BRANDS":
              return (
                <BrandCarousel
                  key={section._id}
                  brands={brands}
                  title={localizeHomeSectionTitle(
                    section.title || "THƯƠNG HIỆU PHÂN PHỐI CHÍNH HÃNG",
                    locale
                  )}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildBreadcrumbJsonLd,
  buildMetadata,
  buildProductJsonLd,
} from "@/lib/seo";
import {
  fetchProductDetail,
  fetchProductReviews,
  fetchRelatedProducts,
} from "@/lib/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { BreadcrumbBar } from "@/components/store/StorefrontDesignSystem";
import type { ProductDetail } from "@/types/storefront";

interface ProductPageProps {
  params: { slug: string };
}

function buildFallbackProduct(slug: string): ProductDetail {
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return {
    _id: slug,
    code: "11S-DEMO",
    name: title,
    slug,
    sellingPrice: 0,
    inStock: false,
    stockAvailable: 0,
    variants: [],
    shortDescription:
      "Thông tin sản phẩm đang được đồng bộ từ hệ thống 11Sport.",
  };
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { data: product } = await fetchProductDetail(params.slug);
  if (!product) {
    return buildMetadata({
      title: "Chi tiết sản phẩm",
      path: `/${params.slug}`,
    });
  }

  return buildMetadata({
    title: product.seo?.title || `${product.name} Chính Hãng`,
    description:
      product.seo?.description ||
      product.shortDescription ||
      `Mua ${product.name} chính hãng tại 11Sport. Bảo hành đầy đủ, lỗi 1 đổi 1, freeship toàn quốc.`,
    path: `/${product.slug}`,
    image:
      product.seo?.ogImage ||
      product.thumbnailUrl ||
      product.images?.[0]?.url,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { data: fetchedProduct, notFound: isNotFound } =
    await fetchProductDetail(params.slug);

  if (isNotFound) {
    notFound();
  }

  const product = fetchedProduct || buildFallbackProduct(params.slug);

  const [relatedProducts, reviewsData] = fetchedProduct
    ? await Promise.all([
        fetchRelatedProducts(params.slug),
        fetchProductReviews(fetchedProduct._id, { page: 1, limit: 10 }),
      ])
    : [[], null];

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
    { name: product.name, path: `/san-pham/${params.slug}` },
  ];

  const productJsonLd = buildProductJsonLd({
    name: product.name,
    description:
      product.shortDescription ||
      `${product.name} chính hãng phân phối tại 11Sport.`,
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

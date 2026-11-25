import { ApiError, apiFetch, isMockApiEnabled } from "@/lib/api";
import { formatVND } from "@/lib/format";
import {
  storefrontMockRepository,
  type RootSlugResolution,
} from "@/repositories/mock/storefrontMockRepository";
import type {
  ArticleDetail,
  ArticleListResponse,
  BrandSummary,
  CategoryDetailResponse,
  CustomerOrderSummary,
  CustomerProfile,
  GiftPromotion,
  HomeDataResponse,
  MenuNode,
  ProductDetail,
  ProductListItem,
  ProductListResponse,
  ReviewListResponse,
  StaticPageDetail,
  TierPricingRule,
} from "@/types/storefront";

export type { RootSlugResolution };

export interface SiteShowroomData {
  name: string;
  address: string;
  phone?: string;
  hours?: string;
  mapUrl?: string;
  embedUrl?: string;
}

export interface SiteSettingsData {
  siteName?: string;
  logoUrl?: string;
  topBarText?: string;
  hotline?: string;
  email?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  showrooms?: SiteShowroomData[];
  shipping?: {
    defaultFee?: number;
    freeShipThreshold?: number;
  };
}

export interface SitemapApiPayload {
  categories: Array<{ slug: string; updatedAt?: string }>;
  brands: Array<{ slug: string; updatedAt?: string }>;
  products: Array<{ slug: string; updatedAt?: string }>;
  articles: Array<{ slug: string; updatedAt?: string }>;
  pages: Array<{ slug: string; updatedAt?: string }>;
}

/**
 * Chuẩn hóa schema `promotions` trả về từ BE `/public/products/:slug`
 * (BE dùng `discountType`/`discountValue` và `name` + `gifts[]`) về shape thống nhất cho UI.
 */
export function normalizeProductPromotions(detail: ProductDetail): ProductDetail {
  const basePrice = Math.max(0, Number(detail.sellingPrice || 0));

  const normalizedTiers: TierPricingRule[] = (
    detail.promotions?.tierPricing ?? []
  ).map((rule) => {
    const discountAmount =
      typeof rule.discountAmount === "number"
        ? rule.discountAmount
        : rule.discountType === "AMOUNT" && typeof rule.discountValue === "number"
        ? rule.discountValue
        : undefined;

    const discountPercent =
      typeof rule.discountPercent === "number"
        ? rule.discountPercent
        : rule.discountType === "PERCENT" && typeof rule.discountValue === "number"
        ? rule.discountValue
        : undefined;

    let label = rule.label;
    if (!label && basePrice > 0) {
      const unitPrice =
        discountAmount && discountAmount > 0
          ? Math.max(0, Math.round(basePrice - discountAmount))
          : discountPercent && discountPercent > 0
          ? Math.max(0, Math.round(basePrice * (1 - discountPercent / 100)))
          : basePrice;
      label = `Mua từ ${rule.minQty} sản phẩm cùng biến thể → ${formatVND(unitPrice)} / sp`;
    }

    return {
      ...rule,
      ...(typeof discountAmount === "number" ? { discountAmount } : {}),
      ...(typeof discountPercent === "number" ? { discountPercent } : {}),
      ...(label ? { label } : {}),
    };
  });

  const normalizedGifts: GiftPromotion[] = (
    detail.promotions?.giftPromotions ?? []
  ).map((gift) => {
    const giftSummary =
      gift.giftProductName ||
      (Array.isArray(gift.gifts) && gift.gifts.length > 0
        ? gift.gifts
            .map((g) =>
              g.quantity && g.quantity > 1
                ? `${g.quantity} ${g.productName}`
                : g.productName
            )
            .join(" + ")
        : gift.name || "Quà tặng 11Sport");

    const title =
      gift.title ||
      (gift.minQuantity
        ? `Mua ${gift.minQuantity} sản phẩm → ${giftSummary}`
        : gift.name || giftSummary);

    return {
      ...gift,
      title,
      giftProductName: giftSummary,
      description: gift.description || gift.name || giftSummary,
    };
  });

  return {
    ...detail,
    promotions: {
      tierPricing: normalizedTiers,
      giftPromotions: normalizedGifts,
    },
  };
}

export async function fetchSiteSettings(): Promise<SiteSettingsData | null> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.getSiteSettings();
  }
  try {
    const res = await apiFetch<{ data: SiteSettingsData }>("/public/settings", {
      next: { revalidate: 60, tags: ["settings", "home"] },
    });
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchMenu(): Promise<MenuNode[]> {
  if (isMockApiEnabled()) {
    return [];
  }
  try {
    const res = await apiFetch<{ data: MenuNode[] }>("/public/menu", {
      next: { revalidate: 60, tags: ["menu"] },
    });
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

export async function fetchHomeData(): Promise<HomeDataResponse | null> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.getHomeData();
  }
  try {
    const res = await apiFetch<{ data: HomeDataResponse }>("/public/home", {
      next: { revalidate: 60, tags: ["home"] },
    });
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchCategoryDetail(
  slug: string
): Promise<{ data: CategoryDetailResponse | null; notFound: boolean }> {
  if (isMockApiEnabled()) {
    const mockCat = storefrontMockRepository.getCategoryBySlug(slug);
    return { data: mockCat, notFound: !mockCat };
  }
  try {
    type FlatCategoryPayload = CategoryDetailResponse["category"] & {
      brands?: BrandSummary[];
      subCategories?: CategoryDetailResponse["subCategories"];
    };
    const res = await apiFetch<{
      data: CategoryDetailResponse | FlatCategoryPayload;
    }>(`/public/categories/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120, tags: ["categories", `category-${slug}`] },
    });
    const raw = res?.data;
    if (!raw) {
      return { data: null, notFound: true };
    }

    if ("category" in raw && raw.category) {
      return { data: raw, notFound: false };
    }

    const flat = raw as FlatCategoryPayload;
    return {
      data: {
        category: flat,
        brands: flat.brands ?? [],
        subCategories: flat.subCategories ?? [],
      },
      notFound: false,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, notFound: true };
    }
    return { data: null, notFound: false };
  }
}

export async function fetchBrandDetail(
  slug: string
): Promise<{ data: BrandSummary | null; notFound: boolean }> {
  if (isMockApiEnabled()) {
    const mockBrand = storefrontMockRepository.getBrandBySlug(slug);
    return { data: mockBrand, notFound: !mockBrand };
  }
  try {
    const res = await apiFetch<{ data: BrandSummary }>(
      `/public/brands/${encodeURIComponent(slug)}`,
      { next: { revalidate: 120, tags: ["brands", `brand-${slug}`] } }
    );
    if (res?.data) return { data: res.data, notFound: false };
    return { data: null, notFound: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, notFound: true };
    }
    return { data: null, notFound: false };
  }
}

export interface ProductQueryParams {
  category?: string;
  brand?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  color?: string;
  size?: string;
  inStock?: string | boolean;
  q?: string;
  sort?: string;
  page?: string | number;
  limit?: string | number;
}

export async function fetchProducts(
  params: ProductQueryParams
): Promise<ProductListResponse> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.queryProducts(params);
  }
  try {
    const res = await apiFetch<ProductListResponse>("/public/products", {
      params: {
        category: params.category,
        brand: params.brand,
        priceMin: params.priceMin,
        priceMax: params.priceMax,
        color: params.color,
        size: params.size,
        inStock: params.inStock,
        q: params.q,
        sort: params.sort || "featured",
        page: params.page || 1,
        limit: params.limit || 20,
      },
      next: { revalidate: 60, tags: ["products"] },
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const limit = Number(params.limit || 20);
    return {
      data: list,
      meta: res?.meta ?? {
        total: list.length,
        page: Number(params.page || 1),
        limit,
        totalPages: 1,
      },
      facets: res?.facets,
    };
  } catch {
    return {
      data: [],
      meta: {
        total: 0,
        page: Number(params.page || 1),
        limit: Number(params.limit || 20),
        totalPages: 1,
      },
    };
  }
}

export async function fetchProductDetail(
  slug: string
): Promise<{ data: ProductDetail | null; notFound: boolean }> {
  if (isMockApiEnabled()) {
    const mockProd = storefrontMockRepository.getProductBySlug(slug);
    return {
      data: mockProd ? normalizeProductPromotions(mockProd) : null,
      notFound: !mockProd,
    };
  }
  try {
    const res = await apiFetch<{ data: ProductDetail }>(
      `/public/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60, tags: ["products", `product-${slug}`] } }
    );
    if (res?.data) {
      return { data: normalizeProductPromotions(res.data), notFound: false };
    }
    return { data: null, notFound: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, notFound: true };
    }
    return { data: null, notFound: false };
  }
}

export async function fetchRelatedProducts(
  slug: string
): Promise<ProductListItem[]> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.getRelatedProducts(slug);
  }
  try {
    const res = await apiFetch<{ data: ProductListItem[] }>(
      `/public/products/${encodeURIComponent(slug)}/related`,
      { next: { revalidate: 120, tags: ["products"] } }
    );
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

export async function fetchProductReviews(
  productId: string,
  params?: { rating?: number; hasImages?: boolean; page?: number; limit?: number }
): Promise<ReviewListResponse | null> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.getReviews();
  }
  try {
    const res = await apiFetch<ReviewListResponse>("/public/reviews", {
      params: {
        productId,
        rating: params?.rating,
        hasImages: params?.hasImages,
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
      },
      next: { revalidate: 60, tags: [`reviews-${productId}`] },
    });
    return res ?? null;
  } catch {
    return null;
  }
}

export async function fetchArticles(params?: {
  category?: string;
  q?: string;
  page?: number | string;
  limit?: number;
}): Promise<ArticleListResponse> {
  if (isMockApiEnabled()) {
    return storefrontMockRepository.queryArticles(params);
  }
  try {
    const res = await apiFetch<ArticleListResponse>("/public/articles", {
      params: {
        category: params?.category,
        q: params?.q,
        page: params?.page ?? 1,
        limit: params?.limit ?? 12,
      },
      next: { revalidate: 120, tags: ["articles"] },
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const derivedCategoriesMap = new Map<
      string,
      { name: string; slug: string }
    >();
    for (const item of list) {
      if (item.category?.slug && !derivedCategoriesMap.has(item.category.slug)) {
        derivedCategoriesMap.set(item.category.slug, {
          name: item.category.name,
          slug: item.category.slug,
        });
      }
    }
    return {
      data: list,
      meta: res?.meta ?? {
        total: list.length,
        page: Number(params?.page ?? 1),
        limit: Number(params?.limit ?? 12),
        totalPages: 1,
      },
      categories:
        res?.categories && res.categories.length > 0
          ? res.categories
          : Array.from(derivedCategoriesMap.values()),
    };
  } catch {
    return {
      data: [],
      meta: {
        total: 0,
        page: Number(params?.page ?? 1),
        limit: Number(params?.limit ?? 12),
        totalPages: 1,
      },
      categories: [],
    };
  }
}

export async function fetchArticleDetail(
  slug: string
): Promise<{ data: ArticleDetail | null; notFound: boolean }> {
  if (isMockApiEnabled()) {
    const mockArt = storefrontMockRepository.getArticleBySlug(slug);
    return { data: mockArt, notFound: !mockArt };
  }
  try {
    const res = await apiFetch<{ data: ArticleDetail }>(
      `/public/articles/${encodeURIComponent(slug)}`,
      { next: { revalidate: 120, tags: ["articles", `article-${slug}`] } }
    );
    if (res?.data) return { data: res.data, notFound: false };
    return { data: null, notFound: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, notFound: true };
    }
    return { data: null, notFound: false };
  }
}

export async function fetchStaticPage(
  slug: string
): Promise<{ data: StaticPageDetail | null; notFound: boolean }> {
  if (isMockApiEnabled()) {
    const mockPage = storefrontMockRepository.getStaticPage(slug);
    return { data: mockPage, notFound: !mockPage };
  }
  try {
    const res = await apiFetch<{ data: StaticPageDetail }>(
      `/public/pages/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300, tags: ["pages", `page-${slug}`] } }
    );
    if (res?.data) return { data: res.data, notFound: false };
    return { data: null, notFound: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, notFound: true };
    }
    return { data: null, notFound: false };
  }
}

export async function fetchSitemapData(): Promise<SitemapApiPayload | null> {
  if (isMockApiEnabled()) {
    return null;
  }
  try {
    const res = await apiFetch<{ data: SitemapApiPayload }>(
      "/public/sitemap-data",
      { next: { revalidate: 300, tags: ["sitemap"] } }
    );
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export async function resolveRootSlug(
  slug: string
): Promise<RootSlugResolution | null> {
  if (!isMockApiEnabled()) {
    const [catRes, brandDirectRes, brandStrippedRes, prodRes, artRes] =
      await Promise.all([
        fetchCategoryDetail(slug),
        fetchBrandDetail(slug),
        slug.startsWith("vot-pickleball-")
          ? fetchBrandDetail(slug.replace(/^vot-pickleball-/, ""))
          : slug.startsWith("giay-")
          ? fetchBrandDetail(slug.replace(/^giay-/, ""))
          : Promise.resolve({ data: null, notFound: true }),
        fetchProductDetail(slug),
        fetchArticleDetail(slug),
      ]);

    if (catRes.data) return { kind: "category", category: catRes.data };
    const resolvedBrand = brandDirectRes.data || brandStrippedRes.data;
    if (resolvedBrand) return { kind: "brand", brand: resolvedBrand };
    if (prodRes.data) return { kind: "product", product: prodRes.data };
    if (artRes.data) return { kind: "article", article: artRes.data };
    return null;
  }
  return storefrontMockRepository.resolveRootSlug(slug);
}

export function getAllBrandsList() {
  return storefrontMockRepository.getAllBrands();
}

export function getAllCategoriesList() {
  return storefrontMockRepository.getAllCategories();
}

export function getAllPolicyPages() {
  return storefrontMockRepository.getPolicyPages();
}

export function getAllProgramPages() {
  return storefrontMockRepository.getProgramPages();
}

export function getMockCustomerSession(): {
  profile: CustomerProfile;
  orders: CustomerOrderSummary[];
} {
  return {
    profile: storefrontMockRepository.getCustomerProfile(),
    orders: storefrontMockRepository.getCustomerOrders(),
  };
}

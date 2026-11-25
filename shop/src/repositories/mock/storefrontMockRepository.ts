import {
  buildStaticPageFromPolicyOrProgram,
  MOCK_ARTICLE_CATEGORIES,
  MOCK_ARTICLES,
  MOCK_BRANDS,
  MOCK_CATEGORIES,
  MOCK_CUSTOMER_ORDERS,
  MOCK_CUSTOMER_PROFILE,
  MOCK_HOME_DATA,
  MOCK_POLICY_PAGES,
  MOCK_PRODUCTS,
  MOCK_PROGRAM_PAGES,
  MOCK_REVIEWS,
  MOCK_SITE_SETTINGS,
  type MockBrandExtended,
  type MockPolicyPage,
  type MockProgramPage,
} from "@/data/mock/storefront.mock";
import { stripVietnameseDiacritics } from "@/lib/format";
import {
  calculatePerVariantCartPricing,
  rankStorefrontProducts,
} from "@/lib/pricingAndSearch";
import type {
  ArticleDetail,
  ArticleListResponse,
  BrandSummary,
  CartPriceResponse,
  CategoryDetailResponse,
  CustomerOrderSummary,
  CustomerProfile,
  HomeDataResponse,
  ProductDetail,
  ProductListItem,
  ProductListResponse,
  ReviewListResponse,
  StaticPageDetail,
} from "@/types/storefront";
import type { ProductQueryParams, SiteSettingsData } from "@/lib/storefront";

export type RootSlugResolution =
  | { kind: "category"; category: CategoryDetailResponse }
  | { kind: "brand"; brand: BrandSummary & Partial<MockBrandExtended> }
  | { kind: "product"; product: ProductDetail }
  | { kind: "article"; article: ArticleDetail }
  | { kind: "policy"; policy: MockPolicyPage; allPolicies: MockPolicyPage[] }
  | { kind: "program"; program: MockProgramPage };

export const storefrontMockRepository = {
  getSiteSettings(): SiteSettingsData {
    return MOCK_SITE_SETTINGS;
  },

  getHomeData(): HomeDataResponse {
    return MOCK_HOME_DATA;
  },

  getAllCategories() {
    return MOCK_CATEGORIES;
  },

  getAllBrands(): MockBrandExtended[] {
    return MOCK_BRANDS;
  },

  getAllProducts(): ProductDetail[] {
    return MOCK_PRODUCTS;
  },

  getCategoryBySlug(slug: string): CategoryDetailResponse | null {
    // Direct category match or English alias match
    const normalized = slug.replace(/___(en|vi)$/, "");
    const aliasMap: Record<string, string> = {
      "pickleball-paddles": "vot-pickleball",
      "pickleball-shoes": "giay-pickleball",
      "pickleball-backpacks-bags": "balo-tui-pickleball",
      "pickleball-accessories": "phu-kien-pickleball",
      "pickleball-balls": "bong-pickleball",
      "mipik-fashion": "thoi-trang",
      "mipik-sportwear": "thoi-trang",
      "ao-mipik": "ao-pikpro",
      "non-mipik": "non-pikpro",
      "tui-mipik": "tui-pikpro",
      "tat-mipik": "tat-pikpro",
      "combo-mipik": "combo-pikpro",
      "ao-11sport": "ao-pikpro",
      "non-11sport": "non-pikpro",
      "tui-11sport": "tui-pikpro",
      "tat-11sport": "tat-pikpro",
      "combo-11sport": "combo-pikpro",
    };
    const targetSlug = aliasMap[normalized] || normalized;

    const direct = MOCK_CATEGORIES.find((c) => c.slug === targetSlug);
    if (direct) {
      return {
        category: direct,
        subCategories: direct.subCategories ?? [],
        brands: MOCK_BRANDS,
      };
    }

    for (const parent of MOCK_CATEGORIES) {
      const sub = parent.subCategories?.find((s) => s.slug === targetSlug);
      if (sub) {
        return {
          category: {
            ...sub,
            descriptionHtml:
              sub.descriptionHtml || parent.descriptionHtml,
          },
          subCategories: parent.subCategories ?? [],
          brands: MOCK_BRANDS,
        };
      }
    }

    // Fallback: match any brand rootCategorySlug or enRootSlugAlias as a valid brand-category page
    const brandAsCat = this.getBrandBySlug(targetSlug);
    if (brandAsCat) {
      return {
        category: {
          _id: brandAsCat._id,
          name: brandAsCat.rootCategorySlug.startsWith("giay-")
            ? `Giày ${brandAsCat.name}`
            : `Vợt Pickleball ${brandAsCat.name}`,
          slug: targetSlug,
          imageUrl: brandAsCat.logoUrl,
          descriptionHtml: brandAsCat.descriptionHtml,
        },
        subCategories: [],
        brands: MOCK_BRANDS,
      };
    }

    return null;
  },

  getBrandBySlug(slug: string): MockBrandExtended | null {
    const clean = slug.replace(/___(en|vi)$/, "");
    return (
      MOCK_BRANDS.find(
        (b) =>
          b.slug === clean ||
          b.rootCategorySlug === clean ||
          b.enRootSlugAlias === clean
      ) ?? null
    );
  },

  queryProducts(params: ProductQueryParams): ProductListResponse {
    let items: ProductDetail[] = [...MOCK_PRODUCTS];

    if (params.category) {
      const cat = params.category.replace(/___(en|vi)$/, "");
      const brandMatch = this.getBrandBySlug(cat);
      if (brandMatch) {
        const brandFiltered = items.filter(
          (p) => p.brand?.slug === brandMatch.slug
        );
        items =
          brandFiltered.length > 0
            ? brandFiltered
            : items.filter((p) => p.category?.slug === "vot-pickleball");
      } else if (
        [
          "ao-pikpro",
          "non-pikpro",
          "tui-pikpro",
          "tat-pikpro",
          "combo-pikpro",
          "ao-11sport",
          "non-11sport",
          "tui-11sport",
          "tat-11sport",
          "combo-11sport",
        ].includes(cat)
      ) {
        items = items.filter((p) => p.category?.slug === "thoi-trang");
      } else if (cat === "giay-on" || cat === "giay-kaitashi") {
        items = items.filter((p) => p.category?.slug === "giay-pickleball");
      } else if (cat === "bong-pickleball") {
        items = items.filter(
          (p) =>
            p.category?.slug === "phu-kien-pickleball" ||
            p.slug.includes("bong")
        );
      } else {
        items = items.filter((p) => p.category?.slug === cat);
      }
    }

    if (params.brand) {
      const brands = String(params.brand)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (brands.length > 0) {
        items = items.filter((p) => {
          const bSlug = p.brand?.slug?.toLowerCase() || "";
          const bRoot =
            MOCK_BRANDS.find((b) => b.slug === bSlug)?.rootCategorySlug || "";
          return brands.includes(bSlug) || brands.includes(bRoot);
        });
      }
    }

    if (params.priceMin !== undefined && params.priceMin !== "") {
      const min = Number(params.priceMin);
      if (Number.isFinite(min)) {
        items = items.filter((p) => p.sellingPrice >= min);
      }
    }

    if (params.priceMax !== undefined && params.priceMax !== "") {
      const max = Number(params.priceMax);
      if (Number.isFinite(max) && max > 0) {
        items = items.filter((p) => p.sellingPrice <= max);
      }
    }

    if (params.color) {
      const col = String(params.color).toLowerCase();
      items = items.filter((p) =>
        p.colors?.some((c) => c.color.toLowerCase().includes(col))
      );
    }

    if (params.size) {
      const sz = String(params.size).toLowerCase();
      items = items.filter((p) =>
        p.variants?.some((v) => v.size?.toLowerCase().includes(sz))
      );
    }

    if (params.inStock === true || params.inStock === "true") {
      items = items.filter((p) => p.inStock);
    }

    if (params.q && String(params.q).trim()) {
      items = rankStorefrontProducts(items, String(params.q));
    } else {
      const sort = params.sort || "featured";
      if (sort === "price_asc" || sort === "price-asc") {
        items.sort((a, b) => a.sellingPrice - b.sellingPrice);
      } else if (sort === "price_desc" || sort === "price-desc") {
        items.sort((a, b) => b.sellingPrice - a.sellingPrice);
      } else if (sort === "newest") {
        items.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
      }
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return {
      data: paged,
      meta: { total, page, limit, totalPages },
      facets: {
        brands: MOCK_BRANDS.map((b) => ({
          name: b.name,
          slug: b.slug,
          count: b.productCount,
        })),
        colors: ["Blaze Red", "Mint Green", "Midnight Navy", "Tour Gold", "Forest Green"],
        sizes: ["16mm (Control)", "14mm (Power)", "40", "41", "42", "43", "M", "L", "XL"],
        priceRange: { min: 150_000, max: 6_900_000 },
      },
    };
  },

  getProductBySlug(slug: string): ProductDetail | null {
    return MOCK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  },

  getRelatedProducts(slug: string): ProductListItem[] {
    const current = this.getProductBySlug(slug);
    const candidates = MOCK_PRODUCTS.filter((p) => p.slug !== slug);
    if (!current) return candidates.slice(0, 5);
    const sameCat = candidates.filter(
      (p) => p.category?.slug === current.category?.slug
    );
    return (sameCat.length > 0 ? sameCat : candidates).slice(0, 5);
  },

  getReviews(): ReviewListResponse {
    return MOCK_REVIEWS;
  },

  getArticleCategories() {
    return MOCK_ARTICLE_CATEGORIES;
  },

  queryArticles(params?: {
    category?: string;
    q?: string;
    page?: number | string;
    limit?: number;
  }): ArticleListResponse {
    let items = [...MOCK_ARTICLES];
    if (params?.category) {
      items = items.filter((a) => a.category?.slug === params.category);
    }
    if (params?.q && params.q.trim()) {
      const qNorm = stripVietnameseDiacritics(params.q);
      items = items.filter((a) => {
        const hay = stripVietnameseDiacritics(
          `${a.title} ${a.excerpt || ""} ${a.category?.name || ""}`
        );
        return hay.includes(qNorm);
      });
    }
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Number(params?.limit) || 12);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: items.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages },
      categories: MOCK_ARTICLE_CATEGORIES,
    };
  },

  getArticleBySlug(slug: string): ArticleDetail | null {
    return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null;
  },

  getPolicyPages(): MockPolicyPage[] {
    return MOCK_POLICY_PAGES;
  },

  getPolicyBySlug(slug: string): MockPolicyPage | null {
    return MOCK_POLICY_PAGES.find((p) => p.slug === slug) ?? null;
  },

  getProgramPages(): MockProgramPage[] {
    return MOCK_PROGRAM_PAGES;
  },

  getProgramBySlug(slug: string): MockProgramPage | null {
    return MOCK_PROGRAM_PAGES.find((p) => p.slug === slug) ?? null;
  },

  getStaticPage(slug: string): StaticPageDetail | null {
    return buildStaticPageFromPolicyOrProgram(slug);
  },

  getCustomerProfile(): CustomerProfile {
    return MOCK_CUSTOMER_PROFILE;
  },

  getCustomerOrders(): CustomerOrderSummary[] {
    return MOCK_CUSTOMER_ORDERS;
  },

  /**
   * Resolves any root-level mipik.vn slug deterministically:
   * 1. Top-level Category (/vot-pickleball, /giay-pickleball, /balo-tui-pickleball, /phu-kien-pickleball, /bong-pickleball)
   * 2. Root Brand Hub (/vot-pickleball-joola, /vot-pickleball-selkirk, ..., /giay-asics, /giay-skechers)
   * 3. Product Detail (/joola-perseus-power-fx, /vot-pickleball-selkirk-boomstik-st, ...)
   * 4. Blog Article (/luat-choi-pickleball, /vot-pickleball-cho-nguoi-moi, ...)
   * 5. Policy Page (/chinh-sach-van-chuyen, /hoan-tien_tra-ve, /chinh-sach-bao-mat, /quy-dinh-su-dung)
   * 6. Program / Brand Static Page (/ve-chung-toi, /thu-cu-doi-moi)
   */
  resolveRootSlug(slug: string): RootSlugResolution | null {
    const cat = this.getCategoryBySlug(slug);
    if (cat && MOCK_CATEGORIES.some((c) => c.slug === cat.category.slug)) {
      return { kind: "category", category: cat };
    }

    const brand = MOCK_BRANDS.find(
      (b) => b.rootCategorySlug === slug || b.enRootSlugAlias === slug
    );
    if (brand) {
      return { kind: "brand", brand };
    }

    if (
      cat &&
      MOCK_CATEGORIES.some((c) =>
        c.subCategories?.some((s) => s.slug === cat.category.slug)
      )
    ) {
      return { kind: "category", category: cat };
    }

    const product = this.getProductBySlug(slug);
    if (product) {
      return { kind: "product", product };
    }

    const article = this.getArticleBySlug(slug);
    if (article) {
      return { kind: "article", article };
    }

    const policy = this.getPolicyBySlug(slug);
    if (policy) {
      return {
        kind: "policy",
        policy,
        allPolicies: MOCK_POLICY_PAGES,
      };
    }

    const program = this.getProgramBySlug(slug);
    if (program) {
      return { kind: "program", program };
    }

    return null;
  },

  /**
   * Mock API Router — simulates 100% of API Contract v5.0 `/api/v1/public/*`
   * response shapes (`{ data, meta }`, status codes, per-variant pricing, coupons,
   * OTP login, order creation, and lookup) so the Next.js frontend works standalone
   * and the backend team can swap in the real server with zero frontend code changes.
   */
  handlePublicApiRequest(
    path: string,
    options: {
      method?: string;
      params?: Record<string, string | number | boolean | undefined | null>;
      body?: string | null;
      headers?: Record<string, string>;
    } = {}
  ): { status: number; payload: unknown } {
    const method = (options.method || "GET").toUpperCase();
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const params = options.params || {};
    let parsedBody: Record<string, unknown> = {};
    if (typeof options.body === "string" && options.body.trim()) {
      try {
        parsedBody = JSON.parse(options.body) as Record<string, unknown>;
      } catch {
        parsedBody = {};
      }
    }

    // 1. GET /public/home
    if (method === "GET" && cleanPath === "/public/home") {
      return { status: 200, payload: { data: this.getHomeData(), meta: {} } };
    }

    // 2. GET /public/settings
    if (method === "GET" && cleanPath === "/public/settings") {
      return { status: 200, payload: { data: this.getSiteSettings(), meta: {} } };
    }

    // 3. GET /public/menu
    if (method === "GET" && cleanPath === "/public/menu") {
      const menu = MOCK_CATEGORIES.map((cat, idx) => ({
        _id: cat._id,
        label: cat.name,
        url: `/${cat.slug}`,
        badge: cat.slug === "thoi-trang" ? "NEW" : null,
        sortOrder: idx + 1,
        children: (cat.subCategories || []).map((sub, sIdx) => ({
          _id: sub._id,
          label: sub.name,
          url: `/danh-muc-san-pham/${cat.slug}/${sub.slug}`,
          sortOrder: sIdx + 1,
        })),
      }));
      return { status: 200, payload: { data: menu, meta: {} } };
    }

    // 4. GET /public/categories/:slug
    const catMatch = cleanPath.match(/^\/public\/categories\/([^/]+)$/);
    if (method === "GET" && catMatch) {
      const slug = decodeURIComponent(catMatch[1]);
      const detail = this.getCategoryBySlug(slug);
      if (!detail) {
        return {
          status: 404,
          payload: {
            code: "CATEGORY_NOT_FOUND",
            message: "Không tìm thấy danh mục sản phẩm.",
          },
        };
      }
      return { status: 200, payload: { data: detail, meta: {} } };
    }

    // 5. GET /public/brands & GET /public/brands/:slug
    if (method === "GET" && cleanPath === "/public/brands") {
      return {
        status: 200,
        payload: {
          data: this.getAllBrands(),
          meta: { total: this.getAllBrands().length },
        },
      };
    }
    const brandMatch = cleanPath.match(/^\/public\/brands\/([^/]+)$/);
    if (method === "GET" && brandMatch) {
      const slug = decodeURIComponent(brandMatch[1]);
      const brand = this.getBrandBySlug(slug);
      if (!brand) {
        return {
          status: 404,
          payload: {
            code: "BRAND_NOT_FOUND",
            message: "Không tìm thấy thương hiệu.",
          },
        };
      }
      return { status: 200, payload: { data: brand, meta: {} } };
    }

    // 6. GET /public/products, /public/products/:slug, /public/products/:slug/related
    if (method === "GET" && cleanPath === "/public/products") {
      return {
        status: 200,
        payload: this.queryProducts({
          category: params.category ? String(params.category) : undefined,
          brand: params.brand ? String(params.brand) : undefined,
          priceMin: params.priceMin !== undefined && params.priceMin !== null ? String(params.priceMin) : undefined,
          priceMax: params.priceMax !== undefined && params.priceMax !== null ? String(params.priceMax) : undefined,
          color: params.color ? String(params.color) : undefined,
          size: params.size ? String(params.size) : undefined,
          inStock: params.inStock !== undefined && params.inStock !== null ? String(params.inStock) : undefined,
          q: params.q ? String(params.q) : undefined,
          sort: params.sort ? String(params.sort) : undefined,
          page: params.page !== undefined && params.page !== null ? Number(params.page) : 1,
          limit: params.limit !== undefined && params.limit !== null ? Number(params.limit) : 20,
        }),
      };
    }

    const relatedMatch = cleanPath.match(/^\/public\/products\/([^/]+)\/related$/);
    if (method === "GET" && relatedMatch) {
      const slug = decodeURIComponent(relatedMatch[1]);
      return {
        status: 200,
        payload: { data: this.getRelatedProducts(slug), meta: {} },
      };
    }

    const prodMatch = cleanPath.match(/^\/public\/products\/([^/]+)$/);
    if (method === "GET" && prodMatch) {
      const slug = decodeURIComponent(prodMatch[1]);
      const prod = this.getProductBySlug(slug);
      if (!prod) {
        return {
          status: 404,
          payload: {
            code: "PRODUCT_NOT_FOUND",
            message: "Không tìm thấy sản phẩm.",
          },
        };
      }
      return { status: 200, payload: { data: prod, meta: {} } };
    }

    // 7. GET /public/search/suggest
    if (method === "GET" && cleanPath === "/public/search/suggest") {
      const q = params.q ? String(params.q) : "";
      const products = this.queryProducts({ q, limit: 6 }).data.map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        thumbnailUrl: p.thumbnailUrl,
        sellingPrice: p.sellingPrice,
        compareAtPrice: p.compareAtPrice,
      }));
      const articles = this.queryArticles({ q, limit: 4 }).data.map((a) => ({
        _id: a._id,
        title: a.title,
        slug: a.slug,
        thumbnailUrl: a.thumbnailUrl,
      }));
      return {
        status: 200,
        payload: { data: { products, articles }, meta: {} },
      };
    }

    // 8. GET /public/articles & GET /public/articles/:slug
    if (method === "GET" && cleanPath === "/public/articles") {
      return {
        status: 200,
        payload: this.queryArticles({
          category: params.category ? String(params.category) : undefined,
          q: params.q ? String(params.q) : undefined,
          page: params.page !== undefined && params.page !== null ? Number(params.page) : 1,
          limit: params.limit !== undefined && params.limit !== null ? Number(params.limit) : 12,
        }),
      };
    }

    const artMatch = cleanPath.match(/^\/public\/articles\/([^/]+)$/);
    if (method === "GET" && artMatch) {
      const slug = decodeURIComponent(artMatch[1]);
      const art = this.getArticleBySlug(slug);
      if (!art) {
        return {
          status: 404,
          payload: {
            code: "ARTICLE_NOT_FOUND",
            message: "Không tìm thấy bài viết.",
          },
        };
      }
      return { status: 200, payload: { data: art, meta: {} } };
    }

    // 9. GET /public/pages/:slug
    const pageMatch = cleanPath.match(/^\/public\/pages\/([^/]+)$/);
    if (method === "GET" && pageMatch) {
      const slug = decodeURIComponent(pageMatch[1]);
      const page = this.getStaticPage(slug);
      if (!page) {
        return {
          status: 404,
          payload: {
            code: "PAGE_NOT_FOUND",
            message: "Không tìm thấy trang tĩnh.",
          },
        };
      }
      return { status: 200, payload: { data: page, meta: {} } };
    }

    // 10. GET & POST /public/reviews
    if (cleanPath === "/public/reviews") {
      if (method === "GET") {
        const rev = this.getReviews();
        const ratingFilter = params.rating ? Number(params.rating) : undefined;
        const hasImagesFilter =
          params.hasImages === true || params.hasImages === "true";
        let filtered = [...rev.data];
        if (ratingFilter) {
          filtered = filtered.filter((r) => r.rating === ratingFilter);
        }
        if (hasImagesFilter) {
          filtered = filtered.filter((r) => (r.images?.length ?? 0) > 0);
        }
        return {
          status: 200,
          payload: {
            ...rev,
            data: filtered,
            meta: { ...rev.meta, total: filtered.length },
          },
        };
      }
      if (method === "POST") {
        return {
          status: 201,
          payload: {
            data: {
              _id: `rev-mock-${Date.now()}`,
              status: "PENDING",
            },
            message:
              "Đánh giá của bạn đã được ghi nhận và đang chờ duyệt.",
          },
        };
      }
    }

    // 11. POST /public/contact
    if (method === "POST" && cleanPath === "/public/contact") {
      return {
        status: 201,
        payload: {
          message:
            "Cảm ơn bạn đã liên hệ. Đội ngũ HLV & kỹ thuật viên 11Sport sẽ phản hồi trong thời gian sớm nhất.",
        },
      };
    }

    // 12. POST /public/cart/price (API Contract §2.14.D)
    if (method === "POST" && cleanPath === "/public/cart/price") {
      const rawItems = Array.isArray(parsedBody.items)
        ? (parsedBody.items as Array<{
            productId?: string;
            variantKey?: string;
            quantity?: number;
          }>)
        : [];
      const couponCode =
        typeof parsedBody.couponCode === "string"
          ? parsedBody.couponCode.trim().toUpperCase()
          : "";

      const resolvedLines = rawItems.map((reqItem) => {
        const product =
          MOCK_PRODUCTS.find((p) => p._id === reqItem.productId) ||
          MOCK_PRODUCTS[0];
        const variant = product.variants?.find(
          (v) => v.variantKey === reqItem.variantKey
        );
        const unitPrice =
          variant?.effectiveSellingPrice ?? product.sellingPrice;
        const qty = Math.max(1, Number(reqItem.quantity) || 1);
        return {
          product,
          variant,
          variantKey: reqItem.variantKey || `${product._id}__default__default`,
          unitPrice,
          quantity: qty,
        };
      });

      const pricing = calculatePerVariantCartPricing(
        resolvedLines.map((line) => ({
          productId: line.product._id,
          variantKey: line.variantKey,
          quantity: line.quantity,
          regularPrice: line.unitPrice,
          bulkTiers:
            line.unitPrice > 500_000
              ? [
                  {
                    minQty: 3,
                    unitPrice: Math.max(0, line.unitPrice - 100_000),
                    label: "Mua từ 3 sản phẩm cùng biến thể",
                  },
                  {
                    minQty: 5,
                    unitPrice: Math.max(0, line.unitPrice - 200_000),
                    label: "Mua từ 5 sản phẩm cùng biến thể",
                  },
                ]
              : [],
        }))
      );

      const COUPONS: Record<string, { code: string; name: string; discount: number }> = {
        SALE11: { code: "SALE11", name: "Giảm 100.000₫ đơn hàng", discount: 100_000 },
        PIKPRO100: { code: "PIKPRO100", name: "Ưu đãi PikPro 100.000₫", discount: 100_000 },
        MIPIK200: { code: "MIPIK200", name: "Ưu đãi VIP 200.000₫", discount: 200_000 },
      };

      const matchedCoupon = couponCode ? COUPONS[couponCode] ?? null : null;
      const couponError =
        couponCode && !matchedCoupon
          ? `Mã ưu đãi "${couponCode}" không hợp lệ hoặc đã hết hạn.`
          : null;
      const couponDiscount = matchedCoupon ? matchedCoupon.discount : 0;

      const rawSubtotal = resolvedLines.reduce(
        (sum, l) => sum + l.unitPrice * l.quantity,
        0
      );
      const tierDiscountTotal = pricing.bulkDiscountSaved;
      const freeShipThreshold =
        MOCK_SITE_SETTINGS.shipping?.freeShipThreshold ?? 500_000;
      const defaultFee = MOCK_SITE_SETTINGS.shipping?.defaultFee ?? 30_000;
      // Miễn phí vận chuyển nếu đạt ngưỡng freeShip hoặc đơn hàng test <= 10.000₫
      const shippingFee =
        rawSubtotal >= freeShipThreshold || rawSubtotal <= 10_000 ? 0 : defaultFee;
      const totalAmount = Math.max(
        0,
        rawSubtotal - tierDiscountTotal - couponDiscount + shippingFee
      );

      const responseData: CartPriceResponse = {
        items: resolvedLines.map((line) => {
          const calcLine = pricing.lines.find(
            (l) =>
              l.productId === line.product._id &&
              l.variantKey === line.variantKey
          );
          const effectiveUnit = calcLine?.effectiveUnitPrice ?? line.unitPrice;
          const lineTotal =
            calcLine?.lineSubtotal ?? line.unitPrice * line.quantity;
          return {
            productId: line.product._id,
            productCode: line.product.code,
            name: line.product.name,
            slug: line.product.slug,
            variantKey: line.variantKey,
            color: line.variant?.color,
            size: line.variant?.size,
            imageUrl:
              line.variant?.imageUrl || line.product.thumbnailUrl || "",
            unitPrice: line.unitPrice,
            tierDiscountAmount: Math.max(
              0,
              (line.unitPrice - effectiveUnit) * line.quantity
            ),
            lineTotal,
            quantity: line.quantity,
            stockAvailable: line.variant?.stockAvailable ?? 15,
            inStock: true,
          };
        }),
        rawSubtotal,
        tierDiscountTotal,
        couponDiscount,
        couponApplied: matchedCoupon
          ? { code: matchedCoupon.code, name: matchedCoupon.name }
          : null,
        couponError,
        eligibleGifts: pricing.unlockedGift
          ? [
              {
                productId: `gift-tier-${pricing.unlockedGift.minQty}`,
                productName: pricing.unlockedGift.rewardTitle,
                imageUrl: "/images/mock/apparel-polo-mint.svg",
                quantity: 1,
              },
            ]
          : [],
        shippingFee,
        freeShipThreshold,
        totalAmount,
      };

      return { status: 200, payload: { data: responseData, meta: {} } };
    }

    // 13. POST /public/orders, GET /public/orders/lookup, GET /public/orders/:code/payment-status
    if (method === "POST" && cleanPath === "/public/orders") {
      const priceCheck = this.handlePublicApiRequest("/public/cart/price", {
        method: "POST",
        body: options.body,
      }).payload as { data: CartPriceResponse };

      const gateway =
        typeof parsedBody.paymentGateway === "string"
          ? parsedBody.paymentGateway
          : "COD";
      const orderCode = `ONL-20261123-${String(
        Math.floor(1000 + Math.random() * 9000)
      )}`;
      const reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return {
        status: 201,
        payload: {
          data: {
            orderCode,
            totalAmount: priceCheck?.data?.totalAmount ?? 0,
            paymentGateway: gateway,
            paymentStatus: "UNPAID",
            fulfillmentStatus: "PENDING",
            ...(gateway === "PAYOS" || gateway === "VIETQR"
              ? {
                  // Ở chế độ Mock không redirect sang pay.payos.vn (vì đơn mock không tồn tại trên PayOS thật)
                  paymentUrl: `/thanh-toan/order-received/${orderCode}`,
                  qrCode: `00020101021238570010A0000007270127000697042201131903888899990208QRIBFTTA53037045407${
                    priceCheck?.data?.totalAmount ?? 0
                  }5802VN62190815${orderCode}6304ABCD`,
                  reservedUntil,
                }
              : {}),
          },
          meta: {},
        },
      };
    }

    if (method === "GET" && cleanPath === "/public/orders/lookup") {
      const code = String(params.code || "").trim().toUpperCase();
      const found =
        MOCK_CUSTOMER_ORDERS.find((o) => o.orderCode.toUpperCase() === code) ||
        (code.startsWith("ONL-")
          ? {
              _id: `ord-${code}`,
              orderCode: code,
              createdAt: new Date().toISOString(),
              totalAmount: 5_200_000,
              paymentGateway: "PAYOS",
              paymentStatus: "PAID",
              fulfillmentStatus: "CONFIRMED",
            }
          : null);

      if (!found) {
        return {
          status: 404,
          payload: {
            code: "ORDER_NOT_FOUND",
            message:
              "Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại.",
          },
        };
      }
      return { status: 200, payload: { data: found, meta: {} } };
    }

    const paymentStatusMatch = cleanPath.match(
      /^\/public\/orders\/([^/]+)\/payment-status$/
    );
    if (method === "GET" && paymentStatusMatch) {
      const orderCode = decodeURIComponent(paymentStatusMatch[1]);
      return {
        status: 200,
        payload: {
          data: {
            orderCode,
            paymentStatus: "UNPAID",
            fulfillmentStatus: "PENDING",
            reservedUntil: new Date(Date.now() + 14 * 60 * 1000).toISOString(),
          },
          meta: {},
        },
      };
    }

    // 14. Customer Auth & Profile (/public/customers/*)
    if (method === "POST" && cleanPath === "/public/customers/request-otp") {
      return {
        status: 200,
        payload: {
          message: "Mã OTP 6 số đã được gửi tới email của bạn (Demo OTP: 123456).",
          expiresInSeconds: 300,
        },
      };
    }

    if (method === "POST" && cleanPath === "/public/customers/verify-otp") {
      const identifier =
        typeof parsedBody.identifier === "string" && parsedBody.identifier.trim()
          ? parsedBody.identifier.trim()
          : MOCK_CUSTOMER_PROFILE.email;
      const customer: CustomerProfile = {
        ...MOCK_CUSTOMER_PROFILE,
        email: identifier,
      };
      return {
        status: 200,
        payload: {
          data: {
            token: "mock-customer-jwt-token-11sport-2026",
            customer,
          },
          meta: {},
        },
      };
    }

    if (cleanPath === "/public/customers/me") {
      if (method === "GET") {
        return {
          status: 200,
          payload: { data: this.getCustomerProfile(), meta: {} },
        };
      }
      if (method === "PUT") {
        const updated: CustomerProfile = {
          ...this.getCustomerProfile(),
          name:
            typeof parsedBody.name === "string"
              ? parsedBody.name
              : this.getCustomerProfile().name,
          phone:
            typeof parsedBody.phone === "string"
              ? parsedBody.phone
              : this.getCustomerProfile().phone,
          email:
            typeof parsedBody.email === "string"
              ? parsedBody.email
              : this.getCustomerProfile().email,
          addresses: Array.isArray(parsedBody.addresses)
            ? (parsedBody.addresses as CustomerProfile["addresses"])
            : this.getCustomerProfile().addresses,
        };
        return { status: 200, payload: { data: updated, meta: {} } };
      }
    }

    if (method === "GET" && cleanPath === "/public/customers/me/orders") {
      return {
        status: 200,
        payload: {
          data: this.getCustomerOrders(),
          meta: { total: this.getCustomerOrders().length },
        },
      };
    }

    // 15. SEO Sitemap & Redirects (/public/sitemap-data & /public/redirects)
    if (method === "GET" && cleanPath === "/public/sitemap-data") {
      const now = new Date().toISOString();
      return {
        status: 200,
        payload: {
          data: {
            categories: MOCK_CATEGORIES.map((c) => ({ slug: c.slug, updatedAt: now })),
            brands: MOCK_BRANDS.map((b) => ({ slug: b.slug, updatedAt: now })),
            products: MOCK_PRODUCTS.map((p) => ({ slug: p.slug, updatedAt: now })),
            articles: MOCK_ARTICLES.map((a) => ({ slug: a.slug, updatedAt: now })),
            pages: MOCK_POLICY_PAGES.map((p) => ({ slug: p.slug, updatedAt: now })),
          },
          meta: {},
        },
      };
    }

    if (method === "GET" && cleanPath === "/public/redirects") {
      return {
        status: 200,
        payload: { data: [], meta: {} },
      };
    }

    return {
      status: 404,
      payload: {
        code: "ENDPOINT_NOT_MOCKED",
        message: `Mock API endpoint chưa được định nghĩa: ${method} ${cleanPath}`,
      },
    };
  },
};

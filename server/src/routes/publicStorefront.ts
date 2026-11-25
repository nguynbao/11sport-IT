import { Router, Request, Response, NextFunction } from 'express';
import {
  brandRepo,
  categoryRepo,
  customerOtpRepo,
  customerRepo,
  orderRepo,
  productRepo,
  promotionRepo,
  stockMovementRepo,
  webArticleCategoryRepo,
  webArticleRepo,
  webAuditLogRepo,
  webBannerRepo,
  webHomeSectionRepo,
  webMenuRepo,
  webRedirectRepo,
  webReviewRepo,
  webStaticPageRepo,
} from '../config/db';
import { IProduct, IProductVariant } from '../models/Product';
import { OnlineStockMode } from '../models/WebSiteSetting';

function normalizeSearchText(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function matchesSearchQuery(haystack: string, query: string): boolean {
  const normQuery = normalizeSearchText(query).trim();
  if (!normQuery) return true;
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const normHay = normalizeSearchText(haystack);
  return tokens.every((t) => normHay.includes(t));
}
import {
  atomicDeductOnlineStock,
  calculateCartPricing,
  createPayosOrVietQrPayment,
  generateOnlineOrderCode,
  getOnlineSiteSetting,
  getProductTotalOnlineStock,
  getVariantAvailableStock,
  resolveVariantEffectivePrice,
  verifyPayosWebhookSignature,
} from '../services/webStockAndPricing';
import {
  attachCustomerContext,
  dispatchCustomerOtp,
  generateOtpCode,
  hashOtp,
  requireCustomerAuth,
  signCustomerToken,
} from '../utils/customerAuth';
import { ApiError } from '../utils/errors';
import { getWebCache, setWebCache } from '../utils/webCache';
import { getPayOSClient, verifyPayosWebhookData } from '../services/payos.service';

export const publicStorefrontRouter = Router();

// ==================== DTO MAPPERS (TUYỆT ĐỐI KHÔNG LỘ COSTPRICE / PII) ====================

function toPublicProductSummary(
  p: IProduct,
  stockMode: OnlineStockMode,
  categoryMap?: Map<string, any>,
  brandMap?: Map<string, any>
) {
  const cat = categoryMap?.get(String(p.categoryId));
  const br = p.brandId ? brandMap?.get(String(p.brandId)) : null;
  const imgs = Array.isArray(p.images) ? [...p.images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : [];
  const primaryImg = imgs.find((i) => i.isPrimary) || imgs[0];
  const stockAvailable = getProductTotalOnlineStock(p, stockMode);

  // Gom danh sách màu duy nhất cho swatch trên ProductCard
  const colorMap = new Map<string, { color: string; colorHexes: string[]; imageUrl: string }>();
  for (const v of p.variants || []) {
    if (v.color && !colorMap.has(v.color)) {
      colorMap.set(v.color, {
        color: v.color,
        colorHexes: Array.isArray(v.colorHexes) ? v.colorHexes : [],
        imageUrl: v.imageUrl || '',
      });
    }
  }

  return {
    _id: String(p._id),
    code: p.code,
    name: p.name,
    slug: p.slug || String(p._id),
    brand: br
      ? { _id: String(br._id), name: br.name, slug: br.slug || '' }
      : p.brandName || p.brand
        ? { _id: p.brandId || '', name: p.brandName || p.brand || '', slug: '' }
        : null,
    category: cat
      ? { _id: String(cat._id), name: cat.name, slug: cat.slug || '' }
      : { _id: String(p.categoryId), name: p.categoryName || '', slug: '' },
    sellingPrice: Math.round(Number(p.sellingPrice || 0)),
    compareAtPrice: typeof p.compareAtPrice === 'number' && p.compareAtPrice > 0 ? Math.round(p.compareAtPrice) : null,
    thumbnailUrl: primaryImg?.url || '',
    images: imgs,
    inStock: stockAvailable > 0,
    stockAvailable,
    isFeatured: Boolean(p.isFeatured),
    ratingAvg: Number(p.ratingAvg || 0),
    ratingCount: Number(p.ratingCount || 0),
    colors: Array.from(colorMap.values()),
  };
}

function toPublicVariant(p: IProduct, v: IProductVariant, stockMode: OnlineStockMode) {
  const { available } = getVariantAvailableStock(p, v.variantKey, stockMode);
  return {
    variantKey: v.variantKey,
    variantCode: v.variantCode || p.code,
    color: v.color || '',
    colorHexes: Array.isArray(v.colorHexes) ? v.colorHexes : [],
    size: v.size || '',
    imageUrl: v.imageUrl || '',
    effectiveSellingPrice: resolveVariantEffectivePrice(p, v),
    compareAtPrice: typeof p.compareAtPrice === 'number' && p.compareAtPrice > 0 ? Math.round(p.compareAtPrice) : null,
    stockAvailable: available,
    inStock: available > 0,
  };
}

function toPublicSiteSettings(setting: any) {
  return {
    siteName: setting.siteName || '11 Sport',
    logoUrl: setting.logoUrl || '',
    faviconUrl: setting.faviconUrl || '',
    brandColor: setting.brandColor || '#0D9488',
    topBarText: setting.topBarText || '',
    hotline: setting.hotline || '',
    email: setting.email || '',
    zaloUrl: setting.zaloUrl || '',
    messengerUrl: setting.messengerUrl || '',
    facebookUrl: setting.facebookUrl || '',
    tiktokUrl: setting.tiktokUrl || '',
    youtubeUrl: setting.youtubeUrl || '',
    showrooms: Array.isArray(setting.showrooms)
      ? setting.showrooms.map((s: any) => ({
          name: s?.name || '',
          address: s?.address || '',
          phone: s?.phone || s?.hotline || '',
          hours: s?.hours || '',
          mapUrl: s?.mapUrl || '',
          embedUrl: s?.embedUrl || '',
        }))
      : [],
    uspItems: Array.isArray(setting.uspItems) ? setting.uspItems : [],
    shipping: {
      defaultFee: Number(setting.defaultShippingFee ?? 30000),
      freeShipThreshold: Number(setting.freeShipThreshold ?? 500000),
    },
    analytics: {
      ga4Id: setting.ga4Id || '',
      gtmId: setting.gtmId || '',
    },
    defaultSeo: setting.defaultSeo || null,
  };
}

// ==================== WEB-06: PUBLIC READ-ONLY ENDPOINTS ====================

publicStorefrontRouter.get('/home', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = getWebCache<any>('public:home');
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({ data: cached });
      return;
    }

    const now = new Date();
    const setting = await getOnlineSiteSetting();
    const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';

    const [allBanners, sections, categories, brands, products, articles, promos] = await Promise.all([
      webBannerRepo.find({ status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { sortOrder: 1 }),
      webHomeSectionRepo.find({ isActive: true }, { sortOrder: 1 }),
      categoryRepo.find({ status: 'ACTIVE', isPublishedOnline: true }, { sortOrder: 1 }),
      brandRepo.find({ status: 'ACTIVE', isPublishedOnline: true }, { sortOrder: 1 }),
      productRepo.find({ status: 'ACTIVE', isPublishedOnline: true }, { isFeatured: -1, createdAt: -1 }),
      webArticleRepo.find({ status: 'PUBLISHED' }, { publishedAt: -1 }),
      promotionRepo.find({ status: 'ACTIVE' }),
    ]);

    const activeBanners = allBanners
      .filter((b) => {
        if (b.startDate && new Date(b.startDate) > now) return false;
        if (b.endDate && new Date(b.endDate) < now) return false;
        return true;
      })
      .map((b) => ({
        _id: String(b._id),
        title: b.title,
        position: b.position,
        desktopImageUrl: b.desktopImageUrl,
        mobileImageUrl: b.mobileImageUrl,
        linkUrl: b.linkUrl || '',
        altText: b.altText || b.title,
        sortOrder: b.sortOrder,
      }));

    const catMap = new Map(categories.map((c) => [String(c._id), c]));
    const brandMap = new Map(brands.map((b) => [String(b._id), b]));

    const featuredProducts = products
      .filter((p) => p.isFeatured)
      .slice(0, 10)
      .map((p) => toPublicProductSummary(p, stockMode, catMap, brandMap));

    const catSectionList = sections.filter(
      (s) =>
        (s.type === 'CATEGORY_GRID' || s.type === 'CATEGORY_CAROUSEL') &&
        (s.configJson?.categorySlug || Array.isArray(s.configJson?.categorySlugs))
    );

    const categoryBlocks =
      catSectionList.length > 0
        ? catSectionList.map((sec) => {
            const primarySlug = String(sec.configJson?.categorySlug || '').trim();
            const extraSlugs = Array.isArray(sec.configJson?.categorySlugs)
              ? (sec.configJson!.categorySlugs as string[]).map(String)
              : [];
            const slugSet = new Set([primarySlug, ...extraSlugs].filter(Boolean));
            const matchedCats = categories.filter((c) => c.slug && slugSet.has(c.slug));
            const primaryCat =
              matchedCats.find((c) => c.slug === primarySlug) || matchedCats[0];
            const catIdSet = new Set(matchedCats.map((c) => String(c._id)));
            const limit = Math.min(20, Math.max(1, Number(sec.configJson?.limit || 10)));
            return {
              category: primaryCat
                ? {
                    _id: String(primaryCat._id),
                    name: primaryCat.name,
                    slug: primaryCat.slug || '',
                    imageUrl: primaryCat.imageUrl || '',
                  }
                : { _id: '', name: sec.title, slug: primarySlug, imageUrl: '' },
              products: products
                .filter((p) => catIdSet.has(String(p.categoryId)))
                .slice(0, limit)
                .map((p) => toPublicProductSummary(p, stockMode, catMap, brandMap)),
            };
          })
        : categories.slice(0, 4).map((cat) => ({
            category: {
              _id: String(cat._id),
              name: cat.name,
              slug: cat.slug || '',
              imageUrl: cat.imageUrl || '',
            },
            products: products
              .filter((p) => String(p.categoryId) === String(cat._id))
              .slice(0, 10)
              .map((p) => toPublicProductSummary(p, stockMode, catMap, brandMap)),
          }));

    const flashPromo = promos.find(
      (p: any) =>
        p.isFlashSale &&
        Array.isArray(p.applyChannels) &&
        p.applyChannels.includes('ONLINE') &&
        (!p.endDate || new Date(p.endDate) > now)
    );
    const flashSale = flashPromo
      ? {
          promotionId: String(flashPromo._id),
          title: flashPromo.name,
          endAt: flashPromo.endDate || null,
          products: products
            .filter(
              (p) =>
                flashPromo.conditionType === 'ALL_PRODUCTS' ||
                (flashPromo.conditionProductIds || []).map(String).includes(String(p._id)) ||
                (flashPromo.conditionCategoryIds || []).map(String).includes(String(p.categoryId))
            )
            .slice(0, 10)
            .map((p) => toPublicProductSummary(p, stockMode, catMap, brandMap)),
        }
      : null;

    const payload = {
      banners: activeBanners,
      homeSections: sections.map((s) => ({
        _id: String(s._id),
        type: s.type,
        title: s.title,
        subtitle: s.subtitle || '',
        viewAllUrl: s.viewAllUrl || '',
        configJson: s.configJson || {},
        sortOrder: s.sortOrder,
      })),
      flashSale,
      featuredProducts,
      categoryBlocks,
      brands: brands
        .filter((b) => !b.isSystem)
        .map((b) => ({
          _id: String(b._id),
          code: b.code,
          name: b.name,
          slug: b.slug || '',
          logoUrl: b.logoUrl || '',
        })),
      articles: articles.slice(0, 6).map((a) => ({
        _id: String(a._id),
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt || '',
        thumbnailUrl: a.thumbnailUrl || '',
        publishedAt: a.publishedAt,
      })),
      usp: (setting as any).uspItems || [],
      settings: toPublicSiteSettings(setting),
    };

    setWebCache('public:home', payload, 30_000);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json({ data: payload });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/menu', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = getWebCache<any>('public:menu');
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ data: cached });
      return;
    }

    const items = await webMenuRepo.find({ isActive: true }, { sortOrder: 1 });
    const byId = new Map<string, any>();
    const roots: any[] = [];

    for (const item of items) {
      byId.set(String(item._id), {
        _id: String(item._id),
        label: item.label,
        url: item.url,
        icon: item.icon || '',
        badge: item.badge || '',
        openInNewTab: Boolean(item.openInNewTab),
        sortOrder: item.sortOrder,
        children: [],
      });
    }
    for (const item of items) {
      const node = byId.get(String(item._id));
      if (item.parentId && byId.has(String(item.parentId))) {
        byId.get(String(item.parentId)).children.push(node);
      } else {
        roots.push(node);
      }
    }

    setWebCache('public:menu', roots, 60_000);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ data: roots });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = getWebCache<any>('public:settings');
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ data: cached });
      return;
    }
    const setting = await getOnlineSiteSetting();
    const dto = toPublicSiteSettings(setting);
    setWebCache('public:settings', dto, 60_000);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ data: dto });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/categories/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const category = await categoryRepo.findOne({ slug, status: 'ACTIVE', isPublishedOnline: true });
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục');
    }
    const allBrands = await brandRepo.find({ status: 'ACTIVE', isPublishedOnline: true }, { sortOrder: 1 });
    const relatedBrands = allBrands
      .filter((b) => !b.isSystem && (b.categoryIds || []).map(String).includes(String(category._id)))
      .map((b) => ({
        _id: String(b._id),
        code: b.code,
        name: b.name,
        slug: b.slug || '',
        logoUrl: b.logoUrl || '',
      }));

    res.json({
      data: {
        _id: String(category._id),
        code: category.code,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl || '',
        descriptionHtml: category.descriptionHtml || '',
        seo: category.seo || null,
        brands: relatedBrands,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/brands', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await brandRepo.find({ status: 'ACTIVE', isPublishedOnline: true }, { sortOrder: 1 });
    res.json({
      data: brands
        .filter((b) => !b.isSystem)
        .map((b) => ({
          _id: String(b._id),
          code: b.code,
          name: b.name,
          slug: b.slug || '',
          logoUrl: b.logoUrl || '',
          categoryIds: b.categoryIds || [],
        })),
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/brands/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const brand = await brandRepo.findOne({ slug, status: 'ACTIVE', isPublishedOnline: true });
    if (!brand) {
      throw new ApiError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu');
    }
    res.json({
      data: {
        _id: String(brand._id),
        code: brand.code,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl || '',
        descriptionHtml: brand.descriptionHtml || '',
        seo: brand.seo || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setting = await getOnlineSiteSetting();
    const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';

    const [categories, brands, allProducts] = await Promise.all([
      categoryRepo.find({ status: 'ACTIVE' }),
      brandRepo.find({ status: 'ACTIVE' }),
      productRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
    ]);

    const catById = new Map(categories.map((c) => [String(c._id), c]));
    const catBySlug = new Map(categories.filter((c) => c.slug).map((c) => [c.slug!, String(c._id)]));
    const brandById = new Map(brands.map((b) => [String(b._id), b]));
    const brandBySlug = new Map(brands.filter((b) => b.slug).map((b) => [b.slug!, String(b._id)]));

    const categoryParam = String(req.query.category || '').trim().toLowerCase();
    const brandParam = String(req.query.brand || '').trim().toLowerCase();
    const priceMin = req.query.priceMin ? Number(req.query.priceMin) : null;
    const priceMax = req.query.priceMax ? Number(req.query.priceMax) : null;
    const colorParam = String(req.query.color || '').trim().toLowerCase();
    const sizeParam = String(req.query.size || '').trim().toLowerCase();
    const inStockOnly = req.query.inStock === 'true';
    const q = String(req.query.q || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'featured');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(60, Math.max(1, Number(req.query.limit || 20)));

    const targetCategoryId = categoryParam ? catBySlug.get(categoryParam) || categoryParam : '';
    const targetBrandIds = brandParam
      ? brandParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => brandBySlug.get(s) || s)
      : [];

    const filtered = allProducts.filter((p) => {
      if (targetCategoryId && String(p.categoryId) !== targetCategoryId) return false;
      if (targetBrandIds.length > 0 && !targetBrandIds.includes(String(p.brandId || ''))) return false;
      const price = Number(p.sellingPrice || 0);
      if (priceMin !== null && !Number.isNaN(priceMin) && price < priceMin) return false;
      if (priceMax !== null && !Number.isNaN(priceMax) && price > priceMax) return false;
      if (colorParam) {
        const hasColor = (p.variants || []).some((v) => String(v.color || '').toLowerCase() === colorParam);
        if (!hasColor) return false;
      }
      if (sizeParam) {
        const hasSize = (p.variants || []).some((v) => String(v.size || '').toLowerCase() === sizeParam);
        if (!hasSize) return false;
      }
      if (inStockOnly && getProductTotalOnlineStock(p, stockMode) <= 0) return false;
      if (q) {
        const catName = catById.get(String(p.categoryId || ''))?.name || '';
        const brandName = brandById.get(String(p.brandId || ''))?.name || p.brandName || p.brand || '';
        const hay = `${p.name} ${p.code} ${brandName} ${catName} ${p.versionName || ''}`;
        if (!matchesSearchQuery(hay, q)) return false;
      }
      return true;
    });

    // Facets từ tập trước khi phân trang
    const facetColors = new Set<string>();
    const facetSizes = new Set<string>();
    const facetBrandCount = new Map<string, number>();
    let minP = Infinity;
    let maxP = 0;

    for (const p of filtered) {
      const price = Number(p.sellingPrice || 0);
      if (price < minP) minP = price;
      if (price > maxP) maxP = price;
      if (p.brandId) {
        facetBrandCount.set(String(p.brandId), (facetBrandCount.get(String(p.brandId)) || 0) + 1);
      }
      for (const v of p.variants || []) {
        if (v.color) facetColors.add(v.color);
        if (v.size) facetSizes.add(v.size);
      }
    }

    filtered.sort((a, b) => {
      const stockA = getProductTotalOnlineStock(a, stockMode) > 0 ? 1 : 0;
      const stockB = getProductTotalOnlineStock(b, stockMode) > 0 ? 1 : 0;
      if (sort === 'price_asc') return Number(a.sellingPrice || 0) - Number(b.sellingPrice || 0);
      if (sort === 'price_desc') return Number(b.sellingPrice || 0) - Number(a.sellingPrice || 0);
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // featured / default: còn hàng trước, nổi bật trước
      if (stockB !== stockA) return stockB - stockA;
      if (Boolean(b.isFeatured) !== Boolean(a.isFeatured)) return b.isFeatured ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      data: paged.map((p) => toPublicProductSummary(p, stockMode, catById, brandById)),
      meta: { total, page, limit, totalPages },
      facets: {
        brands: Array.from(facetBrandCount.entries())
          .map(([bId, count]) => {
            const b = brandById.get(bId);
            return b ? { name: b.name, slug: b.slug || '', count } : null;
          })
          .filter(Boolean),
        colors: Array.from(facetColors),
        sizes: Array.from(facetSizes),
        priceRange: { min: minP === Infinity ? 0 : minP, max: maxP },
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/products/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slugOrId = String(req.params.slug || '').trim();
    const product =
      (await productRepo.findOne({ slug: slugOrId.toLowerCase(), status: 'ACTIVE', isPublishedOnline: true })) ||
      (await productRepo.findOne({ _id: slugOrId, status: 'ACTIVE', isPublishedOnline: true }));

    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    }

    const setting = await getOnlineSiteSetting();
    const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';
    const [cat, br, promos] = await Promise.all([
      categoryRepo.findById(String(product.categoryId)),
      product.brandId ? brandRepo.findById(String(product.brandId)) : Promise.resolve(null),
      promotionRepo.find({ status: 'ACTIVE' }),
    ]);

    const now = new Date();
    const applicablePromos = promos.filter((pr: any) => {
      if (!Array.isArray(pr.applyChannels) || !pr.applyChannels.includes('ONLINE')) return false;
      if (pr.isCouponRequired) return false;
      if (!pr.isPermanent) {
        if (pr.startDate && new Date(pr.startDate) > now) return false;
        if (pr.endDate && new Date(pr.endDate) < now) return false;
      }
      return (
        pr.conditionType === 'ALL_PRODUCTS' ||
        (pr.conditionType === 'BUY_PRODUCTS' &&
          (pr.conditionProductIds || []).map(String).includes(String(product._id))) ||
        (pr.conditionType === 'BUY_CATEGORY' &&
          (pr.conditionCategoryIds || []).map(String).includes(String(product.categoryId)))
      );
    });

    const tierPricing = applicablePromos.flatMap((pr: any) => pr.tierPricing || []);
    const giftPromotions = applicablePromos
      .filter((pr: any) => Array.isArray(pr.giftItems) && pr.giftItems.length > 0)
      .map((pr: any) => ({
        name: pr.name,
        minQuantity: pr.minQuantity,
        minOrderAmount: pr.minOrderAmount,
        gifts: pr.giftItems.map((g: any) => ({
          productId: g.productId,
          productName: g.productName,
          quantity: g.quantity,
        })),
      }));

    const imgs = Array.isArray(product.images)
      ? [...product.images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      : [];

    res.json({
      data: {
        _id: String(product._id),
        code: product.code,
        name: product.name,
        slug: product.slug || String(product._id),
        unit: product.unit || 'Cái',
        brand: br ? { _id: String(br._id), name: br.name, slug: br.slug || '' } : null,
        category: cat ? { _id: String(cat._id), name: cat.name, slug: cat.slug || '' } : null,
        sellingPrice: Math.round(Number(product.sellingPrice || 0)),
        compareAtPrice:
          typeof product.compareAtPrice === 'number' && product.compareAtPrice > 0
            ? Math.round(product.compareAtPrice)
            : null,
        images: imgs,
        shortDescription: product.shortDescription || '',
        descriptionHtml: product.descriptionHtml || '',
        specs: Array.isArray(product.specs) ? product.specs : [],
        seo: product.seo || null,
        ratingAvg: Number(product.ratingAvg || 0),
        ratingCount: Number(product.ratingCount || 0),
        stockAvailable: getProductTotalOnlineStock(product, stockMode),
        variants: (product.variants || []).map((v) => toPublicVariant(product, v, stockMode)),
        promotions: {
          tierPricing,
          giftPromotions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/products/:slug/related', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slugOrId = String(req.params.slug || '').trim();
    const product =
      (await productRepo.findOne({ slug: slugOrId.toLowerCase(), status: 'ACTIVE', isPublishedOnline: true })) ||
      (await productRepo.findOne({ _id: slugOrId, status: 'ACTIVE', isPublishedOnline: true }));
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    }

    const setting = await getOnlineSiteSetting();
    const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';
    const [allProducts, categories, brands] = await Promise.all([
      productRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
      categoryRepo.find({ status: 'ACTIVE' }),
      brandRepo.find({ status: 'ACTIVE' }),
    ]);

    const catMap = new Map(categories.map((c) => [String(c._id), c]));
    const brandMap = new Map(brands.map((b) => [String(b._id), b]));

    const related = allProducts
      .filter(
        (p) =>
          String(p._id) !== String(product._id) &&
          (String(p.categoryId) === String(product.categoryId) ||
            (product.brandId && String(p.brandId) === String(product.brandId)))
      )
      .slice(0, 8)
      .map((p) => toPublicProductSummary(p, stockMode, catMap, brandMap));

    res.json({ data: related });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/search/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) {
      res.json({ data: { products: [], articles: [] } });
      return;
    }

    const [products, articles, categories, brands] = await Promise.all([
      productRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
      webArticleRepo.find({ status: 'PUBLISHED' }, { publishedAt: -1 }),
      categoryRepo.find({ status: 'ACTIVE' }),
      brandRepo.find({ status: 'ACTIVE' }),
    ]);
    const catById = new Map(categories.map((c) => [String(c._id), c]));
    const brandById = new Map(brands.map((b) => [String(b._id), b]));

    const matchedProducts = products
      .filter((p) => {
        const catName = catById.get(String(p.categoryId || ''))?.name || '';
        const brandName = brandById.get(String(p.brandId || ''))?.name || p.brandName || p.brand || '';
        return matchesSearchQuery(`${p.name} ${p.code} ${brandName} ${catName}`, q);
      })
      .slice(0, 6)
      .map((p) => {
        const primary = (p.images || []).find((i) => i.isPrimary) || (p.images || [])[0];
        return {
          _id: String(p._id),
          name: p.name,
          slug: p.slug || String(p._id),
          thumbnailUrl: primary?.url || '',
          sellingPrice: Math.round(Number(p.sellingPrice || 0)),
          compareAtPrice:
            typeof p.compareAtPrice === 'number' && p.compareAtPrice > 0 ? Math.round(p.compareAtPrice) : null,
        };
      });

    const matchedArticles = articles
      .filter((a) => matchesSearchQuery(`${a.title} ${a.excerpt || ''}`, q))
      .slice(0, 4)
      .map((a) => ({
        _id: String(a._id),
        title: a.title,
        slug: a.slug,
        thumbnailUrl: a.thumbnailUrl || '',
      }));

    res.json({ data: { products: matchedProducts, articles: matchedArticles } });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const catSlug = String(req.query.category || '').trim().toLowerCase();
    const tag = String(req.query.tag || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    const [articles, categories] = await Promise.all([
      webArticleRepo.find({ status: 'PUBLISHED' }, { publishedAt: -1 }),
      webArticleCategoryRepo.find({ isActive: true }),
    ]);
    const catById = new Map(categories.map((c) => [String(c._id), c]));
    const targetCat = catSlug ? categories.find((c) => c.slug === catSlug) : null;

    const filtered = articles.filter((a) => {
      if (targetCat && String(a.categoryId) !== String(targetCat._id)) return false;
      if (tag && !(a.tags || []).map((t) => t.toLowerCase()).includes(tag)) return false;
      if (q && !matchesSearchQuery(`${a.title} ${a.excerpt || ''}`, q)) return false;
      return true;
    });

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      data: paged.map((a) => {
        const cat = a.categoryId ? catById.get(String(a.categoryId)) : null;
        return {
          _id: String(a._id),
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt || '',
          thumbnailUrl: a.thumbnailUrl || '',
          category: cat ? { _id: String(cat._id), name: cat.name, slug: cat.slug } : null,
          tags: a.tags || [],
          authorName: a.authorName || '11 Sport',
          publishedAt: a.publishedAt,
        };
      }),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/articles/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const article = await webArticleRepo.findOne({ slug, status: 'PUBLISHED' });
    if (!article) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Không tìm thấy bài viết');
    }

    const cat = article.categoryId ? await webArticleCategoryRepo.findById(String(article.categoryId)) : null;
    const setting = await getOnlineSiteSetting();
    const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';

    const relatedProducts = [];
    for (const pid of article.relatedProductIds || []) {
      const p = await productRepo.findById(String(pid));
      if (p && p.status === 'ACTIVE' && p.isPublishedOnline) {
        relatedProducts.push(toPublicProductSummary(p, stockMode));
      }
    }

    res.json({
      data: {
        _id: String(article._id),
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || '',
        contentHtml: article.contentHtml || '',
        thumbnailUrl: article.thumbnailUrl || '',
        category: cat ? { _id: String(cat._id), name: cat.name, slug: cat.slug } : null,
        tags: article.tags || [],
        authorName: article.authorName || '11 Sport',
        publishedAt: article.publishedAt,
        seo: article.seo || null,
        relatedProducts,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/pages/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const page = await webStaticPageRepo.findOne({ slug, status: 'PUBLISHED' });
    if (!page) {
      throw new ApiError(404, 'PAGE_NOT_FOUND', 'Không tìm thấy trang');
    }
    res.json({
      data: {
        _id: String(page._id),
        title: page.title,
        slug: page.slug,
        contentHtml: page.contentHtml || '',
        seo: page.seo || null,
        updatedAt: page.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = String(req.query.productId || '').trim();
    if (!productId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu productId');
    }
    const ratingFilter = req.query.rating ? Number(req.query.rating) : null;
    const hasImages = req.query.hasImages === 'true';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

    const allApproved = await webReviewRepo.find({ productId, status: 'APPROVED' }, { createdAt: -1 });
    const breakdown: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let sumRating = 0;
    for (const r of allApproved) {
      const k = String(r.rating);
      if (k in breakdown) breakdown[k] += 1;
      sumRating += Number(r.rating || 0);
    }

    const filtered = allApproved.filter((r) => {
      if (ratingFilter && r.rating !== ratingFilter) return false;
      if (hasImages && (!Array.isArray(r.images) || r.images.length === 0)) return false;
      return true;
    });

    const paged = filtered.slice((page - 1) * limit, page * limit);
    res.json({
      data: paged.map((r) => ({
        _id: String(r._id),
        customerName: r.customerName,
        rating: r.rating,
        comment: r.comment,
        images: r.images || [],
        isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
        adminReply: r.adminReply || '',
        createdAt: r.createdAt,
      })),
      summary: {
        ratingAvg: allApproved.length > 0 ? Number((sumRating / allApproved.length).toFixed(1)) : 0,
        ratingCount: allApproved.length,
        breakdown,
      },
      meta: { total: filtered.length, page, limit },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.post(
  '/reviews',
  attachCustomerContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, rating, comment, customerName, images } = req.body || {};
      const numRating = Number(rating);
      if (!productId || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'productId và rating (1-5) là bắt buộc');
      }

      const product = await productRepo.findById(String(productId));
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại');
      }

      let resolvedName = String(customerName || '').trim();
      let isVerifiedPurchase = false;
      let verifiedOrderId = '';

      if (req.customer) {
        const cust = await customerRepo.findById(req.customer.customerId);
        if (cust && !resolvedName) resolvedName = cust.name;

        const custOrders = await orderRepo.find({ customerId: req.customer.customerId });
        const paidOrder = custOrders.find(
          (o) =>
            (o.status === 'PAID' || o.paymentStatus === 'PAID' || o.fulfillmentStatus === 'DELIVERED') &&
            (o.items || []).some((it) => String(it.productId) === String(productId))
        );
        if (paidOrder) {
          isVerifiedPurchase = true;
          verifiedOrderId = String(paidOrder._id);
        }
      }

      if (!resolvedName) {
        resolvedName = 'Khách hàng';
      }

      const review = await webReviewRepo.create({
        productId: String(productId),
        customerId: req.customer?.customerId || '',
        customerName: resolvedName,
        orderId: verifiedOrderId,
        rating: numRating,
        comment: String(comment || '').trim(),
        images: Array.isArray(images) ? images.slice(0, 5).map(String) : [],
        isVerifiedPurchase,
        status: 'PENDING',
      });

      res.status(201).json({
        data: { _id: String(review._id), status: review.status, isVerifiedPurchase },
        message: 'Đánh giá của bạn đã được ghi nhận và đang chờ duyệt.',
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.get('/sitemap-data', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [categories, brands, products, articles, pages] = await Promise.all([
      categoryRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
      brandRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
      productRepo.find({ status: 'ACTIVE', isPublishedOnline: true }),
      webArticleRepo.find({ status: 'PUBLISHED' }),
      webStaticPageRepo.find({ status: 'PUBLISHED' }),
    ]);

    res.json({
      data: {
        categories: categories.filter((c) => c.slug).map((c) => ({ slug: c.slug, updatedAt: c.updatedAt })),
        brands: brands.filter((b) => b.slug && !b.isSystem).map((b) => ({ slug: b.slug, updatedAt: b.updatedAt })),
        products: products.filter((p) => p.slug).map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
        articles: articles.map((a) => ({ slug: a.slug, updatedAt: a.updatedAt })),
        pages: pages.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get('/redirects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const redirects = await webRedirectRepo.find({ isActive: true });
    res.json({
      data: redirects.map((r) => ({
        fromPath: r.fromPath,
        toPath: r.toPath,
        statusCode: r.statusCode,
      })),
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.post('/contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, message, sourceUrl } = req.body || {};
    if (!name || !phone || !message) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đầy đủ họ tên, số điện thoại và nội dung');
    }
    await webAuditLogRepo.create({
      actorId: 'GUEST',
      actorName: String(name).trim(),
      actorRole: 'GUEST',
      action: 'CONTACT_SUBMIT',
      entityType: 'ContactForm',
      diffSummary: `SĐT: ${String(phone).trim()} | ${String(message).trim().slice(0, 120)}`,
      metadata: {
        phone: String(phone).trim(),
        email: String(email || '').trim(),
        sourceUrl: String(sourceUrl || '').trim(),
      },
    });
    res.status(201).json({
      message: 'Cảm ơn bạn đã liên hệ. 11 Sport sẽ phản hồi trong thời gian sớm nhất.',
    });
  } catch (err) {
    next(err);
  }
});

// ==================== WEB-07 & WEB-08: CART PRICING, CHECKOUT ATOMIC & PAYOS WEBHOOK ====================

publicStorefrontRouter.post('/cart/price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, couponCode, province } = req.body || {};
    const pricing = await calculateCartPricing({ items, couponCode, province });
    res.json({ data: pricing });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.post(
  '/orders',
  attachCustomerContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, shippingAddress, paymentGateway, couponCode, selectedGiftProductId } = req.body || {};
      if (!shippingAddress?.fullName || !shippingAddress?.phone || !shippingAddress?.addressLine) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đầy đủ họ tên, SĐT và địa chỉ nhận hàng');
      }

      const gateway = String(paymentGateway || 'COD').toUpperCase();
      if (!['COD', 'PAYOS', 'VIETQR'].includes(gateway)) {
        throw new ApiError(400, 'INVALID_PAYMENT_GATEWAY', 'Phương thức thanh toán không hợp lệ');
      }

      const pricing = await calculateCartPricing({
        items,
        couponCode,
        province: shippingAddress.province,
      });

      const setting = await getOnlineSiteSetting();
      const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';

      // Trừ / giữ chỗ tồn kho atomic (ném 409 nếu hết hàng)
      const deducted = await atomicDeductOnlineStock(
        pricing.items.map((it) => ({
          productId: it.productId,
          variantKey: it.variantKey,
          quantity: it.quantity,
        })),
        stockMode
      );

      const orderCode = await generateOnlineOrderCode();
      const rawPhoneDigits = String(shippingAddress.phone).replace(/[\s.\-()]/g, '').replace(/^\+84/, '0').replace(/\D/g, '');
      const cleanPhone = rawPhoneDigits.startsWith('84') && rawPhoneDigits.length >= 11
        ? `0${rawPhoneDigits.slice(2)}`
        : rawPhoneDigits;
      const cleanEmail = String(shippingAddress.email || '').trim().toLowerCase();

      // Tìm hoặc tạo Customer (tránh tạo trùng account theo phone hoặc email khi guest checkout)
      let customerId = req.customer?.customerId || '';
      if (!customerId) {
        let existingCust = await customerRepo.findOne({ phone: cleanPhone });
        if (!existingCust && cleanEmail) {
          existingCust = await customerRepo.findOne({ email: cleanEmail });
        }
        if (existingCust) {
          customerId = String(existingCust._id);
        } else {
          try {
            const createdCust = await customerRepo.create({
              phone: cleanPhone,
              email: cleanEmail || undefined,
              name: String(shippingAddress.fullName).trim(),
              totalOrders: 0,
              totalSpent: 0,
            });
            customerId = String(createdCust._id);
          } catch (custErr: any) {
            // Phòng race condition trùng unique key phone/email
            const fallbackCust =
              (await customerRepo.findOne({ phone: cleanPhone })) ||
              (cleanEmail ? await customerRepo.findOne({ email: cleanEmail }) : null);
            if (fallbackCust) {
              customerId = String(fallbackCust._id);
            } else {
              throw custErr;
            }
          }
        }
      }

      const orderItems: any[] = pricing.items.map((it) => ({
        productId: it.productId,
        productCode: it.productCode,
        productName: it.name,
        color: it.color,
        size: it.size,
        unit: it.unit,
        originalUnitPrice: it.unitPrice,
        isGift: false,
        discountType: it.tierDiscountAmount > 0 ? 'AMOUNT' : 'NONE',
        discountValue: it.tierDiscountAmount,
        discountAmount: it.tierDiscountAmount,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        returnedQuantity: 0,
        lineTotal: it.lineTotal,
      }));

      // Quà tặng hợp lệ (tối đa 1 block quà tặng được chọn)
      if (selectedGiftProductId) {
        const chosenGift = pricing.eligibleGifts.find((g) => g.productId === String(selectedGiftProductId));
        if (chosenGift) {
          orderItems.push({
            productId: chosenGift.productId,
            productCode: chosenGift.productCode,
            productName: chosenGift.productName,
            unit: chosenGift.unit,
            originalUnitPrice: 0,
            isGift: true,
            discountType: 'GIFT',
            discountValue: 0,
            discountAmount: 0,
            unitPrice: 0,
            quantity: chosenGift.quantity,
            returnedQuantity: 0,
            lineTotal: 0,
          });
        }
      }

      const isQr = gateway === 'PAYOS' || gateway === 'VIETQR';
      const reservedUntil = isQr ? new Date(Date.now() + 15 * 60 * 1000) : null;
      // Sinh mã số nguyên duy nhất cho PayOS (9-10 chữ số)
      const payosOrderCode = isQr
        ? Number(`${Date.now().toString().slice(-7)}${Math.floor(10 + Math.random() * 90)}`)
        : undefined;

      const createdOrder = await orderRepo.create({
        orderCode,
        customerId,
        customerName: String(shippingAddress.fullName).trim(),
        customerPhone: cleanPhone,
        items: orderItems,
        rawSubtotal: pricing.rawSubtotal,
        itemDiscountTotal: pricing.tierDiscountTotal,
        subtotal: Math.max(0, pricing.rawSubtotal - pricing.tierDiscountTotal),
        billDiscountType: pricing.couponDiscount > 0 ? 'AMOUNT' : 'NONE',
        billDiscountValue: pricing.couponDiscount,
        billDiscountAmount: pricing.couponDiscount,
        paymentMethod: isQr ? 'BANKING' : 'CASH',
        hasCardFee: false,
        cardFeePercent: 0,
        cardFee: 0,
        totalAmount: pricing.totalAmount,
        paidAmount: 0,
        debtAmount: 0,
        debtStatus: 'NONE',
        note: String(shippingAddress.note || ''),
        status: isQr ? 'DRAFT' : 'PAID',
        channel: 'ONLINE',
        fulfillmentStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentGateway: gateway as any,
        payosOrderCode,
        reservedUntil,
        shippingAddress: {
          fullName: String(shippingAddress.fullName).trim(),
          phone: cleanPhone,
          email: cleanEmail,
          province: String(shippingAddress.province || '').trim(),
          district: String(shippingAddress.district || '').trim(),
          ward: String(shippingAddress.ward || '').trim(),
          addressLine: String(shippingAddress.addressLine).trim(),
          note: String(shippingAddress.note || '').trim(),
        },
        shippingFee: pricing.shippingFee,
        couponCode: pricing.couponApplied?.code || '',
        createdBy: 'ONLINE_STOREFRONT',
        createdByName: 'Website 11 Sport',
      });

      // Nếu là COD: ghi StockMovement SALE và cập nhật Customer ngay
      if (!isQr) {
        for (const d of deducted) {
          await stockMovementRepo.create({
            productId: d.productId,
            productCode: d.productCode,
            productName: d.productName,
            color: d.color,
            size: d.size,
            warehouseLocation: d.deductedFloor1 > 0 ? 'FLOOR_1' : 'FLOOR_2',
            type: 'SALE',
            categoryId: '',
            unit: d.unit || 'Cái',
            quantityChange: -d.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            referenceType: 'ORDER',
            referenceId: String(createdOrder._id),
            referenceCode: orderCode,
            note: `Đơn Online COD ${orderCode}`,
            performedBy: 'ONLINE_STOREFRONT',
            performedByName: 'Website 11 Sport',
          });
        }
        const cust = await customerRepo.findById(customerId);
        if (cust) {
          await customerRepo.updateById(customerId, {
            totalOrders: Number(cust.totalOrders || 0) + 1,
            totalSpent: Number(cust.totalSpent || 0) + pricing.totalAmount,
            lastOrderAt: new Date(),
          });
        }
      }

      if (pricing.couponApplied) {
        const couponPromo = await promotionRepo.findOne({ couponCode: pricing.couponApplied.code });
        if (couponPromo) {
          await promotionRepo.updateById(String(couponPromo._id), {
            usedCount: Number((couponPromo as any).usedCount || 0) + 1,
          });
        }
      }

      let paymentUrl = '';
      let qrCode = '';
      let returnedPayosOrderCode = payosOrderCode;
      if (isQr) {
        const payRes = await createPayosOrVietQrPayment({
          orderCode,
          payosOrderCode,
          amount: pricing.totalAmount,
          description: `11S ${orderCode}`.slice(0, 25),
          items: orderItems.map((item) => ({
            name: item.productName.slice(0, 40),
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        });
        paymentUrl = payRes.paymentUrl;
        qrCode = payRes.qrCode;
        if (payRes.payosOrderCode) {
          returnedPayosOrderCode = payRes.payosOrderCode;
        }
      }

      res.status(201).json({
        data: {
          _id: String(createdOrder._id),
          orderCode,
          totalAmount: pricing.totalAmount,
          shippingFee: pricing.shippingFee,
          paymentGateway: gateway,
          paymentStatus: 'UNPAID',
          fulfillmentStatus: 'PENDING',
          paymentUrl,
          qrCode,
          payosOrderCode: returnedPayosOrderCode,
          reservedUntil,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.get('/orders/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    const phone = String(req.query.phone || '').trim();
    if (!code || !phone) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập mã đơn hàng và số điện thoại');
    }

    const order = await orderRepo.findOne({ orderCode: code, channel: 'ONLINE' });
    if (!order || order.customerPhone !== phone) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng khớp với thông tin đã nhập');
    }

    res.json({
      data: {
        orderCode: order.orderCode,
        fulfillmentStatus: order.fulfillmentStatus || 'PENDING',
        paymentStatus: order.paymentStatus || 'UNPAID',
        paymentGateway: order.paymentGateway || 'COD',
        totalAmount: order.totalAmount,
        shippingFee: order.shippingFee || 0,
        trackingCode: order.trackingCode || '',
        createdAt: order.createdAt,
        items: (order.items || []).map((it) => ({
          productName: it.productName,
          color: it.color || '',
          size: it.size || '',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          isGift: Boolean(it.isGift),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

publicStorefrontRouter.get(
  '/orders/:code/payment-status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = String(req.params.code || '').trim().toUpperCase();
      const order = await orderRepo.findOne({ orderCode: code, channel: 'ONLINE' });
      if (!order) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
      }
      res.json({
        data: {
          orderCode: order.orderCode,
          paymentStatus: order.paymentStatus || 'UNPAID',
          fulfillmentStatus: order.fulfillmentStatus || 'PENDING',
          reservedUntil: order.reservedUntil || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.post(
  '/payments/payos/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};
      let webhookData: any = body.data || {};

      // Xác thực chữ ký webhook PayOS qua SDK chính thức hoặc fallback signature
      const payosClient = getPayOSClient();
      if (payosClient) {
        try {
          webhookData = await verifyPayosWebhookData(body);
        } catch (verifyErr: any) {
          console.warn('[PayOS Webhook] SDK verify failed, checking fallback signature:', verifyErr?.message);
          const setting = await getOnlineSiteSetting();
          const checksumKey =
            (setting as any).payosChecksumKey ||
            (setting as any).webhookSecret ||
            process.env.PAYOS_CHECKSUM_KEY ||
            '';
          const signature = String(body.signature || req.headers['x-payos-signature'] || '');
          if (!checksumKey || !verifyPayosWebhookSignature(body, signature, checksumKey)) {
            throw new ApiError(401, 'INVALID_SIGNATURE', 'Chữ ký webhook PayOS không hợp lệ');
          }
        }
      } else {
        const setting = await getOnlineSiteSetting();
        const checksumKey =
          (setting as any).payosChecksumKey ||
          (setting as any).webhookSecret ||
          process.env.PAYOS_CHECKSUM_KEY ||
          '11sport-payos-test-key';
        const signature = String(body.signature || req.headers['x-payos-signature'] || '');
        if (!verifyPayosWebhookSignature(body, signature, checksumKey)) {
          throw new ApiError(401, 'INVALID_SIGNATURE', 'Chữ ký webhook không hợp lệ');
        }
      }

      const rawOrderCode = webhookData.orderCode;
      const numericOrderCode = typeof rawOrderCode === 'number' ? rawOrderCode : Number(rawOrderCode);
      const strOrderCode = String(rawOrderCode || webhookData.description || '').trim();
      const txId = String(webhookData.reference || webhookData.transactionId || webhookData.paymentLinkId || '').trim();
      const amount = Number(webhookData.amount || 0);

      // 1. Tìm theo payosOrderCode (số nguyên)
      let order = !isNaN(numericOrderCode) && numericOrderCode > 0
        ? await orderRepo.findOne({ payosOrderCode: numericOrderCode, channel: 'ONLINE' })
        : null;

      // 2. Fallback tìm theo mã chuỗi orderCode
      if (!order && strOrderCode) {
        order = await orderRepo.findOne({ orderCode: strOrderCode.toUpperCase(), channel: 'ONLINE' });
      }

      // 3. Fallback tìm theo description chứa mã đơn
      if (!order && webhookData.description) {
        const desc = String(webhookData.description).trim();
        const matchCode = desc.replace(/^11S\s*/i, '').trim();
        if (matchCode) {
          order = await orderRepo.findOne({ orderCode: matchCode.toUpperCase(), channel: 'ONLINE' });
        }
      }

      if (!order) {
        console.warn('[PayOS Webhook] Order not found for webhook:', { numericOrderCode, strOrderCode });
        res.json({ success: true, message: 'Order not found, ignored' });
        return;
      }

      // Idempotency (AC-04)
      if (order.paymentStatus === 'PAID' || (txId && order.paymentTransactionId === txId)) {
        res.json({ success: true, alreadyProcessed: true });
        return;
      }

      if (amount < Number(order.totalAmount || 0)) {
        throw new ApiError(400, 'INVALID_AMOUNT', 'Số tiền thanh toán nhỏ hơn tổng giá trị đơn hàng');
      }

      // Nếu đơn đã hết hạn / hủy nhưng khách chuyển muộn
      if (order.paymentStatus === 'EXPIRED' || order.fulfillmentStatus === 'CANCELLED') {
        await webAuditLogRepo.create({
          actorId: 'PAYOS_WEBHOOK',
          actorName: 'PayOS Webhook',
          actorRole: 'SYSTEM',
          action: 'LATE_PAYMENT_WARNING',
          entityType: 'Order',
          entityId: String(order._id),
          diffSummary: `Nhận chuyển khoản muộn ${amount}đ cho đơn đã hủy ${order.orderCode} (tx: ${txId})`,
        });
        res.json({ success: true, warning: 'LATE_PAYMENT_RECORDED' });
        return;
      }

      await orderRepo.updateById(String(order._id), {
        paymentStatus: 'PAID',
        status: 'PAID',
        fulfillmentStatus: 'CONFIRMED',
        paidAmount: amount,
        paymentTransactionId: txId,
        confirmedAt: new Date(),
      });

      for (const it of order.items || []) {
        await stockMovementRepo.create({
          productId: String(it.productId),
          productCode: it.productCode || '',
          productName: it.productName || '',
          color: it.color || '',
          size: it.size || '',
          warehouseLocation: 'FLOOR_1',
          type: 'SALE',
          categoryId: '',
          unit: it.unit || 'Cái',
          quantityChange: -Number(it.quantity || 0),
          balanceBefore: 0,
          balanceAfter: 0,
          referenceType: 'ORDER',
          referenceId: String(order._id),
          referenceCode: order.orderCode,
          note: `Thanh toán PayOS/VietQR đơn ${order.orderCode} (tx: ${txId})`,
          performedBy: 'PAYOS_WEBHOOK',
          performedByName: 'PayOS Webhook',
        });
      }

      if (order.customerId) {
        const cust = await customerRepo.findById(String(order.customerId));
        if (cust) {
          await customerRepo.updateById(String(cust._id), {
            totalOrders: Number(cust.totalOrders || 0) + 1,
            totalSpent: Number(cust.totalSpent || 0) + Number(order.totalAmount || 0),
            lastOrderAt: new Date(),
          });
        }
      }

      res.json({ success: true, orderCode: order.orderCode });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== WEB-09: CUSTOMER OTP AUTH ====================

publicStorefrontRouter.post(
  '/customers/request-otp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = String(req.body?.identifier || '').trim().toLowerCase();
      const channel = req.body?.channel === 'SMS' ? 'SMS' : 'EMAIL';
      if (!identifier) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập email hoặc số điện thoại');
      }

      const otp = generateOtpCode();
      const otpHash = hashOtp(identifier, otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await customerOtpRepo.create({
        identifier,
        channel,
        otpHash,
        expiresAt,
        attempts: 0,
      });

      await dispatchCustomerOtp(identifier, otp, channel);

      res.json({
        message: 'Mã OTP đã được gửi',
        expiresInSeconds: 300,
        // Chỉ trả devOtp trong môi trường test để automated test xác thực
        ...(process.env.VITEST || process.env.NODE_ENV === 'test' ? { devOtp: otp } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.post(
  '/customers/verify-otp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = String(req.body?.identifier || '').trim().toLowerCase();
      const otp = String(req.body?.otp || '').trim();
      if (!identifier || !otp) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đầy đủ thông tin và mã OTP');
      }

      const records = await customerOtpRepo.find({ identifier }, { createdAt: -1 });
      const latest = records.find((r) => !r.verifiedAt);
      if (!latest) {
        throw new ApiError(400, 'OTP_INVALID', 'Mã OTP không tồn tại hoặc đã sử dụng');
      }
      if (new Date(latest.expiresAt) < new Date()) {
        throw new ApiError(400, 'OTP_EXPIRED', 'Mã OTP đã hết hạn, vui lòng yêu cầu mã mới');
      }
      if (Number(latest.attempts || 0) >= 5) {
        throw new ApiError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Nhập sai OTP quá 5 lần, vui lòng yêu cầu mã mới');
      }

      if (hashOtp(identifier, otp) !== latest.otpHash) {
        await customerOtpRepo.updateById(String(latest._id), {
          attempts: Number(latest.attempts || 0) + 1,
        });
        throw new ApiError(400, 'OTP_INVALID', 'Mã OTP không chính xác');
      }

      await customerOtpRepo.updateById(String(latest._id), { verifiedAt: new Date() });

      const isEmail = identifier.includes('@');
      let customer = isEmail
        ? await customerRepo.findOne({ email: identifier })
        : await customerRepo.findOne({ phone: identifier });

      if (!customer) {
        customer = await customerRepo.create({
          ...(isEmail ? { email: identifier } : { phone: identifier }),
          name: isEmail ? identifier.split('@')[0] : 'Khách hàng',
          isVerified: true,
          addresses: [],
          totalOrders: 0,
          totalSpent: 0,
        });
      } else if (!customer.isVerified) {
        customer = (await customerRepo.updateById(String(customer._id), { isVerified: true })) || customer;
      }

      const token = signCustomerToken(String(customer._id), identifier);
      res.json({
        data: {
          token,
          customer: {
            _id: String(customer._id),
            name: customer.name,
            phone: customer.phone || '',
            email: customer.email || '',
            addresses: customer.addresses || [],
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.get(
  '/customers/me',
  attachCustomerContext,
  requireCustomerAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = await customerRepo.findById(req.customer!.customerId);
      if (!customer) {
        throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy tài khoản khách hàng');
      }
      res.json({
        data: {
          _id: String(customer._id),
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          addresses: customer.addresses || [],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.put(
  '/customers/me',
  attachCustomerContext,
  requireCustomerAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, phone, addresses } = req.body || {};
      const patch: Record<string, unknown> = {};
      if (typeof name === 'string' && name.trim()) patch.name = name.trim();
      if (typeof phone === 'string' && phone.trim()) patch.phone = phone.trim();
      if (Array.isArray(addresses)) patch.addresses = addresses;

      const updated = await customerRepo.updateById(req.customer!.customerId, patch);
      if (!updated) {
        throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy tài khoản khách hàng');
      }
      res.json({
        data: {
          _id: String(updated._id),
          name: updated.name,
          phone: updated.phone || '',
          email: updated.email || '',
          addresses: updated.addresses || [],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

publicStorefrontRouter.get(
  '/customers/me/orders',
  attachCustomerContext,
  requireCustomerAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
      const orders = await orderRepo.find(
        { customerId: req.customer!.customerId, channel: 'ONLINE' },
        { createdAt: -1 }
      );
      const paged = orders.slice((page - 1) * limit, page * limit);
      res.json({
        data: paged.map((o) => ({
          _id: String(o._id),
          orderCode: o.orderCode,
          fulfillmentStatus: o.fulfillmentStatus || 'PENDING',
          paymentStatus: o.paymentStatus || 'UNPAID',
          paymentGateway: o.paymentGateway || 'COD',
          totalAmount: o.totalAmount,
          trackingCode: o.trackingCode || '',
          createdAt: o.createdAt,
          items: (o.items || []).map((it) => ({
            productId: it.productId,
            productName: it.productName,
            color: it.color || '',
            size: it.size || '',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
          })),
        })),
        meta: { total: orders.length, page, limit },
      });
    } catch (err) {
      next(err);
    }
  }
);

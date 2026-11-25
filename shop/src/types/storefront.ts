export interface BannerItem {
  _id: string;
  title: string;
  position: "HERO" | "INLINE_1" | "INLINE_2" | string;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  linkUrl?: string;
  altText?: string;
  sortOrder?: number;
}

export interface HomeSectionItem {
  _id: string;
  type:
    | "HERO"
    | "CATEGORY_GRID"
    | "CATEGORY_CAROUSEL"
    | "FLASH_SALE"
    | "USP"
    | "BRANDS"
    | "BLOG"
    | "CUSTOM_BANNER"
    | string;
  title?: string;
  subtitle?: string;
  viewAllUrl?: string;
  configJson?: Record<string, unknown>;
  sortOrder: number;
}

export interface CategorySummary {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  descriptionHtml?: string;
  subCategories?: CategorySummary[];
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export interface BrandSummary {
  _id: string;
  code?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  descriptionHtml?: string;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export interface ProductColorOption {
  color: string;
  colorHexes?: string[];
  imageUrl?: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface ProductListItem {
  _id: string;
  code: string;
  name: string;
  slug: string;
  brand?: { _id?: string; name: string; slug: string };
  category?: { _id?: string; name: string; slug: string };
  sellingPrice: number;
  compareAtPrice?: number | null;
  thumbnailUrl?: string;
  images?: ProductImage[];
  inStock: boolean;
  stockAvailable?: number;
  isFeatured?: boolean;
  isNew?: boolean;
  hasGift?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  colors?: ProductColorOption[];
}

export interface ProductVariant {
  variantKey: string;
  variantCode: string;
  color?: string;
  colorHexes?: string[];
  size?: string;
  imageUrl?: string;
  effectiveSellingPrice: number;
  compareAtPrice?: number | null;
  stockAvailable: number;
  inStock: boolean;
}

export interface TierPricingRule {
  minQty: number;
  discountType?: "PERCENT" | "AMOUNT" | string;
  discountValue?: number;
  discountPercent?: number;
  discountAmount?: number;
  label?: string;
}

export interface GiftPromotionItem {
  productId?: string;
  productCode?: string;
  productName: string;
  unit?: string;
  imageUrl?: string;
  quantity?: number;
}

export interface GiftPromotion {
  _id?: string;
  title?: string;
  name?: string;
  description?: string;
  giftProductName?: string;
  minQuantity?: number;
  minOrderAmount?: number;
  gifts?: GiftPromotionItem[];
}

export interface MenuNode {
  _id: string;
  label: string;
  url: string;
  icon?: string;
  badge?: string;
  openInNewTab?: boolean;
  sortOrder: number;
  children?: MenuNode[];
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductDetail extends ProductListItem {
  shortDescription?: string;
  descriptionHtml?: string;
  specs?: ProductSpec[];
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  variants: ProductVariant[];
  promotions?: {
    tierPricing?: TierPricingRule[];
    giftPromotions?: GiftPromotion[];
  };
}

export interface FlashSaleData {
  promotionId?: string;
  title: string;
  endAt: string;
  products: ProductListItem[];
}

export interface ArticleSummary {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  category?: { name: string; slug: string };
}

export interface ArticleDetail extends ArticleSummary {
  contentHtml: string;
  authorName?: string;
  updatedAt?: string;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  relatedProducts?: ProductListItem[];
}

export interface StaticPageDetail {
  _id: string;
  title: string;
  slug: string;
  contentHtml: string;
  updatedAt?: string;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export interface ArticleListResponse {
  data: ArticleSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  categories?: { name: string; slug: string }[];
}

export interface CartPriceItemResult {
  productId: string;
  productCode?: string;
  name: string;
  slug: string;
  variantKey: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  unitPrice: number;
  tierDiscountAmount: number;
  lineTotal: number;
  quantity: number;
  stockAvailable: number;
  inStock: boolean;
}

export interface EligibleGift {
  productId: string;
  productName: string;
  imageUrl?: string;
  quantity: number;
}

export interface CartPriceResponse {
  items: CartPriceItemResult[];
  rawSubtotal: number;
  tierDiscountTotal: number;
  couponDiscount: number;
  couponApplied?: { code: string; name: string } | null;
  couponError?: string | null;
  eligibleGifts: EligibleGift[];
  shippingFee: number;
  freeShipThreshold: number;
  totalAmount: number;
}

export interface CustomerAddress {
  id: string;
  label?: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  isDefault?: boolean;
}

export interface CustomerProfile {
  _id: string;
  name: string;
  phone?: string;
  email: string;
  addresses: CustomerAddress[];
}

export interface CustomerOrderSummary {
  _id: string;
  orderCode: string;
  createdAt: string;
  totalAmount: number;
  paymentGateway: "COD" | "PAYOS" | "VIETQR" | string;
  paymentStatus: "PAID" | "UNPAID" | "EXPIRED" | string;
  fulfillmentStatus:
    | "PENDING"
    | "CONFIRMED"
    | "SHIPPING"
    | "DELIVERED"
    | "CANCELLED"
    | string;
  itemsCount?: number;
}

export interface UspItem {
  icon?: string;
  title: string;
  description: string;
}

export interface SiteSettings {
  siteName?: string;
  logoUrl?: string;
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  freeShipThreshold?: number;
}

export interface HomeDataResponse {
  banners: BannerItem[];
  homeSections: HomeSectionItem[];
  flashSale?: FlashSaleData | null;
  featuredProducts: ProductListItem[];
  categoryBlocks: {
    category: CategorySummary;
    products: ProductListItem[];
  }[];
  brands: BrandSummary[];
  articles: ArticleSummary[];
  usp: UspItem[];
  settings?: SiteSettings;
}

export interface ProductFacets {
  brands?: { name: string; slug: string; count: number }[];
  colors?: string[];
  sizes?: string[];
  priceRange?: { min: number; max: number };
}

export interface ProductListResponse {
  data: ProductListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  facets?: ProductFacets;
}

export interface CategoryDetailResponse {
  category: CategorySummary;
  brands?: BrandSummary[];
  subCategories?: CategorySummary[];
}

export interface ReviewItem {
  _id: string;
  customerName: string;
  rating: number;
  comment: string;
  images?: string[];
  isVerifiedPurchase?: boolean;
  createdAt: string;
}

export interface ReviewListResponse {
  data: ReviewItem[];
  summary: {
    ratingAvg: number;
    ratingCount: number;
    breakdown: Record<string, number>;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

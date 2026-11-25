import { apiRequest } from "./api";

export interface WebSeoMeta {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface WebDashboardData {
  totalRevenue: number;
  totalOrders: number;
  paidOrdersCount: number;
  qrOrdersCount: number;
  qrSuccessRate: number;
  pendingReviewsCount: number;
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];
  recentAuditLogs: WebAuditLogItem[];
}

export interface WebAuditLogItem {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  diffSummary: string;
  createdAt: string;
}

export interface WebBannerItem {
  _id: string;
  title: string;
  position: "HERO" | "MID_BANNER" | "POPUP";
  desktopImageUrl: string;
  mobileImageUrl: string;
  linkUrl?: string;
  altText?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  createdAt?: string;
}

export interface WebHomeSectionItem {
  _id: string;
  type: string;
  title: string;
  subtitle?: string;
  viewAllUrl?: string;
  configJson?: Record<string, any>;
  isActive: boolean;
  sortOrder: number;
}

export interface WebMenuItem {
  _id: string;
  label: string;
  url: string;
  parentId?: string | null;
  icon?: string;
  badge?: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab?: boolean;
}

export interface WebCategoryItem {
  _id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  descriptionHtml?: string;
  isPublishedOnline?: boolean;
  sortOrder?: number;
  seo?: WebSeoMeta;
}

export interface WebBrandItem {
  _id: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  descriptionHtml?: string;
  isPublishedOnline?: boolean;
  sortOrder?: number;
  seo?: WebSeoMeta;
}

export interface WebProductVariant {
  variantKey: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  stockFloor1?: number;
  stockFloor2?: number;
}

export interface WebProductImageObj {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface WebProductItem {
  _id: string;
  code: string;
  name: string;
  slug?: string;
  sellingPrice: number;
  compareAtPrice?: number;
  stockFloor1?: number;
  stockFloor2?: number;
  isPublishedOnline?: boolean;
  isFeatured?: boolean;
  images?: (string | WebProductImageObj)[];
  variants?: WebProductVariant[];
  shortDescription?: string;
  descriptionHtml?: string;
  specs?: { label: string; value: string }[];
  seo?: WebSeoMeta;
}

export interface WebArticleCategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  seo?: WebSeoMeta;
}

export interface WebArticleItem {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  tags?: string[];
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
  publishedAt?: string | null;
  authorName?: string;
  viewCount?: number;
  seo?: WebSeoMeta;
  createdAt?: string;
}

export interface WebStaticPageItem {
  _id: string;
  title: string;
  slug: string;
  contentHtml?: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
  seo?: WebSeoMeta;
  updatedAt?: string;
}

export interface WebPromotionItem {
  _id: string;
  code: string;
  name: string;
  description?: string;
  status: "ACTIVE" | "PAUSED";
  applyChannels?: string[];
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount?: number;
  isFlashSale?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface WebReviewItem {
  _id: string;
  productId: string;
  productName?: string;
  customerName: string;
  rating: number;
  comment: string;
  images?: string[];
  isVerifiedPurchase?: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminReply?: string;
  createdAt?: string;
}

export interface WebRedirectItem {
  _id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
  isActive: boolean;
  note?: string;
  createdAt?: string;
}

export interface WebShowroomItem {
  name: string;
  address: string;
  hotline: string;
  hours?: string;
  mapUrl?: string;
}

export interface WebSiteSettingData {
  siteName?: string;
  logoUrl?: string;
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  email?: string;
  freeShipThreshold?: number;
  defaultShippingFee?: number;
  showrooms?: WebShowroomItem[];
  footerAbout?: string;
  onlineStockMode?: "FLOOR_1" | "ALL";
  ga4Id?: string;
  gtmId?: string;
  payosClientId?: string;
  payosApiKey?: string;
  payosChecksumKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryFolder?: string;
  webhookSecret?: string;
  revalidateSecret?: string;
}

export interface WebShippingAddressObj {
  fullName?: string;
  phone?: string;
  email?: string;
  province?: string;
  district?: string;
  ward?: string;
  addressLine?: string;
  note?: string;
}

export interface WebOnlineOrderItem {
  _id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  shippingAddress?: string | WebShippingAddressObj;
  totalAmount: number;
  shippingFee?: number;
  discountAmount?: number;
  paymentGateway?: string;
  paymentStatus: "UNPAID" | "PAID" | "EXPIRED" | "REFUNDED";
  fulfillmentStatus: "PENDING" | "CONFIRMED" | "PACKING" | "SHIPPING" | "DELIVERED" | "CANCELLED";
  trackingCode?: string;
  items?: {
    productId: string;
    productName: string;
    color?: string;
    size?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isGift?: boolean;
  }[];
  createdAt: string;
}

export function formatWebShippingAddress(addr?: string | WebShippingAddressObj | null): string {
  if (!addr) return "—";
  if (typeof addr === "string") return addr.trim() || "—";
  const parts = [addr.addressLine, addr.ward, addr.district, addr.province]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const text = parts.join(", ");
  if (addr.note && addr.note.trim()) {
    return text ? `${text} (Ghi chú: ${addr.note.trim()})` : addr.note.trim();
  }
  return text || "—";
}

export function extractWebImageUrl(input?: string | WebProductImageObj | null): string {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  if (typeof input === "object" && typeof input.url === "string") return input.url.trim();
  return "";
}

export function resolveWebMediaUrl(url?: string | WebProductImageObj | null): string {
  const s = extractWebImageUrl(url);
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  if (s.startsWith("/images/")) {
    const shopOrigin = (process.env.NEXT_PUBLIC_SHOP_URL || "http://localhost:3002").replace(/\/$/, "");
    return `${shopOrigin}${s}`;
  }
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "https://one1sport-it.onrender.com/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/, "");
  return s.startsWith("/") ? `${origin}${s}` : `${origin}/${s}`;
}

export function slugifyVietnamese(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function uploadWebImageFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ảnh vượt quá giới hạn 5MB");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh"));
    reader.readAsDataURL(file);
  });
  const res = await apiRequest<{ url: string }>("/cms/web/upload", {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName: file.name }),
  });
  return res.data.url;
}

export async function testCloudinaryConnectionApi(params: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
}): Promise<{ connected: boolean; message: string; testUrl?: string }> {
  const res = await apiRequest<{ connected: boolean; message: string; testUrl?: string }>(
    "/cms/web/cloudinary/test-connection",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  return res.data;
}

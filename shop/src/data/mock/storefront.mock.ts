import type {
  ArticleDetail,
  BrandSummary,
  CategorySummary,
  CustomerOrderSummary,
  CustomerProfile,
  HomeDataResponse,
  ProductDetail,
  ReviewListResponse,
  StaticPageDetail,
  UspItem,
} from "@/types/storefront";
import type { SiteSettingsData } from "@/lib/storefront";

export interface MockBrandExtended extends BrandSummary {
  rootCategorySlug: string;
  enRootSlugAlias: string;
  alphabetGroup: "A-K" | "L-Z";
  country: string;
  productCount: number;
  featuredOnHome: boolean;
}

export interface MockPolicySection {
  heading: string;
  paragraphs: string[];
}

export interface MockPolicyPage {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: MockPolicySection[];
  callout: string;
}

export interface MockProgramPage {
  _id: string;
  slug: string;
  title: string;
  subtitle: string;
  variant: "vision-card" | "trade-in-step";
  cards: Array<{
    badge: string;
    title: string;
    description: string;
  }>;
  callout: string;
}

export const MOCK_SITE_SETTINGS: SiteSettingsData = {
  siteName: "11Sport",
  logoUrl: "",
  topBarText:
    "CHÍNH HÃNG 100% • LỖI LÀ ĐỔI MỚI • FREESHIP TOÀN QUỐC • TẶNG QUẤN CÁN, DÁN VIỀN, BAO VỢT",
  hotline: "0909 888 128",
  email: "cskh@11sport.vn",
  zaloUrl: "https://zalo.me/0909888128",
  messengerUrl: "https://m.me/11sport.pickleball",
  shipping: {
    defaultFee: 0,
    freeShipThreshold: 0,
  },
  showrooms: [
    {
      name: "11Sport Center · Quận 10",
      address: "95 Trần Thiện Chánh, Phường 12, Quận 10, TP.HCM",
      phone: "0789 404 331",
      hours: "08:30 - 21:30 (T2 - CN)",
      mapUrl: "https://maps.google.com/?q=10.7756,106.6679",
      embedUrl: "QUẬN 10",
    },
    {
      name: "11Sport Phú Nhuận",
      address: "100 Hoa Lan, Phường 2, Quận Phú Nhuận, TP.HCM",
      phone: "0789 404 231",
      hours: "08:30 - 21:30 (T2 - CN)",
      mapUrl: "https://maps.google.com/?q=10.7982,106.6897",
      embedUrl: "PHÚ NHUẬN",
    },
    {
      name: "11Sport Hà Nội · Ngọc Hà",
      address: "466 Đường Bưởi, Ngọc Hà, Quận Ba Đình, Hà Nội",
      phone: "0913 729 135",
      hours: "08:30 - 21:30 (T2 - CN)",
      mapUrl: "https://maps.google.com/?q=21.0431,105.8092",
      embedUrl: "HÀ NỘI",
    },
  ],
};

export const MOCK_USP_ITEMS: UspItem[] = [
  {
    icon: "gift",
    title: "Tặng quấn cán, dán viền, bao vợt",
    description: "Tặng kèm full bộ phụ kiện bảo vệ vợt chính hãng",
  },
  {
    icon: "shield",
    title: "Bảo hành chính hãng",
    description: "Lỗi là đổi mới 1 đổi 1 theo tiêu chuẩn nhà sản xuất",
  },
  {
    icon: "check",
    title: "100% hàng chính hãng",
    description: "Xác thực NFC / QR chính hãng, hoàn tiền 200% nếu giả",
  },
  {
    icon: "truck",
    title: "Miễn phí vận chuyển",
    description: "Giao nhanh toàn quốc, đồng kiểm trước khi thanh toán",
  },
];

export const MOCK_CATEGORIES: CategorySummary[] = [
  {
    _id: "cat-paddles",
    name: "Vợt Pickleball",
    slug: "vot-pickleball",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg",
    descriptionHtml:
      "<p>Đại lý phân phối chính hãng hơn 20 thương hiệu <strong>Vợt Pickleball</strong> hàng đầu thế giới tại <strong>11Sport</strong>: Joola, Selkirk, Kamito, Facolos, CRBN, Franklin, Sypik, Wika, Six Zero, Proton. Tặng kèm quấn cán, dán viền, bao vợt và ưu đãi giá mua nhiều từ 3 sản phẩm cùng biến thể.</p>",
    subCategories: [
      { _id: "sub-joola", name: "Vợt Pickleball Joola", slug: "vot-pickleball-joola" },
      { _id: "sub-selkirk", name: "Vợt Pickleball Selkirk", slug: "vot-pickleball-selkirk" },
      { _id: "sub-kamito", name: "Vợt Pickleball Kamito", slug: "vot-pickleball-kamito" },
      { _id: "sub-facolos", name: "Vợt Pickleball Facolos", slug: "vot-pickleball-facolos" },
      { _id: "sub-crbn", name: "Vợt Pickleball CRBN", slug: "vot-pickleball-crbn" },
      { _id: "sub-honolulu", name: "Vợt Pickleball Honolulu", slug: "vot-pickleball-honolulu" },
      { _id: "sub-proton", name: "Vợt Pickleball Proton", slug: "vot-pickleball-proton" },
      { _id: "sub-six-zero", name: "Vợt Pickleball Six Zero", slug: "vot-pickleball-six-zero" },
      { _id: "sub-thunder", name: "Vợt Pickleball Thunder", slug: "vot-pickleball-thunder" },
      { _id: "sub-zocker", name: "Vợt Pickleball Zocker", slug: "vot-pickleball-zocker" },
    ],
  },
  {
    _id: "cat-fashion",
    name: "Thời trang 11Sport",
    slug: "thoi-trang",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg",
    descriptionHtml:
      "<p>Bộ sưu tập <strong>Thời trang Pickleball 11Sport</strong> thoáng khí 4 chiều: Combo thi đấu, Áo Polo Dry-Fit, Nón chống tia UV50+, Túi Canvas và Tất đệm chống trượt.</p>",
    subCategories: [
      { _id: "sub-combo", name: "Combo Thời trang", slug: "combo-pikpro" },
      { _id: "sub-shirt", name: "Áo Pickleball", slug: "ao-pikpro" },
      { _id: "sub-cap", name: "Nón Pickleball", slug: "non-pikpro" },
      { _id: "sub-tote", name: "Túi Thời trang", slug: "tui-pikpro" },
      { _id: "sub-socks", name: "Tất Pickleball", slug: "tat-pikpro" },
    ],
  },
  {
    _id: "cat-shoes",
    name: "Giày",
    slug: "giay-pickleball",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg",
    descriptionHtml:
      "<p><strong>Giày Pickleball</strong> chuyên dụng từ Asics, Skechers, ON, Kaitashi giúp khóa cổ chân chắc chắn, đế cao su chống mài mòn và bám sân tối đa.</p>",
    subCategories: [
      { _id: "sub-asics", name: "Giày Asics", slug: "giay-asics" },
      { _id: "sub-skechers", name: "Giày Skechers", slug: "giay-skechers" },
      { _id: "sub-on", name: "Giày ON", slug: "giay-on" },
      { _id: "sub-kaitashi-shoe", name: "Giày Kaitashi", slug: "giay-kaitashi" },
    ],
  },
  {
    _id: "cat-bags",
    name: "Túi - Balo",
    slug: "balo-tui-pickleball",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png",
    descriptionHtml:
      "<p><strong>Balo &amp; Túi đựng vợt Pickleball</strong> Joola, Selkirk, CRBN có ngăn bạc cách nhiệt bảo vệ lõi vợt và ngăn đựng giày tách biệt.</p>",
  },
  {
    _id: "cat-accessories",
    name: "Phụ kiện",
    slug: "phu-kien-pickleball",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg",
    descriptionHtml:
      "<p>Đầy đủ <strong>Phụ kiện Pickleball</strong>: Bóng thi đấu Franklin X-40, quấn cán chống trơn, băng dán viền vợt, cục tẩy vệ sinh mặt Raw Carbon.</p>",
  },
  {
    _id: "cat-balls",
    name: "Bóng Pickleball",
    slug: "bong-pickleball",
    imageUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg",
    descriptionHtml:
      "<p><strong>Bóng Pickleball</strong> 40 lỗ chuẩn thi đấu USAPA ngoài trời từ Franklin X-40, Joola Heleus, Kamito.</p>",
  },
];

// All 22 Brands (20 Paddle Brands A-K & L-Z from mipik.vn MegaMenu + Asics & Skechers)
export const MOCK_BRANDS: MockBrandExtended[] = [
  { _id: "b-crbn", name: "CRBN", slug: "crbn", rootCategorySlug: "vot-pickleball-crbn", enRootSlugAlias: "crbn-pickleball-paddle", alphabetGroup: "A-K", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Joola-247x247.jpg", productCount: 12, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball CRBN mặt sợi Carbon T700 nguyên khối chuẩn USAPA.</p>" },
  { _id: "b-facolos", name: "Facolos", slug: "facolos", rootCategorySlug: "vot-pickleball-facolos", enRootSlugAlias: "facolos-pickleball-paddles", alphabetGroup: "A-K", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Kamito-247x247.jpg", productCount: 16, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball Facolos chính hãng chuẩn thi đấu.</p>" },
  { _id: "b-franklin", name: "Franklin", slug: "franklin", rootCategorySlug: "vot-pickleball-franklin", enRootSlugAlias: "franklin-pickleball-paddle", alphabetGroup: "A-K", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2025/12/selkirk-247x247.jpg", productCount: 10, featuredOnHome: false, descriptionHtml: "<p>Thương hiệu bóng X-40 và vợt thi đấu US Open Pickleball.</p>" },
  { _id: "b-gearbox", name: "Gearbox", slug: "gearbox", rootCategorySlug: "vot-pickleball-gearbox", enRootSlugAlias: "gearbox-pickleball-paddle", alphabetGroup: "A-K", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/KBS-247x247.jpg", productCount: 8, featuredOnHome: false, descriptionHtml: "<p>Vợt Gearbox Pro Power lõi SST Carbon độc quyền.</p>" },
  { _id: "b-honolulu", name: "Honolulu", slug: "honolulu", rootCategorySlug: "vot-pickleball-honolulu", enRootSlugAlias: "honolulu-pickleball-paddle", alphabetGroup: "A-K", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/07/Vole-247x247.jpg", productCount: 9, featuredOnHome: false, descriptionHtml: "<p>Vợt Honolulu Sword &amp; Shield J2K Kevlar/Carbon.</p>" },
  { _id: "b-joola", name: "Joola", slug: "joola", rootCategorySlug: "vot-pickleball-joola", enRootSlugAlias: "joola-pickleball-paddle", alphabetGroup: "A-K", country: "USA / Germany", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Joola-247x247.jpg", productCount: 28, featuredOnHome: true, descriptionHtml: "<p>Thương hiệu vợt Pickleball số 1 PPA Tour: Joola Perseus, Hyperion, Scorpeus, Magnus Gen 3S &amp; Pro IV.</p>" },
  { _id: "b-kaitashi", name: "Kaitashi", slug: "kaitashi", rootCategorySlug: "vot-pickleball-kaitashi", enRootSlugAlias: "kaitashi-pickleball-paddle", alphabetGroup: "A-K", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Kaiwin-247x247.jpg", productCount: 11, featuredOnHome: false, descriptionHtml: "<p>Vợt và giày Pickleball Kaitashi bền bỉ cho người mới.</p>" },
  { _id: "b-kaiwin", name: "Kaiwin", slug: "kaiwin", rootCategorySlug: "vot-pickleball-kaiwin", enRootSlugAlias: "kaiwin-pickleball-paddle", alphabetGroup: "A-K", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Kaiwin-247x247.jpg", productCount: 8, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball phong trào Kaiwin.</p>" },
  { _id: "b-kamito", name: "Kamito", slug: "kamito", rootCategorySlug: "vot-pickleball-kamito", enRootSlugAlias: "kamito-pickleball-paddle", alphabetGroup: "A-K", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Kamito-247x247.jpg", productCount: 22, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball Kamito Alpha &amp; Radiant tích hợp chip NFC chính hãng.</p>" },
  { _id: "b-kbs", name: "KBS", slug: "kbs", rootCategorySlug: "vot-pickleball-kbs", enRootSlugAlias: "kbs-pickleball-paddle", alphabetGroup: "A-K", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/KBS-247x247.jpg", productCount: 7, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball KBS cân bằng và giảm chấn cổ tay.</p>" },
  { _id: "b-loco", name: "Loco", slug: "loco", rootCategorySlug: "vot-pickleball-loco", enRootSlugAlias: "loco-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg", productCount: 6, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball Loco mặt nhám T700.</p>" },
  { _id: "b-luzz", name: "Luzz", slug: "luzz", rootCategorySlug: "vot-pickleball-luzz", enRootSlugAlias: "luzz-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/07/Vole-247x247.jpg", productCount: 7, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball Luzz khí động học.</p>" },
  { _id: "b-proton", name: "Proton", slug: "proton", rootCategorySlug: "vot-pickleball-proton", enRootSlugAlias: "proton-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2025/12/selkirk-247x247.jpg", productCount: 8, featuredOnHome: false, descriptionHtml: "<p>Vợt Proton Series bề mặt Nanotac siêu bền.</p>" },
  { _id: "b-rpm", name: "RPM", slug: "rpm", rootCategorySlug: "vot-pickleball-rpm", enRootSlugAlias: "rpm-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/KBS-247x247.jpg", productCount: 6, featuredOnHome: false, descriptionHtml: "<p>Vợt RPM sợi Kevlar tạo xoáy cao.</p>" },
  { _id: "b-selkirk", name: "Selkirk", slug: "selkirk", rootCategorySlug: "vot-pickleball-selkirk", enRootSlugAlias: "selkirk-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2025/12/selkirk-247x247.jpg", productCount: 24, featuredOnHome: true, descriptionHtml: "<p>Thương hiệu vợt cao cấp Mỹ: Selkirk Labs Project Boomstik, Vanguard Power Air, Luxx Control Air.</p>" },
  { _id: "b-six-zero", name: "Six Zero", slug: "six-zero", rootCategorySlug: "vot-pickleball-six-zero", enRootSlugAlias: "six-zero-pickleball-paddle", alphabetGroup: "L-Z", country: "Australia", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Joola-247x247.jpg", productCount: 11, featuredOnHome: false, descriptionHtml: "<p>Vợt Six Zero Double Black Diamond &amp; Ruby Kevlar.</p>" },
  { _id: "b-soxter", name: "Soxter", slug: "soxter", rootCategorySlug: "vot-pickleball-soxter", enRootSlugAlias: "soxter-pickleball-paddle", alphabetGroup: "L-Z", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg", productCount: 6, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball Soxter kiểm soát ổn định.</p>" },
  { _id: "b-sypik", name: "Sypik", slug: "sypik", rootCategorySlug: "vot-pickleball-sypik", enRootSlugAlias: "sypik-pickleball-paddle", alphabetGroup: "L-Z", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg", productCount: 15, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball Sypik Triton Pro mặt nhám T700.</p>" },
  { _id: "b-thunder", name: "Thunder", slug: "thunder", rootCategorySlug: "vot-pickleball-thunder", enRootSlugAlias: "thunder-pickleball-paddle", alphabetGroup: "L-Z", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg", productCount: 6, featuredOnHome: false, descriptionHtml: "<p>Vợt Pickleball Thunder thiên công.</p>" },
  { _id: "b-vole", name: "Vole", slug: "vole", rootCategorySlug: "vot-pickleball-vole", enRootSlugAlias: "vole-pickleball-paddle", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/07/Vole-247x247.jpg", productCount: 8, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball Vole phản xạ nhanh trên lưới.</p>" },
  { _id: "b-wika", name: "Wika", slug: "wika", rootCategorySlug: "vot-pickleball-wika", enRootSlugAlias: "wika-pickleball-paddle", alphabetGroup: "L-Z", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg", productCount: 14, featuredOnHome: true, descriptionHtml: "<p>Vợt Pickleball Wika Fire &amp; Wika Air hợp tác cùng Quang Dương.</p>" },
  { _id: "b-zocker", name: "Zocker", slug: "zocker", rootCategorySlug: "vot-pickleball-zocker", enRootSlugAlias: "zocker-pickleball-paddle", alphabetGroup: "L-Z", country: "Việt Nam", logoUrl: "https://mipik.vn/wp-content/uploads/2026/05/Kamito-247x247.jpg", productCount: 9, featuredOnHome: false, descriptionHtml: "<p>Vợt và giày Pickleball Zocker chính hãng.</p>" },
  { _id: "b-asics", name: "Asics", slug: "asics", rootCategorySlug: "giay-asics", enRootSlugAlias: "asics-shoes", alphabetGroup: "A-K", country: "Japan", logoUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg", productCount: 14, featuredOnHome: false, descriptionHtml: "<p>Giày Pickleball &amp; Tennis Asics Court FF 4 &amp; Gel-Resolution X.</p>" },
  { _id: "b-skechers", name: "Skechers", slug: "skechers", rootCategorySlug: "giay-skechers", enRootSlugAlias: "skechers-shoes", alphabetGroup: "L-Z", country: "USA", logoUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg", productCount: 10, featuredOnHome: false, descriptionHtml: "<p>Giày Pickleball Skechers Viper Court Pro đế Goodyear.</p>" },
];

function buildBulkTiersForPrice(sellingPrice: number) {
  const tier3Price = Math.max(0, sellingPrice - 100_000);
  const tier5Price = Math.max(0, sellingPrice - 200_000);
  const fmt = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}₫`;
  return [
    {
      minQty: 3,
      discountAmount: 100_000,
      label: `Mua từ 3 sản phẩm cùng biến thể → ${fmt(tier3Price)} / sp`,
    },
    {
      minQty: 5,
      discountAmount: 200_000,
      label: `Mua từ 5 sản phẩm cùng biến thể → ${fmt(tier5Price)} / sp`,
    },
  ];
}

const STANDARD_BULK_TIERS = buildBulkTiersForPrice(5_100_000);

const STANDARD_GIFT_PROMOS = [
  {
    _id: "gift-5",
    title: "Mua 5 sản phẩm → 1 áo",
    description: "Tặng 01 áo Polo 11Sport Dry-Fit chính hãng trị giá 350.000₫",
    giftProductName: "Áo Polo 11Sport Dry-Fit",
  },
  {
    _id: "gift-10",
    title: "Mua 10 sản phẩm → 2 áo + 1 túi",
    description: "Tặng 02 áo Polo + 01 túi 11Sport Tour trị giá 1.150.000₫",
    giftProductName: "2 Áo Polo + 1 Túi 11Sport Tour",
  },
];

export const MOCK_PRODUCTS: ProductDetail[] = [
  // RAIL 1: VỢT PICKLEBALL
  {
    _id: "prod-joola-perseus-fx",
    code: "JL-PERSEUS-FX",
    name: "Vợt Pickleball Joola Perseus Power FX 16mm",
    slug: "joola-perseus-power-fx",
    brand: { _id: "b-joola", name: "Joola", slug: "joola" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 5_000,
    compareAtPrice: 5_300_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg", alt: "Joola Perseus Power FX Blaze Red", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg", alt: "Joola Perseus Power FX Mint Green" },
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg", alt: "Joola Perseus Power FX Navy" },
    ],
    inStock: true,
    stockAvailable: 28,
    isFeatured: true,
    isNew: true,
    hasGift: true,
    ratingAvg: 4.9,
    ratingCount: 48,
    colors: [
      { color: "Blaze Red", colorHexes: ["#B80411"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg" },
      { color: "Mint Green", colorHexes: ["#428771"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg" },
      { color: "Midnight Navy", colorHexes: ["#1B4F9C"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg" },
    ],
    shortDescription:
      "Siêu phẩm vợt thi đấu chữ ký Ben Johns với lõi Full-Foam EPP trợ lực nổ bóng, mặt Charged Carbon tạo xoáy cực đại và chip NFC xác thực chính hãng.",
    descriptionHtml:
      "<h2>Đánh giá chi tiết Vợt Pickleball Joola Perseus Power FX</h2><p>Joola Perseus Power FX là dòng vợt Elongated (form dài 16.5 inch, cán 5.5 inch) tối ưu cho các cú Drive uy lực từ cuối sân và Backhand 2 tay ổn định.</p><h3>Công nghệ lõi Propulsion &amp; Mặt Charged Carbon</h3><p>Lõi Propulsion Core kết hợp viền Foam bơm quanh chu vi mở rộng điểm ngọt (Sweet Spot) thêm 18%, giảm rung chấn cổ tay rõ rệt khi block bóng tốc độ cao trên lưới.</p>",
    specs: [
      { label: "Trọng lượng trung bình", value: "8.0 oz (~227g)" },
      { label: "Độ dày lõi", value: "16 mm / 14 mm Propulsion Core" },
      { label: "Chất liệu bề mặt", value: "Charged Carbon Surface (Raw T700)" },
      { label: "Chiều dài vợt × Chiều rộng", value: "16.5 inch × 7.5 inch" },
      { label: "Chiều dài cán cầm", value: "5.5 inch (Hỗ trợ Backhand 2 tay)" },
      { label: "Chứng nhận thi đấu", value: "USAPA / UPA-A Approved (Có chip NFC)" },
    ],
    variants: [
      {
        variantKey: "blaze-red-16mm",
        variantCode: "JL-PER-RED-16",
        color: "Blaze Red",
        colorHexes: ["#B80411"],
        size: "16mm (Control)",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg",
        effectiveSellingPrice: 5_000,
        compareAtPrice: 5_300_000,
        stockAvailable: 15,
        inStock: true,
      },
      {
        variantKey: "mint-green-14mm",
        variantCode: "JL-PER-MINT-14",
        color: "Mint Green",
        colorHexes: ["#428771"],
        size: "14mm (Power)",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg",
        effectiveSellingPrice: 5_000,
        compareAtPrice: 5_300_000,
        stockAvailable: 13,
        inStock: true,
      },
    ],
    promotions: {
      tierPricing: STANDARD_BULK_TIERS,
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-selkirk-boomstik",
    code: "SK-BOOMSTIK-ST",
    name: "Vợt Pickleball Selkirk Labs Project Boomstik ST",
    slug: "vot-pickleball-selkirk-boomstik-st",
    brand: { _id: "b-selkirk", name: "Selkirk", slug: "selkirk" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 6_490_000,
    compareAtPrice: 6_900_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg", alt: "Selkirk Labs Project Boomstik ST", isPrimary: true }],
    inStock: true,
    stockAvailable: 14,
    isFeatured: true,
    isNew: true,
    hasGift: true,
    ratingAvg: 5.0,
    ratingCount: 32,
    colors: [
      { color: "Crimson Carbon", colorHexes: ["#D92D20"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg" },
      { color: "Regal Gold", colorHexes: ["#B26000"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-boomstik-canyon-1-1-247x247.jpg" },
      { color: "Midnight Black", colorHexes: ["#0A0A0A"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/06/vot-pickleball-selkirk-boomstik-omni-3-100x100.jpg" },
    ],
    shortDescription:
      "Siêu vợt phòng thí nghiệm Selkirk Labs Project Boomstik với mặt Florek Carbon Fiber và họng vợt khí động học Air Dynamic Throat.",
    descriptionHtml:
      "<h2>Selkirk Labs Project Boomstik ST — Đỉnh cao công nghệ Mỹ</h2><p>Thiết kế khí động học giúp tăng tốc độ đầu vợt thêm 15% khi đấu tay đôi trên khu vực Kitchen.</p>",
    specs: [
      { label: "Trọng lượng trung bình", value: "7.9 - 8.2 oz" },
      { label: "Độ dày lõi", value: "16 mm SuperCore Polypropylene" },
      { label: "Chất liệu bề mặt", value: "3-Layer Florek Raw Carbon" },
      { label: "Xuất xứ", value: "Handcrafted in USA" },
    ],
    variants: [
      {
        variantKey: "crimson-16mm",
        variantCode: "SK-BOOM-CRIM-16",
        color: "Crimson Carbon",
        colorHexes: ["#D92D20"],
        size: "16mm",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg",
        effectiveSellingPrice: 6_490_000,
        compareAtPrice: 6_900_000,
        stockAvailable: 14,
        inStock: true,
      },
    ],
    promotions: {
      tierPricing: buildBulkTiersForPrice(6_490_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-kamito-alpha",
    code: "KM-ALPHA-16",
    name: "Vợt Pickleball Kamito Alpha Pro Carbon T700",
    slug: "vot-pickleball-kamito-alpha",
    brand: { _id: "b-kamito", name: "Kamito", slug: "kamito" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 2_390_000,
    compareAtPrice: 2_790_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg", alt: "Kamito Alpha Pro Carbon T700", isPrimary: true }],
    inStock: true,
    stockAvailable: 35,
    isFeatured: true,
    isNew: false,
    hasGift: true,
    ratingAvg: 4.8,
    ratingCount: 64,
    colors: [
      { color: "Forest Emerald", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg" },
      { color: "Mint Teal", colorHexes: ["#428771"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg" },
    ],
    shortDescription:
      "Vợt Pickleball Kamito Alpha tích hợp chip NFC quét bằng điện thoại, mặt nhám T700 bền bỉ rất dễ thuần cho người chơi Việt Nam.",
    descriptionHtml:
      "<h2>Vợt Pickleball Kamito Alpha — Chuẩn mực kiểm soát &amp; trợ lực</h2><p>Phát triển cùng các VĐV hàng đầu Việt Nam với độ cân bằng hoàn hảo.</p>",
    specs: [
      { label: "Trọng lượng", value: "225g ± 5g" },
      { label: "Độ dày lõi", value: "16 mm PP Honeycomb" },
      { label: "Xác thực", value: "Chip NFC chính hãng Kamito" },
    ],
    variants: [
      {
        variantKey: "forest-16mm",
        variantCode: "KM-ALP-FOR-16",
        color: "Forest Emerald",
        colorHexes: ["#224E40"],
        size: "16mm",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg",
        effectiveSellingPrice: 2_390_000,
        compareAtPrice: 2_790_000,
        stockAvailable: 35,
        inStock: true,
      },
    ],
    promotions: {
      tierPricing: buildBulkTiersForPrice(2_390_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-facolos-elite",
    code: "FC-ELITE-16",
    name: "Vợt Pickleball Facolos Pro Elite Series 16mm",
    slug: "vot-pickleball-facolos-pro-elite",
    brand: { _id: "b-facolos", name: "Facolos", slug: "facolos" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 5_000,
    compareAtPrice: 3_200_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-omni-canyon-2-247x247.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-omni-canyon-2-247x247.jpg", alt: "Facolos Pro Elite 16mm", isPrimary: true }],
    inStock: true,
    stockAvailable: 20,
    isFeatured: true,
    isNew: true,
    hasGift: true,
    ratingAvg: 4.9,
    ratingCount: 29,
    colors: [
      { color: "Sage Mint", colorHexes: ["#164A38"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-omni-canyon-2-247x247.jpg" },
      { color: "Ruby Red", colorHexes: ["#B80411"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg" },
    ],
    shortDescription:
      "Vợt Facolos Pro Elite ép nhiệt nguyên khối Thermoformed Unibody đạt chuẩn thi đấu USAPA.",
    descriptionHtml: "<p>Dòng vợt cao cấp nhất của Facolos với viền bọt Foam chống rung toàn diện.</p>",
    specs: [
      { label: "Công nghệ", value: "Thermoformed Unibody T700" },
      { label: "Độ dày", value: "16 mm" },
    ],
    variants: [
      {
        variantKey: "sage-16mm",
        variantCode: "FC-ELI-16",
        color: "Sage Mint",
        colorHexes: ["#164A38"],
        size: "16mm",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-omni-canyon-2-247x247.jpg",
        effectiveSellingPrice: 5_000,
        compareAtPrice: 3_200_000,
        stockAvailable: 20,
        inStock: true,
      },
    ],
    promotions: {
      tierPricing: buildBulkTiersForPrice(2_850_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-crbn-1x",
    code: "CRBN-1X-16",
    name: "Vợt Pickleball CRBN 1X Power Series 16mm",
    slug: "vot-pickleball-crbn-1x-power",
    brand: { _id: "b-crbn", name: "CRBN", slug: "crbn" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 5_450_000,
    compareAtPrice: 5_800_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg", alt: "CRBN 1X Power Series", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg", alt: "CRBN 1X Power Series - Góc cạnh", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 12,
    isFeatured: true,
    isNew: false,
    hasGift: true,
    ratingAvg: 4.9,
    ratingCount: 41,
    colors: [
      { color: "Matte Carbon", colorHexes: ["#0A0A0A"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg" },
    ],
    shortDescription: "Huyền thoại tạo xoáy và sức mạnh từ Mỹ với mặt sợi Carbon Toray T700.",
    descriptionHtml: "<p>CRBN 1X Power là chuẩn mực cho lối đánh tấn công hiện đại.</p>",
    specs: [
      { label: "Mặt vợt", value: "Toray T700 Raw Carbon" },
      { label: "Chiều dài cán", value: "5.5 inch" },
    ],
    variants: [
      {
        variantKey: "matte-16mm",
        variantCode: "CRBN-1X-16",
        color: "Matte Carbon",
        colorHexes: ["#0A0A0A"],
        size: "16mm",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg",
        effectiveSellingPrice: 5_450_000,
        compareAtPrice: 5_800_000,
        stockAvailable: 12,
        inStock: true,
      },
    ],
    promotions: {
      tierPricing: buildBulkTiersForPrice(5_450_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  // Additional paddles so Brand Hub sections on /vot-pickleball render rich multi-card grids
  {
    _id: "prod-joola-hyperion-3s",
    code: "JL-HYP-3S-16",
    name: "Vợt Pickleball Joola Ben Johns Hyperion 3S 16mm",
    slug: "vot-pickleball-joola-hyperion-3s",
    brand: { _id: "b-joola", name: "Joola", slug: "joola" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 5_000,
    compareAtPrice: 5_750_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg", alt: "Joola Hyperion 3S 16mm", isPrimary: true }],
    inStock: true,
    stockAvailable: 18,
    isFeatured: true,
    isNew: true,
    hasGift: true,
    ratingAvg: 4.9,
    ratingCount: 34,
    colors: [
      { color: "Ocean Blue", colorHexes: ["#1B4F9C"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Perseus-Blue-100x100.jpg" },
      { color: "Blaze Red", colorHexes: ["#B80411"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg" },
    ],
    shortDescription: "Đầu vợt Aero-Curve giảm sức cản gió, lõi Propulsion 16mm kiểm soát tuyệt đối.",
    descriptionHtml: "<p>Joola Hyperion 3S kết hợp sức mạnh và độ ổn định cao.</p>",
    specs: [{ label: "Độ dày lõi", value: "16 mm Propulsion Core" }],
    variants: [],
    promotions: {
      tierPricing: buildBulkTiersForPrice(5_350_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-joola-kosmos-16",
    code: "JL-KOSMOS-16",
    name: "Vợt Pickleball Joola Kosmos Pro Carbon 16mm",
    slug: "vot-pickleball-joola-kosmos-16mm",
    brand: { _id: "b-joola", name: "Joola", slug: "joola" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 4_890_000,
    compareAtPrice: 5_290_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg", alt: "Joola Kosmos 16mm", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg", alt: "Joola Kosmos 16mm - Mặt vợt Carbon", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 16,
    isFeatured: false,
    isNew: true,
    hasGift: true,
    ratingAvg: 4.8,
    ratingCount: 19,
    colors: [
      { color: "Kosmos Mint", colorHexes: ["#428771"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/03/Joola-Kosmos-100x100.jpg" },
    ],
    shortDescription: "Mặt vợt Charged Carbon nhám sâu, trọng lượng cân bằng dễ điều khiển trên lưới.",
    descriptionHtml: "<p>Joola Kosmos 16mm mang đến điểm ngọt lớn và khả năng reset bóng mượt mà.</p>",
    specs: [{ label: "Độ dày lõi", value: "16 mm" }],
    variants: [],
    promotions: {
      tierPricing: buildBulkTiersForPrice(4_890_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-selkirk-omni-calypso",
    code: "SK-OMNI-CAL",
    name: "Vợt Pickleball Selkirk Boomstik Omni Calypso",
    slug: "vot-pickleball-selkirk-omni-calypso",
    brand: { _id: "b-selkirk", name: "Selkirk", slug: "selkirk" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 6_290_000,
    compareAtPrice: 6_650_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg", alt: "Selkirk Omni Calypso", isPrimary: true }],
    inStock: true,
    stockAvailable: 10,
    isFeatured: false,
    isNew: true,
    hasGift: true,
    ratingAvg: 5.0,
    ratingCount: 24,
    colors: [
      { color: "Calypso Teal", colorHexes: ["#428771"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-omni-calypso-pickleball-paddle-mipik-vn-247x247.jpg" },
      { color: "Canyon Orange", colorHexes: ["#BA8366"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-omni-canyon-2-247x247.jpg" },
    ],
    shortDescription: "Phiên bản Selkirk Boomstik Omni phối màu Calypso nổi bật, mặt Carbon siêu xoáy.",
    descriptionHtml: "<p>Dòng Omni mở rộng bề mặt đánh giúp phòng thủ chắc chắn và phản công tốc độ.</p>",
    specs: [{ label: "Mặt vợt", value: "Florek Raw Carbon" }],
    variants: [],
    promotions: {
      tierPricing: buildBulkTiersForPrice(6_290_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },
  {
    _id: "prod-selkirk-boomstik-canyon",
    code: "SK-BOOM-CYN",
    name: "Vợt Pickleball Selkirk Boomstik Canyon Limited",
    slug: "vot-pickleball-selkirk-boomstik-canyon",
    brand: { _id: "b-selkirk", name: "Selkirk", slug: "selkirk" },
    category: { _id: "cat-paddles", name: "Vợt Pickleball", slug: "vot-pickleball" },
    sellingPrice: 6_590_000,
    compareAtPrice: 6_990_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-boomstik-canyon-1-1-247x247.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-boomstik-canyon-1-1-247x247.jpg", alt: "Selkirk Boomstik Canyon", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg", alt: "Selkirk Boomstik Canyon - Chi tiết viền", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 8,
    isFeatured: false,
    isNew: true,
    hasGift: true,
    ratingAvg: 5.0,
    ratingCount: 18,
    colors: [
      { color: "Canyon Red", colorHexes: ["#B80411"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/07/vot-pickleball-selkirk-boomstik-canyon-1-1-247x247.jpg" },
    ],
    shortDescription: "Phiên bản giới hạn Canyon hoàn thiện thủ công tại Mỹ, lực bật bùng nổ.",
    descriptionHtml: "<p>Selkirk Boomstik Canyon là lựa chọn hàng đầu cho người chơi tấn công.</p>",
    specs: [{ label: "Xuất xứ", value: "USA" }],
    variants: [],
    promotions: {
      tierPricing: buildBulkTiersForPrice(6_590_000),
      giftPromotions: STANDARD_GIFT_PROMOS,
    },
  },

  // RAIL 2: THỜI TRANG
  {
    _id: "prod-ao-polo-pikpro",
    code: "11S-POLO-01",
    name: "Áo Polo Pickleball 11Sport Phối Sọc Dry-Fit",
    slug: "ao-mipik-phoi-soc",
    brand: { _id: "b-kamito", name: "11Sport", slug: "kamito" },
    category: { _id: "cat-fashion", name: "Thời trang 11Sport", slug: "thoi-trang" },
    sellingPrice: 350_000,
    compareAtPrice: 450_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg", alt: "Áo Polo 11Sport Phối Sọc", isPrimary: true }],
    inStock: true,
    stockAvailable: 60,
    isFeatured: true,
    isNew: true,
    hasGift: false,
    ratingAvg: 4.9,
    ratingCount: 52,
    colors: [
      { color: "Forest Green", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg" },
      { color: "Cream White", colorHexes: ["#F8EEE9"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg" },
    ],
    shortDescription: "Áo Polo thi đấu Pickleball chất liệu Poly-Spandex siêu nhẹ, thoát mồ hôi nhanh.",
    descriptionHtml: "<p>Thiết kế form thể thao chuẩn chuyển động xoay người đánh Pickleball.</p>",
    specs: [{ label: "Chất liệu", value: "88% Polyester Microfiber + 12% Spandex" }],
    variants: [
      {
        variantKey: "forest-l",
        variantCode: "11S-POLO-FOR-L",
        color: "Forest Green",
        colorHexes: ["#224E40"],
        size: "L",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg",
        effectiveSellingPrice: 350_000,
        compareAtPrice: 450_000,
        stockAvailable: 60,
        inStock: true,
      },
    ],
  },
  {
    _id: "prod-combo-pikpro",
    code: "11S-COMBO-05",
    name: "Combo Thời trang Thi đấu 11Sport Pro (Áo + Nón + Tất)",
    slug: "combo-mipik-5",
    brand: { _id: "b-kamito", name: "11Sport", slug: "kamito" },
    category: { _id: "cat-fashion", name: "Thời trang 11Sport", slug: "thoi-trang" },
    sellingPrice: 590_000,
    compareAtPrice: 750_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg", alt: "Combo Thời trang 11Sport", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg", alt: "Combo Thời trang 11Sport - Phối đồ", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 40,
    isFeatured: true,
    isNew: true,
    hasGift: false,
    ratingAvg: 5.0,
    ratingCount: 27,
    colors: [
      { color: "Mint Edition", colorHexes: ["#164A38"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg" },
    ],
    shortDescription: "Trọn bộ trang phục ra sân Pickleball đồng bộ, tiết kiệm 21%.",
    descriptionHtml: "<p>Bao gồm 01 Áo Polo Dry-Fit + 01 Nón UV50+ + 01 Đôi tất đệm cổ cao.</p>",
    specs: [{ label: "Thành phần", value: "1 Áo + 1 Nón + 1 Đôi Tất" }],
    variants: [
      {
        variantKey: "mint-l",
        variantCode: "11S-CB5-L",
        color: "Mint Edition",
        colorHexes: ["#164A38"],
        size: "L",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg",
        effectiveSellingPrice: 590_000,
        compareAtPrice: 750_000,
        stockAvailable: 40,
        inStock: true,
      },
    ],
  },
  {
    _id: "prod-non-pikpro",
    code: "11S-CAP-01",
    name: "Nón Thể Thao Pickleball 11Sport Ultra-Light UV50+",
    slug: "non-pickleball-pikpro",
    brand: { _id: "b-kamito", name: "11Sport", slug: "kamito" },
    category: { _id: "cat-fashion", name: "Thời trang 11Sport", slug: "thoi-trang" },
    sellingPrice: 220_000,
    compareAtPrice: 280_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png", alt: "Nón Pickleball 11Sport", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg", alt: "Nón Pickleball 11Sport - Chi tiết", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 45,
    isFeatured: false,
    isNew: false,
    hasGift: false,
    ratingAvg: 4.8,
    ratingCount: 18,
    colors: [{ color: "Dark Forest", colorHexes: ["#173E32"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png" }],
    shortDescription: "Nón thể thao đục lỗ laser thoáng khí, đai thấm mồ hôi trán.",
    descriptionHtml: "<p>Bảo vệ mắt và da mặt khi thi đấu sân ngoài trời nắng gắt.</p>",
    specs: [{ label: "Chu vi", value: "54 - 60 cm (Có khóa chỉnh)" }],
    variants: [],
  },

  // RAIL 3: GIÀY PICKLEBALL
  {
    _id: "prod-asics-court-ff4",
    code: "AS-COURT-FF4",
    name: "Giày Pickleball Asics Court FF 4 Nam Chính Hãng",
    slug: "asics-court-ff-4-nam",
    brand: { _id: "b-asics", name: "Asics", slug: "asics" },
    category: { _id: "cat-shoes", name: "Giày", slug: "giay-pickleball" },
    sellingPrice: 3_890_000,
    compareAtPrice: 4_300_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg",
    images: [{ url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg", alt: "Asics Court FF 4 Nam", isPrimary: true }],
    inStock: true,
    stockAvailable: 18,
    isFeatured: true,
    isNew: true,
    hasGift: false,
    ratingAvg: 5.0,
    ratingCount: 39,
    colors: [
      { color: "Navy White", colorHexes: ["#1B4F9C"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg" },
      { color: "Forest Green", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg" },
    ],
    shortDescription:
      "Mẫu giày đỉnh cao nhất của Asics với cấu trúc MONO-SOCK ôm khít cổ chân, công nghệ TWISTRUSS chống lật và đệm FlyteFoam.",
    descriptionHtml: "<p>Asics Court FF 4 là lựa chọn số 1 của các VĐV PPA Tour nhờ độ bám sân cứng vượt trội.</p>",
    specs: [
      { label: "Đế ngoài", value: "AHAR+ Non-Marking Hard Court" },
      { label: "Đệm giữa", value: "FlyteFoam + Forefoot GEL" },
    ],
    variants: [
      {
        variantKey: "navy-42",
        variantCode: "AS-FF4-NV-42",
        color: "Navy White",
        colorHexes: ["#1B4F9C"],
        size: "42",
        imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg",
        effectiveSellingPrice: 5_000,
        compareAtPrice: 5000,
        stockAvailable: 18,
        inStock: true,
      },
    ],
  },
  {
    _id: "prod-skechers-viper",
    code: "SK-VIPER-PRO",
    name: "Giày Pickleball Skechers Viper Court Pro 2.0",
    slug: "giay-pickleball-skechers-viper-court-pro",
    brand: { _id: "b-skechers", name: "Skechers", slug: "skechers" },
    category: { _id: "cat-shoes", name: "Giày", slug: "giay-pickleball" },
    sellingPrice: 2_950_000,
    compareAtPrice: 3_350_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg", alt: "Skechers Viper Court Pro", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1794324042687-600x600.jpg", alt: "Skechers Viper Court Pro - Đế Goodyear", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 22,
    isFeatured: true,
    isNew: false,
    hasGift: false,
    ratingAvg: 4.9,
    ratingCount: 25,
    colors: [
      { color: "White Forest", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/snapedit_1793891010517-600x600.jpg" },
    ],
    shortDescription: "Giày chuyên dụng thiết kế riêng cho Pickleball với đế cao su Goodyear và lót Arch Fit.",
    descriptionHtml: "<p>Đế Goodyear Gold Compound giúp dừng đột ngột và đổi hướng ngang cực kỳ an toàn.</p>",
    specs: [{ label: "Đế ngoài", value: "Goodyear Gold Performance Rubber" }],
    variants: [],
  },

  // RAIL 4: TÚI - BALO
  {
    _id: "prod-balo-joola-vision",
    code: "JL-BAG-VIS2",
    name: "Balo Đựng Vợt Pickleball Joola Vision II Deluxe",
    slug: "balo-pickleball-joola-vision-ii",
    brand: { _id: "b-joola", name: "Joola", slug: "joola" },
    category: { _id: "cat-bags", name: "Túi - Balo", slug: "balo-tui-pickleball" },
    sellingPrice: 1_850_000,
    compareAtPrice: 2_100_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png", alt: "Balo Joola Vision II", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/03/Perseus-Pro-V-Ben-Johns-Blaze-Red-16mm-247x247.jpg", alt: "Balo Joola Vision II - Ngăn đựng vợt", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 19,
    isFeatured: true,
    isNew: true,
    hasGift: false,
    ratingAvg: 4.9,
    ratingCount: 21,
    colors: [
      { color: "Forest Green", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png" },
    ],
    shortDescription: "Sức chứa 4 cây vợt Pickleball, ngăn đựng giày thoáng khí riêng và móc treo hàng rào sân.",
    descriptionHtml: "<p>Balo Joola Vision II chống thấm nước, bảo vệ vợt khỏi nhiệt độ cao.</p>",
    specs: [{ label: "Sức chứa", value: "4 vợt + 1 đôi giày + quần áo & bóng" }],
    variants: [],
  },
  {
    _id: "prod-tui-selkirk-tour",
    code: "SK-BAG-TOUR",
    name: "Túi Đựng Vợt Selkirk Core Line Team Tour Bag",
    slug: "tui-pickleball-selkirk-team-tour",
    brand: { _id: "b-selkirk", name: "Selkirk", slug: "selkirk" },
    category: { _id: "cat-bags", name: "Túi - Balo", slug: "balo-tui-pickleball" },
    sellingPrice: 2_250_000,
    compareAtPrice: 2_500_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png", alt: "Túi Selkirk Team Tour", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/08/selkirk-boomstik-calypso-pickleball-paddle-mipik-vn-247x247.jpg", alt: "Túi Selkirk Team Tour - Sức chứa vợt", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 11,
    isFeatured: false,
    isNew: false,
    hasGift: false,
    ratingAvg: 4.8,
    ratingCount: 14,
    colors: [{ color: "Crimson Red", colorHexes: ["#B80411"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/11/48b961b5-9a6c-4279-8964-e869554148ae-1-600x600.png" }],
    shortDescription: "Túi thi đấu chuyên nghiệp vỏ Polyfiber bền bỉ, ngăn cách nhiệt bảo vệ lõi vợt.",
    descriptionHtml: "<p>Thiết kế chuẩn VĐV chuyên nghiệp của đội Selkirk Pro Team.</p>",
    specs: [{ label: "Chất liệu", value: "+V11 Max Polyfiber" }],
    variants: [],
  },

  // RAIL 5: PHỤ KIỆN & BÓNG
  {
    _id: "prod-bong-franklin-x40",
    code: "FK-X40-12",
    name: "Hộp 12 Quả Bóng Pickleball Franklin X-40 Outdoor USAPA",
    slug: "bong-pickleball-franklin-x40-hop-12",
    brand: { _id: "b-franklin", name: "Franklin", slug: "franklin" },
    category: { _id: "cat-accessories", name: "Phụ kiện", slug: "phu-kien-pickleball" },
    sellingPrice: 780_000,
    compareAtPrice: 890_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg", alt: "Bóng Franklin X-40", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg", alt: "Bóng Franklin X-40 - Hộp 12 quả", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 80,
    isFeatured: true,
    isNew: false,
    hasGift: false,
    ratingAvg: 5.0,
    ratingCount: 94,
    colors: [{ color: "Optic Yellow", colorHexes: ["#FFCD00"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg" }],
    shortDescription: "Bóng thi đấu ngoài trời 40 lỗ chính thức của giải US Open Pickleball.",
    descriptionHtml: "<p>Đúc nguyên khối không mối nối, bay chuẩn xác và chống nứt vỡ.</p>",
    specs: [{ label: "Số lỗ", value: "40 lỗ khoan chính xác (26g)" }],
    variants: [],
  },
  {
    _id: "prod-quan-can-pikpro",
    code: "11S-GRIP-03",
    name: "Bộ 3 Cuộn Quấn Cán & Băng Dán Viền Vợt Pickleball 11Sport",
    slug: "bo-quan-can-dan-vien-vot-pickleball",
    brand: { _id: "b-joola", name: "Joola", slug: "joola" },
    category: { _id: "cat-accessories", name: "Phụ kiện", slug: "phu-kien-pickleball" },
    sellingPrice: 150_000,
    compareAtPrice: 210_000,
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg",
    images: [
      { url: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg", alt: "Quấn cán và dán viền vợt", isPrimary: true },
      { url: "https://mipik.vn/wp-content/uploads/2026/05/wika-247x247.jpg", alt: "Bộ 3 cuộn quấn cán 11Sport", isPrimary: false },
    ],
    inStock: true,
    stockAvailable: 120,
    isFeatured: true,
    isNew: false,
    hasGift: false,
    ratingAvg: 4.9,
    ratingCount: 47,
    colors: [{ color: "Forest & White", colorHexes: ["#224E40"], imageUrl: "https://mipik.vn/wp-content/uploads/2026/05/sypik-247x247.jpg" }],
    shortDescription: "Thấm hút mồ hôi tay cực tốt, bảo vệ viền vợt khỏi trầy xước khi cứu bóng sát mặt sân.",
    descriptionHtml: "<p>Phụ kiện thiết yếu cho mọi người chơi Pickleball.</p>",
    specs: [{ label: "Độ dày quấn cán", value: "0.6 mm Tacky Feel" }],
    variants: [],
  },
];

export const MOCK_ARTICLE_CATEGORIES = [
  {
    name: "Kiến thức Pickleball",
    slug: "kien-thuc-pickleball",
    description: "Luật chơi, cách tính điểm, kỹ thuật dink, drop shot và kích thước sân chuẩn USAPA.",
  },
  {
    name: "Review & Đánh giá",
    slug: "review-danh-gia",
    description: "Đánh giá thực chiến các dòng vợt Joola, Selkirk, Kamito, Facolos, CRBN mới nhất.",
  },
  {
    name: "Tư vấn dụng cụ Pickleball",
    slug: "tu-van-dung-cu-pickleball",
    description: "Hướng dẫn chọn độ dày lõi 14mm vs 16mm, chọn giày và phụ kiện theo trình độ.",
  },
  {
    name: "Tin tức & Cộng đồng",
    slug: "tin-tuc-cong-dong",
    description: "Tin tức giải đấu PPA Tour, cộng đồng CLB và sự kiện hệ thống showroom.",
  },
];

export const MOCK_ARTICLES: ArticleDetail[] = [
  {
    _id: "art-luat-choi",
    title: "Luật chơi Pickleball & Cách tính điểm chuẩn USAPA cho người mới",
    slug: "luat-choi-pickleball",
    excerpt:
      "Tổng hợp đầy đủ quy tắc giao bóng chéo sân, luật nảy 2 lần (Two-Bounce Rule), vùng Non-Volley Zone (Kitchen) và cách đọc điểm đánh đôi.",
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/dac-diem-noi-bat-cua-vot-pickleball-joola-gen-5-600x398.jpeg",
    publishedAt: "2026-11-20T08:00:00.000Z",
    updatedAt: "2026-11-22T08:00:00.000Z",
    authorName: "Ban Chuyên Môn 11Sport",
    category: { name: "Kiến thức Pickleball", slug: "kien-thuc-pickleball" },
    contentHtml: `
      <h2>1. Quy tắc giao bóng chéo sân dưới thắt lưng</h2>
      <p>Trong môn Pickleball, cú giao bóng bắt buộc đánh từ dưới lên (underhand), mặt vợt tiếp xúc bóng dưới thắt lưng và đưa bóng qua ô chéo sân đối diện (vượt qua vạch Kitchen).</p>
      <h2>2. Luật Bóng Nảy 2 Lần (Two-Bounce Rule)</h2>
      <p>Sau khi giao bóng, đội đỡ phải để bóng nảy 1 lần mới được đánh trả; đội giao bóng cũng phải để bóng nảy thêm 1 lần nữa mới được bắt đầu Volley trên không.</p>
      <h2>3. Vùng Bếp (Non-Volley Zone / Kitchen 2.13m)</h2>
      <p>Người chơi không được đứng trong vùng Kitchen (kể cả dẫm vạch) để đánh bóng trên không (Volley), và đà quán tính sau cú Volley cũng không được chạm vào vùng Kitchen.</p>
      <h2>4. Cách đọc 3 con số điểm trong đánh đôi</h2>
      <p>Điểm số trong đánh đôi luôn gồm 3 số: <strong>Điểm đội giao bóng - Điểm đội đỡ giao bóng - Lượt người giao (1 hoặc 2)</strong>. Ví dụ: <code>4 - 2 - 1</code>. Trận đấu thông thường kết thúc ở điểm 11 (cách 2 điểm).</p>
    `,
    relatedProducts: MOCK_PRODUCTS.slice(0, 3),
  },
  {
    _id: "art-chon-vot-nguoi-moi",
    title: "Hướng dẫn chọn vợt Pickleball cho người mới chơi: 14mm hay 16mm?",
    slug: "vot-pickleball-cho-nguoi-moi",
    excerpt:
      "Phân tích sự khác biệt giữa lõi 14mm (Power) và 16mm (Control), trọng lượng vợt lý tưởng và top 5 mẫu vợt dễ làm quen nhất 2026.",
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/cach-kiem-tra-vot-pickleball-facolos-chinh-hang-03-600x399.jpeg",
    publishedAt: "2026-11-18T08:00:00.000Z",
    updatedAt: "2026-11-21T08:00:00.000Z",
    authorName: "Ban Chuyên Môn 11Sport",
    category: { name: "Tư vấn dụng cụ Pickleball", slug: "tu-van-dung-cu-pickleball" },
    contentHtml: `
      <h2>1. Độ dày lõi vợt 16mm (Control) vs 14mm (Power)</h2>
      <p>Người mới chuyển từ cầu lông hoặc tennis sang nên ưu tiên <strong>lõi 16mm</strong> vì khả năng hấp thụ lực tốt, dễ thực hiện các cú Dink và Third-Shot Drop ổn định vào vùng Kitchen.</p>
      <h2>2. Trọng lượng và chiều dài cán vợt phù hợp</h2>
      <p>Trọng lượng từ <strong>7.8 oz – 8.1 oz (220g – 230g)</strong> giúp linh hoạt trên lưới mà không gây mỏi cổ tay. Nếu quen đánh trái tay 2 tay (Two-handed Backhand), hãy chọn cán dài <strong>5.5 inch</strong>.</p>
    `,
    relatedProducts: MOCK_PRODUCTS.slice(0, 3),
  },
  {
    _id: "art-review-selkirk-boomstik",
    title: "Review Vợt Pickleball Selkirk Labs Boomstik ST & Joola Perseus Power FX",
    slug: "review-vot-pickleball-selkirk-boomstik-st",
    excerpt:
      "So sánh thực chiến 2 siêu vợt cao cấp nhất hiện nay về tốc độ vung, độ nhám tạo xoáy RPM và độ êm khi phòng thủ.",
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/dac-diem-noi-bat-cua-vot-pickleball-joola-gen-5-600x398.jpeg",
    publishedAt: "2026-11-16T08:00:00.000Z",
    updatedAt: "2026-11-20T08:00:00.000Z",
    authorName: "HLV Minh Quân",
    category: { name: "Review & Đánh giá", slug: "review-danh-gia" },
    contentHtml: `
      <h2>1. Cảm giác chạm bóng và tốc độ đầu vợt</h2>
      <p>Selkirk Boomstik ST nổi bật với họng vợt rỗng Air Dynamic Throat giúp tốc độ phản xạ Volley trên lưới cực nhanh, trong khi Joola Perseus Power FX cho cảm giác đầm chắc và lực bật (Pop) vượt trội từ cuối sân.</p>
      <h2>2. Nên chọn cây vợt nào cho lối đánh của bạn?</h2>
      <p>Nếu bạn thiên về tốc độ đấu tay đôi trên lưới và độ bền mặt vợt lâu dài, hãy chọn Selkirk Boomstik. Nếu bạn yêu thích những cú Drive xoáy cuộn và Backhand 2 tay uy lực, Joola Perseus Power FX 16mm là lựa chọn số 1.</p>
    `,
    relatedProducts: MOCK_PRODUCTS.slice(0, 2),
  },
  {
    _id: "art-khai-truong-showroom",
    title: "Trải nghiệm khu thử vợt Pickleball chuẩn quốc tế tại 3 chi nhánh 11Sport TP.HCM & Hà Nội",
    slug: "cach-chon-vot-pickleball-joola",
    excerpt:
      "Hệ thống 3 showroom Quận 10, Phú Nhuận và Ngọc Hà (Hà Nội) trang bị đầy đủ vợt demo Joola, Selkirk, Kamito và máy đo trọng lượng vung.",
    thumbnailUrl: "https://mipik.vn/wp-content/uploads/2026/08/mipik-khai-truong-cua-hang-pickleball-tai-tphcm-san-sang-don-tiep-khach-hang-600x399.jpg",
    publishedAt: "2026-11-12T08:00:00.000Z",
    updatedAt: "2026-11-19T08:00:00.000Z",
    authorName: "Ban Biên Tập 11Sport",
    category: { name: "Tin tức & Cộng đồng", slug: "tin-tuc-cong-dong" },
    contentHtml: `
      <h2>1. Thử vợt thực tế &amp; Quét NFC chính hãng tại quầy</h2>
      <p>Khách hàng ghé thăm showroom 11Sport được trực tiếp cầm thử các dòng vợt 14mm và 16mm, kiểm tra chip NFC chính hãng và nhận tư vấn độ dày quấn cán phù hợp kích thước bàn tay.</p>
    `,
    relatedProducts: MOCK_PRODUCTS.slice(0, 3),
  },
];

export const MOCK_POLICY_PAGES: MockPolicyPage[] = [
  {
    _id: "pol-shipping",
    slug: "chinh-sach-van-chuyen",
    title: "Chính sách vận chuyển và giao nhận",
    summary:
      "Miễn phí vận chuyển toàn quốc, giao hỏa tốc 2 giờ tại TP.HCM & Hà Nội, hỗ trợ đồng kiểm hàng chính hãng trước khi thanh toán.",
    updatedAt: "2026-11-15",
    sections: [
      {
        heading: "1. Đối với khách hàng mua trực tiếp tại 3 chi nhánh",
        paragraphs: [
          "Khách hàng mua tại Quận 10, Phú Nhuận (TP.HCM) và Ngọc Hà (Hà Nội) được kiểm tra tem NFC/QR chính hãng, cân trọng lượng thực tế từng cây vợt và nhận đầy đủ bộ quà tặng (quấn cán, dán viền, bao vợt) tại quầy.",
        ],
      },
      {
        heading: "2. Đối với khách hàng mua online trên Website",
        paragraphs: [
          "Miễn phí vận chuyển toàn quốc cho mọi đơn hàng. Giao hỏa tốc 2–4 giờ tại nội thành TP.HCM & Hà Nội; giao chuyển phát nhanh 1–3 ngày làm việc đối với các tỉnh thành khác.",
        ],
      },
      {
        heading: "3. Đối với khách hàng mua sỉ / CLB (Giá Mua Nhiều)",
        paragraphs: [
          "Khi đặt từ 3 hoặc 5 sản phẩm cùng biến thể, hệ thống tự động áp dụng mức Giá Mua Nhiều và mở khóa quà tặng 1 áo (mốc 5+ SP) hoặc 2 áo + 1 túi (mốc 10+ SP).",
        ],
      },
    ],
    callout:
      "Mọi kiện hàng đều cho phép mở hộp đồng kiểm ngoại quan và quét tem NFC chính hãng trước khi thanh toán COD cho bưu tá.",
  },
  {
    _id: "pol-return",
    slug: "hoan-tien_tra-ve",
    title: "Chính sách đổi mới sản phẩm & Hoàn tiền",
    summary:
      "Cam kết lỗi là đổi mới 1 đổi 1 theo đúng tiêu chuẩn bảo hành chính hãng từ nhà sản xuất.",
    updatedAt: "2026-11-15",
    sections: [
      {
        heading: "1. Các trường hợp được đổi mới / trả hàng",
        paragraphs: [
          "Sản phẩm gặp lỗi kỹ thuật từ nhà sản xuất (sập lõi tổ ong/EPP, bong mặt carbon bất thường, lỗi chip NFC) hoặc sản phẩm giao không đúng mẫu mã / độ dày lõi đã đặt.",
        ],
      },
      {
        heading: "2. Quy trình đổi hàng nhanh trong 24 giờ",
        paragraphs: [
          "Khách hàng gửi video/hình ảnh qua Zalo chi nhánh hoặc mang trực tiếp đến showroom. Kỹ thuật viên kiểm tra và đổi ngay sản phẩm mới 100%, miễn phí vận chuyển 2 chiều.",
        ],
      },
    ],
    callout:
      "Hoàn tiền 200% giá trị đơn hàng nếu phát hiện bất kỳ sản phẩm nào không phải hàng chính hãng.",
  },
  {
    _id: "pol-privacy",
    slug: "chinh-sach-bao-mat",
    title: "Chính sách bảo mật thông tin khách hàng",
    summary:
      "Bảo mật tuyệt đối thông tin cá nhân, số điện thoại, địa chỉ giao nhận và lịch sử bảo hành điện tử.",
    updatedAt: "2026-11-15",
    sections: [
      {
        heading: "1. Mục đích thu thập thông tin",
        paragraphs: [
          "Họ tên, Số điện thoại, Email và Địa chỉ chỉ được sử dụng để giao đơn hàng, kích hoạt bảo hành điện tử chính hãng và hỗ trợ tư vấn kỹ thuật.",
        ],
      },
      {
        heading: "2. Cam kết không chia sẻ cho bên thứ ba",
        paragraphs: [
          "Hệ thống tuyệt đối không bán hoặc chia sẻ thông tin khách hàng cho bất kỳ bên thứ ba nào ngoài đơn vị vận chuyển thực hiện giao đơn hàng đó.",
        ],
      },
    ],
    callout:
      "Khách hàng có thể tự cập nhật hoặc yêu cầu xóa thông tin cá nhân bất cứ lúc nào tại trang Tài khoản.",
  },
  {
    _id: "pol-terms",
    slug: "quy-dinh-su-dung",
    title: "Quy định sử dụng Website",
    summary:
      "Quy định về niêm yết giá bán lẻ, giá mua nhiều theo biến thể, quà tặng kèm theo và quyền lợi thành viên.",
    updatedAt: "2026-11-15",
    sections: [
      {
        heading: "1. Quy định áp dụng Giá Mua Nhiều & Quà Tặng Kèm Theo",
        paragraphs: [
          "Giá Mua Nhiều (từ 3 hoặc 5 sản phẩm) được tính trên số lượng sản phẩm cùng một biến thể (cùng mẫu và độ dày lõi). Quà tặng kèm theo (5+ hoặc 10+ sản phẩm) tính trên tổng số lượng giỏ hàng và áp dụng mốc cao nhất đạt được (không cộng dồn).",
        ],
      },
    ],
    callout:
      "Toàn bộ mức giảm giá sỉ và quà tặng đều được tính toán tự động và hiển thị minh bạch tại Giỏ hàng và trang Thanh toán.",
  },
];

export const MOCK_PROGRAM_PAGES: MockProgramPage[] = [
  {
    _id: "prog-about",
    slug: "ve-chung-toi",
    title: "VỀ CHÚNG TÔI · HỆ THỐNG PICKLEBALL CHÍNH HÃNG",
    subtitle:
      "Hồ sơ năng lực, Tầm nhìn - Sứ mệnh - Mục tiêu và 4 lĩnh vực cung cấp trang thiết bị Pickleball chuẩn thi đấu quốc tế tại TP.HCM & Hà Nội.",
    variant: "vision-card",
    cards: [
      {
        badge: "TẦM NHÌN",
        title: "Hệ thống bán lẻ & tư vấn Pickleball chuẩn mực",
        description:
          "Kiến tạo hệ sinh thái trang thiết bị Pickleball chuyên nghiệp với 3 showroom tiêu chuẩn tại Quận 10, Phú Nhuận và Hà Nội.",
      },
      {
        badge: "SỨ MỆNH",
        title: "100% Sản phẩm chính hãng có chứng nhận đại lý",
        description:
          "Phân phối trực tiếp từ hơn 20 thương hiệu quốc tế và Việt Nam: Joola, Selkirk, Kamito, Facolos, CRBN, Asics, Skechers.",
      },
      {
        badge: "MỤC TIÊU",
        title: "Bảo hành 1 đổi 1 & Đồng hành cùng cộng đồng CLB",
        description:
          "Mang đến chính sách giá mua nhiều minh bạch, quà tặng thiết thực và dịch vụ hậu mãi lỗi 1 đổi 1 nhanh chóng.",
      },
    ],
    callout:
      "Ghé thăm 3 chi nhánh showroom để trải nghiệm trực tiếp hơn 200 mẫu vợt, giày và phụ kiện Pickleball chính hãng.",
  },
  {
    _id: "prog-trade-in",
    slug: "thu-cu-doi-moi",
    title: "THU CŨ ĐỔI MỚI · VỢT CŨ CÒN GIÁ TRỊ, LÊN ĐỜI VỢT MỚI",
    subtitle:
      "Chương trình hỗ trợ thu lại vợt Pickleball chính hãng đã qua sử dụng để nâng cấp lên các dòng Joola Gen 3S, Selkirk Labs Boomstik, CRBN mới nhất.",
    variant: "trade-in-step",
    cards: [
      {
        badge: "BƯỚC 1",
        title: "Kiểm tra & Định giá vợt cũ minh bạch trong 15 phút",
        description:
          "Mang vợt cũ đến 3 showroom hoặc gửi ảnh/video qua Zalo. Kỹ thuật viên kiểm tra mặt carbon, viền và lõi vợt để báo mức thu lại tối ưu.",
      },
      {
        badge: "BƯỚC 2",
        title: "Chọn vợt mới & Cầm thử cảm giác tay tại quầy",
        description:
          "Trải nghiệm và so sánh trực tiếp độ dày lõi 14mm (Power) và 16mm (Control) phù hợp với kỹ thuật của bạn.",
      },
      {
        badge: "BƯỚC 3",
        title: "Bù chênh lệch & Nhận full bộ quà tặng vợt mới",
        description:
          "Trừ trực tiếp giá trị vợt cũ vào đơn vợt mới, vẫn nhận đủ quấn cán, dán viền, bao vợt và chế độ bảo hành chính hãng 100%.",
      },
    ],
    callout:
      "Chương trình áp dụng cho mọi dòng vợt Pickleball chính hãng (có tem NFC/serial xác thực) không bị gãy sập lõi cấu trúc.",
  },
];

export const MOCK_CUSTOMER_PROFILE: CustomerProfile = {
  _id: "cust-demo-01",
  name: "Nguyễn Minh Quân",
  phone: "0909123456",
  email: "minhquan.pickleball@gmail.com",
  addresses: [
    {
      id: "addr-1",
      label: "Nhà riêng",
      fullName: "Nguyễn Minh Quân",
      phone: "0909123456",
      province: "TP. Hồ Chí Minh",
      district: "Quận 10",
      ward: "Phường 12",
      addressLine: "95 Trần Thiện Chánh",
      isDefault: true,
    },
  ],
};

export const MOCK_CUSTOMER_ORDERS: CustomerOrderSummary[] = [
  {
    _id: "ord-26018",
    orderCode: "ONL-20261120-0188",
    createdAt: "2026-11-22T09:30:00.000Z",
    totalAmount: 24_500_000,
    paymentGateway: "COD",
    paymentStatus: "PAID",
    fulfillmentStatus: "DELIVERED",
    itemsCount: 5,
  },
  {
    _id: "ord-26012",
    orderCode: "ONL-20261115-0092",
    createdAt: "2026-11-15T14:20:00.000Z",
    totalAmount: 5_100_000,
    paymentGateway: "VIETQR",
    paymentStatus: "PAID",
    fulfillmentStatus: "SHIPPING",
    itemsCount: 1,
  },
];

export const MOCK_HOME_DATA: HomeDataResponse = {
  banners: [
    {
      _id: "banner-1",
      title: "11SPORT PICKLEBALL · VỢT CHÍNH HÃNG & ƯU ĐÃI GIÁ SỈ TỪ 3 CÂY",
      position: "HERO",
      desktopImageUrl: "/mock/hero-11sport-desktop-1.jpg",
      mobileImageUrl: "/mock/hero-11sport-desktop-1.jpg",
      linkUrl: "/vot-pickleball",
      altText: "11Sport Pickleball — Vợt chính hãng Joola, Selkirk, Facolos, CRBN",
      sortOrder: 1,
    },
    {
      _id: "banner-2",
      title: "THU CŨ ĐỔI MỚI · NÂNG CẤP VỢT PRO TẠI 11SPORT",
      position: "HERO",
      desktopImageUrl: "/mock/hero-11sport-desktop-2.jpg",
      mobileImageUrl: "/mock/hero-11sport-desktop-2.jpg",
      linkUrl: "/thu-cu-doi-moi",
      altText: "11Sport Thu cũ đổi mới — 3 Showroom TP.HCM & Hà Nội · Bảo hành 1 đổi 1",
      sortOrder: 2,
    },
  ],
  homeSections: [
    { _id: "sec-hero", type: "HERO", sortOrder: 1 },
    { _id: "sec-rail-1", type: "CATEGORY_GRID", title: "VỢT PICKLEBALL", viewAllUrl: "/vot-pickleball", sortOrder: 2 },
    { _id: "sec-rail-2", type: "CATEGORY_CAROUSEL", title: "THỜI TRANG 11SPORT", viewAllUrl: "/danh-muc-san-pham/thoi-trang", sortOrder: 3 },
    { _id: "sec-rail-3", type: "CATEGORY_CAROUSEL", title: "GIÀY", viewAllUrl: "/giay-pickleball", sortOrder: 4 },
    { _id: "sec-rail-4", type: "CATEGORY_CAROUSEL", title: "TÚI - BALO", viewAllUrl: "/balo-tui-pickleball", sortOrder: 5 },
    { _id: "sec-rail-5", type: "CATEGORY_CAROUSEL", title: "PHỤ KIỆN", viewAllUrl: "/phu-kien-pickleball", sortOrder: 6 },
    { _id: "sec-usp", type: "USP", sortOrder: 7 },
    { _id: "sec-brands", type: "BRANDS", title: "THƯƠNG HIỆU PHÂN PHỐI CHÍNH HÃNG", sortOrder: 8 },
    { _id: "sec-blog", type: "BLOG", title: "TIN TỨC & KIẾN THỨC PICKLEBALL", sortOrder: 9 },
  ],
  flashSale: null,
  featuredProducts: MOCK_PRODUCTS,
  categoryBlocks: [
    {
      category: MOCK_CATEGORIES[0]!,
      products: MOCK_PRODUCTS.filter((p) => p.category?.slug === "vot-pickleball"),
    },
    {
      category: MOCK_CATEGORIES[1]!,
      products: MOCK_PRODUCTS.filter((p) => p.category?.slug === "thoi-trang"),
    },
    {
      category: MOCK_CATEGORIES[2]!,
      products: MOCK_PRODUCTS.filter((p) => p.category?.slug === "giay-pickleball"),
    },
    {
      category: MOCK_CATEGORIES[3]!,
      products: MOCK_PRODUCTS.filter((p) => p.category?.slug === "balo-tui-pickleball"),
    },
    {
      category: MOCK_CATEGORIES[4]!,
      products: MOCK_PRODUCTS.filter((p) => p.category?.slug === "phu-kien-pickleball"),
    },
  ],
  brands: MOCK_BRANDS,
  articles: MOCK_ARTICLES,
  usp: MOCK_USP_ITEMS,
};

export const MOCK_REVIEWS: ReviewListResponse = {
  data: [
    {
      _id: "rev-1",
      customerName: "Anh Hoàng Bách (Quận 10)",
      rating: 5,
      comment:
        "Vợt chính hãng quét NFC lên ngay trang chủ hãng. Mua 3 cây cùng anh em CLB được giảm thẳng giá sỉ và tặng đủ quấn cán, dán viền, bao vợt.",
      isVerifiedPurchase: true,
      createdAt: "2026-11-20T10:00:00.000Z",
    },
    {
      _id: "rev-2",
      customerName: "Chị Thanh Tâm (Phú Nhuận)",
      rating: 5,
      comment:
        "Lõi 16mm đánh cực êm và kiểm soát bóng trên vùng Kitchen rất chuẩn. Nhân viên showroom tư vấn nhiệt tình.",
      isVerifiedPurchase: true,
      createdAt: "2026-11-18T15:30:00.000Z",
    },
  ],
  summary: {
    ratingAvg: 4.9,
    ratingCount: 48,
    breakdown: { "5": 45, "4": 3, "3": 0, "2": 0, "1": 0 },
  },
  meta: {
    total: 2,
    page: 1,
    limit: 10,
  },
};

export function buildStaticPageFromPolicyOrProgram(
  slug: string
): StaticPageDetail | null {
  const pol = MOCK_POLICY_PAGES.find((p) => p.slug === slug);
  if (pol) {
    const html = pol.sections
      .map(
        (s) =>
          `<h2>${s.heading}</h2>${s.paragraphs.map((p) => `<p>${p}</p>`).join("")}`
      )
      .join("");
    return {
      _id: pol._id,
      slug: pol.slug,
      title: pol.title,
      contentHtml: html,
      updatedAt: pol.updatedAt,
      seo: {
        title: pol.title,
        description: pol.summary,
      },
    };
  }
  const prog = MOCK_PROGRAM_PAGES.find((p) => p.slug === slug);
  if (prog) {
    const html = prog.cards
      .map((c) => `<h2>${c.badge} · ${c.title}</h2><p>${c.description}</p>`)
      .join("");
    return {
      _id: prog._id,
      slug: prog.slug,
      title: prog.title,
      contentHtml: html,
      seo: {
        title: prog.title,
        description: prog.subtitle,
      },
    };
  }
  return null;
}

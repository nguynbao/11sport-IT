import type { LocaleCode } from "@/lib/format";

export function getLocaleFromPath(pathname: string): LocaleCode {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "vi";
}

export function localizeHref(href: string, locale: LocaleCode): string {
  if (!href || !href.startsWith("/") || locale === "vi") return href;
  if (href === "/en" || href.startsWith("/en/")) return href;
  if (href === "/") return "/en";

  const enExact: Record<string, string> = {
    "/lien-he": "/en/contact",
    "/gio-hang": "/en/cart",
    "/thanh-toan": "/en/checkout",
    "/checkout": "/en/checkout",
    "/cua-hang": "/en/shop",
    "/tai-khoan": "/en/my-account",
    "/tai-khoan/lost-password": "/en/my-account/lost-password",
    "/tin-tuc": "/en/category/blogs",
    "/tin-tuc/kien-thuc-pickleball": "/en/category/blogs/technique",
  };

  if (enExact[href]) return enExact[href]!;
  if (href.startsWith("/thuong-hieu/")) {
    return href.replace("/thuong-hieu/", "/en/brand/");
  }
  return `/en${href}`;
}

export const STORE_I18N = {
  vi: {
    nav: {
      paddles: "Vợt Pickleball",
      fashion: "Thời trang 11Sport",
      shoes: "Giày",
      bags: "Balo",
      accessories: "Phụ kiện",
      blog: "Tin tức",
      contact: "Liên hệ",
      megaPaddlePrefix: "Vợt Pickleball",
      subCombo: "Combo Thời trang",
      subShirt: "Áo Pickleball",
      subCap: "Nón Pickleball",
      subBag: "Túi Thời trang",
      subSock: "Tất Pickleball",
      subShoesAsics: "Giày Asics",
      subShoesSkechers: "Giày Skechers",
      subShoesOn: "Giày ON",
      subShoesKaitashi: "Giày Kaitashi",
      subBlogReview: "Review & Đánh giá",
      subBlogKnowledge: "Kiến thức Pickleball",
      subBlogAdvice: "Tư vấn dụng cụ Pickleball",
      subBlogCommunity: "Tin tức & Cộng đồng",
      searchPlaceholder: "Tìm kiếm...",
      allResultsPrefix: "Xem tất cả kết quả cho",
      accountAndOrders: "Tài khoản & Đơn hàng",
    },
    home: {
      paddles: "VỢT PICKLEBALL",
      fashion: "THỜI TRANG 11SPORT",
      shoes: "GIÀY",
      bags: "TÚI - BALO",
      accessories: "PHỤ KIỆN",
      brands: "THƯƠNG HIỆU PHÂN PHỐI CHÍNH HÃNG",
      guarantees: [
        "Tặng quấn cán, dán viền, bao vợt",
        "Bảo hành chính hãng",
        "100% hàng chính hãng",
        "Miễn phí vận chuyển",
      ],
    },
    product: {
      addToCart: "THÊM VÀO GIỎ HÀNG",
      selectOption: "CHỌN",
      outOfStock: "Tạm hết hàng",
      newBadge: "Mới",
      freeGiftBadge: "TẶNG ÁO",
    },
    footer: {
      productsHeading: "SẢN PHẨM",
      infoHeading: "THÔNG TIN",
      blogHeading: "BLOG",
      products: [
        { label: "Vợt Pickleball", href: "/vot-pickleball" },
        { label: "Balo Pickleball", href: "/balo-tui-pickleball" },
        { label: "Giày Pickleball", href: "/giay-pickleball" },
        { label: "Bóng Pickleball", href: "/bong-pickleball" },
        { label: "Phụ kiện Pickleball", href: "/phu-kien-pickleball" },
        { label: "Thời trang 11Sport", href: "/danh-muc-san-pham/thoi-trang" },
      ],
      info: [
        { label: "Chính sách vận chuyển", href: "/chinh-sach-van-chuyen" },
        { label: "Chính sách đổi mới sản phẩm", href: "/hoan-tien_tra-ve" },
        { label: "Chính sách bảo mật", href: "/chinh-sach-bao-mat" },
        { label: "Quy định sử dụng", href: "/quy-dinh-su-dung" },
        { label: "Thu cũ đổi mới", href: "/thu-cu-doi-moi" },
        { label: "Về 11Sport", href: "/ve-chung-toi" },
        { label: "Tài khoản", href: "/tai-khoan" },
        { label: "Blog", href: "/tin-tuc" },
      ],
      blog: [
        { label: "Kiến thức Pickleball", href: "/tin-tuc/kien-thuc-pickleball" },
        { label: "Review & Đánh giá", href: "/tin-tuc/review-danh-gia" },
        { label: "Tin tức & Cộng đồng", href: "/tin-tuc/tin-tuc-cong-dong" },
        {
          label: "Tư vấn dụng cụ Pickleball",
          href: "/tin-tuc/tu-van-dung-cu-pickleball",
        },
      ],
    },
  },
  en: {
    nav: {
      paddles: "Paddles",
      fashion: "11Sport Sportwear",
      shoes: "Shoes",
      bags: "Bags",
      accessories: "Gear",
      blog: "Blogs",
      contact: "Contact",
      megaPaddlePrefix: "Paddle",
      subCombo: "Sportwear Combo",
      subShirt: "11Sport Shirts",
      subCap: "Pickleball Caps",
      subBag: "Tote & Sport Bags",
      subSock: "Performance Socks",
      subShoesAsics: "Asics Shoes",
      subShoesSkechers: "Skechers Shoes",
      subShoesOn: "ON Running Shoes",
      subShoesKaitashi: "Kaitashi Shoes",
      subBlogReview: "Product Reviews",
      subBlogKnowledge: "Pickleball Techniques",
      subBlogAdvice: "Equipment Buying Guide",
      subBlogCommunity: "News & Community",
      searchPlaceholder: "Search...",
      allResultsPrefix: "View all results for",
      accountAndOrders: "My Account & Orders",
    },
    home: {
      paddles: "PICKLEBALL PADDLE",
      fashion: "11SPORT EXCLUSIVE COLLECTION",
      shoes: "SHOES",
      bags: "BAGS & BACKPACKS",
      accessories: "GEAR",
      brands: "OFFICIAL AUTHORIZED BRANDS",
      guarantees: [
        "Free Grip, Edge Tape & Cover",
        "Official Warranty",
        "100% Authentic Products",
        "Free Nationwide Shipping",
      ],
    },
    product: {
      addToCart: "ADD TO CART",
      selectOption: "SELECT",
      outOfStock: "Out of stock",
      newBadge: "New",
      freeGiftBadge: "FREE SHIRT",
    },
    footer: {
      productsHeading: "PRODUCTS",
      infoHeading: "INFORMATION",
      blogHeading: "BLOGS",
      products: [
        { label: "Pickleball Paddles", href: "/vot-pickleball" },
        { label: "Pickleball Bags", href: "/balo-tui-pickleball" },
        { label: "Pickleball Shoes", href: "/giay-pickleball" },
        { label: "Pickleball Balls", href: "/bong-pickleball" },
        { label: "Pickleball Gear", href: "/phu-kien-pickleball" },
        { label: "11Sport Sportwear", href: "/danh-muc-san-pham/thoi-trang" },
      ],
      info: [
        { label: "Shipping Policy", href: "/chinh-sach-van-chuyen" },
        { label: "Warranty & Returns", href: "/hoan-tien_tra-ve" },
        { label: "Privacy Policy", href: "/chinh-sach-bao-mat" },
        { label: "Terms of Use", href: "/quy-dinh-su-dung" },
        { label: "Paddle Trade-In", href: "/thu-cu-doi-moi" },
        { label: "About 11Sport", href: "/ve-chung-toi" },
        { label: "My Account", href: "/tai-khoan" },
        { label: "Blogs", href: "/tin-tuc" },
      ],
      blog: [
        { label: "Pickleball Techniques", href: "/tin-tuc/kien-thuc-pickleball" },
        { label: "Product Reviews", href: "/tin-tuc/review-danh-gia" },
        { label: "News & Community", href: "/tin-tuc/tin-tuc-cong-dong" },
        {
          label: "Equipment Buying Guide",
          href: "/tin-tuc/tu-van-dung-cu-pickleball",
        },
      ],
    },
  },
} as const;

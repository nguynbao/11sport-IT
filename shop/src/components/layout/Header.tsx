"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import {
  formatPriceByCurrency,
  resolveMediaUrl,
  type CurrencyCode,
} from "@/lib/format";
import { getLocaleFromPath, localizeHref, STORE_I18N } from "@/lib/i18n";
import type { SiteSettingsData } from "@/lib/storefront";
import type {
  ArticleSummary,
  MenuNode,
  ProductListItem,
} from "@/types/storefront";

const BRANDS_A_K = [
  { label: "CRBN", href: "/vot-pickleball-crbn" },
  { label: "Facolos", href: "/vot-pickleball-facolos" },
  { label: "Franklin", href: "/vot-pickleball-franklin" },
  { label: "Gearbox", href: "/vot-pickleball-gearbox" },
  {
    label: "Honolulu",
    href: "/danh-muc-san-pham/vot-pickleball/vot-pickleball-honolulu",
  },
  { label: "Joola", href: "/vot-pickleball-joola" },
  { label: "Kaitashi", href: "/vot-pickleball-kaitashi" },
  { label: "Kaiwin", href: "/vot-pickleball-kaiwin" },
  { label: "Kamito", href: "/vot-pickleball-kamito" },
  { label: "KBS", href: "/vot-pickleball-kbs" },
];

const BRANDS_L_Z = [
  { label: "Loco", href: "/vot-pickleball-loco" },
  { label: "Luzz", href: "/vot-pickleball-luzz" },
  {
    label: "Proton",
    href: "/danh-muc-san-pham/vot-pickleball/vot-pickleball-proton",
  },
  { label: "RPM", href: "/vot-pickleball-rpm" },
  { label: "Selkirk", href: "/vot-pickleball-selkirk" },
  {
    label: "Six Zero",
    href: "/danh-muc-san-pham/vot-pickleball/vot-pickleball-six-zero",
  },
  { label: "Soxter", href: "/vot-pickleball-soxter" },
  { label: "Sypik", href: "/vot-pickleball-sypik" },
  {
    label: "Thunder",
    href: "/danh-muc-san-pham/vot-pickleball/vot-pickleball-thunder",
  },
  { label: "Vole", href: "/vot-pickleball-vole" },
  { label: "Wika", href: "/vot-pickleball-wika" },
  {
    label: "Zocker",
    href: "/danh-muc-san-pham/vot-pickleball/vot-pickleball-zocker",
  },
];

interface NavItem {
  label: string;
  href: string;
  isHighlightedMint?: boolean;
  isMegaBrands?: boolean;
  children?: Array<{ label: string; href: string }>;
}

function VietnamFlagSvg({
  sizeClass = "w-full h-full",
}: {
  sizeClass?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={`${sizeClass} block`} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#DA251D" />
      <polygon
        points="12,5.5 13.6,10.2 18.5,10.2 14.5,13.1 16.0,17.8 12,14.9 8.0,17.8 9.5,13.1 5.5,10.2 10.4,10.2"
        fill="#FFCD00"
      />
    </svg>
  );
}

function UsFlagSvg({ sizeClass = "w-full h-full" }: { sizeClass?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${sizeClass} block`} aria-hidden="true">
      <defs>
        <clipPath id="headerUsFlagCircle">
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#headerUsFlagCircle)">
        <rect width="24" height="24" fill="#FFFFFF" />
        <path
          d="M0 3.5h24v2H0zm0 4h24v2H0zm0 4h24v2H0zm0 4h24v2H0zm0 4h24v2H0z"
          fill="#B80411"
        />
        <rect width="12" height="12" fill="#1B4F9C" />
        <circle cx="3.5" cy="3.5" r="1" fill="#FFFFFF" />
        <circle cx="7.5" cy="3.5" r="1" fill="#FFFFFF" />
        <circle cx="5.5" cy="6.2" r="1" fill="#FFFFFF" />
        <circle cx="3.5" cy="9" r="1" fill="#FFFFFF" />
        <circle cx="7.5" cy="9" r="1" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

function PhpFlagSvg({ sizeClass = "w-full h-full" }: { sizeClass?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${sizeClass} block`} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#CE1126" />
      <path d="M0 0h24v12H0z" fill="#0038A8" />
      <polygon points="0,0 12,12 0,24" fill="#FFFFFF" />
      <circle cx="4.5" cy="12" r="2.2" fill="#FCD116" />
    </svg>
  );
}

const CURRENCY_OPTIONS: Array<{
  code: CurrencyCode;
  label: string;
}> = [
  { code: "VND", label: "VND, ₫" },
  { code: "PHP", label: "PHP, ₱" },
  { code: "USD", label: "USD, $" },
];

function CurrencyFlag({ code }: { code: CurrencyCode }) {
  if (code === "PHP") return <PhpFlagSvg />;
  if (code === "USD") return <UsFlagSvg />;
  return <VietnamFlagSvg />;
}

/**
 * Global Header 1:1 with live mipik.vn (Desktop 70px & Mobile 70px).
 * - Dark forest green #224e40, container max 1290px
 * - Desktop: Wordmark | 7 nav items | Search box (46x46), Cart, VI/EN circular flags, 3-currency dropdown
 * - Supports dynamic BE `/public/menu` items (falling back cleanly to localized STORE_NAV)
 */
export function Header({
  settings,
  menuItems,
}: {
  settings?: SiteSettingsData | null;
  menuItems?: MenuNode[];
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const locale = getLocaleFromPath(pathname);
  const isEn = locale === "en";
  const t = STORE_I18N[locale].nav;

  const rawBrand = settings?.siteName || "11Sport";
  const wordmark = rawBrand.toLowerCase();
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileGroup, setExpandedMobileGroup] = useState<string | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    products: ProductListItem[];
    articles: ArticleSummary[];
  }>({ products: [], articles: [] });

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const activeCurrency: CurrencyCode = mounted ? currency : "VND";

  const cleanBasePath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  const viTarget = cleanBasePath;
  const enTarget = cleanBasePath === "/" ? "/en" : `/en${cleanBasePath}`;

  const navItems = useMemo<NavItem[]>(() => {
    if (!isEn && menuItems && menuItems.length > 0) {
      return [...menuItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          label: m.label,
          href: localizeHref(m.url, locale),
          isHighlightedMint:
            Boolean(m.badge) ||
            m.url.includes("thoi-trang") ||
            m.url.includes("fashion"),
          isMegaBrands:
            m.url === "/vot-pickleball" || (m.children?.length ?? 0) > 8,
          children: (m.children ?? [])
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => ({
              label: c.label,
              href: localizeHref(c.url, locale),
            })),
        }));
    }

    const defaults: NavItem[] = [
      {
        label: t.paddles,
        href: localizeHref("/vot-pickleball", locale),
        isMegaBrands: true,
      },
      {
        label: t.fashion,
        href: localizeHref("/danh-muc-san-pham/thoi-trang", locale),
        isHighlightedMint: true,
        children: [
          {
            label: t.subCombo,
            href: localizeHref("/danh-muc-san-pham/thoi-trang/combo-11sport", locale),
          },
          {
            label: t.subShirt,
            href: localizeHref("/danh-muc-san-pham/thoi-trang/ao-11sport", locale),
          },
          {
            label: t.subCap,
            href: localizeHref("/danh-muc-san-pham/thoi-trang/non-11sport", locale),
          },
          {
            label: t.subBag,
            href: localizeHref("/danh-muc-san-pham/thoi-trang/tui-11sport", locale),
          },
          {
            label: t.subSock,
            href: localizeHref("/danh-muc-san-pham/thoi-trang/tat-11sport", locale),
          },
        ],
      },
      {
        label: t.shoes,
        href: localizeHref("/giay-pickleball", locale),
        children: [
          { label: t.subShoesAsics, href: localizeHref("/giay-asics", locale) },
          {
            label: t.subShoesSkechers,
            href: localizeHref("/giay-skechers", locale),
          },
          {
            label: t.subShoesOn,
            href: localizeHref(
              "/danh-muc-san-pham/giay-pickleball/giay-on",
              locale
            ),
          },
          {
            label: t.subShoesKaitashi,
            href: localizeHref(
              "/danh-muc-san-pham/giay-pickleball/giay-kaitashi",
              locale
            ),
          },
        ],
      },
      {
        label: t.bags,
        href: localizeHref("/balo-tui-pickleball", locale),
      },
      {
        label: t.accessories,
        href: localizeHref("/phu-kien-pickleball", locale),
      },
      {
        label: t.blog,
        href: localizeHref("/tin-tuc", locale),
        children: [
          {
            label: t.subBlogReview,
            href: localizeHref("/tin-tuc/review-danh-gia", locale),
          },
          {
            label: t.subBlogKnowledge,
            href: localizeHref("/tin-tuc/kien-thuc-pickleball", locale),
          },
          {
            label: t.subBlogAdvice,
            href: localizeHref("/tin-tuc/tu-van-dung-cu-pickleball", locale),
          },
          {
            label: t.subBlogCommunity,
            href: localizeHref("/tin-tuc/tin-tuc-cong-dong", locale),
          },
        ],
      },
      {
        label: t.contact,
        href: localizeHref("/lien-he", locale),
      },
    ];

    return defaults;
  }, [isEn, locale, menuItems, t]);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults({ products: [], articles: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-preview?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const json = await res.json();
          setSearchResults({
            products: json.products ?? [],
            articles: json.articles ?? [],
          });
        }
      } catch {
        // Ignore preview error
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileMenuOpen(false);
        setSearchOpen(false);
        setCurrencyOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setCurrencyOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const totalItems = mounted
    ? items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

  const handleMouseEnter = (label: string, hasDropdown: boolean) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveMenu(hasDropdown ? label : null);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    setMobileMenuOpen(false);
    router.push(
      localizeHref(`/tim-kiem?q=${encodeURIComponent(q)}`, locale)
    );
  };

  const currentCurrencyMeta =
    CURRENCY_OPTIONS.find((opt) => opt.code === activeCurrency) ||
    CURRENCY_OPTIONS[0]!;

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 text-white ${
          scrolled ? "bg-store-forest-dark shadow-md" : "bg-store-forest"
        }`}
      >
        <div className="max-w-container mx-auto px-3.5 lg:px-5 h-[70px] flex items-center justify-between gap-3">
          {/* Mobile Left: Hamburger + Search bordered icon buttons */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu danh mục"
              className="w-9 h-8 rounded-md border border-white/30 bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            >
              <Menu className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Mở tìm kiếm"
              className="w-9 h-8 rounded-md border border-white/30 bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            >
              <Search className="w-[17px] h-[17px]" aria-hidden="true" />
            </button>
          </div>

          {/* Brand Wordmark (left on desktop, centered on mobile) */}
          <Link
            href={isEn ? "/en" : "/"}
            className="text-[26px] lg:text-[28px] font-extrabold tracking-tight text-white shrink-0 leading-none"
          >
            {wordmark}
          </Link>

          {/* Desktop 7-Item Navigation */}
          <nav
            aria-label={isEn ? "Main navigation" : "Danh mục chính"}
            className="hidden lg:flex items-center gap-3.5 xl:gap-5 shrink-0"
          >
            {navItems.map((item) => {
              const hasDropdown = Boolean(
                item.isMegaBrands || (item.children && item.children.length > 0)
              );
              const isOpen = activeMenu === item.label;

              return (
                <div
                  key={item.label}
                  className="relative shrink-0"
                  onMouseEnter={() =>
                    handleMouseEnter(item.label, hasDropdown)
                  }
                  onMouseLeave={handleMouseLeave}
                >
                  {item.isHighlightedMint ? (
                    <Link
                      href={item.href}
                      className="mipik-mint-pill inline-flex items-center gap-1.5 h-8 px-[13px] rounded-full bg-store-mint-bg border border-store-mint-border text-store-mint-ink text-xs font-bold uppercase tracking-wide whitespace-nowrap shrink-0"
                    >
                      <span>{item.label}</span>
                      {hasDropdown && (
                        <ChevronDown
                          className="w-3 h-3 text-store-mint-ink shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  ) : (
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 py-2 text-[13px] font-medium uppercase tracking-wide text-white/95 hover:text-store-cream transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{item.label}</span>
                      {hasDropdown && (
                        <ChevronDown
                          className="w-3 h-3 opacity-80 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  )}

                  {/* MegaMenu 2-column (dynamic BE menu children when present, else 20 brands A-K / L-Z) */}
                  {isOpen && item.isMegaBrands && (
                    <div className="absolute left-0 top-full pt-2 z-50">
                      {item.children && item.children.length > 0 ? (
                        <div className="w-[460px] rounded-md bg-white border border-store-border-sage shadow-drawer p-5 grid grid-cols-2 gap-6 text-ink-primary">
                          {[
                            item.children.slice(
                              0,
                              Math.ceil(item.children.length / 2)
                            ),
                            item.children.slice(
                              Math.ceil(item.children.length / 2)
                            ),
                          ].map((col, colIdx) => (
                            <ul key={colIdx} className="space-y-1">
                              {col.map((child) => (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    onClick={() => setActiveMenu(null)}
                                    className="block py-1 text-sm font-medium text-ink-secondary hover:text-store-forest hover:translate-x-0.5 transition-all"
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ))}
                        </div>
                      ) : (
                        <div className="w-[460px] rounded-md bg-white border border-store-border-sage shadow-drawer p-5 grid grid-cols-2 gap-6 text-ink-primary">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wider text-store-forest border-b border-store-border-sage pb-2 mb-2">
                              A–K
                            </p>
                            <ul className="space-y-1">
                              {BRANDS_A_K.map((b) => (
                                <li key={b.href}>
                                  <Link
                                    href={localizeHref(b.href, locale)}
                                    onClick={() => setActiveMenu(null)}
                                    className="block py-1 text-sm font-medium text-ink-secondary hover:text-store-forest hover:translate-x-0.5 transition-all"
                                  >
                                    {t.megaPaddlePrefix} {b.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wider text-store-forest border-b border-store-border-sage pb-2 mb-2">
                              L–Z
                            </p>
                            <ul className="space-y-1">
                              {BRANDS_L_Z.map((b) => (
                                <li key={b.href}>
                                  <Link
                                    href={localizeHref(b.href, locale)}
                                    onClick={() => setActiveMenu(null)}
                                    className="block py-1 text-sm font-medium text-ink-secondary hover:text-store-forest hover:translate-x-0.5 transition-all"
                                  >
                                    {t.megaPaddlePrefix} {b.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Single-column Submenu Dropdown */}
                  {isOpen && !item.isMegaBrands && item.children && (
                    <div className="absolute left-0 top-full pt-2 z-50">
                      <ul className="w-60 rounded-md bg-white border border-store-border-sage shadow-drawer py-1.5 text-ink-primary">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setActiveMenu(null)}
                              className="block px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-store-surface-sage hover:text-store-forest"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Utility Actions (Search box -> Cart -> VI flag -> EN flag -> 3-Currency dropdown) */}
          <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={isEn ? "Search products" : "Tìm kiếm sản phẩm"}
              className="hidden lg:inline-flex w-[46px] h-[46px] rounded-[10px] border border-white/25 bg-transparent hover:bg-white/10 items-center justify-center text-white transition-colors"
            >
              <Search className="w-[22px] h-[22px]" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={openDrawer}
              aria-label={
                isEn ? `Cart (${totalItems})` : `Giỏ hàng (${totalItems} sản phẩm)`
              }
              className="relative inline-flex items-center justify-center w-8 h-10 text-white hover:opacity-85 transition-opacity"
            >
              <ShoppingCart className="w-[22px] h-[22px]" aria-hidden="true" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-store-mint-bg text-store-mint-ink font-mono text-[10px] font-extrabold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 lg:gap-3">
              <Link
                href={viTarget}
                aria-label="Tiếng Việt"
                className={`w-5 h-5 lg:w-[26px] lg:h-[26px] rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-1 ${
                  !isEn
                    ? "ring-white"
                    : "ring-white/40 opacity-85 hover:opacity-100"
                }`}
              >
                <VietnamFlagSvg />
              </Link>
              <Link
                href={enTarget}
                aria-label="English"
                className={`w-5 h-5 lg:w-[26px] lg:h-[26px] rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-1 ${
                  isEn
                    ? "ring-white"
                    : "ring-white/40 opacity-85 hover:opacity-100"
                }`}
              >
                <UsFlagSvg />
              </Link>
            </div>

            {/* White 3-Currency Dropdown Pill (Desktop only, matching live mipik.vn) */}
            <div
              ref={currencyDropdownRef}
              className="relative hidden lg:block shrink-0"
            >
              <button
                type="button"
                onClick={() => setCurrencyOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={currencyOpen}
                aria-label="Chuyển đổi tiền tệ"
                className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-white text-ink-primary text-[11px] font-bold shadow-sm whitespace-nowrap shrink-0 hover:bg-[#f4f7f5]"
              >
                <span className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                  <CurrencyFlag code={activeCurrency} />
                </span>
                <span>{currentCurrencyMeta.label}</span>
                <ChevronDown
                  className="w-3 h-3 text-ink-muted"
                  aria-hidden="true"
                />
              </button>

              {currencyOpen && (
                <ul
                  role="listbox"
                  aria-label="Chọn đơn vị tiền tệ"
                  className="absolute right-0 top-full mt-1.5 w-28 rounded-md bg-white border border-store-border-sage shadow-drawer py-1 z-50"
                >
                  {CURRENCY_OPTIONS.map((opt) => {
                    const selected = opt.code === activeCurrency;
                    return (
                      <li key={opt.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setCurrency(opt.code);
                            setCurrencyOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-[11.5px] font-semibold transition-colors ${
                            selected
                              ? "bg-store-surface-sage text-store-forest font-bold"
                              : "text-ink-primary hover:bg-[#f4f7f5]"
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">
                            <CurrencyFlag code={opt.code} />
                          </span>
                          <span>{opt.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Centered Search Lightbox Modal */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isEn ? "Search products" : "Tìm kiếm sản phẩm"}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg bg-white border border-store-border-sage shadow-drawer p-4 sm:p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="flex-1 h-12 px-4 rounded-md border border-store-border-sage text-base text-ink-primary focus:outline-none focus:border-store-forest"
              />
              <button
                type="submit"
                aria-label={isEn ? "Submit search" : "Tìm kiếm"}
                className="w-12 h-12 rounded-md bg-store-forest text-white flex items-center justify-center hover:bg-store-forest-hover transition-colors shrink-0"
              >
                <Search className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label={isEn ? "Close search" : "Đóng tìm kiếm"}
                className="w-12 h-12 rounded-md border border-store-border-sage flex items-center justify-center text-ink-secondary hover:bg-store-surface-sage shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </form>

            {searchQuery.trim() ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {searchResults.products.length > 0 && (
                  <div className="divide-y divide-store-border-sage">
                    {searchResults.products.map((p) => (
                      <Link
                        key={p._id}
                        href={localizeHref(`/${p.slug}`, locale)}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between gap-3 py-2.5 px-2 hover:bg-store-surface-sage rounded"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded border border-store-border-card bg-white shrink-0 overflow-hidden">
                            {resolveMediaUrl(p.thumbnailUrl) && (
                              <Image
                                src={resolveMediaUrl(p.thumbnailUrl)}
                                alt={p.name}
                                fill
                                sizes="40px"
                                className="object-contain p-0.5"
                              />
                            )}
                          </div>
                          <span className="text-sm font-medium text-ink-primary truncate">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-store-forest shrink-0">
                          {formatPriceByCurrency(
                            p.sellingPrice,
                            activeCurrency
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                <Link
                  href={localizeHref(
                    `/tim-kiem?q=${encodeURIComponent(searchQuery.trim())}`,
                    locale
                  )}
                  onClick={() => setSearchOpen(false)}
                  className="block text-center py-2.5 rounded bg-store-surface-sage text-xs font-bold text-store-forest hover:underline"
                >
                  {t.allResultsPrefix} &ldquo;{searchQuery.trim()}&rdquo; →
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu danh mục"
          className="fixed inset-0 z-50 bg-black/50 lg:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[300px] max-w-[85vw] h-full bg-white p-5 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-store-border-sage pb-3">
                <span className="text-xl font-extrabold text-store-forest lowercase">
                  {wordmark}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Đóng menu"
                  className="w-9 h-9 rounded-full border border-store-border-sage flex items-center justify-center text-ink-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 rounded-full bg-store-form-bg border border-store-border-sage text-sm text-ink-primary"
                />
              </form>

              <ul className="divide-y divide-store-border-sage">
                {navItems.map((item) => {
                  const subList = item.isMegaBrands
                    ? [...BRANDS_A_K, ...BRANDS_L_Z].map((b) => ({
                        label: `${t.megaPaddlePrefix} ${b.label}`,
                        href: localizeHref(b.href, locale),
                      }))
                    : item.children;
                  const isExpanded = expandedMobileGroup === item.label;

                  return (
                    <li key={item.label} className="py-2">
                      <div className="flex items-center justify-between">
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`text-sm font-bold ${
                            item.isHighlightedMint
                              ? "px-3 py-1 rounded-full bg-store-mint-bg text-store-mint-ink"
                              : "text-ink-primary"
                          }`}
                        >
                          {item.label}
                        </Link>
                        {subList && subList.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMobileGroup(
                                isExpanded ? null : item.label
                              )
                            }
                            aria-label={`Mở danh mục con ${item.label}`}
                            className="p-2 text-ink-muted"
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>
                      {isExpanded && subList && (
                        <ul className="mt-2 pl-3 space-y-1.5 border-l-2 border-store-border-sage">
                          {subList.map((sub) => (
                            <li key={sub.href}>
                              <Link
                                href={sub.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block py-1 text-xs font-medium text-ink-secondary hover:text-store-forest"
                              >
                                {sub.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="pt-4 border-t border-store-border-sage space-y-2">
              <div className="flex items-center gap-1.5 pb-1">
                {CURRENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setCurrency(opt.code)}
                    className={`flex-1 py-1.5 rounded text-[11px] font-bold border ${
                      activeCurrency === opt.code
                        ? "bg-store-forest text-white border-store-forest"
                        : "bg-white text-ink-primary border-store-border-sage"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Link
                href={localizeHref("/tai-khoan", locale)}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-full bg-store-forest text-white text-xs font-bold uppercase tracking-wider"
              >
                <User className="w-4 h-4" />
                <span>{t.accountAndOrders}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

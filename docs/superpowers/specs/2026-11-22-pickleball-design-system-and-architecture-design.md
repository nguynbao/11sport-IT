# PikPro Pickleball — Design System, Component Library & Enterprise Next.js Architecture Spec

- **Date:** 2026-11-22
- **Target Reference:** `https://mipik.vn/` (frozen REA baseline committed at [mipik-baseline.md](file:///d:/Pickball/docs/rea-baseline/mipik-baseline.md))
- **Target Figma File:** `pickleball` (via Reqwise Figma MCP, bound channel `calm-koala-88`)
- **Target Codebase:** `d:\Pickball` (Next.js App Router + TypeScript strict + Tailwind CSS v4)
- **Temporary Brand Identity:** `PikPro` / `PikPro Pickleball` (100% centralized in `src/data/mock/site.mock.ts` for single-file rebranding when client data arrives)

---

## 1. Intent & The Why

The client requires an exact 1:1 layout clone of `https://mipik.vn/` (a multi-branch Vietnamese Pickleball e-commerce storefront) engineered with enterprise Next.js architecture, strong Google Search ranking signals (technical & semantic SEO), smooth GPU-safe motion, high Core Web Vitals performance, and strictly centralized mock data so real backend/CMS data can replace mocks cleanly later with zero UI edits.

Execution is structured in clear milestones:
1. **Milestone 1 (Figma — File `pickleball`):** Generate the Reqwise Base Design System (`ds-mwro6brg-3`) **plus** all `20` dedicated storefront & overlay components faithfully extracted from `https://mipik.vn/`, verify `audit = 1.00`, `layout_audit`, and `a11y_audit`, and export `design-kit.md`.
2. **Milestone 2 (Codebase — `d:\Pickball`):** Build the complete Enterprise Next.js App Router architecture—Figma token bridge, `src/components/ui/` primitives, shared layout shell (`Header`, `MegaMenu`, `Footer`, `FloatingContactDock`, `SearchOverlay`, `MiniCartDrawer`, `ZaloConsultantModal`), centralized bilingual `src/data/mock/` vault, Repository Pattern, Domain pricing/search rules, Enterprise SEO Engine (`metadata`, `@graph` JSON-LD, crawl-budget guard, internal-link clusters, programmatic DTO + HTML SEO Analyzer), `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, wired SSR route shells across all routes so `next build` & Vitest pass 100%.
3. **Milestone 3 (Follow-on after Milestones 1–2 sign-off):** Draw Figma Userflow + Full Desktop (`1440`) & Mobile (`390`) Screens + Motion on `pickleball`, then implement full visual 1:1 storefront feature modules (`src/features/*`) with side-by-side verification.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **1:1 Visual & Layout Parity with `mipik.vn`:** Match exact visual hierarchy, color palette (`#224e40` forest green, `#f8eee9` cream, `#E3F8E7` mint highlight, `#f4f7f5` sage surfaces, `#9a0303` sale red), typography (`Livvic`), header geometry (`70px`), `1290px` container grid, product card anatomy (badges, mini color-variant thumbnail swatches, strikethrough pricing), PDP tiered bulk-pricing & gift box, category brand panels, news consultation sidebar, tabbed store maps, floating contact dock, and 4-column forest-green footer.
- **Figma-First Single Source of Truth:** Every token and component in Figma file `pickleball` is tokenized (`audit = 1.00`) and projected into `design-kit.md` + Tailwind v4 `@theme` CSS variables.
- **Zero-Coupling Centralized Mock Data:** All mock entities live exclusively inside `src/data/mock/`. UI and pages only talk to `src/services/` → `src/repositories/` contracts. Swapping to real REST/GraphQL/Supabase/WooCommerce requires only wiring `src/repositories/api/*`, toggling `DATA_SOURCE=api`, and deleting `src/data/mock/` + `public/images/mock/`.
- **Enterprise Google SEO & Core Web Vitals Superiority:** Eliminate all defects observed on live `mipik.vn` (34 CSS / 60 JS / 227 image homepage bloat, 3 × `404` `Livvic` font paths, runtime `classList` `TypeError`, duplicate `<h1>` on PDP, missing `SportingGoodsStore`/`FAQPage`/`ItemList` schemas). Target LCP < 1.2s, CLS = 0, INP < 100ms.
- **Accessible, Purposeful Motion:** Respect `prefers-reduced-motion`, animate only `transform`/`opacity`, provide hover lift (`-3px`), mint pill shimmer sweep, smooth carousel/drawer transitions without layout shift.

### Non-Goals (For Milestones 1 & 2)
- Real payment gateways (VNPay/MoMo/Stripe), real auth/database, or live ERP sync (mocked behind repository interfaces; real adapters plugged in later).
- Copying `mipik.vn`'s real company legal details, real personal phone numbers, or copyrighted logos into code identifiers (all brand strings, branches, hotlines, product names/assets live as mock placeholders in `src/data/mock/`).
- Full page-by-page Figma screen artboards and full pixel-by-pixel storefront feature screens (`src/features/*` detailed views) — deferred cleanly to Milestone 3 so Milestones 1 & 2 establish rock-solid Design System, Custom Components, and Enterprise Architecture first.

### Anti-Goals
- Redesigning away `mipik.vn`'s layout structure (violates explicit client 1:1 requirement).
- Scattering hardcoded mock arrays inside React components or routes.
- Hardcoding hex colors or arbitrary font sizes instead of semantic tokens.
- Emitting invalid SEO signals (e.g., broken `hreflang` without crawlable English URLs, or `robots.txt` blocking URLs that rely on `noindex, follow`).

---

## 3. Milestone 1 — Figma Design System & Dedicated Component Library (`pickleball`)

### 3.1 Reqwise Base Design System Plan (Exact Reproducible Brief)
- **Plan ID:** `ds-mwrp1rg0-4` (`blocking: 0`, `questions: []`)
- **File / Strategy:** Figma file `pickleball`, `pageStrategy: "single"` (Starter 3-page safe: creates `DS · System`, leaving 2 pages for Userflow and Screens in Milestone 3).
- **Exact `brief` & `select` Payload (reproducible across sessions):**
  - `name`: `"PikPro Pickleball"`
  - `brand`: `{ primary: "#224e40", secondary: "#f8eee9" }`
  - `style`: `"premium"` **with explicit `mipik.vn` overrides:**
    - `font`: `{ family: "Inter" }` *(matches live `mipik.vn`'s actual browser-rendered sans-serif after its broken `Livvic` 404 fallback)*
    - `headingFont`: `"Inter"` *(overrides Premium's default Playfair Display)*
    - `headingWeight`: `"bold"`
    - `radius`: `"rounded"` *(resolves to `4 / 8 / 12 / 16 / 20 / 28 / 36 / 9999`)*
    - `buttonShape`: `"pill"` (`radius/button = 9999`)
    - `fieldStyle`: `"outline"` *(overrides Premium's default underline)*
  - `theme`: `{ light: true, dark: false, primary: "light" }`
  - `platforms`: `["mobile", "web"]`
  - `select`: `{ scope: "essentials", foundations: ["brand-colors", "semantic-colors", "spacing", "radius", "typography", "elevation", "alpha-colors", "layout", "sizes", "opacity", "z-index", "palette", "motion"] }`
  - `options`: `{ docPages: true, pageStrategy: "single" }`
- **Estimate:** `11` base components, `97` variants, `612` layers, `526` variables, `20` text styles, `5` effect styles, `~19s`.
- **Review Findings (Explicit Decisions):**
  1. `target-size` (`Button Size=sm` = `32px`): Allowed on desktop pointer controls only; all mobile touch controls use `md`/`lg` (`≥ 44px`).
  2. `brand-anchor-shifted` (`#224e40` lands at `primary/900`): Accepted intentionally to preserve `mipik.vn`'s exact primary green. Dedicated `Store/*` components bind explicitly to `$brand/primary/900` (`#224e40`) and storefront semantic variables below.

### 3.2 Storefront-Specific Semantic Variables (Added to File `pickleball`)
Created via `figma.createVariable` / `setupTokens` in collection `Storefront` so every `Store/*` component is 100% tokenized (zero raw hexes):
- `store/brand-forest`: `#224E40` | `store/brand-forest-hover`: `#186746` | `store/brand-forest-dark`: `#173E32`
- `store/accent-cream`: `#F8EEE9` | `store/accent-cream-pill`: `#F1E4D6`
- `store/accent-mint-bg`: `#E3F8E7` | `store/accent-mint-border`: `#9CDEB5` | `store/accent-mint-ink`: `#164A38`
- `store/surface-sage`: `#F4F7F5` | `store/border-sage`: `#DEE3DD` | `store/border-card`: `#E7E3DC`
- `store/price-sale`: `#9A0303` | `store/accent-gold`: `#FBB03B`
- `store/ink-primary`: `#0A0A0A` | `store/ink-secondary`: `#1E2C26` | `store/ink-muted`: `#5C6B64`

### 3.3 Dedicated Storefront Component Library (`20` Components in Figma)
Built in a dedicated `Storefront Components` section on the DS page using Auto Layout, semantic tokens, real icons (`loadIcon`), base DS instances where matching, and explicit Component Properties (`props`):

| # | Component Name | Variants / Properties | Exact `mipik.vn` Anatomy |
|---|---|---|---|
| 1 | `Store/Header/Desktop` | `Scrolled=false\|true`, Props: `BrandName`, `CartCount`, `Currency` | `1440×70`, `#224E40`, Logo left, 7 nav items (`THỜI TRANG` in `#E3F8E7` pill with `#9CDEB5` border), Search, Cart + badge, VI/EN flags, `VND, ₫` pill |
| 2 | `Store/Header/Mobile` | Props: `BrandName`, `CartCount` | `390×60`, `#224E40`, Square Hamburger + Search left, centered Logo, Cart + VI/EN flags right |
| 3 | `Store/Header/MegaMenu` | Props: `GroupLeft`, `GroupRight` | 2-column brand dropdown (`A–K` and `L–Z` covering all 20 Pickleball brands) anchored under `VỢT PICKLEBALL` |
| 4 | `Store/Section/BoxedTitle` | `Breakpoint=desktop\|mobile`, Prop: `Title` | Full-width hairline rule + centered bordered box with uppercase `Livvic` `#224E40` title |
| 5 | `Store/Product/Card` | `State=default\|sale\|new\|gift`, `Density=home\|category`, Props: `Title`, `Price`, `OriginalPrice`, `DiscountBadge`, `GiftTag` | `#FFFFFF` card, `1px #E7E3DC`, `radius/xl` (`18–20px`), 1:1 image area, top-left `-57%` pill + bottom-left `Mới` pill + top-right mint `TẶNG ÁO` tag, SwatchStrip instance, 2-line title, strikethrough original + bold current price, optional `THÊM VÀO GIỎ HÀNG` CTA (category density) |
| 6 | `Store/Product/SwatchStrip` | `Overflow=none\|plus`, Prop: `OverflowCount` | 4 mini variant thumbnail chips (`36×36`, `radius/sm`, active `#224E40` stroke) + `+2` overflow chip |
| 7 | `Store/Trust/GuaranteePills` | `Variant=category-3col\|home-4col` | Category 3-column `#F1E4D6` pills (`CHÍNH HÃNG 100%`, `LỖI LÀ ĐỔI MỚI`, `FREESHIP TOÀN QUỐC`) & Home 4-column elevated dashed trust strip |
| 8 | `Store/Catalog/BrandGroupHeader` | Props: `BrandTitle`, `CtaLabel` | Soft sage container header (`#F4F7F5`), forest-green brand title left, outlined `Xem tất cả →` right, `#224E40` bottom hairline |
| 9 | `Store/Catalog/BrandTile` | Props: `BrandName`, `ProductCount` | Brand showcase tile (7-col desktop / 4-col mobile carousel) with image, brand title, and count |
| 10 | `Store/Catalog/FilterBar` | Props: `ActiveFilterCount`, `SortLabel` | Filter chips (Thương hiệu, Khoảng giá, Độ dày lõi, Trọng lượng) + Sort dropdown + Clear button for `/cua-hang` |
| 11 | `Store/PDP/ExclusivePromoBox` | Props: `BrandBadge`, `Tier1Label`, `Tier1Price`, `Tier2Label`, `Tier2Price`, `Gift1`, `Gift2` | `#F4F7F5` card (`1px #DEE3DD`, `radius/lg`), header `✦ ƯU ĐÃI ĐỘC QUYỀN` + brand pill, 2 bulk-pricing rows (3+ / 5+ cùng biến thể), 2 white gift tiles (5+ / 10+ sản phẩm), footnote + `Xem quà tặng ↗` |
| 12 | `Store/PDP/PolicyTable` | Props: `Gift`, `Shipping`, `Warranty`, `Payment` | 4-row hairline-separated key-value store policy table |
| 13 | `Store/PDP/QuantityAddBar` | `State=default\|out-of-stock` | `- 1 +` pill stepper + `#224E40` pill `THÊM VÀO GIỎ HÀNG` CTA (`height 44px`) |
| 14 | `Store/News/ArticleCard` | Props: `Title`, `Excerpt`, `Date` | 16:9 thumbnail, centered bold `Livvic` title (2–3 lines), muted excerpt |
| 15 | `Store/News/ConsultSidebarForm` | `State=default\|error\|submitted` | `#224E40` header bar (`GỬI CÂU HỎI TƯ VẤN`), 4 outlined inputs (`Họ và tên`, `Số điện thoại`, `Email`, `Nội dung`), `#224E40` `GỬI CÂU HỎI` CTA |
| 16 | `Store/Contact/BranchList` | Props: `Branch1`, `Branch2`, `Branch3` | Multi-branch list + circular social icons + Map switcher tabs (`QUẬN 10`, `PHÚ NHUẬN`, `HÀ NỘI`) |
| 17 | `Store/Overlay/SearchOverlay` | `State=empty\|results` | Instant search modal/dropdown with query input, debounced product hit rows (thumbnail, title, price), and "Xem tất cả kết quả" |
| 18 | `Store/Overlay/MiniCartDrawer` | `State=items\|empty` | Right slide-over drawer (`360px`) with line items, bulk-tier savings indicator, free-gift progress bar, subtotal, `Xem giỏ hàng` & `Thanh toán` CTAs |
| 19 | `Store/Overlay/ZaloConsultantModal` | Props: `Title`, `Subtitle` | Centered modal `"Chọn cửa hàng tư vấn"` listing branches with Zalo deep-link buttons + "Sao chép yêu cầu tư vấn" button |
| 20 | `Store/Global/FloatingDockAndFooter` | Separate `Store/Global/FloatingContactDock` + `Store/Global/Footer` (`desktop\|mobile`) | Right floating Hotline/Messenger/Zalo/Top dock + `#224E40` 4-col Footer with payment icons (COD, MasterCard, Visa) & copyright bar |

### 3.4 Milestone 1 Verification Gate
- `figma_design_system({ op: "audit" })` === **`1.00`**.
- `layout_audit` (0 blocking issues) & `a11y_audit` (0 WCAG failures) on the Storefront Components showcase frame.
- Export `figma_read({ op: "generate_design_md" })` → save verbatim to `d:\Pickball\design-kit.md`.

---

## 4. Milestone 2 — Enterprise Next.js Architecture (`d:\Pickball`)

### 4.1 Resolved Architectural Decisions (Builder Calls — Explicitly Recorded)
1. **URL-Based Bilingual i18n (`vi` + `en`) Matching Real `hreflang` SEO (Fixes Finding #1):**
   - Route tree uses `src/app/[locale]/...` with `middleware.ts` (`localePrefix: "as-needed"`):
     - **Vietnamese (`vi`, default):** Clean root URLs (`/`, `/vot-pickleball`, `/joola-perseus-power-fx`, `/tin-tuc`, `/lien-he`). No `/vi` prefix exposed publicly (`middleware.ts` rewrites cleanly to `/vi/...` internally).
     - **English (`en`):** Crawlable `/en/...` prefix (`/en`, `/en/vot-pickleball`, `/en/joola-perseus-power-fx`, `/en/tin-tuc`, `/en/lien-he`) preserving consistent slugs across locales (matching `mipik.vn`'s real `/en/` pattern).
   - Reciprocal `<link rel="alternate" hreflang="vi" ...>`, `<link rel="alternate" hreflang="en" ...>`, and `<link rel="alternate" hreflang="x-default" ...>` emitted on EVERY indexable route and inside `sitemap.ts` (`alternates.languages`).
   - Bilingual `LocalizedText` (`{ vi: string; en: string }`) on all entities in `src/data/mock/` so both locales render real indexable content.
   - `Offer.priceCurrency` in JSON-LD emits `"VND"` on `vi` routes and `"USD"` on `en` routes (converted deterministically via `currency.config.ts`). Currency toggle in UI also works independently for user browsing without polluting canonical URLs.
2. **Deterministic Canonical URL Ownership & Trailing Slashes (Fixes Finding #2):**
   - `trailingSlash: false` in `next.config.ts` (clean modern Next.js canonical standard; single consistent URL format across `metadata.ts`, `sitemap.ts`, `BreadcrumbList`, and `internal-links.ts`).
   - **Zero route overlap:**
     - `/[locale]/[slug]` is canonical for **top-level categories** (`/vot-pickleball`, `/giay-pickleball`, `/balo-tui-pickleball`, `/phu-kien-pickleball`), **brand hubs** (`/vot-pickleball-joola`, etc.), and **products** (`/joola-perseus-power-fx`, etc.), dispatched via deterministic `resolveSlug()` (`category` → `brand` → `product` → `notFound()`).
     - `/[locale]/danh-muc-san-pham/[...slug]` is canonical ONLY for **multi-segment nested subcategories** (e.g. `/danh-muc-san-pham/thoi-trang/ao-pikpro`). Any single-segment request to `/danh-muc-san-pham/<top-slug>` issues a permanent `308` redirect to `/<top-slug>` so link equity never splits.
3. **Google-Compliant Crawl-Budget Strategy (Fixes Finding #3):**
   - **Strategy A (No robots/noindex conflict):**
     - `robots.ts` disallows ONLY non-SEO transactional/internal routes: `/gio-hang`, `/thanh-toan`, `/en/gio-hang`, `/en/thanh-toan`, `/api/`.
     - Filtered/sorted URLs (`?brand=...&minPrice=...&maxPrice=...&sort=...&color=...`) remain **crawlable** so Googlebot reads `<meta name="robots" content="noindex, follow">` + `<link rel="canonical" href="<clean-category-url>">` to consolidate link equity cleanly.
     - Valid pagination (`?page=2+` with no other filter params) stays `index, follow` with a **self-referencing canonical** (`?page=N`) so deeper catalog products stay discoverable.
4. **Exact Bulk-Tier Pricing & Free-Gift Rules (Fixes Finding #7, Grounded in `mipik.vn` REA Capture):**
   - **Bulk Unit Pricing (`bulkTiers` on `Product` entity):** Evaluated **per variant (`variantId`)** matching live copy `"Mua từ N sản phẩm cùng biến thể"`. When a cart line item's quantity for that `variantId` reaches a tier threshold (`>= 3`, `>= 5`), the highest matching bulk tier unit price replaces the retail/sale unit price for all units of that line item (non-stacking with regular sale price).
   - **Free Gifts (`giftTiers` on `Promotion` / `Product` eligibility):** Evaluated across total eligible quantity in the cart (`>= 5` → 1 áo, `>= 10` → 2 áo + 1 túi), **non-stacking** (awards only the highest reached tier), recalculated live in `calculateCartPricing()` and verified at cart/checkout.
   - `Product`/`Offer` JSON-LD serializes single-unit retail/sale `price` plus `priceSpecification` (`UnitPriceSpecification` with `referenceQuantity` / `eligibleQuantity`) for each bulk tier.
5. **Exact Milestone 2 vs. Milestone 3 Deliverable Boundary (Fixes Finding #4):**
   - **Milestone 2 delivers (100% tested & green `next build`):**
     - Next.js 16 + TypeScript `strict: true` + Tailwind CSS v4 + `next/font/google` (`Livvic`) + `zod` + `framer-motion` (`LazyMotion`) + `lucide-react` + `vitest`.
     - Figma Token Bridge: `src/styles/tokens.css` + `src/app/globals.css` mapped 1:1 to `design-kit.md`.
     - Complete centralized bilingual mock vault `src/data/mock/*` + `public/images/mock/*` + `src/data/mock/README.md` migration guide + automated Vitest import-boundary test proving zero files outside `src/repositories/mock/` import `src/data/mock/`.
     - Complete `src/domain/*` (entities, Zod schemas, `calculateCartPricing()`, Vietnamese diacritic-insensitive BM25 search ranker).
     - Complete `src/repositories/*` (interfaces + `mock/*` implementations + typed `api/*` adapter stubs + factory).
     - Complete `src/services/*` (`catalogService`, `productService`, `contentService`, `searchService`, `siteService`).
     - Complete `src/lib/seo/*` (`metadata.ts`, `jsonld.ts`, `crawl-budget.ts`, `internal-links.ts`, `analyzer.ts` supporting **both** entity/metadata DTO checks and rendered HTML/DOM audits for single-`<h1>`, heading order, image `alt`, canonical, and internal link depth).
     - Complete `src/lib/motion/*` (GPU-only presets + `MotionProvider` with `reducedMotion="user"`).
     - Complete `src/components/ui/*` design system primitives + `src/components/layout/*` shared storefront shell (`Header`, `MegaMenu`, `Footer`, `FloatingContactDock`, `SearchOverlay`, `MiniCartDrawer`, `ZaloConsultantModal`) + `src/app/` full App Router tree with semantic SSR route shells, `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, `/api/health`, `/api/consult`.
   - **Milestone 3 (follow-on):** Figma Userflow + Full Desktop (`1440`) & Mobile (`390`) Screens + Figma Motion → Full pixel-accurate `src/features/*` implementations (Home 5-rail carousels, Category brand hub & filter UX, PDP full gallery/promo/review, News grid & article detail, Contact tabbed maps, Cart/Checkout full flow) + side-by-side visual parity verification!

### 4.2 Enterprise Layered Directory Tree
```text
d:\Pickball\
├── design-kit.md                     # Exported verbatim from Figma file `pickleball`
├── docs/
│   ├── rea-baseline/mipik-baseline.md
│   └── superpowers/specs/2026-11-22-pickleball-design-system-and-architecture-design.md
├── public/images/mock/               # Local clean SVG/WebP mock assets (zero external hotlinks)
├── src/
│   ├── middleware.ts                 # Clean locale routing (vi at root, en at /en/*)
│   ├── app/
│   │   ├── globals.css               # Tailwind v4 + @theme tokens synced from Figma
│   │   ├── robots.ts                 # Transactional-only disallow (preserves filter noindex/canonical)
│   │   ├── sitemap.ts                # Bilingual alternates XML sitemap
│   │   ├── manifest.ts               # Web App Manifest
│   │   ├── opengraph-image.tsx       # Dynamic OG image
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   └── consult/route.ts
│   │   └── [locale]/
│   │       ├── layout.tsx            # Livvic font, Motion/Store Providers, Header, Footer, FloatingDock, Org/WebSite/Stores JSON-LD
│   │       ├── page.tsx              # Homepage SSR route
│   │       ├── [slug]/page.tsx       # Canonical Category / Brand Hub / Product Detail dispatcher
│   │       ├── danh-muc-san-pham/[...slug]/page.tsx # Nested subcategories (single-seg -> 308 to /[slug])
│   │       ├── cua-hang/page.tsx     # Full Catalog + Faceted Filter (crawl-budget guarded)
│   │       ├── tin-tuc/page.tsx
│   │       ├── tin-tuc/[slug]/page.tsx
│   │       ├── lien-he/page.tsx
│   │       ├── gio-hang/page.tsx
│   │       └── thanh-toan/page.tsx
│   ├── config/                       # env.ts (Zod), seo.config.ts, i18n.config.ts, currency.config.ts
│   ├── data/mock/                    # SINGLE MOCK DATA VAULT (+ README.md swap guide)
│   ├── domain/                       # entities/, pricing/, search/
│   ├── repositories/                 # contracts/, mock/, api/, index.ts
│   ├── services/                     # catalog, product, content, search, site services
│   ├── lib/
│   │   ├── seo/                      # metadata.ts, jsonld.ts, crawl-budget.ts, internal-links.ts, analyzer.ts
│   │   ├── motion/                   # GPU-only Framer Motion presets + LazyMotion provider
│   │   └── utils/                    # cn, vi-slugify, formatters
│   ├── components/
│   │   ├── ui/                       # Tokenized DS primitives (Button, Badge, Card, Input, Dialog, Drawer, Pill, Stepper, Skeleton)
│   │   └── layout/                   # Header, MegaMenu, Footer, FloatingContactDock, SearchOverlay, MiniCartDrawer, ZaloConsultantModal
│   └── features/                     # Feature module directories (wired in Milestone 2, full 1:1 visual views in Milestone 3)
└── tests/                            # Vitest suites: domain pricing, search ranking, SEO JSON-LD/crawl-budget/analyzer, mock-isolation boundary
```

---

## 5. Exhaustive Guest & User Route Inventory & Component Reuse Contract (Live Sitemap + WooCommerce Audit)

Audited directly against `https://mipik.vn/sitemap_index.xml` (`page-sitemap.xml`, `product_cat-sitemap.xml`, `product_brand-sitemap.xml`, `product-sitemap1.xml`, `product-sitemap2.xml`, `category-sitemap.xml`, `post-sitemap.xml`), Footer links, and WooCommerce endpoints:

### 5.1 Master Route Table (Guest vs. Authenticated User)

| # | Route Group | Vietnamese URL (`vi` root) | English URL (`/en/*`) | Actor (`Guest` / `User`) | Next.js App Router File | Mandatory Shared Design System Components (`DS · System`) |
|---|---|---|---|---|---|---|
| 1 | **Trang chủ (Homepage)** | `/` | `/en` | Guest & User | `src/app/[locale]/page.tsx` | `Store/Header/*`, `Store/Hero/BannerSlider`, `Store/Section/BoxedTitle` (×5 rails), `Store/Product/Card` (`Density=home`), `Store/Product/SwatchStrip`, `Store/Trust/GuaranteePills/Home`, `Store/Trust/DistributorBanner`, `Store/Catalog/BrandTile` (×7), `Store/Global/Footer/*`, `Store/Global/FloatingContactDock` |
| 2 | **Cửa hàng tổng & Tìm kiếm (Shop All + Search)** | `/cua-hang` (`?s=...`, `?brand=...`, `?minPrice=...`, `?sort=...`, `?page=N`) | `/en/cua-hang` (`/en/shop` alias) | Guest & User | `src/app/[locale]/cua-hang/page.tsx` | `Store/Navigation/BreadcrumbBar` (`catalog-sort`), `Store/Catalog/FilterBar`, `Store/Trust/GuaranteePills/Category`, `Store/Product/Card` (`Density=category`), `Store/Catalog/Pagination` |
| 3 | **5 Danh mục chính (Top-Level Category Hubs)** | `/vot-pickleball`, `/giay-pickleball`, `/balo-tui-pickleball`, `/phu-kien-pickleball`, `/bong-pickleball` | `/en/vot-pickleball` (aliases: `/en/pickleball-paddles`, `/en/pickleball-shoes`, `/en/pickleball-backpacks-bags`, `/en/pickleball-accessories`, `/en/pickleball-balls`) | Guest & User | `src/app/[locale]/[slug]/page.tsx` (`kind="category"`) | `Store/Navigation/BreadcrumbBar` (`catalog-sort`), `Store/Trust/GuaranteePills/Category`, `Store/Catalog/BrandGroupHeader` (grouped brand sections on `/vot-pickleball`), `Store/Product/Card` (`Density=category`), `Store/Catalog/Pagination`, `Store/Blog/EditorialCallout` (SEO footer guide) |
| 4 | **20+ Trang Thương hiệu ở Root (`/[brand-cat-slug]`)** | `/vot-pickleball-joola`, `-selkirk`, `-kamito`, `-facolos`, `-crbn`, `-franklin`, `-gearbox`, `-kaitashi`, `-kaiwin`, `-kbs`, `-loco`, `-luzz`, `-rpm`, `-soxter`, `-sypik`, `-vole`, `-wika`, `/giay-asics`, `/giay-skechers` | `/en/joola-pickleball-paddle`, `/en/asics-shoes`, etc. + `/en/vot-pickleball-joola` | Guest & User | `src/app/[locale]/[slug]/page.tsx` (`kind="brand"`) | `Store/Navigation/BreadcrumbBar` (`catalog-sort`), `Store/Trust/GuaranteePills/Category`, `Store/Catalog/FilterBar`, `Store/Product/Card` (`Density=category`), `Store/Catalog/Pagination` |
| 5 | **Danh mục con nhiều cấp (Nested Subcategories)** | `/danh-muc-san-pham/thoi-trang` (`ao-pikpro`, `non-pikpro`, `tui-pikpro`, `tat-pikpro`, `combo-pikpro`), `/danh-muc-san-pham/vot-pickleball/vot-pickleball-honolulu` (`-six-zero`, `-proton`, `-thunder`, `-zocker`), `/danh-muc-san-pham/giay-pickleball/giay-on` (`-kaitashi`, `-zocker`) | `/en/danh-muc-san-pham/...` *(single-segment `/danh-muc-san-pham/<top>` → `308` redirect to `/<top>`)* | Guest & User | `src/app/[locale]/danh-muc-san-pham/[...slug]/page.tsx` | `Store/Navigation/BreadcrumbBar` (`catalog-sort`), `Store/Trust/GuaranteePills/Category`, `Store/Product/Card` (`Density=category`), `Store/Catalog/Pagination` |
| 6 | **Lưu trữ Thương hiệu (`/thuong-hieu/[slug]`)** | `/thuong-hieu/joola`, `/thuong-hieu/selkirk`, `/thuong-hieu/asics`, `/thuong-hieu/skechers`, `/thuong-hieu/kamito`, ... (all 20+ brands) | `/en/thuong-hieu/[slug]` & `/en/brand/[slug]` | Guest & User | `src/app/[locale]/thuong-hieu/[slug]/page.tsx` | `Store/Navigation/BreadcrumbBar` (`catalog-sort`), `Store/Catalog/BrandGroupHeader`, `Store/Product/Card` (`Density=category`), `Store/Catalog/Pagination` |
| 7 | **Chi tiết Sản phẩm (Product Detail Page — 265+ SKUs)** | `/[product-slug]` (e.g. `/joola-perseus-power-fx`, `/vot-pickleball-selkirk-boomstik-st`, `/asics-court-ff-4-nam`) | `/en/[product-slug]` | Guest & User | `src/app/[locale]/[slug]/page.tsx` (`kind="product"`) | `Store/Navigation/BreadcrumbBar` (`pdp-nav`), `Store/PDP/ImageGallery`, `Store/PDP/ColorVariantPicker`, `Store/PDP/ExclusivePromoBox`, `Store/PDP/QuantityAddBar`, `Store/PDP/PolicyTable`, `Store/PDP/TechnicalSpecsTable`, `Store/Section/BoxedTitle` (`SẢN PHẨM TƯƠNG TỰ`), `Store/Product/Card` |
| 8 | **Tin tức Tổng & 4 Chuyên mục Blog** | `/tin-tuc`, `/tin-tuc/kien-thuc-pickleball`, `/tin-tuc/review-danh-gia`, `/tin-tuc/tu-van-dung-cu-pickleball`, `/tin-tuc/tin-tuc-cong-dong` | `/en/tin-tuc`, `/en/tin-tuc/[categorySlug]` (`/en/category/blogs/*` alias) | Guest & User | `src/app/[locale]/tin-tuc/page.tsx` & `src/app/[locale]/tin-tuc/[slug]/page.tsx` | `Store/Navigation/PageHeroBanner`, `Store/News/ArticleCard` (3-col grid), `Store/News/ConsultSidebarForm`, `Store/Catalog/Pagination` |
| 9 | **Chi tiết Bài viết Blog (71+ Editorial Posts)** | Supported at BOTH `/tin-tuc/[post-slug]` AND root `/[post-slug]` (e.g. `/luat-choi-pickleball`, `/vot-pickleball-cho-nguoi-moi`) matching `post-sitemap.xml` | `/en/tin-tuc/[post-slug]` & `/en/[post-slug]` | Guest & User | `src/app/[locale]/tin-tuc/[slug]/page.tsx` & `src/app/[locale]/[slug]/page.tsx` (`kind="post"`) | `Store/Navigation/PageHeroBanner`, `Store/Blog/TableOfContents`, `Store/Blog/EditorialCallout`, `Store/News/ConsultSidebarForm`, `Store/News/ArticleCard` (related posts) |
| 10 | **Liên hệ & Hệ thống 3 Chi nhánh** | `/lien-he` | `/en/lien-he` (`/en/contact` alias) | Guest & User | `src/app/[locale]/lien-he/page.tsx` | `Store/Contact/BranchList` (with 3 showroom map tabs: `QUẬN 10`, `PHÚ NHUẬN`, `HÀ NỘI`), `Store/News/ConsultSidebarForm` |
| 11 | **Về chúng tôi & Thu cũ đổi mới** | `/ve-chung-toi`, `/thu-cu-doi-moi` | `/en/ve-chung-toi`, `/en/thu-cu-doi-moi` | Guest & User | `src/app/[locale]/[slug]/page.tsx` (`kind="page"`) | `Store/Navigation/PageHeroBanner`, `Store/Section/BoxedTitle`, `Store/Marketing/FeatureIconCard/Vision`, `Store/Marketing/FeatureIconCard/TradeInStep`, `Store/Trust/DistributorBanner`, `Store/News/ConsultSidebarForm` |
| 12 | **4 Trang Chính sách & Pháp lý (Footer Col 3)** | `/chinh-sach-van-chuyen`, `/hoan-tien_tra-ve`, `/chinh-sach-bao-mat`, `/quy-dinh-su-dung` | `/en/chinh-sach-van-chuyen`, `/en/hoan-tien_tra-ve`, `/en/chinh-sach-bao-mat`, `/en/quy-dinh-su-dung` | Guest & User | `src/app/[locale]/[slug]/page.tsx` (`kind="policy"`) | `Store/Navigation/BreadcrumbBar`, `Store/Content/PolicyProseLayout` (unified sidebar quick-menu + numbered policy sections), `Store/Blog/EditorialCallout` |
| 13 | **Giỏ hàng (Cart Page)** | `/gio-hang` | `/en/gio-hang` (`/en/cart` alias) | Guest & User | `src/app/[locale]/gio-hang/page.tsx` | `Store/Navigation/BreadcrumbBar`, `Store/Cart/LineItem` (with per-variant bulk price & `- N +` stepper), `Store/Cart/OrderSummaryCard` (with auto-unlocked free gift tier), `Store/Cart/EmptyState` |
| 14 | **Thanh toán & Đặt hàng thành công (Checkout & Order Received)** | `/thanh-toan`, `/thanh-toan/order-received/[orderId]` | `/en/thanh-toan` (`/en/checkout`), `/en/thanh-toan/order-received/[orderId]` | Guest & User | `src/app/[locale]/thanh-toan/page.tsx` & `src/app/[locale]/thanh-toan/order-received/[orderId]/page.tsx` | `Store/Checkout/BillingAddressForm`, `Store/Checkout/PaymentMethodSelector`, `Store/Cart/OrderSummaryCard`, `Store/Checkout/OrderReceivedCard` |
| 15 | **Tài khoản — Khách chưa đăng nhập (Guest Auth)** | `/tai-khoan` (Đăng nhập), `/tai-khoan/lost-password` (Quên mật khẩu) | `/en/tai-khoan` (`/en/my-account`), `/en/tai-khoan/lost-password` | **Guest** | `src/app/[locale]/tai-khoan/page.tsx` & `src/app/[locale]/tai-khoan/lost-password/page.tsx` | `Store/Account/AuthCard/Login`, `Store/Account/AuthCard/LostPassword` |
| 16 | **Tài khoản — Thành viên đã đăng nhập (User Account Portal)** | `/tai-khoan` (Dashboard), `/tai-khoan/orders` (Lịch sử đơn), `/tai-khoan/view-order/[orderId]` (Chi tiết đơn), `/tai-khoan/edit-address` (Sổ địa chỉ), `/tai-khoan/edit-account` (Thông tin & Đổi mật khẩu) | `/en/tai-khoan/*` (`/en/my-account/*`) | **Authenticated User** | `src/app/[locale]/tai-khoan/[[...segment]]/page.tsx` | `Store/Account/DashboardNav`, `Store/Account/OrderTable`, `Store/Checkout/OrderReceivedCard`, `Store/Checkout/BillingAddressForm`, `Store/Account/AuthCard/Login` |
| 17 | **Global Interactive Overlays (Mọi trang)** | Triggered from Header / Floating Dock on any route | Triggered on any `/en/*` route | Guest & User | Mounted in `src/app/[locale]/layout.tsx` | `Store/Header/MegaMenu`, `Store/Navigation/MobileNavDrawer`, `Store/Overlay/SearchOverlay`, `Store/Overlay/MiniCartDrawer`, `Store/Overlay/ZaloConsultantModal` |

### 5.2 Strict Design System Reuse Rule ("Không Được Mỗi Trang Mỗi Kiểu")
1. **Zero One-Off Page Components:** Pages under `src/app/[locale]/**` and feature views under `src/features/**` MUST compose strictly from tokenized Design System components (`src/components/ui/*`, `src/components/layout/*`, `src/components/store/*`) mirrored 1:1 from Figma page `DS · System` ([design-kit.md](file:///d:/Pickball/design-kit.md) — `128` top-level components across Base DS, Icon Library `3:7777`, and Storefront Groups A–E `3:5139`).
2. **Promote-On-2nd-Use Rule:** Whenever any visual pattern appears on 2 or more routes (e.g. `BreadcrumbBar`, `PageHeroBanner`, `PolicyProseLayout`, `BillingAddressForm`, `FeatureIconCard`, `ConsultSidebarForm`, `GuaranteePills`), it MUST live in the shared Design System both on Figma (`DS · System`) and in `src/components/store/` — never duplicated with diverging classes or inline styles inside route files.

---

## 6. Verification Plan
- **Milestone 1 (Figma):** `figma_design_system({ op: "audit" }) === 1.00` (verified across `2,846` nodes), `layout_audit` clean (`0` issues across Groups A–E), `a11y_audit` clean (`0` fails, `0` reviews), `design-kit.md` exported & saved (`4,937` lines, `128` top-level components).
- **Milestone 2 (Next.js Architecture):**
  - `npx tsc --noEmit` (0 errors)
  - `npm run lint` (0 errors)
  - `npm run test` (Vitest passing: bulk-tier & gift pricing math, Vietnamese diacritic-insensitive search ranker, JSON-LD `@graph` validity, crawl-budget canonical/robots matrix, SEO Analyzer DTO + HTML rules, and strict mock-isolation boundary check)
  - `npm run build` (clean production Next.js SSR/ISR build with `sitemap.xml` & `robots.txt` verified)

# PikPro Pickleball — Design System, Storefront Components & Enterprise Next.js Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tokenized Design System and 20 dedicated `mipik.vn`-parity storefront components in Figma file `pickleball`, export `design-kit.md`, and scaffold the complete enterprise Next.js App Router codebase in `d:\Pickball` with centralized bilingual mock data, Repository Pattern, bulk-tier pricing & Vietnamese search domain logic, Enterprise Google SEO Engine, GPU-safe motion, and tokenized UI/layout architecture.

**Architecture:** Milestone 1 establishes Figma file `pickleball` as the single visual source of truth via Reqwise (`ds-mwro6brg-3` + `Storefront` variable collection + 20 `Store/*` reusable components → `design-kit.md`). Milestone 2 builds a strict layered Next.js 16 App Router architecture (`config` → `data/mock` → `repositories` → `domain` → `services` → `lib/seo` & `lib/motion` → `components/ui` & `components/layout` → `app/[locale]`), where all mock data is isolated behind repository interfaces and verified by automated Vitest boundary and SEO checks.

**Tech Stack:** Reqwise Figma MCP (`pickleball`), Next.js 16 (App Router, React 19, TypeScript `strict: true`), Tailwind CSS v4, `next/font/google` (`Inter`), `zod`, `framer-motion` (`LazyMotion`), `lucide-react`, `vitest`, `@testing-library/react`.

**Spec:** [2026-11-22-pickleball-design-system-and-architecture-design.md](file:///d:/Pickball/docs/superpowers/specs/2026-11-22-pickleball-design-system-and-architecture-design.md) and frozen REA baseline [mipik-baseline.md](file:///d:/Pickball/docs/rea-baseline/mipik-baseline.md).

## Global Constraints
- Figma target file is `pickleball` (`pageStrategy: "single"`, Starter 3-page limit — keep DS & custom components on the single `DS · ...` page).
- Primary brand color `#224e40` (sits at `primary/900`), secondary `#f8eee9`, font `Inter` for both heading and body (matching live `mipik.vn`'s actual browser-rendered neutral grotesque after its broken `Livvic` 404 fallback), `radius: "rounded"`, `buttonShape: "pill"`, `fieldStyle: "outline"`.
- Temporary brand name `PikPro` / `PikPro Pickleball` lives exclusively in `src/data/mock/site.mock.ts` (never copy `mipik.vn` real legal entities, real phone numbers, or hotlinked external URLs).
- Zero imports of `src/data/mock/*` outside `src/repositories/mock/*` (enforced by automated test).
- `trailingSlash: false`; URL-based i18n with `vi` at root `/` and `en` at `/en/*`; reciprocal `hreflang` on every indexable route and sitemap entry.
- `robots.txt` disallows only transactional/internal routes (`/gio-hang`, `/thanh-toan`, `/en/gio-hang`, `/en/thanh-toan`, `/api/`); filter query strings stay crawlable with `noindex, follow` + clean canonical; `?page=N` (with no filters) stays `index, follow` with self-canonical.
- Motion animates only `transform`/`opacity` and honors `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- Mobile interactive touch targets `≥ 44px`; desktop pointer-only `Button Size=sm` may be `32px`.

## Review Focus
1. **Duplicate/colliding slugs across categories, brands, and products** — `resolveSlug(slug)` must reject or deterministically prioritize (`category` → `brand` → `product`) and mock fixtures must have globally unique slugs across all 3 collections (pinned in Task 7 test).
2. **Bulk-tier pricing with mixed variants of the same product** — adding 2 units of Variant A + 2 units of Variant B of the same paddle must NOT trigger the `"Mua từ 3 sản phẩm cùng biến thể"` bulk price tier, while still counting 4 units toward cart-level free-gift eligibility (pinned in Task 6 test).
3. **Vietnamese diacritic & punctuation queries in search** — searching `"vot joola perseus"` without accents must rank `"Joola Perseus Power FX"` above partial matches, and empty/whitespace queries must return deterministic featured fallback or empty set without throwing (pinned in Task 6 test).
4. **Filter + pagination combined URLs (`?brand=joola&page=2`)** — combining any filter param with `page=2` must emit `noindex, follow` + canonical to the clean category URL (NOT `index, follow`), whereas bare `?page=2` must emit `index, follow` + `?page=2` canonical (pinned in Task 8 test).
5. **Single-segment legacy `/danh-muc-san-pham/vot-pickleball` vs nested `/danh-muc-san-pham/thoi-trang/ao-pikpro`** — single-segment must trigger `308` permanent redirect to `/vot-pickleball` (preserving `/en` locale prefix when on English), while multi-segment resolves cleanly without redirect loop (pinned in Task 9 test).

---

## Milestone 1: Figma Design System & Dedicated Storefront Components (`pickleball`)

### Task 1: Generate Reqwise Base Design System & Storefront Semantic Variables

**Files:**
- Figma Canvas: `pickleball` (`DS · ...` page via `figma_design_system` & `figma_write`)

**Interfaces:**
- Consumes: Reqwise plan `ds-mwro6brg-3` (re-planned with exact spec `brief` if session plan expired)
- Produces: Base DS variables (`526`), text styles (`20`, `Livvic`), effect styles (`5`), `11` Essentials `COMPONENT_SET`s, plus custom `Storefront` variable collection (`store/brand-forest`, `store/brand-forest-hover`, `store/brand-forest-dark`, `store/accent-cream`, `store/accent-cream-pill`, `store/accent-mint-bg`, `store/accent-mint-border`, `store/accent-mint-ink`, `store/surface-sage`, `store/border-sage`, `store/border-card`, `store/price-sale`, `store/accent-gold`, `store/ink-primary`, `store/ink-secondary`, `store/ink-muted`)

- [ ] **Step 1: Verify connection to Figma file `pickleball`**
  Run `figma_status()`. Confirm `fileName === "pickleball"` and `pluginConnected === true`.

- [ ] **Step 2: Generate approved Reqwise Base Design System**
  Call `figma_design_system({ file: "pickleball", op: "generate", plan: { planId: "ds-mwro6brg-3" } })` (if planId expired, run `op: "plan"` with exact §3.1 brief first, assert `blocking === 0` and `questions.length === 0`, then `generate`).

- [ ] **Step 3: Audit Base Design System token coverage**
  Run `figma_design_system({ file: "pickleball", op: "audit" })`.
  Expected: score === `1.00`.

- [ ] **Step 4: Add `Storefront` semantic color variables on `pickleball`**
  Use `figma_write` (`figma.setupTokens` / `figma.createVariable`) to register all 16 `store/*` color tokens from spec §3.2 so every `Store/*` component binds by `$store/...` token name with zero raw hexes.
  Verify via `figma_read({ file: "pickleball", op: "get_variables" })` that all 16 `store/*` variables exist.

---

### Task 2: Build Storefront Global Chrome Components on Figma (Group A)

**Files:**
- Figma Canvas: `pickleball` (`DS · ...` page, inside a dedicated section/frame `Storefront Components · Chrome`)

**Interfaces:**
- Consumes: Task 1 base DS tokens/text styles (`$store/*`, `Livvic` text styles, `elevation/*`, `radius/*`) and `Atom/Status/Badge` / `Molecule/Action/Button` instances
- Produces: `Store/Header/Desktop` (`Scrolled=false|true`), `Store/Header/Mobile`, `Store/Header/MegaMenu`, `Store/Global/FloatingContactDock`, `Store/Global/Footer` (`Breakpoint=desktop|mobile`)

- [ ] **Step 1: Create `Store/Header/Desktop`, `Store/Header/Mobile`, and `Store/Header/MegaMenu`**
  Build via `figma_write` using Auto Layout, `$store/brand-forest` (`#224E40`) fill, `70px` desktop / `60px` mobile height, highlighted mint nav pill (`$store/accent-mint-bg` + `$store/accent-mint-border` + `$store/accent-mint-ink`), `loadIcon` for search/cart/menu/chevron icons, and Component Properties (`BrandName`, `CartCount`, `Currency`). `MegaMenu` lays out `A–K` and `L–Z` columns with all 20 Pickleball brand items.

- [ ] **Step 2: Create `Store/Global/FloatingContactDock` and `Store/Global/Footer`**
  Build `FloatingContactDock` (4 circular 44×44+ action controls: Hotline, Messenger, Zalo, Back-to-top with named layers) and `Footer` (`Breakpoint=desktop|mobile`, `$store/brand-forest`, 4 columns: Branches & Hotline, Sản phẩm, Thông tin, Blog, plus COD/MasterCard/Visa pills & copyright bar).

- [ ] **Step 3: Run `layout_audit` and `a11y_audit` on Group A frame**
  Run `figma_read({ op: "layout_audit" })` and `figma_read({ op: "a11y_audit" })` on the Group A showcase frame. Fix any blocking layout issue or WCAG contrast/target-size fail before proceeding.

---

### Task 3: Build Storefront Catalog, Product Card & PDP Components on Figma (Group B)

**Files:**
- Figma Canvas: `pickleball` (`DS · ...` page, section/frame `Storefront Components · Commerce`)

**Interfaces:**
- Consumes: Task 1 tokens/styles & Base DS instances
- Produces: `Store/Section/BoxedTitle`, `Store/Product/SwatchStrip`, `Store/Product/Card` (`State=default|sale|new|gift`, `Density=home|category`), `Store/Trust/GuaranteePills` (`Variant=category-3col|home-4col`), `Store/Catalog/BrandGroupHeader`, `Store/Catalog/BrandTile`, `Store/Catalog/FilterBar`, `Store/PDP/ExclusivePromoBox`, `Store/PDP/PolicyTable`, `Store/PDP/QuantityAddBar` (`State=default|out-of-stock`)

- [ ] **Step 1: Create Section Title, SwatchStrip & Product Card (`COMPONENT_SET`)**
  Build `Store/Section/BoxedTitle` (`Breakpoint=desktop|mobile`), `Store/Product/SwatchStrip` (`Overflow=none|plus`, 36×36 variant swatches + `+2` chip), and `Store/Product/Card` (`$store/border-card`, `radius/xl`, 1:1 image frame, dark-green discount & `Mới` badges, mint `TẶNG ÁO` tag, `SwatchStrip` instance, 2-line title, strikethrough + bold price, category-density `THÊM VÀO GIỎ HÀNG` CTA) with Component Properties (`Title`, `Price`, `OriginalPrice`, `DiscountBadge`, `GiftTag`).

- [ ] **Step 2: Create Trust Pills & Catalog Components**
  Build `Store/Trust/GuaranteePills` (`category-3col` `#F1E4D6` pills + `home-4col` dashed trust strip), `Store/Catalog/BrandGroupHeader` (`$store/surface-sage`, `Xem tất cả →`), `Store/Catalog/BrandTile`, and `Store/Catalog/FilterBar`.

- [ ] **Step 3: Create PDP Conversion Components**
  Build `Store/PDP/ExclusivePromoBox` (`$store/surface-sage`, `$store/border-sage`, `✦ ƯU ĐÃI ĐỘC QUYỀN` + brand pill + 3+/5+ bulk-pricing rows + 5+/10+ white gift tiles + `Xem quà tặng ↗`), `Store/PDP/PolicyTable` (4 hairline rows), and `Store/PDP/QuantityAddBar` (`default|out-of-stock`, `44px` height).

- [ ] **Step 4: Run `layout_audit` and `a11y_audit` on Group B frame**
  Verify 0 blocking layout issues and 0 WCAG failures; fix and re-audit if any appear.

---

### Task 4: Build News, Contact & Overlay Components on Figma (Group C) & Export `design-kit.md`

**Files:**
- Figma Canvas: `pickleball` (`DS · ...` page, section/frame `Storefront Components · Content & Overlays`)
- Create: `d:\Pickball\design-kit.md`

**Interfaces:**
- Consumes: Task 1–3 tokens, styles, and base instances (`Molecule/Input/TextField`, `Molecule/Action/Button`, `Organism/Overlay/Dialog`)
- Produces: `Store/News/ArticleCard`, `Store/News/ConsultSidebarForm`, `Store/Contact/BranchList`, `Store/Overlay/SearchOverlay`, `Store/Overlay/MiniCartDrawer`, `Store/Overlay/ZaloConsultantModal`, plus exported `d:\Pickball\design-kit.md`

- [ ] **Step 1: Create News & Contact Components**
  Build `Store/News/ArticleCard` (16:9 thumbnail, centered title, excerpt), `Store/News/ConsultSidebarForm` (`State=default|error|submitted`, `$store/brand-forest` header bar + 4 outlined inputs + CTA), and `Store/Contact/BranchList` (3 branches + social icons + 3 map tabs).

- [ ] **Step 2: Create Interactive Overlay Components**
  Build `Store/Overlay/SearchOverlay` (`State=empty|results`), `Store/Overlay/MiniCartDrawer` (`State=items|empty`, `360px` wide with bulk-savings & free-gift bar), and `Store/Overlay/ZaloConsultantModal` (branch list + copy button).

- [ ] **Step 3: Run final Figma audits & capture verification screenshot**
  Run `layout_audit`, `a11y_audit` on Group C, `figma_design_system({ file: "pickleball", op: "audit" })` (confirm `1.00`), and ONE `figma_read({ op: "screenshot" })` of the Storefront Components section.

- [ ] **Step 4: Export `design-kit.md` snapshot**
  Run `figma_read({ file: "pickleball", op: "generate_design_md" })` and save its markdown output verbatim to `d:\Pickball\design-kit.md`.

---

## Milestone 2: Enterprise Next.js Architecture (`d:\Pickball`)

### Task 5: Initialize Git, Next.js 16 Enterprise Scaffold, Config & Figma Token Bridge

**Files:**
- Create: `d:\Pickball\package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `src/config/env.ts`, `src/config/seo.config.ts`, `src/config/i18n.config.ts`, `src/config/currency.config.ts`
- Create: `src/styles/tokens.css`, `src/app/globals.css`, `src/lib/utils/cn.ts`, `src/lib/utils/vi-text.ts`, `src/lib/utils/format.ts`, `src/lib/motion/presets.ts`, `src/lib/motion/provider.tsx`
- Test: `tests/config/env-and-format.test.ts`

**Interfaces:**
- Consumes: `d:\Pickball\design-kit.md` token names and hex values
- Produces:
  - `env` (`{ DATA_SOURCE: "mock" | "api", SITE_URL: string, API_BASE_URL?: string }`) from `src/config/env.ts`
  - `Locale` (`"vi" | "en"`), `DEFAULT_LOCALE = "vi"`, `SUPPORTED_LOCALES`, `localize(text: LocalizedText, locale: Locale): string` from `src/config/i18n.config.ts`
  - `CurrencyCode` (`"VND" | "USD"`), `formatPrice(amountVnd: number, currency: CurrencyCode, locale?: Locale): string`, `convertFromVnd(amountVnd: number, currency: CurrencyCode): number` from `src/config/currency.config.ts`
  - `stripVietnameseDiacritics(input: string): string`, `slugifyVi(input: string): string` from `src/lib/utils/vi-text.ts`
  - `cn(...inputs: ClassValue[]): string` from `src/lib/utils/cn.ts`
  - `MOTION_PRESETS` & `MotionProvider` from `src/lib/motion/*`

- [ ] **Step 1: Initialize Git repo & install dependencies**
  Run `git init` in `d:\Pickball` (preserving existing `docs/` and `design-kit.md`). Create `package.json` with `next@^16`, `react@^19`, `react-dom@^19`, `zod`, `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`, and devDeps `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss@^4`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`. Run `npm install`.

- [ ] **Step 2: Configure TypeScript, Next.js, Vitest & Tailwind v4 Token Bridge**
  Write `tsconfig.json` (`strict: true`, `@/*` → `./src/*`), `next.config.ts` (`trailingSlash: false`, `images: { formats: ["image/avif", "image/webp"] }`, `compress: true`, security/cache headers), `vitest.config.ts`, `src/styles/tokens.css` (exact CSS variables matching `design-kit.md` + `store/*` variables), and `src/app/globals.css` (`@import "tailwindcss"; @theme inline { ... }`, `mipikSoftShine` shimmer keyframes guarded by `prefers-reduced-motion`).

- [ ] **Step 3: Write failing unit tests in `tests/config/env-and-format.test.ts`**
  Assert: `parseEnv({})` defaults to `DATA_SOURCE: "mock"` and valid `SITE_URL`; `stripVietnameseDiacritics("Vợt Pickleball Chính Hãng")` returns `"vot pickleball chinh hang"`; `formatPrice(5100000, "VND")` contains `"5.100.000"` and `"₫"`; `formatPrice(5100000, "USD")` returns formatted `"$"` amount; `localize({ vi: "Vợt", en: "Paddle" }, "en")` returns `"Paddle"`.

- [ ] **Step 4: Run test to verify failure, then implement `src/config/*`, `src/lib/utils/*`, `src/lib/motion/*`**
  Run `npx vitest run tests/config/env-and-format.test.ts` (expect FAIL), implement modules, re-run (expect PASS).

- [ ] **Step 5: Commit Task 5**
  `git add -A && git commit -m "chore: scaffold enterprise Next.js 16 foundation and Figma token bridge"`

---

### Task 6: Domain Entities, Bulk-Tier Pricing & Vietnamese Search Ranker (TDD)

**Files:**
- Create: `src/domain/entities/common.ts`, `src/domain/entities/product.ts`, `src/domain/entities/category.ts`, `src/domain/entities/post.ts`, `src/domain/entities/store.ts`, `src/domain/entities/site.ts`, `src/domain/entities/cart.ts`, `src/domain/entities/index.ts`
- Create: `src/domain/pricing/bulk-pricing.ts`
- Create: `src/domain/search/search-ranker.ts`
- Test: `tests/domain/bulk-pricing.test.ts`, `tests/domain/search-ranker.test.ts`

**Interfaces:**
- Consumes: `LocalizedText` (`{ vi: string; en: string }`), `stripVietnameseDiacritics` from Task 5
- Produces:
  - Zod schemas & TS types: `Product`, `ProductVariant`, `BulkPriceTier`, `GiftTier`, `Category`, `Brand`, `BannerSlide`, `BlogPost`, `StoreBranch`, `SiteConfig`, `CartLineInput`, `CartPricingSummary`
  - `calculateCartPricing(lines: CartLineInput[], catalogById: Map<string, Product>, globalGiftTiers: GiftTier[]): CartPricingSummary`
  - `rankProducts(products: Product[], query: string, locale: Locale): Product[]`

- [ ] **Step 1: Write failing tests in `tests/domain/bulk-pricing.test.ts`**
  Cover all spec & Review Focus rules:
  1. Qty 1–2 uses `salePrice ?? basePrice`.
  2. Qty 3 of **same `variantId`** switches unit price to Tier 3 (`5_000_000₫`), non-stacking with `salePrice`.
  3. Qty 5 of **same `variantId`** switches unit price to Tier 5 (`4_900_000₫`).
  4. **Review Focus #2:** Qty 2 of Variant A + Qty 2 of Variant B of the same product does NOT trigger Tier 3 bulk price (per-variant rule), while total cart qty (4) counts toward gift progress and Qty 3A + 2B = 5 total unlocks `"1 áo"` gift!
  5. Qty 10 unlocks ONLY highest non-stacking gift tier (`"2 áo + 1 túi"`), NOT both 5 and 10.
  6. Qty `<= 0` is safely ignored / sanitized.

- [ ] **Step 2: Write failing tests in `tests/domain/search-ranker.test.ts`**
  Cover Review Focus #3:
  1. `"vot joola perseus"` (accent-free) ranks `"Joola Perseus Power FX"` #1 above other Joola paddles.
  2. Exact SKU match ranks #1.
  3. Empty/whitespace query returns `[]` cleanly without throwing.
  4. English locale query `"carbon paddle"` matches English localized fields.

- [ ] **Step 3: Run tests to verify failure**
  Run `npx vitest run tests/domain/` → expect FAIL.

- [ ] **Step 4: Implement `src/domain/entities/*`, `src/domain/pricing/bulk-pricing.ts`, and `src/domain/search/search-ranker.ts`**
  Implement strict Zod schemas and pure domain functions (zero Next.js/React imports).

- [ ] **Step 5: Run tests to verify pass & commit**
  Run `npx vitest run tests/domain/` → expect PASS.
  Commit: `git commit -m "feat(domain): add entity schemas, per-variant bulk pricing, and Vietnamese search ranker"`

---

### Task 7: Centralized Bilingual Mock Vault, Repository Pattern, Services & Mock-Isolation Gate (TDD)

**Files:**
- Create: `public/images/mock/*.svg` (clean local vector placeholders for hero desktop/mobile, paddles, fashion, shoes, bags, accessories, brands, news, showroom)
- Create: `src/data/mock/site.mock.ts`, `src/data/mock/banners.mock.ts`, `src/data/mock/categories.mock.ts`, `src/data/mock/products.mock.ts`, `src/data/mock/posts.mock.ts`, `src/data/mock/stores.mock.ts`, `src/data/mock/index.ts`, `src/data/mock/README.md`
- Create: `src/repositories/contracts/index.ts`, `src/repositories/mock/*.ts`, `src/repositories/api/*.ts`, `src/repositories/index.ts`
- Create: `src/services/catalog.service.ts`, `src/services/product.service.ts`, `src/services/content.service.ts`, `src/services/search.service.ts`, `src/services/site.service.ts`, `src/services/index.ts`
- Test: `tests/repositories/mock-isolation.test.ts`, `tests/repositories/mock-integrity.test.ts`

**Interfaces:**
- Consumes: Task 6 domain entities, `env` from Task 5
- Produces:
  - Repository contracts: `IProductRepository`, `ICategoryRepository`, `IPostRepository`, `IStoreRepository`, `ISiteRepository`
  - Factory: `getRepositories()` returning mock or api adapters based on `env.DATA_SOURCE`
  - Services: `catalogService.resolveSlug(slug)` → `{ kind: "category", data } | { kind: "brand", data } | { kind: "product", data } | null`, `catalogService.getHomeRails()`, `catalogService.filterCatalog(params)`, `productService.getProductWithRelated(slug)`, `contentService.getPosts()`, `contentService.getPostBySlug(slug)`, `searchService.search(query, locale)`, `siteService.getSiteBundle()`

- [ ] **Step 1: Write failing tests in `tests/repositories/mock-isolation.test.ts` and `tests/repositories/mock-integrity.test.ts`**
  Assert:
  1. Static scan of all `.ts`/`.tsx` files under `src/` finds **zero** imports referencing `data/mock` outside `src/repositories/mock/`.
  2. Every mock entity validates against its Zod schema (`ProductSchema`, `CategorySchema`, `BrandSchema`, `BlogPostSchema`, `StoreBranchSchema`, `SiteConfigSchema`).
  3. **Review Focus #1:** Globally unique slugs across all categories, brands, and products (zero collisions).
  4. Every 5 homepage rails (`vot-pickleball`, `thoi-trang`, `giay-pickleball`, `balo-tui-pickleball`, `phu-kien-pickleball`) has mock products, all 20 Pickleball brands exist, and zero image URLs hotlink `mipik.vn`.

- [ ] **Step 2: Run tests to verify failure**
  Run `npx vitest run tests/repositories/` → expect FAIL.

- [ ] **Step 3: Create local mock assets, centralized bilingual `src/data/mock/*` (+ `README.md`), repositories & services**
  Keep `src/data/mock/*` strictly as pure data fixtures using temporary brand `PikPro`, with complete bilingual VI/EN content, color variant swatches, bulk pricing tiers, free gift tiers, specs, FAQs, and internal cross-links. Implement typed `src/repositories/api/*` fetch adapter skeletons for clean future swap.

- [ ] **Step 4: Run tests to verify pass & commit**
  Run `npx vitest run tests/repositories/` → expect PASS.
  Commit: `git commit -m "feat(data): add centralized bilingual mock vault, repository pattern, and isolation gate"`

---

### Task 8: Enterprise Google SEO Engine (`metadata`, `@graph` JSON-LD, Crawl-Budget Guard, Internal Links & SEO Analyzer — TDD)

**Files:**
- Create: `src/lib/seo/crawl-budget.ts`, `src/lib/seo/metadata.ts`, `src/lib/seo/jsonld.ts`, `src/lib/seo/internal-links.ts`, `src/lib/seo/analyzer.ts`, `src/lib/seo/index.ts`
- Test: `tests/seo/seo-engine.test.ts`

**Interfaces:**
- Consumes: Task 5 config (`seo.config.ts`, `i18n.config.ts`, `currency.config.ts`), Task 6 entities
- Produces:
  - `evaluateCrawlPolicy(basePath: string, searchParams: Record<string, string | string[] | undefined>, locale: Locale): { index: boolean; follow: boolean; canonicalUrl: string }`
  - `buildPageMetadata(input: PageSeoInput): Metadata` (Next.js `Metadata` with `alternates.canonical`, `alternates.languages` (`vi`, `en`, `x-default`), `robots`, `openGraph`, `twitter`)
  - `buildGlobalGraph(site: SiteConfig, stores: StoreBranch[], locale: Locale)` (`Organization` + `WebSite` w/ `SearchAction` + `SportingGoodsStore[]`)
  - `buildCategoryGraph(...)` (`BreadcrumbList` + `CollectionPage` + `ItemList`)
  - `buildProductGraph(...)` (`BreadcrumbList` + `Product` + `Offer` w/ `priceCurrency` `"VND"|"USD"` & `UnitPriceSpecification` bulk tiers + `AggregateRating` + `FAQPage`)
  - `buildArticleGraph(...)` (`BreadcrumbList` + `Article` + `FAQPage`)
  - `buildInternalLinkCluster(product: Product, allProducts: Product[], posts: BlogPost[], locale: Locale)`
  - `analyzeSeoDto(input)` & `analyzeSeoHtml(html: string)` → `{ score: number; passed: boolean; issues: SeoIssue[] }`

- [ ] **Step 1: Write failing tests in `tests/seo/seo-engine.test.ts`**
  Assert:
  1. `evaluateCrawlPolicy("/cua-hang", {}, "vi")` → `index: true, follow: true, canonical: "<SITE_URL>/cua-hang"`.
  2. `evaluateCrawlPolicy("/cua-hang", { page: "2" }, "vi")` → `index: true, follow: true, canonical: "<SITE_URL>/cua-hang?page=2"`.
  3. **Review Focus #4:** `evaluateCrawlPolicy("/cua-hang", { brand: "joola", page: "2" }, "vi")` → `index: false, follow: true, canonical: "<SITE_URL>/cua-hang"`.
  4. `buildPageMetadata` emits reciprocal `vi`, `en`, and `x-default` `hreflang` URLs cleanly (`/` vs `/en`).
  5. `buildProductGraph` emits `"VND"` on `vi`, `"USD"` on `en`, includes `UnitPriceSpecification` for bulk tiers, `AggregateRating`, `BreadcrumbList`, and `FAQPage`.
  6. `analyzeSeoHtml` **fails** when HTML has 2 `<h1>` tags (catches `mipik.vn`'s real PDP bug), missing `alt` on `<img>`, or missing `<link rel="canonical">`, and **passes** (score `>= 90`) on compliant semantic HTML.

- [ ] **Step 2: Run tests to verify failure**
  Run `npx vitest run tests/seo/seo-engine.test.ts` → expect FAIL.

- [ ] **Step 3: Implement `src/lib/seo/*`**
  Implement all 5 modules cleanly with strict Schema.org typing.

- [ ] **Step 4: Run tests to verify pass & commit**
  Run `npx vitest run tests/seo/seo-engine.test.ts` → expect PASS.
  Commit: `git commit -m "feat(seo): build enterprise Google SEO engine, JSON-LD graph, crawl-budget guard, and analyzer"`

---

### Task 9: Tokenized UI Primitives, Storefront Shell, Middleware & Full App Router SSR Architecture

**Files:**
- Create: `src/middleware.ts`
- Create: `src/components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `dialog.tsx`, `drawer.tsx`, `pill.tsx`, `stepper.tsx`, `skeleton.tsx`, `json-ld-script.tsx`, `index.ts`
- Create: `src/components/layout/store-context.tsx`, `header.tsx`, `mega-menu.tsx`, `footer.tsx`, `floating-contact-dock.tsx`, `search-overlay.tsx`, `mini-cart-drawer.tsx`, `zalo-consultant-modal.tsx`, `index.ts`
- Create: `src/features/home/home-shell.tsx`, `src/features/catalog/catalog-shell.tsx`, `src/features/product-detail/pdp-shell.tsx`, `src/features/news/news-shell.tsx`, `src/features/contact/contact-shell.tsx`, `src/features/cart/cart-shell.tsx`
- Create: `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`, `src/app/opengraph-image.tsx`, `src/app/api/health/route.ts`, `src/app/api/consult/route.ts`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/[slug]/page.tsx` (`category | brand | product | post | policy | page`), `src/app/[locale]/danh-muc-san-pham/[...slug]/page.tsx`, `src/app/[locale]/thuong-hieu/[slug]/page.tsx`, `src/app/[locale]/cua-hang/page.tsx`, `src/app/[locale]/tin-tuc/page.tsx`, `src/app/[locale]/tin-tuc/[slug]/page.tsx` (`blogCategory | post`), `src/app/[locale]/lien-he/page.tsx`, `src/app/[locale]/gio-hang/page.tsx`, `src/app/[locale]/thanh-toan/page.tsx`, `src/app/[locale]/thanh-toan/order-received/[orderId]/page.tsx`, `src/app/[locale]/tai-khoan/[[...segment]]/page.tsx` (Guest Login / Lost-Password + User Dashboard / Orders / View-Order / Edit-Address / Edit-Account), `src/app/[locale]/not-found.tsx`
- Create: `src/components/store/*` (shared tokenized Storefront Design System components mapped 1:1 from Figma Groups A–E so zero routes use ad-hoc one-off UI)
- Test: `tests/app/routing-and-seo-routes.test.ts`

**Interfaces:**
- Consumes: Tasks 5–8 (`config`, `services`, `lib/seo`, `lib/motion`, `styles/tokens.css`)
- Produces: Complete working Next.js 16 enterprise storefront architecture with live `Header` (mint shimmer pill, MegaMenu, Search, Cart, VI/EN route switcher, VND/USD currency switcher), `Footer`, `FloatingContactDock`, `SearchOverlay`, `MiniCartDrawer`, `ZaloConsultantModal`, bilingual SSR routes, dynamic `sitemap.xml` & `robots.txt`, and `/api/health` + `/api/consult`.

- [ ] **Step 1: Write failing tests in `tests/app/routing-and-seo-routes.test.ts`**
  Assert:
  1. `robots()` disallows `/gio-hang`, `/thanh-toan`, `/en/gio-hang`, `/en/thanh-toan`, `/api/` and does NOT disallow `?*` query params.
  2. `sitemap()` includes `/`, all categories, brands, products, and blog posts, each with `alternates.languages` (`vi` and `en`).
  3. **Review Focus #5:** `resolveCategoryPathRedirect(["vot-pickleball"], "vi")` returns `"/vot-pickleball"` and `resolveCategoryPathRedirect(["vot-pickleball"], "en")` returns `"/en/vot-pickleball"` (for `308` redirect), while `resolveCategoryPathRedirect(["thoi-trang", "ao-pikpro"], "vi")` returns `null` (valid nested subcategory).
  4. `/api/consult` rejects invalid payloads (`400`) and accepts valid consultation payload (`200`).

- [ ] **Step 2: Run tests to verify failure**
  Run `npx vitest run tests/app/routing-and-seo-routes.test.ts` → expect FAIL.

- [ ] **Step 3: Implement `middleware.ts`, `src/components/ui/*`, `src/components/layout/*`, `src/features/*` shells, and `src/app/*` routes**
  Load `Inter` via `next/font/google` in `src/app/[locale]/layout.tsx`; wrap with `MotionProvider` + `StoreProvider`; emit global `@graph` JSON-LD; enforce strictly 1 `<h1>` per route; wire `generateStaticParams` & `generateMetadata` on every dynamic route.

- [ ] **Step 4: Run complete verification suite**
  1. `npx tsc --noEmit` → 0 errors
  2. `npm run lint` → 0 errors
  3. `npm run test` → 100% PASS (all domain, repository isolation, SEO engine, and routing tests)
  4. `npm run build` → clean production Next.js build with `sitemap.xml`, `robots.txt`, and bilingual routes compiled cleanly

- [ ] **Step 5: Commit Task 9**
  `git add -A && git commit -m "feat(app): wire tokenized UI kit, storefront shell, and bilingual SEO App Router architecture"`

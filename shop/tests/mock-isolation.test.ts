import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchArticles,
  fetchCategoryDetail,
  fetchHomeData,
  fetchProducts,
  getAllBrandsList,
  getAllCategoriesList,
  getAllPolicyPages,
  getAllProgramPages,
  resolveRootSlug,
} from "@/lib/storefront";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("Shop Centralized Mock Vault, Global Slug Uniqueness & Navigation Coverage", () => {
  it("enforces zero direct imports of src/data/mock outside src/data/mock and src/repositories/mock", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const files = collectFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const normalized = file.replace(/\\/g, "/");
      if (
        normalized.includes("/src/data/mock/") ||
        normalized.includes("/src/repositories/mock/")
      ) {
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      if (/from\s+["'][^"']*data\/mock/.test(content)) {
        violations.push(normalized);
      }
    }

    expect(violations).toEqual([]);
  });

  it("Review Focus #1 & Important #1: guarantees globally unique root slugs across all collections and resolves every entity type", async () => {
    const [home, products, articles] = await Promise.all([
      fetchHomeData(),
      fetchProducts({ limit: 100 }),
      fetchArticles({ limit: 50 }),
    ]);

    expect(home).not.toBeNull();
    expect(home?.categoryBlocks.length).toBeGreaterThanOrEqual(5);
    expect(home?.brands.length).toBeGreaterThanOrEqual(20);

    const categories = getAllCategoriesList();
    const brands = getAllBrandsList();
    const policies = getAllPolicyPages();
    const programs = getAllProgramPages();

    const seen = new Map<string, string>();
    const register = (slug: string, kind: string) => {
      const existing = seen.get(slug);
      expect(
        existing,
        `Colliding root slug "${slug}" between ${existing} and ${kind}`
      ).toBeUndefined();
      seen.set(slug, kind);
    };

    categories.forEach((c) => register(c.slug, "category"));
    brands.forEach((b) => register(b.rootCategorySlug, "brand-root"));
    products.data.forEach((p) => register(p.slug, "product"));
    articles.data.forEach((a) => register(a.slug, "article"));
    policies.forEach((pol) => register(pol.slug, "policy"));
    programs.forEach((prog) => register(prog.slug, "program"));

    expect((await resolveRootSlug("vot-pickleball"))?.kind).toBe("category");
    expect((await resolveRootSlug("vot-pickleball-joola"))?.kind).toBe("brand");
    expect((await resolveRootSlug("joola-perseus-power-fx"))?.kind).toBe("product");
    expect((await resolveRootSlug("luat-choi-pickleball"))?.kind).toBe("article");
    expect((await resolveRootSlug("chinh-sach-van-chuyen"))?.kind).toBe("policy");
    expect((await resolveRootSlug("thu-cu-doi-moi"))?.kind).toBe("program");
  });

  it("Critical #3 & Important #2/#5: resolves all nested MegaMenu paddle/shoe/fashion subcategories with non-empty products, accurate dynamic bulk tier labels, and diacritic-free article search", async () => {
    const nestedSlugs = [
      "vot-pickleball-honolulu",
      "vot-pickleball-proton",
      "vot-pickleball-six-zero",
      "vot-pickleball-thunder",
      "vot-pickleball-zocker",
      "giay-on",
      "giay-kaitashi",
      "combo-pikpro",
      "ao-pikpro",
      "non-pikpro",
      "tui-pikpro",
      "tat-pikpro",
    ];

    for (const slug of nestedSlugs) {
      const catDetail = await fetchCategoryDetail(slug);
      expect(catDetail.notFound, `Expected ${slug} not to 404`).toBe(false);
      expect(catDetail.data?.category.slug).toBe(slug);

      const prodRes = await fetchProducts({ category: slug });
      expect(
        prodRes.data.length,
        `Expected category ${slug} to return >= 1 products`
      ).toBeGreaterThan(0);
    }

    // Dynamic bulk tier labels must reflect each product's actual sellingPrice (never hardcode Joola's 5.000.000₫ on Kamito)
    const kamito = await resolveRootSlug("vot-pickleball-kamito-alpha");
    expect(kamito?.kind).toBe("product");
    if (kamito?.kind === "product") {
      const tier3Label = kamito.product.promotions?.tierPricing?.[0]?.label || "";
      expect(tier3Label).toContain("2.290.000₫");
      expect(tier3Label).not.toContain("5.000.000₫");
    }

    // Accent-free article search ("luat choi")
    const articleHits = await fetchArticles({ q: "luat choi" });
    expect(articleHits.data.length).toBeGreaterThan(0);
    expect(articleHits.data[0]?.slug).toBe("luat-choi-pickleball");
  });

  it("mocks all 100% of API Contract v5.0 /api/v1/public/* GET and POST endpoints directly inside apiFetch when NEXT_PUBLIC_DATA_SOURCE=mock", async () => {
    const { apiFetch } = await import("@/lib/api");

    // 1. GET /public/home & /public/settings & /public/menu
    const homeRes = await apiFetch<{ data: { categoryBlocks: unknown[]; brands: unknown[] } }>("/public/home");
    expect(homeRes.data.categoryBlocks.length).toBeGreaterThanOrEqual(5);

    const settingsRes = await apiFetch<{ data: { siteName: string } }>("/public/settings");
    expect(settingsRes.data.siteName).toBeTruthy();

    const menuRes = await apiFetch<{ data: Array<{ label: string; url: string }> }>("/public/menu");
    expect(menuRes.data.length).toBeGreaterThanOrEqual(5);

    // 2. POST /public/cart/price (per-variant bulk pricing 3+/5+, coupon SALE11, non-stacking gift 5+/10+)
    const cartPriceRes = await apiFetch<{
      data: {
        rawSubtotal: number;
        tierDiscountTotal: number;
        couponDiscount: number;
        couponApplied: { code: string } | null;
        eligibleGifts: Array<{ productName: string }>;
        totalAmount: number;
      };
    }>("/public/cart/price", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            productId: "prod-joola-perseus-power-fx",
            variantKey: "prod-joola-perseus-power-fx__blaze-red__16mm-(control)",
            quantity: 5,
          },
        ],
        couponCode: "SALE11",
        province: "Hồ Chí Minh",
      }),
    });
    expect(cartPriceRes.data.tierDiscountTotal).toBe(1_000_000); // 5 * 200k per-variant discount
    expect(cartPriceRes.data.couponDiscount).toBe(100_000);
    expect(cartPriceRes.data.couponApplied?.code).toBe("SALE11");
    expect(cartPriceRes.data.eligibleGifts.length).toBe(1);

    // 3. POST /public/orders & GET /public/orders/lookup & GET /public/orders/:code/payment-status
    const createOrderRes = await apiFetch<{
      data: {
        orderCode: string;
        totalAmount: number;
        paymentGateway: string;
        paymentStatus: string;
        fulfillmentStatus: string;
        qrCode?: string;
      };
    }>("/public/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            productId: "prod-joola-perseus-power-fx",
            variantKey: "prod-joola-perseus-power-fx__blaze-red__16mm-(control)",
            quantity: 1,
          },
        ],
        shippingAddress: {
          fullName: "Nguyễn Văn Pickleball",
          phone: "0901234567",
          province: "Hồ Chí Minh",
          district: "Quận 7",
          ward: "Phường Tân Phong",
          addressLine: "180 Nguyễn Thị Thập",
        },
        paymentGateway: "PAYOS",
      }),
    });
    expect(createOrderRes.data.orderCode).toMatch(/^ONL-/);
    expect(createOrderRes.data.paymentGateway).toBe("PAYOS");
    expect(createOrderRes.data.qrCode).toBeTruthy();

    const lookupRes = await apiFetch<{ data: { orderCode: string } }>(
      "/public/orders/lookup",
      {
        params: {
          code: "ONL-20261120-0188",
          phone: "0901234567",
        },
      }
    );
    expect(lookupRes.data.orderCode).toBe("ONL-20261120-0188");

    const paymentStatusRes = await apiFetch<{
      data: { orderCode: string; paymentStatus: string };
    }>(`/public/orders/${createOrderRes.data.orderCode}/payment-status`);
    expect(paymentStatusRes.data.orderCode).toBe(createOrderRes.data.orderCode);

    // 4. Customer Auth & Profile: request-otp, verify-otp, /me, /me/orders
    const otpRes = await apiFetch<{ message: string; expiresInSeconds: number }>(
      "/public/customers/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ identifier: "khach@mipik.vn", channel: "EMAIL" }),
      }
    );
    expect(otpRes.expiresInSeconds).toBe(300);

    const verifyRes = await apiFetch<{
      data: { token: string; customer: { email: string } };
    }>("/public/customers/verify-otp", {
      method: "POST",
      body: JSON.stringify({ identifier: "khach@mipik.vn", otp: "123456" }),
    });
    expect(verifyRes.data.token).toBeTruthy();
    expect(verifyRes.data.customer.email).toBe("khach@mipik.vn");

    const meOrdersRes = await apiFetch<{ data: Array<{ orderCode: string }> }>(
      "/public/customers/me/orders"
    );
    expect(meOrdersRes.data.length).toBeGreaterThan(0);

    // 5. Contact & Review submission & Search Suggest & Sitemap Data
    const contactRes = await apiFetch<{ message: string }>("/public/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        phone: "0901234567",
        message: "Tư vấn vợt Joola 16mm",
      }),
    });
    expect(contactRes.message).toContain("Cảm ơn");

    const reviewPostRes = await apiFetch<{
      data: { status: string };
      message: string;
    }>("/public/reviews", {
      method: "POST",
      body: JSON.stringify({
        productId: "prod-joola-perseus-power-fx",
        rating: 5,
        comment: "Vợt đánh rất đầm tay!",
      }),
    });
    expect(reviewPostRes.data.status).toBe("PENDING");

    const suggestRes = await apiFetch<{
      data: { products: unknown[]; articles: unknown[] };
    }>("/public/search/suggest", { params: { q: "joola" } });
    expect(suggestRes.data.products.length).toBeGreaterThan(0);

    // 6. All mock SVG assets in public/images/mock/*.svg must have valid XML (zero unescaped '&')
    const mockSvgDir = path.resolve(process.cwd(), "public", "images", "mock");
    if (fs.existsSync(mockSvgDir)) {
      for (const file of fs.readdirSync(mockSvgDir)) {
        if (!file.endsWith(".svg")) continue;
        const svgContent = fs.readFileSync(path.join(mockSvgDir, file), "utf8");
        expect(
          /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(svgContent),
          `Invalid unescaped '&' in mock SVG: ${file}`
        ).toBe(false);
      }
    }

    // 7. Zero legacy 11 Sport Tailwind tokens remain in shop/src/components or shop/src/app
    const legacyTokenRe =
      /\b(brand-primary|accent-volt|accent-hot|brand-tint|brand-border|surface-border)\b/;
    const legacyViolations: string[] = [];
    for (const file of collectFiles(path.resolve(process.cwd(), "src"))) {
      if (!file.endsWith(".tsx")) continue;
      const content = fs.readFileSync(file, "utf8");
      if (legacyTokenRe.test(content)) {
        legacyViolations.push(file.replace(/\\/g, "/"));
      }
    }
    expect(legacyViolations).toEqual([]);
  });
});

describe("P0 & P1 Contracts · 11sport Fashion Aliases & Strict API Mode", () => {
  let prevDataSource: string | undefined;

  beforeEach(() => {
    prevDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
  });

  afterEach(() => {
    if (prevDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = prevDataSource;
    }
    vi.unstubAllGlobals();
  });

  it("resolves ao-11sport, non-11sport, tui-11sport, tat-11sport, and combo-11sport slugs in mock mode", async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
    const slugs = [
      "ao-11sport",
      "non-11sport",
      "tui-11sport",
      "tat-11sport",
      "combo-11sport",
    ];
    for (const slug of slugs) {
      const catRes = await fetchCategoryDetail(slug);
      expect(catRes.notFound, `Expected category ${slug} to resolve`).toBeFalsy();
      expect(catRes.data?.category.slug).toBe(slug.replace("-11sport", "-pikpro"));

      const prodRes = await fetchProducts({ category: slug });
      expect(
        prodRes.data.length,
        `Expected category ${slug} to return products`
      ).toBeGreaterThan(0);

      const resolved = await resolveRootSlug(slug);
      expect(resolved?.kind, `Expected root slug ${slug} to resolve`).toBe("category");
    }
  });

  it("enforces strict API mode with zero silent mock fallback when BE returns empty or 404", async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = "api";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [],
            meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const productsRes = await fetchProducts({ limit: 12 });
    expect(productsRes.data).toEqual([]);
    expect(productsRes.meta.total).toBe(0);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              _id: "cat-vot",
              name: "Vợt Pickleball",
              slug: "vot-pickleball",
              products: [],
              brands: [{ _id: "b-joola", name: "Joola", slug: "joola" }],
              meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const catDetail = await fetchCategoryDetail("vot-pickleball");
    expect(catDetail.notFound).toBe(false);
    expect(catDetail.data?.category.slug).toBe("vot-pickleball");
    expect(catDetail.data?.brands?.length).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const notFoundCat = await fetchCategoryDetail("non-existent-category");
    expect(notFoundCat.notFound).toBe(true);
    expect(notFoundCat.data).toBeNull();
  });

  it("guarantees every mock product has at least 2 unique images for consistent hover & gallery swap", async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
    const res = await fetchProducts({ limit: 50 });
    expect(res.data.length).toBeGreaterThan(0);

    for (const prod of res.data) {
      const uniqueUrls = new Set(
        [
          prod.thumbnailUrl,
          ...(prod.images ?? []).map((img) => img.url),
          ...(prod.colors ?? []).map((c) => c.imageUrl),
        ].filter((u): u is string => Boolean(u && u.trim()))
      );
      expect(
        uniqueUrls.size,
        `Product "${prod.slug}" must have >= 2 unique image URLs`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

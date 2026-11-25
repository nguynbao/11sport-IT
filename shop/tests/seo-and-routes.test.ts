import { describe, expect, it } from "vitest";
import {
  analyzeSeoHtml,
  buildMetadata,
  buildProductJsonLd,
  evaluateCrawlPolicy,
  resolveNestedCategoryRedirect,
} from "@/lib/seo";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("Shop Enterprise Google SEO Engine & Routing Policies", () => {
  it("Review Focus #4 & Critical #4: applies crawl-budget policy accurately for clean, paginated, and filtered URLs (including ?category=)", () => {
    const clean = evaluateCrawlPolicy("/cua-hang", {});
    expect(clean.index).toBe(true);
    expect(clean.follow).toBe(true);
    expect(clean.canonicalPath).toBe("/cua-hang");

    const page2 = evaluateCrawlPolicy("/cua-hang", { page: "2" });
    expect(page2.index).toBe(true);
    expect(page2.follow).toBe(true);
    expect(page2.canonicalPath).toBe("/cua-hang?page=2");

    const filteredAndPaged = evaluateCrawlPolicy("/cua-hang", {
      brand: "joola",
      page: "2",
    });
    expect(filteredAndPaged.index).toBe(false);
    expect(filteredAndPaged.follow).toBe(true);
    expect(filteredAndPaged.canonicalPath).toBe("/cua-hang");

    const categoryFiltered = evaluateCrawlPolicy("/cua-hang", {
      category: "vot-pickleball",
      page: "2",
    });
    expect(categoryFiltered.index).toBe(false);
    expect(categoryFiltered.follow).toBe(true);
    expect(categoryFiltered.canonicalPath).toBe("/cua-hang");
  });

  it("Critical #1 & Important #2: emits self-canonical on /en/* routes, reciprocal vi/en/x-default hreflang, and filters out invalid <= 0 bulk tier prices in Product JSON-LD", () => {
    const viMeta = buildMetadata({
      title: "Vợt Pickleball Joola Perseus Power FX",
      path: "/joola-perseus-power-fx",
      locale: "vi",
    });
    expect(viMeta.alternates?.canonical).toContain("/joola-perseus-power-fx");
    expect(viMeta.alternates?.canonical).not.toContain("/en/");

    const enMeta = buildMetadata({
      title: "Joola Perseus Power FX Pickleball Paddle",
      path: "/joola-perseus-power-fx",
      locale: "en",
    });
    expect(enMeta.alternates?.canonical).toContain("/en/joola-perseus-power-fx");
    const langs = enMeta.alternates?.languages as Record<string, string> | undefined;
    expect(langs?.vi).toContain("/joola-perseus-power-fx");
    expect(langs?.en).toContain("/en/joola-perseus-power-fx");
    expect(langs?.["x-default"]).toContain("/joola-perseus-power-fx");

    const jsonLd = buildProductJsonLd({
      name: "Bộ Quấn Cán",
      description: "Phụ kiện",
      slug: "bo-quan-can-dan-vien-vot-pickleball",
      sku: "PK-GRIP-03",
      brandName: "Joola",
      images: ["/images/mock/acc-overgrip.svg"],
      price: 150_000,
      inStock: true,
      bulkTiers: [
        { minQty: 3, unitPrice: 0, label: "Invalid zero price" },
        { minQty: 5, unitPrice: -50_000, label: "Invalid negative price" },
      ],
    });
    expect(jsonLd.offers.priceSpecification).toBeUndefined();
  });

  it("Review Focus #5 & Critical #4: redirects single-segment /danh-muc-san-pham/<top> (308) preserving locale and avoids duplicate article URLs in sitemap.xml", async () => {
    expect(resolveNestedCategoryRedirect(["vot-pickleball"], "vi")).toBe(
      "/vot-pickleball"
    );
    expect(resolveNestedCategoryRedirect(["vot-pickleball"], "en")).toBe(
      "/en/vot-pickleball"
    );
    expect(
      resolveNestedCategoryRedirect(["thoi-trang", "ao-pikpro"], "vi")
    ).toBeNull();

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/luat-choi-pickleball"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/tin-tuc/luat-choi-pickleball"))).toBe(
      false
    );
  });

  it("rejects duplicate H1 tags in analyzeSeoHtml (catching mipik.vn PDP defect) and keeps robots.txt filter-crawlable", () => {
    const badHtml =
      '<html><head><link rel="canonical" href="https://pikpro.vn/p"/></head><body><h1>One</h1><h1>Two</h1></body></html>';
    const badReport = analyzeSeoHtml(badHtml);
    expect(badReport.passed).toBe(false);
    expect(badReport.issues.some((i) => i.code === "DUPLICATE_H1")).toBe(true);

    const goodHtml =
      '<html><head><link rel="canonical" href="https://pikpro.vn/p"/></head><body><h1>Single H1</h1><h2>Section</h2><img src="/a.svg" alt="Paddle"/></body></html>';
    const goodReport = analyzeSeoHtml(goodHtml);
    expect(goodReport.passed).toBe(true);

    const robotsRules = robots();
    const rule = Array.isArray(robotsRules.rules)
      ? robotsRules.rules[0]
      : robotsRules.rules;
    const disallowed = Array.isArray(rule?.disallow) ? rule.disallow : [];
    expect(disallowed).toContain("/gio-hang");
    expect(disallowed).toContain("/tai-khoan");
    expect(disallowed.some((d) => d.includes("?"))).toBe(false);
  });

  it("extracts and injects TOC heading IDs in pure server-safe module @/lib/articleHtml", async () => {
    const { injectHeadingIds, extractHeadingsFromHtml } = await import(
      "@/lib/articleHtml"
    );
    const sampleHtml = "<h2>1. Quy tắc</h2><p>A</p><h3>1.1 Chi tiết</h3>";
    const injected = injectHeadingIds(sampleHtml);
    expect(injected).toContain('<h2 id="sec-1">1. Quy tắc</h2>');
    expect(injected).toContain('<h3 id="sec-2">1.1 Chi tiết</h3>');
    expect(extractHeadingsFromHtml(sampleHtml)).toHaveLength(2);
  });
});

import type { MetadataRoute } from "next";
import { isMockApiEnabled } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import {
  fetchArticles,
  fetchProducts,
  fetchSitemapData,
  getAllBrandsList,
  getAllCategoriesList,
  getAllPolicyPages,
  getAllProgramPages,
} from "@/lib/storefront";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const makeEntry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "daily",
    lastMod?: string
  ): MetadataRoute.Sitemap[number] => {
    const clean = path === "/" ? "" : path;
    const viUrl = `${SITE_URL}${clean}`;
    const enUrl = `${SITE_URL}/en${clean}`;
    return {
      url: viUrl,
      lastModified: lastMod ? new Date(lastMod) : now,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          vi: viUrl,
          en: enUrl,
        },
      },
    };
  };

  const entries: MetadataRoute.Sitemap = [
    makeEntry("/", 1.0, "daily"),
    makeEntry("/cua-hang", 0.9, "daily"),
    makeEntry("/tin-tuc", 0.8, "daily"),
    makeEntry("/lien-he", 0.8, "monthly"),
  ];

  if (!isMockApiEnabled()) {
    const apiData = await fetchSitemapData();
    if (apiData) {
      for (const cat of apiData.categories ?? []) {
        entries.push(makeEntry(`/${cat.slug}`, 0.9, "daily", cat.updatedAt));
      }
      for (const br of apiData.brands ?? []) {
        entries.push(makeEntry(`/thuong-hieu/${br.slug}`, 0.8, "weekly", br.updatedAt));
      }
      for (const prod of apiData.products ?? []) {
        entries.push(makeEntry(`/${prod.slug}`, 0.85, "daily", prod.updatedAt));
      }
      for (const art of apiData.articles ?? []) {
        entries.push(makeEntry(`/${art.slug}`, 0.75, "weekly", art.updatedAt));
      }
      for (const pg of apiData.pages ?? []) {
        entries.push(makeEntry(`/${pg.slug}`, 0.7, "monthly", pg.updatedAt));
      }
    }
  } else {
    const categories = getAllCategoriesList();
    for (const cat of categories) {
      entries.push(makeEntry(`/${cat.slug}`, 0.9, "daily"));
    }

    const brands = getAllBrandsList();
    for (const brand of brands) {
      entries.push(makeEntry(`/${brand.rootCategorySlug}`, 0.85, "weekly"));
      entries.push(makeEntry(`/thuong-hieu/${brand.slug}`, 0.8, "weekly"));
    }

    const [productsRes, articlesRes] = await Promise.all([
      fetchProducts({ limit: 500 }),
      fetchArticles({ limit: 200 }),
    ]);

    for (const prod of productsRes.data) {
      entries.push(makeEntry(`/${prod.slug}`, 0.85, "daily"));
    }

    // Canonical root slug for editorial articles (matching mipik.vn/post-sitemap.xml)
    for (const art of articlesRes.data) {
      entries.push(makeEntry(`/${art.slug}`, 0.75, "weekly"));
    }

    for (const cat of articlesRes.categories ?? []) {
      entries.push(makeEntry(`/tin-tuc/${cat.slug}`, 0.75, "weekly"));
    }

    for (const pol of getAllPolicyPages()) {
      entries.push(makeEntry(`/${pol.slug}`, 0.6, "monthly"));
    }

    for (const prog of getAllProgramPages()) {
      entries.push(makeEntry(`/${prog.slug}`, 0.7, "monthly"));
    }
  }

  const deduped = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const item of entries) {
    if (!deduped.has(item.url)) {
      deduped.set(item.url, item);
    }
  }

  return Array.from(deduped.values());
}

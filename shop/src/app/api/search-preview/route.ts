import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import type { ArticleSummary, ProductListItem } from "@/types/storefront";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ products: [], articles: [] });
  }

  try {
    const res = await apiFetch<{
      data: {
        products: ProductListItem[];
        articles: ArticleSummary[];
      };
    }>("/public/search/suggest", {
      params: { q },
    });

    return NextResponse.json({
      products: (res?.data?.products ?? []).slice(0, 6),
      articles: (res?.data?.articles ?? []).slice(0, 4),
    });
  } catch {
    return NextResponse.json({ products: [], articles: [] });
  }
}

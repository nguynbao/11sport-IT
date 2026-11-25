import { NextRequest, NextResponse } from "next/server";

interface RedirectRule {
  fromPath: string;
  toPath: string;
  statusCode?: number;
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

const CACHE_TTL_MS = 60_000;
const ERROR_RETRY_TTL_MS = 10_000;

let cachedRedirects: RedirectRule[] = [];
let cacheExpiresAt = 0;

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

const EN_ROUTE_ALIASES: Record<string, string> = {
  "/en/contact": "/lien-he",
  "/en/cart": "/gio-hang",
  "/en/checkout": "/thanh-toan",
  "/en/shop": "/cua-hang",
  "/en/my-account": "/tai-khoan",
  "/en/my-account/lost-password": "/tai-khoan/lost-password",
  "/en/category/blogs": "/tin-tuc",
  "/en/category/blogs/technique": "/tin-tuc/kien-thuc-pickleball",
  "/my-account": "/tai-khoan",
};

async function getRedirects(): Promise<RedirectRule[]> {
  if ((process.env.NEXT_PUBLIC_DATA_SOURCE || "mock") === "mock") {
    return [];
  }
  const now = Date.now();
  if (now < cacheExpiresAt) {
    return cachedRedirects;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${API_BASE_URL}/public/redirects`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      cacheExpiresAt = now + ERROR_RETRY_TTL_MS;
      return cachedRedirects;
    }

    const json = (await res.json()) as { data?: RedirectRule[] };
    if (Array.isArray(json?.data)) {
      cachedRedirects = json.data
        .filter((r) => typeof r.fromPath === "string" && typeof r.toPath === "string")
        .map((r) => ({
          fromPath: normalizePath(r.fromPath),
          toPath: r.toPath,
          statusCode: r.statusCode,
        }));
      cacheExpiresAt = now + CACHE_TTL_MS;
    }
  } catch {
    cacheExpiresAt = now + ERROR_RETRY_TTL_MS;
  } finally {
    clearTimeout(timeout);
  }

  return cachedRedirects;
}

export async function middleware(request: NextRequest) {
  const pathname = normalizePath(request.nextUrl.pathname);

  // 0. Standard 308 storefront alias redirects
  if (pathname === "/cart") {
    return NextResponse.redirect(new URL("/gio-hang", request.url), 308);
  }
  if (pathname === "/shop") {
    return NextResponse.redirect(new URL("/cua-hang", request.url), 308);
  }
  if (pathname === "/tra-cuu-don-hang") {
    return NextResponse.redirect(
      new URL("/tai-khoan?tab=lookup", request.url),
      308
    );
  }

  // 1. Handle direct English alias mappings (/en/cart, /en/checkout, /en/my-account, /en/brand/*)
  if (EN_ROUTE_ALIASES[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = EN_ROUTE_ALIASES[pathname]!;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", "en");
    requestHeaders.set("x-pathname", pathname);
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set("x-locale", "en");
    return response;
  }

  if (pathname.startsWith("/en/brand/")) {
    const brandSlug = pathname.replace("/en/brand/", "");
    const url = request.nextUrl.clone();
    url.pathname = `/thuong-hieu/${brandSlug}`;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", "en");
    requestHeaders.set("x-pathname", pathname);
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set("x-locale", "en");
    return response;
  }

  // 2. Handle general /en and /en/* bilingual prefix via internal rewrite
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const stripped = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", "en");
    requestHeaders.set("x-pathname", pathname);
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set("x-locale", "en");
    return response;
  }

  // 3. Check CMS dynamic redirects when in API mode
  const redirects = await getRedirects();
  const match = redirects.find((r) => r.fromPath === pathname);
  if (match) {
    const targetUrl = match.toPath.startsWith("http")
      ? match.toPath
      : new URL(match.toPath, request.url);
    const status = match.statusCode === 302 ? 302 : 301;
    return NextResponse.redirect(targetUrl, status);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt|images/).*)",
  ],
};

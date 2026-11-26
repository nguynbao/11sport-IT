export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PagedQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined | null;
}

export function buildPageQuery(params: PagedQueryParams): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) continue;
    const str = String(val).trim();
    if (!str) continue;
    qs.set(key, str);
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : "";
}

export function extractPagination(
  meta: Record<string, any> | undefined,
  fallbackTotal = 0,
  fallbackPage = 1,
  fallbackPageSize = 20
): PaginationMeta {
  const p = meta?.pagination;
  if (p && typeof p === "object") {
    return {
      page: Number(p.page) || fallbackPage,
      pageSize: Number(p.pageSize) || fallbackPageSize,
      total: Number(p.total) ?? fallbackTotal,
      totalPages: Math.max(1, Number(p.totalPages) || 1),
      hasNext: Boolean(p.hasNext),
      hasPrev: Boolean(p.hasPrev),
    };
  }
  const totalPages = Math.max(1, Math.ceil(fallbackTotal / Math.max(1, fallbackPageSize)));
  return {
    page: Math.min(fallbackPage, totalPages),
    pageSize: fallbackPageSize,
    total: fallbackTotal,
    totalPages,
    hasNext: fallbackPage < totalPages,
    hasPrev: fallbackPage > 1,
  };
}

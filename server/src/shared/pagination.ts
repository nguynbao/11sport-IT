import { ok, ServiceResult } from './result';

export interface PaginationParams {
  enabled: boolean;
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ParsePaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  pageKey?: string;
  pageSizeKey?: string;
}

/**
 * Parse opt-in pagination params from Express req.query.
 * Pagination is only enabled when either `page` or `pageSize` is explicitly provided,
 * preserving full-array responses for existing callers (web/, exports).
 */
export function parsePagination(
  query: Record<string, unknown> | undefined | null,
  options: ParsePaginationOptions = {}
): PaginationParams {
  const {
    defaultPageSize = 20,
    maxPageSize = 200,
    pageKey = 'page',
    pageSizeKey = 'pageSize',
  } = options;

  const q = query || {};
  const rawPage = q[pageKey];
  const rawSize = q[pageSizeKey];

  const hasPage = rawPage !== undefined && rawPage !== null && String(rawPage).trim() !== '';
  const hasSize = rawSize !== undefined && rawSize !== null && String(rawSize).trim() !== '';

  if (!hasPage && !hasSize) {
    return { enabled: false, page: 1, pageSize: defaultPageSize };
  }

  const parsedPage = Number(rawPage);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const parsedSize = Number(rawSize);
  const rawValidSize =
    hasSize && Number.isFinite(parsedSize) ? Math.floor(parsedSize) : defaultPageSize;
  const pageSize = Math.min(maxPageSize, Math.max(1, rawValidSize));

  return { enabled: true, page, pageSize };
}

/**
 * Slice a pre-filtered/pre-sorted list and compute PaginationMeta,
 * clamping `page` to `[1, totalPages]` so out-of-range pages safely return the last page.
 */
export function paginate<T>(
  items: readonly T[],
  params: Pick<PaginationParams, 'page' | 'pageSize'>
): { data: T[]; pagination: PaginationMeta } {
  const total = items.length;
  const pageSize = Math.max(1, params.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Convenience helper returning a standard ServiceResult with opt-in pagination.
 * When pagination is disabled, returns all items with `meta.total` (plus `extraMeta`).
 */
export function withPagination<T>(
  items: readonly T[],
  query: Record<string, unknown> | undefined | null,
  extraMeta: Record<string, any> = {},
  options: ParsePaginationOptions = {}
): ServiceResult<T[]> {
  const parsed = parsePagination(query, options);
  if (!parsed.enabled) {
    return ok([...items], { total: items.length, ...extraMeta });
  }
  const { data, pagination } = paginate(items, parsed);
  return ok(data, { total: pagination.total, pagination, ...extraMeta });
}

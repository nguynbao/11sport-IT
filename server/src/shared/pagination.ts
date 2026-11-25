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

const BLOCKED_SORT_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'passwordHash']);

/**
 * Sort items generically by `query.sortBy` and `query.sortOrder` ('asc' | 'desc')
 * with a stable `_id` tie-breaker so paginated slices never shift or duplicate rows.
 */
export function applyQuerySort<T>(
  items: readonly T[],
  query: Record<string, unknown> | undefined | null
): T[] {
  const rawSortBy = query?.sortBy;
  if (typeof rawSortBy !== 'string' || !rawSortBy.trim()) {
    return [...items];
  }
  const field = rawSortBy.trim();
  if (BLOCKED_SORT_KEYS.has(field)) {
    return [...items];
  }

  const dir = String(query?.sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1;

  return [...items].sort((a: any, b: any) => {
    const va = a?.[field];
    const vb = b?.[field];
    let cmp = 0;

    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else if (va instanceof Date || vb instanceof Date || field === 'createdAt' || field === 'updatedAt') {
      cmp = new Date(va || 0).getTime() - new Date(vb || 0).getTime();
    } else {
      cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'vi');
    }

    if (cmp !== 0) return cmp * dir;
    return String(a?._id ?? '').localeCompare(String(b?._id ?? ''));
  });
}

/**
 * Convenience helper returning a standard ServiceResult with opt-in pagination.
 * Honors `sortBy` / `sortOrder` before slicing pages when provided.
 * When pagination is disabled, returns all items with `meta.total` (plus `extraMeta`).
 */
export function withPagination<T>(
  items: readonly T[],
  query: Record<string, unknown> | undefined | null,
  extraMeta: Record<string, any> = {},
  options: ParsePaginationOptions = {}
): ServiceResult<T[]> {
  const sorted = applyQuerySort(items, query);
  const parsed = parsePagination(query, options);
  if (!parsed.enabled) {
    return ok(sorted, { total: sorted.length, ...extraMeta });
  }
  const { data, pagination } = paginate(sorted, parsed);
  return ok(data, { total: pagination.total, pagination, ...extraMeta });
}

export interface ClientPaginationResult<T> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
  hasNext: boolean;
  hasPrev: boolean;
}

export function getRowNumber(page: number, pageSize: number, index: number): number {
  if (pageSize <= 0) return index + 1;
  return (Math.max(1, page) - 1) * pageSize + index + 1;
}

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), safeTotal);
}

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): ClientPaginationResult<T> {
  const total = items.length;
  if (pageSize <= 0) {
    return {
      page: 1,
      pageSize: total || 1,
      total,
      totalPages: 1,
      items: [...items],
      hasNext: false,
      hasPrev: false,
    };
  }
  const totalPages = getTotalPages(total, pageSize);
  const safePage = clampPage(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: items.slice(start, start + pageSize),
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

import { useCallback, useMemo, useState } from "react";
import { clampPage, getTotalPages, paginateItems } from "../utils/pagination";

export function useClientPagination<T>(
  items: readonly T[],
  initialPageSize = 20
) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const result = useMemo(
    () => paginateItems(items, page, pageSize),
    [items, page, pageSize]
  );

  const totalPages = getTotalPages(items.length, pageSize);

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const val = typeof next === "function" ? next(prev) : next;
        return clampPage(val, totalPages);
      });
    },
    [totalPages]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const resetPage = useCallback(() => setPageState(1), []);

  return {
    page: result.page,
    pageSize,
    total: result.total,
    totalPages: result.totalPages,
    items: result.items,
    hasNext: result.hasNext,
    hasPrev: result.hasPrev,
    setPage,
    setPageSize,
    resetPage,
  };
}

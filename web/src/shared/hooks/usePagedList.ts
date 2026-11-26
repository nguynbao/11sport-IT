import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { buildPageQuery, extractPagination, PaginationMeta } from "../api/pagination";
import { useDebounce } from "./useDebounce";

export interface UsePagedListOptions<T, S = Record<string, any>> {
  endpoint: string;
  filters?: Record<string, string | number | boolean | undefined | null>;
  search?: string;
  debounceMs?: number;
  initialPageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  enabled?: boolean;
  transform?: (data: any) => T[];
  extractSummary?: (meta: Record<string, any> | undefined, data: any) => S | undefined;
}

export function usePagedList<T, S = Record<string, any>>(
  options: UsePagedListOptions<T, S>
) {
  const {
    endpoint,
    filters = {},
    search = "",
    debounceMs = 400,
    initialPageSize = 20,
    sortBy,
    sortOrder,
    enabled = true,
    transform,
    extractSummary,
  } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [summary, setSummary] = useState<S | undefined>(undefined);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const debouncedSearch = useDebounce(search, debounceMs);
  const filtersKey = JSON.stringify(filters);
  const prevCriteriaRef = useRef<string>("");

  const criteriaKey = `${endpoint}|${debouncedSearch}|${filtersKey}|${sortBy || ""}|${sortOrder || ""}|${pageSize}`;
  useEffect(() => {
    if (prevCriteriaRef.current && prevCriteriaRef.current !== criteriaKey) {
      setPage(1);
    }
    prevCriteriaRef.current = criteriaKey;
  }, [criteriaKey]);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const qs = buildPageQuery({
        ...filters,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      const res = await apiRequest<any>(`${endpoint}${qs}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const list = transform
        ? transform(res.data)
        : Array.isArray(res.data)
          ? (res.data as T[])
          : [];
      setItems(list);
      setPagination(extractPagination(res.meta, list.length, page, pageSize));
      if (extractSummary) {
        setSummary(extractSummary(res.meta, res.data));
      } else if (res.meta?.summary !== undefined) {
        setSummary(res.meta.summary as S);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Không thể tải dữ liệu.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, debouncedSearch, filtersKey, sortBy, sortOrder, page, pageSize, enabled, reloadTick]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  return {
    items,
    setItems,
    summary,
    pagination,
    page: pagination.page,
    pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    loading,
    error,
    setPage,
    setPageSize,
    reload,
  };
}

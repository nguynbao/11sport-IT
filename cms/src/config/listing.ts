export const DEBOUNCE_MS = {
  /** Lọc dữ liệu ngay trên client */
  LOCAL: 250,
  /** Tìm kiếm gửi request lên API */
  API: 400,
} as const;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

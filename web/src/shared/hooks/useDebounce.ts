import { useEffect, useState } from "react";

/**
 * React Hook: Debounce một giá trị theo khoảng thời gian `delayMs` (mặc định 400ms).
 * Khi giá trị rỗng (xóa trắng ô tìm kiếm), cập nhật ngay lập tức (0ms).
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    if (typeof value === "string" && value.trim() === "") {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

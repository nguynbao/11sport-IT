import { useEffect, useState } from "react";

/**
 * React Hook: Debounce một giá trị theo khoảng thời gian `delayMs`.
 * Khi giá trị rỗng (xóa trắng ô tìm kiếm), cập nhật ngay lập tức (0ms) để phản hồi tức thì.
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

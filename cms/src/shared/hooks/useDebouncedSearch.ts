import { useCallback, useState } from "react";
import { useDebounce } from "./useDebounce";

export function useDebouncedSearch(delayMs = 250, initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const debounced = useDebounce(value, delayMs);
  const clear = useCallback(() => setValue(""), []);

  return {
    value,
    setValue,
    debounced,
    clear,
  };
}

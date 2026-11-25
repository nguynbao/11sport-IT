export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFirstOkJson<T = any>(
  endpoints: string[],
  options: RequestInit = {},
  isValid?: (json: any) => boolean,
  timeoutMs = 5000
): Promise<{ json: T | null; lastError: string }> {
  let lastError = "";
  for (const ep of endpoints) {
    try {
      const res = await fetchWithTimeout(ep, options, timeoutMs);
      const json = await res.json().catch(() => null);
      if (res.ok && json && (!isValid || isValid(json))) {
        return { json: json as T, lastError: "" };
      }
      if (json?.message || json?.error?.message) {
        lastError = String(json?.message || json?.error?.message);
      }
    } catch (e: any) {
      if (e?.message) lastError = e.message;
    }
  }
  return { json: null, lastError };
}

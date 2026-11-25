import { isTestRuntime } from './auth';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getWebCache<T>(key: string): T | null {
  if (isTestRuntime()) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setWebCache<T>(key: string, value: T, ttlMs = 30_000): void {
  if (isTestRuntime()) return;
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateWebCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

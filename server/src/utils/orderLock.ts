const orderLocks = new Map<string, Promise<void>>();

/**
 * Tuần tự hóa các thao tác ghi/cập nhật trên cùng một đơn hàng (trả/đổi hàng, thu nợ)
 * để chống race condition khi nhiều request chạy đồng thời (Promise.all).
 */
export async function withOrderLock<T>(orderKey: string, fn: () => Promise<T>): Promise<T> {
  const key = String(orderKey || '__global__').trim() || '__global__';
  const prev = orderLocks.get(key) || Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => current);
  orderLocks.set(key, chained);

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (orderLocks.get(key) === chained) {
      orderLocks.delete(key);
    }
  }
}

export function deepCloneSnapshot<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return new Date(val.getTime()) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneSnapshot(item)) as unknown as T;
  }
  const copy: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    copy[k] = deepCloneSnapshot(v);
  }
  return copy as T;
}

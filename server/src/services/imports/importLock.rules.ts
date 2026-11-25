const importLockQueues = new Map<string, Promise<unknown>>();
export async function withImportLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = importLockQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => gate);
  importLockQueues.set(key, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (importLockQueues.get(key) === chained) {
      importLockQueues.delete(key);
    }
  }
}


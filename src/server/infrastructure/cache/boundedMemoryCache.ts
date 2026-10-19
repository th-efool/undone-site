export type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

export class BoundedMemoryCache<V> {
  private cache = new Map<string, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000;
  }

  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    // If key already exists, delete it first to ensure new insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first item in Map iteration)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  deleteMatching(predicate: (key: string) => boolean): void {
    for (const key of Array.from(this.cache.keys())) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

import { BoundedMemoryCache } from './boundedMemoryCache';

export type CachedHomeServerPayload = {
  activeCohorts: any[];
  recentlyCompleted: any[];
  continueLater: any[];
  expiresAt: number;
};

export const HOME_SERVER_CACHE_TTL_MS = 30_000;

const globalForHomeCache = globalThis as unknown as {
  __undoneHomeServerCache?: BoundedMemoryCache<CachedHomeServerPayload>;
};

export function getHomeServerCache(): BoundedMemoryCache<CachedHomeServerPayload> {
  if (!globalForHomeCache.__undoneHomeServerCache) {
    globalForHomeCache.__undoneHomeServerCache = new BoundedMemoryCache<CachedHomeServerPayload>({
      maxEntries: 500,
      defaultTtlMs: HOME_SERVER_CACHE_TTL_MS,
    });
  }
  return globalForHomeCache.__undoneHomeServerCache;
}

export function invalidateHomeServerCache(userId?: string) {
  const cache = getHomeServerCache();
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}


export type CachedHomeServerPayload = {
  activeCohorts: any[];
  recentlyCompleted: any[];
  continueLater: any[];
  expiresAt: number;
};

export const HOME_SERVER_CACHE_TTL_MS = 30_000;

const globalForHomeCache = globalThis as unknown as {
  __undoneHomeServerCache?: Map<string, CachedHomeServerPayload>;
};

export function getHomeServerCache(): Map<string, CachedHomeServerPayload> {
  if (!globalForHomeCache.__undoneHomeServerCache) {
    globalForHomeCache.__undoneHomeServerCache = new Map();
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

import { BoundedMemoryCache } from './boundedMemoryCache';

export type CachedFeedCatalogEntry = {
  lessons: any[];
  expiresAt: number;
};

export type CachedMongoVectorsEntry = {
  transcripts: any[];
  mongoChunks: any[];
  expiresAt: number;
};

export const FEED_CATALOG_TTL_MS = 60_000;
export const MONGO_VECTORS_TTL_MS = 120_000;

const globalForFeedCache = globalThis as unknown as {
  __undoneFeedCatalogCache?: BoundedMemoryCache<CachedFeedCatalogEntry>;
  __undoneFeedVectorsCache?: BoundedMemoryCache<CachedMongoVectorsEntry>;
};

export function getFeedCatalogCache(): BoundedMemoryCache<CachedFeedCatalogEntry> {
  if (!globalForFeedCache.__undoneFeedCatalogCache) {
    globalForFeedCache.__undoneFeedCatalogCache = new BoundedMemoryCache<CachedFeedCatalogEntry>({
      maxEntries: 200,
      defaultTtlMs: FEED_CATALOG_TTL_MS,
    });
  }
  return globalForFeedCache.__undoneFeedCatalogCache;
}

export function getFeedVectorsCache(): BoundedMemoryCache<CachedMongoVectorsEntry> {
  if (!globalForFeedCache.__undoneFeedVectorsCache) {
    globalForFeedCache.__undoneFeedVectorsCache = new BoundedMemoryCache<CachedMongoVectorsEntry>({
      maxEntries: 100,
      defaultTtlMs: MONGO_VECTORS_TTL_MS,
    });
  }
  return globalForFeedCache.__undoneFeedVectorsCache;
}

export function invalidateFeedCatalogCache(userId?: string): void {
  const cache = getFeedCatalogCache();
  if (userId) {
    cache.deleteMatching((key) => key.startsWith(`${userId}|`));
  } else {
    cache.clear();
  }
}

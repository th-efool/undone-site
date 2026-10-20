import { createHash } from 'node:crypto';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { AiContentCache } from '@/src/server/database/mongo/models/AiContentCache';

/**
 * Tier 1 LRU in-memory cache configuration
 */
export const MAX_TIER1_CACHE_SIZE = 1000;

interface CacheEntry {
  payload: any;
  cachedAt: number;
}

const tier1Cache = new Map<string, CacheEntry>();

/**
 * Helper to record entry in Tier 1 LRU cache.
 * Evicts the oldest entry if size exceeds MAX_TIER1_CACHE_SIZE.
 */
function setTier1Entry(contentHash: string, payload: any): void {
  if (tier1Cache.has(contentHash)) {
    tier1Cache.delete(contentHash);
  } else if (tier1Cache.size >= MAX_TIER1_CACHE_SIZE) {
    const oldestKey = tier1Cache.keys().next().value;
    if (oldestKey !== undefined) {
      tier1Cache.delete(oldestKey);
    }
  }
  tier1Cache.set(contentHash, { payload, cachedAt: Date.now() });
}

/**
 * Computes a deterministic SHA-256 hash key for an AI operation.
 * Combines operationType, modelId, and normalized input representation.
 */
export function computeAiCacheKey(
  operationType: string,
  input: unknown,
  modelId?: string
): string {
  const normalized = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha256')
    .update(`${operationType}:${modelId || 'default'}:${normalized}`)
    .digest('hex');
}

/**
 * Retrieves a cached AI generation or observation result.
 * Checks Tier 1 (in-memory LRU, <0.1ms) first, then falls back to Tier 2 (MongoDB).
 * On Tier 2 hit, populates Tier 1 and asynchronously updates access metrics.
 */
export async function getCachedAiResult<T>(
  operationType: string,
  input: unknown,
  modelId?: string
): Promise<T | null> {
  const contentHash = computeAiCacheKey(operationType, input, modelId);

  // Tier 1: Check in-memory LRU cache
  const memoryHit = tier1Cache.get(contentHash);
  if (memoryHit) {
    // Refresh LRU position (delete and re-insert)
    tier1Cache.delete(contentHash);
    tier1Cache.set(contentHash, memoryHit);
    return memoryHit.payload as T;
  }

  // Tier 2: Check MongoDB persistence if configured
  if (process.env.MONGODB_URI) {
    try {
      await connectToMongoDB();
      const doc = await AiContentCache.findOne({ contentHash }).lean().exec();
      if (doc) {
        // Populate Tier 1
        setTier1Entry(contentHash, doc.payload);

        // Asynchronously update lastAccessedAt and increment accessCount
        AiContentCache.updateOne(
          { contentHash },
          {
            $set: { lastAccessedAt: new Date() },
            $inc: { accessCount: 1 },
          }
        ).catch((err) => console.warn('[AiCache] MongoDB access update error:', err));

        return doc.payload as T;
      }
    } catch (err) {
      console.warn('[AiCache] MongoDB read error:', err);
      return null;
    }
  }

  return null;
}

/**
 * Persists an AI generation or observation result in Tier 1 and Tier 2 caches.
 * Immediately saves to Tier 1 in-memory LRU cache, and asynchronously upserts to MongoDB if configured.
 */
export async function setCachedAiResult<T>(
  operationType: string,
  input: unknown,
  payload: T,
  modelId?: string
): Promise<void> {
  const contentHash = computeAiCacheKey(operationType, input, modelId);

  // Store in Tier 1 memory cache
  setTier1Entry(contentHash, payload);

  // Tier 2: Asynchronously upsert into MongoDB if configured
  if (process.env.MONGODB_URI) {
    try {
      await connectToMongoDB();
      const serialized = typeof input === 'string' ? input : (JSON.stringify(input) ?? '');
      const inputByteLength = Buffer.byteLength(serialized);

      await AiContentCache.updateOne(
        { contentHash },
        {
          $set: {
            contentHash,
            operationType,
            modelId: modelId || 'default',
            payload,
            inputByteLength,
            lastAccessedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
          $inc: { accessCount: 1 },
        },
        { upsert: true }
      ).catch((err) => console.warn('[AiCache] MongoDB write error:', err));
    } catch (err) {
      console.warn('[AiCache] MongoDB write error:', err);
    }
  }
}

/**
 * Clears the Tier 1 in-memory LRU cache. Primarily used in unit tests.
 */
export function clearAiMemoryCache(): void {
  tier1Cache.clear();
}

/**
 * Returns the current number of entries in the Tier 1 memory cache.
 */
export function getAiMemoryCacheSize(): number {
  return tier1Cache.size;
}

import crypto from 'node:crypto';
import type { JWT } from 'next-auth/jwt';

export interface JwtCacheEntry {
  payload: JWT;
  cachedAt: number;
  expiresAt: number;
}

export const DEFAULT_JWT_CACHE_TTL_MS = 30_000; // 30 seconds
export const DEFAULT_MAX_JWT_CACHE_ENTRIES = 2_000;

let maxCacheEntries = DEFAULT_MAX_JWT_CACHE_ENTRIES;
const jwtMemoryCache = new Map<string, JwtCacheEntry>();

/**
 * Derives a deterministic 64-character SHA-256 hash key from the token.
 * Prevents holding long JWE strings in memory map keys.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Returns cached JWT payload if present and not expired.
 * Deletes and returns null if the entry has expired.
 */
export function getCachedJwt(token: string): JWT | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const key = hashToken(token);
  const entry = jwtMemoryCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    jwtMemoryCache.delete(key);
    return null;
  }

  // Refresh LRU order: re-insert so recent accesses stay at back of Map iteration
  jwtMemoryCache.delete(key);
  jwtMemoryCache.set(key, entry);

  return entry.payload;
}

/**
 * Stores decoded JWT payload in the worker cache.
 * Computes expiration based on token's `exp` claim (in seconds) and TTL (in ms).
 * Evicts expired entries first, then oldest entries if capacity is reached.
 */
export function setCachedJwt(token: string, payload: JWT, ttlMs?: number): void {
  if (!token || typeof token !== 'string' || !payload) {
    return;
  }

  const key = hashToken(token);
  const now = Date.now();
  const effectiveTtl =
    typeof ttlMs === 'number' && !Number.isNaN(ttlMs) && ttlMs >= 0
      ? ttlMs
      : DEFAULT_JWT_CACHE_TTL_MS;

  const expInMs =
    typeof payload.exp === 'number' && !Number.isNaN(payload.exp)
      ? payload.exp * 1000
      : null;

  const expiresAt =
    expInMs !== null
      ? Math.min(expInMs, now + effectiveTtl)
      : now + effectiveTtl;

  if (jwtMemoryCache.has(key)) {
    jwtMemoryCache.delete(key);
  } else if (jwtMemoryCache.size >= maxCacheEntries) {
    // 1. Evict any expired entries
    for (const [k, item] of jwtMemoryCache.entries()) {
      if (now >= item.expiresAt) {
        jwtMemoryCache.delete(k);
      }
    }

    // 2. If still at or over capacity, evict oldest entries (head of Map)
    while (jwtMemoryCache.size >= maxCacheEntries) {
      const oldestKey = jwtMemoryCache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      jwtMemoryCache.delete(oldestKey);
    }
  }

  jwtMemoryCache.set(key, {
    payload,
    cachedAt: now,
    expiresAt,
  });
}

/**
 * Resets the JWT cache. Intended for testing or worker teardown.
 */
export function clearJwtCache(): void {
  jwtMemoryCache.clear();
}

/**
 * Returns active cache size, pruning expired entries first.
 */
export function getJwtCacheSize(): number {
  const now = Date.now();
  for (const [key, entry] of jwtMemoryCache.entries()) {
    if (now >= entry.expiresAt) {
      jwtMemoryCache.delete(key);
    }
  }
  return jwtMemoryCache.size;
}

/**
 * Explicitly invalidates a single cached token (e.g. on revocation / sign-out / write).
 */
export function invalidateCachedJwt(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  return jwtMemoryCache.delete(hashToken(token));
}

/**
 * Returns the raw cache entry for diagnostics/testing without mutating LRU order.
 */
export function getJwtCacheEntry(token: string): Readonly<JwtCacheEntry> | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  return jwtMemoryCache.get(hashToken(token)) ?? null;
}

/**
 * Test helper to configure max entries limit.
 */
export function setMaxJwtCacheEntriesForTesting(limit: number): void {
  maxCacheEntries = limit;
}

/**
 * Test helper to reset max entries limit to default (2,000).
 */
export function resetMaxJwtCacheEntriesForTesting(): void {
  maxCacheEntries = DEFAULT_MAX_JWT_CACHE_ENTRIES;
}

export type CachedCohortMember = {
  isMember: boolean;
  role?: string;
};

export type CohortMemberCacheEntry = {
  isMember: boolean;
  role?: string;
  expiresAt: number;
};

export type PermissionsCacheOptions = {
  maxEntries?: number;
  defaultTtlMs?: number;
};

export const DEFAULT_PERMISSIONS_TTL_MS = 30_000;
export const MAX_PERMISSIONS_CACHE_ENTRIES = 5000;

export function getCohortMemberCacheKey(cohortId: string, userId: string): string {
  return `${cohortId}:${userId}`;
}

export class PermissionsCache {
  private cache = new Map<string, CohortMemberCacheEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(options: PermissionsCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? MAX_PERMISSIONS_CACHE_ENTRIES;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_PERMISSIONS_TTL_MS;
  }

  private evict(): void {
    const now = Date.now();
    let evictedExpired = false;

    // Scan for and remove any expired entries to free capacity
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evictedExpired = true;
      }
    }

    // If no expired entries were found and we are still at or above capacity,
    // evict the least recently used / oldest entry (Map insertion order)
    if (!evictedExpired && this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }

  getCachedCohortMember(cohortId: string, userId: string): CachedCohortMember | null {
    if (!cohortId || !userId) return null;

    const key = getCohortMemberCacheKey(cohortId, userId);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);

    const result: CachedCohortMember = { isMember: entry.isMember };
    if (entry.role !== undefined) {
      result.role = entry.role;
    }
    return result;
  }

  setCachedCohortMember(
    cohortId: string,
    userId: string,
    data: { isMember: boolean; role?: string },
    ttlMs?: number
  ): void {
    if (!cohortId || !userId) return;

    const key = getCohortMemberCacheKey(cohortId, userId);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      this.evict();
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, {
      isMember: data.isMember,
      ...(data.role !== undefined ? { role: data.role } : {}),
      expiresAt,
    });
  }

  invalidateCohortMember(cohortId: string, userId: string): void {
    if (!cohortId || !userId) return;
    const key = getCohortMemberCacheKey(cohortId, userId);
    this.cache.delete(key);
  }

  clearPermissionsCache(): void {
    this.cache.clear();
  }

  getPermissionsCacheSize(): number {
    return this.cache.size;
  }
}

const globalForPermissions = globalThis as unknown as {
  __undonePermissionsCache?: PermissionsCache;
};

export function getPermissionsCache(): PermissionsCache {
  if (!globalForPermissions.__undonePermissionsCache) {
    globalForPermissions.__undonePermissionsCache = new PermissionsCache({
      maxEntries: MAX_PERMISSIONS_CACHE_ENTRIES,
      defaultTtlMs: DEFAULT_PERMISSIONS_TTL_MS,
    });
  }
  return globalForPermissions.__undonePermissionsCache;
}

export function getCachedCohortMember(
  cohortId: string,
  userId: string
): CachedCohortMember | null {
  return getPermissionsCache().getCachedCohortMember(cohortId, userId);
}

export function setCachedCohortMember(
  cohortId: string,
  userId: string,
  data: { isMember: boolean; role?: string },
  ttlMs?: number
): void {
  getPermissionsCache().setCachedCohortMember(cohortId, userId, data, ttlMs);
}

export function invalidateCohortMember(cohortId: string, userId: string): void {
  getPermissionsCache().invalidateCohortMember(cohortId, userId);
}

export function clearPermissionsCache(): void {
  getPermissionsCache().clearPermissionsCache();
}

export function getPermissionsCacheSize(): number {
  return getPermissionsCache().getPermissionsCacheSize();
}

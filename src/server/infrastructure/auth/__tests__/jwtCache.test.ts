import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import {
  DEFAULT_JWT_CACHE_TTL_MS,
  DEFAULT_MAX_JWT_CACHE_ENTRIES,
  clearJwtCache,
  getCachedJwt,
  getJwtCacheEntry,
  getJwtCacheSize,
  hashToken,
  invalidateCachedJwt,
  resetMaxJwtCacheEntriesForTesting,
  setCachedJwt,
  setMaxJwtCacheEntriesForTesting,
} from '../jwtCache';

describe('jwtCache (Worker Process Decoded JWT Memoization)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearJwtCache();
    resetMaxJwtCacheEntriesForTesting();
  });

  describe('Basic Memoization and Cache Hits', () => {
    it('returns null for uncached or non-existent tokens', () => {
      expect(getCachedJwt('token-does-not-exist')).toBeNull();
      expect(getJwtCacheSize()).toBe(0);
    });

    it('returns null safely for empty or invalid token parameters', () => {
      // @ts-expect-error testing invalid input types
      expect(getCachedJwt(null)).toBeNull();
      // @ts-expect-error testing invalid input types
      expect(getCachedJwt(undefined)).toBeNull();
      expect(getCachedJwt('')).toBeNull();
    });

    it('caches and returns memoized JWT payload on cache hit', () => {
      const token = 'sample.encrypted.jwt.token.alpha';
      const payload: JWT = {
        sub: 'usr_123',
        name: 'Learner Test',
        email: 'learner@undone.one',
        username: 'learner',
      };

      setCachedJwt(token, payload);

      expect(getJwtCacheSize()).toBe(1);
      const cached = getCachedJwt(token);
      expect(cached).toEqual(payload);
      expect(cached?.sub).toBe('usr_123');

      // Subsequent hits return the memoized payload consistently
      expect(getCachedJwt(token)).toEqual(payload);
    });

    it('gracefully ignores invalid inputs in setCachedJwt', () => {
      // @ts-expect-error testing invalid token
      setCachedJwt(null, { sub: 'usr' });
      // @ts-expect-error testing invalid payload
      setCachedJwt('valid-token', null);
      setCachedJwt('', { sub: 'usr' });

      expect(getJwtCacheSize()).toBe(0);
    });
  });

  describe('Expiration and TTL Handling', () => {
    it('uses default 30s TTL when no exp claim is provided in payload', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const token = 'token-without-exp';
      const payload: JWT = { sub: 'user_no_exp' };

      setCachedJwt(token, payload);

      const entry = getJwtCacheEntry(token);
      expect(entry).not.toBeNull();
      expect(entry?.cachedAt).toBe(baseTime);
      expect(entry?.expiresAt).toBe(baseTime + DEFAULT_JWT_CACHE_TTL_MS);

      // Still valid at 29.9s
      vi.advanceTimersByTime(29_900);
      expect(getCachedJwt(token)).toEqual(payload);

      // Expired at 30.001s
      vi.advanceTimersByTime(101);
      expect(getCachedJwt(token)).toBeNull();
      expect(getJwtCacheSize()).toBe(0);
    });

    it('caps TTL at default 30s when token exp is further in the future', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const token = 'token-long-exp';
      // Token expires in 1 hour (3600s), but worker cache caps it at 30s
      const payload: JWT = {
        sub: 'user_long_exp',
        exp: Math.floor(baseTime / 1000) + 3600,
      };

      setCachedJwt(token, payload);

      const entry = getJwtCacheEntry(token);
      expect(entry?.expiresAt).toBe(baseTime + DEFAULT_JWT_CACHE_TTL_MS);

      vi.advanceTimersByTime(DEFAULT_JWT_CACHE_TTL_MS + 10);
      expect(getCachedJwt(token)).toBeNull();
    });

    it('honors token exp when exp expires sooner than default TTL', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const token = 'token-short-exp';
      // Token expires in 10 seconds (10s < 30s default TTL)
      const expSeconds = Math.floor(baseTime / 1000) + 10;
      const payload: JWT = {
        sub: 'user_short_exp',
        exp: expSeconds,
      };

      setCachedJwt(token, payload);

      const entry = getJwtCacheEntry(token);
      expect(entry?.expiresAt).toBe(expSeconds * 1000);

      // Still valid at 9s
      vi.advanceTimersByTime(9_000);
      expect(getCachedJwt(token)).toEqual(payload);

      // Expired at 10.001s
      vi.advanceTimersByTime(1_001);
      expect(getCachedJwt(token)).toBeNull();
    });

    it('honors custom ttlMs parameter override', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const token = 'token-custom-ttl';
      const payload: JWT = { sub: 'user_custom_ttl' };

      setCachedJwt(token, payload, 5_000); // 5s custom TTL

      const entry = getJwtCacheEntry(token);
      expect(entry?.expiresAt).toBe(baseTime + 5_000);

      vi.advanceTimersByTime(4_900);
      expect(getCachedJwt(token)).toEqual(payload);

      vi.advanceTimersByTime(200);
      expect(getCachedJwt(token)).toBeNull();
    });

    it('deletes expired entry upon getCachedJwt access and prunes during getJwtCacheSize', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const token = 'token-to-expire';
      setCachedJwt(token, { sub: 'user_exp' }, 1_000);

      expect(getJwtCacheSize()).toBe(1);

      vi.advanceTimersByTime(1_500);

      // getJwtCacheSize() auto-prunes expired entries
      expect(getJwtCacheSize()).toBe(0);

      // getCachedJwt confirms deletion and returns null
      expect(getCachedJwt(token)).toBeNull();
    });
  });

  describe('Token Distinctness and Key Derivation', () => {
    it('produces distinct cache entries for distinct tokens', () => {
      const token1 = 'token.header.payload1.signature';
      const token2 = 'token.header.payload2.signature';
      const payload1: JWT = { sub: 'user_1', name: 'User One' };
      const payload2: JWT = { sub: 'user_2', name: 'User Two' };

      setCachedJwt(token1, payload1);
      setCachedJwt(token2, payload2);

      expect(getJwtCacheSize()).toBe(2);
      expect(getCachedJwt(token1)).toEqual(payload1);
      expect(getCachedJwt(token2)).toEqual(payload2);
      expect(getCachedJwt(token1)).not.toEqual(payload2);
    });

    it('correctly updates and overwrites cache entry when same token is re-set', () => {
      const token = 'token.identical.key';
      const payloadV1: JWT = { sub: 'user_1', version: 1 };
      const payloadV2: JWT = { sub: 'user_1', version: 2 };

      setCachedJwt(token, payloadV1);
      expect(getCachedJwt(token)).toEqual(payloadV1);
      expect(getJwtCacheSize()).toBe(1);

      setCachedJwt(token, payloadV2);
      expect(getCachedJwt(token)).toEqual(payloadV2);
      expect(getJwtCacheSize()).toBe(1);
    });

    it('derives SHA-256 hex hash of token as deterministic cache key', () => {
      const token = 'token-sha256-test';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Cache Bounds and Eviction Policies', () => {
    it('evicts oldest entries when capacity limit is reached (FIFO/LRU)', () => {
      setMaxJwtCacheEntriesForTesting(3);

      setCachedJwt('token-1', { sub: 'user-1' });
      setCachedJwt('token-2', { sub: 'user-2' });
      setCachedJwt('token-3', { sub: 'user-3' });

      expect(getJwtCacheSize()).toBe(3);

      // Adding 4th token triggers eviction of oldest (token-1)
      setCachedJwt('token-4', { sub: 'user-4' });

      expect(getJwtCacheSize()).toBe(3);
      expect(getCachedJwt('token-1')).toBeNull();
      expect(getCachedJwt('token-2')).toEqual({ sub: 'user-2' });
      expect(getCachedJwt('token-3')).toEqual({ sub: 'user-3' });
      expect(getCachedJwt('token-4')).toEqual({ sub: 'user-4' });
    });

    it('refreshes LRU position on access so accessed entries survive eviction', () => {
      setMaxJwtCacheEntriesForTesting(3);

      setCachedJwt('token-1', { sub: 'user-1' });
      setCachedJwt('token-2', { sub: 'user-2' });
      setCachedJwt('token-3', { sub: 'user-3' });

      // Access token-1 to move it to the back of LRU order
      expect(getCachedJwt('token-1')).toEqual({ sub: 'user-1' });

      // Now token-2 is the oldest; inserting token-4 should evict token-2
      setCachedJwt('token-4', { sub: 'user-4' });

      expect(getJwtCacheSize()).toBe(3);
      expect(getCachedJwt('token-1')).toEqual({ sub: 'user-1' });
      expect(getCachedJwt('token-2')).toBeNull(); // evicted
      expect(getCachedJwt('token-3')).toEqual({ sub: 'user-3' });
      expect(getCachedJwt('token-4')).toEqual({ sub: 'user-4' });
    });

    it('prioritizes evicting expired entries before evicting unexpired oldest entries', () => {
      vi.useFakeTimers();
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      setMaxJwtCacheEntriesForTesting(3);

      setCachedJwt('token-1', { sub: 'user-1' }, 10_000); // Expires in 10s
      setCachedJwt('token-2', { sub: 'user-2' }, 2_000);  // Expires in 2s
      setCachedJwt('token-3', { sub: 'user-3' }, 10_000); // Expires in 10s

      // Advance time so token-2 expires
      vi.advanceTimersByTime(3_000);

      // Insert token-4: token-2 is expired and should be purged, sparing token-1
      setCachedJwt('token-4', { sub: 'user-4' }, 10_000);

      expect(getJwtCacheSize()).toBe(3);
      expect(getCachedJwt('token-1')).toEqual({ sub: 'user-1' });
      expect(getCachedJwt('token-2')).toBeNull();
      expect(getCachedJwt('token-3')).toEqual({ sub: 'user-3' });
      expect(getCachedJwt('token-4')).toEqual({ sub: 'user-4' });
    });

    it('strictly enforces the default maxEntries limit (2000)', () => {
      expect(DEFAULT_MAX_JWT_CACHE_ENTRIES).toBe(2000);

      // Insert 2005 entries into default cache
      for (let i = 1; i <= 2005; i++) {
        setCachedJwt(`bulk-token-${i}`, { sub: `user-${i}` });
      }

      expect(getJwtCacheSize()).toBe(2000);

      // Oldest 5 tokens should have been evicted
      for (let i = 1; i <= 5; i++) {
        expect(getCachedJwt(`bulk-token-${i}`)).toBeNull();
      }

      // Newest tokens should be present
      for (let i = 6; i <= 2005; i++) {
        const payload = getCachedJwt(`bulk-token-${i}`);
        expect(payload?.sub).toBe(`user-${i}`);
      }
    });
  });

  describe('Cache Reset and Invalidation', () => {
    it('clearJwtCache empties all entries and resets size to 0', () => {
      setCachedJwt('token-a', { sub: 'a' });
      setCachedJwt('token-b', { sub: 'b' });
      setCachedJwt('token-c', { sub: 'c' });

      expect(getJwtCacheSize()).toBe(3);

      clearJwtCache();

      expect(getJwtCacheSize()).toBe(0);
      expect(getCachedJwt('token-a')).toBeNull();
      expect(getCachedJwt('token-b')).toBeNull();
      expect(getCachedJwt('token-c')).toBeNull();
    });

    it('invalidateCachedJwt invalidates specific token upon write / revocation', () => {
      setCachedJwt('token-x', { sub: 'x' });
      setCachedJwt('token-y', { sub: 'y' });

      expect(invalidateCachedJwt('token-x')).toBe(true);
      expect(getCachedJwt('token-x')).toBeNull();
      expect(getCachedJwt('token-y')).toEqual({ sub: 'y' });
      expect(getJwtCacheSize()).toBe(1);

      // Invalidating non-existent token returns false
      expect(invalidateCachedJwt('token-x')).toBe(false);
      expect(invalidateCachedJwt('')).toBe(false);
    });
  });

  describe('NextAuth jwt.decode Integration', () => {
    const secret = 'test-secret-at-least-32-chars-long-12345';
    const salt = 'authjs.session-token';

    it('intercepts decode, caches successful decryption, and avoids redundant cryptographic work', async () => {
      const { encode, decode: defaultDecode } = await import('next-auth/jwt');

      // Create an actual encrypted Auth.js token using AES-256-GCM / HKDF
      const rawPayload: JWT = {
        sub: 'integration-user-456',
        name: 'Integration Learner',
        email: 'learner@integration.test',
      };
      const token = await encode({
        token: rawPayload,
        secret,
        salt,
      });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(50);

      // Spy on defaultDecode to monitor invocations
      const defaultDecodeSpy = vi.fn((params) => defaultDecode(params));

      // Recreate the custom decode implementation from auth.config.ts
      async function decodeHandler(params: { token?: string; secret: string; salt: string }) {
        if (!params.token) return null;
        const cached = getCachedJwt(params.token);
        if (cached) return cached;
        const decoded = await defaultDecodeSpy(params);
        if (decoded) {
          setCachedJwt(params.token, decoded);
        }
        return decoded;
      }

      // First call: cache miss, must invoke defaultDecode
      expect(getJwtCacheSize()).toBe(0);
      const firstResult = await decodeHandler({ token, secret, salt });
      expect(firstResult?.sub).toBe(rawPayload.sub);
      expect(firstResult?.email).toBe(rawPayload.email);
      expect(defaultDecodeSpy).toHaveBeenCalledTimes(1);
      expect(getJwtCacheSize()).toBe(1);

      // Second call with same token: cache hit, defaultDecode NOT called again!
      const secondResult = await decodeHandler({ token, secret, salt });
      expect(secondResult).toEqual(firstResult);
      expect(defaultDecodeSpy).toHaveBeenCalledTimes(1); // Still 1!

      // Third call: still memoized
      const thirdResult = await decodeHandler({ token, secret, salt });
      expect(thirdResult).toEqual(firstResult);
      expect(defaultDecodeSpy).toHaveBeenCalledTimes(1); // Still 1!
    });

    it('returns null and does not cache when params.token is missing', async () => {
      const { decode: defaultDecode } = await import('next-auth/jwt');
      const defaultDecodeSpy = vi.fn((params) => defaultDecode(params));

      async function decodeHandler(params: { token?: string; secret: string; salt: string }) {
        if (!params.token) return null;
        const cached = getCachedJwt(params.token);
        if (cached) return cached;
        const decoded = await defaultDecodeSpy(params);
        if (decoded) {
          setCachedJwt(params.token, decoded);
        }
        return decoded;
      }

      const result = await decodeHandler({ token: undefined, secret, salt });
      expect(result).toBeNull();
      expect(defaultDecodeSpy).not.toHaveBeenCalled();
      expect(getJwtCacheSize()).toBe(0);
    });
  });
});

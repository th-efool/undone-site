import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PermissionsCache,
  getCachedCohortMember,
  setCachedCohortMember,
  invalidateCohortMember,
  clearPermissionsCache,
  getPermissionsCacheSize,
  getCohortMemberCacheKey,
  DEFAULT_PERMISSIONS_TTL_MS,
  MAX_PERMISSIONS_CACHE_ENTRIES,
} from '../permissionsCache';

describe('PermissionsCache (UserPermissionsCache)', () => {
  beforeEach(() => {
    clearPermissionsCache();
    vi.useRealTimers();
  });

  describe('Singleton functions', () => {
    it('returns null on cache miss', () => {
      const result = getCachedCohortMember('cohort-1', 'user-1');
      expect(result).toBeNull();
    });

    it('returns cached membership and role on cache hit', () => {
      setCachedCohortMember('cohort-1', 'user-1', { isMember: true, role: 'EXPLORER' });

      const cached = getCachedCohortMember('cohort-1', 'user-1');
      expect(cached).toEqual({ isMember: true, role: 'EXPLORER' });
    });

    it('returns cached negative membership when user is not a member', () => {
      setCachedCohortMember('cohort-1', 'user-2', { isMember: false });

      const cached = getCachedCohortMember('cohort-1', 'user-2');
      expect(cached).toEqual({ isMember: false });
      expect(cached?.role).toBeUndefined();
    });

    it('returns null for expired entries and cleans them up', () => {
      vi.useFakeTimers();
      setCachedCohortMember('cohort-1', 'user-1', { isMember: true, role: 'EXPLORER' }, 1000);

      // Advance clock before TTL expires
      vi.advanceTimersByTime(500);
      expect(getCachedCohortMember('cohort-1', 'user-1')).toEqual({
        isMember: true,
        role: 'EXPLORER',
      });

      // Advance clock past TTL (1000ms)
      vi.advanceTimersByTime(501);
      expect(getCachedCohortMember('cohort-1', 'user-1')).toBeNull();
      // Entry should have been removed on access
      expect(getPermissionsCacheSize()).toBe(0);
    });

    it('removes entry when invalidateCohortMember is called', () => {
      setCachedCohortMember('cohort-1', 'user-1', { isMember: true, role: 'EXPLORER' });
      setCachedCohortMember('cohort-1', 'user-2', { isMember: true, role: 'CREATOR' });
      expect(getPermissionsCacheSize()).toBe(2);

      invalidateCohortMember('cohort-1', 'user-1');

      expect(getCachedCohortMember('cohort-1', 'user-1')).toBeNull();
      expect(getCachedCohortMember('cohort-1', 'user-2')).toEqual({
        isMember: true,
        role: 'CREATOR',
      });
      expect(getPermissionsCacheSize()).toBe(1);
    });

    it('clears all entries when clearPermissionsCache is called', () => {
      setCachedCohortMember('cohort-1', 'user-1', { isMember: true });
      setCachedCohortMember('cohort-2', 'user-2', { isMember: true });
      expect(getPermissionsCacheSize()).toBe(2);

      clearPermissionsCache();

      expect(getPermissionsCacheSize()).toBe(0);
      expect(getCachedCohortMember('cohort-1', 'user-1')).toBeNull();
      expect(getCachedCohortMember('cohort-2', 'user-2')).toBeNull();
    });

    it('handles falsy or empty arguments gracefully', () => {
      expect(getCachedCohortMember('', 'user-1')).toBeNull();
      expect(getCachedCohortMember('cohort-1', '')).toBeNull();

      setCachedCohortMember('', 'user-1', { isMember: true });
      expect(getPermissionsCacheSize()).toBe(0);

      invalidateCohortMember('', 'user-1');
      expect(getPermissionsCacheSize()).toBe(0);
    });

    it('preserves key compound format correctly', () => {
      expect(getCohortMemberCacheKey('c1', 'u1')).toBe('c1:u1');
    });

    it('supports updating existing entry without expanding cache size', () => {
      setCachedCohortMember('cohort-1', 'user-1', { isMember: false });
      expect(getPermissionsCacheSize()).toBe(1);
      expect(getCachedCohortMember('cohort-1', 'user-1')).toEqual({ isMember: false });

      setCachedCohortMember('cohort-1', 'user-1', { isMember: true, role: 'EXPLORER' });
      expect(getPermissionsCacheSize()).toBe(1);
      expect(getCachedCohortMember('cohort-1', 'user-1')).toEqual({
        isMember: true,
        role: 'EXPLORER',
      });
    });
  });

  describe('Capacity eviction and LRU behavior', () => {
    it('evicts the oldest entry when reaching maxEntries', () => {
      const cache = new PermissionsCache({ maxEntries: 3, defaultTtlMs: 10_000 });

      cache.setCachedCohortMember('c', 'u1', { isMember: true });
      cache.setCachedCohortMember('c', 'u2', { isMember: true });
      cache.setCachedCohortMember('c', 'u3', { isMember: true });
      expect(cache.getPermissionsCacheSize()).toBe(3);

      // Inserting 4th item should evict u1 (oldest)
      cache.setCachedCohortMember('c', 'u4', { isMember: true });
      expect(cache.getPermissionsCacheSize()).toBe(3);

      expect(cache.getCachedCohortMember('c', 'u1')).toBeNull();
      expect(cache.getCachedCohortMember('c', 'u2')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u3')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u4')).toEqual({ isMember: true });
    });

    it('refreshes LRU position on access so recently read entries are preserved', () => {
      const cache = new PermissionsCache({ maxEntries: 3, defaultTtlMs: 10_000 });

      cache.setCachedCohortMember('c', 'u1', { isMember: true });
      cache.setCachedCohortMember('c', 'u2', { isMember: true });
      cache.setCachedCohortMember('c', 'u3', { isMember: true });

      // Access u1, moving it to most-recently-used
      expect(cache.getCachedCohortMember('c', 'u1')).toEqual({ isMember: true });

      // Inserting u4 should now evict u2 (the new oldest)
      cache.setCachedCohortMember('c', 'u4', { isMember: true });
      expect(cache.getPermissionsCacheSize()).toBe(3);

      expect(cache.getCachedCohortMember('c', 'u1')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u2')).toBeNull(); // evicted
      expect(cache.getCachedCohortMember('c', 'u3')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u4')).toEqual({ isMember: true });
    });

    it('prioritizes evicting expired entries when capacity is reached', () => {
      vi.useFakeTimers();
      const cache = new PermissionsCache({ maxEntries: 3, defaultTtlMs: 10_000 });

      // u1 expires in 1s, u2 and u3 expire in 10s
      cache.setCachedCohortMember('c', 'u1', { isMember: true }, 1_000);
      cache.setCachedCohortMember('c', 'u2', { isMember: true }, 10_000);
      cache.setCachedCohortMember('c', 'u3', { isMember: true }, 10_000);

      // Move time past u1's expiration
      vi.advanceTimersByTime(1_500);

      // Inserting u4 should evict expired u1, preserving u2 and u3
      cache.setCachedCohortMember('c', 'u4', { isMember: true });
      expect(cache.getPermissionsCacheSize()).toBe(3);

      expect(cache.getCachedCohortMember('c', 'u1')).toBeNull(); // expired & evicted
      expect(cache.getCachedCohortMember('c', 'u2')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u3')).toEqual({ isMember: true });
      expect(cache.getCachedCohortMember('c', 'u4')).toEqual({ isMember: true });
    });

    it('respects default TTL and maxEntries constants', () => {
      expect(DEFAULT_PERMISSIONS_TTL_MS).toBe(30_000);
      expect(MAX_PERMISSIONS_CACHE_ENTRIES).toBe(5000);

      const cache = new PermissionsCache();
      expect(cache.getPermissionsCacheSize()).toBe(0);
    });

    it('handles large volume bounding without memory leaks', () => {
      const cache = new PermissionsCache({ maxEntries: 100, defaultTtlMs: 5000 });

      for (let i = 0; i < 250; i++) {
        cache.setCachedCohortMember('c', `u-${i}`, { isMember: true, role: 'EXPLORER' });
      }

      expect(cache.getPermissionsCacheSize()).toBe(100);
      // Items 0..149 should be evicted
      expect(cache.getCachedCohortMember('c', 'u-0')).toBeNull();
      expect(cache.getCachedCohortMember('c', 'u-149')).toBeNull();
      // Items 150..249 should exist
      expect(cache.getCachedCohortMember('c', 'u-150')).toEqual({
        isMember: true,
        role: 'EXPLORER',
      });
      expect(cache.getCachedCohortMember('c', 'u-249')).toEqual({
        isMember: true,
        role: 'EXPLORER',
      });
    });
  });
});

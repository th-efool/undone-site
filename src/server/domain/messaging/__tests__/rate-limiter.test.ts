import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { rateLimiterService } from '../rate-limiter.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { MessagingRateLimitError } from '../contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    rateLimitBucket: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('rateLimiterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('creates a new bucket with count 1 when no bucket exists', async () => {
      vi.mocked(prisma.rateLimitBucket.findUnique).mockResolvedValueOnce(null);

      const result = await rateLimiterService.checkRateLimit('test-key', 5, 60);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      expect(result.resetSeconds).toBe(60);
      expect(prisma.rateLimitBucket.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'test-key' },
          create: expect.objectContaining({ key: 'test-key', count: 1 }),
        })
      );
    });

    it('resets bucket when existing bucket has expired', async () => {
      const past = new Date(Date.now() - 5000);
      vi.mocked(prisma.rateLimitBucket.findUnique).mockResolvedValueOnce({
        key: 'test-key',
        count: 5,
        expiresAt: past,
      } as any);

      const result = await rateLimiterService.checkRateLimit('test-key', 5, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(prisma.rateLimitBucket.upsert).toHaveBeenCalled();
    });

    it('increments count and allows request when within budget', async () => {
      const future = new Date(Date.now() + 45000); // 45s remaining
      vi.mocked(prisma.rateLimitBucket.findUnique).mockResolvedValueOnce({
        key: 'test-key',
        count: 3,
        expiresAt: future,
      } as any);

      vi.mocked(prisma.rateLimitBucket.update).mockResolvedValueOnce({
        key: 'test-key',
        count: 4,
        expiresAt: future,
      } as any);

      const result = await rateLimiterService.checkRateLimit('test-key', 5, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.resetSeconds).toBe(45);
      expect(prisma.rateLimitBucket.update).toHaveBeenCalledWith({
        where: { key: 'test-key' },
        data: { count: { increment: 1 } },
      });
    });

    it('denies request when bucket limit is exhausted', async () => {
      const future = new Date(Date.now() + 30000); // 30s remaining
      vi.mocked(prisma.rateLimitBucket.findUnique).mockResolvedValueOnce({
        key: 'test-key',
        count: 5, // Limit 5 reached!
        expiresAt: future,
      } as any);

      const result = await rateLimiterService.checkRateLimit('test-key', 5, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetSeconds).toBe(30);
      expect(prisma.rateLimitBucket.update).not.toHaveBeenCalled();
    });
  });

  describe('enforce', () => {
    it('throws MessagingRateLimitError when limit is exceeded', async () => {
      const future = new Date(Date.now() + 25000);
      vi.mocked(prisma.rateLimitBucket.findUnique).mockResolvedValueOnce({
        key: 'msg:user-1',
        count: 30,
        expiresAt: future,
      } as any);

      await expect(
        rateLimiterService.enforce('msg:user-1', 30, 60)
      ).rejects.toThrow(MessagingRateLimitError);
    });
  });

  describe('createHeaders', () => {
    it('generates standard rate limit headers including Retry-After when blocked', () => {
      const headers = rateLimiterService.createHeaders({
        allowed: false,
        limit: 30,
        remaining: 0,
        resetSeconds: 42,
      });

      expect(headers['X-RateLimit-Limit']).toBe('30');
      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['X-RateLimit-Reset']).toBe('42');
      expect(headers['Retry-After']).toBe('42');
    });

    it('omits Retry-After when request is allowed', () => {
      const headers = rateLimiterService.createHeaders({
        allowed: true,
        limit: 30,
        remaining: 15,
        resetSeconds: 60,
      });

      expect(headers['Retry-After']).toBeUndefined();
    });
  });
});

import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { MessagingRateLimitError } from './contracts';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export const rateLimiterService = {
  /**
   * Atomically checks and records an action in a distributed rate limit bucket.
   * Backed by PostgreSQL rate_limit_buckets table, safe across multiple serverless instances.
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const bucket = await tx.rateLimitBucket.findUnique({
        where: { key },
      });

      if (!bucket || bucket.expiresAt <= now) {
        const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: {
            key,
            count: 1,
            expiresAt,
          },
          update: {
            count: 1,
            expiresAt,
          },
        });

        return {
          allowed: true,
          limit,
          remaining: Math.max(0, limit - 1),
          resetSeconds: windowSeconds,
        };
      }

      const resetSeconds = Math.max(
        1,
        Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000)
      );

      if (bucket.count >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetSeconds,
        };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - updated.count),
        resetSeconds,
      };
    });
  },

  /**
   * Enforces rate limiting, throwing MessagingRateLimitError if budget is exceeded.
   */
  async enforce(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const result = await this.checkRateLimit(key, limit, windowSeconds);
    if (!result.allowed) {
      throw new MessagingRateLimitError(
        `Rate limit exceeded. Try again in ${result.resetSeconds} seconds.`,
        result.resetSeconds
      );
    }
    return result;
  },

  // Category-specific helpers based on MEMORY-ChatnCentrifugo.md specifications
  async checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:msg:${userId}`, 30, 60);
  },

  async checkConversationRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:conv:${userId}`, 10, 3600);
  },

  async checkSearchRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:search:${userId}`, 30, 60);
  },

  async checkTokenRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:token:${userId}`, 12, 60);
  },

  async checkTypingRateLimit(userId: string, channelId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:typing:${userId}:${channelId}`, 1, 2);
  },

  async checkInvitationRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:inv:${userId}`, 20, 3600);
  },

  async checkReportRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ratelimit:rep:${userId}`, 10, 3600);
  },

  /**
   * Formats HTTP standard rate limit headers.
   */
  createHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetSeconds),
      ...(!result.allowed && { 'Retry-After': String(result.resetSeconds) }),
    };
  },
};

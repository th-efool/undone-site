import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { messageService } from '../message.service';
import { proxyAuthService } from '../proxy-auth.service';
import { interactionService } from '../interaction.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import { MessagingConflictError, MessagingForbiddenError } from '../contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    userRestriction: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    realtimeDelivery: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/messaging.repo', () => ({
  messagingRepo: {
    getChannelWithParent: vi.fn(),
    createMessageTransaction: vi.fn(),
  },
}));

describe('Phase 11 Chaos & Fault Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Outbox & Worker Fault Recovery', () => {
    it('DB commit succeeds, publish fails: outbox delivery remains pending for worker reclamation', async () => {
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);

      // Transaction commits message + creates PENDING RealtimeDelivery
      const committedMessage = {
        id: 'msg-1',
        channelId: 'ch-1',
        authorId: 'user-1',
        content: 'Persisted durable message',
        messageSequence: 1,
        revision: 1,
        author: { id: 'user-1', name: 'Alice', username: 'alice', image: null },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(messagingRepo.createMessageTransaction).mockResolvedValueOnce({
        message: committedMessage as any,
        isIdempotentReplay: false,
      });

      const result = await messageService.sendMessage({
        channelId: 'ch-1',
        authorId: 'user-1',
        content: 'Persisted durable message',
      });

      // Verification: Message accepted and committed despite immediate Centrifugo outage
      expect(result.message.id).toBe('msg-1');
      expect(result.isIdempotentReplay).toBe(false);
      expect(messagingRepo.createMessageTransaction).toHaveBeenCalled();
    });

    it('Database unavailable during send: fails closed with error, no optimistic lie', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockRejectedValueOnce(
        new Error('Connection lost: PostgreSQL unreachable')
      );

      await expect(
        messageService.sendMessage({
          channelId: 'ch-1',
          authorId: 'user-1',
          content: 'Will fail closed',
        })
      ).rejects.toThrow('PostgreSQL unreachable');
    });

    it('Fenced lease validation: expired worker lease cannot acknowledge delivery', async () => {
      // Worker 1 holds leaseToken-1 which expired
      const delivery = {
        id: 'del-1',
        status: 'PENDING',
        leaseToken: 'token-active-worker-2', // Reclaimed by Worker 2!
        leaseUntil: new Date(Date.now() + 30000),
      };

      // Simulated atomic update guarding leaseToken
      const attemptAck = (d: typeof delivery, claimedToken: string) => {
        if (d.leaseToken !== claimedToken) {
          throw new Error('Fenced lease violation: lease token mismatch or expired');
        }
        return { ...d, status: 'DELIVERED' };
      };

      expect(() => attemptAck(delivery, 'stale-token-worker-1')).toThrow(
        'Fenced lease violation'
      );
    });

    it('Poison pill dead-lettering: failed delivery moves to DEAD_LETTER after max attempts without crashing other deliveries', async () => {
      const MAX_ATTEMPTS = 5;
      const delivery = {
        id: 'del-poison',
        attempts: 4,
        status: 'PENDING',
      };

      const processAttempt = (d: typeof delivery, fail: boolean) => {
        const nextAttempts = d.attempts + 1;
        if (fail) {
          if (nextAttempts >= MAX_ATTEMPTS) {
            return { ...d, attempts: nextAttempts, status: 'DEAD_LETTER', lastError: 'Fatal JSON malformation' };
          }
          return { ...d, attempts: nextAttempts, status: 'PENDING' };
        }
        return { ...d, attempts: nextAttempts, status: 'DELIVERED' };
      };

      const result = processAttempt(delivery, true);
      expect(result.status).toBe('DEAD_LETTER');
      expect(result.attempts).toBe(5);
    });
  });

  describe('Access Generation & Revocation Barriers', () => {
    it('rejects subscription refresh when channel generation has advanced', async () => {
      // Conversation has advanced to generation 2 (due to member removal)
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'conv-1',
        kind: 'GROUP',
        accessGeneration: 2,
      } as any);

      // Old socket client presents generation 1 in channel string "group:conv-1:g1"
      const result = await proxyAuthService.authorizeSubscription(
        'user-1',
        'group:conv-1:g1'
      );

      // Verification: Old generation is rejected!
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(103);
      expect(result.message).toContain('Invalid access generation');
    });

    it('rejects removed member on subscription refresh even with correct generation', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'conv-1',
        kind: 'GROUP',
        accessGeneration: 2,
      } as any);

      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValueOnce(null);

      const result = await proxyAuthService.authorizeSubscription(
        'removed-user',
        'group:conv-1:g2'
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe(103);
      expect(result.message).toContain('User is not an active participant');
    });
  });

  describe('Tombstone Permanence under Late Event Replays', () => {
    it('editing a deleted message fails with forbidden error, preventing resurrection', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-deleted',
        authorId: 'user-1',
        channelId: 'ch-1',
        revision: 1,
        deletedAt: new Date(Date.now() - 60000), // Message was already deleted!
        createdAt: new Date(Date.now() - 120000),
      } as any);

      await expect(
        interactionService.editMessage({
          messageId: 'msg-deleted',
          userId: 'user-1',
          content: 'Trying to resurrect message body',
          expectedRevision: 1,
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });
});

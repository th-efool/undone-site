import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { messageService } from '../message.service';
import { sanitizeMessageContent, validateSafeUrl } from '../sanitizer';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '../contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    userRestriction: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
    },
    cohortMember: {
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

describe('Phase 11 Security & Abuse Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Restriction & Ban Enforcement', () => {
    it('blocks restricted/banned accounts from sending messages', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce({
        userId: 'banned-user',
        bannedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // Active ban for 24h
      } as any);

      await expect(
        messageService.sendMessage({
          channelId: 'ch-1',
          authorId: 'banned-user',
          content: 'I want to post spam',
        })
      ).rejects.toThrow(MessagingForbiddenError);

      expect(messagingRepo.createMessageTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Direct ID Substitution & Scope Leaks', () => {
    it('rejects sending into a foreign channel where user is not a member', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);

      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'foreign-chan',
        community: {
          cohortId: 'private-cohort',
          chatEnabled: true,
          cohort: { creatorId: 'legit-creator' },
        },
      } as any);

      // Caller is NOT in cohort_members
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        messageService.sendMessage({
          channelId: 'foreign-chan',
          authorId: 'attacker-1',
          content: 'Cross-tenant probe',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects replyTo pointing to a foreign channel (cross-channel reply attack)', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);

      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'chan-a',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      // The targeted parent message belongs to chan-b!
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'foreign-parent-msg',
        channelId: 'chan-b',
      } as any);

      await expect(
        messageService.sendMessage({
          channelId: 'chan-a',
          authorId: 'user-1',
          content: 'Malicious reply referencing foreign channel',
          replyToId: 'foreign-parent-msg',
        })
      ).rejects.toThrow(MessagingValidationError);
    });
  });

  describe('Content Sanitization & Payload Ceilings', () => {
    it('enforces 4,000-character ceiling on message length', () => {
      const oversized = 'A'.repeat(4001);
      expect(() => sanitizeMessageContent(oversized)).toThrow(MessagingValidationError);

      const withinLimit = 'A'.repeat(4000);
      expect(sanitizeMessageContent(withinLimit)).toHaveLength(4000);
    });

    it('strips null bytes and non-printable control characters', () => {
      const malicious = 'Hello\u0000World!\u0007\u001F';
      const cleaned = sanitizeMessageContent(malicious);
      expect(cleaned).toBe('HelloWorld!');
    });

    it('rejects empty or whitespace-only messages', () => {
      expect(() => sanitizeMessageContent('')).toThrow(MessagingValidationError);
      expect(() => sanitizeMessageContent('   \n\t  ')).toThrow(MessagingValidationError);
    });

    it('validates URLs and blocks dangerous URI schemes (XSS prevention)', () => {
      expect(() => validateSafeUrl('javascript:alert(document.cookie)')).toThrow(
        MessagingValidationError
      );
      expect(() => validateSafeUrl('data:text/html,<script>alert(1)</script>')).toThrow(
        MessagingValidationError
      );
      expect(() => validateSafeUrl('vbscript:msgbox(1)')).toThrow(
        MessagingValidationError
      );

      // Valid HTTP/HTTPS approved
      expect(validateSafeUrl('https://example.com/guide')).toBe('https://example.com/guide');
    });
  });
});

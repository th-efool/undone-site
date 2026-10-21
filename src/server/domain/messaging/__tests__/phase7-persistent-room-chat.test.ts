/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { messageService } from '../message.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import { GET as getChannelMessages } from '@/src/app/api/channels/[channelId]/messages/route';
import { NextRequest } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockChannel = {
    findUnique: vi.fn(),
  };

  const mockUser = {
    findUnique: vi.fn(),
  };

  const mockCohortMember = {
    findUnique: vi.fn(),
  };

  const mockRoomLease = {
    findFirst: vi.fn(),
  };

  const mockRoomParticipant = {
    findFirst: vi.fn(),
  };

  const mockMessage = {
    findUnique: vi.fn(),
  };

  const mockUserRestriction = {
    findUnique: vi.fn().mockResolvedValue(null),
  };

  return {
    prisma: {
      channel: mockChannel,
      user: mockUser,
      cohortMember: mockCohortMember,
      roomLease: mockRoomLease,
      roomParticipant: mockRoomParticipant,
      message: mockMessage,
      userRestriction: mockUserRestriction,
    },
  };
});

vi.mock('@/src/server/infrastructure/db/postgres/repositories/messaging.repo', () => ({
  messagingRepo: {
    createMessageTransaction: vi.fn(),
    getChannelWithParent: vi.fn(),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getChannelMessages: vi.fn(),
  },
}));

describe('Phase 7: Persistent Room Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('messageService.sendMessage for Study Rooms', () => {
    it('authorizes active room participant and dispatches message', async () => {
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: null,
        },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'user1@test.com',
        username: 'user1',
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(messagingRepo.createMessageTransaction).mockResolvedValueOnce({
        message: {
          id: 'msg-1',
          content: 'Hello study room',
          channelId: 'chan-room-1',
          authorId: 'user-1',
          messageSequence: 1,
          clientRequestId: 'req-1',
          replyToId: null,
          revision: 1,
          editedAt: null,
          deletedAt: null,
          deletionReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: { id: 'user-1', name: 'User One', image: null, username: 'user1' },
        },
        isIdempotentReplay: false,
      });

      const result = await messageService.sendMessage({
        channelId: 'chan-room-1',
        authorId: 'user-1',
        content: 'Hello study room',
        clientRequestId: 'req-1',
      });

      expect(result.message.id).toBe('msg-1');
      expect(messagingRepo.createMessageTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'chan-room-1',
          authorId: 'user-1',
          content: 'Hello study room',
          clientRequestId: 'req-1',
        })
      );
    });

    it('rejects message sending if study room is closed', async () => {
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'CLOSED',
          cohortId: null,
        },
      } as any);

      await expect(
        messageService.sendMessage({
          channelId: 'chan-room-1',
          authorId: 'user-1',
          content: 'Hello',
        })
      ).rejects.toThrow('Study room is not active');
    });

    it('rejects message sending if user has no active lease or participant record', async () => {
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: null,
        },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-stranger',
        email: 'stranger@test.com',
      } as any);

      // No lease, no participant
      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);

      await expect(
        messageService.sendMessage({
          channelId: 'chan-room-1',
          authorId: 'user-stranger',
          content: 'Hello',
        })
      ).rejects.toThrow('Not an active participant in this study room');
    });

    it('rejects message sending if room is cohort-scoped and user is not enrolled', async () => {
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: 'cohort-100',
        },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-not-enrolled',
        email: 'user@test.com',
      } as any);

      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        messageService.sendMessage({
          channelId: 'chan-room-1',
          authorId: 'user-not-enrolled',
          content: 'Hello',
        })
      ).rejects.toThrow('Cohort enrollment required to chat in this room');
    });
  });

  describe('GET /api/channels/[channelId]/messages for Study Rooms', () => {
    it('returns 200 with messages for active room participant', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);

      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: null,
        },
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(communityRepo.getChannelMessages).mockResolvedValueOnce([
        {
          id: 'msg-1',
          content: 'Persisted message',
          channelId: 'chan-room-1',
          authorId: 'user-1',
          messageSequence: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const req = new NextRequest('http://localhost/api/channels/chan-room-1/messages?limit=20');
      const res = await getChannelMessages(req, {
        params: Promise.resolve({ channelId: 'chan-room-1' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(1);
      expect(json[0].id).toBe('msg-1');
      expect(communityRepo.getChannelMessages).toHaveBeenCalledWith('chan-room-1', 20, undefined);
    });

    it('returns 403 if user is not an active participant in the study room', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-unauthorized' } as any);

      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'chan-room-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: null,
        },
      } as any);

      // No active lease and no participant
      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/channels/chan-room-1/messages');
      const res = await getChannelMessages(req, {
        params: Promise.resolve({ channelId: 'chan-room-1' }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/not an active participant/i);
    });
  });
});

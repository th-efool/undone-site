/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyroomPolicy } from '../studyroom.policy';
import { studyRoomService } from '../studyroom.service';
import { roomManagementService } from '../room-management.service';
import { messageService } from '@/src/server/domain/messaging/message.service';
import { proxyAuthService } from '@/src/server/domain/messaging/proxy-auth.service';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import { deriveViewer } from '@/src/client/screens/dashboard/studyroom/utils/deriveParticipants';
import {
  RoomForbiddenError,
  RoomNotFoundError,
} from '@/src/shared/studyroom/contracts';
import { MessagingForbiddenError } from '@/src/server/domain/messaging/contracts';

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    studyRoom: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    roomLease: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    roomController: {
      findUnique: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
    },
    roomRestriction: {
      findUnique: vi.fn(),
    },
    roomOwnershipTransfer: {
      findFirst: vi.fn(),
    },
    roomAuditLog: {
      create: vi.fn(),
    },
    userRestriction: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/messaging.repo', () => ({
  messagingRepo: {
    getChannelWithParent: vi.fn(),
    createMessageTransaction: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/messaging/sanitizer', () => ({
  sanitizeMessageContent: vi.fn((content: string) => content),
}));

vi.mock('@/src/server/domain/notifications/notification.service', () => ({
  notificationService: {
    createNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Integration Phase 3: Unified Room Authorization and Bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Denial of Shared Guest Accounts', () => {
    it('resolveRoomEligibility returns GUEST_RESTRICTED for shared guest account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@undone.com',
        username: 'guest',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      const room = {
        id: 'room-1',
        slug: 'focus-room',
        title: 'Focus Room',
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 25,
        revision: 1,
      };

      const result = await studyroomPolicy.resolveRoomEligibility(room, 'guest-1');
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('GUEST_RESTRICTED');
    });

    it('resolveUserRoomRole forces VIEWER role for shared guest account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@sidequesthq.com',
        username: 'guest',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      const room = {
        id: 'room-1',
        slug: 'focus-room',
        title: 'Focus Room',
        ownerId: 'guest-1', // Even if assigned as owner in DB row
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 25,
        revision: 1,
      };

      const role = await studyroomPolicy.resolveUserRoomRole(room, 'guest-1');
      expect(role.role).toBe('VIEWER');
      expect(role.isOwner).toBe(false);
    });

    it('assertCanControlEnvironment rejects shared guest account with RoomForbiddenError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@undone.com',
        username: 'guest',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      await expect(
        studyroomPolicy.assertCanControlEnvironment('room-1', 'guest-1')
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('joinRoom blocks shared guest account', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-1',
        slug: 'focus-room',
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 25,
        revision: 1,
      } as any);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        slug: 'focus-room',
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 25,
        revision: 1,
      } as any);
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@undone.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      await expect(
        studyRoomService.joinRoom({
          userId: 'guest-1',
          roomId: 'room-1',
          tabId: 'tab-1',
        })
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('messageService.sendMessage rejects guest posting in study room chat', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValue(null);
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValue({
        id: 'chan-1',
        studyRoom: {
          id: 'room-1',
          status: 'OPEN',
          cohortId: null,
        },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@undone.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      await expect(
        messageService.sendMessage({
          channelId: 'chan-1',
          authorId: 'guest-1',
          content: 'Hello study room!',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('proxyAuthService denies realtime subscription for shared guest account', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'guest-1',
        email: 'guest@undone.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(true);

      const decision = await proxyAuthService.authorizeSubscription('guest-1', 'room:room-1:g1');
      expect(decision.allowed).toBe(false);
      expect(decision.message).toContain('Guest accounts cannot subscribe');

      const chatDecision = await proxyAuthService.authorizeSubscription('guest-1', 'roomchat:chan-1:g1');
      expect(chatDecision.allowed).toBe(false);
      expect(chatDecision.message).toContain('Guest accounts cannot subscribe');
    });
  });

  describe('Cohort Scope & Enrollment Enforcement', () => {
    it('denies room eligibility and roster to non-enrolled users for cohort rooms', async () => {
      const cohortRoom = {
        id: 'room-cohort-1',
        slug: 'dsa-study',
        title: 'DSA Study Room',
        status: 'OPEN',
        listing: 'PUBLIC',
        cohortId: 'cohort-100',
        capacity: 25,
        revision: 1,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-outsider',
        email: 'outsider@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null); // Not enrolled
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue(cohortRoom as any);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(cohortRoom as any);

      // 1. Eligibility Check
      const eligibility = await studyroomPolicy.resolveRoomEligibility(cohortRoom, 'user-outsider');
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('ENROLLMENT_REQUIRED');

      // 2. Roster Access Check
      await expect(
        studyRoomService.getRoomRoster('dsa-study', 'user-outsider')
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('denies message sending in cohort room chat to non-enrolled users', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValue(null);
      vi.mocked(messagingRepo.getChannelWithParent).mockResolvedValue({
        id: 'chan-cohort-1',
        studyRoom: {
          id: 'room-cohort-1',
          status: 'OPEN',
          cohortId: 'cohort-100',
        },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-outsider',
        email: 'outsider@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null); // Not enrolled

      await expect(
        messageService.sendMessage({
          channelId: 'chan-cohort-1',
          authorId: 'user-outsider',
          content: 'Hi cohort members',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('denies realtime subscription to cohort room channels for non-enrolled users', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-outsider',
        email: 'outsider@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-cohort-1',
        status: 'OPEN',
        cohortId: 'cohort-100',
      } as any);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null); // Not enrolled

      const decision = await proxyAuthService.authorizeSubscription('user-outsider', 'room:room-cohort-1:g1');
      expect(decision.allowed).toBe(false);
      expect(decision.message).toContain('Cohort enrollment required');
    });
  });

  describe('Capability-Driven Frontend Derivation vs URL Overrides', () => {
    it('authoritative server capabilities override viewAsOverride query parameter', () => {
      const room = {
        slug: 'library',
        title: 'Library',
        atmosphere: 'Silent focus',
        previewImage: '/scenes/library.webp',
        adminUserId: 'demo-mira',
        adminDisplayName: 'Mira',
        defaultEnvironment: {} as any,
      };

      // Server explicitly denies environment and room editing capabilities
      const serverCapabilities = {
        canJoin: true,
        canEditRoom: false,
        canControlEnvironment: false,
        canManageParticipants: false,
        canTransferOwnership: false,
        canChangeLifecycle: false,
        canManageRoles: false,
        eligibilityReason: 'ELIGIBLE' as const,
      };

      // Client tried spoofing with viewAsOverride: 'admin'
      const viewer = deriveViewer({
        session: { user: { id: 'user-attacker', name: 'Attacker' } },
        room: room as any,
        viewAsOverride: 'admin',
        roomRole: 'PARTICIPANT',
        capabilities: serverCapabilities,
      });

      // Role must resolve to member because capabilities dictate permissions
      expect(viewer.role).toBe('member');
      expect(viewer.capabilities?.canControlEnvironment).toBe(false);
    });
  });

  describe('Read-Only Bootstrap Completeness & Purity', () => {
    it('returns complete metadata, channel, environment, and sprint snapshots on GET', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-1',
        slug: 'library',
        title: 'Library',
        description: 'Quiet study',
        thumbnail: '/rooms/lib.jpg',
        visualPresetId: 'library',
        status: 'OPEN',
        listing: 'LISTED',
        capacity: 25,
        onlineCount: 4,
        rules: 'Be quiet',
        tags: ['focus'],
        language: 'en',
        revision: 2,
        ownerId: 'owner-1',
        owner: { id: 'owner-1', name: 'Owner', username: 'owner' },
        cohortId: null,
        cohort: null,
        createdAt: new Date('2026-10-21T00:00:00.000Z'),
        channel: { id: 'chan-123' },
        environment: {
          sceneId: 'library-dawn',
          soundscapeId: 'rain',
          musicPresetId: null,
          musicStreamUrl: null,
          revision: 3,
          updatedAt: new Date('2026-10-21T01:00:00.000Z'),
        },
        sprints: [
          {
            id: 'sprint-1',
            status: 'ACTIVE',
            targetDurationSeconds: 1500,
            elapsedSeconds: 300,
            revision: 1,
            deadline: new Date('2026-10-21T01:25:00.000Z'),
          },
        ],
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);

      const bootstrap = await roomManagementService.getRoomBootstrap('library', 'user-1');

      expect(bootstrap.room.slug).toBe('library');
      expect(bootstrap.channelId).toBe('chan-123');
      expect(bootstrap.environment?.sceneId).toBe('library-dawn');
      expect(bootstrap.environment?.revision).toBe(3);
      expect(bootstrap.sprint?.status).toBe('ACTIVE');
      expect(bootstrap.sprint?.remainingSeconds).toBe(1200);
      expect(bootstrap.serverTime).toBeDefined();
      expect(bootstrap.capabilities.canJoin).toBe(true);
    });

    it('redacts sensitive channelId for ineligible users', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-cohort-1',
        slug: 'private-cohort-room',
        title: 'Private Cohort Room',
        status: 'OPEN',
        listing: 'LISTED',
        capacity: 25,
        onlineCount: 1,
        ownerId: 'owner-1',
        cohortId: 'cohort-locked',
        cohort: { id: 'cohort-locked', title: 'Private Cohort', visibility: 'PRIVATE' },
        createdAt: new Date(),
        channel: { id: 'chan-secret-999' },
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null); // Not enrolled
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-outsider',
        email: 'outsider@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);

      const bootstrap = await roomManagementService.getRoomBootstrap('private-cohort-room', 'user-outsider');

      expect(bootstrap.capabilities.canJoin).toBe(false);
      expect(bootstrap.capabilities.eligibilityReason).toBe('ENROLLMENT_REQUIRED');
      // Chat channel ID is strictly withheld from non-members
      expect(bootstrap.channelId).toBeNull();
    });

    it('unlisted rooms throw RoomNotFoundError (404) for unauthorized users', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-secret',
        slug: 'secret-unlisted-room',
        title: 'Secret Room',
        status: 'OPEN',
        listing: 'UNLISTED',
        ownerId: 'owner-1',
        cohortId: null,
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.roomController.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-curious',
        email: 'curious@example.com',
      } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValue(false);

      await expect(
        roomManagementService.getRoomBootstrap('secret-unlisted-room', 'user-curious')
      ).rejects.toThrow(RoomNotFoundError);
    });
  });
});

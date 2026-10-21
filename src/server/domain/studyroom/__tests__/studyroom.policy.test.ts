/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { studyroomPolicy, type RoomEntity } from '../studyroom.policy';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  RoomValidationError,
  RoomForbiddenError,
  RoomQuotaExceededError,
} from '@/src/shared/studyroom/contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    roomController: {
      findUnique: vi.fn(),
    },
    roomLease: {
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
    roomRestriction: {
      findUnique: vi.fn(),
    },
  },
}));

describe('studyroomPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRoomSlug', () => {
    it('accepts valid alphanumeric slugs with hyphens', () => {
      expect(studyroomPolicy.validateRoomSlug('focus-room')).toBe('focus-room');
      expect(studyroomPolicy.validateRoomSlug('developer-den-42')).toBe('developer-den-42');
      expect(studyroomPolicy.validateRoomSlug('  library-silent  ')).toBe('library-silent');
    });

    it('rejects slugs with uppercase or invalid symbols', () => {
      expect(() => studyroomPolicy.validateRoomSlug('Focus_Room')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('focus room')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('focus--room')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('-focus')).toThrow(RoomValidationError);
    });

    it('rejects slugs that are too short or too long', () => {
      expect(() => studyroomPolicy.validateRoomSlug('a')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('a'.repeat(65))).toThrow(RoomValidationError);
    });

    it('rejects reserved slug keywords', () => {
      expect(() => studyroomPolicy.validateRoomSlug('new')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('manage')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('session')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('roster')).toThrow(RoomValidationError);
      expect(() => studyroomPolicy.validateRoomSlug('admin')).toThrow(RoomValidationError);
    });
  });

  describe('resolveUserRoomRole', () => {
    const standaloneRoom: RoomEntity = {
      id: 'room-1',
      slug: 'fireplace',
      title: 'Fireplace',
      ownerId: 'owner-1',
      cohortId: null,
      status: 'OPEN',
      listing: 'LISTED',
      capacity: 25,
      revision: 1,
    };

    it('returns VIEWER when userId is null', async () => {
      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, null);
      expect(res.role).toBe('VIEWER');
      expect(res.isOwner).toBe(false);
    });

    it('resolves OWNER when userId matches room.ownerId', async () => {
      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, 'owner-1');
      expect(res.role).toBe('OWNER');
      expect(res.isOwner).toBe(true);
    });

    it('resolves MODERATOR when user is designated in room_controllers', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        role: 'MODERATOR',
      } as any);

      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, 'mod-1');
      expect(res.role).toBe('MODERATOR');
      expect(res.isOwner).toBe(false);
    });

    it('resolves HOST when user is designated in room_controllers', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        role: 'HOST',
      } as any);

      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, 'host-1');
      expect(res.role).toBe('HOST');
      expect(res.isOwner).toBe(false);
    });

    it('resolves MODERATOR when user is cohort creator for cohort-scoped room', async () => {
      const cohortRoom: RoomEntity = {
        ...standaloneRoom,
        cohortId: 'cohort-1',
        ownerId: 'cohort-member-1',
      };

      vi.mocked(prisma.cohort.findUnique).mockResolvedValueOnce({
        creatorId: 'cohort-creator',
      } as any);

      const res = await studyroomPolicy.resolveUserRoomRole(cohortRoom, 'cohort-creator');
      expect(res.role).toBe('MODERATOR');
      expect(res.isCohortGovernor).toBe(true);
    });

    it('resolves PARTICIPANT when user has an active lease', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
        id: 'lease-1',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, 'student-1');
      expect(res.role).toBe('PARTICIPANT');
    });

    it('resolves VIEWER when user is authenticated with no lease or role', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce(null);

      const res = await studyroomPolicy.resolveUserRoomRole(standaloneRoom, 'stranger-1');
      expect(res.role).toBe('VIEWER');
    });
  });

  describe('resolveRoomEligibility', () => {
    const openRoom: RoomEntity = {
      id: 'room-1',
      slug: 'library',
      title: 'Library',
      ownerId: 'owner-1',
      cohortId: null,
      status: 'OPEN',
      listing: 'LISTED',
      capacity: 10,
      revision: 1,
    };

    it('returns NOT_AUTHENTICATED when userId is null', async () => {
      const res = await studyroomPolicy.resolveRoomEligibility(openRoom, null);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('NOT_AUTHENTICATED');
    });

    it('returns ROOM_CLOSED when room is CLOSED or ARCHIVED', async () => {
      const closedRoom = { ...openRoom, status: 'CLOSED' };
      const res = await studyroomPolicy.resolveRoomEligibility(closedRoom, 'user-1');
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('ROOM_CLOSED');

      const archivedRoom = { ...openRoom, status: 'ARCHIVED' };
      const resArchived = await studyroomPolicy.resolveRoomEligibility(archivedRoom, 'user-1');
      expect(resArchived.eligible).toBe(false);
      expect(resArchived.reason).toBe('ROOM_CLOSED');
    });

    it('returns DRAFT_RESTRICTED when room is in DRAFT status', async () => {
      const draftRoom = { ...openRoom, status: 'DRAFT' };
      const res = await studyroomPolicy.resolveRoomEligibility(draftRoom, 'user-1');
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('DRAFT_RESTRICTED');
    });

    it('returns USER_BANNED when active ban restriction exists', async () => {
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce({
        action: 'BAN',
        reason: 'Disruptive behavior',
        expiresAt: null, // indefinite
      } as any);

      const res = await studyroomPolicy.resolveRoomEligibility(openRoom, 'banned-user');
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('USER_BANNED');
      expect(res.details?.reason).toBe('Disruptive behavior');
    });

    it('returns USER_KICKED_COOLDOWN when kick cooldown is active', async () => {
      const future = new Date(Date.now() + 60000);
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce({
        action: 'REMOVE',
        expiresAt: future,
      } as any);

      const res = await studyroomPolicy.resolveRoomEligibility(openRoom, 'kicked-user');
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('USER_KICKED_COOLDOWN');
    });

    it('returns ENROLLMENT_REQUIRED for cohort room when user is not member', async () => {
      const cohortRoom = { ...openRoom, cohortId: 'cohort-100' };
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce(null);

      const res = await studyroomPolicy.resolveRoomEligibility(cohortRoom, 'non-enrolled');
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('ENROLLMENT_REQUIRED');
      expect(res.details?.cohortId).toBe('cohort-100');
    });

    it('returns ROOM_FULL when active leases meet or exceed capacity for a new user', async () => {
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce(new Array(10).fill({ userId: 'u' }) as any);

      const res = await studyroomPolicy.resolveRoomEligibility(openRoom, 'new-user', false);
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('ROOM_FULL');
      expect(res.details?.capacity).toBe(10);
    });

    it('returns ELIGIBLE when room is open and user satisfies all criteria', async () => {
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce(new Array(4).fill({ userId: 'u' }) as any);

      const res = await studyroomPolicy.resolveRoomEligibility(openRoom, 'eligible-user', false);
      expect(res.eligible).toBe(true);
      expect(res.reason).toBe('ELIGIBLE');
    });
  });

  describe('evaluateCapabilities', () => {
    const testRoom: RoomEntity = {
      id: 'room-1',
      slug: 'den',
      title: 'Dev Den',
      ownerId: 'owner-1',
      cohortId: null,
      status: 'OPEN',
      listing: 'LISTED',
      capacity: 25,
      revision: 1,
    };

    it('evaluates full owner capabilities', async () => {
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([] as any);

      const caps = await studyroomPolicy.evaluateCapabilities(testRoom, 'owner-1', null, true);
      expect(caps.canJoin).toBe(true);
      expect(caps.canEditRoom).toBe(true);
      expect(caps.canControlEnvironment).toBe(true);
      expect(caps.canManageParticipants).toBe(true);
      expect(caps.canTransferOwnership).toBe(true);
      expect(caps.canChangeLifecycle).toBe(true);
      expect(caps.canManageRoles).toBe(true);
      expect(caps.eligibilityReason).toBe('ELIGIBLE');
    });

    it('evaluates moderator capabilities without ownership permissions', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({ role: 'MODERATOR' } as any);
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([] as any);

      const caps = await studyroomPolicy.evaluateCapabilities(testRoom, 'mod-1', null, true);
      expect(caps.canJoin).toBe(true);
      expect(caps.canEditRoom).toBe(false);
      expect(caps.canControlEnvironment).toBe(true);
      expect(caps.canManageParticipants).toBe(true);
      expect(caps.canTransferOwnership).toBe(false);
      expect(caps.canChangeLifecycle).toBe(false);
      expect(caps.canManageRoles).toBe(false);
    });

    it('denies environment control to host when host does not have an active lease in room', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({ role: 'HOST' } as any);
      vi.mocked(prisma.roomRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([] as any);

      // hasActiveLease is false
      const caps = await studyroomPolicy.evaluateCapabilities(testRoom, 'host-1', null, false);
      expect(caps.canControlEnvironment).toBe(false);
    });
  });

  describe('assertTargetHierarchy', () => {
    it('allows OWNER to moderate MODERATOR, HOST, and PARTICIPANT', () => {
      expect(() => studyroomPolicy.assertTargetHierarchy('OWNER', 'MODERATOR')).not.toThrow();
      expect(() => studyroomPolicy.assertTargetHierarchy('OWNER', 'HOST')).not.toThrow();
      expect(() => studyroomPolicy.assertTargetHierarchy('OWNER', 'PARTICIPANT')).not.toThrow();
    });

    it('allows MODERATOR to moderate HOST and PARTICIPANT', () => {
      expect(() => studyroomPolicy.assertTargetHierarchy('MODERATOR', 'HOST')).not.toThrow();
      expect(() => studyroomPolicy.assertTargetHierarchy('MODERATOR', 'PARTICIPANT')).not.toThrow();
    });

    it('prevents MODERATOR from targeting OWNER or peer MODERATOR', () => {
      expect(() => studyroomPolicy.assertTargetHierarchy('MODERATOR', 'OWNER')).toThrow(RoomForbiddenError);
      expect(() => studyroomPolicy.assertTargetHierarchy('MODERATOR', 'MODERATOR')).toThrow(RoomForbiddenError);
    });

    it('prevents HOST from moderating anyone', () => {
      expect(() => studyroomPolicy.assertTargetHierarchy('HOST', 'PARTICIPANT')).toThrow(RoomForbiddenError);
      expect(() => studyroomPolicy.assertTargetHierarchy('HOST', 'MODERATOR')).toThrow(RoomForbiddenError);
    });
  });

  describe('assertCreationQuota', () => {
    it('rejects creation when user already has max open standalone rooms', async () => {
      vi.mocked(prisma.studyRoom.count).mockResolvedValueOnce(3); // 3 open rooms

      await expect(studyroomPolicy.assertCreationQuota('user-1')).rejects.toThrow(RoomQuotaExceededError);
    });

    it('rejects creation when user has created 10 rooms in 24 hours', async () => {
      vi.mocked(prisma.studyRoom.count)
        .mockResolvedValueOnce(1) // open standalone: 1 < 3
        .mockResolvedValueOnce(10); // 10 in 24h

      await expect(studyroomPolicy.assertCreationQuota('user-1')).rejects.toThrow(RoomQuotaExceededError);
    });

    it('allows creation when within quota thresholds', async () => {
      vi.mocked(prisma.studyRoom.count)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3);

      await expect(studyroomPolicy.assertCreationQuota('user-1')).resolves.not.toThrow();
    });
  });
});

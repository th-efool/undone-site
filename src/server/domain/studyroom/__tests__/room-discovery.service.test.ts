import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { roomDiscoveryService } from '../room-discovery.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: {
      findMany: vi.fn(),
    },
    cohort: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    studyRoom: {
      findMany: vi.fn(),
    },
    roomParticipant: {
      findMany: vi.fn(),
    },
    roomLease: {
      findMany: vi.fn(),
    },
  },
}));

describe('roomDiscoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cohortMember.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cohort.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studyRoom.findMany).mockResolvedValue([]);
  });

  describe('discoverRooms', () => {
    it('queries open listed standalone rooms for anonymous user in discover tab', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        {
          id: 'room-1',
          slug: 'library',
          title: 'Library',
          description: 'Quiet sanctuary',
          thumbnail: '/images/studyrooms/scenes/library.webp',
          visualPresetId: 'library',
          status: 'OPEN',
          listing: 'LISTED',
          cohortId: null,
          cohort: null,
          ownerId: 'user-1',
          owner: { id: 'user-1', name: 'Alice', username: 'alice', image: null },
          onlineCount: 4,
          capacity: 25,
          tags: ['quiet', 'books'],
          language: 'en',
          createdAt: new Date('2026-10-20T00:00:00Z'),
          updatedAt: new Date('2026-10-20T00:00:00Z'),
        },
      ] as any);

      const result = await roomDiscoveryService.discoverRooms({ tab: 'discover' }, null);

      expect(prisma.cohortMember.findMany).not.toHaveBeenCalled();
      expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: 'OPEN' },
              { listing: 'LISTED' },
              { cohortId: null },
            ],
          },
        })
      );
      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].title).toBe('Library');
      expect(result.rooms[0].scopeKind).toBe('STANDALONE');
    });

    it('includes user enrolled cohort rooms in discover tab', async () => {
      vi.mocked(prisma.cohortMember.findMany).mockResolvedValueOnce([
        { cohortId: 'cohort-101' },
      ] as any);

      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        {
          id: 'room-cohort',
          slug: 'cs-study',
          title: 'CS 101 Group',
          description: null,
          thumbnail: null,
          visualPresetId: null,
          status: 'OPEN',
          listing: 'LISTED',
          cohortId: 'cohort-101',
          cohort: { id: 'cohort-101', title: 'Computer Science' },
          ownerId: 'user-2',
          owner: null,
          onlineCount: 2,
          capacity: 30,
          tags: [],
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const result = await roomDiscoveryService.discoverRooms({ tab: 'discover' }, 'user-student');

      expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: 'OPEN' },
              { listing: 'LISTED' },
              {
                OR: [
                  { cohortId: null },
                  { cohortId: { in: ['cohort-101'] } },
                ],
              },
            ],
          },
        })
      );
      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].scopeKind).toBe('COHORT');
      expect(result.rooms[0].cohortTitle).toBe('Computer Science');
    });

    it('returns empty for cohort tab if user has no cohorts', async () => {
      vi.mocked(prisma.cohortMember.findMany).mockResolvedValueOnce([]);

      const result = await roomDiscoveryService.discoverRooms({ tab: 'cohorts' }, 'user-loner');

      expect(result.rooms).toEqual([]);
      expect(prisma.studyRoom.findMany).not.toHaveBeenCalled();
    });

    it('queries owned or controlled rooms in my-rooms tab', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        {
          id: 'room-my',
          slug: 'my-den',
          title: 'My Den',
          description: null,
          thumbnail: null,
          visualPresetId: null,
          status: 'DRAFT',
          listing: 'UNLISTED',
          cohortId: null,
          cohort: null,
          ownerId: 'user-me',
          owner: null,
          onlineCount: 0,
          capacity: 10,
          tags: [],
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const result = await roomDiscoveryService.discoverRooms({ tab: 'my-rooms' }, 'user-me');

      expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: { not: 'ARCHIVED' } },
              {
                OR: [
                  { ownerId: 'user-me' },
                  { controllers: { some: { userId: 'user-me' } } },
                ],
              },
            ],
          },
        })
      );
      expect(result.rooms[0].status).toBe('DRAFT');
    });

    it('filters by keyword search across title and description', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([]);

      await roomDiscoveryService.discoverRooms({ tab: 'discover', query: 'calculus' }, null);

      expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { status: 'OPEN' },
              { listing: 'LISTED' },
              { cohortId: null },
              {
                OR: [
                  { title: { contains: 'calculus', mode: 'insensitive' } },
                  { description: { contains: 'calculus', mode: 'insensitive' } },
                ],
              },
            ],
          },
        })
      );
    });

    it('filters availableOnly to rooms with free capacity', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        {
          id: 'room-full',
          slug: 'full-room',
          title: 'Full Room',
          description: null,
          thumbnail: null,
          visualPresetId: null,
          status: 'OPEN',
          listing: 'LISTED',
          cohortId: null,
          cohort: null,
          ownerId: 'user-1',
          owner: null,
          onlineCount: 20,
          capacity: 20,
          tags: [],
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'room-open',
          slug: 'open-room',
          title: 'Open Room',
          description: null,
          thumbnail: null,
          visualPresetId: null,
          status: 'OPEN',
          listing: 'LISTED',
          cohortId: null,
          cohort: null,
          ownerId: 'user-1',
          owner: null,
          onlineCount: 5,
          capacity: 20,
          tags: [],
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const result = await roomDiscoveryService.discoverRooms({ availableOnly: true }, null);

      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].id).toBe('room-open');
    });
  });

  describe('getEligibleCohortsForCreation', () => {
    it('returns combined unique cohorts where user is creator or moderator', async () => {
      vi.mocked(prisma.cohortMember.findMany).mockResolvedValueOnce([
        { cohort: { id: 'cohort-1', title: 'Algorithms' } },
      ] as any);

      vi.mocked(prisma.cohort.findMany).mockResolvedValueOnce([
        { id: 'cohort-2', title: 'Data Structures' },
        { id: 'cohort-1', title: 'Algorithms' }, // duplicate
      ] as any);

      const cohorts = await roomDiscoveryService.getEligibleCohortsForCreation('user-prof');

      expect(cohorts).toHaveLength(2);
      expect(cohorts.map((c) => c.id).sort()).toEqual(['cohort-1', 'cohort-2']);
    });
  });
});

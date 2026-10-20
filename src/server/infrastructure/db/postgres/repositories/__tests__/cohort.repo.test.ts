import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cohortRepo } from '../cohort.repo';
import { prisma } from '../../client';

vi.mock('../../client', () => ({
  prisma: {
    $transaction: vi.fn(),
    cohort: {
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    season: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    lesson: {
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    cohortSource: {
      createMany: vi.fn(),
    },
    community: {
      create: vi.fn(),
    },
    channel: {
      createMany: vi.fn(),
    },
    cohortMember: {
      create: vi.fn(),
    },
  },
}));

describe('cohortRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation: invoke the callback passing mock tx
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return Promise.all(callback);
    });
  });

  describe('updatePublishStatus', () => {
    it('executes cohort update, season find, and lesson update inside an atomic transaction', async () => {
      const mockUpdated = { id: 'cohort-1', isPublished: true, publishedAt: new Date() };
      vi.mocked(prisma.cohort.update).mockResolvedValue(mockUpdated as any);
      vi.mocked(prisma.season.findMany).mockResolvedValue([{ id: 'season-1' }, { id: 'season-2' }] as any);
      vi.mocked(prisma.lesson.updateMany).mockResolvedValue({ count: 5 });

      const result = await cohortRepo.updatePublishStatus('cohort-1', true);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.cohort.update).toHaveBeenCalledWith({
        where: { id: 'cohort-1' },
        data: { isPublished: true, publishedAt: expect.any(Date) },
      });
      expect(prisma.season.findMany).toHaveBeenCalledWith({
        where: { cohortId: 'cohort-1' },
        select: { id: true },
      });
      expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
        where: { seasonId: { in: ['season-1', 'season-2'] } },
        data: { isPublished: true },
      });
      expect(result).toBe(mockUpdated);
    });

    it('skips lesson update when cohort has no seasons', async () => {
      const mockUpdated = { id: 'cohort-2', isPublished: false, publishedAt: null };
      vi.mocked(prisma.cohort.update).mockResolvedValue(mockUpdated as any);
      vi.mocked(prisma.season.findMany).mockResolvedValue([]);

      const result = await cohortRepo.updatePublishStatus('cohort-2', false);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.cohort.update).toHaveBeenCalledWith({
        where: { id: 'cohort-2' },
        data: { isPublished: false, publishedAt: null },
      });
      expect(prisma.lesson.updateMany).not.toHaveBeenCalled();
      expect(result).toBe(mockUpdated);
    });
  });

  describe('createCohortWithCommunity', () => {
    it('executes cohort, sources, seasons, lessons, community, channels, and membership in one transaction', async () => {
      const mockCohort = { id: 'new-cohort-1', title: 'Rust Mastery' };
      vi.mocked(prisma.cohort.create).mockResolvedValue(mockCohort as any);
      vi.mocked(prisma.cohortSource.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.season.create).mockResolvedValue({ id: 's-1', cohortId: 'new-cohort-1', title: 'S1', order: 1 } as any);
      vi.mocked(prisma.lesson.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.community.create).mockResolvedValue({ id: 'comm-1', cohortId: 'new-cohort-1' } as any);
      vi.mocked(prisma.channel.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.cohortMember.create).mockResolvedValue({ cohortId: 'new-cohort-1', userId: 'creator-1' } as any);

      const params = {
        creatorId: 'creator-1',
        title: 'Rust Mastery',
        categories: ['Systems'],
        tags: ['rust'],
        requirements: ['Basic programming'],
        learningOutcomes: ['Ownership model'],
        sources: [
          {
            type: 'YOUTUBE_PLAYLIST' as const,
            title: 'Rust Playlist',
            url: 'https://youtube.com/playlist?list=123',
          },
        ],
        seasons: [
          {
            title: 'Season 1',
            order: 1,
            lessons: [
              {
                title: 'Ownership & Borrowing',
                order: 1,
                duration: 600,
              },
            ],
          },
        ],
      };

      const result = await cohortRepo.createCohortWithCommunity(params);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.cohort.create).toHaveBeenCalled();
      expect(prisma.cohortSource.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            cohortId: 'new-cohort-1',
            type: 'YOUTUBE_PLAYLIST',
          }),
        ],
      });
      expect(prisma.season.create).toHaveBeenCalledWith({
        data: {
          cohortId: 'new-cohort-1',
          title: 'Season 1',
          order: 1,
        },
      });
      expect(prisma.lesson.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            seasonId: 's-1',
            title: 'Ownership & Borrowing',
          }),
        ],
      });
      expect(prisma.community.create).toHaveBeenCalledWith({
        data: {
          cohortId: 'new-cohort-1',
          chatEnabled: true,
          eventsEnabled: true,
        },
      });
      expect(prisma.channel.createMany).toHaveBeenCalledWith({
        data: [
          { name: 'general', communityId: 'comm-1' },
          { name: 'resources', communityId: 'comm-1' },
        ],
      });
      expect(prisma.cohortMember.create).toHaveBeenCalledWith({
        data: {
          cohortId: 'new-cohort-1',
          userId: 'creator-1',
          role: 'CREATOR',
        },
      });
      expect(result).toBe(mockCohort);
    });
  });
});

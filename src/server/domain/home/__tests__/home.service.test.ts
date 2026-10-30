import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  retainedLessonCompleted,
  isLessonCompleted,
  loadHomeForUser,
  type CompletionRecord,
} from '../home.service';

const f = vi.hoisted(() => ({
  cohortMemberFindMany: vi.fn(),
  cohortFindMany: vi.fn(),
  getUserProgressMap: vi.fn(),
  userCohortConfigFind: vi.fn(),
  connectToMongoDB: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: {
      findMany: (...args: unknown[]) => f.cohortMemberFindMany(...args),
    },
    cohort: {
      findMany: (...args: unknown[]) => f.cohortFindMany(...args),
    },
  },
}));

vi.mock('@/src/server/domain/cohort/cohortAccessPolicy', () => ({
  accessibleCohortWhere: () => ({ id: 'accessible' }),
}));

vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({
  ChunkProgressService: {
    getUserProgressMap: (...args: unknown[]) => f.getUserProgressMap(...args),
  },
  ProgressStorageError: class ProgressStorageError extends Error {
    constructor(msg = 'storage error') {
      super(msg);
      this.name = 'ProgressStorageError';
    }
  },
}));

vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: () => f.connectToMongoDB(),
}));

vi.mock('@/src/server/database/mongo/models/UserCohortConfig', () => ({
  UserCohortConfig: {
    find: (...args: unknown[]) => ({
      lean: () => ({
        exec: () => f.userCohortConfigFind(...args),
      }),
    }),
  },
}));

describe('home.service - completion projection and loading (FH-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.connectToMongoDB.mockResolvedValue(undefined);
    f.userCohortConfigFind.mockResolvedValue([]);
    f.cohortMemberFindMany.mockResolvedValue([]);
    f.cohortFindMany.mockResolvedValue([]);
  });

  describe('retainedLessonCompleted pure predicate', () => {
    it('requires all chunks in a lesson to be completed for the exact lesson and cohort', () => {
      const progressMap = new Map<string, CompletionRecord>([
        ['c1', { cohortId: 'cohort-1', lessonId: 'lesson-1', status: 'COMPLETED' }],
        ['c2', { cohortId: 'cohort-1', lessonId: 'lesson-1', status: 'COMPLETED' }],
        ['c3', { cohortId: 'cohort-1', lessonId: 'lesson-1', status: 'IN_PROGRESS' }],
      ]);

      // 0/3
      expect(retainedLessonCompleted(['c3'], 'lesson-1', 'cohort-1', progressMap)).toBe(false);
      // 1/3
      expect(retainedLessonCompleted(['c1', 'c2', 'c3'], 'lesson-1', 'cohort-1', progressMap)).toBe(false);
      // 2/3
      expect(retainedLessonCompleted(['c1', 'c2', 'c3'], 'lesson-1', 'cohort-1', progressMap)).toBe(false);

      // 3/3
      progressMap.set('c3', { cohortId: 'cohort-1', lessonId: 'lesson-1', status: 'COMPLETED' });
      expect(retainedLessonCompleted(['c1', 'c2', 'c3'], 'lesson-1', 'cohort-1', progressMap)).toBe(true);
    });

    it('ignores foreign progress belonging to other lessons or cohorts', () => {
      const progressMap = new Map<string, CompletionRecord>([
        ['c1', { cohortId: 'other-cohort', lessonId: 'lesson-1', status: 'COMPLETED' }],
        ['c2', { cohortId: 'cohort-1', lessonId: 'other-lesson', status: 'COMPLETED' }],
      ]);

      expect(retainedLessonCompleted(['c1'], 'lesson-1', 'cohort-1', progressMap)).toBe(false);
      expect(retainedLessonCompleted(['c2'], 'lesson-1', 'cohort-1', progressMap)).toBe(false);
    });

    it('returns false for empty chunk array', () => {
      const progressMap = new Map<string, CompletionRecord>();
      expect(retainedLessonCompleted([], 'lesson-1', 'cohort-1', progressMap)).toBe(false);
    });
  });

  describe('isLessonCompleted', () => {
    it('evaluates legacy lesson with no chunks using SQL LessonProgress', () => {
      const progressMap = new Map<string, CompletionRecord>();

      const completedLegacy = {
        id: 'l1',
        chunks: null,
        progress: [{ status: 'COMPLETED' }],
      };
      expect(isLessonCompleted(completedLegacy, 'cohort-1', progressMap)).toBe(true);

      const incompleteLegacy = {
        id: 'l1',
        chunks: [],
        progress: [{ status: 'IN_PROGRESS' }],
      };
      expect(isLessonCompleted(incompleteLegacy, 'cohort-1', progressMap)).toBe(false);
    });

    it('gives valid retained chunks precedence over stale SQL completion', () => {
      const progressMap = new Map<string, CompletionRecord>([
        ['c1', { cohortId: 'cohort-1', lessonId: 'l1', status: 'IN_PROGRESS' }],
      ]);

      const lessonWithChunks = {
        id: 'l1',
        chunks: [{ id: 'c1' }],
        progress: [{ status: 'COMPLETED' }], // Stale SQL says completed
      };

      // Chunks are NOT completed in Mongo, so lesson must be INCOMPLETE
      expect(isLessonCompleted(lessonWithChunks, 'cohort-1', progressMap)).toBe(false);
    });

    it('rejects malformed chunk IDs and never marks them vacuously complete', () => {
      const progressMap = new Map<string, CompletionRecord>();

      expect(isLessonCompleted({ id: 'l1', chunks: 'not-an-array' }, 'cohort-1', progressMap)).toBe(false);
      expect(isLessonCompleted({ id: 'l1', chunks: [{ id: '' }] }, 'cohort-1', progressMap)).toBe(false);
      expect(isLessonCompleted({ id: 'l1', chunks: [null] }, 'cohort-1', progressMap)).toBe(false);
      expect(isLessonCompleted({ id: 'l1', chunks: [{ id: '   ' }] }, 'cohort-1', progressMap)).toBe(false);
    });
  });

  describe('loadHomeForUser server data loader', () => {
    it('correctly calculates 50% for two lessons where only one is fully completed', async () => {
      const cohortId = 'cohort-alpha';
      const mockCohort = {
        id: cohortId,
        title: 'Alpha Cohort',
        coverImage: '/img.webp',
        creator: { name: 'Teacher' },
        seasons: [
          {
            lessons: [
              {
                id: 'l1',
                chunks: [{ id: 'c1' }, { id: 'c2' }],
                progress: [],
              },
              {
                id: 'l2',
                chunks: [{ id: 'c3' }],
                progress: [],
              },
            ],
          },
        ],
      };

      f.cohortMemberFindMany.mockResolvedValue([
        { userId: 'u1', cohortId, cohort: mockCohort },
      ]);

      // Only l1 is complete (c1 and c2 completed). l2 (c3) is not completed.
      const progressMap = new Map<string, CompletionRecord>([
        ['c1', { cohortId, lessonId: 'l1', status: 'COMPLETED' }],
        ['c2', { cohortId, lessonId: 'l1', status: 'COMPLETED' }],
      ]);
      f.getUserProgressMap.mockResolvedValue(progressMap);

      const result = await loadHomeForUser('u1');

      expect(result.activeCohorts).toHaveLength(1);
      expect(result.activeCohorts[0].progressPercent).toBe(50);
      expect(result.recentlyCompleted).toHaveLength(0);
    });

    it('moves cohort to recentlyCompleted when 100% of lessons are completed', async () => {
      const cohortId = 'cohort-beta';
      const mockCohort = {
        id: cohortId,
        title: 'Beta Cohort',
        coverImage: '/img.webp',
        creator: { name: 'Teacher' },
        seasons: [
          {
            lessons: [
              {
                id: 'l1',
                chunks: [{ id: 'c1' }],
                progress: [],
              },
            ],
          },
        ],
      };

      f.cohortMemberFindMany.mockResolvedValue([
        { userId: 'u1', cohortId, cohort: mockCohort },
      ]);

      const progressMap = new Map<string, CompletionRecord>([
        ['c1', { cohortId, lessonId: 'l1', status: 'COMPLETED' }],
      ]);
      f.getUserProgressMap.mockResolvedValue(progressMap);

      const result = await loadHomeForUser('u1');

      expect(result.activeCohorts).toHaveLength(0);
      expect(result.recentlyCompleted).toHaveLength(1);
      expect(result.recentlyCompleted[0].cohortId).toBe(cohortId);
      expect(result.recentlyCompleted[0].progressPercent).toBe(100);
      expect(result.recentlyCompleted[0].completedLabel).toBe('Completed');
    });

    it('keeps hidden creator-owned cohort hidden', async () => {
      const cohortId = 'cohort-gamma';
      const mockCohort = {
        id: cohortId,
        title: 'Gamma Cohort',
        creatorId: 'u1',
        creator: { name: 'Creator' },
        seasons: [{ lessons: [] }],
      };

      f.cohortFindMany.mockResolvedValue([mockCohort]);
      f.userCohortConfigFind.mockResolvedValue([
        { cohortId, isHidden: true },
      ]);

      const result = await loadHomeForUser('u1');
      expect(result.activeCohorts).toHaveLength(0);
      expect(result.recentlyCompleted).toHaveLength(0);
      expect(result.continueLater).toHaveLength(0);
    });

    it('throws error when Mongo progress lookup fails, avoiding fraudulent 0% state', async () => {
      const cohortId = 'cohort-err';
      const mockCohort = {
        id: cohortId,
        title: 'Error Cohort',
        seasons: [
          {
            lessons: [
              {
                id: 'l1',
                chunks: [{ id: 'c1' }],
                progress: [],
              },
            ],
          },
        ],
      };

      f.cohortMemberFindMany.mockResolvedValue([
        { userId: 'u1', cohortId, cohort: mockCohort },
      ]);
      f.getUserProgressMap.mockRejectedValue(new Error('Mongo connection down'));

      await expect(loadHomeForUser('u1')).rejects.toThrow('Mongo connection down');
    });

    it('fetches fresh results without process-local cache pollution', async () => {
      const cohortId = 'cohort-fresh';
      const mockCohort = {
        id: cohortId,
        title: 'Fresh Cohort',
        seasons: [{ lessons: [{ id: 'l1', chunks: [{ id: 'c1' }] }] }],
      };

      f.cohortMemberFindMany.mockResolvedValue([
        { userId: 'u1', cohortId, cohort: mockCohort },
      ]);

      // First load: 0% complete
      f.getUserProgressMap.mockResolvedValueOnce(new Map());
      const first = await loadHomeForUser('u1');
      expect(first.activeCohorts[0].progressPercent).toBe(0);

      // Second load: 100% complete
      f.getUserProgressMap.mockResolvedValueOnce(
        new Map([['c1', { cohortId, lessonId: 'l1', status: 'COMPLETED' }]])
      );
      const second = await loadHomeForUser('u1');
      expect(second.recentlyCompleted[0].progressPercent).toBe(100);
    });
  });
});

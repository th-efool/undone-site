import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAuthorizedFeedCatalog } from '../feedCatalog';

const f = vi.hoisted(() => ({
  lessonFindMany: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    lesson: {
      findMany: (...args: unknown[]) => f.lessonFindMany(...args),
    },
  },
}));

vi.mock('@/src/server/domain/cohort/cohortAccessPolicy', () => ({
  accessibleCohortWhere: (userId: string) => ({ id: `accessible-to-${userId}` }),
}));

describe('feedCatalog - complete catalog scanning (FH-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockLesson = (id: string, lessonOrder: number, valid = true) => ({
    id,
    title: `Lesson ${id}`,
    thumbnailUrl: null,
    videoId: valid ? `vid-${id}` : null,
    lessonType: 'VIDEO',
    order: lessonOrder,
    seasonId: 'season-1',
    chunks: valid
      ? [
          {
            id: `chunk-${id}`,
            title: `Part 1`,
            durationSeconds: 60,
            startSeconds: 0,
            endSeconds: 60,
            order: 1,
          },
        ]
      : [],
    season: {
      order: 1,
      title: 'Season 1',
      cohortId: 'cohort-1',
      cohort: {
        title: 'Cohort 1',
        coverImage: null,
        creator: { name: 'Teacher' },
      },
    },
  });

  it('scans 205 authorized lessons across 100/100/5 batches without silent 100 cap', async () => {
    const batch1 = Array.from({ length: 100 }, (_, i) => createMockLesson(`l-${i + 1}`, i + 1));
    const batch2 = Array.from({ length: 100 }, (_, i) => createMockLesson(`l-${i + 101}`, i + 101));
    const batch3 = Array.from({ length: 5 }, (_, i) => createMockLesson(`l-${i + 201}`, i + 201));

    f.lessonFindMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce(batch3);

    const result = await loadAuthorizedFeedCatalog({ userId: 'u1' });

    expect(f.lessonFindMany).toHaveBeenCalledTimes(3);
    expect(result.totalLessons).toBe(205);
    expect(result.chunks).toHaveLength(205);
    expect(result.chunks[204].chunkId).toBe('chunk-l-205');

    // Check pagination cursors
    expect(f.lessonFindMany.mock.calls[0][0].cursor).toBeUndefined();
    expect(f.lessonFindMany.mock.calls[1][0].cursor).toEqual({ id: 'l-100' });
    expect(f.lessonFindMany.mock.calls[1][0].skip).toBe(1);
    expect(f.lessonFindMany.mock.calls[2][0].cursor).toEqual({ id: 'l-200' });
    expect(f.lessonFindMany.mock.calls[2][0].skip).toBe(1);
  });

  it('collects lesson 101 even if first 100 lessons have no valid chunks', async () => {
    const invalidBatch = Array.from({ length: 100 }, (_, i) => createMockLesson(`bad-${i + 1}`, i + 1, false));
    const validBatch = [createMockLesson('good-101', 101, true)];

    f.lessonFindMany
      .mockResolvedValueOnce(invalidBatch)
      .mockResolvedValueOnce(validBatch);

    const result = await loadAuthorizedFeedCatalog({ userId: 'u1' });

    expect(f.lessonFindMany).toHaveBeenCalledTimes(2);
    expect(result.totalLessons).toBe(101);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].chunkId).toBe('chunk-good-101');
    expect(result.rejected).toHaveLength(100);
  });

  it('preserves access policy on every batch query', async () => {
    f.lessonFindMany.mockResolvedValueOnce([createMockLesson('l-1', 1)]);

    await loadAuthorizedFeedCatalog({ userId: 'u-secret', cohortId: 'cohort-1' });

    const query = f.lessonFindMany.mock.calls[0][0];
    expect(query.where.season.cohort.is.AND).toEqual([
      { isPublished: true },
      { id: 'accessible-to-u-secret' },
    ]);
    expect(query.where.season.cohortId).toBe('cohort-1');
  });

  it('produces different vector-cache keys for two different lesson selections', async () => {
    const lessonA = [createMockLesson('l-a', 1)];
    const lessonB = [createMockLesson('l-b', 1)];

    f.lessonFindMany.mockResolvedValueOnce(lessonA);
    const resultA = await loadAuthorizedFeedCatalog({ userId: 'u1' });

    f.lessonFindMany.mockResolvedValueOnce(lessonB);
    const resultB = await loadAuthorizedFeedCatalog({ userId: 'u1' });

    expect(resultA.vectorCacheKey).not.toBe(resultB.vectorCacheKey);
    expect(resultA.vectorCacheKey).toMatch(/^v2:[a-f0-9]{64}$/);
    expect(resultB.vectorCacheKey).toMatch(/^v2:[a-f0-9]{64}$/);
  });

  it('fails completely if batch 2 throws an error instead of returning a partial catalog', async () => {
    const batch1 = Array.from({ length: 100 }, (_, i) => createMockLesson(`l-${i + 1}`, i + 1));
    f.lessonFindMany
      .mockResolvedValueOnce(batch1)
      .mockRejectedValueOnce(new Error('Database network timeout on batch 2'));

    await expect(loadAuthorizedFeedCatalog({ userId: 'u1' })).rejects.toThrow(
      'Database network timeout on batch 2'
    );
  });

  it('detects and aborts cursor loops if database returns repeated cursor', async () => {
    const loopBatch = Array.from({ length: 100 }, () => createMockLesson('stuck-id', 1));
    f.lessonFindMany
      .mockResolvedValueOnce(loopBatch)
      .mockResolvedValueOnce(loopBatch);

    await expect(loadAuthorizedFeedCatalog({ userId: 'u1' })).rejects.toThrow(
      'Catalog cursor loop detected'
    );
  });
});

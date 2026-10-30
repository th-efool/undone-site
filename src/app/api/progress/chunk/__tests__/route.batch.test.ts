import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const f = vi.hoisted(() => {
  class ProgressStorageError extends Error {
    constructor(message = 'Progress storage is unavailable') {
      super(message);
      this.name = 'ProgressStorageError';
    }
  }

  return {
    auth: vi.fn(),
    lessonFindFirst: vi.fn(),
    lessonFindMany: vi.fn(),
    recordProgress: vi.fn(),
    recordProgressBatch: vi.fn(),
    ProgressStorageError,
  };
});

const ProgressStorageError = f.ProgressStorageError;

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: () => f.auth(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    lesson: {
      findFirst: (...args: unknown[]) => f.lessonFindFirst(...args),
      findMany: (...args: unknown[]) => f.lessonFindMany(...args),
    },
  },
}));

vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({
  ProgressStorageError: f.ProgressStorageError,
  ChunkProgressService: {
    recordProgress: (...args: unknown[]) => f.recordProgress(...args),
    recordProgressBatch: (...args: unknown[]) => f.recordProgressBatch(...args),
  },
}));

import { POST } from '../route';

const makeRequest = (body: unknown) =>
  new Request('http://localhost:3000/api/progress/chunk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/progress/chunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.auth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  describe('unauthorized and invalid requests', () => {
    it('returns 401 when user is not authenticated', async () => {
      f.auth.mockResolvedValueOnce(null);
      const res = await POST(makeRequest({ chunkId: 'c1', lessonId: 'l1', cohortId: 'co1' }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 when neither chunkId nor batch/updates are provided', async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing required chunk identifiers');
    });
  });

  describe('backwards compatibility for single chunk update', () => {
    it('returns 400 if chunkId, lessonId, or cohortId is empty string', async () => {
      const res = await POST(makeRequest({ chunkId: '', lessonId: 'l1', cohortId: 'co1' }));
      expect(res.status).toBe(400);
    });

    it('returns 404 if chunk does not exist on lesson', async () => {
      f.lessonFindFirst.mockResolvedValue({
        chunks: [{ id: 'other-chunk' }],
      });

      const res = await POST(
        makeRequest({ chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 10, totalSeconds: 100 })
      );
      expect(res.status).toBe(404);
      expect(f.recordProgress).not.toHaveBeenCalled();
    });

    it('calls ChunkProgressService.recordProgress and returns progress object on success', async () => {
      f.lessonFindFirst.mockResolvedValue({
        chunks: [{ id: 'c1' }],
      });
      f.recordProgress.mockResolvedValue({
        chunkId: 'c1',
        status: 'IN_PROGRESS',
        watchedSeconds: 10,
      });

      const res = await POST(
        makeRequest({ chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 10, totalSeconds: 100 })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.progress.chunkId).toBe('c1');
      expect(f.recordProgress).toHaveBeenCalledWith({
        userId: 'user-1',
        chunkId: 'c1',
        lessonId: 'l1',
        cohortId: 'co1',
        watchedSeconds: 10,
        totalSeconds: 100,
        forceStatus: undefined,
      });
    });
  });

  describe('batch chunk update support', () => {
    it('returns 400 if any batch item has missing chunkId, lessonId, or cohortId', async () => {
      const res = await POST(
        makeRequest({
          batch: [
            { chunkId: 'c1', lessonId: 'l1', cohortId: 'co1' },
            { chunkId: '', lessonId: 'l1', cohortId: 'co1' },
          ],
        })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing required chunk identifiers in batch');
    });

    it('supports updates field as alias for batch', async () => {
      f.lessonFindMany.mockResolvedValue([
        {
          id: 'l1',
          chunks: [{ id: 'c1' }],
          season: { cohortId: 'co1' },
        },
      ]);
      f.recordProgressBatch.mockResolvedValue({
        count: 1,
        completedIds: [],
      });

      const res = await POST(
        makeRequest({
          updates: [
            { chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 15, totalSeconds: 100 },
          ],
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        success: true,
        count: 1,
        completed: [],
      });
      expect(f.recordProgressBatch).toHaveBeenCalledWith([
        {
          userId: 'user-1',
          chunkId: 'c1',
          lessonId: 'l1',
          cohortId: 'co1',
          watchedSeconds: 15,
          totalSeconds: 100,
          forceStatus: undefined,
        },
      ]);
    });

    it('rejects batch with 404 and performs no writes if any item is inaccessible or nonexistent', async () => {
      // Cohort database only returns l1 in co1 with c1
      // c2 is not in lesson chunks, and l2 is in an inaccessible cohort
      f.lessonFindMany.mockResolvedValue([
        {
          id: 'l1',
          chunks: [{ id: 'c1' }],
          season: { cohortId: 'co1' },
        },
      ]);

      const res = await POST(
        makeRequest({
          batch: [
            { chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 90, totalSeconds: 100 },
            { chunkId: 'c2-not-in-lesson', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 50, totalSeconds: 100 },
            { chunkId: 'c3', lessonId: 'l2-unauthorized', cohortId: 'co2', watchedSeconds: 50, totalSeconds: 100 },
          ],
        })
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('Chunk not found or inaccessible');
      expect(f.recordProgressBatch).not.toHaveBeenCalled();
    });

    it('persists all items when all batch items are accessible and valid', async () => {
      f.lessonFindMany.mockResolvedValue([
        {
          id: 'l1',
          chunks: [{ id: 'c1' }, { id: 'c2' }],
          season: { cohortId: 'co1' },
        },
      ]);
      f.recordProgressBatch.mockResolvedValue({
        count: 2,
        completedIds: ['c1'],
      });

      const res = await POST(
        makeRequest({
          batch: [
            { chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 90, totalSeconds: 100 },
            { chunkId: 'c2', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 50, totalSeconds: 100 },
          ],
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        success: true,
        count: 2,
        completed: ['c1'],
      });
      expect(f.recordProgressBatch).toHaveBeenCalledWith([
        {
          userId: 'user-1',
          chunkId: 'c1',
          lessonId: 'l1',
          cohortId: 'co1',
          watchedSeconds: 90,
          totalSeconds: 100,
          forceStatus: undefined,
        },
        {
          userId: 'user-1',
          chunkId: 'c2',
          lessonId: 'l1',
          cohortId: 'co1',
          watchedSeconds: 50,
          totalSeconds: 100,
          forceStatus: undefined,
        },
      ]);
    });

    it('returns 400 when batch exceeds 200 items', async () => {
      const largeBatch = Array.from({ length: 201 }, (_, i) => ({
        chunkId: `c${i}`,
        lessonId: 'l1',
        cohortId: 'co1',
        watchedSeconds: 10,
        totalSeconds: 100,
      }));

      const res = await POST(makeRequest({ batch: largeBatch }));
      expect(res.status).toBe(400);
      expect(f.recordProgressBatch).not.toHaveBeenCalled();
    });

    it('returns 503 with Cache-Control: no-store when ProgressStorageError is thrown', async () => {
      f.lessonFindFirst.mockResolvedValue({ chunks: [{ id: 'c1' }] });
      f.recordProgress.mockRejectedValue(new ProgressStorageError('DB down'));

      const res = await POST(
        makeRequest({ chunkId: 'c1', lessonId: 'l1', cohortId: 'co1', watchedSeconds: 10, totalSeconds: 100 })
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      const json = await res.json();
      expect(json.error).toBe('Progress could not be saved. Please retry.');
    });

    it('handles empty batch array without error', async () => {
      f.lessonFindMany.mockResolvedValue([]);
      f.recordProgressBatch.mockResolvedValue({ count: 0, completedIds: [] });

      const res = await POST(makeRequest({ batch: [] }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        success: true,
        count: 0,
        completed: [],
      });
      expect(f.recordProgressBatch).toHaveBeenCalledWith([]);
    });
  });
});

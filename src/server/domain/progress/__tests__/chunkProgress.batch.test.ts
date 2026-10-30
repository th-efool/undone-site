import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const f = vi.hoisted(() => ({
  find: vi.fn(),
  bulkWrite: vi.fn(),
  connectToMongoDB: vi.fn(),
}));

vi.mock('@/src/server/database/mongo/models/UserChunkProgress', () => ({
  UserChunkProgress: {
    find: (...args: unknown[]) => f.find(...args),
    bulkWrite: (...args: unknown[]) => f.bulkWrite(...args),
  },
}));

vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: () => f.connectToMongoDB(),
}));

import {
  ChunkProgressService,
  ProgressStorageError,
  type UpdateChunkProgressInput,
} from '../chunkProgress.service';

describe('ChunkProgressService - recordProgressBatch', () => {
  const origEnv = process.env.MONGODB_URI;

  type BulkOp = {
    updateOne: {
      filter: { chunkId: string };
      update: { $set: { watchedSeconds: number; status?: string; completedAt?: Date } };
    };
  };

  const mockFindReturn = (results: Record<string, unknown>[] = []) => {
    f.find.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(results),
      }),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    f.connectToMongoDB.mockResolvedValue(undefined);
    f.bulkWrite.mockResolvedValue({ ok: 1, nModified: 1 });
    mockFindReturn([]);
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.MONGODB_URI = origEnv;
    } else {
      delete process.env.MONGODB_URI;
    }
  });

  describe('single vs multiple batch operations', () => {
    it('processes a single item batch operation successfully', async () => {
      const inputs: UpdateChunkProgressInput[] = [
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 15,
          totalSeconds: 100,
        },
      ];

      const result = await ChunkProgressService.recordProgressBatch(inputs);

      expect(result).toEqual({ count: 1, completedIds: [] });
      expect(f.connectToMongoDB).toHaveBeenCalledTimes(1);
      expect(f.find).toHaveBeenCalledWith({
        userId: 'user-1',
        chunkId: { $in: ['chunk-1'] },
      });
      expect(f.bulkWrite).toHaveBeenCalledTimes(1);

      const [operations, options] = f.bulkWrite.mock.calls[0];
      expect(options).toEqual({ ordered: false });
      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        updateOne: {
          filter: { userId: 'user-1', chunkId: 'chunk-1' },
          update: {
            $set: {
              userId: 'user-1',
              chunkId: 'chunk-1',
              lessonId: 'lesson-1',
              cohortId: 'cohort-1',
              status: 'IN_PROGRESS',
              watchedSeconds: 15,
              totalSeconds: 100,
              lastWatchedAt: expect.any(Date),
            },
          },
          upsert: true,
        },
      });
    });

    it('processes multiple items in a single bulkWrite query', async () => {
      const inputs: UpdateChunkProgressInput[] = [
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 10,
          totalSeconds: 100,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-2',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 20,
          totalSeconds: 120,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-3',
          lessonId: 'lesson-2',
          cohortId: 'cohort-1',
          watchedSeconds: 5,
          totalSeconds: 60,
        },
      ];

      const result = await ChunkProgressService.recordProgressBatch(inputs);

      expect(result).toEqual({ count: 3, completedIds: [] });
      expect(f.find).toHaveBeenCalledWith({
        userId: 'user-1',
        chunkId: { $in: ['chunk-1', 'chunk-2', 'chunk-3'] },
      });
      expect(f.bulkWrite).toHaveBeenCalledTimes(1);

      const [operations, options] = f.bulkWrite.mock.calls[0];
      expect(options).toEqual({ ordered: false });
      expect(operations).toHaveLength(3);
      expect(operations[0].updateOne.filter.chunkId).toBe('chunk-1');
      expect(operations[1].updateOne.filter.chunkId).toBe('chunk-2');
      expect(operations[2].updateOne.filter.chunkId).toBe('chunk-3');
    });
  });

  describe('deduplication within same batch', () => {
    it('deduplicates duplicate chunk inputs by keeping maximum watchedSeconds', async () => {
      const inputs: UpdateChunkProgressInput[] = [
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 20,
          totalSeconds: 100,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 70,
          totalSeconds: 100,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 40,
          totalSeconds: 100,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-2',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 10,
          totalSeconds: 60,
        },
      ];

      const result = await ChunkProgressService.recordProgressBatch(inputs);

      expect(result).toEqual({ count: 2, completedIds: [] });
      expect(f.find).toHaveBeenCalledWith({
        userId: 'user-1',
        chunkId: { $in: ['chunk-1', 'chunk-2'] },
      });

      const [operations] = f.bulkWrite.mock.calls[0];
      expect(operations).toHaveLength(2);

      const op1 = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-1');
      expect(op1.updateOne.update.$set.watchedSeconds).toBe(70);

      const op2 = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-2');
      expect(op2.updateOne.update.$set.watchedSeconds).toBe(10);
    });

    it('merges totalSeconds and forceStatus on deduplication', async () => {
      const inputs: UpdateChunkProgressInput[] = [
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 5,
          totalSeconds: 0,
        },
        {
          userId: 'user-1',
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 15,
          totalSeconds: 120,
          forceStatus: 'SKIPPED',
        },
      ];

      const result = await ChunkProgressService.recordProgressBatch(inputs);

      expect(result.count).toBe(1);
      const [operations] = f.bulkWrite.mock.calls[0];
      expect(operations[0].updateOne.update.$set.watchedSeconds).toBe(15);
      expect(operations[0].updateOne.update.$set.totalSeconds).toBe(120);
      expect(operations[0].updateOne.update.$set.status).toBe('SKIPPED');
    });
  });

  describe('auto-completion detection in batch', () => {
    it('detects newly completed chunks and records their chunkIds in completedIds', async () => {
      mockFindReturn([
        {
          chunkId: 'chunk-already-completed',
          status: 'COMPLETED',
          watchedSeconds: 100,
          totalSeconds: 100,
        },
        {
          chunkId: 'chunk-transitioning',
          status: 'IN_PROGRESS',
          watchedSeconds: 30,
          totalSeconds: 100,
        },
      ]);

      const inputs: UpdateChunkProgressInput[] = [
        // Newly completed chunk (watched 90/100s = 90% >= 85%)
        {
          userId: 'user-1',
          chunkId: 'chunk-newly-completed',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 90,
          totalSeconds: 100,
        },
        // Already completed chunk (should NOT be in completedIds)
        {
          userId: 'user-1',
          chunkId: 'chunk-already-completed',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 100,
          totalSeconds: 100,
        },
        // Transitioning from IN_PROGRESS to COMPLETED (watched 86/100s)
        {
          userId: 'user-1',
          chunkId: 'chunk-transitioning',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 86,
          totalSeconds: 100,
        },
        // Still in progress (watched 20/100s)
        {
          userId: 'user-1',
          chunkId: 'chunk-in-progress',
          lessonId: 'lesson-1',
          cohortId: 'cohort-1',
          watchedSeconds: 20,
          totalSeconds: 100,
        },
      ];

      const result = await ChunkProgressService.recordProgressBatch(inputs);

      expect(result.count).toBe(4);
      expect(result.completedIds).toEqual(['chunk-newly-completed', 'chunk-transitioning']);

      const [operations] = f.bulkWrite.mock.calls[0];

      // Newly completed has completedAt
      const newOp = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-newly-completed');
      expect(newOp.updateOne.update.$set.status).toBe('COMPLETED');
      expect(newOp.updateOne.update.$set.completedAt).toBeInstanceOf(Date);

      // Already completed does NOT have completedAt overwritten
      const alreadyOp = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-already-completed');
      expect(alreadyOp.updateOne.update.$set.status).toBe('COMPLETED');
      expect(alreadyOp.updateOne.update.$set.completedAt).toBeUndefined();

      // Transitioning has completedAt
      const transOp = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-transitioning');
      expect(transOp.updateOne.update.$set.status).toBe('COMPLETED');
      expect(transOp.updateOne.update.$set.completedAt).toBeInstanceOf(Date);

      // In progress does NOT have completedAt
      const inProgOp = operations.find((o: BulkOp) => o.updateOne.filter.chunkId === 'chunk-in-progress');
      expect(inProgOp.updateOne.update.$set.status).toBe('IN_PROGRESS');
      expect(inProgOp.updateOne.update.$set.completedAt).toBeUndefined();
    });
  });

  describe('edge cases and resilience', () => {
    it('returns { count: 0, completedIds: [] } when inputs array is empty', async () => {
      const result = await ChunkProgressService.recordProgressBatch([]);
      expect(result).toEqual({ count: 0, completedIds: [] });
      expect(f.connectToMongoDB).not.toHaveBeenCalled();
      expect(f.find).not.toHaveBeenCalled();
      expect(f.bulkWrite).not.toHaveBeenCalled();
    });

    it('throws ProgressStorageError when MONGODB_URI is not set for non-empty batch', async () => {
      delete process.env.MONGODB_URI;

      await expect(
        ChunkProgressService.recordProgressBatch([
          {
            userId: 'user-1',
            chunkId: 'chunk-1',
            lessonId: 'lesson-1',
            cohortId: 'cohort-1',
            watchedSeconds: 10,
            totalSeconds: 100,
          },
        ])
      ).rejects.toThrow(ProgressStorageError);

      expect(f.connectToMongoDB).not.toHaveBeenCalled();
      expect(f.bulkWrite).not.toHaveBeenCalled();
    });

    it('catches MongoDB errors and throws ProgressStorageError', async () => {
      f.bulkWrite.mockRejectedValueOnce(new Error('Mongo network timeout'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        ChunkProgressService.recordProgressBatch([
          {
            userId: 'user-1',
            chunkId: 'chunk-1',
            lessonId: 'lesson-1',
            cohortId: 'cohort-1',
            watchedSeconds: 10,
            totalSeconds: 100,
          },
        ])
      ).rejects.toThrow(ProgressStorageError);

      expect(warnSpy).toHaveBeenCalledWith(
        '[ChunkProgressService] Failed to record progress batch:',
        'Mongo network timeout'
      );
      warnSpy.mockRestore();
    });
  });
});

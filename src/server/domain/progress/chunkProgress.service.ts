import { UserChunkProgress } from '@/src/server/database/mongo/models/UserChunkProgress';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';

export type ChunkStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface UpdateChunkProgressInput {
  userId: string;
  chunkId: string;
  lessonId: string;
  cohortId: string;
  watchedSeconds: number;
  totalSeconds: number;
  forceStatus?: ChunkStatus;
}

export class ChunkProgressService {
  static isEligibleForAutoCompletion(
    currentTime: number,
    totalSeconds: number,
    thresholdSeconds = 15
  ): boolean {
    if (totalSeconds <= 0) return false;
    const remainingSeconds = totalSeconds - currentTime;
    const percentWatched = currentTime / totalSeconds;
    
    const effectiveThreshold = Math.min(thresholdSeconds, totalSeconds * 0.15);
    // Auto-complete if they watched 85%, OR if they are within the threshold and watched at least 50%
    return percentWatched >= 0.85 || (remainingSeconds <= effectiveThreshold && percentWatched >= 0.50);
  }

  static computeStatus(
    currentStatus: ChunkStatus | null,
    currentTime: number,
    totalSeconds: number,
    forceStatus?: ChunkStatus
  ): ChunkStatus {
    if (forceStatus) return forceStatus;
    if (currentStatus === 'COMPLETED') return 'COMPLETED';

    if (this.isEligibleForAutoCompletion(currentTime, totalSeconds)) {
      return 'COMPLETED';
    }
    if (currentTime >= 3) {
      return 'IN_PROGRESS';
    }
    return currentStatus || 'NOT_STARTED';
  }

  static async recordProgress(input: UpdateChunkProgressInput) {
    const {
      userId,
      chunkId,
      lessonId,
      cohortId,
      watchedSeconds,
      totalSeconds,
      forceStatus,
    } = input;

    if (!process.env.MONGODB_URI) {
      return null;
    }

    try {
      await connectToMongoDB();

      const existing = await UserChunkProgress.findOne({ userId, chunkId }).lean().exec();

      const nextStatus = this.computeStatus(
        (existing?.status as ChunkStatus) || null,
        watchedSeconds,
        totalSeconds,
        forceStatus
      );
      
      const isNewlyCompleted =
        nextStatus === 'COMPLETED' &&
        existing?.status !== 'COMPLETED';

      const updatedProgress = await UserChunkProgress.findOneAndUpdate(
        { userId, chunkId },
        {
          $set: {
            userId,
            chunkId,
            lessonId,
            cohortId,
            status: nextStatus,
            watchedSeconds: Math.max(existing?.watchedSeconds || 0, watchedSeconds),
            totalSeconds: totalSeconds > 0 ? totalSeconds : existing?.totalSeconds || 0,
            lastWatchedAt: new Date(),
            ...(isNewlyCompleted ? { completedAt: new Date() } : {})
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      // TODO: LessonProgress roll-up could be handled in Postgres if Lesson metadata is there,
      // or moved entirely to Mongo. For now, since user progress is purely in Mongo,
      // we omit the LessonProgress sync for brevity, focusing on Vector Search metadata filtering.

      return updatedProgress;
    } catch (err) {
      console.warn('[ChunkProgressService] Failed to record progress:', (err as Error).message);
      return null;
    }
  }

  static async recordProgressBatch(
    inputs: UpdateChunkProgressInput[]
  ): Promise<{ count: number; completedIds: string[] }> {
    if (!inputs.length || !process.env.MONGODB_URI) {
      return { count: 0, completedIds: [] };
    }

    try {
      // Group/deduplicate inputs by `${input.userId}:${input.chunkId}` to take latest/maximum progress
      const deduplicated = new Map<string, UpdateChunkProgressInput>();
      for (const input of inputs) {
        const key = `${input.userId}:${input.chunkId}`;
        const existingInput = deduplicated.get(key);
        if (!existingInput) {
          deduplicated.set(key, { ...input });
        } else {
          deduplicated.set(key, {
            ...existingInput,
            ...input,
            watchedSeconds: Math.max(existingInput.watchedSeconds || 0, input.watchedSeconds || 0),
            totalSeconds: input.totalSeconds > 0 ? input.totalSeconds : (existingInput.totalSeconds || 0),
            forceStatus: input.forceStatus || existingInput.forceStatus,
          });
        }
      }

      const uniqueInputs = Array.from(deduplicated.values());
      if (!uniqueInputs.length) {
        return { count: 0, completedIds: [] };
      }

      await connectToMongoDB();

      const chunkIds = uniqueInputs.map((i) => i.chunkId);
      const existingList = await UserChunkProgress.find({
        userId: inputs[0].userId,
        chunkId: { $in: chunkIds },
      })
        .lean()
        .exec();

      const existingMap = new Map((existingList as any[]).map((p) => [p.chunkId, p]));

      const operations: any[] = [];
      const completedIds: string[] = [];

      for (const input of uniqueInputs) {
        const existing = existingMap.get(input.chunkId);
        const effectiveWatched = Math.max(existing?.watchedSeconds || 0, input.watchedSeconds);
        const effectiveTotal = input.totalSeconds > 0 ? input.totalSeconds : (existing?.totalSeconds || 0);

        const nextStatus = this.computeStatus(
          (existing?.status as ChunkStatus) || null,
          effectiveWatched,
          effectiveTotal,
          input.forceStatus
        );

        const isNewlyCompleted =
          nextStatus === 'COMPLETED' &&
          existing?.status !== 'COMPLETED';

        if (isNewlyCompleted) {
          completedIds.push(input.chunkId);
        }

        operations.push({
          updateOne: {
            filter: { userId: input.userId, chunkId: input.chunkId },
            update: {
              $set: {
                userId: input.userId,
                chunkId: input.chunkId,
                lessonId: input.lessonId,
                cohortId: input.cohortId,
                status: nextStatus,
                watchedSeconds: Math.max(existing?.watchedSeconds || 0, input.watchedSeconds),
                totalSeconds: input.totalSeconds > 0 ? input.totalSeconds : existing?.totalSeconds || 0,
                lastWatchedAt: new Date(),
                ...(isNewlyCompleted ? { completedAt: new Date() } : {}),
              },
            },
            upsert: true,
          },
        });
      }

      if (operations.length > 0) {
        await UserChunkProgress.bulkWrite(operations, { ordered: false });
      }

      return { count: operations.length, completedIds };
    } catch (err) {
      console.warn('[ChunkProgressService] Failed to record progress batch:', (err as Error).message);
      return { count: 0, completedIds: [] };
    }
  }

  static async getUserProgressMap(userId: string, chunkIds?: string[]) {
    if (!process.env.MONGODB_URI) {
      return new Map();
    }
    try {
      await connectToMongoDB();
      const list = await UserChunkProgress.find({ userId, ...(chunkIds ? { chunkId: { $in: chunkIds } } : {}) }).lean().exec();
      return new Map(list.map((p) => [p.chunkId, p]));
    } catch (err) {
      console.warn('[ChunkProgressService] Failed to get user progress map:', (err as Error).message);
      return new Map();
    }
  }
}

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

    await connectToMongoDB();

    const existing = await UserChunkProgress.findOne({ userId, chunkId });

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
      { upsert: true, new: true }
    );

    // TODO: LessonProgress roll-up could be handled in Postgres if Lesson metadata is there,
    // or moved entirely to Mongo. For now, since user progress is purely in Mongo,
    // we omit the LessonProgress sync for brevity, focusing on Vector Search metadata filtering.

    return updatedProgress;
  }

  static async getUserProgressMap(userId: string) {
    await connectToMongoDB();
    const list = await UserChunkProgress.find({ userId });
    return new Map(list.map((p) => [p.chunkId, p]));
  }
}

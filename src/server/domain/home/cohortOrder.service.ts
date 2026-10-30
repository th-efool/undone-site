import mongoose from 'mongoose';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import {
  UserCohortConfig,
  type ScheduleDay,
  type CohortFrequency,
  type CohortOrderStyle,
} from '@/src/server/database/mongo/models/UserCohortConfig';
import { invalidateHomeServerCache } from '@/src/server/infrastructure/cache/homeServerCache';

export function normalizeCohortId(cohortId?: string | null, userId?: string | null): string {
  if (!cohortId) return '';
  if (userId && cohortId.startsWith(`${userId}_`)) {
    return cohortId.slice(userId.length + 1);
  }
  return cohortId;
}

export async function getUserAuthorizedCohortIds(userId: string): Promise<Set<string>> {
  const [members, created] = await Promise.all([
    prisma.cohortMember.findMany({
      where: { userId, cohort: accessibleCohortWhere(userId) },
      select: { cohortId: true },
    }),
    prisma.cohort.findMany({
      where: { creatorId: userId },
      select: { id: true },
    }),
  ]);

  const set = new Set<string>();
  for (const m of members) set.add(m.cohortId);
  for (const c of created) set.add(c.id);
  return set;
}

export type CohortStateChange = {
  operation: 'pause' | 'resume';
  cohortId: string;
  pausedUntil?: string | null;
  pausedReason?: string;
};

export interface CohortConfigSnapshot {
  cohortId: string;
  rank?: number;
  isPaused?: boolean;
  pausedUntil?: Date | string | null;
  pausedReason?: string;
  isHidden?: boolean;
}

export interface OrderingResult {
  active: Array<{ cohortId: string; rank: number }>;
  paused: Array<{
    cohortId: string;
    rank: number;
    pausedUntil: Date | null;
    pausedReason: string;
  }>;
  updates: Array<{
    cohortId: string;
    rank: number;
    isPaused: boolean;
    pausedUntil: Date | null;
    pausedReason: string;
  }>;
}

export function computeStateChangeOrdering(params: {
  authorizedCohortIds: ReadonlySet<string>;
  currentConfigs: CohortConfigSnapshot[];
  operation: 'pause' | 'resume';
  targetCohortId: string;
  pausedUntil?: Date | null;
  pausedReason?: string;
  now?: Date;
  userId?: string | null;
}): OrderingResult {
  const {
    authorizedCohortIds,
    currentConfigs,
    operation,
    targetCohortId,
    pausedUntil = null,
    pausedReason = '',
    now = new Date(),
    userId,
  } = params;

  const cleanTarget = normalizeCohortId(targetCohortId, userId);
  const configMap = new Map<string, CohortConfigSnapshot>();

  for (const cfg of currentConfigs) {
    const cleanId = normalizeCohortId(cfg.cohortId, userId);
    if (!configMap.has(cleanId)) {
      configMap.set(cleanId, { ...cfg, cohortId: cleanId });
    }
  }

  // Determine current active and paused pools for authorized visible cohorts
  const activeItems: Array<{ cohortId: string; rank: number }> = [];
  const pausedItems: Array<{
    cohortId: string;
    rank: number;
    pausedUntil: Date | null;
    pausedReason: string;
  }> = [];

  for (const cid of authorizedCohortIds) {
    const cfg = configMap.get(cid);
    if (cfg?.isHidden) continue;

    const rank = typeof cfg?.rank === 'number' && Number.isFinite(cfg.rank) ? cfg.rank : 999999;
    const isPaused = Boolean(cfg?.isPaused);
    const parsedUntil = cfg?.pausedUntil ? new Date(cfg.pausedUntil) : null;
    const isStillPaused = isPaused && (!parsedUntil || parsedUntil > now);

    if (isStillPaused) {
      pausedItems.push({
        cohortId: cid,
        rank,
        pausedUntil: parsedUntil,
        pausedReason: cfg?.pausedReason || '',
      });
    } else {
      activeItems.push({ cohortId: cid, rank });
    }
  }

  // Sort deterministically: rank ascending, then cohortId ascending
  activeItems.sort((a, b) => a.rank - b.rank || a.cohortId.localeCompare(b.cohortId));
  pausedItems.sort((a, b) => a.rank - b.rank || a.cohortId.localeCompare(b.cohortId));

  if (operation === 'pause') {
    // Remove target from active
    const activeIdx = activeItems.findIndex((c) => c.cohortId === cleanTarget);
    if (activeIdx !== -1) {
      activeItems.splice(activeIdx, 1);
    }
    // Remove if already in paused to prevent duplicates
    const pausedIdx = pausedItems.findIndex((c) => c.cohortId === cleanTarget);
    if (pausedIdx !== -1) {
      pausedItems.splice(pausedIdx, 1);
    }
    // Append to end of paused list
    pausedItems.push({
      cohortId: cleanTarget,
      rank: 999999,
      pausedUntil: pausedUntil,
      pausedReason: pausedReason || 'Paused by user',
    });
  } else if (operation === 'resume') {
    // Remove target from paused
    const pausedIdx = pausedItems.findIndex((c) => c.cohortId === cleanTarget);
    if (pausedIdx !== -1) {
      pausedItems.splice(pausedIdx, 1);
    }
    // Remove if already in active to prevent duplicates
    const activeIdx = activeItems.findIndex((c) => c.cohortId === cleanTarget);
    if (activeIdx !== -1) {
      activeItems.splice(activeIdx, 1);
    }
    // Append to end of active list
    activeItems.push({
      cohortId: cleanTarget,
      rank: 999999,
    });
  }

  // Assign normalized 1-based ranks: active 1..N, paused N+1..N+M
  const updates: OrderingResult['updates'] = [];
  const normalizedActive: OrderingResult['active'] = [];
  const normalizedPaused: OrderingResult['paused'] = [];

  let currentRank = 1;
  for (const item of activeItems) {
    const updated = {
      cohortId: item.cohortId,
      rank: currentRank++,
      isPaused: false,
      pausedUntil: null,
      pausedReason: '',
    };
    normalizedActive.push({ cohortId: item.cohortId, rank: updated.rank });
    updates.push(updated);
  }

  for (const item of pausedItems) {
    const updated = {
      cohortId: item.cohortId,
      rank: currentRank++,
      isPaused: true,
      pausedUntil: item.pausedUntil,
      pausedReason: item.pausedReason,
    };
    normalizedPaused.push({
      cohortId: item.cohortId,
      rank: updated.rank,
      pausedUntil: item.pausedUntil,
      pausedReason: item.pausedReason,
    });
    updates.push(updated);
  }

  return {
    active: normalizedActive,
    paused: normalizedPaused,
    updates,
  };
}

export async function executeCohortStateChange(
  userId: string,
  change: CohortStateChange
): Promise<OrderingResult> {
  const cleanTarget = normalizeCohortId(change.cohortId, userId);
  if (!cleanTarget) {
    throw new Error('Missing or invalid cohortId');
  }

  let parsedDate: Date | null = null;
  if (change.operation === 'pause') {
    if (change.pausedUntil !== undefined && change.pausedUntil !== null && change.pausedUntil !== '') {
      parsedDate = new Date(change.pausedUntil);
      if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
        throw new Error('pausedUntil must be a valid future date or null');
      }
    }
  }

  // 1. Authenticate & load authorized cohorts
  const authorizedIds = await getUserAuthorizedCohortIds(userId);
  if (!authorizedIds.has(cleanTarget)) {
    throw new Error('Cohort not found or unauthorized');
  }

  await connectToMongoDB();

  // 2. Execute within Mongo session transaction
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
  } catch {
    throw new Error('Database transaction initialization failed');
  }

  let result!: OrderingResult;
  try {
    await session.withTransaction(async () => {
      // Query authoritative configs within transaction
      const currentConfigs = await UserCohortConfig.find({ userId })
        .session(session)
        .lean()
        .exec();

      result = computeStateChangeOrdering({
        authorizedCohortIds: authorizedIds,
        currentConfigs: currentConfigs as CohortConfigSnapshot[],
        operation: change.operation,
        targetCohortId: cleanTarget,
        pausedUntil: parsedDate,
        pausedReason: change.pausedReason,
        userId,
      });

      const bulkOps = result.updates.map((u) => ({
        updateOne: {
          filter: { userId, cohortId: u.cohortId },
          update: {
            $set: {
              rank: u.rank,
              isPaused: u.isPaused,
              pausedUntil: u.pausedUntil,
              pausedReason: u.pausedReason,
            },
            $setOnInsert: {
              dailyGoalMinutes: 20,
              scheduleDays: ['Mon', 'Wed', 'Fri'] as ScheduleDay[],
              scheduleLabel: 'Mon, Wed, Fri',
              frequency: 'Often' as CohortFrequency,
              orderStyle: 'Sequential' as CohortOrderStyle,
              isHidden: false,
            },
          },
          upsert: true,
        },
      }));

      if (bulkOps.length > 0) {
        await UserCohortConfig.bulkWrite(bulkOps, { session, ordered: true });
      }
    });
  } catch (err: unknown) {
    // Check if error indicates transactions are not supported on this deployment
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('replica set') || message.includes('mongos') || message.includes('Transaction numbers')) {
      throw new Error('Database deployment does not support replica set transactions');
    }
    throw err;
  } finally {
    await session.endSession();
  }

  // Invalidate cache after successful commit
  invalidateHomeServerCache(userId);

  return result;
}

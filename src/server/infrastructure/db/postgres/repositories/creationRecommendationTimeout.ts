import type { Prisma } from '@/generated/prisma/client';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { applyEvent } from '@/src/shared/cohort-creation/flow';
import type { writeDraftEvent } from './creationEvent.repo';

export const RECOMMENDATION_QUEUE_TIMEOUT_MS = 60_000;
export const CREATION_QUEUE_TIMEOUT_MS = 5 * 60_000;
export function creationQueueExpired(job: { kind: string; status: string; createdAt: Date; deadlineAt: Date | null }, now: Date) {
  if (job.kind === 'recommendations') return recommendationExpired(job, now);
  // Claimed/retrying jobs keep their original execution deadline and checkpoint recovery.
  return job.status === 'queued' && job.deadlineAt === null && now.getTime() - job.createdAt.getTime() >= CREATION_QUEUE_TIMEOUT_MS;
}
export function recommendationExpired(job: { status: string; createdAt: Date; deadlineAt: Date | null }, now: Date) {
  if (!['queued', 'running'].includes(job.status)) return false;
  return job.deadlineAt ? job.deadlineAt <= now : job.status === 'queued' && now.getTime() - job.createdAt.getTime() >= RECOMMENDATION_QUEUE_TIMEOUT_MS;
}

/** Recover unclaimed work even when no worker is alive. Preserve claimed checkpoint recovery. */
export async function expireStalledCreationJob(tx: Prisma.TransactionClient, ownerId: string, draftId: string,
  persist: typeof writeDraftEvent, now = new Date()) {
  const preview = await tx.creationDraft.findFirst({ where: { id: draftId, ownerId, expiredAt: null } });
  if (!preview) return;
  const state = creationSnapshotSchema.parse(preview.snapshot);
  if (state.status !== 'running') return;
  // All worker commits lock the draft first. Recheck after acquiring that same lock.
  const rows = await tx.$queryRaw<{ snapshot: unknown }[]>`SELECT "snapshot" FROM "creation_drafts"
    WHERE "id"=${draftId} AND "ownerId"=${ownerId} AND "expiredAt" IS NULL FOR UPDATE`;
  if (!rows[0]) return;
  const current = creationSnapshotSchema.parse(rows[0].snapshot);
  if (current.status !== 'running' || !current.activeRequestId) return;
  const job = await tx.creationJob.findFirst({ where: { draftId, ownerId,
    requestId: current.activeRequestId, inputRevision: current.inputRevision, status: { in: ['queued', 'running'] } } });
  if (!job || !creationQueueExpired(job, now)) return;
  const failed = await tx.creationJob.update({ where: { id: job.id }, data: {
    status: 'failed', leaseToken: null, leaseUntil: null, updatedAt: now,
  } });
  const next = applyEvent(current, { type: 'operation_failed', requestId: job.requestId,
    error: job.kind === 'recommendations'
      ? { code: 'AI_TIMEOUT', message: 'Cohort search did not finish in time. Your query is saved; retry the search.', retryable: true }
      : { code: 'DATA_UNAVAILABLE', message: 'No worker started this request within five minutes. Your draft and retained material are saved. Retry when processing is available.', retryable: true } });
  await persist(tx, ownerId, next, 'job_failed', failed);
}

/** Compatibility for recommendation-specific smoke tooling. */
export const expireStalledRecommendation = expireStalledCreationJob;

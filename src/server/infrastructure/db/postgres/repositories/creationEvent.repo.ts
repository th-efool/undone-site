import 'server-only';
import type { Prisma, CreationJob } from '@/generated/prisma/client';
import { prisma } from '../client';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { creationEventEnvelopeSchema, creationJobSummarySchema, type CreationEventEnvelope } from '@/src/shared/cohort-creation/durable';
import type { CreationEventRepository } from '@/src/server/domain/cohort-creation/durable-job';

export const jobSummary = (job: CreationJob) => creationJobSummarySchema.parse({
  id: job.id, kind: job.kind, status: job.status, inputRevision: job.inputRevision,
  requestId: job.requestId, attempt: job.attempt,
  createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(),
});

/** Caller holds the draft row lock. Snapshot and event use the same commit. */
export async function writeDraftEvent(tx: Prisma.TransactionClient, ownerId: string, snapshot: CreationSnapshot,
  kind: CreationEventEnvelope['kind'], job: CreationJob | null = null) {
  const valid = creationSnapshotSchema.parse(snapshot);
  if (Buffer.byteLength(JSON.stringify(valid)) > 256_000) throw new Error('Snapshot exceeds event budget');
  const draft = await tx.creationDraft.update({ where: { id: valid.draftId, ownerId, expiredAt: null },
    data: { snapshot: valid, revision: valid.revision, eventSequence: { increment: 1 } } });
  const envelope = creationEventEnvelopeSchema.parse({ schemaVersion: 1, draftId: valid.draftId,
    jobId: job?.id ?? null, inputRevision: valid.inputRevision, sequence: draft.eventSequence,
    kind, snapshot: valid, job: job ? jobSummary(job) : null, createdAt: new Date().toISOString() });
  await tx.creationEvent.create({ data: { draftId: valid.draftId, sequence: draft.eventSequence, envelope } });
  return envelope;
}

export const creationEventRepo: CreationEventRepository = {
  async read(ownerId, draftId, after) {
    // Repeatable read prevents a cursor newer than the snapshot/event batch.
    return prisma.$transaction(async tx => {
      const draft = await tx.creationDraft.findFirst({ where: { id: draftId, ownerId, expiredAt: null } });
      if (!draft) return null;
      const snapshot = creationSnapshotSchema.parse(draft.snapshot);
      const rows = await tx.creationEvent.findMany({ where: { draftId, sequence: { gt: after },
        createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { sequence: 'asc' }, take: 100 });
      const jobs = await tx.creationJob.findMany({ where: { draftId, status: { in: ['queued', 'running'] } }, take: 10 });
      const reset = after > draft.eventSequence || (after < draft.eventSequence && rows[0]?.sequence !== after + 1);
      return { snapshot, cursor: draft.eventSequence, reset,
        events: reset ? [] : rows.map(row => creationEventEnvelopeSchema.parse(row.envelope)), jobs: jobs.map(jobSummary) };
    }, { isolationLevel: 'RepeatableRead' });
  },
};

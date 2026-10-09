import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, CreationJob } from '@/generated/prisma/client';
import { prisma as defaultPrisma } from '../client';
import { creationSnapshotSchema, recommendationRequestSchema, recommendationResultSchema } from '@/src/shared/cohort-creation/contracts';
import { applyEvent } from '@/src/shared/cohort-creation/flow';
import { LeaseLost, type ClaimedCreationJob, type CreationJobRepository } from '@/src/server/domain/cohort-creation/durable-job';
import { hourlyBudget, reserveBudget } from './creationBudget.repo';
import { creationFailure } from '@/src/server/domain/cohort-creation/errors';
import { jobSummary, writeDraftEvent } from './creationEvent.repo';

async function lockedDraft(tx: Prisma.TransactionClient, owner: string, id: string) {
  const rows = await tx.$queryRaw<{ snapshot: unknown }[]>`
    SELECT "snapshot" FROM "creation_drafts" WHERE "id"=${id} AND "ownerId"=${owner} AND "expiredAt" IS NULL FOR UPDATE`;
  return rows[0] ? creationSnapshotSchema.parse(rows[0].snapshot) : null;
}
async function fenced(tx: Prisma.TransactionClient, job: ClaimedCreationJob) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "creation_jobs"
    WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "status"='running'
    AND "cancelRequestedAt" IS NULL AND "leaseUntil">CURRENT_TIMESTAMP
    AND "inputFingerprint"=${job.inputFingerprint} FOR UPDATE`;
  if (!rows.length) throw new LeaseLost();
}
function claimed(row: CreationJob): ClaimedCreationJob {
  return { ...jobSummary(row), draftId: row.draftId, ownerId: row.ownerId,
    inputFingerprint: row.inputFingerprint, input: recommendationRequestSchema.parse(row.input),
    leaseToken: row.leaseToken!, deadlineAt: row.deadlineAt!,
    checkpoint: row.checkpoint ? recommendationResultSchema.parse(row.checkpoint) : null };
}
export function createCreationJobRepository(prisma = defaultPrisma): CreationJobRepository {
 return {
  async enqueue(owner, previous, next) {
    return prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, owner, previous.draftId);
      if (!current) return null;
      const input = recommendationRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, query: next.query });
      const fingerprint = createHash('sha256').update(JSON.stringify({ kind: 'recommendations', schema: 1, input })).digest('hex');
      const existing = await tx.creationJob.findUnique({ where: { draftId_kind_inputFingerprint: {
        draftId: next.draftId, kind: 'recommendations', inputFingerprint: fingerprint } } });
      // A lost HTTP response can replay exactly the same operation safely.
      if (existing && current.inputRevision === input.inputRevision) return current;
      if (current.revision !== previous.revision) return null;
      const budget = hourlyBudget(`jobs:${owner}`);
      await reserveBudget(tx, budget.key, 20, budget.expiresAt);
      await tx.creationJob.updateMany({ where: { draftId: next.draftId, status: { in: ['queued', 'running'] } },
        data: { status: 'canceled', cancelRequestedAt: new Date(), leaseToken: null, leaseUntil: null } });
      const job = await tx.creationJob.create({ data: { draftId: next.draftId, ownerId: owner,
        kind: 'recommendations', requestId: input.requestId, inputRevision: input.inputRevision,
        inputFingerprint: fingerprint, input } });
      await writeDraftEvent(tx, owner, next, 'job_queued', job);
      return next;
    });
  },
  async cancel(owner, previous, next) {
    return prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, owner, previous.draftId);
      if (!current || current.revision !== previous.revision) return false;
      const job = await tx.creationJob.findFirst({ where: { draftId: previous.draftId,
        requestId: previous.activeRequestId ?? '', status: { in: ['queued', 'running'] } } });
      const canceled = job ? await tx.creationJob.update({ where: { id: job.id }, data: {
        status: 'canceled', cancelRequestedAt: new Date(), leaseToken: null, leaseUntil: null } }) : null;
      await writeDraftEvent(tx, owner, next, 'job_canceled', canceled);
      return true;
    });
  },
  async claim(worker) {
    return prisma.$transaction(async tx => {
      // Coordinates the global two-job limit across multiple worker processes.
      // Return a supported scalar; PostgreSQL's void return type cannot be decoded by Prisma.
      await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(73509124)`;
      const active = await tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "creation_jobs"
        WHERE "status"='running' AND "leaseUntil">CURRENT_TIMESTAMP`;
      if (Number(active[0].count) >= 2) return null;
      // All paths acquire draft before job, avoiding cancellation/claim deadlocks.
      const candidates = await tx.$queryRaw<{ id: string; draftId: string; ownerId: string }[]>`
        SELECT j."id",j."draftId",j."ownerId" FROM "creation_jobs" j
        JOIN "creation_drafts" d ON d."id"=j."draftId"
        WHERE d."expiredAt" IS NULL AND j."kind"='recommendations' AND j."cancelRequestedAt" IS NULL AND
        ((j."status"='queued' AND j."nextRunAt"<=CURRENT_TIMESTAMP) OR
         (j."status"='running' AND j."leaseUntil"<=CURRENT_TIMESTAMP))
        ORDER BY j."nextRunAt",j."createdAt" LIMIT 1 FOR UPDATE OF d SKIP LOCKED`;
      if (!candidates[0]) return null;
      const row = candidates[0];
      const current = await lockedDraft(tx, row.ownerId, row.draftId);
      const job = await tx.creationJob.findUniqueOrThrow({ where: { id: row.id } });
      if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) {
        await tx.creationJob.update({ where: { id: job.id }, data: { status: 'canceled', leaseToken: null, leaseUntil: null } });
        return null;
      }
      const token = randomUUID();
      const rows = await tx.$queryRaw<CreationJob[]>`UPDATE "creation_jobs" SET "status"='running',
        "attempt"="attempt"+1,"leaseOwner"=${worker},"leaseToken"=${token},
        "leaseUntil"=CURRENT_TIMESTAMP + interval '90 seconds',"heartbeatAt"=CURRENT_TIMESTAMP,
        "deadlineAt"=COALESCE("deadlineAt",CURRENT_TIMESTAMP + interval '30 seconds'),"updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${job.id} RETURNING *`;
      await writeDraftEvent(tx, row.ownerId, { ...current, revision: current.revision + 1 }, 'job_started', rows[0]);
      return claimed(rows[0]);
    });
  },
  async heartbeat(job) {
    const count = await prisma.$executeRaw`UPDATE "creation_jobs" SET
      "leaseUntil"=CURRENT_TIMESTAMP + interval '90 seconds',"heartbeatAt"=CURRENT_TIMESTAMP
      WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "status"='running'
      AND "cancelRequestedAt" IS NULL AND "leaseUntil">CURRENT_TIMESTAMP`;
    return count === 1;
  },
  async reserveModelCall(job) {
    // Separate from job leases: cancellation does not immediately free a still-running SDK call.
    const until = new Date(Date.now() + 30_000);
    const slot = await prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, job.ownerId, job.draftId);
      if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) throw new LeaseLost();
      await fenced(tx, job);
      if (job.deadlineAt.getTime() <= Date.now()) throw new DOMException('Job deadline elapsed', 'TimeoutError');
      let acquired: { key: string; used: number } | null = null;
      for (let index = 0; index < 2; index++) {
        const key = `active-model-slot:${index}`;
        const rows = await tx.$queryRaw<{ key: string; used: number }[]>`
          INSERT INTO "creation_budgets" ("key", "used", "expiresAt") VALUES (${key}, 1, ${until})
          ON CONFLICT ("key") DO UPDATE SET "expiresAt" = ${until}, "used" = "creation_budgets"."used" + 1
          WHERE "creation_budgets"."expiresAt" <= CURRENT_TIMESTAMP RETURNING "key", "used"`;
        if (rows.length) { acquired = rows[0]; break; }
      }
      if (!acquired) throw creationFailure('RATE_LIMITED', 'Model capacity is busy. Try again shortly.');
      const budget = hourlyBudget(`model:${job.ownerId}`);
      await reserveBudget(tx, budget.key, 40, budget.expiresAt);
      await reserveBudget(tx, `model-job:${job.id}`, 4, new Date(Date.now() + 60 * 86400_000));
      return acquired;
    });
    return async () => {
      // Keep the generation counter: even identical expiry timestamps cannot let a
      // delayed release free a replacement occupant. Retention must preserve slot rows.
      await prisma.$executeRaw`UPDATE "creation_budgets" SET "expiresAt"=TIMESTAMP '1970-01-01'
        WHERE "key"=${slot.key} AND "used"=${slot.used} AND "expiresAt"=${until}`;
    };
  },
  async finish(job, event) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await lockedDraft(tx, job.ownerId, job.draftId);
        if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
        await fenced(tx, job);
        const next = applyEvent(current, event);
        if (next === current) return false;
        const status = event.type === 'recommendations_received' ? 'succeeded' : event.type === 'operation_cancelled' ? 'canceled' : 'failed';
        const completed = await tx.creationJob.update({ where: { id: job.id }, data: { status,
          ...(event.type === 'recommendations_received' ? { checkpoint: event.result } : {}),
          leaseToken: null, leaseUntil: null, leaseOwner: null } });
        await writeDraftEvent(tx, job.ownerId, next, status === 'succeeded' ? 'job_completed' : status === 'failed' ? 'job_failed' : 'job_canceled', completed);
        return true;
      });
    } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
  },
  async checkpoint(job, result) {
    const valid = recommendationResultSchema.parse(result);
    if (valid.requestId !== job.requestId || valid.inputRevision !== job.inputRevision || valid.intent.rawQuery !== job.input.query) throw new Error('Invalid checkpoint input');
    try {
      return await prisma.$transaction(async tx => {
        const current = await lockedDraft(tx, job.ownerId, job.draftId);
        if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
        await fenced(tx, job);
        const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
        await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1 }, 'snapshot', updated);
        return true;
      });
    } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
  },
  async retry(job, delayMs) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await lockedDraft(tx, job.ownerId, job.draftId);
        if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
        await fenced(tx, job);
        if (job.attempt >= 3 || Date.now() + delayMs >= job.deadlineAt.getTime()) return false;
        const updated = await tx.creationJob.update({ where: { id: job.id }, data: {
          status: 'queued', nextRunAt: new Date(Date.now() + delayMs), leaseToken: null, leaseUntil: null, leaseOwner: null } });
        await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1 }, 'job_queued', updated);
        return true;
      });
    } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
  },
  async release(job) {
    await prisma.creationJob.updateMany({ where: { id: job.id, leaseToken: job.leaseToken, status: 'running' },
      data: { status: 'queued', nextRunAt: new Date(), leaseToken: null, leaseUntil: null, leaseOwner: null } });
  },
 };
}
export const creationJobRepo = createCreationJobRepository();

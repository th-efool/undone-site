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
import { textAcquisitionRequestSchema, webAcquisitionRequestSchema, pdfAcquisitionRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { jobCompletion, validateWebRetention } from '@/src/server/domain/cohort-creation/job-completion';
import { releaseDetachedMaterialRefs } from './creationMaterialRefs';
import { retainedWebCheckpointSchema, webMaterialManifestSchema, type RetainedWebCheckpoint } from '@/src/shared/cohort-creation/web';
import type { ClaimedWebJob } from '@/src/server/domain/cohort-creation/durable-job';

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
  const base = { ...jobSummary(row), draftId: row.draftId, ownerId: row.ownerId,
    inputFingerprint: row.inputFingerprint, leaseToken: row.leaseToken!, deadlineAt: row.deadlineAt! };
  if (row.kind === 'acquire_text') return { ...base, kind: 'acquire_text', input: textAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? materialManifestSchema.parse(row.checkpoint) : null };
  if (row.kind === 'acquire_pdf') return { ...base, kind: 'acquire_pdf', input: pdfAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? materialManifestSchema.parse(row.checkpoint) : null };
  if (row.kind === 'acquire_web') return { ...base, kind: 'acquire_web', input: webAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? retainedWebCheckpointSchema.or(webMaterialManifestSchema).parse(row.checkpoint) : null };
  return { ...base, kind: 'recommendations', input: recommendationRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? recommendationResultSchema.parse(row.checkpoint) : null };
}
async function pinMaterial(tx: Prisma.TransactionClient, job: ClaimedCreationJob, manifest: unknown) {
  const valid = job.kind === 'acquire_web' ? webMaterialManifestSchema.parse(manifest) : materialManifestSchema.parse(manifest);
  if (job.kind === 'acquire_web') {
    const web = webMaterialManifestSchema.parse(manifest);
    await pinWebReceipt(tx, job, { phase: 'retained_web', receipt: web.receipt,
      receiptArtifact: web.receiptArtifact, receiptFingerprint: web.receiptFingerprint });
  }
  const refs = [valid.retainedSource, valid.extractionArtifact];
  for (const ref of refs) {
    const updated = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: ref.kind, byteLength: ref.byteLength, checksum: ref.checksum,
      ...(ref.kind === 'artifact' ? { artifactType: job.kind === 'acquire_web' ? 'web-extraction' : job.kind === 'acquire_pdf' ? 'pdf-extraction' : 'text-extraction', schemaVersion: 1, inputFingerprint: valid.inputFingerprint } : {}) },
      data: { referencedAt: new Date() } });
    if (updated.count !== 1) throw new Error('Checkpoint storage reference unavailable');
  }
}
async function pinWebReceipt(tx: Prisma.TransactionClient, job: ClaimedWebJob, retained: RetainedWebCheckpoint) {
  const valid = validateWebRetention(job, retained);
  for (const ref of [valid.receipt.retainedSource, valid.receiptArtifact]) {
    const updated = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: ref.kind, byteLength: ref.byteLength, checksum: ref.checksum,
      ...(ref.kind === 'artifact' ? { artifactType: 'web-response', schemaVersion: 1, inputFingerprint: valid.receiptFingerprint } : { mediaType: valid.receipt.mediaType }) },
      data: { referencedAt: new Date() } });
    if (updated.count !== 1) throw new Error('Checkpoint storage reference unavailable');
  }
}
export function createCreationJobRepository(prisma = defaultPrisma): CreationJobRepository {
 return {
  async enqueue(owner, previous, next) {
    return prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, owner, previous.draftId);
      if (!current) return null;
      const source = next.materials.find(source => source.status === 'acquiring');
      const kind = next.stage === 'recommendations' ? 'recommendations' : source?.kind === 'web' ? 'acquire_web' : source?.kind === 'pdf' ? 'acquire_pdf' : 'acquire_text';
      const input = kind === 'recommendations'
        ? recommendationRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, query: next.query })
        : (kind === 'acquire_web' ? webAcquisitionRequestSchema : kind === 'acquire_pdf' ? pdfAcquisitionRequestSchema : textAcquisitionRequestSchema).parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, source });
      const fingerprint = createHash('sha256').update(JSON.stringify({ kind, schema: 1, input })).digest('hex');
      const existing = await tx.creationJob.findUnique({ where: { draftId_kind_inputFingerprint: {
        draftId: next.draftId, kind, inputFingerprint: fingerprint } } });
      // A lost HTTP response can replay exactly the same operation safely.
      if (existing && current.inputRevision === input.inputRevision) return current;
      if (current.revision !== previous.revision) return null;
      if ((kind === 'acquire_text' || kind === 'acquire_pdf') && 'source' in input) {
        if (input.source.input.kind !== 'upload') throw creationFailure('INVALID_REQUEST', 'Select an owned upload.');
        const pinned = await tx.creationStorageObject.updateMany({ where: { id: input.source.input.assetId, ownerId: owner,
          draftId: next.draftId, kind: 'upload', status: 'ready', mediaType: { in: kind === 'acquire_pdf' ? ['application/pdf'] : ['text/plain','text/markdown','text/x-markdown'] } },
          data: { referencedAt: new Date() } });
        if (pinned.count !== 1) throw creationFailure('INVALID_REQUEST', 'The selected upload is unavailable.');
      }
      await releaseDetachedMaterialRefs(tx, owner, current, next);
      const budget = hourlyBudget(`jobs:${owner}`);
      await reserveBudget(tx, budget.key, 20, budget.expiresAt);
      await tx.creationJob.updateMany({ where: { draftId: next.draftId, status: { in: ['queued', 'running'] } },
        data: { status: 'canceled', cancelRequestedAt: new Date(), leaseToken: null, leaseUntil: null } });
      const job = await tx.creationJob.create({ data: { draftId: next.draftId, ownerId: owner,
        kind, requestId: input.requestId, inputRevision: input.inputRevision,
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
        WHERE d."expiredAt" IS NULL AND j."kind" IN ('recommendations','acquire_text','acquire_web','acquire_pdf') AND j."cancelRequestedAt" IS NULL AND
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
        "deadlineAt"=COALESCE("deadlineAt",CURRENT_TIMESTAMP + CASE WHEN "kind" IN ('acquire_web','acquire_pdf') THEN interval '120 seconds' WHEN "kind"='acquire_text' THEN interval '60 seconds' ELSE interval '30 seconds' END),"updatedAt"=CURRENT_TIMESTAMP
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
    if (job.kind !== 'recommendations') throw new Error('Text acquisition does not reserve model calls');
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
        if (event.type === 'recommendations_received') jobCompletion(job, event.result);
        if (event.type === 'material_received') {
          jobCompletion(job, event.manifest);
          await pinMaterial(tx, job, event.manifest);
        }
        const next = applyEvent(current, event);
        if (next === current) return false;
        const status = event.type === 'recommendations_received' || event.type === 'material_received' ? 'succeeded' : event.type === 'operation_cancelled' ? 'canceled' : 'failed';
        const completed = await tx.creationJob.update({ where: { id: job.id }, data: { status,
          ...(event.type === 'recommendations_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'material_received' ? { checkpoint: event.manifest } : {}),
          leaseToken: null, leaseUntil: null, leaseOwner: null } });
        await writeDraftEvent(tx, job.ownerId, next, status === 'succeeded' ? 'job_completed' : status === 'failed' ? 'job_failed' : 'job_canceled', completed);
        return true;
      });
    } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
  },
  async checkpoint(job, result) {
    if (job.kind === 'acquire_web' && 'phase' in result) {
      const valid = validateWebRetention(job, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
          await fenced(tx, job); await pinWebReceipt(tx, job, valid);
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
          await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
            materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== valid.receipt.materialId),
              { materialId: valid.receipt.materialId, ids: [valid.receipt.retainedSource.id, valid.receiptArtifact.id] }] }, 'snapshot', updated);
          return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    const completion = jobCompletion(job, result);
    const valid = completion.type === 'material_received' ? completion.manifest : recommendationResultSchema.parse(result);
    try {
      return await prisma.$transaction(async tx => {
        const current = await lockedDraft(tx, job.ownerId, job.draftId);
        if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
        await fenced(tx, job);
        if (completion.type === 'material_received') await pinMaterial(tx, job, completion.manifest);
        const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
        await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
          ...(completion.type === 'material_received' ? { materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== completion.manifest.source.id),
            { materialId: completion.manifest.source.id, ids: [completion.manifest.retainedSource.id, completion.manifest.extractionArtifact.id,
              ...('receiptArtifact' in completion.manifest ? [completion.manifest.receiptArtifact.id] : [])] }] } : {}) }, 'snapshot', updated);
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

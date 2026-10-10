import { analysisRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { analysisCheckpointSchema } from '@/src/shared/cohort-creation/analysis';
import { validateAnalysisCheckpoint } from '@/src/server/domain/cohort-creation/analysis.service';
import { pinAnalysis, preserveAnalysis } from './creationAnalysis.repo';
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, CreationJob } from '@/generated/prisma/client';
import { prisma as defaultPrisma } from '../client';
import { creationSnapshotSchema, recommendationRequestSchema, recommendationResultSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { applyEvent } from '@/src/shared/cohort-creation/flow';
import { LeaseLost, type ClaimedCreationJob, type CreationJobRepository } from '@/src/server/domain/cohort-creation/durable-job';
import { hourlyBudget, reserveBudget } from './creationBudget.repo';
import { creationFailure } from '@/src/server/domain/cohort-creation/errors';
import { jobSummary, writeDraftEvent } from './creationEvent.repo';
import { textAcquisitionRequestSchema, webAcquisitionRequestSchema, pdfAcquisitionRequestSchema, youtubeInspectionRequestSchema, youtubeObservationRequestSchema, githubAcquisitionRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { retainedGithubCheckpointSchema, githubMaterialManifestSchema, type RetainedGithubCheckpoint } from '@/src/shared/cohort-creation/github';
import type { ClaimedGithubJob } from '@/src/server/domain/cohort-creation/durable-job';
import { retainedYoutubeMetadataSchema, youtubeObservationCheckpointSchema, youtubeMaterialManifestSchema, type RetainedYoutubeMetadata, type YoutubeObservationCheckpoint } from '@/src/shared/cohort-creation/youtube';
import { validateYoutubeCheckpoint } from '@/src/server/domain/cohort-creation/materials/youtube-identity';
import type { ClaimedYoutubeObservationJob } from '@/src/server/domain/cohort-creation/durable-job';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { jobCompletion, validateWebRetention, validateGithubRetention } from '@/src/server/domain/cohort-creation/job-completion';
import { releaseDetachedMaterialRefs } from './creationMaterialRefs';
import { retainedWebCheckpointSchema, webMaterialManifestSchema, type RetainedWebCheckpoint } from '@/src/shared/cohort-creation/web';
import type { ClaimedWebJob } from '@/src/server/domain/cohort-creation/durable-job';
import { notionAcquisitionRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { notionMaterialManifestSchema, retainedNotionCheckpointSchema, type RetainedNotionCheckpoint } from '@/src/shared/cohort-creation/notion';
import type { ClaimedNotionJob } from '@/src/server/domain/cohort-creation/durable-job';
import { validateNotionRetention } from '@/src/server/domain/cohort-creation/job-completion';
import { discoveryRequestSchema } from '@/src/server/domain/cohort-creation/discovery.service';
import { discoveryCheckpointSchema, discoveryResultSchema } from '@/src/shared/cohort-creation/discovery';
import { validateDiscoveryCheckpoint } from '@/src/server/domain/cohort-creation/job-completion';
import { pinDiscovery, preserveDiscovery } from './creationDiscovery.repo';
import { chunkingRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { chunkingCheckpointSchema } from '@/src/shared/cohort-creation/processing';
import { validateChunkingCheckpoint } from '@/src/server/domain/cohort-creation/chunking.service';
import { pinChunking, preserveChunking } from './creationChunking.repo';
import { understandingRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { understandingCheckpointSchema } from '@/src/shared/cohort-creation/processing';
import { validateUnderstandingCheckpoint } from '@/src/server/domain/cohort-creation/understanding.service';
import { pinUnderstanding, preserveUnderstanding } from './creationUnderstanding.repo';

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
  if (row.kind === 'analyze_material') return { ...base, kind: 'analyze_material', input: analysisRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? analysisCheckpointSchema.parse(row.checkpoint) : null };
  if (row.kind === 'chunk_material') return { ...base, kind: 'chunk_material', input: chunkingRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? chunkingCheckpointSchema.parse(row.checkpoint) : null };
  if (row.kind === 'understand_material') return { ...base, kind: 'understand_material', input: understandingRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? understandingCheckpointSchema.parse(row.checkpoint) : null };
  if (row.kind === 'acquire_text') return { ...base, kind: 'acquire_text', input: textAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? materialManifestSchema.parse(row.checkpoint) : null };
  if (row.kind === 'acquire_pdf') return { ...base, kind: 'acquire_pdf', input: pdfAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? materialManifestSchema.parse(row.checkpoint) : null };
  if (row.kind === 'inspect_youtube') return { ...base, kind: 'inspect_youtube', input: youtubeInspectionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? retainedYoutubeMetadataSchema.parse(row.checkpoint) : null };
  if (row.kind === 'observe_youtube') return { ...base, kind: 'observe_youtube', input: youtubeObservationRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? youtubeObservationCheckpointSchema.or(youtubeMaterialManifestSchema).parse(row.checkpoint) : null };
  if (row.kind === 'discover_material') return { ...base, kind: 'discover_material', input: discoveryRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? discoveryCheckpointSchema.or(discoveryResultSchema).parse(row.checkpoint) : null };
  if (row.kind === 'acquire_notion') return { ...base, kind: 'acquire_notion', input: notionAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? retainedNotionCheckpointSchema.or(notionMaterialManifestSchema).parse(row.checkpoint) : null };
  if (row.kind === 'acquire_github') return { ...base, kind: 'acquire_github', input: githubAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? retainedGithubCheckpointSchema.or(githubMaterialManifestSchema).parse(row.checkpoint) : null };
  if (row.kind === 'acquire_web') return { ...base, kind: 'acquire_web', input: webAcquisitionRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? retainedWebCheckpointSchema.or(webMaterialManifestSchema).parse(row.checkpoint) : null };
  return { ...base, kind: 'recommendations', input: recommendationRequestSchema.parse(row.input),
    checkpoint: row.checkpoint ? recommendationResultSchema.parse(row.checkpoint) : null };
}
async function pinMaterial(tx: Prisma.TransactionClient, job: ClaimedCreationJob, manifest: unknown) {
  if (job.kind === 'acquire_notion') {
    const valid = notionMaterialManifestSchema.parse(manifest);
    await pinNotionReceipt(tx, job, valid.notion); const ref = valid.extractionArtifact;
    const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'notion-extraction',
      schemaVersion: 1, inputFingerprint: valid.inputFingerprint }, data: { referencedAt: new Date() } });
    if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
    return;
  }
  if (job.kind === 'acquire_github') {
    const valid = githubMaterialManifestSchema.parse(manifest);
    await pinGithubReceipt(tx, job, valid.github); const ref = valid.extractionArtifact;
    const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'github-extraction',
      schemaVersion: 1, inputFingerprint: valid.inputFingerprint }, data: { referencedAt: new Date() } });
    if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
    return;
  }
  if (job.kind === 'observe_youtube') {
    const valid = youtubeMaterialManifestSchema.parse(manifest);
    await pinYoutubeObservations(tx, job, valid.youtube);
    const ref = valid.extractionArtifact;
    const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'youtube-material',
      schemaVersion: 1, inputFingerprint: valid.inputFingerprint }, data: { referencedAt: new Date() } });
    if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
    return;
  }
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
async function pinYoutubeMetadata(tx: Prisma.TransactionClient, job: ClaimedCreationJob, retained: RetainedYoutubeMetadata) {
  const ref = retained.artifact;
  const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
    status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'youtube-metadata',
    schemaVersion: 1, inputFingerprint: retained.inputFingerprint }, data: { referencedAt: new Date() } });
  if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
}
async function pinYoutubeObservations(tx: Prisma.TransactionClient, job: Pick<ClaimedYoutubeObservationJob, 'input' | 'ownerId' | 'draftId'>,
  checkpoint: YoutubeObservationCheckpoint) {
  const valid = validateYoutubeCheckpoint(job.input, checkpoint);
  const expected = [{ ref: valid.metadataArtifact, type: 'youtube-metadata', fingerprint: valid.metadataFingerprint },
    ...valid.units.map(unit => ({ ref: unit.artifact, type: 'youtube-observation', fingerprint: unit.version }))];
  const ids = expected.map(item => item.ref.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate observation storage reference');
  const rows = await tx.creationStorageObject.findMany({ where: { id: { in: ids }, ownerId: job.ownerId, draftId: job.draftId,
    status: 'ready', kind: 'artifact', schemaVersion: 1 } });
  if (expected.some(item => !rows.some(row => row.id === item.ref.id && row.byteLength === item.ref.byteLength &&
    row.checksum === item.ref.checksum && row.artifactType === item.type && row.inputFingerprint === item.fingerprint))) throw new Error('Checkpoint storage reference unavailable');
  const pinned = await tx.creationStorageObject.updateMany({ where: { id: { in: ids }, ownerId: job.ownerId, draftId: job.draftId,
    status: 'ready', kind: 'artifact' }, data: { referencedAt: new Date() } });
  if (pinned.count !== ids.length) throw new Error('Checkpoint storage reference unavailable');
}
function preserveYoutubeWork(current: CreationSnapshot, checkpoint: YoutubeObservationCheckpoint) {
  const preview = current.youtubeSources.find(source => source.materialId === checkpoint.materialId);
  if (!preview) throw new Error('Observation source is unavailable');
  validateYoutubeCheckpoint({ requestId: current.activeRequestId!, inputRevision: current.inputRevision,
    source: current.materials.find(source => source.id === checkpoint.materialId)!, metadata: preview }, checkpoint);
}
async function pinGithubReceipt(tx: Prisma.TransactionClient, job: ClaimedGithubJob, retained: RetainedGithubCheckpoint) {
  const valid = validateGithubRetention(job, retained); const ref = valid.artifact;
  const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
    status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'github-source',
    schemaVersion: 1, inputFingerprint: valid.inputFingerprint }, data: { referencedAt: new Date() } });
  if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
}
function preserveGithubSource(current: CreationSnapshot, retained: RetainedGithubCheckpoint, partial = false) {
  const refs = current.materialRefs.find(ref => ref.materialId === retained.materialId);
  if (refs && (!refs.ids.includes(retained.artifact.id) || partial && refs.ids.length !== 1)) throw new Error('Cannot replace a retained GitHub receipt or completed checkpoint');
}
async function pinNotionReceipt(tx: Prisma.TransactionClient, job: ClaimedNotionJob, retained: RetainedNotionCheckpoint) {
  const valid = validateNotionRetention(job, retained); const ref = valid.artifact;
  const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
    status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'notion-source',
    schemaVersion: 1, inputFingerprint: valid.inputFingerprint }, data: { referencedAt: new Date() } });
  if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
}
function preserveNotionSource(current: CreationSnapshot, retained: RetainedNotionCheckpoint, partial = false) {
  const refs = current.materialRefs.find(ref => ref.materialId === retained.materialId);
  if (refs && (!refs.ids.includes(retained.artifact.id) || partial && refs.ids.length !== 1)) throw new Error('Cannot replace a retained Notion receipt or completed checkpoint');
}
export function createCreationJobRepository(prisma = defaultPrisma): CreationJobRepository {
 return {
  async enqueue(owner, previous, next) {
    return prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, owner, previous.draftId);
      if (!current) return null;
      const source = next.materials.find(source => source.status === 'acquiring');
      const metadata = next.youtubeSources.find(preview => preview.materialId === source?.id);
      const kind = next.stage === 'processing' ? next.processing?.phase === 'analysis' ? 'analyze_material' : next.processing?.phase === 'chunking' ? 'chunk_material' : 'understand_material' : next.stage === 'recommendations' ? 'recommendations' : next.discovery?.requestId === next.activeRequestId ? 'discover_material' : source?.kind === 'notion' ? 'acquire_notion' : source?.kind === 'github' ? 'acquire_github' : source?.kind === 'web' ? 'acquire_web' : source?.kind === 'pdf' ? 'acquire_pdf' : ['youtube_video', 'youtube_playlist'].includes(source?.kind ?? '') ? metadata && source?.selectedUnitIds.length ? 'observe_youtube' : 'inspect_youtube' : 'acquire_text';
      const input = kind === 'recommendations'
        ? recommendationRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, query: next.query })
        : kind === 'analyze_material' ? analysisRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision,
          snapshot: { ...next, status: 'succeeded', activeRequestId: null, processing: { ...next.processing, phase: 'chunking', analysis: null } } })        : kind === 'chunk_material' ? chunkingRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision,
          snapshot: { ...next, status: 'succeeded', activeRequestId: null, processing: { ...next.processing, phase: 'understanding', chunking: null, analysis: null } } })
        : kind === 'understand_material' ? understandingRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision,
          snapshot: { ...next, stage: 'starting_point', status: 'succeeded', activeRequestId: null, processing: null } })
        : kind === 'discover_material' ? discoveryRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, intent: next.result?.intent })
        : kind === 'acquire_github' || kind === 'acquire_notion' ? (kind === 'acquire_github' ? githubAcquisitionRequestSchema : notionAcquisitionRequestSchema).parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, source,
          maxUnits: 100 - next.materials.filter(item => item.id !== source?.id).reduce((sum, item) => sum + item.selectedUnitIds.length, 0) })
        : kind === 'observe_youtube' ? youtubeObservationRequestSchema.parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, source, metadata })
        : (kind === 'acquire_web' ? webAcquisitionRequestSchema : kind === 'acquire_pdf' ? pdfAcquisitionRequestSchema : kind === 'inspect_youtube' ? youtubeInspectionRequestSchema : textAcquisitionRequestSchema).parse({ requestId: next.activeRequestId, inputRevision: next.inputRevision, source });
      const fingerprint = createHash('sha256').update(JSON.stringify({ kind, schema: 1, input })).digest('hex');
      const existing = await tx.creationJob.findUnique({ where: { draftId_kind_inputFingerprint: {
        draftId: next.draftId, kind, inputFingerprint: fingerprint } } });
      // A lost HTTP response can replay exactly the same operation safely.
      if (existing && current.inputRevision === input.inputRevision) return current;
      if (current.revision !== previous.revision) return null;
      if (kind === 'observe_youtube') {
        const valid = youtubeObservationRequestSchema.parse(input);
        await pinYoutubeObservations(tx, { input: valid, ownerId: owner, draftId: next.draftId }, {
          phase: 'youtube_observations', materialId: valid.source.id, inputRevision: valid.inputRevision,
          sourceRevision: valid.metadata.sourceRevision, metadataArtifact: valid.metadata.metadataArtifact,
          metadataFingerprint: valid.metadata.metadataFingerprint,
          units: valid.source.selectedUnitIds.flatMap(id => valid.metadata.observations.filter(unit => unit.unitId === id)) });
      }
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
        WHERE d."expiredAt" IS NULL AND j."kind" IN ('recommendations','acquire_text','acquire_web','acquire_pdf','inspect_youtube','observe_youtube','acquire_github','acquire_notion','discover_material','understand_material','chunk_material','analyze_material') AND j."cancelRequestedAt" IS NULL AND
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
        "deadlineAt"=COALESCE("deadlineAt",CURRENT_TIMESTAMP + CASE WHEN "kind" IN ('understand_material','chunk_material','analyze_material') THEN interval '6 hours' WHEN "kind"='discover_material' THEN interval '15 minutes' WHEN "kind"='observe_youtube' THEN interval '6 hours' WHEN "kind" IN ('acquire_github','acquire_notion') THEN interval '6 minutes' WHEN "kind" IN ('acquire_web','acquire_pdf','inspect_youtube') THEN interval '120 seconds' WHEN "kind"='acquire_text' THEN interval '60 seconds' ELSE interval '30 seconds' END),"updatedAt"=CURRENT_TIMESTAMP
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
  async reserveModelCall(job, unitId) {
    if (job.kind !== 'analyze_material' && job.kind !== 'chunk_material' && job.kind !== 'understand_material' && job.kind !== 'discover_material' && job.kind !== 'recommendations' && (job.kind !== 'observe_youtube' || !unitId || !job.input.source.selectedUnitIds.includes(unitId))) throw new Error('Model calls require a recommendation, discovery, selected video or understanding job');
    // Separate from job leases: cancellation does not immediately free a still-running SDK call.
    const until = new Date(Date.now() + (job.kind === 'observe_youtube' ? 120_000 : job.kind === 'discover_material' || job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' ? 90_000 : 30_000));
    const slot = await prisma.$transaction(async tx => {
      const current = await lockedDraft(tx, job.ownerId, job.draftId);
      if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) throw new LeaseLost();
      await fenced(tx, job);
      if (job.kind === 'analyze_material') {
        const saved = await tx.creationJob.findUnique({ where: { id: job.id }, select: { checkpoint: true } });
        const checkpoint = validateAnalysisCheckpoint(job.input.snapshot, job.requestId, saved?.checkpoint);
        if (!unitId || !checkpoint.partitionIds.includes(unitId) || checkpoint.completed.some(item => item.partitionId === unitId)) throw new Error('Analysis partition is not available');
      }
      if (job.kind === 'chunk_material') {
        const saved = await tx.creationJob.findUnique({ where: { id: job.id }, select: { checkpoint: true } });
        const checkpoint = validateChunkingCheckpoint(job.input.snapshot, job.requestId, saved?.checkpoint);
        if (!unitId || !checkpoint.partitionIds.includes(unitId) || checkpoint.completed.some(item => item.partitionId === unitId)) throw new Error('Chunking partition is not available');
      }
      if (job.kind === 'understand_material') {
        const saved = await tx.creationJob.findUnique({ where: { id: job.id }, select: { checkpoint: true } });
        const checkpoint = validateUnderstandingCheckpoint(job.input.snapshot, job.requestId, saved?.checkpoint);
        if (!unitId || !checkpoint.partitionIds.includes(unitId) || checkpoint.completed.some(item => item.partitionId === unitId)) throw new Error('Understanding partition is not available');
      }
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
      await reserveBudget(tx, job.kind === 'observe_youtube' || job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' ? `model-job:${job.id}:unit:${unitId}` : `model-job:${job.id}`,
        job.kind === 'observe_youtube' || job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' ? 2 : job.kind === 'discover_material' ? 3 : 4, new Date(Date.now() + 60 * 86400_000));
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
        if (event.type === 'analysis_received') {
          if (job.kind !== 'analyze_material') throw new Error('Invalid analysis job');
          jobCompletion(job, event.result); preserveAnalysis(current.processing?.analysis?.checkpoint ?? null, event.result);
          await pinAnalysis(tx, { ownerId: job.ownerId, draftId: job.draftId }, event.result);
        }
        if (event.type === 'chunking_received') {
          if (job.kind !== 'chunk_material') throw new Error('Invalid chunking job');
          jobCompletion(job, event.result); preserveChunking(current.processing?.chunking?.checkpoint ?? null, event.result);
          await pinChunking(tx, { ownerId: job.ownerId, draftId: job.draftId }, event.result);
        }
        if (event.type === 'understanding_received') {
          if (job.kind !== 'understand_material') throw new Error('Invalid understanding job');
          jobCompletion(job, event.result); preserveUnderstanding(current.processing?.checkpoint ?? null, event.result);
          await pinUnderstanding(tx, { ownerId: job.ownerId, draftId: job.draftId }, event.result);
        }
        if (event.type === 'discovery_received') {
          if (job.kind !== 'discover_material') throw new Error('Invalid discovery job');
          jobCompletion(job, event.result); preserveDiscovery(current, event.result.checkpoint); await pinDiscovery(tx, job, event.result.checkpoint);
        }
        if (event.type === 'material_received') {
          jobCompletion(job, event.manifest);
          if ('youtube' in event.manifest) preserveYoutubeWork(current, event.manifest.youtube);
          if ('github' in event.manifest) preserveGithubSource(current, event.manifest.github);
          if ('notion' in event.manifest) preserveNotionSource(current, event.manifest.notion);
          await pinMaterial(tx, job, event.manifest);
        }
        if (event.type === 'youtube_metadata_received') { jobCompletion(job, event.result); await pinYoutubeMetadata(tx, job, event.result); }
        const next = applyEvent(current, event);
        if (next === current) return false;
        const status = event.type === 'analysis_received' || event.type === 'chunking_received' || event.type === 'understanding_received' || event.type === 'discovery_received' || event.type === 'recommendations_received' || event.type === 'material_received' || event.type === 'youtube_metadata_received' ? 'succeeded' : event.type === 'operation_cancelled' ? 'canceled' : 'failed';
        const completed = await tx.creationJob.update({ where: { id: job.id }, data: { status,
          ...(event.type === 'recommendations_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'material_received' ? { checkpoint: event.manifest } : {}),
          ...(event.type === 'youtube_metadata_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'discovery_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'understanding_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'analysis_received' ? { checkpoint: event.result } : {}),
          ...(event.type === 'chunking_received' ? { checkpoint: event.result } : {}),
          leaseToken: null, leaseUntil: null, leaseOwner: null } });
        await writeDraftEvent(tx, job.ownerId, next, status === 'succeeded' ? 'job_completed' : status === 'failed' ? 'job_failed' : 'job_canceled', completed);
        return true;
      });
    } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
  },
  async checkpoint(job, result) {
    if (job.kind === 'analyze_material') {
      const checkpoint = validateAnalysisCheckpoint(job.input.snapshot, job.requestId, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision || current.processing?.analysis?.requestId !== job.requestId) return false;
          await fenced(tx, job); preserveAnalysis(current.processing.analysis.checkpoint, checkpoint);
          await pinAnalysis(tx, { ownerId: job.ownerId, draftId: job.draftId }, checkpoint);
          const next = creationSnapshotSchema.parse({ ...current, revision: current.revision + 1,
            processing: { ...current.processing, analysis: { requestId: job.requestId, checkpoint, complete: false } } });
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint } });
          await writeDraftEvent(tx, job.ownerId, next, 'snapshot', updated); return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'chunk_material') {
      const checkpoint = validateChunkingCheckpoint(job.input.snapshot, job.requestId, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision || current.processing?.chunking?.requestId !== job.requestId) return false;
          await fenced(tx, job); preserveChunking(current.processing.chunking.checkpoint, checkpoint);
          await pinChunking(tx, { ownerId: job.ownerId, draftId: job.draftId }, checkpoint);
          const next = creationSnapshotSchema.parse({ ...current, revision: current.revision + 1,
            processing: { ...current.processing, chunking: { requestId: job.requestId, checkpoint, complete: false } } });
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint } });
          await writeDraftEvent(tx, job.ownerId, next, 'snapshot', updated); return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'understand_material') {
      const checkpoint = validateUnderstandingCheckpoint(job.input.snapshot, job.requestId, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision || current.processing?.requestId !== job.requestId) return false;
          await fenced(tx, job); preserveUnderstanding(current.processing.checkpoint, checkpoint);
          await pinUnderstanding(tx, { ownerId: job.ownerId, draftId: job.draftId }, checkpoint);
          const next = creationSnapshotSchema.parse({ ...current, revision: current.revision + 1,
            processing: { requestId: job.requestId, inputRevision: job.inputRevision, checkpoint, complete: false } });
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint } });
          await writeDraftEvent(tx, job.ownerId, next, 'snapshot', updated); return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'discover_material') {
      const partial = 'phase' in result;
      const valid = partial ? validateDiscoveryCheckpoint(job, result) : discoveryResultSchema.parse(result);
      const checkpoint = 'phase' in valid ? valid : valid.checkpoint;
      validateDiscoveryCheckpoint(job, checkpoint);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
          await fenced(tx, job); preserveDiscovery(current, checkpoint, partial); await pinDiscovery(tx, job, checkpoint);
          const next = creationSnapshotSchema.parse({ ...current, revision: current.revision + 1,
            discovery: { requestId: job.requestId, inputRevision: job.inputRevision, checkpoint, result: null } });
          await releaseDetachedMaterialRefs(tx, job.ownerId, current, next);
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
          await writeDraftEvent(tx, job.ownerId, next, 'snapshot', updated); return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'acquire_notion' && 'phase' in result) {
      const valid = validateNotionRetention(job, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
          await fenced(tx, job); preserveNotionSource(current, valid, true); await pinNotionReceipt(tx, job, valid);
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
          await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
            materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== valid.materialId),
              { materialId: valid.materialId, ids: [valid.artifact.id] }] }, 'snapshot', updated);
          return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'acquire_github' && 'phase' in result) {
      const valid = validateGithubRetention(job, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
          await fenced(tx, job); preserveGithubSource(current, valid, true); await pinGithubReceipt(tx, job, valid);
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
          await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
            materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== valid.materialId),
              { materialId: valid.materialId, ids: [valid.artifact.id] }] }, 'snapshot', updated);
          return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
    if (job.kind === 'observe_youtube' && 'phase' in result) {
      const valid = validateYoutubeCheckpoint(job.input, result);
      try {
        return await prisma.$transaction(async tx => {
          const current = await lockedDraft(tx, job.ownerId, job.draftId);
          if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
          await fenced(tx, job); preserveYoutubeWork(current, valid);
          await pinYoutubeObservations(tx, job, valid);
          const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
          await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
            youtubeSources: current.youtubeSources.map(source => source.materialId === valid.materialId ? { ...source, observations: valid.units } : source),
            materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== valid.materialId),
              { materialId: valid.materialId, ids: [valid.metadataArtifact.id, ...valid.units.map(unit => unit.artifact.id)] }] }, 'snapshot', updated);
          return true;
        });
      } catch (error) { if (error instanceof LeaseLost) return false; throw error; }
    }
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
    const valid = completion.type === 'material_received' ? completion.manifest : completion.type === 'youtube_metadata_received' ? completion.result : recommendationResultSchema.parse(result);
    try {
      return await prisma.$transaction(async tx => {
        const current = await lockedDraft(tx, job.ownerId, job.draftId);
        if (!current || current.activeRequestId !== job.requestId || current.inputRevision !== job.inputRevision) return false;
        await fenced(tx, job);
        if (completion.type === 'material_received' && 'youtube' in completion.manifest) preserveYoutubeWork(current, completion.manifest.youtube);
        if (completion.type === 'material_received' && 'github' in completion.manifest) preserveGithubSource(current, completion.manifest.github);
        if (completion.type === 'material_received' && 'notion' in completion.manifest) preserveNotionSource(current, completion.manifest.notion);
        if (completion.type === 'material_received') await pinMaterial(tx, job, completion.manifest);
        if (completion.type === 'youtube_metadata_received') await pinYoutubeMetadata(tx, job, completion.result);
        const updated = await tx.creationJob.update({ where: { id: job.id }, data: { checkpoint: valid } });
        await writeDraftEvent(tx, job.ownerId, { ...current, revision: current.revision + 1,
          ...(completion.type === 'material_received' ? { materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== completion.manifest.source.id),
            { materialId: completion.manifest.source.id, ids: [completion.manifest.retainedSource.id, completion.manifest.extractionArtifact.id,
              ...('receiptArtifact' in completion.manifest ? [completion.manifest.receiptArtifact.id] : []),
              ...('youtube' in completion.manifest ? completion.manifest.youtube.units.map(unit => unit.artifact.id) : [])] }],
            ...('youtube' in completion.manifest ? { youtubeSources: current.youtubeSources.map(source => source.materialId === completion.manifest.source.id && 'youtube' in completion.manifest ? { ...source, observations: completion.manifest.youtube.units } : source) } : {}) } : {}),
          ...(completion.type === 'youtube_metadata_received' ? { materialRefs: [...current.materialRefs.filter(ref => ref.materialId !== completion.result.receipt.materialId),
            { materialId: completion.result.receipt.materialId, ids: [completion.result.artifact.id] }] } : {}) }, 'snapshot', updated);
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

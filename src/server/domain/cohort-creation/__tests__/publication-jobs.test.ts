import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { buildingRequestSchema, publicationRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { DraftService, DraftConflict, DraftNotFound } from '../draft.service';
import type { ClaimedBuildingJob, ClaimedPublicationJob, CreationJobRepository } from '../durable-job';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion } from '../job-completion';
import { understandingInputFingerprint } from '../understanding.service';
import { chunkingInputFingerprint } from '../chunking.service';
import { analysisInputFingerprint } from '../analysis.service';
import { buildingInputFingerprint } from '../building.service';
import type { BuildingContentService } from '../building-content.service';
import { rebaseReview } from '../review.service';
import { publicationSnapshotHash, type PublicationService } from '../publication.service';
import type { PublicationCheckpoint } from '@/src/shared/cohort-creation/publication';
function fixture() {
  const materialId = randomUUID(); const artifactRef = randomUUID(); const understandingId = randomUUID();
  const material = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), query: result.intent.rawQuery, result, inputRevision: 2, revision: 5,
    stage: 'starting_point', status: 'succeeded', startingPoint: 'have_material',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, status: 'ready', selectedUnitIds: [materialId] }],
    extractions: [{ materialId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef, extractionKind: 'text', complete: true, segmentCount: 1 }],
    materialRefs: [{ materialId, ids: [artifactRef] }] });
  const understanding = { phase: 'understanding' as const, requestId: understandingId, inputRevision: 2, inputFingerprint: understandingInputFingerprint(material, understandingId),
    total: 1, partitionIds: ['c'.repeat(64)], completed: [{ partitionId: 'c'.repeat(64), artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'd'.repeat(64), byteLength: 300 } }] };
  const understood = applyEvent(applyCommand(material, { type: 'understand_material', requestId: understandingId }), { type: 'understanding_received', requestId: understandingId, result: understanding });
  const chunkRequest = randomUUID();
  const chunkCheckpoint = { phase: 'chunking' as const, requestId: chunkRequest, inputRevision: 2,
    inputFingerprint: chunkingInputFingerprint(understood, chunkRequest), understandingFingerprint: understanding.inputFingerprint,
    total: 1, partitionIds: understanding.partitionIds, completed: [{ partitionId: understanding.partitionIds[0], chunkCount: 2,
      artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'f'.repeat(64), byteLength: 500 } }] };
  const chunked = applyEvent(applyCommand(understood, { type: 'chunk_material', requestId: chunkRequest }), { type: 'chunking_received', requestId: chunkRequest, result: chunkCheckpoint });
  const analysisRequest = randomUUID();
  const analysisCheckpoint = { phase: 'analysis' as const, requestId: analysisRequest, inputRevision: 2,
    inputFingerprint: analysisInputFingerprint(chunked, analysisRequest), chunkingFingerprint: chunkCheckpoint.inputFingerprint,
    total: 1, partitionIds: understanding.partitionIds, completed: [{ partitionId: understanding.partitionIds[0], chunkCount: 2,
      artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'a'.repeat(64), byteLength: 500 } }] };
  const own = applyEvent(applyCommand(chunked, { type: 'analyze_material', requestId: analysisRequest }), { type: 'analysis_received', requestId: analysisRequest, result: analysisCheckpoint });
  const command = { type: 'build_curriculum' as const, requestId: randomUUID() }; const running = applyCommand(own, command);
  const input = buildingRequestSchema.parse({ requestId: command.requestId, inputRevision: 2, snapshot: own });
  const checkpoint = { phase: 'building' as const, requestId: command.requestId, inputRevision: 2, inputFingerprint: buildingInputFingerprint(own, command.requestId),
    analysisFingerprint: analysisCheckpoint.inputFingerprint, total: 1, partitionIds: understanding.partitionIds, completed: [] };
  const completed = { ...checkpoint, completed: [{ partitionId: checkpoint.partitionIds[0], lessonCount: 2,
    artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'e'.repeat(64), byteLength: 500 } }] };
  const job: ClaimedBuildingJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'build_curriculum', input, checkpoint: null,
    inputRevision: 2, requestId: command.requestId, inputFingerprint: 'queue', leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 60_000),
    status: 'running', attempt: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(async () => true), reserveModelCall: vi.fn(),
    checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  return { own, running, material, command, checkpoint, completed, job, repo };
}

function reviewFixture() {
  const f = fixture(); const ready = applyEvent(f.running, jobCompletion(f.job, f.completed));
  const curriculum = generatedCurriculumSchema.parse({ version: f.completed.inputFingerprint, inputRevision: 2,
    title: { value: 'Topic', origin: 'ai', acceptedRevision: 2 }, description: { value: 'Learn topic', origin: 'user', acceptedRevision: 2 },
    seasons: [{ id: 'season', title: { value: 'Season', origin: 'ai', acceptedRevision: 2 }, order: 0, lessons: [{ id: 'lesson', order: 0,
      title: { value: 'First lesson', origin: 'ai', acceptedRevision: 2 }, objectives: { value: ['Understand'], origin: 'ai', acceptedRevision: 2 },
      type: 'ARTICLE', chunkIds: ['chunk'], materialIds: [ready.materials[0].id], durationSeconds: 60 }] }], warnings: [] });
  const content = { load: vi.fn(async () => ({ curriculum })) } as unknown as Pick<BuildingContentService, 'load'>;
  const review = rebaseReview(curriculum, null);
  const state = creationSnapshotSchema.parse({ ...ready, stage: 'review', review });
  return { ...f, ready, curriculum, content, review, state };
}

function publicationFixture(mode: 'private_activation' | 'public_publish' = 'private_activation') {
  const f = reviewFixture(); const requestId = randomUUID(); const cohortId = randomUUID(); const snapshotHash = publicationSnapshotHash(f.state);
  const command = { type: 'finalize_creation' as const, requestId, mode };
  const pending = applyCommand(f.state, command);
  const running = creationSnapshotSchema.parse({ ...pending, publication: { ...pending.publication!, cohortId, snapshotHash } });
  const input = publicationRequestSchema.parse({ requestId, mode, cohortId, snapshotHash, inputRevision: 2,
    snapshot: { ...running, stage: 'review', status: 'succeeded', activeRequestId: null } });
  const checkpoint: PublicationCheckpoint = { phase: 'publication', requestId, mode, cohortId, snapshotHash, total: 1, lessonIds: ['lesson'], completed: [] };
  const complete = { ...checkpoint, completed: [{ lessonId: 'lesson', artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'b'.repeat(64), byteLength: 200 } }] };
  const receipt = { requestId, mode, cohortId, snapshotHash, committedAt: new Date().toISOString() };
  const job: ClaimedPublicationJob = { ...f.job, kind: 'finalize_creation', requestId, input, checkpoint: null };
  const execute = (run: PublicationService['run']) => executeCreationJob(f.repo, job, vi.fn(), new AbortController().signal,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
  return { ...f, command, running, input, checkpoint, complete, receipt, job, execute };
}
describe('durable artifacts-first finalization', () => {
  it.each(['private_activation', 'public_publish'] as const)('requires reviewed accepted curriculum for %s and freezes the current revision', mode => {
    const f = publicationFixture(mode); expect(f.running.stage).toBe('finalizing'); expect(f.running.inputRevision).toBe(f.state.inputRevision);
    expect(f.running.materials).toEqual(f.state.materials); expect(f.running.processing).toEqual(f.state.processing);
    expect(publicationRequestSchema.safeParse({ ...f.input, snapshot: f.running }).success).toBe(false);
    expect(publicationRequestSchema.safeParse({ ...f.input, cohortId: randomUUID() }).success).toBe(false);
    expect(() => applyCommand(f.ready, f.command)).toThrow('not available');
    const proposed = { ...f.state, review: { ...f.review, proposal: { requestId: randomUUID(), baseEditRevision: f.review.editRevision, result: { message: 'Pending', changes: [] } } } };
    expect(() => applyCommand(proposed, f.command)).toThrow('not available');
    expect(() => applyCommand({ ...f.state, review: { ...f.review, orphanedLessonIds: ['orphan'] } }, f.command)).toThrow('not available');
  });
  it('uses owner/CAS and makes lost responses and duplicate publication commands idempotent', async () => {
    const f = publicationFixture(); let stored = f.state; const enqueue = vi.fn(async (_owner, _before, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel: vi.fn() });
    await expect(service.command('foreign', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    const base = stored.revision; await service.command('owner', draftId, base, f.command); await service.command('owner', draftId, base, f.command);
    expect(enqueue).toHaveBeenCalledOnce();
    stored = applyEvent(f.running, { type: 'publication_committed', requestId: f.command.requestId, receipt: f.receipt });
    await service.command('owner', draftId, base, { ...f.command, requestId: randomUUID() }); expect(enqueue).toHaveBeenCalledOnce();
    const canceledAfterCommit = await service.command('owner', draftId, base, { type: 'cancel_processing' }); expect(canceledAfterCommit.publication?.receipt).toEqual(f.receipt);
  });
  it('does not expose prepared artifacts until the authoritative transaction commits, and fences cancellation/stale receipts', () => {
    const f = publicationFixture(); const prepared = jobCompletion(f.job, f.complete);
    expect(prepared.type).toBe('publication_prepared'); expect(applyEvent(f.running, prepared)).toBe(f.running);
    const canceled = applyCommand(f.running, { type: 'cancel_processing' }); expect(canceled.status).toBe('canceled');
    expect(applyEvent(canceled, { type: 'publication_committed', requestId: f.command.requestId, receipt: f.receipt })).toBe(canceled);
    expect(applyEvent(f.running, { type: 'publication_committed', requestId: f.command.requestId, receipt: { ...f.receipt, cohortId: randomUUID() } })).toBe(f.running);
    const committed = applyEvent(f.running, { type: 'publication_committed', requestId: f.command.requestId, receipt: f.receipt });
    expect(committed.stage).toBe('published'); expect(committed.publication?.receipt?.cohortId).toBe(f.receipt.cohortId);
    expect(applyEvent(committed, { type: 'publication_committed', requestId: f.command.requestId, receipt: f.receipt })).toBe(committed);
    expect(() => applyCommand(committed, { type: 'back_to_materials' })).toThrow('already activated');
  });
  it('preserves the cohort ID for private-to-public promotion and prevents public downgrade', () => {
    const f = publicationFixture(); const privateState = applyEvent(f.running, { type: 'publication_committed', requestId: f.command.requestId, receipt: f.receipt });
    const promoted = applyCommand(privateState, { type: 'finalize_creation', requestId: randomUUID(), mode: 'public_publish' });
    expect(promoted.publication?.cohortId).toBe(f.receipt.cohortId); expect(promoted.publication?.receipt).toEqual(f.receipt);
    const publicState = creationSnapshotSchema.parse({ ...privateState, publication: { ...privateState.publication!, mode: 'public_publish', receipt: { ...f.receipt, mode: 'public_publish' } } });
    expect(() => applyCommand(publicState, { type: 'finalize_creation', requestId: randomUUID(), mode: 'private_activation' })).toThrow('not available');
  });
  it('saves retained preparation and recovers complete checkpoints after deadline without rebuilding', async () => {
    const f = publicationFixture(); const run = vi.fn<PublicationService['run']>(async (...args) => { await args[6](f.checkpoint); return f.complete; });
    await f.execute(run); expect(f.repo.checkpoint).toHaveBeenCalledWith(f.job, f.complete); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.complete));
    f.job.checkpoint = f.complete; f.job.deadlineAt = new Date(0); run.mockClear(); await f.execute(run); expect(run).not.toHaveBeenCalled();
    expect(() => jobCompletion(f.job, f.checkpoint)).toThrow('incomplete');
    const bad = { ...f.complete, snapshotHash: 'f'.repeat(64) }; expect(() => jobCompletion(f.job, bad)).toThrow();
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(f.running))).publication).toEqual(f.running.publication);
  });
});

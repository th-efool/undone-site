import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { buildingRequestSchema, refinementRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { DraftService, DraftConflict, DraftNotFound } from '../draft.service';
import type { ClaimedBuildingJob, ClaimedRefinementJob, CreationJobRepository } from '../durable-job';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion } from '../job-completion';
import { understandingInputFingerprint } from '../understanding.service';
import { chunkingInputFingerprint } from '../chunking.service';
import { analysisInputFingerprint } from '../analysis.service';
import { buildingInputFingerprint } from '../building.service';
import type { BuildingContentService } from '../building-content.service';
import { projectReview, rebaseReview } from '../review.service';
import { RefinementService, validateRefinementResult } from '../refinement.service';
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
describe('owned curriculum review and bounded refinement', () => {
  it('opens owned retained curriculum with CAS, authentication continuity and refresh-safe review', async () => {
    const f = reviewFixture(); let stored = f.ready; const swap = vi.fn(async (_owner, _id, _base, next) => { stored = next; return true; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap }, f.repo, f.content);
    await expect(service.command('foreign', draftId, stored.revision, { type: 'open_review' })).rejects.toBeInstanceOf(DraftNotFound);
    expect(f.content.load).not.toHaveBeenCalled();
    await expect(service.command('owner', draftId, stored.revision - 1, { type: 'open_review' })).rejects.toBeInstanceOf(DraftConflict);
    const open = await service.command('owner', draftId, stored.revision, { type: 'open_review' });
    expect(open.stage).toBe('review'); expect(open.review?.lessonIds).toEqual(['lesson']);
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(open))).review).toEqual(open.review);
    expect(f.content.load).toHaveBeenCalledWith({ ownerId: 'owner', draftId }, f.ready, expect.any(AbortSignal));
  });
  it('validates edits, projects approved copy and invalidates delivery without touching sources', () => {
    const f = reviewFixture(); const metadata = applyCommand(f.state, { type: 'edit_review', patch: { title: 'My title', visibility: 'PUBLIC' } });
    const edited = applyCommand(metadata, { type: 'edit_lesson', lessonId: 'lesson', objectives: ['My objective'] });
    expect(edited.processing).toEqual(f.state.processing); expect(edited.inputRevision).toBe(2); expect(edited.review?.invalidated).toContain('publication');
    const projected = projectReview(f.curriculum, edited.review!); expect(projected.title.value).toBe('My title');
    expect(projected.seasons[0].lessons[0].objectives).toMatchObject({ value: ['My objective'], origin: 'user' });
    expect(projected.seasons[0].lessons[0].chunkIds).toEqual(['chunk']);
    expect(() => applyCommand(f.state, { type: 'edit_lesson', lessonId: 'foreign', title: 'No' })).toThrow('Unknown');
    expect(() => applyCommand(f.state, { type: 'edit_lesson', lessonId: 'lesson' })).toThrow();
  });
  it('rebases matching edits and keeps orphaned edits visible until explicitly discarded', () => {
    const f = reviewFixture(); const edited = applyCommand(f.state, { type: 'edit_lesson', lessonId: 'lesson', title: 'Keep me' });
    const newCurriculum = structuredClone(f.curriculum); newCurriculum.version = 'f'.repeat(64); newCurriculum.seasons[0].lessons[0].id = 'new-lesson';
    const rebased = rebaseReview(newCurriculum, edited.review!); expect(rebased.lessonEdits).toEqual(edited.review!.lessonEdits); expect(rebased.orphanedLessonIds).toEqual(['lesson']);
    expect(projectReview(newCurriculum, rebased).seasons[0].lessons[0].title.value).toBe('First lesson');
    const current = { ...f.state, review: rebased, processing: { ...f.state.processing!, building: { ...f.state.processing!.building!,
      checkpoint: { ...f.state.processing!.building!.checkpoint!, inputFingerprint: newCurriculum.version } } } };
    const resolved = applyCommand(current, { type: 'discard_orphaned_edits', lessonIds: ['lesson'] });
    expect(resolved.review!.lessonEdits).toEqual([]); expect(() => applyCommand(current, { type: 'refine_curriculum', requestId: randomUUID(), prompt: 'Change' })).toThrow('not available');
    expect(() => applyCommand(current, { type: 'discard_orphaned_edits', lessonIds: ['foreign'] })).toThrow('Unknown');
  });
  it('proposes only and applies explicitly against the current edit revision and known lesson IDs', () => {
    const f = reviewFixture(); const command = { type: 'refine_curriculum' as const, requestId: randomUUID(), prompt: 'Clarify title' };
    const running = applyCommand(f.state, command); const result = { requestId: command.requestId, inputRevision: 2, baseEditRevision: f.review.editRevision,
      buildFingerprint: f.curriculum.version, proposal: { message: 'Proposed title', changes: [{ type: 'lesson_title' as const, lessonId: 'lesson', value: 'Clearer' }] } };
    const proposed = applyEvent(running, { type: 'refinement_received', requestId: command.requestId, result });
    expect(proposed.review!.lessonEdits).toEqual([]); expect(proposed.review!.proposal?.result).toEqual(result.proposal);
    const accepted = applyCommand(proposed, { type: 'apply_refinement', requestId: command.requestId }); expect(accepted.review!.lessonEdits[0].title).toBe('Clearer');
    const manual = applyCommand(proposed, { type: 'edit_review', patch: { description: 'My change' } });
    expect(() => applyCommand(manual, { type: 'apply_refinement', requestId: command.requestId })).toThrow('stale');
    const discarded = applyCommand(manual, { type: 'discard_refinement', requestId: command.requestId }); expect(discarded.review!.description).toBe('My change');
    const stale = applyEvent(running, { type: 'refinement_received', requestId: command.requestId, result: { ...result, baseEditRevision: 99 } }); expect(stale).toBe(running);
  });
  it('runs owned refinement with retained curriculum, checkpoints once and recovers after deadline without AI', async () => {
    const f = reviewFixture(); const requestId = randomUUID(); const running = applyCommand(f.state, { type: 'refine_curriculum', requestId, prompt: 'Improve' });
    const input = refinementRequestSchema.parse({ requestId, inputRevision: 2, snapshot: { ...running, status: 'succeeded', activeRequestId: null } });
    const refine = vi.fn(async () => ({ message: 'Consider a title', changes: [{ type: 'title' as const, value: 'Improved' }] }));
    const service = new RefinementService(f.content, { identity: { provider: 'test', modelId: 'test', adapterVersion: 'v1' }, refine });
    const checkpoint = await service.run({ ownerId: 'owner', draftId }, input, new AbortController().signal);
    expect(validateRefinementResult(input, checkpoint)).toEqual(checkpoint); expect(refine).toHaveBeenCalledOnce();
    expect(() => validateRefinementResult(input, { ...checkpoint, proposal: { message: 'Bad', changes: [{ type: 'lesson_title', lessonId: 'foreign', value: 'No' }] } })).toThrow('invalid');
    const job: ClaimedRefinementJob = { ...f.job, kind: 'refine_curriculum', input, requestId, checkpoint, deadlineAt: new Date(0) };
    const factory = vi.fn(() => service);
    await executeCreationJob(f.repo, job, vi.fn(), new AbortController().signal, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, factory);
    expect(factory).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(job, jobCompletion(job, checkpoint));
    const run = () => executeCreationJob(f.repo, { ...job, checkpoint: null, deadlineAt: new Date(Date.now() + 60_000) }, vi.fn(), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, factory);
    vi.mocked(f.repo.finish).mockClear(); await run(); expect(factory).toHaveBeenCalledOnce(); expect(f.repo.checkpoint).toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'refinement_received' }));
    vi.mocked(f.repo.finish).mockClear(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false); await run(); expect(f.repo.finish).not.toHaveBeenCalled();
    const canceled = applyCommand(running, { type: 'cancel_processing' });
    expect(applyEvent(canceled, { type: 'refinement_received', requestId, result: checkpoint })).toBe(canceled);

  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { buildingRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { DraftService, DraftConflict, DraftNotFound } from '../draft.service';
import type { ClaimedBuildingJob, CreationJobRepository } from '../durable-job';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion } from '../job-completion';
import { understandingInputFingerprint } from '../understanding.service';
import { chunkingInputFingerprint } from '../chunking.service';
import { analysisInputFingerprint } from '../analysis.service';
import { buildingInputFingerprint, type BuildingService } from '../building.service';
import { releaseDetachedMaterialRefs } from '@/src/server/infrastructure/db/postgres/repositories/creationMaterialRefs';

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
  const execute = (run: BuildingService['run']) => executeCreationJob(repo, job, () => { throw new Error('No recommendations'); }, new AbortController().signal,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
  return { own, running, material, command, checkpoint, completed, job, repo, execute };
}
describe('owned durable building', () => {
  it.each(['have_material', 'find_material', 'have_goal'] as const)('requires complete analysis for %s and preserves sources and prerequisite receipts', point => {
    const f = fixture(); const next = applyCommand({ ...f.own, startingPoint: point }, f.command);
    expect(next.processing?.checkpoint).toEqual(f.own.processing?.checkpoint); expect(next.inputRevision).toBe(f.own.inputRevision);
    expect(next.processing?.phase).toBe('building'); expect(next.processing?.building?.requestId).toBe(f.command.requestId);
    expect(() => applyCommand(f.material, f.command)).toThrow('not complete'); expect(() => applyCommand(f.running, f.command)).toThrow('not complete');
    expect(buildingRequestSchema.safeParse({ ...f.job.input, snapshot: f.running }).success).toBe(false);
  });
  it('uses owner/CAS, deduplicates lost responses and cancels through existing jobs', async () => {
    const f = fixture(); let stored = f.own; const enqueue = vi.fn(async (_owner, _before, next) => { stored = next; return next; });
    const cancel = vi.fn(async (_owner, _before, next) => { stored = next; return true; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel });
    await expect(service.command('foreign', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    const base = stored.revision; await service.command('owner', draftId, base, f.command); await service.command('owner', draftId, base, f.command);
    expect(enqueue).toHaveBeenCalledOnce(); await service.command('owner', draftId, stored.revision, { type: 'cancel_processing' });
    expect(cancel).toHaveBeenCalledOnce(); expect(stored.processing?.complete).toBe(true); expect(stored.status).toBe('canceled');
  });
  it('resumes actual progress and completes building into ready without publishing', async () => {
    const f = fixture(); f.job.checkpoint = f.checkpoint;
    const run = vi.fn<BuildingService['run']>(async (...args) => { await args[4](f.checkpoint); return f.completed; });
    await f.execute(run); expect(run.mock.calls[0][5]).toEqual(f.checkpoint); expect(f.repo.checkpoint).toHaveBeenCalledWith(f.job, f.completed);
    const done = applyEvent(f.running, jobCompletion(f.job, f.completed)); expect(done.stage).toBe('ready');
    expect(done.processing?.complete).toBe(true); expect(done.processing?.building?.complete).toBe(true);
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(done))).processing?.building?.checkpoint).toEqual(f.completed);
    expect(() => jobCompletion(f.job, f.checkpoint)).toThrow('incomplete');
  });
  it('finalizes complete checkpoints after deadline without generation', async () => {
    const f = fixture(); f.job.checkpoint = f.completed; f.job.deadlineAt = new Date(0); const run = vi.fn<BuildingService['run']>();
    await f.execute(run); expect(run).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.completed));
  });
  it('fences late results, preserves analysis on fresh build and releases invalidated build pins', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await f.execute(async (...args) => { await args[4](f.checkpoint); return f.completed; }); expect(f.repo.finish).not.toHaveBeenCalled();
    const canceled = applyCommand(f.running, { type: 'cancel_processing' }); expect(applyEvent(canceled, jobCompletion(f.job, f.completed))).toBe(canceled);
    const done = applyEvent(f.running, jobCompletion(f.job, f.completed)); const fresh = applyCommand(done, { ...f.command, requestId: randomUUID() });
    const updateMany = vi.fn(async () => ({ count: 1 })); const tx = { creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    await releaseDetachedMaterialRefs(tx, 'owner', done, fresh);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: [f.completed.completed[0].artifact.id] } }) }));
    const back = applyCommand(done, { type: 'back_to_materials' }); const removed = applyCommand(back, { type: 'remove_material', materialId: back.materials[0].id });
    expect(removed.processing).toBeNull(); expect(() => jobCompletion(f.job, { ...f.completed, analysisFingerprint: 'f'.repeat(64) })).toThrow();
    expect(creationSnapshotSchema.safeParse({ ...f.running, processing: { ...f.running.processing!, complete: false } }).success).toBe(false);
  });
});

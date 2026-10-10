import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { understandingRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { DraftService, DraftConflict, DraftNotFound } from '../draft.service';
import type { ClaimedUnderstandingJob, CreationJobRepository } from '../durable-job';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion } from '../job-completion';
import { understandingInputFingerprint, type UnderstandingService } from '../understanding.service';
import { releaseDetachedMaterialRefs } from '@/src/server/infrastructure/db/postgres/repositories/creationMaterialRefs';

function fixture() {
  const materialId = randomUUID(); const artifactId = randomUUID();
  const own = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), query: result.intent.rawQuery, result, inputRevision: 2,
    revision: 5, status: 'succeeded', stage: 'starting_point', startingPoint: 'have_material',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, status: 'ready', selectedUnitIds: [materialId] }],
    extractions: [{ materialId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef: artifactId, extractionKind: 'text', complete: true, segmentCount: 1 }],
    materialRefs: [{ materialId, ids: [artifactId] }] });
  const command = { type: 'understand_material' as const, requestId: randomUUID() }; const running = applyCommand(own, command);
  const input = understandingRequestSchema.parse({ requestId: command.requestId, inputRevision: own.inputRevision, snapshot: own });
  const checkpoint = { phase: 'understanding' as const, requestId: input.requestId, inputRevision: input.inputRevision,
    inputFingerprint: understandingInputFingerprint(own, input.requestId), total: 1, partitionIds: ['c'.repeat(64)], completed: [] };
  const completed = { ...checkpoint, completed: [{ partitionId: checkpoint.partitionIds[0], artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'd'.repeat(64), byteLength: 500 } }] };
  const job: ClaimedUnderstandingJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'understand_material', input, checkpoint: null,
    inputRevision: input.inputRevision, requestId: input.requestId, inputFingerprint: 'queue-fingerprint', leaseToken: randomUUID(),
    deadlineAt: new Date(Date.now() + 60_000), status: 'running', attempt: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(async () => true), reserveModelCall: vi.fn(),
    checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  const execute = (run: UnderstandingService['run']) => executeCreationJob(repo, job, () => { throw new Error('No recommendations'); }, new AbortController().signal,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
  return { own, running, command, input, checkpoint, completed, job, repo, execute };
}
describe('owned durable understanding', () => {
  it.each(['have_material', 'find_material', 'have_goal'] as const)('starts %s only with ready retained sources and preserves source revisions', point => {
    const f = fixture(); const next = applyCommand({ ...f.own, startingPoint: point }, f.command);
    expect(next.stage).toBe('processing'); expect(next.inputRevision).toBe(f.own.inputRevision); expect(next.materials).toEqual(f.own.materials);
    expect(() => applyCommand({ ...f.own, materials: [], extractions: [], materialRefs: [] }, f.command)).toThrow('not ready');
    expect(() => applyCommand({ ...f.own, materialRefs: [] }, f.command)).toThrow('not ready');
    expect(() => applyCommand(f.running, { ...f.command, requestId: randomUUID() })).toThrow('not ready');
    expect(understandingRequestSchema.safeParse({ ...f.input, snapshot: f.running }).success).toBe(false);
  });
  it('uses owner/CAS, deduplicates lost responses and sends cancellation through the job repository', async () => {
    const f = fixture(); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _before, next) => { stored = next; return next; }); const cancel = vi.fn(async (_owner, _before, next) => { stored = next; return true; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel });
    await expect(service.command('foreign', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    await service.command('owner', draftId, stored.revision, f.command);
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    await service.command('owner', draftId, stored.revision, { type: 'cancel_processing' }); expect(cancel).toHaveBeenCalledOnce(); expect(stored.status).toBe('canceled');
  });
  it('accepts actual progress, resumes saved inventory and completes understanding without claiming a curriculum', async () => {
    const f = fixture(); f.job.checkpoint = f.checkpoint;
    const run = vi.fn<UnderstandingService['run']>(async (...args) => { await args[4](f.checkpoint); return f.completed; });
    await f.execute(run); expect(run.mock.calls[0][5]).toEqual(f.checkpoint);
    expect(f.repo.checkpoint).toHaveBeenNthCalledWith(1, f.job, f.checkpoint); expect(f.repo.checkpoint).toHaveBeenNthCalledWith(2, f.job, f.completed);
    const done = applyEvent(f.running, jobCompletion(f.job, f.completed));
    expect(done.stage).toBe('processing'); expect(done.processing?.complete).toBe(true); expect(done.status).toBe('succeeded');
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(done))).processing?.checkpoint?.completed).toHaveLength(1);
    expect(() => jobCompletion(f.job, f.checkpoint)).toThrow('incomplete');
  });
  it('finalizes complete checkpoints after deadline without another model or content read', async () => {
    const f = fixture(); f.job.checkpoint = f.completed; f.job.deadlineAt = new Date(0); const run = vi.fn<UnderstandingService['run']>();
    await f.execute(run); expect(run).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.completed));
  });
  it('fences late progress, ignores canceled results and invalidates dependent pins when sources change', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await f.execute(async (...args) => { await args[4](f.checkpoint); return f.completed; }); expect(f.repo.finish).not.toHaveBeenCalled();
    const canceled = applyCommand(f.running, { type: 'cancel_processing' }); expect(applyEvent(canceled, jobCompletion(f.job, f.completed))).toBe(canceled);
    const done = applyEvent(f.running, jobCompletion(f.job, f.completed));
    expect(() => applyCommand(f.running, { type: 'back_to_materials' })).toThrow('still running');
    const back = applyCommand(done, { type: 'back_to_materials' }); const removed = applyCommand(back, { type: 'remove_material', materialId: back.materials[0].id });
    expect(removed.processing).toBeNull();
    const updateMany = vi.fn(async () => ({ count: 1 })); await releaseDetachedMaterialRefs({ creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient, 'owner', back, removed);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: expect.objectContaining({ id: { in: expect.arrayContaining([f.completed.completed[0].artifact.id]) } }) })]);
    expect(() => jobCompletion(f.job, { ...f.completed, inputRevision: 99 })).toThrow();
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { discoveryResultSchema } from '@/src/shared/cohort-creation/discovery';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { discoveryFingerprint, type DiscoveryService } from '../discovery.service';
import { DraftService, DraftNotFound, DraftConflict } from '../draft.service';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion, validateDiscoveryCheckpoint } from '../job-completion';
import type { ClaimedDiscoveryJob, CreationJobRepository } from '../durable-job';
import { preserveDiscovery, pinDiscovery } from '@/src/server/infrastructure/db/postgres/repositories/creationDiscovery.repo';
import type { Prisma } from '@/generated/prisma/client';
import { releaseDetachedMaterialRefs } from '@/src/server/infrastructure/db/postgres/repositories/creationMaterialRefs';

function fixture(startingPoint: 'find_material' | 'have_goal' = 'find_material') {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId: result.requestId,
    query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint });
  const command = { type: 'discover_material' as const, requestId: randomUUID() }; const running = applyCommand(own, command);
  const input = { requestId: command.requestId, inputRevision: running.inputRevision, intent: result.intent };
  const ref = () => ({ id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) });
  const checkpoint = { phase: 'discovery_sources' as const, requestId: input.requestId, inputRevision: input.inputRevision,
    inputFingerprint: discoveryFingerprint(input), searchArtifact: ref(), observationArtifact: null, selectionArtifact: null, processed: 0, total: 0 };
  const completed = discoveryResultSchema.parse({ checkpoint: { ...checkpoint, observationArtifact: ref(), selectionArtifact: ref() }, candidates: [], failures: [], selection: { selected: [] } });
  const job: ClaimedDiscoveryJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'discover_material', requestId: input.requestId,
    inputRevision: input.inputRevision, inputFingerprint: 'queue-fingerprint', input, checkpoint: null, status: 'running', attempt: 1,
    leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 900_000), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(async () => true),
    reserveModelCall: vi.fn(), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  return { own, running, command, job, checkpoint, completed, repo };
}
describe('owned durable discovery orchestration', () => {
  it('acquires only an explicitly observed source and retains grounding provenance after changing the starting point', async () => {
    const f = fixture(); const url = 'https://docs.example.org/lesson';
    const completed = discoveryResultSchema.parse({ ...f.completed, checkpoint: { ...f.completed.checkpoint, total: 1, processed: 1 },
      candidates: [{ key: 'b'.repeat(64), citationIds: ['source-one'], url, title: 'Actual observed title', kind: 'web', observedAt: new Date().toISOString(),
        observation: { method: 'public_http', requestedUrl: url, redirects: [], titleOrigin: 'observed', contentRetained: false } }] });
    const ready = applyEvent(f.running, jobCompletion(f.job, completed));
    expect(() => applyCommand(ready, { type: 'acquire_web', materialId: randomUUID(), requestId: randomUUID(), url: 'https://invented.example.org/source' })).toThrow('Starting point');
    const acquiring = applyCommand(ready, { type: 'acquire_web', materialId: randomUUID(), requestId: randomUUID(), url });
    expect(acquiring.startingPoint).toBe('find_material'); expect(acquiring.materials[0].discoveredFrom).toMatchObject({
      candidateKey: 'b'.repeat(64), requestId: f.command.requestId, searchArtifactId: f.checkpoint.searchArtifact.id,
      observationArtifactId: completed.checkpoint.observationArtifact!.id });
    const canceled = applyCommand(acquiring, { type: 'cancel_material_acquisition' });
    const manual = applyCommand(canceled, { type: 'choose_starting_point', startingPoint: 'have_material' });
    const updateMany = vi.fn(async () => ({ count: 1 }));
    await releaseDetachedMaterialRefs({ creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient, 'owner', canceled, manual);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: expect.objectContaining({ id: { in: [completed.checkpoint.selectionArtifact!.id] } }) })]);
    expect(manual.materials[0].discoveredFrom).toEqual(acquiring.materials[0].discoveredFrom);
    const returning = applyCommand(manual, { type: 'choose_starting_point', startingPoint: 'find_material' });
    const retry = applyCommand(returning, { type: 'acquire_web', materialId: acquiring.materials[0].id, requestId: randomUUID(), url });
    expect(retry.materials[0].discoveredFrom).toEqual(acquiring.materials[0].discoveredFrom);
    expect(() => applyCommand(returning, { type: 'acquire_web', materialId: acquiring.materials[0].id,
      requestId: randomUUID(), url: 'https://example.com/unconfirmed' })).toThrow('Starting point');
  });
  it.each(['find_material', 'have_goal'] as const)('supports %s with owner/CAS and duplicate request protection', async point => {
    const f = fixture(point); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _before, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel: vi.fn() });
    await expect(service.command('foreign', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    await service.command('owner', draftId, stored.revision, f.command);
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(stored))).discovery?.requestId).toBe(f.command.requestId);
    expect(() => applyCommand({ ...f.own, startingPoint: 'have_material' }, f.command)).toThrow('Starting point');
  });
  it('commits progress and completion without treating discovered sources as imported content', async () => {
    const f = fixture(); const run = vi.fn<DiscoveryService['run']>(async (...args) => { await args[3](f.checkpoint); return f.completed; });
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
    expect(f.repo.checkpoint).toHaveBeenNthCalledWith(1, f.job, f.checkpoint); expect(f.repo.checkpoint).toHaveBeenNthCalledWith(2, f.job, f.completed);
    const next = applyEvent(f.running, jobCompletion(f.job, f.completed));
    expect(next.discovery?.result).toEqual(f.completed); expect(next.materials).toEqual([]); expect(next.extractions).toEqual([]);
    expect(next.startingPoint).toBe('find_material'); expect(next.status).toBe('succeeded');
  });
  it('resumes partial checkpoints and finalizes complete checkpoints without another service call after deadline', async () => {
    const f = fixture(); f.job.checkpoint = f.checkpoint; const run = vi.fn<DiscoveryService['run']>(async () => f.completed);
    const execute = () => executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
    await execute(); expect(run.mock.calls[0][4]).toEqual(f.checkpoint);
    f.job.checkpoint = f.completed; f.job.deadlineAt = new Date(0); run.mockClear(); await execute();
    expect(run).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledTimes(2);
  });
  it('fences late progress and ignores stale or canceled discovery completion', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    const run = vi.fn<DiscoveryService['run']>(async (...args) => { await args[3](f.checkpoint); return f.completed; });
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run }));
    expect(f.repo.finish).not.toHaveBeenCalled();
    expect(() => validateDiscoveryCheckpoint(f.job, { ...f.checkpoint, inputRevision: 99 })).toThrow();
    const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(applyEvent(canceled, jobCompletion(f.job, f.completed))).toBe(canceled);
  });
  it('preserves accepted receipt identity and refuses progress regression or completed-result replacement', () => {
    const f = fixture(); const current = creationSnapshotSchema.parse({ ...f.running, discovery: { ...f.running.discovery, checkpoint: f.checkpoint } });
    expect(() => preserveDiscovery(current, { ...f.checkpoint, searchArtifact: { ...f.checkpoint.searchArtifact, id: randomUUID() } })).toThrow('Cannot regress');
    const complete = creationSnapshotSchema.parse({ ...current, discovery: { ...current.discovery, checkpoint: f.completed.checkpoint } });
    expect(() => preserveDiscovery(complete, f.checkpoint)).toThrow('Cannot regress');
    expect(() => preserveDiscovery(complete, f.completed.checkpoint)).not.toThrow();
  });
  it('pins only scoped, typed and fingerprinted artifacts and rejects foreign/unavailable records', async () => {
    const f = fixture(); const updateMany = vi.fn(async () => ({ count: 1 }));
    const tx = { creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    await pinDiscovery(tx, f.job, f.completed.checkpoint); expect(updateMany).toHaveBeenCalledTimes(3);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: expect.objectContaining({ ownerId: 'owner', draftId,
      artifactType: 'discovery-search', inputFingerprint: f.checkpoint.inputFingerprint, checksum: f.checkpoint.searchArtifact.checksum }) })]);
    updateMany.mockResolvedValue({ count: 0 }); await expect(pinDiscovery(tx, f.job, f.completed.checkpoint)).rejects.toThrow('storage reference unavailable');
  });
});

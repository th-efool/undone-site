import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { textAcquisitionFingerprint, textExtractionVersion, TEXT_PARSER_VERSION } from '../materials/text';
import { executeCreationJob } from '../durable-job.runner';
import type { ClaimedTextJob, CreationJobRepository } from '../durable-job';
import { jobCompletion } from '../job-completion';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { DraftConflict, DraftNotFound, DraftService } from '../draft.service';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations',
    requestId: result.requestId, query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const command = { type: 'acquire_text' as const, requestId: randomUUID(), materialId: randomUUID(), assetId: randomUUID() };
  const running = applyCommand(own, command);
  const source = { ...running.materials[0], selectedUnitIds: [command.materialId], status: 'ready' as const };
  const ref = { id: command.assetId, kind: 'upload' as const, byteLength: 8, checksum: 'a'.repeat(64) };
  const artifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 200, checksum: 'b'.repeat(64) };
  const manifest = materialManifestSchema.parse({ schemaVersion: 1, inputRevision: running.inputRevision, source,
    retainedSource: ref, extractionArtifact: artifact, parserVersion: TEXT_PARSER_VERSION,
    inputFingerprint: textAcquisitionFingerprint(source.id, running.inputRevision, ref), acquiredAt: new Date().toISOString(),
    extraction: { materialId: source.id, version: textExtractionVersion(ref.checksum), checksum: ref.checksum, artifactRef: artifact.id,
      extractionKind: 'text', segmentCount: 1, complete: true } });
  const job: ClaimedTextJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'acquire_text',
    input: { requestId: command.requestId, inputRevision: running.inputRevision, source: running.materials[0] },
    requestId: command.requestId, inputRevision: running.inputRevision, inputFingerprint: 'fingerprint',
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 60_000),
    checkpoint: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(),
    heartbeat: vi.fn(async () => true), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true),
    retry: vi.fn(async () => false), release: vi.fn() };
  return { accepted, own, command, running, manifest, job, repo };
}
describe('durable material state', () => {
  it('removes only selected provenance, preserves intent and rejects late results', () => {
    const f = fixture(); const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    const other = { ...ready.materials[0], id: randomUUID() };
    const otherExtraction = { ...ready.extractions[0], materialId: other.id, artifactRef: randomUUID() };
    const state = creationSnapshotSchema.parse({ ...ready, materials: [...ready.materials, other], extractions: [...ready.extractions, otherExtraction] });
    const removed = applyCommand(state, { type: 'remove_material', materialId: f.command.materialId });
    expect(removed.materials).toEqual([other]); expect(removed.extractions).toEqual([otherExtraction]);
    expect(removed.result).toEqual(state.result); expect(removed.inputRevision).toBe(state.inputRevision + 1);
    expect(removed.revision).toBe(state.revision + 1); expect(removed.lastMaterialRequestId).toBeNull();
    expect(applyEvent(removed, jobCompletion(f.job, f.manifest))).toBe(removed);
    expect(() => applyCommand(f.running, { type: 'remove_material', materialId: f.command.materialId })).toThrow();
    expect(() => applyCommand(removed, { type: 'remove_material', materialId: f.command.materialId })).toThrow();
  });
  it('replaces one source without discarding other sources or their extractions', () => {
    const f = fixture(); const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    const other = { ...ready.materials[0], id: randomUUID() };
    const otherExtraction = { ...ready.extractions[0], materialId: other.id, artifactRef: randomUUID() };
    const state = { ...ready, materials: [...ready.materials, other], extractions: [...ready.extractions, otherExtraction] };
    const replaced = applyCommand(state, { ...f.command, assetId: randomUUID(), requestId: randomUUID() });
    expect(replaced.materials).toHaveLength(2); expect(replaced.materials).toContainEqual(other);
    expect(replaced.extractions).toEqual([otherExtraction]); expect(replaced.result).toEqual(state.result);
  });
  it('authorizes removal, rejects stale mutations and resumes accepted removal', async () => {
    const f = fixture(); let stored = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    const repository = { create: vi.fn(async () => stored), load: vi.fn(async (owner: string) => owner === 'owner' ? stored : null),
      swap: vi.fn(async (_owner, _id, revision, next) => { if (revision !== stored.revision) return false; stored = next; return true; }) };
    const service = new DraftService(repository, f.repo);
    const command = { type: 'remove_material' as const, materialId: f.command.materialId };
    await expect(service.command('other', draftId, stored.revision, command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, command)).rejects.toBeInstanceOf(DraftConflict);
    const revision = stored.revision;
    await service.command('owner', draftId, revision, command);
    expect((await new DraftService(repository, f.repo).load('owner', draftId)).materials).toEqual([]);
    expect(f.repo.enqueue).not.toHaveBeenCalled();
    await expect(service.command('owner', draftId, revision, command)).rejects.toBeInstanceOf(DraftConflict);
  });
  it('resumes through the draft command service and replays lost responses without duplicate work', async () => {
    const f = fixture(); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const repository = { create: vi.fn(async () => stored), load: vi.fn(async (owner: string) => owner === 'owner' ? stored : null),
      swap: vi.fn(async () => false) };
    const jobs = { enqueue, cancel: vi.fn(async () => true) };
    const service = new DraftService(repository, jobs);
    const queued = await service.command('owner', draftId, stored.revision, f.command);
    stored = applyEvent(queued, jobCompletion(f.job, f.manifest));
    const resumed = new DraftService(repository, jobs);
    expect(await resumed.command('owner', draftId, f.own.revision, f.command)).toBe(stored);
    expect(enqueue).toHaveBeenCalledOnce();
    await expect(resumed.command('other', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(resumed.command('owner', draftId, f.own.revision, { ...f.command, requestId: randomUUID() })).rejects.toBeInstanceOf(DraftConflict);
  });
  it('decodes old drafts and retains intent across material-only revisions', () => {
    const f = fixture(); const { materials, extractions, lastMaterialRequestId, ...old } = f.own;
    expect(materials).toEqual([]); expect(extractions).toEqual([]); expect(lastMaterialRequestId).toBeNull();
    expect(creationSnapshotSchema.parse(old).materials).toEqual([]);
    expect(f.running.inputRevision).toBe(f.own.inputRevision + 1);
    expect(f.running.result).toEqual(f.own.result);
  });
  it('accepts only matching revision/source results and retains extraction references on reload', () => {
    const f = fixture(); const event = jobCompletion(f.job, f.manifest);
    const ready = applyEvent(f.running, event);
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(ready))).extractions[0].artifactRef).toBe(f.manifest.extractionArtifact.id);
    expect(ready.materials[0].status).toBe('ready');
    expect(applyEvent(f.running, { type: 'material_received', requestId: f.job.requestId,
      manifest: { ...f.manifest, inputRevision: f.manifest.inputRevision - 1 } })).toBe(f.running);
    expect(applyEvent(f.running, { type: 'material_received', requestId: randomUUID(), manifest: f.manifest })).toBe(f.running);
  });
  it('preserves raw selection on cancellation/failure and clears it for a new intent', () => {
    const f = fixture(); const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(canceled.materials[0]).toMatchObject({ status: 'pending', input: { assetId: f.command.assetId } });
    expect(applyEvent(canceled, jobCompletion(f.job, f.manifest))).toBe(canceled);
    expect(applyCommand(canceled, { type: 'request_recommendations', query: 'Learn something else', requestId: randomUUID() }).materials).toEqual([]);
    const failed = applyEvent(f.running, { type: 'operation_failed', requestId: f.job.requestId,
      error: { code: 'DATA_UNAVAILABLE', message: 'Retry', retryable: true } });
    expect(failed.materials[0].status).toBe('failed');
    expect(applyCommand(failed, { ...f.command, requestId: randomUUID() }).materials).toHaveLength(1);
  });
  it('guards wrong starting points, concurrent edits and mismatched artifact fingerprints', () => {
    const f = fixture();
    expect(() => applyCommand(f.accepted, f.command)).toThrow();
    expect(() => applyCommand(f.running, f.command)).toThrow();
    expect(() => jobCompletion(f.job, { ...f.manifest, inputFingerprint: 'd'.repeat(64) })).toThrow('Invalid checkpoint input');
  });
});
describe('durable text worker dispatch', () => {
  it('runs acquisition without AI and checkpoints before completion', async () => {
    const f = fixture(); const recommend = vi.fn(); const acquire = vi.fn(async () => f.manifest);
    await executeCreationJob(f.repo, f.job, () => ({ recommend }), new AbortController().signal, () => ({ acquire }));
    expect(recommend).not.toHaveBeenCalled(); expect(f.repo.reserveModelCall).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledWith({ ownerId: f.job.ownerId, draftId }, f.job.input.source, f.job.inputRevision, expect.any(AbortSignal));
    expect(vi.mocked(f.repo.checkpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.repo.finish).mock.invocationCallOrder[0]);
  });
  it('recovers a checkpoint after deadline without reacquiring bytes', async () => {
    const f = fixture(); f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0); const acquire = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, () => ({ acquire }));
    expect(acquire).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.manifest));
  });
  it('refuses completion when checkpoint fencing fails', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      () => ({ acquire: vi.fn(async () => f.manifest) }));
    expect(f.repo.finish).not.toHaveBeenCalled();
  });
  it('reports scope failures without retries or invented success', async () => {
    const f = fixture();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      () => ({ acquire: vi.fn(async () => { throw new CreationStorageError('LIMIT_EXCEEDED', 'Select less material'); }) }));
    expect(f.repo.checkpoint).not.toHaveBeenCalled(); expect(f.repo.retry).not.toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenCalledWith(f.job, expect.objectContaining({ type: 'operation_failed',
      error: { code: 'INVALID_REQUEST', message: 'Select less material', retryable: false } }));
  });
});

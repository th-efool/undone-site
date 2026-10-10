import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { PDF_PARSER_VERSION, pdfAcquisitionFingerprint, pdfExtractionVersion } from '../materials/pdf-identity';
import { executeCreationJob } from '../durable-job.runner';
import type { ClaimedPdfJob, CreationJobRepository } from '../durable-job';
import { jobCompletion } from '../job-completion';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { DraftConflict, DraftNotFound, DraftService } from '../draft.service';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations',
    requestId: result.requestId, query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const command = { type: 'acquire_pdf' as const, requestId: randomUUID(), materialId: randomUUID(), assetId: randomUUID() };
  const running = applyCommand(own, command); const source = running.materials[0];
  const ref = { id: command.assetId, kind: 'upload' as const, byteLength: 800, checksum: 'a'.repeat(64) };
  const artifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: 'b'.repeat(64) };
  const manifest = materialManifestSchema.parse({ schemaVersion: 1, inputRevision: running.inputRevision,
    source: { ...source, status: 'ready', selectedUnitIds: [source.id] }, retainedSource: ref, extractionArtifact: artifact,
    parserVersion: PDF_PARSER_VERSION, inputFingerprint: pdfAcquisitionFingerprint(source.id, running.inputRevision, ref),
    acquiredAt: new Date().toISOString(), extraction: { materialId: source.id, version: pdfExtractionVersion(ref.checksum),
      checksum: ref.checksum, artifactRef: artifact.id, extractionKind: 'text', segmentCount: 2, complete: true } });
  const job: ClaimedPdfJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'acquire_pdf',
    input: { requestId: command.requestId, inputRevision: running.inputRevision, source },
    requestId: command.requestId, inputRevision: running.inputRevision, inputFingerprint: 'fingerprint',
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 120_000),
    checkpoint: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(),
    heartbeat: vi.fn(async () => true), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true),
    retry: vi.fn(async () => false), release: vi.fn() };
  return { own, command, running, manifest, job, repo };
}
describe('durable PDF acquisition', () => {
  it('dispatches PDF without AI and fences the complete artifact before acceptance', async () => {
    const f = fixture(); const recommend = vi.fn(); const text = vi.fn(); const acquire = vi.fn(async () => f.manifest);
    await executeCreationJob(f.repo, f.job, () => ({ recommend }), new AbortController().signal, () => ({ acquire: text }), undefined, () => ({ acquire }));
    expect(recommend).not.toHaveBeenCalled(); expect(text).not.toHaveBeenCalled(); expect(f.repo.reserveModelCall).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledWith({ ownerId: 'owner', draftId }, f.job.input.source, f.job.inputRevision, expect.any(AbortSignal));
    expect(vi.mocked(f.repo.checkpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.repo.finish).mock.invocationCallOrder[0]);
    const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(ready))).materialRefs[0].ids).toEqual([f.command.assetId, f.manifest.extractionArtifact.id]);
  });
  it('recovers a complete checkpoint without PDF parsing even after deadline', async () => {
    const f = fixture(); f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0); const acquire = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, undefined, () => ({ acquire }));
    expect(acquire).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.manifest));
  });
  it('rejects stale identity/parser/fingerprint and does not finish after a lost fence', async () => {
    const f = fixture();
    for (const manifest of [{ ...f.manifest, inputRevision: f.manifest.inputRevision - 1 },
      { ...f.manifest, parserVersion: 'wrong' }, { ...f.manifest, inputFingerprint: 'c'.repeat(64) },
      { ...f.manifest, source: { ...f.manifest.source, kind: 'markdown' as const } }]) {
      expect(() => jobCompletion(f.job, manifest)).toThrow('Invalid checkpoint input');
    }
    vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, undefined, () => ({ acquire: async () => f.manifest }));
    expect(f.repo.finish).not.toHaveBeenCalled();
  });
  it('preserves selection on cancellation and reports OCR failures without retry or success', async () => {
    const f = fixture(); const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(canceled.materials[0].status).toBe('pending'); expect(applyEvent(canceled, jobCompletion(f.job, f.manifest))).toBe(canceled);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, undefined,
      () => ({ acquire: async () => { throw new CreationStorageError('INVALID_INPUT', 'Supply OCR text'); } }));
    expect(f.repo.retry).not.toHaveBeenCalled(); expect(f.repo.checkpoint).not.toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenCalledWith(f.job, expect.objectContaining({ type: 'operation_failed', error: expect.objectContaining({ message: 'Supply OCR text', retryable: false }) }));
  });
  it('authorizes owned commands, replays lost responses and enforces revision guards', async () => {
    const f = fixture(); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const repository = { create: vi.fn(async () => stored), load: vi.fn(async (owner: string) => owner === 'owner' ? stored : null), swap: vi.fn(async () => false) };
    const service = new DraftService(repository, { enqueue, cancel: vi.fn(async () => true) });
    await expect(service.command('other', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await service.command('owner', draftId, stored.revision, f.command);
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    await expect(service.command('owner', draftId, f.own.revision, { ...f.command, requestId: randomUUID() })).rejects.toBeInstanceOf(DraftConflict);
    expect(() => applyCommand(f.running, { ...f.command, requestId: randomUUID() })).toThrow('Starting point');
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { webMaterialManifestSchema, retainedWebCheckpointSchema } from '@/src/shared/cohort-creation/web';
import { WEB_PARSER_VERSION, webExtractionVersion, webExtractionFingerprint, webReceiptFingerprint } from '../materials/web-identity';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion, validateWebRetention } from '../job-completion';
import type { ClaimedWebJob, CreationJobRepository } from '../durable-job';
import { DraftService, DraftConflict, DraftNotFound } from '../draft.service';
import { draftHandlers } from '../draft.http';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const command = { type: 'acquire_web' as const, materialId: randomUUID(), requestId: randomUUID(), url: 'https://docs.example.com/lesson' };
  const running = applyCommand(own, command);
  const raw = { id: randomUUID(), kind: 'upload' as const, byteLength: 100, checksum: 'a'.repeat(64) };
  const receiptArtifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: 'b'.repeat(64) };
  const receipt = { schemaVersion: 1 as const, materialId: command.materialId, inputRevision: running.inputRevision,
    requestedUrl: command.url, finalUrl: command.url, redirects: [], mediaType: 'text/html' as const, retainedSource: raw,
    fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' as const };
  const retained = retainedWebCheckpointSchema.parse({ phase: 'retained_web', receipt, receiptArtifact, receiptFingerprint: webReceiptFingerprint(receipt) });
  const artifact = { ...receiptArtifact, id: randomUUID(), checksum: 'c'.repeat(64) };
  const manifest = webMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: running.inputRevision,
    source: { ...running.materials[0], status: 'ready', selectedUnitIds: [command.materialId] }, retainedSource: raw,
    extraction: { materialId: command.materialId, version: webExtractionVersion(raw.checksum), checksum: raw.checksum,
      artifactRef: artifact.id, extractionKind: 'text', segmentCount: 2, complete: true, selectionScope: 'main_article' },
    extractionArtifact: artifact, parserVersion: WEB_PARSER_VERSION, inputFingerprint: webExtractionFingerprint(receipt),
    acquiredAt: new Date().toISOString(), receipt, receiptArtifact, receiptFingerprint: retained.receiptFingerprint });
  const job: ClaimedWebJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'acquire_web',
    input: { requestId: command.requestId, inputRevision: running.inputRevision, source: running.materials[0] },
    requestId: command.requestId, inputRevision: running.inputRevision, inputFingerprint: 'job-fingerprint',
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 120_000), checkpoint: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(), heartbeat: vi.fn(async () => true),
    checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  return { own, command, running, retained, manifest, job, repo };
}
describe('durable web acquisition', () => {
  it('checkpoints captured response before extraction and never reserves AI calls', async () => {
    const f = fixture(); const recommend = vi.fn(); const extract = vi.fn();
    const acquire = vi.fn(async (_scope, _source, _revision, _signal, checkpoint) => { await checkpoint(f.retained); return f.manifest; });
    await executeCreationJob(f.repo, f.job, () => ({ recommend }), new AbortController().signal, undefined, () => ({ acquire, extract }));
    expect(f.repo.checkpoint).toHaveBeenNthCalledWith(1, f.job, f.retained); expect(f.repo.checkpoint).toHaveBeenNthCalledWith(2, f.job, f.manifest);
    expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.manifest));
    expect(recommend).not.toHaveBeenCalled(); expect(f.repo.reserveModelCall).not.toHaveBeenCalled();
  });
  it('restarts from retained checkpoint without another network fetch', async () => {
    const f = fixture(); f.job.checkpoint = f.retained;
    const acquire = vi.fn(); const extract = vi.fn(async () => f.manifest);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, () => ({ acquire, extract }));
    expect(acquire).not.toHaveBeenCalled(); expect(extract).toHaveBeenCalledWith({ ownerId: 'owner', draftId }, f.job.input.source,
      f.job.inputRevision, f.retained.receiptArtifact, f.retained.receiptFingerprint, expect.any(AbortSignal));
  });
  it('recovers a complete manifest even after the operation deadline', async () => {
    const f = fixture(); f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0); const factory = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, factory);
    expect(factory).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledOnce();
  });
  it('stops extraction when retained checkpoint fencing fails', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false); const after = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, () => ({
      acquire: async (_scope, _source, _revision, _signal, checkpoint) => { await checkpoint!(f.retained); after(); return f.manifest; }, extract: vi.fn(),
    }));
    expect(after).not.toHaveBeenCalled(); expect(f.repo.finish).not.toHaveBeenCalled();
  });
  it('validates source/revision/parser/fingerprint and rejects stale completion', () => {
    const f = fixture(); expect(() => validateWebRetention(f.job, { ...f.retained, receiptFingerprint: 'd'.repeat(64) })).toThrow('Invalid checkpoint input');
    expect(() => jobCompletion(f.job, { ...f.manifest, parserVersion: 'unknown' })).toThrow('Invalid checkpoint input');
    const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    expect(ready.materialRefs[0].ids).toHaveLength(3); expect(ready.extractions[0].selectionScope).toBe('main_article');
    const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(applyEvent(canceled, jobCompletion(f.job, f.manifest))).toBe(canceled);
    const removed = applyCommand(ready, { type: 'remove_material', materialId: f.command.materialId }); expect(removed.materialRefs).toEqual([]);
  });
  it('authorizes URL commands, normalizes provenance and handles duplicate/stale requests', async () => {
    const f = fixture(); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(), swap: vi.fn(), load: async owner => owner === 'owner' ? stored : null }, { enqueue, cancel: vi.fn() });
    const revision = stored.revision;
    const input = { ...f.command, url: `${f.command.url}#section` };
    await expect(service.command('other', draftId, revision, input)).rejects.toBeInstanceOf(DraftNotFound);
    await service.command('owner', draftId, revision, input);
    expect(stored.materials[0].input).toEqual({ kind: 'url', url: f.command.url });
    expect(await service.command('owner', draftId, revision, input)).toEqual(stored); expect(enqueue).toHaveBeenCalledOnce();
    await expect(service.command('owner', draftId, revision, { ...input, requestId: randomUUID() })).rejects.toBeInstanceOf(DraftConflict);
  });
  it('rejects unsafe URL commands and unauthenticated access through the existing API', async () => {
    const f = fixture(); const enqueue = vi.fn();
    const service = new DraftService({ create: vi.fn(), swap: vi.fn(), load: async () => f.own }, { enqueue, cancel: vi.fn() });
    const input = () => new Request('https://example.test/api', { method: 'PATCH', body: JSON.stringify({ baseRevision: f.own.revision,
      command: { ...f.command, url: 'https://127.0.0.1/secret' } }) });
    expect((await draftHandlers(service, async () => 'owner')(input(), draftId)).status).toBe(400);
    expect((await draftHandlers(service, async () => null)(input(), draftId)).status).toBe(401); expect(enqueue).not.toHaveBeenCalled();
  });
});

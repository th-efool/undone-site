import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { githubSelectionSchema, retainedGithubCheckpointSchema, githubMaterialManifestSchema, GITHUB_PARSER_VERSION } from '@/src/shared/cohort-creation/github';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { ClaimedGithubJob, CreationJobRepository } from '../durable-job';
import type { GithubAcquisitionService } from '../materials/github-acquisition.service';
import { githubExtractionVersion, githubReceiptFingerprint, githubUnitId } from '../materials/github-extraction';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion, validateGithubRetention } from '../job-completion';
import { DraftConflict, DraftNotFound, DraftService } from '../draft.service';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId: result.requestId,
    query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const selection = githubSelectionSchema.parse({ url: 'https://github.com/Example/Lessons', paths: ['README.md'] });
  const command = { type: 'acquire_github' as const, materialId: randomUUID(), requestId: randomUUID(), selection };
  const running = applyCommand(own, command); const artifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'a'.repeat(64) };
  const retained = retainedGithubCheckpointSchema.parse({ phase: 'retained_github', materialId: command.materialId,
    inputRevision: running.inputRevision, selection, commit: 'b'.repeat(40), files: [{ path: 'README.md', blobSha: 'c'.repeat(40), byteLength: 200 }],
    artifact, inputFingerprint: githubReceiptFingerprint(command.materialId, running.inputRevision, selection) });
  const version = githubExtractionVersion(artifact.checksum); const extraction = { id: randomUUID(), kind: 'artifact' as const, byteLength: 2000, checksum: 'd'.repeat(64) };
  const manifest = githubMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: running.inputRevision,
    source: { ...running.materials[0], status: 'ready', selectedUnitIds: [githubUnitId(retained.commit, 'README.md')] }, retainedSource: artifact,
    extraction: { materialId: command.materialId, version, checksum: artifact.checksum, artifactRef: extraction.id, extractionKind: 'text',
      complete: true, selectionScope: 'selected_paths', segmentCount: 1 }, extractionArtifact: extraction,
    parserVersion: GITHUB_PARSER_VERSION, inputFingerprint: version, acquiredAt: new Date().toISOString(), github: retained });
  const job: ClaimedGithubJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'acquire_github', requestId: command.requestId,
    inputRevision: running.inputRevision, inputFingerprint: 'fingerprint', input: { requestId: command.requestId, inputRevision: running.inputRevision, maxUnits: 100, source: running.materials[0] },
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 360_000), checkpoint: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(async () => true),
    reserveModelCall: vi.fn(), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  return { own, command, running, job, repo, retained, manifest };
}
describe('durable selected GitHub material', () => {
  it('persists explicit scope, authorizes/CAS/deduplicates commands and canonicalizes repository roots', async () => {
    const f = fixture(); let stored = f.own; const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel: vi.fn() });
    await expect(service.command('other', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    await service.command('owner', draftId, stored.revision, { ...f.command, selection: { ...f.command.selection, url: `${f.command.selection.url}.git` } });
    expect(stored.materials[0].input).toEqual({ kind: 'url', url: f.command.selection.url, repositoryScope: { ref: null, paths: ['README.md'] } });
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(stored))).materials[0].input).toEqual(stored.materials[0].input);
  });
  it('checkpoints a private source before final extraction without AI or raw body exposure', async () => {
    const f = fixture(); const acquire = vi.fn<GithubAcquisitionService['acquire']>(async (...args) => { await args[5]?.(f.retained); return f.manifest; });
    const extract = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract }));
    expect(f.repo.reserveModelCall).not.toHaveBeenCalled(); expect(extract).not.toHaveBeenCalled();
    expect(f.repo.checkpoint).toHaveBeenNthCalledWith(1, f.job, f.retained); expect(f.repo.checkpoint).toHaveBeenNthCalledWith(2, f.job, f.manifest);
    const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    expect(ready.materials[0].status).toBe('ready'); expect(ready.materialRefs[0].ids).toEqual([f.retained.artifact.id, f.manifest.extractionArtifact.id]);
    expect(ready.extractions[0].selectionScope).toBe('selected_paths');
    expect(applyCommand(ready, { type: 'remove_material', materialId: f.command.materialId }).materialRefs).toEqual([]);
  });
  it('resumes retained source checkpoints without refetching and final checkpoints after deadline', async () => {
    const f = fixture(); f.job.checkpoint = f.retained; const acquire = vi.fn(); const extract = vi.fn(async () => f.manifest);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract }));
    expect(acquire).not.toHaveBeenCalled(); expect(extract).toHaveBeenCalledOnce(); expect(f.repo.finish).toHaveBeenCalledOnce();
    f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0); extract.mockClear();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract }));
    expect(extract).not.toHaveBeenCalled();
  });
  it('rejects stale source revisions, scope changes, forged units and capacity overflow', () => {
    const f = fixture(); expect(() => validateGithubRetention(f.job, { ...f.retained, inputRevision: 0 })).toThrow('checkpoint input');
    expect(() => jobCompletion(f.job, { ...f.manifest, source: { ...f.manifest.source, selectedUnitIds: ['invented'] } })).toThrow('checkpoint input');
    expect(() => jobCompletion(f.job, { ...f.manifest, source: { ...f.manifest.source,
      input: { kind: 'url', url: f.command.selection.url, repositoryScope: { ref: 'other', paths: ['README.md'] } } } })).toThrow('checkpoint input');
    const full = creationSnapshotSchema.parse({ ...f.own, materials: [{ id: randomUUID(), kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() },
      status: 'pending', selectedUnitIds: Array.from({ length: 100 }, (_, index) => `unit${index}`) }] });
    expect(() => applyCommand(full, f.command)).toThrow('100 selected units');
  });
  it('rejects failed checkpoint fences and ignores canceled late results', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    const acquire = vi.fn<GithubAcquisitionService['acquire']>(async (...args) => { await args[5]?.(f.retained); return f.manifest; });
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract: vi.fn() }));
    expect(f.repo.finish).not.toHaveBeenCalled();
    const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(applyEvent(canceled, jobCompletion(f.job, f.manifest))).toBe(canceled);
  });
});

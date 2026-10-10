import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { notionMaterialManifestSchema, retainedNotionCheckpointSchema, NOTION_PARSER_VERSION } from '@/src/shared/cohort-creation/notion';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { ClaimedNotionJob, CreationJobRepository } from '../durable-job';
import type { NotionAcquisitionService } from '../materials/notion-acquisition.service';
import { notionExtractionVersion, notionReceiptFingerprint, notionUnitId } from '../materials/notion-extraction';
import { executeCreationJob } from '../durable-job.runner';
import { jobCompletion, validateNotionRetention } from '../job-completion';
import { DraftConflict, DraftNotFound, DraftService } from '../draft.service';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId: result.requestId,
    query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const pageId = randomUUID(); const url = `https://www.notion.so/${pageId.replaceAll('-', '')}`;
  const command = { type: 'acquire_notion' as const, materialId: randomUUID(), requestId: randomUUID(), url };
  const running = applyCommand(own, command); const artifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'a'.repeat(64) };
  const retained = retainedNotionCheckpointSchema.parse({ phase: 'retained_notion', materialId: command.materialId,
    inputRevision: running.inputRevision, pageId, pageEditedAt: new Date().toISOString(), unitId: notionUnitId(pageId), blockCount: 2, textBytes: 200,
    artifact, inputFingerprint: notionReceiptFingerprint(command.materialId, running.inputRevision, pageId) });
  const version = notionExtractionVersion(artifact.checksum); const extraction = { id: randomUUID(), kind: 'artifact' as const, byteLength: 2000, checksum: 'd'.repeat(64) };
  const manifest = notionMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: running.inputRevision,
    source: { ...running.materials[0], status: 'ready', selectedUnitIds: [retained.unitId] }, retainedSource: artifact,
    extraction: { materialId: command.materialId, version, checksum: artifact.checksum, artifactRef: extraction.id, extractionKind: 'text',
      complete: true, selectionScope: 'supported_page_text', segmentCount: 1 }, extractionArtifact: extraction,
    parserVersion: NOTION_PARSER_VERSION, inputFingerprint: version, acquiredAt: new Date().toISOString(), notion: retained });
  const job: ClaimedNotionJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'acquire_notion', requestId: command.requestId,
    inputRevision: running.inputRevision, inputFingerprint: 'fingerprint', input: { requestId: command.requestId, inputRevision: running.inputRevision, maxUnits: 100, source: running.materials[0] },
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 360_000), checkpoint: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(async () => true),
    reserveModelCall: vi.fn(), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  return { own, command, running, job, repo, retained, manifest, pageId };
}

describe('durable owner-scoped Notion acquisition', () => {
  it('authorizes, checks revisions, canonicalizes and deduplicates a selected page command', async () => {
    const f = fixture(); let stored = f.own; const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel: vi.fn() });
    await expect(service.command('other', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await expect(service.command('owner', draftId, stored.revision - 1, f.command)).rejects.toBeInstanceOf(DraftConflict);
    await expect(service.command('owner', draftId, stored.revision, { ...f.command, url: 'https://example.test/private' })).rejects.toThrow('notion.so');
    await service.command('owner', draftId, stored.revision, { ...f.command, url: `https://notion.so/Lesson-${f.pageId.replaceAll('-', '')}?pvs=4` });
    expect(stored.materials[0].input).toEqual({ kind: 'url', url: f.command.url });
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    expect(creationSnapshotSchema.parse(JSON.parse(JSON.stringify(stored))).materials).toEqual(stored.materials);
  });
  it('checkpoints retained source before completing extraction without model calls', async () => {
    const f = fixture(); const acquire = vi.fn<NotionAcquisitionService['acquire']>(async (...args) => { await args[4]?.(f.retained); return f.manifest; });
    const extract = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract }));
    expect(f.repo.reserveModelCall).not.toHaveBeenCalled(); expect(extract).not.toHaveBeenCalled();
    expect(f.repo.checkpoint).toHaveBeenNthCalledWith(1, f.job, f.retained); expect(f.repo.checkpoint).toHaveBeenNthCalledWith(2, f.job, f.manifest);
    const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    expect(ready.materials[0].status).toBe('ready'); expect(ready.materialRefs[0].ids).toEqual([f.retained.artifact.id, f.manifest.extractionArtifact.id]);
    expect(ready.extractions[0].selectionScope).toBe('supported_page_text');
    expect(applyCommand(ready, { type: 'remove_material', materialId: f.command.materialId }).materialRefs).toEqual([]);
  });
  it('recovers retained checkpoints without refetch and final checkpoints even after deadline', async () => {
    const f = fixture(); f.job.checkpoint = f.retained; const acquire = vi.fn(); const extract = vi.fn(async () => f.manifest);
    const run = () => executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract }));
    await run(); expect(acquire).not.toHaveBeenCalled(); expect(extract).toHaveBeenCalledOnce();
    f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0); extract.mockClear(); await run();
    expect(extract).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledTimes(2);
  });
  it('rejects forged page/revision/version checkpoints and global capacity overflow', () => {
    const f = fixture();
    expect(() => validateNotionRetention(f.job, { ...f.retained, pageId: randomUUID() })).toThrow();
    expect(() => validateNotionRetention(f.job, { ...f.retained, inputRevision: f.retained.inputRevision + 1 })).toThrow();
    expect(() => jobCompletion(f.job, { ...f.manifest, inputFingerprint: 'e'.repeat(64) })).toThrow();
    const full = creationSnapshotSchema.parse({ ...f.own, materials: [{ id: randomUUID(), kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() },
      status: 'pending', selectedUnitIds: Array.from({ length: 100 }, (_, index) => `unit${index}`) }] });
    expect(() => applyCommand(full, f.command)).toThrow('100 selected units');
  });
  it('does not complete after a failed checkpoint fence or accept a canceled late result', async () => {
    const f = fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    const acquire = vi.fn<NotionAcquisitionService['acquire']>(async (...args) => { await args[4]?.(f.retained); return f.manifest; });
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, () => ({ acquire, extract: vi.fn() }));
    expect(f.repo.finish).not.toHaveBeenCalled();
    const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(applyEvent(canceled, jobCompletion(f.job, f.manifest))).toBe(canceled);
  });
});

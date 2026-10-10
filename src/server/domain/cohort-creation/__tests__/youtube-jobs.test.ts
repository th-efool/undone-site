import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { retainedYoutubeMetadataSchema, YOUTUBE_METADATA_VERSION } from '@/src/shared/cohort-creation/youtube';
import { youtubeMetadataFingerprint } from '../materials/youtube-artifacts';
import { executeCreationJob } from '../durable-job.runner';
import type { ClaimedYoutubeInspectionJob, CreationJobRepository } from '../durable-job';
import { jobCompletion } from '../job-completion';
import { DraftConflict, DraftNotFound, DraftService } from '../draft.service';

function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations',
    requestId: result.requestId, query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const command = { type: 'inspect_youtube' as const, requestId: randomUUID(), materialId: randomUUID(), url };
  const running = applyCommand(own, command);
  const retained = retainedYoutubeMetadataSchema.parse({ receipt: { schemaVersion: 1, materialId: command.materialId,
    inputRevision: running.inputRevision, parserVersion: YOUTUBE_METADATA_VERSION, metadata: { schemaVersion: 1, kind: 'youtube_video', playlistId: null,
      sourceUrl: url, fetchedAt: new Date().toISOString(), coverage: 'complete_metadata', units: [{ videoId: 'dQw4w9WgXcQ', url,
        title: 'Lighting lesson', description: 'Provider description not source content', channelId: 'channel', channelTitle: 'Teacher',
        publishedAt: '2026-01-01T00:00:00Z', etag: 'etag', privacy: 'public', durationSeconds: 120 }] } },
    artifact: { id: randomUUID(), kind: 'artifact', byteLength: 1500, checksum: 'a'.repeat(64) }, inputFingerprint: youtubeMetadataFingerprint(command.materialId, running.inputRevision, url) });
  const job: ClaimedYoutubeInspectionJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'inspect_youtube',
    input: { requestId: command.requestId, inputRevision: running.inputRevision, source: running.materials[0] },
    requestId: command.requestId, inputRevision: running.inputRevision, inputFingerprint: 'fingerprint',
    status: 'running', attempt: 1, leaseToken: randomUUID(), deadlineAt: new Date(Date.now() + 120_000),
    checkpoint: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(),
    heartbeat: vi.fn(async () => true), checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true),
    retry: vi.fn(async () => false), release: vi.fn() };
  return { own, command, running, retained, job, repo };
}
describe('durable YouTube metadata inspection', () => {
  it('retains metadata without AI or extracted-content success and persists bounded previews', async () => {
    const f = fixture(); const recommend = vi.fn(); const retainMetadata = vi.fn(async () => f.retained);
    await executeCreationJob(f.repo, f.job, () => ({ recommend }), new AbortController().signal, undefined, undefined, undefined, () => ({ retainMetadata }));
    expect(recommend).not.toHaveBeenCalled(); expect(f.repo.reserveModelCall).not.toHaveBeenCalled();
    expect(vi.mocked(f.repo.checkpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.repo.finish).mock.invocationCallOrder[0]);
    const ready = applyEvent(f.running, jobCompletion(f.job, f.retained));
    const resumed = creationSnapshotSchema.parse(JSON.parse(JSON.stringify(ready)));
    expect(resumed.materials[0].status).toBe('needs_input'); expect(resumed.extractions).toEqual([]);
    expect(resumed.youtubeSources[0].units).toEqual([{ unitId: 'dQw4w9WgXcQ', title: 'Lighting lesson', durationSeconds: 120 }]);
    expect(JSON.stringify(resumed)).not.toContain('Provider description not source content');
    expect(resumed.materialRefs[0].ids).toEqual([f.retained.artifact.id]);
  });
  it('recovers a complete receipt after its deadline without another metadata request', async () => {
    const f = fixture(); f.job.checkpoint = f.retained; f.job.deadlineAt = new Date(0); const retainMetadata = vi.fn();
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, undefined, undefined, () => ({ retainMetadata }));
    expect(retainMetadata).not.toHaveBeenCalled(); expect(f.repo.finish).toHaveBeenCalledWith(f.job, jobCompletion(f.job, f.retained));
  });
  it('refuses stale identities, late cancellation results and failed checkpoint fences', async () => {
    const f = fixture();
    expect(() => jobCompletion(f.job, { ...f.retained, inputFingerprint: 'b'.repeat(64) })).toThrow('Invalid checkpoint');
    expect(() => jobCompletion(f.job, { ...f.retained, receipt: { ...f.retained.receipt, inputRevision: 0 } })).toThrow('Invalid checkpoint');
    const canceled = applyCommand(f.running, { type: 'cancel_material_acquisition' });
    expect(applyEvent(canceled, jobCompletion(f.job, f.retained))).toBe(canceled);
    vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await executeCreationJob(f.repo, f.job, () => ({ recommend: vi.fn() }), new AbortController().signal, undefined, undefined, undefined, () => ({ retainMetadata: async () => f.retained }));
    expect(f.repo.finish).not.toHaveBeenCalled();
  });
  it('removes/replaces only the source preview and rejects dangling preview refs', () => {
    const f = fixture(); const ready = applyEvent(f.running, jobCompletion(f.job, f.retained));
    expect(applyCommand(ready, { type: 'remove_material', materialId: f.command.materialId }).youtubeSources).toEqual([]);
    expect(applyCommand(ready, { type: 'acquire_text', materialId: f.command.materialId, assetId: randomUUID(), requestId: randomUUID() }).youtubeSources).toEqual([]);
    expect(applyCommand(ready, { type: 'request_recommendations', query: 'Another learning goal', requestId: randomUUID() }).youtubeSources).toEqual([]);
    expect(creationSnapshotSchema.safeParse({ ...ready, materialRefs: [] }).success).toBe(false);
    const { youtubeSources, ...old } = f.own; expect(youtubeSources).toEqual([]); expect(creationSnapshotSchema.parse(old).youtubeSources).toEqual([]);
  });
  it('normalizes owned URLs and enforces CAS, deduplication and strict source validation', async () => {
    const f = fixture(); let stored = f.own;
    const enqueue = vi.fn(async (_owner, _previous, next) => { stored = next; return next; });
    const service = new DraftService({ create: vi.fn(async () => stored), load: vi.fn(async owner => owner === 'owner' ? stored : null), swap: vi.fn() }, { enqueue, cancel: vi.fn() });
    await expect(service.command('other', draftId, stored.revision, f.command)).rejects.toBeInstanceOf(DraftNotFound);
    await service.command('owner', draftId, stored.revision, { ...f.command, url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(stored.materials[0].input).toEqual({ kind: 'url', url: f.command.url });
    expect(await service.command('owner', draftId, f.own.revision, f.command)).toBe(stored); expect(enqueue).toHaveBeenCalledOnce();
    await expect(service.command('owner', draftId, f.own.revision, { ...f.command, requestId: randomUUID() })).rejects.toBeInstanceOf(DraftConflict);
    await expect(service.command('owner', draftId, stored.revision, { ...f.command, url: 'https://youtube.com.attacker.com/watch?v=dQw4w9WgXcQ' })).rejects.toThrow('public HTTPS YouTube');
  });
});

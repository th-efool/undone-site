import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('server-only', () => ({}));
import { youtubeMetadataSchema } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError, type CreationObjectRef, type StorageScope, type ArtifactOptions } from '@/src/server/infrastructure/storage/creation.contracts';
import { YoutubeObservationService } from '../materials/youtube-observation.service';
import { youtubeObservationArtifactSchema } from '../materials/youtube-artifacts';

function fixture() {
  const videoId = 'dQw4w9WgXcQ'; const scope = { ownerId: 'owner', draftId: randomUUID() };
  const metadata = youtubeMetadataSchema.parse({ schemaVersion: 1, kind: 'youtube_video', playlistId: null,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`, fetchedAt: new Date().toISOString(), coverage: 'complete_metadata',
    units: [{ videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: 'Lighting lesson', description: 'Provider description',
      channelId: 'channel', channelTitle: 'Teacher', publishedAt: '2026-01-01T00:00:00Z', etag: 'etag', privacy: 'public', durationSeconds: 120 }] });
  const source = { id: randomUUID(), kind: 'youtube_video' as const, input: { kind: 'url' as const, url: metadata.sourceUrl }, selectedUnitIds: [], status: 'acquiring' as const };
  const read = vi.fn(async () => metadata);
  const observeVideo = vi.fn(async () => ({ canObserve: true, observations: [{ startSeconds: 10, endSeconds: 90, text: 'Observed lighting techniques and reflectance.' }], limitations: ['Small text is unclear.'] }));
  const observer = { identity: { provider: 'fixture-provider', modelId: 'fixture-model', adapterVersion: 'fixture-v1' }, observeVideo };
  const stored = new Map<string, { scope: StorageScope; ref: CreationObjectRef; value: unknown; type: string; fingerprint: string }>();
  const putJSON = async <T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) => {
    const parsed = options.schema.parse(value); const bytes = Buffer.from(JSON.stringify(parsed));
    const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', byteLength: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') };
    stored.set(ref.id, { scope: owner, ref, value: structuredClone(parsed), type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
  };
  const owned = (owner: StorageScope, id: string) => {
    const row = stored.get(id);
    if (!row || row.scope.ownerId !== owner.ownerId || row.scope.draftId !== owner.draftId) throw new CreationStorageError('NOT_FOUND', 'Artifact not found');
    return row;
  };
  const getJSON = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    const row = owned(owner, id);
    if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Artifact contract mismatch');
    return options.schema.parse(structuredClone(row.value)) as z.output<T>;
  };
  const ref = async (owner: StorageScope, id: string) => owned(owner, id).ref;
  return { scope, source, metadata, read, observeVideo, observer, stored, service: new YoutubeObservationService({ read }, observer, { putJSON, getJSON, ref }) };
}
describe('owned retained YouTube observations', () => {
  it('retains actual metadata and AI interpretation with immutable model/source/page-independent video provenance', async () => {
    const f = fixture(); const retained = await f.service.retainMetadata(f.scope, f.source, 5);
    expect(retained.receipt.metadata).toEqual(f.metadata); expect(f.source.status).toBe('acquiring');
    const observed = await f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, new AbortController().signal);
    expect(observed.observation.extractionKind).toBe('video_observation'); expect(observed.observation.contentOrigin).toBe('ai');
    expect(observed.observation.model).toEqual(f.observer.identity); expect(observed.observation.coverage.exhaustive).toBe(false);
    expect(observed.observation.metadataArtifact).toEqual(retained.artifact);
    expect(observed.observation.segments[0].location.anchor).toEqual({ kind: 'video', startSeconds: 10, endSeconds: 90, estimated: true });
    expect(f.stored.size).toBe(2); expect(f.read).toHaveBeenCalledOnce(); expect(f.observeVideo).toHaveBeenCalledOnce();
    const resumed = await f.service.resumeUnit(f.scope, observed.artifact, observed.inputFingerprint, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId);
    expect(resumed).toEqual(observed); expect(f.read).toHaveBeenCalledOnce(); expect(f.observeVideo).toHaveBeenCalledOnce();
  });
  it('rejects foreign owners, stale source revisions, forged refs and unselected units before AI', async () => {
    const f = fixture(); const retained = await f.service.retainMetadata(f.scope, f.source, 5); const signal = new AbortController().signal;
    await expect(f.service.observeUnit({ ...f.scope, ownerId: 'other' }, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 6, f.metadata.units[0].videoId, signal)).rejects.toThrow('revision');
    await expect(f.service.observeUnit(f.scope, { ...retained.artifact, checksum: 'a'.repeat(64) }, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, signal)).rejects.toThrow('reference');
    await expect(f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 5, 'AAAAAAAAAAA', signal)).rejects.toThrow('Select a video');
    expect(f.observeVideo).not.toHaveBeenCalled(); expect(f.stored.size).toBe(1);
  });
  it('refuses invalid model output, unsupported source identity and cancellation without writing successful artifacts', async () => {
    const f = fixture();
    await expect(f.service.retainMetadata(f.scope, { ...f.source, kind: 'web' }, 5)).rejects.toThrow('kind');
    const retained = await f.service.retainMetadata(f.scope, f.source, 5);
    f.observeVideo.mockResolvedValueOnce({ canObserve: true, observations: [{ startSeconds: 10, endSeconds: 900, text: 'Impossible range' }], limitations: [] });
    await expect(f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, new AbortController().signal)).rejects.toThrow('out-of-duration');
    const stop = new AbortController(); stop.abort(new Error('stop'));
    await expect(f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, stop.signal)).rejects.toThrow('stop');
    expect(f.stored.size).toBe(1);
  });
  it('rejects altered anchors, coverage, model identity and source references on artifact validation/resume', async () => {
    const f = fixture(); const retained = await f.service.retainMetadata(f.scope, f.source, 5);
    const output = await f.service.observeUnit(f.scope, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId, new AbortController().signal);
    const altered = structuredClone(output.observation); altered.segments[0].text = 'Invented replacement';
    expect(youtubeObservationArtifactSchema.safeParse(altered).success).toBe(false);
    altered.segments = output.observation.segments; altered.coverage.unobservedRanges = [];
    expect(youtubeObservationArtifactSchema.safeParse(altered).success).toBe(false);
    altered.coverage = output.observation.coverage; altered.model.modelId = 'other-model';
    expect(youtubeObservationArtifactSchema.safeParse(altered).success).toBe(false);
    await expect(f.service.resumeUnit(f.scope, output.artifact, output.inputFingerprint, retained.artifact, retained.inputFingerprint, f.source.id, 5, 'AAAAAAAAAAA')).rejects.toThrow('does not match');
    await expect(f.service.resumeUnit({ ...f.scope, ownerId: 'other' }, output.artifact, output.inputFingerprint, retained.artifact, retained.inputFingerprint, f.source.id, 5, f.metadata.units[0].videoId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

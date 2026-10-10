import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('server-only', () => ({}));
import { githubSnapshotSchema, githubExtractionArtifactSchema, type RetainedGithubCheckpoint } from '@/src/shared/cohort-creation/github';
import { GithubAcquisitionService } from '../materials/github-acquisition.service';
import { extractGithubReceipt } from '../materials/github-extraction';
import { CreationStorageError, type ArtifactOptions, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

function fixture() {
  const text = '# Lesson\r\nLighting 😀\r\n```ts\r\nconst value = 1;\r\n```\r\n'; const bytes = Buffer.from(text);
  const snapshot = githubSnapshotSchema.parse({ schemaVersion: 1, sourceUrl: 'https://github.com/Example/Lessons', owner: 'Example', repo: 'Lessons',
    commit: 'a'.repeat(40), tree: 'b'.repeat(40), requestedPaths: ['README.md'], fetchedAt: new Date().toISOString(), access: 'public',
    files: [{ path: 'README.md', blobSha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), byteLength: bytes.length, text }],
    skipped: [], coverage: 'selected_paths' });
  const selection = { url: snapshot.sourceUrl, ref: null, paths: snapshot.requestedPaths };
  const source = { id: randomUUID(), kind: 'github' as const, input: { kind: 'url' as const, url: snapshot.sourceUrl }, selectedUnitIds: [], status: 'acquiring' as const };
  const scope = { ownerId: 'owner', draftId: randomUUID() }; const read = vi.fn(async () => snapshot);
  const rows = new Map<string, { scope: StorageScope; value: unknown; ref: CreationObjectRef; type: string; fingerprint: string }>();
  const putJSON = async <T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) => {
    const parsed = options.schema.parse(value); const body = Buffer.from(JSON.stringify(parsed));
    const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', byteLength: body.length, checksum: createHash('sha256').update(body).digest('hex') };
    rows.set(ref.id, { scope: owner, value: parsed, ref, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
  };
  const owned = (owner: StorageScope, id: string) => {
    const row = rows.get(id);
    if (!row || owner.ownerId !== row.scope.ownerId || owner.draftId !== row.scope.draftId) throw new CreationStorageError('NOT_FOUND', 'Source artifact not found.');
    return row;
  };
  const getJSON = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    const row = owned(owner, id);
    if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Artifact contract mismatch.');
    return options.schema.parse(structuredClone(row.value)) as z.output<T>;
  };
  const ref = async (owner: StorageScope, id: string) => owned(owner, id).ref;
  return { text, snapshot, source, scope, selection, rows, read, service: new GithubAcquisitionService({ read }, { putJSON, getJSON, ref }) };
}
describe('retained GitHub content and line extraction', () => {
  it('retains connected private provenance and resumes without requesting credentials or source content again', async () => {
    const f = fixture();
    const selection = { ...f.selection, connection: 'github' as const };
    const source = { ...f.source, input: { ...f.source.input, repositoryScope: { ref: selection.ref, paths: selection.paths, connection: 'github' as const } } };
    f.read.mockResolvedValue({ ...f.snapshot, access: 'connected', repositoryPrivate: true });
    const manifest = await f.service.acquire(f.scope, source, 7, selection);
    const raw = f.rows.get(manifest.retainedSource.id)!;
    expect(raw.value).toMatchObject({ selection: { connection: 'github' }, snapshot: { access: 'connected', repositoryPrivate: true } });
    f.read.mockRejectedValue(new Error('Connection unavailable after restart'));
    const resumed = await f.service.extract(f.scope, source, 7, selection, manifest.github);
    expect(resumed.source.input).toEqual(manifest.source.input);
    expect(f.read).toHaveBeenCalledTimes(1);
    await expect(f.service.extract({ ...f.scope, ownerId: 'other' }, source, 7, selection, manifest.github)).rejects.toThrow('not found');
    await expect(f.service.extract(f.scope, source, 7, f.selection, manifest.github)).rejects.toThrow();
  });
  it('retains exact source text privately and derives deterministic commit/path/line anchors', async () => {
    const f = fixture(); const save = vi.fn(); const manifest = await f.service.acquire(f.scope, f.source, 7, f.selection, undefined, save);
    const stored = [...f.rows.values()].find(row => row.type === 'github-extraction')!;
    const extraction = githubExtractionArtifactSchema.parse(stored.value); const file = extraction.files[0];
    expect(file.text).toBe(f.text); expect(file.segments.map(segment => segment.text).join('')).toBe(f.text);
    expect(file.segments.map(segment => segment.location.anchor)).toEqual([
      { kind: 'file', commit: 'a'.repeat(40), path: 'README.md', startLine: 1, endLine: 1 },
      { kind: 'file', commit: 'a'.repeat(40), path: 'README.md', startLine: 2, endLine: 2 },
      { kind: 'file', commit: 'a'.repeat(40), path: 'README.md', startLine: 3, endLine: 5 },
    ]);
    expect(manifest.source.selectedUnitIds).toEqual([file.unitId]); expect(manifest.extraction.selectionScope).toBe('selected_paths');
    expect(manifest.extraction.complete).toBe(true); expect(f.source.status).toBe('acquiring');
    expect(JSON.stringify(save.mock.calls[0][0])).not.toContain('Lighting'); expect(JSON.stringify(manifest)).not.toContain('Lighting');
    const resumed = await f.service.extract(f.scope, f.source, 7, f.selection, manifest.github);
    expect(resumed.extraction.version).toBe(manifest.extraction.version); expect(f.read).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });
  it('waits for a fenced receipt checkpoint before extraction and resumes without network acquisition', async () => {
    const f = fixture(); let saved: RetainedGithubCheckpoint | undefined;
    await expect(f.service.acquire(f.scope, f.source, 7, f.selection, undefined, async retained => {
      saved = retained; throw new Error('lease lost');
    })).rejects.toThrow('lease lost');
    expect(f.rows.size).toBe(1);
    await f.service.extract(f.scope, f.source, 7, f.selection, saved!);
    expect(f.rows.size).toBe(2); expect(f.read).toHaveBeenCalledOnce();
  });
  it('rejects foreign ownership, altered refs, stale revisions and changed selected paths', async () => {
    const f = fixture(); const manifest = await f.service.acquire(f.scope, f.source, 7, f.selection);
    await expect(f.service.extract({ ...f.scope, ownerId: 'foreign' }, f.source, 7, f.selection, manifest.github)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.extract(f.scope, f.source, 7, f.selection, { ...manifest.github, artifact: { ...manifest.github.artifact, checksum: 'e'.repeat(64) } })).rejects.toThrow('reference');
    await expect(f.service.extract(f.scope, f.source, 8, f.selection, manifest.github)).rejects.toThrow('reference');
    await expect(f.service.extract(f.scope, f.source, 7, { ...f.selection, paths: ['docs'] }, manifest.github)).rejects.toThrow('reference');
    expect(f.rows.size).toBe(2);
  });
  it('rejects tampered retained blob bytes and invalid extraction coverage/line anchors', async () => {
    const f = fixture(); const manifest = await f.service.acquire(f.scope, f.source, 7, f.selection);
    const raw = structuredClone([...f.rows.values()].find(row => row.type === 'github-source')!.value) as { snapshot: typeof f.snapshot };
    raw.snapshot.files[0].text = raw.snapshot.files[0].text.replace('Lesson', 'lesson');
    expect(() => extractGithubReceipt(raw, manifest.retainedSource)).toThrow('source blob');
    const extraction = githubExtractionArtifactSchema.parse([...f.rows.values()].find(row => row.type === 'github-extraction')!.value);
    extraction.files[0].segments[0].location.anchor = { kind: 'file', commit: 'a'.repeat(40), path: 'README.md', startLine: 2, endLine: 2 };
    expect(githubExtractionArtifactSchema.safeParse(extraction).success).toBe(false);
    extraction.files[0].segments[0].location.anchor = { kind: 'file', commit: 'a'.repeat(40), path: 'README.md', startLine: 1, endLine: 1 };
    extraction.files[0].segments.pop(); expect(githubExtractionArtifactSchema.safeParse(extraction).success).toBe(false);
  });
  it('rejects invalid material identity and cancellation before network or artifact writes', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.service.acquire(f.scope, f.source, 7, f.selection, controller.signal)).rejects.toThrow();
    await expect(f.service.acquire(f.scope, { ...f.source, kind: 'web' }, 7, f.selection)).rejects.toThrow('canonical GitHub');
    await expect(f.service.acquire(f.scope, f.source, -1, f.selection)).rejects.toThrow('canonical GitHub');
    expect(f.rows.size).toBe(0); expect(f.read).not.toHaveBeenCalled();
  });
  it('preserves literal file paths in anchors and rejects resume without unit capacity', async () => {
    const f = fixture(); const manifest = await f.service.acquire(f.scope, f.source, 7, f.selection);
    await expect(f.service.extract(f.scope, f.source, 7, f.selection, manifest.github, undefined, 0)).rejects.toThrow('unit capacity');
    const raw = structuredClone([...f.rows.values()].find(row => row.type === 'github-source')!.value) as {
      snapshot: typeof f.snapshot; selection: typeof f.selection;
    };
    raw.snapshot.files[0].path = ' lesson.md '; raw.snapshot.requestedPaths = [' lesson.md ']; raw.selection.paths = [' lesson.md '];
    expect(extractGithubReceipt(raw, manifest.retainedSource).files[0].segments[0].location.anchor).toMatchObject({ path: ' lesson.md ' });
  });
});

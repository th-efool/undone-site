import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('server-only', () => ({}));
import { NOTION_API_VERSION, notionSnapshotSchema, notionExtractionArtifactSchema, type RetainedNotionCheckpoint } from '@/src/shared/cohort-creation/notion';
import { NotionAcquisitionService } from '../materials/notion-acquisition.service';
import { CreationStorageError, type ArtifactOptions, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

function fixture() {
  const pageId = randomUUID(); const blockId = randomUUID(); const edited = '2026-10-10T00:00:00.000Z';
  const text = 'Lighting 😀\r\nSecond line.\n'; const sourceUrl = `https://www.notion.so/${pageId.replaceAll('-', '')}`;
  const raw = { object: 'block', id: blockId, type: 'paragraph', has_children: false, archived: false,
    last_edited_time: edited, parent: { type: 'page_id', page_id: pageId }, paragraph: { rich_text: [{ plain_text: text }] } };
  const omittedId = randomUUID();
  const snapshot = notionSnapshotSchema.parse({ schemaVersion: 1, apiVersion: NOTION_API_VERSION, pageId, sourceUrl,
    title: 'Lesson', pageEditedAt: edited, observedAt: edited, access: 'connected', coverage: 'supported_page_text',
    blocks: [{ id: blockId, parentId: pageId, depth: 1, raw, text, disposition: 'text', omission: null },
      { id: omittedId, parentId: pageId, depth: 1, raw: { ...raw, id: omittedId, type: 'image', image: { type: 'external', external: { url: 'https://example.test/private' } } },
        text: '', disposition: 'omitted', omission: 'unsupported_or_media' }] });
  const source = { id: randomUUID(), kind: 'notion' as const, input: { kind: 'url' as const, url: sourceUrl }, selectedUnitIds: [], status: 'acquiring' as const };
  const scope = { ownerId: 'owner', draftId: randomUUID() }; const read = vi.fn(async () => snapshot);
  const rows = new Map<string, { scope: StorageScope; value: unknown; ref: CreationObjectRef; type: string; fingerprint: string }>();
  const putJSON = async <T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) => {
    const parsed = options.schema.parse(value); const body = Buffer.from(JSON.stringify(parsed));
    const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', byteLength: body.length, checksum: createHash('sha256').update(body).digest('hex') };
    rows.set(ref.id, { scope: owner, value: parsed, ref, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
  };
  const owned = (owner: StorageScope, id: string) => {
    const row = rows.get(id);
    if (!row || owner.ownerId !== row.scope.ownerId || owner.draftId !== row.scope.draftId) throw new CreationStorageError('NOT_FOUND', 'Artifact not found.');
    return row;
  };
  const getJSON = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    const row = owned(owner, id);
    if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Artifact contract mismatch.');
    return options.schema.parse(structuredClone(row.value)) as z.output<T>;
  };
  const ref = async (owner: StorageScope, id: string) => owned(owner, id).ref;
  return { snapshot, text, source, scope, read, rows, service: new NotionAcquisitionService({ read }, { putJSON, getJSON, ref }) };
}

describe('private retained Notion page extraction', () => {
  it('preserves exact block text, omissions and deterministic block anchors without exposing bodies in checkpoints', async () => {
    const f = fixture(); const save = vi.fn(); const manifest = await f.service.acquire(f.scope, f.source, 3, undefined, save);
    const extraction = notionExtractionArtifactSchema.parse([...f.rows.values()].find(row => row.type === 'notion-extraction')!.value);
    expect(extraction.blocks[0].text).toBe(f.text);
    expect(extraction.blocks[0].segments.map(segment => segment.text).join('')).toBe(f.text);
    expect(extraction.blocks[0].segments.every(segment => segment.location.anchor.kind === 'block' && segment.location.anchor.blockId === f.snapshot.blocks[0].id)).toBe(true);
    expect(extraction.blocks[1]).toMatchObject({ text: '', segments: [], omission: 'unsupported_or_media' });
    expect(manifest.extraction).toMatchObject({ complete: true, selectionScope: 'supported_page_text' });
    expect(manifest.source.selectedUnitIds).toEqual([extraction.unitId]);
    expect(JSON.stringify(save.mock.calls)).not.toContain('Lighting'); expect(JSON.stringify(manifest)).not.toContain('Lighting');
    expect(f.source.status).toBe('acquiring');
    const resumed = await f.service.extract(f.scope, f.source, 3, manifest.notion);
    const next = notionExtractionArtifactSchema.parse(f.rows.get(resumed.extractionArtifact.id)!.value);
    expect(next).toEqual(extraction); expect(f.read).toHaveBeenCalledOnce();
  });
  it('checkpoints retained bytes before extraction and resumes after a failed checkpoint acknowledgement without network access', async () => {
    const f = fixture(); let saved: RetainedNotionCheckpoint | undefined;
    await expect(f.service.acquire(f.scope, f.source, 3, undefined, async value => { saved = value; throw new Error('lease lost'); })).rejects.toThrow('lease lost');
    expect(f.rows.size).toBe(1); f.read.mockRejectedValue(new Error('Connection no longer available'));
    await f.service.extract(f.scope, f.source, 3, saved!); expect(f.rows.size).toBe(2); expect(f.read).toHaveBeenCalledOnce();
  });
  it('denies another owner or draft and stale source revisions without new artifacts', async () => {
    const f = fixture(); const { notion } = await f.service.acquire(f.scope, f.source, 3);
    for (const scope of [{ ...f.scope, ownerId: 'other' }, { ...f.scope, draftId: randomUUID() }]) {
      await expect(f.service.extract(scope, f.source, 3, notion)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    await expect(f.service.extract(f.scope, f.source, 4, notion)).rejects.toMatchObject({ code: 'INTEGRITY' });
    await expect(f.service.extract(f.scope, { ...f.source, id: randomUUID() }, 3, notion)).rejects.toMatchObject({ code: 'INTEGRITY' });
    expect(f.rows.size).toBe(2);
  });
  it('rejects altered artifact metadata, unit identity and retained page observations', async () => {
    const f = fixture(); const { notion } = await f.service.acquire(f.scope, f.source, 3);
    for (const changed of [{ artifact: { ...notion.artifact, checksum: 'a'.repeat(64) } }, { artifact: { ...notion.artifact, byteLength: 1 } },
      { unitId: 'b'.repeat(64) }, { pageEditedAt: '2026-10-09T00:00:00.000Z' }, { blockCount: 1 }, { textBytes: 1 }]) {
      await expect(f.service.extract(f.scope, f.source, 3, { ...notion, ...changed })).rejects.toMatchObject({ code: 'INTEGRITY' });
    }
    expect(f.rows.size).toBe(2);
  });
  it('rejects mismatched raw projections and malformed segment provenance or coverage', async () => {
    const f = fixture(); const manifest = await f.service.acquire(f.scope, f.source, 3);
    const raw = f.rows.get(manifest.retainedSource.id)!.value as { snapshot: typeof f.snapshot };
    raw.snapshot.blocks[0].text = 'Forged';
    await expect(f.service.extract(f.scope, f.source, 3, manifest.notion)).rejects.toThrow('provenance');
    const extraction = notionExtractionArtifactSchema.parse(f.rows.get(manifest.extractionArtifact.id)!.value);
    const wrongAnchor = structuredClone(extraction); wrongAnchor.blocks[0].segments[0].location.anchor = { kind: 'block', blockId: randomUUID() };
    expect(notionExtractionArtifactSchema.safeParse(wrongAnchor).success).toBe(false);
    extraction.blocks[0].segments.pop(); expect(notionExtractionArtifactSchema.safeParse(extraction).success).toBe(false);
  });
  it('rejects unavailable capacity, invalid inputs and cancellation before source reads', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.service.acquire(f.scope, f.source, 3, controller.signal)).rejects.toThrow();
    await expect(f.service.acquire(f.scope, f.source, 3, undefined, undefined, 0)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await expect(f.service.acquire(f.scope, { ...f.source, kind: 'web' }, 3)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(f.service.acquire(f.scope, f.source, -1)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(f.read).not.toHaveBeenCalled(); expect(f.rows.size).toBe(0);
  });
  it('rejects a different observed page before writing any artifact', async () => {
    const f = fixture(); f.read.mockResolvedValue({ ...f.snapshot, pageId: randomUUID() });
    await expect(f.service.acquire(f.scope, f.source, 3)).rejects.toMatchObject({ code: 'INTEGRITY' }); expect(f.rows.size).toBe(0);
  });
});

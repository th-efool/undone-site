import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('server-only', () => ({}));
import { DiscoveryService, type DiscoveryCheckpoint } from '../discovery.service';
import { intent } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { ArtifactOptions, CreationObjectRef, StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import type { ResourceDiscovery } from '../discovery.contracts';
import type { DiscoverySourceObserver } from '../discovery-observer';

function fixture(count = 3) {
  const scope = { ownerId: 'owner', draftId: randomUUID() }; const request = { requestId: randomUUID(), inputRevision: 3, intent };
  const citations = Array.from({ length: count }, (_, index) => ({ id: `citation-${index}`, url: `https://docs.example.org/lesson-${index}`, title: 'Unverified' }));
  const search = vi.fn<ResourceDiscovery['search']>(async () => ({ citations, attribution: null, searchedAt: new Date().toISOString(), model: { provider: 'fixture', id: 'mock' } }));
  const select = vi.fn<ResourceDiscovery['select']>(async (_intent, candidates) => ({ selected: candidates.length ? [{ candidateKey: candidates[0].key, reason: 'Relevant observed metadata' }] : [] }));
  const observe = vi.fn<DiscoverySourceObserver['observe']>(async citation => ({ key: createHash('sha256').update(citation.url).digest('hex'),
    citationIds: [citation.id], url: citation.url, title: 'Observed page', kind: 'web', observedAt: new Date().toISOString(),
    observation: { method: 'public_http', requestedUrl: citation.url, redirects: [], titleOrigin: 'observed', contentRetained: false } }));
  const rows = new Map<string, { scope: StorageScope; value: unknown; ref: CreationObjectRef; type: string; fingerprint: string }>();
  const putJSON = async <T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) => {
    const parsed = options.schema.parse(value); const body = Buffer.from(JSON.stringify(parsed));
    const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', byteLength: body.length, checksum: createHash('sha256').update(body).digest('hex') };
    rows.set(ref.id, { scope: owner, value: structuredClone(parsed), ref, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
  };
  const owned = (owner: StorageScope, id: string) => {
    const row = rows.get(id);
    if (!row || row.scope.ownerId !== owner.ownerId || row.scope.draftId !== owner.draftId) throw new CreationStorageError('NOT_FOUND', 'Artifact not found');
    return row;
  };
  const getJSON = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    const row = owned(owner, id);
    if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Wrong artifact contract');
    return options.schema.parse(structuredClone(row.value)) as z.output<T>;
  };
  const ref = async (owner: StorageScope, id: string) => owned(owner, id).ref;
  return { scope, request, search, select, observe, rows, service: new DiscoveryService({ search, select }, { observe }, { putJSON, getJSON, ref }) };
}
describe('retained grounded discovery session', () => {
  it('checkpoints actual work, retains explicit failures, and resumes final selection without provider calls', async () => {
    const f = fixture(); f.observe.mockRejectedValueOnce(new CreationStorageError('UNAVAILABLE', 'private provider payload'));
    const save = vi.fn(); const result = await f.service.run(f.scope, f.request, new AbortController().signal, save);
    expect(result.checkpoint).toMatchObject({ processed: 3, total: 3 }); expect(result.candidates).toHaveLength(2);
    expect(result.failures).toHaveLength(1); expect(JSON.stringify(result.failures)).not.toContain('private provider payload');
    expect(result.selection.selected).toHaveLength(1); expect(JSON.stringify(save.mock.calls)).not.toContain('Observed page');
    const resumed = await f.service.run(f.scope, f.request, new AbortController().signal, save, result.checkpoint);
    expect(resumed).toEqual(result); expect(f.search).toHaveBeenCalledOnce(); expect(f.select).toHaveBeenCalledOnce(); expect(f.observe).toHaveBeenCalledTimes(3);
  });
  it('resumes accepted observation checkpoints without repaying search or repeating completed metadata requests', async () => {
    const f = fixture(); let saved: DiscoveryCheckpoint | undefined;
    await expect(f.service.run(f.scope, f.request, new AbortController().signal, async value => {
      saved = value; if (value.processed === 1) throw new Error('worker interrupted');
    })).rejects.toThrow('worker interrupted');
    const result = await f.service.run(f.scope, f.request, new AbortController().signal, vi.fn(), saved);
    expect(result.checkpoint.processed).toBe(3); expect(f.search).toHaveBeenCalledOnce(); expect(f.observe).toHaveBeenCalledTimes(3);
    expect(f.observe.mock.calls.map(args => args[0].id)).toEqual(['citation-0', 'citation-1', 'citation-2']);
  });
  it('denies foreign ownership, changed intent/revision and altered reference metadata on resume', async () => {
    const f = fixture(); const result = await f.service.run(f.scope, f.request, new AbortController().signal, vi.fn());
    await expect(f.service.run({ ...f.scope, ownerId: 'other' }, f.request, new AbortController().signal, vi.fn(), result.checkpoint)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const request of [{ ...f.request, inputRevision: 4 }, { ...f.request, intent: { ...intent, rawQuery: 'Another goal' } }]) {
      await expect(f.service.run(f.scope, request, new AbortController().signal, vi.fn(), result.checkpoint)).rejects.toMatchObject({ code: 'INTEGRITY' });
    }
    await expect(f.service.run(f.scope, f.request, new AbortController().signal, vi.fn(), { ...result.checkpoint,
      searchArtifact: { ...result.checkpoint.searchArtifact, checksum: 'a'.repeat(64) } })).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('rejects malformed progress, misbound candidate evidence and invented selection keys', async () => {
    const f = fixture(); f.observe.mockImplementationOnce(async citation => ({ key: 'a'.repeat(64), citationIds: ['different-citation'],
      url: citation.url, title: 'Forged', kind: 'web', observedAt: new Date().toISOString(), observation: { method: 'public_http', requestedUrl: citation.url,
        redirects: [], titleOrigin: 'observed', contentRetained: false } }));
    await expect(f.service.run(f.scope, f.request, new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'INTEGRITY' });
    const next = fixture(); next.select.mockResolvedValue({ selected: [{ candidateKey: 'a'.repeat(64), reason: 'Invented' }] });
    await expect(next.service.run(next.scope, next.request, new AbortController().signal, vi.fn())).rejects.toThrow('unavailable candidates');
    const valid = fixture(); const result = await valid.service.run(valid.scope, valid.request, new AbortController().signal, vi.fn());
    await expect(valid.service.run(valid.scope, valid.request, new AbortController().signal, vi.fn(), { ...result.checkpoint, processed: 2 })).rejects.toThrow('progress');
  });
  it('represents zero citations honestly, without metadata/selection calls or imported-content claims', async () => {
    const f = fixture(0); const result = await f.service.run(f.scope, f.request, new AbortController().signal, vi.fn());
    expect(result.checkpoint).toMatchObject({ processed: 0, total: 0 }); expect(result.candidates).toEqual([]); expect(result.selection.selected).toEqual([]);
    expect(f.observe).not.toHaveBeenCalled(); expect(f.select).not.toHaveBeenCalled(); expect(result.checkpoint.selectionArtifact).not.toBeNull();
  });
  it('exposes observation limits instead of silently truncating citation inventory', async () => {
    const f = fixture(25); const result = await f.service.run(f.scope, f.request, new AbortController().signal, vi.fn());
    expect(result.candidates).toHaveLength(20); expect(result.failures).toHaveLength(5); expect(result.failures.every(item => item.code === 'LIMIT_EXCEEDED')).toBe(true);
    expect(f.observe).toHaveBeenCalledTimes(20); expect(result.checkpoint).toMatchObject({ processed: 25, total: 25 });
  });
  it('does no work after cancellation and rejects checkpoint acknowledgement before further provider requests', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.service.run(f.scope, f.request, controller.signal, vi.fn())).rejects.toThrow(); expect(f.search).not.toHaveBeenCalled();
    await expect(f.service.run(f.scope, f.request, new AbortController().signal, async () => { throw new Error('fenced'); })).rejects.toThrow('fenced');
    expect(f.observe).not.toHaveBeenCalled(); expect(f.select).not.toHaveBeenCalled();
  });
});

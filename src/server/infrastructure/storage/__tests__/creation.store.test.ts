import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import { CreationArtifactRepository, reconcileCreationStorage } from '../creation.store';
import { CREATION_STORAGE_LIMITS as limits, CreationStorageError, type CreationStorageMetadata, type CreationStorageRecord, type CreationBlobDriver, type StorageScope } from '../creation.contracts';

const scope = { ownerId: 'owner', draftId: '10000000-0000-4000-8000-000000000001' };
const artifact = { artifactType: 'extraction', schemaVersion: 1, inputFingerprint: 'fingerprint', schema: z.strictObject({ text: z.string() }) };
const now = new Date('2026-10-09T00:00:00Z');
async function* chunks(...values: string[]) { for (const value of values) yield Buffer.from(value); }
async function collect(stream: AsyncIterable<Uint8Array>) { const parts = []; for await (const part of stream) parts.push(part); return Buffer.concat(parts).toString(); }
function fixture() {
  const rows = new Map<string, CreationStorageRecord>(); const bytes = new Map<string, Buffer>();
  let busy = false;
  function find(s: StorageScope, id: string) { const row = rows.get(id); return row?.ownerId === s.ownerId && row.draftId === s.draftId ? row : null; }
  const metadata: CreationStorageMetadata = {
    async reserve(input, max) {
      if (input.ownerId !== scope.ownerId || input.draftId !== scope.draftId) throw new CreationStorageError('NOT_FOUND', 'Missing draft');
      const used = [...rows.values()].reduce((sum, row) => sum + (row.status === 'ready' ? row.byteLength : row.reservedBytes), 0);
      if (used + input.reservedBytes > max) throw new CreationStorageError('LIMIT_EXCEEDED', 'Quota exceeded');
      rows.set(input.id, { ...input, status: 'uploading', byteLength: 0, checksum: null, createdAt: now, updatedAt: now, completedAt: null, referencedAt: null, readLeaseUntil: null, publishedAt: null, deletingToken: null });
    },
    async complete(s, id, size, checksum) { const row = find(s, id); if (!row || row.status !== 'uploading') return false; Object.assign(row, { status: 'ready', byteLength: size, checksum, completedAt: now }); return true; },
    async find(s, id) { return find(s, id); },
    async pin(s, id, published) { const row = find(s, id); if (!row || row.status !== 'ready') return false; row.referencedAt = now; if (published) row.publishedAt = now; return true; },
    async protectRead(s, id, until) { const row = find(s, id); if (!row || row.status !== 'ready') return false; row.readLeaseUntil = until; return true; },
    async claimDeletion(s, id, token, cutoff) {
      const row = find(s, id);
      if (!row || busy || row.publishedAt || row.referencedAt || (row.readLeaseUntil && row.readLeaseUntil.getTime() > Date.now()) || (cutoff && row.createdAt > cutoff)) return null;
      Object.assign(row, { status: 'deleting', deletingToken: token }); return row;
    },
    async finishDeletion(s, id, token) { const row = find(s, id); return !!row && row.deletingToken === token && rows.delete(id); },
    async candidates(date, limit) { return [...rows.values()].filter(row => date.getTime() - row.createdAt.getTime() >= (row.status === 'uploading' ? limits.incompleteAgeMs : limits.unreferencedAgeMs)).slice(0, limit); },
    async expiredDrafts() { return []; },
  };
  const blobs: CreationBlobDriver = {
    async put(row, source) { const parts = []; for await (const part of source) { parts.push(part); bytes.set(row.blobId, Buffer.concat(parts)); } },
    async read(row) { const data = bytes.get(row.blobId); if (!data) throw new Error('Missing blob'); return (async function* () { yield data; })(); },
    async delete(row) { bytes.delete(row.blobId); },
  };
  return { rows, bytes, metadata, blobs, store: new CreationArtifactRepository(metadata, blobs), setBusy(value: boolean) { busy = value; } };
}

describe('private streaming storage', () => {
  it('describes only ready owned artifact headers, never raw uploads or other owners', async () => {
    const f = fixture(); const ref = await f.store.putJSON(scope, { text: 'retained' }, artifact);
    expect(await f.store.describeArtifact(scope, ref.id)).toEqual({ ref, artifactType: artifact.artifactType, schemaVersion: 1, inputFingerprint: artifact.inputFingerprint });
    await expect(f.store.describeArtifact({ ...scope, ownerId: 'foreign' }, ref.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.store.describeArtifact({ ...scope, draftId: '20000000-0000-4000-8000-000000000002' }, ref.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const upload = await f.store.putStream(scope, chunks('raw'), { mediaType: 'text/plain' });
    await expect(f.store.describeArtifact(scope, upload.id)).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('hashes streaming chunks and exposes only an opaque reference', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('hello ', 'world'), { mediaType: 'text/plain', maxBytes: 11 });
    expect(ref).toEqual({ id: expect.any(String), kind: 'upload', byteLength: 11, checksum: createHash('sha256').update('hello world').digest('hex') });
    expect(await f.store.ref(scope, ref.id)).toEqual(ref);
    expect(await collect((await f.store.readStream(scope, ref.id)).stream)).toBe('hello world');
  });
  it('rejects another owner and another draft before opening private bytes', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('secret'), { mediaType: 'text/plain' });
    const read = vi.spyOn(f.blobs, 'read');
    for (const other of [{ ...scope, ownerId: 'other' }, { ...scope, draftId: '20000000-0000-4000-8000-000000000001' }]) {
      await expect(f.store.readStream(other, ref.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects an oversized stream, removes partial bytes, and leaves discoverable reservation', async () => {
    const f = fixture();
    await expect(f.store.putStream(scope, chunks('abc', 'def'), { mediaType: 'text/plain', maxBytes: 4 })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(f.bytes.size).toBe(0); expect([...f.rows.values()][0].status).toBe('uploading');
    const result = await reconcileCreationStorage(f.metadata, f.blobs, { now: new Date(now.getTime() + limits.incompleteAgeMs) });
    expect(result.removed).toHaveLength(1); expect(f.rows.size).toBe(0);
  });
  it('does not consume byte input when the owner/quota reservation is rejected', async () => {
    const f = fixture(); vi.spyOn(f.metadata, 'reserve').mockRejectedValue(new CreationStorageError('LIMIT_EXCEEDED', 'Quota'));
    const produce = vi.fn(); async function* source() { produce(); yield Buffer.from('secret'); }
    await expect(f.store.putStream(scope, source(), { mediaType: 'text/plain' })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(produce).not.toHaveBeenCalled();
  });
  it('keeps a completed blob when the SQL completion acknowledgement was lost', async () => {
    const f = fixture(); const complete = f.metadata.complete;
    vi.spyOn(f.metadata, 'complete').mockImplementation(async (...args) => { await complete(...args); throw new Error('connection lost'); });
    await expect(f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' })).rejects.toThrow('connection lost');
    expect([...f.rows.values()][0].status).toBe('ready'); expect(f.bytes.size).toBe(1);
  });
  it('retains metadata when partial-byte cleanup is unavailable so reconciliation retries', async () => {
    const f = fixture(); const remove = vi.spyOn(f.blobs, 'delete').mockRejectedValue(new Error('Mongo offline'));
    await expect(f.store.putStream(scope, chunks('abc', 'too long'), { mediaType: 'text/plain', maxBytes: 4 })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    const later = new Date(now.getTime() + limits.incompleteAgeMs);
    expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: later })).failed).toHaveLength(1);
    expect(f.rows.size).toBe(1); remove.mockRestore();
    expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: new Date(now.getTime() + limits.unreferencedAgeMs) })).removed).toHaveLength(1);
  });
  it('protects an opened stream from concurrent deletion and a published pin from reclamation', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' });
    const opened = await f.store.readStream(scope, ref.id);
    await expect(f.store.drop(scope, ref.id)).rejects.toMatchObject({ code: 'PROTECTED' });
    expect(await collect(opened.stream)).toBe('saved');
    await f.store.pin(scope, ref.id, { published: true });
    f.rows.get(ref.id)!.referencedAt = null; // Published pin is independently protective.
    expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: new Date(now.getTime() + limits.draftAgeMs) })).removed).toEqual([]);
  });
  it('never opens bytes after deletion has already claimed the object', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' });
    await f.metadata.claimDeletion(scope, ref.id, 'token');
    const read = vi.spyOn(f.blobs, 'read');
    await expect(f.store.readStream(scope, ref.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(read).not.toHaveBeenCalled();
  });
  it('does not permanently pin a read and reclaims it after its temporary lease expires', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' });
    await collect((await f.store.readStream(scope, ref.id)).stream);
    expect(f.rows.get(ref.id)!.referencedAt).toBeNull();
    f.rows.get(ref.id)!.readLeaseUntil = new Date(0);
    expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: new Date(now.getTime() + limits.unreferencedAgeMs) })).removed).toEqual([ref.id]);
  });
  it('preserves old unreferenced objects during active work, then removes them', async () => {
    const f = fixture(); await f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' }); f.setBusy(true);
    const later = new Date(now.getTime() + limits.unreferencedAgeMs);
    expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: later })).removed).toEqual([]);
    f.setBusy(false); expect((await reconcileCreationStorage(f.metadata, f.blobs, { now: later })).removed).toHaveLength(1);
  });
  it('rejects hash corruption without returning a successful completed stream', async () => {
    const f = fixture(); const ref = await f.store.putStream(scope, chunks('saved'), { mediaType: 'text/plain' });
    f.bytes.set(f.rows.get(ref.id)!.blobId, Buffer.from('wrong'));
    await expect(collect((await f.store.readStream(scope, ref.id)).stream)).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('cleans up a partially uploaded stream on cancellation', async () => {
    const f = fixture(); const controller = new AbortController();
    async function* source() { yield Buffer.from('partial'); controller.abort(); yield Buffer.from('late'); }
    await expect(f.store.putStream(scope, source(), { mediaType: 'text/plain', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.bytes.size).toBe(0);
  });
});

describe('immutable typed artifacts', () => {
  it('validates envelope and content, without exposing private metadata', async () => {
    const f = fixture(); const ref = await f.store.putJSON(scope, { text: 'real content' }, artifact);
    expect(await f.store.getJSON(scope, ref.id, artifact)).toEqual({ text: 'real content' });
    expect(ref).not.toHaveProperty('blobId');
    const second = await f.store.putJSON(scope, { text: 'new content' }, artifact);
    expect(second.id).not.toBe(ref.id);
    expect(await f.store.getJSON(scope, ref.id, artifact)).toEqual({ text: 'real content' });
  });
  it.each([{ schemaVersion: 2 }, { artifactType: 'different' }, { inputFingerprint: 'stale' }])('rejects a mismatched artifact contract %o', async override => {
    const f = fixture(); const ref = await f.store.putJSON(scope, { text: 'content' }, artifact);
    await expect(f.store.getJSON(scope, ref.id, { ...artifact, ...override })).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('rejects malformed stored JSON even when its byte checksum matches', async () => {
    const f = fixture(); const ref = await f.store.putJSON(scope, { text: 'content' }, artifact);
    const row = f.rows.get(ref.id)!; const malformed = Buffer.from('{invalid json');
    row.byteLength = malformed.length; row.checksum = createHash('sha256').update(malformed).digest('hex'); f.bytes.set(row.blobId, malformed);
    await expect(f.store.getJSON(scope, ref.id, artifact)).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('rejects valid JSON with the wrong payload schema before returning it', async () => {
    const f = fixture(); const ref = await f.store.putJSON(scope, { text: 'content' }, artifact);
    const row = f.rows.get(ref.id)!; const wrong = Buffer.from(JSON.stringify({ artifactType: 'extraction', schemaVersion: 1, inputFingerprint: 'fingerprint', value: { text: 123 } }));
    row.byteLength = wrong.length; row.checksum = createHash('sha256').update(wrong).digest('hex'); f.bytes.set(row.blobId, wrong);
    await expect(f.store.getJSON(scope, ref.id, artifact)).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
});

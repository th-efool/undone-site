import { beforeEach, describe, expect, it, vi } from 'vitest';
import { textUploadHandler } from '../upload.http';
import { DraftNotFound } from '../draft.service';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';

const ref = { id: '44444444-4444-4444-8444-444444444444', kind: 'upload' as const, byteLength: 5, checksum: 'a'.repeat(64) };
const snapshot = { ...initialSnapshot(draftId), stage: 'starting_point' as const, startingPoint: 'have_material' as const };
const load = vi.fn(); const putStream = vi.fn(); const owner = vi.fn();
const handle = textUploadHandler({ load }, { putStream }, owner);
function request(headers: Record<string, string> = {}, signal?: AbortSignal) {
  return new Request('https://example.test/upload', { method: 'POST', body: 'notes', signal,
    headers: { 'Content-Type': 'text/markdown', 'X-Creation-Revision': String(snapshot.revision), ...headers } });
}
beforeEach(() => {
  vi.resetAllMocks(); owner.mockResolvedValue('owner'); load.mockResolvedValue(snapshot);
  putStream.mockImplementation(async (_scope, content, options) => {
    let size = 0;
    for await (const chunk of content) {
      size += chunk.byteLength;
      if (size > options.maxBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Source too large.');
    }
    return { ...ref, byteLength: size };
  });
});
describe('owned streaming text upload', () => {
  it('acknowledges opaque retained bytes only after storage completes', async () => {
    const response = await handle(request({ 'X-Creation-Filename': 'lesson%20one.md' }), draftId);
    expect(response.status).toBe(201); expect(await response.json()).toEqual(ref);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(load).toHaveBeenCalledWith('owner', draftId);
    expect(putStream.mock.calls[0][0]).toEqual({ ownerId: 'owner', draftId });
    expect(putStream.mock.calls[0][2]).toMatchObject({ filename: 'lesson one.md', maxBytes: MATERIAL_LIMITS.extractedTextBytes });
  });
  it('rejects unauthenticated requests before loading drafts or reading bytes', async () => {
    owner.mockResolvedValue(null); const input = request();
    expect((await handle(input, draftId)).status).toBe(401);
    expect(input.bodyUsed).toBe(false); expect(load).not.toHaveBeenCalled(); expect(putStream).not.toHaveBeenCalled();
  });
  it('hides foreign and missing drafts', async () => {
    load.mockRejectedValue(new DraftNotFound()); const input = request();
    expect((await handle(input, draftId)).status).toBe(404);
    expect(input.bodyUsed).toBe(false); expect(putStream).not.toHaveBeenCalled();
  });
  it('rejects invalid IDs before repository access', async () => {
    expect((await handle(request(), 'bad-id')).status).toBe(404); expect(load).not.toHaveBeenCalled();
  });
  it('returns canonical state on a stale revision without accepting bytes', async () => {
    const response = await handle(request({ 'X-Creation-Revision': '42' }), draftId);
    expect(response.status).toBe(409); expect((await response.json()).current).toEqual(snapshot);
    expect(putStream).not.toHaveBeenCalled();
  });
  it.each(['', '-1', '1.5', '9007199254740992'])('requires a safe revision: %s', async revision => {
    expect((await handle(request({ 'X-Creation-Revision': revision }), draftId)).status).toBe(400);
    expect(putStream).not.toHaveBeenCalled();
  });
  it('rejects an active acquisition or a different starting branch', async () => {
    load.mockResolvedValueOnce({ ...snapshot, status: 'running' }).mockResolvedValueOnce({ ...snapshot, startingPoint: 'have_goal' });
    expect((await handle(request(), draftId)).status).toBe(409);
    expect((await handle(request(), draftId)).status).toBe(409); expect(putStream).not.toHaveBeenCalled();
  });
  it('rejects unsupported and declared oversized sources before storage', async () => {
    expect((await handle(request({ 'Content-Type': 'application/pdf' }), draftId)).status).toBe(415);
    expect((await handle(request({ 'Content-Length': String(MATERIAL_LIMITS.extractedTextBytes + 1) }), draftId)).status).toBe(413);
    expect(putStream).not.toHaveBeenCalled();
  });
  it('enforces actual streaming bytes even when a caller understates the length', async () => {
    expect((await handle(request({ 'Content-Length': '2' }), draftId)).status).toBe(413);
  });
  it('does not acknowledge an interrupted request', async () => {
    const controller = new AbortController(); controller.abort();
    expect((await handle(request({}, controller.signal), draftId)).status).toBe(408);
  });
  it('unblocks a pending body read on cancellation and releases its lock', async () => {
    const controller = new AbortController(); const canceled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel: canceled });
    const input = new Request('https://example.test/upload', { method: 'POST', body, duplex: 'half', signal: controller.signal,
      headers: { 'Content-Type': 'text/plain', 'X-Creation-Revision': String(snapshot.revision) } } as RequestInit & { duplex: 'half' });
    const response = handle(input, draftId);
    await vi.waitFor(() => expect(putStream).toHaveBeenCalledOnce()); controller.abort();
    expect((await response).status).toBe(408); expect(canceled).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
  });
  it('rejects a full source selection before receiving another upload', async () => {
    load.mockResolvedValue({ ...snapshot, materials: Array(20).fill({}) });
    expect((await handle(request(), draftId)).status).toBe(413); expect(putStream).not.toHaveBeenCalled();
  });
  it('cancels an unread body if quota reservation rejects before iteration', async () => {
    const canceled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel: canceled });
    const input = new Request('https://example.test/upload', { method: 'POST', body, duplex: 'half',
      headers: { 'Content-Type': 'text/plain', 'X-Creation-Revision': String(snapshot.revision) } } as RequestInit & { duplex: 'half' });
    putStream.mockRejectedValue(new CreationStorageError('LIMIT_EXCEEDED', 'Quota exceeded.'));
    expect((await handle(input, draftId)).status).toBe(413); expect(canceled).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
  it('sanitizes storage outages and never fabricates a successful reference', async () => {
    putStream.mockRejectedValue(new Error('private connection detail'));
    const response = await handle(request(), draftId);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private connection detail');
  });
  it('rejects malformed encoded filenames', async () => {
    expect((await handle(request({ 'X-Creation-Filename': '%zz' }), draftId)).status).toBe(400);
    expect(putStream).not.toHaveBeenCalled();
  });
});

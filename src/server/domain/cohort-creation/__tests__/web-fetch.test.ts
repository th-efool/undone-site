import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { isPublicWebAddress, openWebSource, type WebResponse, type WebTransport } from '../materials/web-fetch';
import { WebRetentionService } from '../materials/web-retention.service';
import { CREATION_STORAGE_LIMITS, CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { webResponseReceiptSchema } from '@/src/shared/cohort-creation/web';

function response(status = 200, headers: IncomingHttpHeaders = { 'content-type': 'text/html' }, body = '<article>Real retained lesson.</article>'): WebResponse {
  return { status, headers, close: vi.fn(), bytes: (async function* () { yield Buffer.from(body); })() };
}
function fixture(reply = response()) {
  const transport: WebTransport = { resolve: vi.fn(async () => [{ address: '93.184.215.14', family: 4 }]), open: vi.fn(async () => reply) };
  return { reply, transport };
}
async function consume(opened: Awaited<ReturnType<typeof openWebSource>>) {
  const pieces: Uint8Array[] = []; for await (const piece of opened.bytes) pieces.push(piece); return Buffer.concat(pieces);
}
describe('controlled public HTTPS sources', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.1.1', '198.18.0.1', '192.0.2.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::1', '3fff::1'])('rejects private/reserved address %s', address => {
    expect(isPublicWebAddress(address)).toBe(false);
  });
  it.each(['8.8.8.8', '93.184.215.14', '2606:4700:4700::1111'])('permits public address %s', address => expect(isPublicWebAddress(address)).toBe(true));
  it.each(['http://docs.example.com', 'file:///secret', 'https://user:password@docs.example.com', 'https://docs.example.com:8443', 'https://localhost', 'https://service.internal', 'https://127.1', 'https://2130706433', 'https://[::ffff:7f00:1]', 'https://docs.example.com\\@127.0.0.1'])('rejects unsafe URL %s before DNS', async url => {
    const f = fixture(); await expect(openWebSource(url, undefined, f.transport)).rejects.toBeInstanceOf(CreationStorageError);
    expect(f.transport.resolve).not.toHaveBeenCalled(); expect(f.transport.open).not.toHaveBeenCalled();
  });
  it('pins one validated address and preserves final response bytes', async () => {
    const f = fixture(); const opened = await openWebSource('https://docs.example.com/lesson#heading', undefined, f.transport);
    expect(opened.requestedUrl).toBe('https://docs.example.com/lesson');
    expect(f.transport.open).toHaveBeenCalledWith(new URL(opened.finalUrl), { address: '93.184.215.14', family: 4 }, expect.any(AbortSignal));
    expect((await consume(opened)).toString()).toContain('Real retained lesson'); expect(f.reply.close).toHaveBeenCalled();
  });
  it('rejects mixed DNS answers and does not connect', async () => {
    const f = fixture(); vi.mocked(f.transport.resolve).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toThrow('unsupported address'); expect(f.transport.open).not.toHaveBeenCalled();
  });
  it('revalidates each redirect and retains redirect provenance', async () => {
    const redirect = response(302, { 'content-type': 'text/html', location: '/chapter' }); const f = fixture();
    vi.mocked(f.transport.open).mockResolvedValueOnce(redirect).mockResolvedValueOnce(f.reply);
    const opened = await openWebSource('https://docs.example.com/lesson', undefined, f.transport);
    expect(opened.redirects).toEqual(['https://docs.example.com/chapter']); expect(f.transport.resolve).toHaveBeenCalledTimes(2);
    expect(redirect.close).toHaveBeenCalled(); await consume(opened);
  });
  it.each(['https://127.0.0.1/secret', 'http://docs.example.com', 'https://user:password@docs.example.com'])('denies unsafe redirect %s', async location => {
    const f = fixture(response(302, { 'content-type': 'text/html', location }));
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toBeInstanceOf(CreationStorageError);
    expect(f.transport.open).toHaveBeenCalledOnce(); expect(f.reply.close).toHaveBeenCalled();
  });
  it('blocks redirect DNS rebinding', async () => {
    const f = fixture(response(302, { 'content-type': 'text/html', location: '/private' }));
    vi.mocked(f.transport.resolve).mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]).mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toThrow('unsupported address'); expect(f.transport.open).toHaveBeenCalledOnce();
  });
  it('limits redirect work to three hops and closes each response', async () => {
    const f = fixture(); const replies = Array.from({ length: 4 }, (_, index) => response(302, { location: `/hop-${index}` }));
    for (const reply of replies) vi.mocked(f.transport.open).mockResolvedValueOnce(reply);
    await expect(openWebSource('https://docs.example.com/start', undefined, f.transport)).rejects.toThrow('Redirect limit');
    expect(f.transport.open).toHaveBeenCalledTimes(4); replies.forEach(reply => expect(reply.close).toHaveBeenCalled());
  });
  it.each([
    { 'content-type': 'application/pdf' }, { 'content-type': 'text/html; charset=iso-8859-1' },
    { 'content-type': 'text/html', 'content-encoding': 'gzip' }, { 'content-type': 'text/html', 'content-length': 'bad' },
    { 'content-type': 'text/html', 'content-length': String(CREATION_STORAGE_LIMITS.fileBytes + 1) },
  ])('rejects unsupported response headers %j', async headers => {
    const f = fixture(response(200, headers)); await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toBeInstanceOf(CreationStorageError); expect(f.reply.close).toHaveBeenCalled();
  });
  it('rejects actual oversized streamed bodies without acknowledging truncation', async () => {
    const f = fixture(); f.reply.bytes = (async function* () { yield new Uint8Array(CREATION_STORAGE_LIMITS.fileBytes); yield new Uint8Array(1); })();
    const opened = await openWebSource('https://docs.example.com', undefined, f.transport);
    await expect(consume(opened)).rejects.toThrow('Nothing was truncated'); expect(f.reply.close).toHaveBeenCalled();
  });
  it('rejects incomplete or empty responses', async () => {
    for (const reply of [response(200, { 'content-type': 'text/plain', 'content-length': '20' }, 'short'), response(200, { 'content-type': 'text/plain' }, '')]) {
      const f = fixture(reply); await expect(consume(await openWebSource('https://docs.example.com', undefined, f.transport))).rejects.toThrow('empty or incomplete');
      expect(reply.close).toHaveBeenCalled();
    }
  });
  it('aborts stalled DNS before opening any socket', async () => {
    const f = fixture(); vi.mocked(f.transport.resolve).mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController(); const pending = openWebSource('https://docs.example.com', controller.signal, f.transport);
    controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(f.transport.open).not.toHaveBeenCalled();
  });
  it('rejects cancellation between streamed chunks and closes the response', async () => {
    const f = fixture(); const controller = new AbortController();
    f.reply.bytes = (async function* () { yield Buffer.from('first'); controller.abort(); yield Buffer.from('second'); })();
    const opened = await openWebSource('https://docs.example.com', controller.signal, f.transport);
    await expect(consume(opened)).rejects.toMatchObject({ name: 'AbortError' }); expect(f.reply.close).toHaveBeenCalled();
  });
  it('sanitizes errors from a broken response stream', async () => {
    const f = fixture(); f.reply.bytes = (async function* () { yield Buffer.from('partial'); throw new Error('private socket detail'); })();
    const opened = await openWebSource('https://docs.example.com', undefined, f.transport);
    await expect(consume(opened)).rejects.toThrow('source download was interrupted'); expect(f.reply.close).toHaveBeenCalled();
  });
  it('sanitizes connection errors and rejects redirect loops and inaccessible pages', async () => {
    const f = fixture(); vi.mocked(f.transport.open).mockRejectedValueOnce(new Error('private socket details'));
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toThrow('source connection failed');
    vi.mocked(f.transport.open).mockResolvedValue(response(302, { 'content-type': 'text/html', location: '/' }));
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toThrow('Redirect loop');
    vi.mocked(f.transport.open).mockResolvedValue(response(403));
    await expect(openWebSource('https://docs.example.com', undefined, f.transport)).rejects.toThrow('Upload or paste');
  });
});

describe('retained web response receipts', () => {
  it('retains full bytes privately and stores validated provenance without claiming extraction', async () => {
    const f = fixture(); const putStream = vi.fn(async (_scope, bytes) => {
      const content: Uint8Array[] = []; for await (const piece of bytes) content.push(piece);
      const data = Buffer.concat(content); return { id: draftId, kind: 'upload' as const, byteLength: data.length, checksum: createHash('sha256').update(data).digest('hex') };
    });
    const putJSON = vi.fn(async (_scope, _receipt, options) => { options.schema.parse(_receipt); return { id: draftId, kind: 'artifact' as const, byteLength: 100, checksum: 'a'.repeat(64) }; });
    const source = { id: draftId, kind: 'web' as const, input: { kind: 'url' as const, url: 'https://docs.example.com/lesson' }, selectedUnitIds: [], status: 'acquiring' as const };
    const service = new WebRetentionService({ putStream }, { putJSON }, f.transport);
    const result = await service.retain({ ownerId: 'owner', draftId }, source, 7);
    expect(result.receipt).toMatchObject({ inputRevision: 7, requestedUrl: source.input.url, finalUrl: source.input.url });
    expect(result.receipt.retainedSource.byteLength).toBe(Buffer.byteLength('<article>Real retained lesson.</article>'));
    expect(result.receipt).not.toHaveProperty('extraction'); expect(source.status).toBe('acquiring');
    expect(putStream.mock.calls[0][0]).toEqual({ ownerId: 'owner', draftId }); expect(putJSON.mock.calls[0][2].inputFingerprint).toBe(result.inputFingerprint);
    expect(webResponseReceiptSchema.safeParse({ ...result.receipt, finalUrl: 'https://other.example.com/' }).success).toBe(false);
    expect(webResponseReceiptSchema.safeParse({ ...result.receipt, requestedUrl: 'http://docs.example.com/lesson' }).success).toBe(false);
  });
  it('closes the response if ownership/quota storage rejects before iteration', async () => {
    const f = fixture(); const putJSON = vi.fn();
    const service = new WebRetentionService({ putStream: vi.fn(async () => { throw new CreationStorageError('NOT_FOUND', 'Draft unavailable'); }) }, { putJSON }, f.transport);
    await expect(service.retain({ ownerId: 'other', draftId }, { id: draftId, kind: 'web', input: { kind: 'url', url: 'https://docs.example.com' }, selectedUnitIds: [], status: 'acquiring' }, 1)).rejects.toThrow('Draft unavailable');
    expect(f.reply.close).toHaveBeenCalled(); expect(putJSON).not.toHaveBeenCalled();
  });
  it('does not return success when receipt persistence fails after raw bytes are retained', async () => {
    const f = fixture(); const putStream = vi.fn(async (_scope, bytes) => {
      for await (const chunk of bytes) expect(chunk.length).toBeGreaterThan(0);
      return { id: draftId, kind: 'upload' as const, byteLength: 39, checksum: 'a'.repeat(64) };
    });
    const service = new WebRetentionService({ putStream }, { putJSON: vi.fn(async () => { throw new CreationStorageError('UNAVAILABLE', 'Receipt persistence failed'); }) }, f.transport);
    await expect(service.retain({ ownerId: 'owner', draftId }, { id: draftId, kind: 'web', input: { kind: 'url', url: 'https://docs.example.com' }, selectedUnitIds: [], status: 'acquiring' }, 1)).rejects.toThrow('Receipt persistence failed');
    expect(f.reply.close).toHaveBeenCalled(); expect(putStream).toHaveBeenCalledOnce();
    // No pin/ready state is emitted: existing retention can reclaim an unaccepted raw object.
  });
  it('rejects wrong source types and invalid revisions before network work', async () => {
    const f = fixture(); const service = new WebRetentionService({ putStream: vi.fn() }, { putJSON: vi.fn() }, f.transport);
    const source = { id: draftId, kind: 'web' as const, input: { kind: 'url' as const, url: 'https://docs.example.com' }, selectedUnitIds: [], status: 'acquiring' as const };
    await expect(service.retain({ ownerId: 'owner', draftId }, source, -1)).rejects.toThrow('valid input revision');
    await expect(service.retain({ ownerId: 'owner', draftId }, { ...source, kind: 'github' }, 1)).rejects.toThrow('Select one web source');
    expect(f.transport.open).not.toHaveBeenCalled(); expect(f.transport.resolve).not.toHaveBeenCalled();
  });
});

import { createHash, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { getGlobalDispatcher } from 'undici';
import type { ArtifactOptions, StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
vi.mock('server-only', () => ({}));
import { extractWebResponse, WEB_HTML_LIMIT, webExtractionFingerprint } from '../materials/web-extraction';
import { WebAcquisitionService } from '../materials/web-acquisition.service';
import { webExtractionArtifactSchema, webResponseReceiptSchema } from '@/src/shared/cohort-creation/web';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
afterEach(() => vi.restoreAllMocks());
const prose = 'Lighting describes how surfaces interact with energy. Study light transport, reflectance and visibility with practical rendering experiments. '.repeat(8);
function fixture(text = `<html><head><title>Rendering lesson</title></head><body><nav>Skip navigation</nav><article><h1>Rendering lesson</h1><p>${prose}</p><h2>Light transport</h2><p>${prose}🙂 世界</p></article><footer>Advertisement</footer></body></html>`, mediaType: 'text/html' | 'text/plain' | 'text/markdown' = 'text/html') {
  const bytes = Buffer.from(text);
  const receipt = webResponseReceiptSchema.parse({ schemaVersion: 1, materialId: randomUUID(), inputRevision: 3,
    requestedUrl: 'https://docs.example.com/lesson', finalUrl: 'https://docs.example.com/lesson', redirects: [], mediaType,
    retainedSource: { id: randomUUID(), kind: 'upload', byteLength: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') },
    fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' });
  return { bytes, receipt };
}
describe('inert retained web extraction', () => {
  it('extracts main article text with complete stable anchors and external provenance', () => {
    const f = fixture(); const first = extractWebResponse(f.bytes, f.receipt);
    expect(first.web.scope).toBe('main_article'); expect(first.web.format).toBe('normalized_article_text');
    expect(first.contentOrigin).toBe('external'); expect(first.text).toContain('🙂 世界');
    expect(first.text).not.toContain('Advertisement'); expect(first.text).not.toContain('<article>');
    expect(first.segments.map(segment => segment.text).join('')).toBe(first.text);
    expect(first.coverage).toEqual({ complete: true, omittedRanges: [] });
    expect(first.sourceChecksum).toBe(f.receipt.retainedSource.checksum);
    expect(first).toEqual(extractWebResponse(f.bytes, f.receipt));
    const broken = structuredClone(first); broken.segments[0].location.materialId = 'wrong';
    expect(webExtractionArtifactSchema.safeParse(broken).success).toBe(false);
    expect(webExtractionArtifactSchema.safeParse({ ...first, web: { ...first.web, scope: 'full_text_response' } }).success).toBe(false);
  });
  it('never executes scripts, loads resources or retains hidden/script text', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const resources = vi.spyOn(getGlobalDispatcher(), 'dispatch');
    const f = fixture(`<article><h1>Lesson</h1><script>globalThis.__creationScriptRan = true; fetch('https://127.0.0.1/secret')</script><img src="https://127.0.0.1/image"><iframe src="https://127.0.0.1/frame"></iframe><p hidden>Hidden token</p><p>${prose}</p></article>`);
    const output = extractWebResponse(f.bytes, f.receipt);
    expect(output.text).not.toContain('Hidden token'); expect(output.text).not.toContain('__creationScriptRan');
    expect(fetch).not.toHaveBeenCalled(); expect(resources).not.toHaveBeenCalled(); expect(globalThis).not.toHaveProperty('__creationScriptRan');
  });
  it('preserves exact plain/Markdown text including BOM, CRLF and Unicode', () => {
    const text = '\ufeff# Heading\r\n\r\n```ts\nconst x = "🙂";\n```\n'; const f = fixture(text, 'text/markdown');
    const output = extractWebResponse(f.bytes, f.receipt);
    expect(output.text).toBe(text); expect(output.web.scope).toBe('full_text_response');
    expect(output.utf8ByteLength).toBe(f.bytes.length); expect(output.segments.some(segment => segment.kind === 'code')).toBe(true);
  });
  it.each(['<script>document.write("lesson")</script><div id="root"></div>', '<form><input type="password"></form>', '<html><body> </body></html>'])('requires accessible material instead of fabricated content: %s', html => {
    const f = fixture(html); expect(() => extractWebResponse(f.bytes, f.receipt)).toThrow('Upload or paste');
  });
  it('rejects invalid encoding, wrong raw checksums and canceled work', () => {
    const f = fixture(); expect(() => extractWebResponse(Buffer.from('altered'), f.receipt)).toThrow('does not match');
    const bytes = Buffer.from([0xff]); const bad = fixture('x', 'text/plain');
    bad.receipt.retainedSource.checksum = createHash('sha256').update(bytes).digest('hex');
    expect(() => extractWebResponse(bytes, bad.receipt)).toThrow('not UTF-8');
    const controller = new AbortController(); controller.abort(); expect(() => extractWebResponse(f.bytes, f.receipt, controller.signal)).toThrow();
  });
  it('exposes raw/element/depth/text bounds without truncation', () => {
    const raw = fixture('x'.repeat(WEB_HTML_LIMIT + 1)); expect(() => extractWebResponse(raw.bytes, raw.receipt)).toThrow('2 MiB');
    const many = fixture('<div></div>'.repeat(20_001)); expect(() => extractWebResponse(many.bytes, many.receipt)).toThrow('20,000');
    const deep = fixture('<div>'.repeat(205) + prose + '</div>'.repeat(205)); expect(() => extractWebResponse(deep.bytes, deep.receipt)).toThrow('nesting');
    const large = fixture('🙂'.repeat(MATERIAL_LIMITS.extractedTextBytes / 4 + 1), 'text/plain'); expect(() => extractWebResponse(large.bytes, large.receipt)).toThrow('1 MiB');
  });
});
describe('owned web extraction service', () => {
  function serviceFixture() {
    const f = fixture(); const receiptArtifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) };
    const source = { id: f.receipt.materialId, kind: 'web' as const, input: { kind: 'url' as const, url: f.receipt.requestedUrl }, status: 'acquiring' as const, selectedUnitIds: [] };
    const readReceipt = vi.fn(async (scope: StorageScope, id: string) => { expect(scope.ownerId).toBe('owner'); expect(id).toBe(receiptArtifact.id); return f.receipt; });
    const getJSON = async <T extends z.ZodType>(scope: StorageScope, id: string, options: ArtifactOptions<T>) => options.schema.parse(await readReceipt(scope, id)) as z.output<T>;
    const readStream = vi.fn(async () => ({ ref: f.receipt.retainedSource, mediaType: f.receipt.mediaType, stream: (async function* () { yield f.bytes; })() }));
    const putJSON = vi.fn(async (_scope, value, options) => { options.schema.parse(value); return { ...receiptArtifact, id: randomUUID() }; });
    const retain = vi.fn(async () => ({ receipt: f.receipt, receiptArtifact, inputFingerprint: 'b'.repeat(64) }));
    const service = new WebAcquisitionService({ retain }, { readStream }, { getJSON, putJSON });
    return { ...f, source, service, retain, getJSON: readReceipt, readStream, putJSON, receiptArtifact };
  }
  it('reads owned retained bytes and proposes a validated immutable manifest', async () => {
    const f = serviceFixture(); const scope = { ownerId: 'owner', draftId: randomUUID() };
    const manifest = await f.service.acquire(scope, f.source, 3);
    expect(manifest.source.status).toBe('ready'); expect(manifest.extraction.complete).toBe(true);
    expect(manifest.receiptArtifact).toEqual(f.receiptArtifact); expect(manifest.inputFingerprint).toBe(webExtractionFingerprint(f.receipt));
    expect(f.readStream).toHaveBeenCalledWith(scope, f.receipt.retainedSource.id, undefined);
    expect(f.getJSON.mock.calls[0][0]).toEqual(scope); expect(f.source.status).toBe('acquiring');
  });
  it('resumes retained receipts without refetching and rejects wrong identity', async () => {
    const f = serviceFixture(); const scope = { ownerId: 'owner', draftId: randomUUID() };
    await f.service.extract(scope, f.source, 3, f.receiptArtifact, 'b'.repeat(64)); expect(f.retain).not.toHaveBeenCalled();
    await expect(f.service.extract(scope, f.source, 4, f.receiptArtifact, 'b'.repeat(64))).rejects.toThrow('does not match');
    f.readStream.mockResolvedValueOnce({ ref: { ...f.receipt.retainedSource, checksum: 'c'.repeat(64) }, mediaType: f.receipt.mediaType, stream: (async function* () { yield f.bytes; })() });
    await expect(f.service.extract(scope, f.source, 3, f.receiptArtifact, 'b'.repeat(64))).rejects.toThrow('does not match');
  });
});

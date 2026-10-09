import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { extractRetainedText } from '../materials/text';
import { TextAcquisitionService } from '../materials/text-acquisition.service';
import { materialManifestSchema, materialSelectionSchema, textExtractionArtifactSchema, MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import type { CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';
import type { MaterialSource } from '@/src/shared/cohort-creation/contracts';

const scope = { ownerId: 'owner', draftId: randomUUID() };
function ref(bytes: Uint8Array): CreationObjectRef {
  return { id: randomUUID(), kind: 'upload', byteLength: bytes.byteLength,
    checksum: createHash('sha256').update(bytes).digest('hex') };
}
function fixture(text = '# Rendering\r\n\r\n```ts\r\n# not a heading\r\n```\r\n🙂 Learn 世界\n') {
  const bytes = Buffer.from(text); const sourceRef = ref(bytes);
  const source: MaterialSource = { id: randomUUID(), kind: 'markdown', input: { kind: 'upload', assetId: sourceRef.id },
    selectedUnitIds: [], status: 'pending' };
  const readStream = vi.fn(async () => ({ ref: sourceRef, mediaType: 'text/markdown',
    stream: (async function* () { yield bytes.subarray(0, 3); yield bytes.subarray(3); })() }));
  const putJSON = vi.fn(async () => ({ id: randomUUID(), kind: 'artifact' as const, byteLength: 100,
    checksum: 'a'.repeat(64) }));
  return { bytes, sourceRef, source, readStream, putJSON, service: new TextAcquisitionService({ readStream }, { putJSON }) };
}
describe('retained text extraction', () => {
  it('preserves exact UTF-8/BOM/CRLF and complete Unicode anchors without executing Markdown', () => {
    const text = '\ufeff# Intro\r\n<script>doNotRun()</script>\n🙂 世界';
    const bytes = Buffer.from(text);
    const output = extractRetainedText(bytes, ref(bytes), 'material', 'unit');
    expect(output.text).toBe(text);
    expect(output.segments.map(segment => segment.text).join('')).toBe(text);
    expect(output.utf8ByteLength).toBe(bytes.length);
    expect(output.offsetUnit).toBe('utf16');
  });
  it('recognizes headings outside fenced code and produces stable segment/version identities', () => {
    const f = fixture(); const first = extractRetainedText(f.bytes, f.sourceRef, 'material', 'unit');
    expect(first).toEqual(extractRetainedText(f.bytes, f.sourceRef, 'material', 'unit'));
    expect(first.segments.filter(segment => segment.kind === 'heading')).toHaveLength(1);
    expect(first.segments.find(segment => segment.kind === 'code')?.text).toContain('# not a heading');
    expect(first.coverage).toEqual({ complete: true, omittedRanges: [] });
  });
  it('does not split surrogate pairs at segment boundaries', () => {
    const bytes = Buffer.from('a'.repeat(4095) + '🙂tail');
    const output = extractRetainedText(bytes, ref(bytes), 'material', 'unit');
    expect(output.segments[0].text).toHaveLength(4095);
    expect(output.segments[1].text).toBe('🙂tail');
  });
  it.each([Buffer.from([0xc3, 0x28]), Buffer.from('text\0binary'), Buffer.from(' \r\n')])('rejects malformed/empty/binary text', bytes => {
    expect(() => extractRetainedText(bytes, ref(bytes), 'material', 'unit')).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
  it('rejects oversized sources and checksum mismatches without truncation', () => {
    const bytes = Buffer.alloc(MATERIAL_LIMITS.extractedTextBytes + 1, 97);
    expect(() => extractRetainedText(bytes, ref(bytes), 'material', 'unit')).toThrowError(expect.objectContaining({ code: 'LIMIT_EXCEEDED' }));
    expect(() => extractRetainedText(Buffer.from('changed'), ref(Buffer.from('original')), 'material', 'unit')).toThrowError(expect.objectContaining({ code: 'INTEGRITY' }));
  });
  it('rejects gaps, invented anchors and duplicate identities in extraction artifacts', () => {
    const f = fixture(); const output = extractRetainedText(f.bytes, f.sourceRef, 'material', 'unit');
    const broken = structuredClone(output); broken.segments[0].location.materialId = 'invented';
    expect(textExtractionArtifactSchema.safeParse(broken).success).toBe(false);
    expect(textExtractionArtifactSchema.safeParse({ ...output, segments: output.segments.slice(1) }).success).toBe(false);
  });
});
describe('text acquisition service', () => {
  it('retains extraction through owned storage and returns a consistent manifest proposal', async () => {
    const f = fixture(); const manifest = await f.service.acquire(scope, f.source, 2);
    expect(f.readStream).toHaveBeenCalledWith(scope, f.sourceRef.id, undefined);
    expect(f.putJSON).toHaveBeenCalledWith(scope, expect.objectContaining({ text: f.bytes.toString() }),
      expect.objectContaining({ artifactType: 'text-extraction', inputFingerprint: manifest.inputFingerprint }));
    expect(manifest.source.status).toBe('ready'); expect(manifest.extraction.complete).toBe(true);
    expect(manifest.retainedSource).toEqual(f.sourceRef);
    expect(materialManifestSchema.safeParse({ ...manifest, extraction: { ...manifest.extraction, materialId: 'other' } }).success).toBe(false);
  });
  it('propagates authorization/storage failures without a successful artifact', async () => {
    const f = fixture(); f.readStream.mockRejectedValueOnce(new Error('not owned'));
    await expect(f.service.acquire(scope, f.source, 1)).rejects.toThrow('not owned'); expect(f.putJSON).not.toHaveBeenCalled();
    f.putJSON.mockRejectedValueOnce(new Error('artifact write failed'));
    await expect(f.service.acquire(scope, f.source, 1)).rejects.toThrow('artifact write failed');
  });
  it('rejects unsupported sources and unselected units before opening bytes', async () => {
    const f = fixture();
    await expect(f.service.acquire(scope, { ...f.source, kind: 'pdf' }, 1)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(f.service.acquire(scope, { ...f.source, selectedUnitIds: ['other'] }, 1)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(f.readStream).not.toHaveBeenCalled();
  });
  it('rejects unsupported media and oversized declarations without consuming content', async () => {
    const f = fixture(); const produce = vi.fn();
    async function* stream() { produce(); yield f.bytes; }
    f.readStream.mockImplementationOnce(async () => ({ ref: f.sourceRef, mediaType: 'application/pdf', stream: stream() }));
    await expect(f.service.acquire(scope, f.source, 1)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    f.readStream.mockImplementationOnce(async () => ({ ref: { ...f.sourceRef, byteLength: MATERIAL_LIMITS.extractedTextBytes + 1 },
      mediaType: 'text/plain', stream: stream() }));
    await expect(f.service.acquire(scope, f.source, 1)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(produce).not.toHaveBeenCalled(); expect(f.putJSON).not.toHaveBeenCalled();
  });
  it('honors cancellation before storage and during streaming', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.service.acquire(scope, f.source, 1, controller.signal)).rejects.toThrow();
    expect(f.readStream).not.toHaveBeenCalled();
    const midstream = new AbortController();
    f.readStream.mockImplementationOnce(async () => ({ ref: f.sourceRef, mediaType: 'text/plain',
      stream: (async function* () { yield f.bytes; midstream.abort(); yield Buffer.from('more'); })() }));
    await expect(f.service.acquire(scope, f.source, 1, midstream.signal)).rejects.toThrow(); expect(f.putJSON).not.toHaveBeenCalled();
  });
  it('enforces source and selected-unit scope limits', () => {
    const f = fixture();
    expect(materialSelectionSchema.safeParse([f.source, f.source]).success).toBe(false);
    const sources = Array.from({ length: 21 }, () => ({ ...f.source, id: randomUUID() }));
    expect(materialSelectionSchema.safeParse(sources).success).toBe(false);
    expect(materialSelectionSchema.safeParse(sources.slice(0, 2).map(source => ({ ...source,
      selectedUnitIds: Array.from({ length: 51 }, () => randomUUID()) }))).success).toBe(false);
  });
});

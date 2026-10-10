import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { extractRetainedPdf } from '../materials/pdf';
import { PdfAcquisitionService } from '../materials/pdf-acquisition.service';
import { pdfExtractionArtifactSchema } from '@/src/shared/cohort-creation/pdf';

/** Minimal real PDF with accurate byte offsets. No parser mocks or external fixtures. */
function pdf(pages = ['Rendering light transport', 'Surface reflectance and visibility']) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for (const [index, text] of pages.entries()) {
    const stream = text ? `BT /F1 ${text.length > 1000 ? '0.00001' : '12'} Tf 50 700 Td (${text.replace(/[\\()]/g, '\\$&')}) Tj ET` : '';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let document = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(document)); document += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document);
}
function ref(bytes: Buffer) { return { id: randomUUID(), kind: 'upload' as const, byteLength: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') }; }
describe('retained PDF extraction', () => {
  it('extracts real page text with deterministic complete page provenance', async () => {
    const bytes = pdf(); const retained = ref(bytes); const id = randomUUID();
    const output = await extractRetainedPdf(bytes, retained, id);
    expect(output.text).toBe('Rendering light transport\n\nSurface reflectance and visibility');
    expect(output.pdf.pages).toHaveLength(2); expect(output.segments.map(segment => segment.text).join('')).toBe(output.text);
    expect(output.segments.map(segment => segment.location.anchor)).toEqual([{ kind: 'page', page: 1 }, { kind: 'page', page: 2 }]);
    expect(await extractRetainedPdf(bytes, retained, id)).toEqual(output);
    const broken = structuredClone(output); broken.segments[0].location.anchor = { kind: 'page', page: 2 };
    expect(pdfExtractionArtifactSchema.safeParse(broken).success).toBe(false);
    broken.segments[0].location.anchor = { kind: 'page', page: 1 }; broken.pdf.pages.pop();
    expect(pdfExtractionArtifactSchema.safeParse(broken).success).toBe(false);
  });
  it('rejects blank/image-only pages without silently skipping them', async () => {
    const bytes = pdf(['Accessible first page', '']);
    await expect(extractRetainedPdf(bytes, ref(bytes), randomUUID())).rejects.toThrow('Page 2 has no extractable text');
  });
  it('rejects page and extracted text limits without truncation', async () => {
    const pages = pdf(Array.from({ length: 201 }, () => 'Lesson'));
    await expect(extractRetainedPdf(pages, ref(pages), randomUUID())).rejects.toThrow('200 pages');
    const text = pdf(['x'.repeat(1024 * 1024 + 1)]);
    await expect(extractRetainedPdf(text, ref(text), randomUUID())).rejects.toThrow('1 MiB');
  }, 15_000);
  it('rejects invalid signature, malformed PDFs and altered retained bytes', async () => {
    const wrong = Buffer.from('not a pdf'); await expect(extractRetainedPdf(wrong, ref(wrong), randomUUID())).rejects.toThrow('valid PDF');
    const malformed = Buffer.from('%PDF-1.4\nbroken'); await expect(extractRetainedPdf(malformed, ref(malformed), randomUUID())).rejects.toThrow('could not be parsed');
    const bytes = pdf(); await expect(extractRetainedPdf(bytes, { ...ref(bytes), checksum: 'a'.repeat(64) }, randomUUID())).rejects.toThrow('does not match');
  });
  it('supports cancellation before and during parsing', async () => {
    const bytes = pdf(); const controller = new AbortController(); controller.abort(new Error('canceled'));
    await expect(extractRetainedPdf(bytes, ref(bytes), randomUUID(), controller.signal)).rejects.toThrow('canceled');
    const live = new AbortController(); const work = extractRetainedPdf(bytes, ref(bytes), randomUUID(), live.signal);
    live.abort(new Error('stop parser')); await expect(work).rejects.toThrow('stop parser');
  });
});
describe('owned PDF acquisition', () => {
  function fixture() {
    const bytes = pdf(); const retained = ref(bytes); const scope = { ownerId: 'owner', draftId: randomUUID() };
    const source = { id: randomUUID(), kind: 'pdf' as const, input: { kind: 'upload' as const, assetId: retained.id }, selectedUnitIds: [], status: 'acquiring' as const };
    const readStream = vi.fn(async () => ({ ref: retained, mediaType: 'application/pdf', stream: (async function* () { yield bytes; })() }));
    const putJSON = vi.fn(async (_scope, value, options) => { options.schema.parse(value); return { id: randomUUID(), kind: 'artifact' as const, byteLength: 1000, checksum: 'b'.repeat(64) }; });
    return { bytes, retained, scope, source, readStream, putJSON, service: new PdfAcquisitionService({ readStream }, { putJSON }) };
  }
  it('reads owned raw bytes and returns an immutable artifact proposal', async () => {
    const f = fixture(); const manifest = await f.service.acquire(f.scope, f.source, 7);
    expect(f.readStream).toHaveBeenCalledWith(f.scope, f.retained.id, undefined);
    expect(f.putJSON.mock.calls[0][2].artifactType).toBe('pdf-extraction');
    expect(manifest.source.status).toBe('ready'); expect(manifest.extraction.complete).toBe(true);
    expect(manifest.inputRevision).toBe(7); expect(f.source.status).toBe('acquiring');
  });
  it('rejects non-PDF or foreign references before writing artifacts', async () => {
    const f = fixture(); f.readStream.mockResolvedValueOnce({ ref: f.retained, mediaType: 'text/plain', stream: (async function* () { yield f.bytes; })() });
    await expect(f.service.acquire(f.scope, f.source, 7)).rejects.toThrow('PDF upload');
    f.readStream.mockResolvedValueOnce({ ref: { ...f.retained, id: randomUUID() }, mediaType: 'application/pdf', stream: (async function* () { yield f.bytes; })() });
    await expect(f.service.acquire(f.scope, f.source, 7)).rejects.toThrow('does not match');
    expect(f.putJSON).not.toHaveBeenCalled();
  });
});

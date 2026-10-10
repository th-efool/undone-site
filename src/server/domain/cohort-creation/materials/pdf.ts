import 'server-only';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { PDF_LIMITS, pdfExtractionArtifactSchema } from '@/src/shared/cohort-creation/pdf';
import { CreationStorageError, type CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';
import { PDF_PARSER_VERSION, pdfExtractionVersion } from './pdf-identity';
import { segmentRetainedText } from './text';

const resultSchema = z.strictObject({ pages: z.array(z.string().min(1).max(MATERIAL_LIMITS.extractedTextBytes)).min(1).max(PDF_LIMITS.pages) });
const failureSchema = z.strictObject({ error: z.strictObject({ code: z.enum(['INVALID_INPUT', 'LIMIT_EXCEEDED']), message: z.string().min(1).max(1000) }) });

/** A terminable parser thread bounds CPU work independently of the durable job lease. */
export async function extractRetainedPdf(bytes: Uint8Array, sourceRef: CreationObjectRef, materialId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (bytes.byteLength > PDF_LIMITS.bytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'PDF exceeds 25 MiB. Select a smaller document; nothing was truncated.');
  if (sourceRef.kind !== 'upload' || bytes.byteLength !== sourceRef.byteLength ||
    createHash('sha256').update(bytes).digest('hex') !== sourceRef.checksum) throw new CreationStorageError('INTEGRITY', 'Retained PDF does not match its reference.');
  if (Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') throw new CreationStorageError('INVALID_INPUT', 'Provide a valid PDF document.');
  const moduleUrl = pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
  const pages = await new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-parser.worker.mjs', import.meta.url), {
      workerData: { bytes, moduleUrl, maxPages: PDF_LIMITS.pages, maxTextBytes: MATERIAL_LIMITS.extractedTextBytes },
      execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (error?: unknown, value?: string[]) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      void worker.terminate(); if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(signal?.reason ?? new DOMException('Canceled', 'AbortError'));
    const timer = setTimeout(() => finish(new CreationStorageError('LIMIT_EXCEEDED', 'PDF parsing exceeded 45 seconds. Select a smaller document or a text alternative.')), PDF_LIMITS.timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', value => {
      const failure = failureSchema.safeParse(value);
      if (failure.success) return finish(new CreationStorageError(failure.data.error.code, failure.data.error.message));
      const result = resultSchema.safeParse(value);
      if (!result.success) return finish(new CreationStorageError('INTEGRITY', 'Invalid PDF parser response.'));
      finish(undefined, result.data.pages);
    });
    worker.once('error', () => finish(new CreationStorageError('INVALID_INPUT', 'PDF parser failed or exceeded its memory scope. Supply a smaller PDF or text alternative.')));
    worker.once('exit', () => { if (!settled) finish(new CreationStorageError('UNAVAILABLE', 'PDF parser exited before completing. Retry or supply a text alternative.')); });
    if (signal?.aborted) abort();
  });
  signal?.throwIfAborted();
  const version = pdfExtractionVersion(sourceRef.checksum); let cursor = 0;
  const spans = pages.map((page, index) => { const start = cursor; cursor += page.length + (index < pages.length - 1 ? 2 : 0); return { page: index + 1, start, end: cursor }; });
  const text = pages.join('\n\n');
  if (Buffer.byteLength(text, 'utf8') > MATERIAL_LIMITS.extractedTextBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'PDF text exceeds 1 MiB; nothing was truncated.');
  const segments = spans.flatMap(page => segmentRetainedText(text.slice(page.start, page.end), materialId, materialId, `${version}:${page.page}`, signal)
    .map(segment => ({ ...segment, start: page.start + (segment.location.anchor.kind === 'text' ? segment.location.anchor.start : 0),
      end: page.start + (segment.location.anchor.kind === 'text' ? segment.location.anchor.end : 0),
      location: { ...segment.location, anchor: { kind: 'page' as const, page: page.page } } })));
  return pdfExtractionArtifactSchema.parse({ schemaVersion: 1, materialId, unitId: materialId, version, sourceChecksum: sourceRef.checksum,
    sourceRef, extractionKind: 'text', contentOrigin: 'user', offsetUnit: 'utf16', text, utf8ByteLength: Buffer.byteLength(text, 'utf8'),
    segments, coverage: { complete: true, omittedRanges: [] }, pdf: { parserVersion: PDF_PARSER_VERSION, format: 'page_text_items', pages: spans } });
}

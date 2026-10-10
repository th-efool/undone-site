import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { PDF_LIMITS, pdfExtractionArtifactSchema } from '@/src/shared/cohort-creation/pdf';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { MaterialBlobStore, CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { extractRetainedPdf } from './pdf';
import { PDF_PARSER_VERSION, pdfAcquisitionFingerprint } from './pdf-identity';

/** Immutable proposal only. The existing fenced job commit owns acceptance and pinning. */
export class PdfAcquisitionService {
  constructor(private readonly blobs: Pick<MaterialBlobStore, 'readStream'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON'>) {}
  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal) {
    signal?.throwIfAborted(); const source = materialSourceSchema.parse(input);
    if (!Number.isSafeInteger(inputRevision) || inputRevision < 0 || source.kind !== 'pdf' || source.input.kind !== 'upload' ||
      source.selectedUnitIds.length > 1 || source.selectedUnitIds.some(id => id !== source.id)) {
      throw new CreationStorageError('INVALID_INPUT', 'PDF acquisition requires an owned PDF upload and full-document selection.');
    }
    const opened = await this.blobs.readStream(scope, source.input.assetId, signal);
    if (opened.mediaType !== 'application/pdf') throw new CreationStorageError('INVALID_INPUT', 'Provide a PDF upload.');
    if (opened.ref.id !== source.input.assetId || opened.ref.kind !== 'upload') throw new CreationStorageError('INTEGRITY', 'Retained PDF reference does not match.');
    if (opened.ref.byteLength > PDF_LIMITS.bytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'PDF exceeds 25 MiB; nothing was truncated.');
    const pieces: Uint8Array[] = []; let size = 0;
    for await (const piece of opened.stream) {
      signal?.throwIfAborted(); size += piece.byteLength;
      if (size > PDF_LIMITS.bytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'PDF exceeds 25 MiB; nothing was truncated.');
      pieces.push(piece);
    }
    const extraction = await extractRetainedPdf(Buffer.concat(pieces), opened.ref, source.id, signal);
    const fingerprint = pdfAcquisitionFingerprint(source.id, inputRevision, opened.ref);
    const artifact = await this.artifacts.putJSON(scope, extraction, { artifactType: 'pdf-extraction', schemaVersion: 1,
      inputFingerprint: fingerprint, schema: pdfExtractionArtifactSchema, signal });
    signal?.throwIfAborted();
    return materialManifestSchema.parse({ schemaVersion: 1, inputRevision, source: { ...source, status: 'ready', selectedUnitIds: [source.id] },
      retainedSource: opened.ref, extraction: { materialId: source.id, version: extraction.version, checksum: opened.ref.checksum,
        artifactRef: artifact.id, extractionKind: 'text', segmentCount: extraction.segments.length, complete: true },
      extractionArtifact: artifact, parserVersion: PDF_PARSER_VERSION, inputFingerprint: fingerprint, acquiredAt: new Date().toISOString() });
  }
}

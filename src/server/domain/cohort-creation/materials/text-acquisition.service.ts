import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { MATERIAL_LIMITS, materialManifestSchema, textExtractionArtifactSchema } from '@/src/shared/cohort-creation/materials';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { MaterialBlobStore, CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { extractRetainedText, TEXT_PARSER_VERSION, textAcquisitionFingerprint } from './text';

/** Acquisition proposes retained artifacts; only the fenced job commit may accept/pin them. */
export class TextAcquisitionService {
  constructor(private readonly blobs: Pick<MaterialBlobStore, 'readStream'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON'>) {}

  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const source = materialSourceSchema.parse(input);
    if (!Number.isSafeInteger(inputRevision) || inputRevision < 0 || source.kind !== 'markdown' || source.input.kind !== 'upload') {
      throw new CreationStorageError('INVALID_INPUT', 'Text acquisition requires an owned text upload and valid revision.');
    }
    const unitId = source.id;
    if (source.selectedUnitIds.some(id => id !== unitId) || source.selectedUnitIds.length > 1) {
      throw new CreationStorageError('INVALID_INPUT', 'Select the retained text unit.');
    }
    const opened = await this.blobs.readStream(scope, source.input.assetId, signal);
    if (!['text/plain', 'text/markdown', 'text/x-markdown'].includes(opened.mediaType)) {
      throw new CreationStorageError('INVALID_INPUT', 'This acquisition adapter accepts text or Markdown only.');
    }
    if (opened.ref.id !== source.input.assetId || opened.ref.kind !== 'upload') {
      throw new CreationStorageError('INTEGRITY', 'The retained source reference does not match.');
    }
    if (opened.ref.byteLength > MATERIAL_LIMITS.extractedTextBytes) {
      throw new CreationStorageError('LIMIT_EXCEEDED', 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
    }
    const pieces: Uint8Array[] = []; let size = 0;
    for await (const piece of opened.stream) {
      signal?.throwIfAborted(); size += piece.byteLength;
      if (size > MATERIAL_LIMITS.extractedTextBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
      pieces.push(piece);
    }
    const extraction = extractRetainedText(Buffer.concat(pieces), opened.ref, source.id, unitId, signal);
    const fingerprint = textAcquisitionFingerprint(source.id, inputRevision, opened.ref);
    const artifact = await this.artifacts.putJSON(scope, extraction, { artifactType: 'text-extraction',
      schemaVersion: 1, inputFingerprint: fingerprint, schema: textExtractionArtifactSchema, signal });
    signal?.throwIfAborted();
    return materialManifestSchema.parse({ schemaVersion: 1, inputRevision,
      source: { ...source, status: 'ready', selectedUnitIds: [unitId] }, retainedSource: opened.ref,
      extraction: { materialId: source.id, version: extraction.version, checksum: opened.ref.checksum,
        artifactRef: artifact.id, extractionKind: 'text', segmentCount: extraction.segments.length, complete: true },
      extractionArtifact: artifact, parserVersion: TEXT_PARSER_VERSION, inputFingerprint: fingerprint,
      acquiredAt: new Date().toISOString() });
  }
}

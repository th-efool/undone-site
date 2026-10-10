import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { retainedWebCheckpointSchema, webExtractionArtifactSchema, webMaterialManifestSchema, webResponseReceiptSchema } from '@/src/shared/cohort-creation/web';
import type { CreationObjectRef, StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import type { MaterialBlobStore, CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import type { WebRetentionService } from './web-retention.service';
import type { RetainedWebCheckpoint } from '@/src/shared/cohort-creation/web';
import { extractWebResponse, WEB_PARSER_VERSION, webExtractionFingerprint } from './web-extraction';
import { WEB_HTML_LIMIT } from './web-extraction';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';

export class WebAcquisitionService {
  constructor(private readonly retention: Pick<WebRetentionService, 'retain'>,
    private readonly blobs: Pick<MaterialBlobStore, 'readStream'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'putJSON'>) {}

  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal,
    checkpoint?: (retained: RetainedWebCheckpoint) => Promise<void>) {
    const retained = await this.retention.retain(scope, input, inputRevision, signal);
    await checkpoint?.(retainedWebCheckpointSchema.parse({ phase: 'retained_web', receipt: retained.receipt, receiptArtifact: retained.receiptArtifact,
      receiptFingerprint: retained.inputFingerprint }));
    return this.extract(scope, input, inputRevision, retained.receiptArtifact, retained.inputFingerprint, signal);
  }
  async extract(scope: StorageScope, input: MaterialSource, inputRevision: number,
    receiptArtifact: CreationObjectRef, receiptFingerprint: string, signal?: AbortSignal) {
    const source = materialSourceSchema.parse(input);
    const receipt = await this.artifacts.getJSON(scope, receiptArtifact.id, { artifactType: 'web-response', schemaVersion: 1,
      inputFingerprint: receiptFingerprint, schema: webResponseReceiptSchema, signal });
    if (source.kind !== 'web' || source.input.kind !== 'url' || source.input.url !== receipt.requestedUrl ||
      source.id !== receipt.materialId || inputRevision !== receipt.inputRevision) throw new CreationStorageError('INTEGRITY', 'The web receipt does not match the selected source.');
    if (receipt.retainedSource.byteLength > (receipt.mediaType === 'text/html' ? WEB_HTML_LIMIT : MATERIAL_LIMITS.extractedTextBytes)) {
      throw new CreationStorageError('LIMIT_EXCEEDED', receipt.mediaType === 'text/html'
        ? 'HTML exceeds the 2 MiB parsing scope. Select a smaller page or paste an excerpt; nothing was truncated.'
        : 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
    }
    const opened = await this.blobs.readStream(scope, receipt.retainedSource.id, signal);
    if (opened.ref.id !== receipt.retainedSource.id || opened.ref.checksum !== receipt.retainedSource.checksum || opened.mediaType !== receipt.mediaType) throw new CreationStorageError('INTEGRITY', 'Stored web content does not match its receipt.');
    const pieces: Uint8Array[] = []; let size = 0;
    for await (const piece of opened.stream) {
      signal?.throwIfAborted(); size += piece.byteLength;
      if (size > receipt.retainedSource.byteLength) throw new CreationStorageError('INTEGRITY', 'Stored web content is longer than its receipt.');
      pieces.push(piece);
    }
    const extraction = extractWebResponse(Buffer.concat(pieces), receipt, signal);
    const inputFingerprint = webExtractionFingerprint(receipt);
    const artifact = await this.artifacts.putJSON(scope, extraction, { artifactType: 'web-extraction', schemaVersion: 1,
      inputFingerprint, schema: webExtractionArtifactSchema, signal });
    signal?.throwIfAborted();
    return webMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision,
      source: { ...source, selectedUnitIds: [source.id], status: 'ready' }, retainedSource: receipt.retainedSource,
      extraction: { materialId: source.id, version: extraction.version, checksum: receipt.retainedSource.checksum,
        artifactRef: artifact.id, extractionKind: 'text', segmentCount: extraction.segments.length, complete: true, selectionScope: extraction.web.scope },
      extractionArtifact: artifact, parserVersion: WEB_PARSER_VERSION, inputFingerprint, acquiredAt: new Date().toISOString(),
      receipt, receiptArtifact, receiptFingerprint });
  }
}

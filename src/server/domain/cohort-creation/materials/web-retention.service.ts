import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { webResponseReceiptSchema } from '@/src/shared/cohort-creation/web';
import { CREATION_STORAGE_LIMITS, CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { MaterialBlobStore, CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { openWebSource, nodeWebTransport, type WebTransport } from './web-fetch';
import { webReceiptFingerprint } from './web-identity';

/** Private retained bytes/provenance only. The future fenced worker accepts and pins artifacts. */
export class WebRetentionService {
  constructor(private readonly blobs: Pick<MaterialBlobStore, 'putStream'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON'>, private readonly transport: WebTransport = nodeWebTransport) {}

  async retain(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal) {
    const source = materialSourceSchema.parse(input);
    if (source.kind !== 'web' || source.input.kind !== 'url' || !Number.isSafeInteger(inputRevision) || inputRevision < 0 ||
      source.selectedUnitIds.some(id => id !== source.id) || source.selectedUnitIds.length > 1) {
      throw new CreationStorageError('INVALID_INPUT', 'Select one web source and a valid input revision.');
    }
    const opened = await openWebSource(source.input.url, signal, this.transport);
    try {
      const retainedSource = await this.blobs.putStream(scope, opened.bytes, { mediaType: opened.mediaType,
        maxBytes: CREATION_STORAGE_LIMITS.fileBytes, signal: opened.signal });
      opened.signal.throwIfAborted();
      const receipt = webResponseReceiptSchema.parse({ schemaVersion: 1, materialId: source.id, inputRevision,
        requestedUrl: opened.requestedUrl, finalUrl: opened.finalUrl, redirects: opened.redirects,
        mediaType: opened.mediaType, retainedSource, fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' });
      const inputFingerprint = webReceiptFingerprint(receipt);
      const receiptArtifact = await this.artifacts.putJSON(scope, receipt, { artifactType: 'web-response', schemaVersion: 1,
        inputFingerprint, schema: webResponseReceiptSchema, signal: opened.signal });
      opened.signal.throwIfAborted();
      return { receipt, receiptArtifact, inputFingerprint };
    } finally { opened.close(); }
  }
}

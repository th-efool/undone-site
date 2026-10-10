import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { notionReceiptSchema, retainedNotionCheckpointSchema, notionExtractionArtifactSchema, notionMaterialManifestSchema,
  NOTION_PARSER_VERSION, type RetainedNotionCheckpoint } from '@/src/shared/cohort-creation/notion';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { notionPageIdentity, type NotionMaterialReader } from './notion';
import { extractNotionReceipt, notionReceiptFingerprint, notionExtractionVersion, notionUnitId } from './notion-extraction';

export class NotionAcquisitionService {
  constructor(private readonly reader: Pick<NotionMaterialReader, 'read'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  private input(input: MaterialSource, inputRevision: number, maxUnits: number) {
    const source = materialSourceSchema.parse(input);
    if (source.kind !== 'notion' || source.input.kind !== 'url' || !Number.isSafeInteger(inputRevision) || inputRevision < 0) {
      throw new CreationStorageError('INVALID_INPUT', 'Select a Notion page and input revision.');
    }
    if (!Number.isSafeInteger(maxUnits) || maxUnits < 1 || maxUnits > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'This draft has no remaining page unit capacity.');
    const identity = notionPageIdentity(source.input.url);
    if (identity.url !== source.input.url) throw new CreationStorageError('INVALID_INPUT', 'Select a canonical Notion page URL.');
    return { source, identity };
  }
  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal,
    checkpoint?: (value: RetainedNotionCheckpoint) => Promise<void>, maxUnits = 100) {
    signal?.throwIfAborted(); const { source, identity } = this.input(input, inputRevision, maxUnits);
    const snapshot = await this.reader.read(identity.url, signal);
    if (snapshot.pageId !== identity.pageId || snapshot.sourceUrl !== identity.url) throw new CreationStorageError('INTEGRITY', 'Notion returned a different page.');
    const receipt = notionReceiptSchema.parse({ schemaVersion: 1, materialId: source.id, inputRevision, parserVersion: NOTION_PARSER_VERSION, snapshot });
    const inputFingerprint = notionReceiptFingerprint(source.id, inputRevision, identity.pageId);
    const artifact = await this.artifacts.putJSON(scope, receipt, { artifactType: 'notion-source', schemaVersion: 1, inputFingerprint, schema: notionReceiptSchema, signal });
    signal?.throwIfAborted();
    const retained = retainedNotionCheckpointSchema.parse({ phase: 'retained_notion', materialId: source.id, inputRevision,
      pageId: identity.pageId, pageEditedAt: snapshot.pageEditedAt, unitId: notionUnitId(identity.pageId), blockCount: snapshot.blocks.length,
      textBytes: snapshot.blocks.reduce((sum, block) => sum + Buffer.byteLength(block.text), 0), artifact, inputFingerprint });
    await checkpoint?.(retained);
    return this.extract(scope, source, inputRevision, retained, signal, maxUnits);
  }
  async extract(scope: StorageScope, input: MaterialSource, inputRevision: number, checkpoint: RetainedNotionCheckpoint,
    signal?: AbortSignal, maxUnits = 100) {
    signal?.throwIfAborted(); const { source, identity } = this.input(input, inputRevision, maxUnits);
    const retained = retainedNotionCheckpointSchema.parse(checkpoint); const fingerprint = notionReceiptFingerprint(source.id, inputRevision, identity.pageId);
    const ref = await this.artifacts.ref(scope, retained.artifact.id);
    if (ref.kind !== 'artifact' || ref.checksum !== retained.artifact.checksum || ref.byteLength !== retained.artifact.byteLength ||
      retained.inputFingerprint !== fingerprint || retained.pageId !== identity.pageId || retained.materialId !== source.id ||
      retained.inputRevision !== inputRevision || retained.unitId !== notionUnitId(identity.pageId)) throw new CreationStorageError('INTEGRITY', 'Retained Notion reference does not match its selected page and revision.');
    const receipt = await this.artifacts.getJSON(scope, ref.id, { artifactType: 'notion-source', schemaVersion: 1, inputFingerprint: fingerprint, schema: notionReceiptSchema, signal });
    if (receipt.materialId !== source.id || receipt.inputRevision !== inputRevision || receipt.snapshot.pageId !== identity.pageId ||
      receipt.snapshot.pageEditedAt !== retained.pageEditedAt || receipt.snapshot.blocks.length !== retained.blockCount ||
      receipt.snapshot.blocks.reduce((sum, block) => sum + Buffer.byteLength(block.text), 0) !== retained.textBytes) throw new CreationStorageError('INTEGRITY', 'Retained Notion source content does not match its checkpoint.');
    const extraction = extractNotionReceipt(receipt, ref, signal); const version = notionExtractionVersion(ref.checksum);
    const artifact = await this.artifacts.putJSON(scope, extraction, { artifactType: 'notion-extraction', schemaVersion: 1, inputFingerprint: version, schema: notionExtractionArtifactSchema, signal });
    signal?.throwIfAborted();
    return notionMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision,
      source: { ...source, status: 'ready', selectedUnitIds: [extraction.unitId] }, retainedSource: ref,
      extraction: { materialId: source.id, version, checksum: ref.checksum, artifactRef: artifact.id, extractionKind: 'text',
        complete: true, selectionScope: 'supported_page_text', segmentCount: extraction.blocks.reduce((sum, block) => sum + block.segments.length, 0) },
      extractionArtifact: artifact, parserVersion: NOTION_PARSER_VERSION, inputFingerprint: version, acquiredAt: new Date().toISOString(), notion: retained });
  }
}

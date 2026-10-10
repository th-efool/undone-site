import { createHash } from 'node:crypto';
import { notionReceiptSchema, notionExtractionArtifactSchema, NOTION_PARSER_VERSION, type NotionExtractionArtifact } from '@/src/shared/cohort-creation/notion';
import type { CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { segmentRetainedText } from './text';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const notionReceiptFingerprint = (materialId: string, inputRevision: number, pageId: string) =>
  hash(JSON.stringify({ materialId, inputRevision, pageId, parser: NOTION_PARSER_VERSION }));
export const notionExtractionVersion = (sourceChecksum: string) => hash(`${NOTION_PARSER_VERSION}:${sourceChecksum}`);
export const notionUnitId = (pageId: string) => hash(JSON.stringify(['notion-page-v1', pageId]));

export function extractNotionReceipt(value: unknown, artifact: CreationObjectRef, signal?: AbortSignal): NotionExtractionArtifact {
  signal?.throwIfAborted(); const receipt = notionReceiptSchema.parse(value);
  const version = notionExtractionVersion(artifact.checksum); const unitId = notionUnitId(receipt.snapshot.pageId); let count = 0;
  const blocks = receipt.snapshot.blocks.map(block => {
    signal?.throwIfAborted();
    const segments = segmentRetainedText(block.text, receipt.materialId, unitId, `${version}:${block.id}`, signal).map(segment => {
      const anchor = segment.location.anchor;
      if (anchor.kind !== 'text') throw new CreationStorageError('INTEGRITY', 'Invalid retained Notion text position.');
      if (++count > 20_000) throw new CreationStorageError('LIMIT_EXCEEDED', 'Notion text exceeds 20,000 sections. Select a smaller page; nothing was truncated.');
      return { id: segment.id, start: anchor.start, end: anchor.end, text: segment.text,
        location: { ...segment.location, anchor: { kind: 'block' as const, blockId: block.id } } };
    });
    return { id: block.id, parentId: block.parentId, depth: block.depth, editedAt: block.raw.last_edited_time,
      type: block.raw.type, text: block.text, omission: block.omission, segments };
  });
  return notionExtractionArtifactSchema.parse({ schemaVersion: 1, materialId: receipt.materialId, sourceArtifact: artifact,
    version, unitId, pageId: receipt.snapshot.pageId, pageEditedAt: receipt.snapshot.pageEditedAt, contentOrigin: 'external',
    coverage: { scope: 'supported_page_text', completeSupportedText: true }, blocks });
}

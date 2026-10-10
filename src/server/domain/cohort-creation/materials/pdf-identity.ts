import { createHash } from 'node:crypto';
import type { CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';

export const PDF_PARSER_VERSION = 'pdfjs-6.4.299-page-text-v1';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const pdfExtractionVersion = (checksum: string) => hash(`${PDF_PARSER_VERSION}:${checksum}`);
export const pdfAcquisitionFingerprint = (materialId: string, inputRevision: number, ref: CreationObjectRef) =>
  hash(JSON.stringify({ materialId, inputRevision, assetId: ref.id, checksum: ref.checksum, parser: PDF_PARSER_VERSION }));

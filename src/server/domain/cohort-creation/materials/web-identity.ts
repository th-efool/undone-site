import { createHash } from 'node:crypto';
import type { WebResponseReceipt } from '@/src/shared/cohort-creation/web';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const WEB_PARSER_VERSION = 'readability-0.6.0-jsdom-29.1.1-text-v1';
export const webExtractionVersion = (checksum: string) => hash(`${WEB_PARSER_VERSION}:${checksum}`);
export const webExtractionFingerprint = (receipt: WebResponseReceipt) => hash(JSON.stringify({ materialId: receipt.materialId,
  inputRevision: receipt.inputRevision, sourceId: receipt.retainedSource.id, checksum: receipt.retainedSource.checksum,
  requestedUrl: receipt.requestedUrl, finalUrl: receipt.finalUrl, parser: WEB_PARSER_VERSION }));
export const webReceiptFingerprint = (receipt: WebResponseReceipt) => hash(JSON.stringify({
  materialId: receipt.materialId, inputRevision: receipt.inputRevision, requestedUrl: receipt.requestedUrl,
  finalUrl: receipt.finalUrl, checksum: receipt.retainedSource.checksum, fetchVersion: receipt.fetchVersion,
}));

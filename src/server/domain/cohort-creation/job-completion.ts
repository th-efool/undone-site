import { recommendationResultSchema } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import type { CreationEvent } from '@/src/shared/cohort-creation/flow';
import type { ClaimedCreationJob, CreationCheckpoint } from './durable-job';
import { textAcquisitionFingerprint, textExtractionVersion, TEXT_PARSER_VERSION } from './materials/text';
import { retainedWebCheckpointSchema, webMaterialManifestSchema, type RetainedWebCheckpoint } from '@/src/shared/cohort-creation/web';
import { WEB_PARSER_VERSION, webExtractionFingerprint, webExtractionVersion, webReceiptFingerprint } from './materials/web-identity';
import type { ClaimedWebJob } from './durable-job';
import { PDF_PARSER_VERSION, pdfAcquisitionFingerprint, pdfExtractionVersion } from './materials/pdf-identity';

export function validateWebRetention(job: ClaimedWebJob, value: unknown): RetainedWebCheckpoint {
  const retained = retainedWebCheckpointSchema.parse(value);
  if (job.input.source.input.kind !== 'url' || job.input.source.id !== retained.receipt.materialId ||
    job.inputRevision !== retained.receipt.inputRevision || job.input.source.input.url !== retained.receipt.requestedUrl ||
    retained.receiptFingerprint !== webReceiptFingerprint(retained.receipt)) throw new Error('Invalid checkpoint input');
  return retained;
}

export function jobCompletion(job: ClaimedCreationJob, value: CreationCheckpoint): CreationEvent {
  if (job.kind === 'recommendations') {
    const result = recommendationResultSchema.parse(value);
    if (result.requestId !== job.requestId || result.inputRevision !== job.inputRevision || result.intent.rawQuery !== job.input.query) throw new Error('Invalid checkpoint input');
    return { type: 'recommendations_received', result };
  }
  if (job.kind === 'acquire_web') {
    const manifest = webMaterialManifestSchema.parse(value);
    validateWebRetention(job, { phase: 'retained_web', receipt: manifest.receipt, receiptArtifact: manifest.receiptArtifact,
      receiptFingerprint: manifest.receiptFingerprint });
    if (!manifest.extraction.complete || manifest.extraction.extractionKind !== 'text' || manifest.parserVersion !== WEB_PARSER_VERSION ||
      manifest.extraction.version !== webExtractionVersion(manifest.retainedSource.checksum) ||
      manifest.inputFingerprint !== webExtractionFingerprint(manifest.receipt) ||
      manifest.source.selectedUnitIds.length !== 1 || manifest.source.selectedUnitIds[0] !== manifest.source.id) throw new Error('Invalid checkpoint input');
    return { type: 'material_received', requestId: job.requestId, manifest };
  }
  const manifest = materialManifestSchema.parse(value);
  const pdf = job.kind === 'acquire_pdf';
  if (manifest.inputRevision !== job.inputRevision || manifest.source.id !== job.input.source.id ||
    manifest.source.kind !== (pdf ? 'pdf' : 'markdown') || manifest.source.input.kind !== 'upload' || job.input.source.input.kind !== 'upload' ||
    manifest.source.input.assetId !== job.input.source.input.assetId || manifest.retainedSource.id !== manifest.source.input.assetId ||
    manifest.retainedSource.kind !== 'upload' || !manifest.extraction.complete || manifest.extraction.extractionKind !== 'text' ||
    manifest.source.selectedUnitIds.length !== 1 || manifest.source.selectedUnitIds[0] !== manifest.source.id ||
    manifest.parserVersion !== (pdf ? PDF_PARSER_VERSION : TEXT_PARSER_VERSION) || manifest.extraction.version !== (pdf ? pdfExtractionVersion : textExtractionVersion)(manifest.retainedSource.checksum) ||
    manifest.inputFingerprint !== (pdf ? pdfAcquisitionFingerprint : textAcquisitionFingerprint)(manifest.source.id, job.inputRevision, manifest.retainedSource)) throw new Error('Invalid checkpoint input');
  return { type: 'material_received', requestId: job.requestId, manifest };
}

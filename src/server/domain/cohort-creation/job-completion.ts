import { recommendationResultSchema } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import type { CreationEvent } from '@/src/shared/cohort-creation/flow';
import type { ClaimedCreationJob, CreationCheckpoint } from './durable-job';
import { textAcquisitionFingerprint, textExtractionVersion, TEXT_PARSER_VERSION } from './materials/text';

export function jobCompletion(job: ClaimedCreationJob, value: CreationCheckpoint): CreationEvent {
  if (job.kind === 'recommendations') {
    const result = recommendationResultSchema.parse(value);
    if (result.requestId !== job.requestId || result.inputRevision !== job.inputRevision || result.intent.rawQuery !== job.input.query) throw new Error('Invalid checkpoint input');
    return { type: 'recommendations_received', result };
  }
  const manifest = materialManifestSchema.parse(value);
  if (manifest.inputRevision !== job.inputRevision || manifest.source.id !== job.input.source.id ||
    manifest.source.kind !== 'markdown' || manifest.source.input.kind !== 'upload' || job.input.source.input.kind !== 'upload' ||
    manifest.source.input.assetId !== job.input.source.input.assetId || manifest.retainedSource.id !== manifest.source.input.assetId ||
    manifest.retainedSource.kind !== 'upload' || !manifest.extraction.complete || manifest.extraction.extractionKind !== 'text' ||
    manifest.source.selectedUnitIds.length !== 1 || manifest.source.selectedUnitIds[0] !== manifest.source.id ||
    manifest.parserVersion !== TEXT_PARSER_VERSION || manifest.extraction.version !== textExtractionVersion(manifest.retainedSource.checksum) ||
    manifest.inputFingerprint !== textAcquisitionFingerprint(manifest.source.id, job.inputRevision, manifest.retainedSource)) throw new Error('Invalid checkpoint input');
  return { type: 'material_received', requestId: job.requestId, manifest };
}

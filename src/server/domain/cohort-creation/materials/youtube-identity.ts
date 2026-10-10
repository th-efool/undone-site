import { createHash } from 'node:crypto';
import type { YoutubeObservationRequest } from '@/src/shared/cohort-creation/jobs';
import { youtubeObservationCheckpointSchema, type YoutubeObservationCheckpoint } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

export const YOUTUBE_BUNDLE_VERSION = 'youtube-selected-observations-v1';
export const youtubeMaterialVersion = (checkpoint: YoutubeObservationCheckpoint) => createHash('sha256')
  .update(JSON.stringify({ parser: YOUTUBE_BUNDLE_VERSION, checkpoint: youtubeObservationCheckpointSchema.parse(checkpoint) })).digest('hex');

/** Validates checkpoint identity before any retained content is read or a model is called. */
export function validateYoutubeCheckpoint(input: YoutubeObservationRequest, value: unknown) {
  const checkpoint = youtubeObservationCheckpointSchema.parse(value); const metadata = input.metadata;
  const selected = input.source.selectedUnitIds;
  if (checkpoint.materialId !== input.source.id || checkpoint.inputRevision !== input.inputRevision ||
    checkpoint.sourceRevision !== metadata.sourceRevision || checkpoint.metadataFingerprint !== metadata.metadataFingerprint ||
    JSON.stringify(checkpoint.metadataArtifact) !== JSON.stringify(metadata.metadataArtifact) ||
    checkpoint.units.some(unit => !selected.includes(unit.unitId)) ||
    JSON.stringify(checkpoint.units.map(unit => unit.unitId)) !== JSON.stringify(selected.filter(id => checkpoint.units.some(unit => unit.unitId === id))) ||
    metadata.observations.some(previous => !checkpoint.units.some(unit => JSON.stringify(unit) === JSON.stringify(previous)))) {
    throw new CreationStorageError('INTEGRITY', 'Observation checkpoint does not match the saved selection and retained work.');
  }
  return checkpoint;
}

import 'server-only';
import { creationArtifactRefSchema, youtubeUnitObservationRefSchema } from '@/src/shared/cohort-creation/contracts';
import { youtubeObservationRequestSchema, type YoutubeObservationRequest } from '@/src/shared/cohort-creation/jobs';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { youtubeMaterialManifestSchema, youtubeObservationCheckpointSchema, type YoutubeObservationCheckpoint } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import type { YoutubeObservationService } from './youtube-observation.service';
import { validateYoutubeCheckpoint, youtubeMaterialVersion, YOUTUBE_BUNDLE_VERSION } from './youtube-identity';

export class YoutubeAcquisitionService {
  constructor(private readonly observations: Pick<YoutubeObservationService, 'observeUnit' | 'resumeUnit'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON'>) {}

  async acquire(scope: StorageScope, request: YoutubeObservationRequest, signal: AbortSignal,
    save: (checkpoint: YoutubeObservationCheckpoint) => Promise<void>, saved?: YoutubeObservationCheckpoint) {
    signal.throwIfAborted(); const input = youtubeObservationRequestSchema.parse(request); const metadata = input.metadata;
    let checkpoint = validateYoutubeCheckpoint(input, saved ?? { phase: 'youtube_observations', materialId: input.source.id,
      inputRevision: input.inputRevision, sourceRevision: metadata.sourceRevision, metadataArtifact: metadata.metadataArtifact,
      metadataFingerprint: metadata.metadataFingerprint,
      units: input.source.selectedUnitIds.flatMap(id => metadata.observations.filter(unit => unit.unitId === id)) });
    const verified = new Map<string, typeof checkpoint.units[number]>();
    // Verify all retained units before paying for another observation, including non-prefix selections.
    for (const unit of checkpoint.units) {
      const retained = await this.observations.resumeUnit(scope, unit.artifact, unit.version, metadata.metadataArtifact,
        metadata.metadataFingerprint, input.source.id, metadata.sourceRevision, unit.unitId, signal);
      const actual = this.reference(unit.unitId, retained);
      if (JSON.stringify(actual) !== JSON.stringify(unit)) throw new CreationStorageError('INTEGRITY', 'Retained observation counts do not match.');
      verified.set(unit.unitId, actual);
    }
    for (const unitId of input.source.selectedUnitIds) {
      signal.throwIfAborted(); if (verified.has(unitId)) continue;
      const result = await this.observations.observeUnit(scope, metadata.metadataArtifact, metadata.metadataFingerprint,
        input.source.id, metadata.sourceRevision, unitId, signal);
      const unit = this.reference(unitId, result);
      if ([...verified.values(), unit].reduce((sum, item) => sum + item.textBytes, 0) > MATERIAL_LIMITS.extractedTextBytes) {
        throw new CreationStorageError('LIMIT_EXCEEDED', 'Video observations exceed 1 MiB. Select fewer videos; nothing was truncated.');
      }
      verified.set(unitId, unit);
      checkpoint = validateYoutubeCheckpoint(input, { ...checkpoint, units: input.source.selectedUnitIds.flatMap(id => {
        const item = verified.get(id); return item ? [item] : [];
      }) });
      signal.throwIfAborted(); await save(checkpoint); // Fenced persistence must succeed before advancing.
    }
    signal.throwIfAborted(); const version = youtubeMaterialVersion(checkpoint);
    const artifact = await this.artifacts.putJSON(scope, checkpoint, { artifactType: 'youtube-material', schemaVersion: 1,
      inputFingerprint: version, schema: youtubeObservationCheckpointSchema, signal });
    signal.throwIfAborted();
    return youtubeMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: input.inputRevision,
      source: { ...input.source, status: 'ready' }, retainedSource: metadata.metadataArtifact, youtube: checkpoint,
      extraction: { materialId: input.source.id, version, checksum: metadata.metadataArtifact.checksum, artifactRef: artifact.id,
        extractionKind: 'video_observation', selectionScope: 'video_observation', complete: false,
        segmentCount: checkpoint.units.reduce((sum, unit) => sum + unit.segmentCount, 0) },
      extractionArtifact: artifact, parserVersion: YOUTUBE_BUNDLE_VERSION, inputFingerprint: version, acquiredAt: new Date().toISOString() });
  }

  private reference(unitId: string, result: Awaited<ReturnType<YoutubeObservationService['observeUnit']>>) {
    const textBytes = result.observation.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text, 'utf8'), 0);
    if (textBytes > MATERIAL_LIMITS.extractedTextBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Video observations exceed 1 MiB. Select a shorter video; nothing was truncated.');
    return youtubeUnitObservationRefSchema.parse({ unitId, artifact: creationArtifactRefSchema.parse(result.artifact),
      version: result.inputFingerprint, segmentCount: result.observation.segments.length,
      textBytes });
  }
}

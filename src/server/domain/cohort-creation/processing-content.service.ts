import 'server-only';
import type { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { textExtractionArtifactSchema } from '@/src/shared/cohort-creation/materials';
import { webExtractionArtifactSchema } from '@/src/shared/cohort-creation/web';
import { pdfExtractionArtifactSchema } from '@/src/shared/cohort-creation/pdf';
import { githubExtractionArtifactSchema } from '@/src/shared/cohort-creation/github';
import { notionExtractionArtifactSchema } from '@/src/shared/cohort-creation/notion';
import { youtubeObservationCheckpointSchema } from '@/src/shared/cohort-creation/youtube';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { youtubeObservationArtifactSchema } from './materials/youtube-artifacts';
import { normalizeProcessingInput, partitionProcessingInput, type ProcessingUnit } from './processing-input';

function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Processing content does not match the owned accepted draft.'); }

/** Reads only existing accepted artifacts. No acquisition, models, mutations or implicit source replacement. */
export class ProcessingContentService {
  constructor(private readonly artifacts: Pick<CreationArtifactRepository, 'describeArtifact' | 'getJSON'>) {}

  async load(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    if (scope.draftId !== state.draftId || !state.result || !state.materials.length || state.materials.some(source => source.status !== 'ready') ||
      state.extractions.length !== state.materials.length) invalid();
    const units: ProcessingUnit[] = [];
    for (const source of state.materials) {
      signal.throwIfAborted(); const accepted = state.extractions.find(item => item.materialId === source.id);
      const ids = state.materialRefs.find(item => item.materialId === source.id)?.ids;
      if (!accepted || !ids?.includes(accepted.artifactRef)) invalid();
      const read = async <T extends z.ZodType>(id: string, artifactType: string, schema: T, expected?: CreationObjectRef, fingerprint?: string) => {
        signal.throwIfAborted(); if (!ids.includes(id)) invalid();
        const header = await this.artifacts.describeArtifact(scope, id);
        if (header.ref.kind !== 'artifact' || header.ref.id !== id || header.artifactType !== artifactType || header.schemaVersion !== 1 ||
          expected && (header.ref.checksum !== expected.checksum || header.ref.byteLength !== expected.byteLength) ||
          fingerprint && header.inputFingerprint !== fingerprint) invalid();
        return this.artifacts.getJSON(scope, id, { artifactType, schemaVersion: 1, inputFingerprint: header.inputFingerprint, schema, signal });
      };
      let body: unknown; const observations: unknown[] = [];
      if (source.kind === 'youtube_video' || source.kind === 'youtube_playlist') {
        const bundle = await read(accepted.artifactRef, 'youtube-material', youtubeObservationCheckpointSchema, undefined, accepted.version);
        const preview = state.youtubeSources.find(item => item.materialId === source.id);
        if (!preview || preview.sourceRevision !== bundle.sourceRevision || preview.metadataFingerprint !== bundle.metadataFingerprint ||
          JSON.stringify(preview.metadataArtifact) !== JSON.stringify(bundle.metadataArtifact) ||
          JSON.stringify(preview.observations) !== JSON.stringify(bundle.units)) invalid();
        for (const unit of bundle.units) observations.push(await read(unit.artifact.id, 'youtube-observation', youtubeObservationArtifactSchema, unit.artifact, unit.version));
        body = bundle;
      } else if (source.kind === 'github') body = await read(accepted.artifactRef, 'github-extraction', githubExtractionArtifactSchema, undefined, accepted.version);
      else if (source.kind === 'notion') body = await read(accepted.artifactRef, 'notion-extraction', notionExtractionArtifactSchema, undefined, accepted.version);
      else if (source.kind === 'web') body = await read(accepted.artifactRef, 'web-extraction', webExtractionArtifactSchema);
      else if (source.kind === 'pdf') body = await read(accepted.artifactRef, 'pdf-extraction', pdfExtractionArtifactSchema);
      else if (source.kind === 'markdown') body = await read(accepted.artifactRef, 'text-extraction', textExtractionArtifactSchema);
      else invalid();
      signal.throwIfAborted(); units.push(...normalizeProcessingInput(source, accepted, body, observations, signal));
    }
    signal.throwIfAborted(); return { units, partitions: partitionProcessingInput(units, undefined, signal) };
  }
}

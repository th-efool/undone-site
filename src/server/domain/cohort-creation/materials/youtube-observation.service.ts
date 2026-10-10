import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';
import { retainedYoutubeMetadataSchema } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { observationModelIdentitySchema, validateVideoObservation, videoObservationCoverage, type MaterialObservation } from '../material-observation';
import type { YoutubeMetadataReader } from './youtube-metadata';
import { youtubeSourceUrl } from './youtube-url';
import { YOUTUBE_METADATA_VERSION, youtubeMetadataFingerprint, youtubeMetadataReceiptSchema,
  youtubeObservationArtifactSchema, youtubeObservationVersion, youtubeObservationSegmentId } from './youtube-artifacts';

export class YoutubeMetadataRetentionService {
  constructor(private readonly reader: Pick<YoutubeMetadataReader, 'read'>,
    protected readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}

  async retainMetadata(scope: StorageScope, input: MaterialSource, inputRevision: number, signal?: AbortSignal) {
    signal?.throwIfAborted(); const source = materialSourceSchema.parse(input);
    if (source.input.kind !== 'url' || !Number.isSafeInteger(inputRevision) || inputRevision < 0) throw new CreationStorageError('INVALID_INPUT', 'A YouTube URL and valid revision are required.');
    const canonical = youtubeSourceUrl(source.input.url);
    if (source.kind !== canonical.kind) throw new CreationStorageError('INVALID_INPUT', 'YouTube source kind does not match its URL.');
    const metadata = await this.reader.read(canonical.url, signal);
    if (metadata.sourceUrl !== canonical.url || metadata.kind !== canonical.kind || source.selectedUnitIds.some(id => !metadata.units.some(unit => unit.videoId === id))) {
      throw new CreationStorageError('INTEGRITY', 'YouTube metadata does not match the selected source.');
    }
    const receipt = youtubeMetadataReceiptSchema.parse({ schemaVersion: 1, materialId: source.id, inputRevision,
      parserVersion: YOUTUBE_METADATA_VERSION, metadata });
    const fingerprint = youtubeMetadataFingerprint(source.id, inputRevision, canonical.url);
    const artifact = await this.artifacts.putJSON(scope, receipt, { artifactType: 'youtube-metadata', schemaVersion: 1,
      inputFingerprint: fingerprint, schema: youtubeMetadataReceiptSchema, signal });
    signal?.throwIfAborted(); return retainedYoutubeMetadataSchema.parse({ receipt, artifact, inputFingerprint: fingerprint });
  }
}
export class YoutubeObservationService extends YoutubeMetadataRetentionService {
  constructor(reader: Pick<YoutubeMetadataReader, 'read'>, private readonly observer: MaterialObservation,
    artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) { super(reader, artifacts); }
  private async receipt(scope: StorageScope, inputRef: CreationObjectRef, fingerprint: string, materialId: string, inputRevision: number, signal?: AbortSignal) {
    const ref = retainedObjectRefSchema.extend({ kind: retainedObjectRefSchema.shape.kind.extract(['artifact']) }).parse(inputRef);
    const owned = await this.artifacts.ref(scope, ref.id);
    if (owned.kind !== ref.kind || owned.checksum !== ref.checksum || owned.byteLength !== ref.byteLength) throw new CreationStorageError('INTEGRITY', 'YouTube metadata reference does not match.');
    const receipt = await this.artifacts.getJSON(scope, ref.id, { artifactType: 'youtube-metadata', schemaVersion: 1,
      inputFingerprint: fingerprint, schema: youtubeMetadataReceiptSchema, signal });
    if (receipt.materialId !== materialId || receipt.inputRevision !== inputRevision ||
      youtubeMetadataFingerprint(materialId, inputRevision, receipt.metadata.sourceUrl) !== fingerprint) throw new CreationStorageError('INTEGRITY', 'YouTube metadata revision or source does not match.');
    return receipt;
  }
  async observeUnit(scope: StorageScope, metadataRef: CreationObjectRef, fingerprint: string, materialId: string,
    inputRevision: number, unitId: string, signal: AbortSignal) {
    signal.throwIfAborted(); const receipt = await this.receipt(scope, metadataRef, fingerprint, materialId, inputRevision, signal);
    const video = receipt.metadata.units.find(unit => unit.videoId === unitId);
    if (!video) throw new CreationStorageError('INVALID_INPUT', 'Select a video from the retained metadata.');
    const model = observationModelIdentitySchema.parse(this.observer.identity);
    const proposal = validateVideoObservation(await this.observer.observeVideo(video, signal), video);
    signal.throwIfAborted();
    const identity = { materialId, unitId, inputRevision, metadataFingerprint: fingerprint, metadataArtifact: metadataRef, video, model, proposal };
    const version = youtubeObservationVersion(identity);
    const value = youtubeObservationArtifactSchema.parse({ ...identity, schemaVersion: 1, version,
      extractionKind: 'video_observation', contentOrigin: 'ai', observedAt: new Date().toISOString(),
      coverage: videoObservationCoverage(proposal, video), segments: proposal.observations.map((observation, index) => {
        const id = youtubeObservationSegmentId(version, index);
        return { id, text: observation.text, location: { materialId, unitId, segmentId: id,
          anchor: { kind: 'video', startSeconds: observation.startSeconds, endSeconds: observation.endSeconds, estimated: true } } };
      }) });
    const artifact = await this.artifacts.putJSON(scope, value, { artifactType: 'youtube-observation', schemaVersion: 1,
      inputFingerprint: version, schema: youtubeObservationArtifactSchema, signal });
    signal.throwIfAborted(); return { observation: value, artifact, inputFingerprint: version };
  }
  async resumeUnit(scope: StorageScope, inputRef: CreationObjectRef, version: string, metadataRef: CreationObjectRef,
    fingerprint: string, materialId: string, inputRevision: number, unitId: string, signal?: AbortSignal) {
    signal?.throwIfAborted(); const receipt = await this.receipt(scope, metadataRef, fingerprint, materialId, inputRevision, signal);
    const ref = retainedObjectRefSchema.parse(inputRef); const owned = await this.artifacts.ref(scope, ref.id);
    if (ref.kind !== 'artifact' || owned.kind !== ref.kind || owned.checksum !== ref.checksum || owned.byteLength !== ref.byteLength) throw new CreationStorageError('INTEGRITY', 'YouTube observation reference does not match.');
    const observation = await this.artifacts.getJSON(scope, ref.id, { artifactType: 'youtube-observation', schemaVersion: 1,
      inputFingerprint: version, schema: youtubeObservationArtifactSchema, signal });
    const video = receipt.metadata.units.find(unit => unit.videoId === unitId);
    if (observation.materialId !== materialId || observation.inputRevision !== inputRevision || observation.unitId !== unitId ||
      observation.metadataArtifact.id !== metadataRef.id || observation.metadataArtifact.checksum !== metadataRef.checksum ||
      observation.metadataFingerprint !== fingerprint || observation.version !== version || JSON.stringify(observation.video) !== JSON.stringify(video)) {
      throw new CreationStorageError('INTEGRITY', 'YouTube observation does not match its retained source or revision.');
    }
    signal?.throwIfAborted(); return { observation, artifact: ref, inputFingerprint: version };
  }
}

import 'server-only';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { deliveryArtifactSchema, publicationCheckpointSchema, type DeliveryArtifact, type PublicationCheckpoint, type PublicationMode } from '@/src/shared/cohort-creation/publication';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { acceptedBuilding, type BuildingContentService } from './building-content.service';
import { projectReview } from './review.service';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Publication no longer matches the reviewed owned source and artifact inventory.'); }
export const publicationLessonId = (cohortId: string, lessonId: string) => hash(['creation-published-lesson-v1', cohortId, lessonId]);
export const publicationSeasonId = (cohortId: string, seasonId: string) => hash(['creation-published-season-v1', cohortId, seasonId]);
export const publicationSourceId = (cohortId: string, materialId: string) => hash(['creation-published-source-v1', cohortId, materialId]);
export function publicationSnapshotHash(input: CreationSnapshot) {
  const snapshot = creationSnapshotSchema.parse(input); const building = acceptedBuilding(snapshot); const review = snapshot.review;
  if (!review || review.orphanedLessonIds.length || review.request || review.proposal || review.buildFingerprint !== building.inputFingerprint) invalid();
  return hash({ version: 'creation-publication-v1', draftId: snapshot.draftId, inputRevision: snapshot.inputRevision,
    intent: snapshot.result?.intent, materials: snapshot.materials, extractions: snapshot.extractions, materialRefs: snapshot.materialRefs,
    building, review: { ...review, request: null, proposal: null, invalidated: [] } });
}
export const publicationArtifactFingerprint = (snapshotHash: string, lessonId: string) => hash(['creation-delivery-v1', snapshotHash, lessonId]);
export function validatePublicationCheckpoint(snapshot: CreationSnapshot, requestId: string, mode: PublicationMode, cohortId: string, value: unknown) {
  const checkpoint = publicationCheckpointSchema.parse(value);
  if (checkpoint.requestId !== requestId || checkpoint.mode !== mode || checkpoint.cohortId !== cohortId ||
    checkpoint.snapshotHash !== publicationSnapshotHash(snapshot) || JSON.stringify(checkpoint.lessonIds) !== JSON.stringify(snapshot.review?.lessonIds)) invalid();
  return checkpoint;
}

/** Artifacts are prepared and validated before any relational cohort is exposed. */
export class PublicationService {
  constructor(private readonly content: Pick<BuildingContentService, 'load'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  async run(scope: StorageScope, input: CreationSnapshot, requestId: string, mode: PublicationMode, cohortId: string, signal: AbortSignal,
    save: (checkpoint: PublicationCheckpoint) => Promise<void>, saved?: PublicationCheckpoint) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(input);
    if (scope.draftId !== snapshot.draftId || !snapshot.review) invalid();
    const snapshotHash = publicationSnapshotHash(snapshot);
    let checkpoint = saved ? validatePublicationCheckpoint(snapshot, requestId, mode, cohortId, saved) : publicationCheckpointSchema.parse({
      phase: 'publication', requestId, mode, cohortId, snapshotHash, total: snapshot.review.lessonIds.length, lessonIds: snapshot.review.lessonIds, completed: [] });
    if (checkpoint.completed.length === checkpoint.total) { await this.loadPrepared(scope, snapshot, checkpoint, signal); return checkpoint; }
    const loaded = await this.content.load(scope, snapshot, signal); const curriculum = projectReview(loaded.curriculum, snapshot.review);
    const chunks = new Map(loaded.chunks.flat().map(chunk => [chunk.id, chunk]));
    const analyses = new Map(loaded.analyses.flat().map(analysis => [analysis.chunkId, analysis]));
    const segments = new Map(loaded.partitions.flatMap(partition => partition.segments.map(segment => [JSON.stringify([partition.materialId, partition.unitId, segment.id]), segment] as const)));
    if (!saved) await save(checkpoint);
    const lessons = curriculum.seasons.flatMap(season => season.lessons);
    if (JSON.stringify(lessons.map(lesson => lesson.id)) !== JSON.stringify(checkpoint.lessonIds)) invalid();
    for (const [index, lesson] of lessons.entries()) {
      signal.throwIfAborted();
      const expected = deliveryArtifactSchema.parse({ schemaVersion: 1, requestId, snapshotHash, cohortId,
        lessonId: publicationLessonId(cohortId, lesson.id), sourceLessonId: lesson.id, buildingFingerprint: curriculum.version,
        title: lesson.title.value, objectives: lesson.objectives.value, chunks: lesson.chunkIds.map((id, order) => {
          const chunk = chunks.get(id); const analysis = analyses.get(id); if (!chunk || !analysis) invalid();
          const video = chunk.sourceRefs.filter(ref => ref.anchor.kind === 'video');
          return { id: chunk.id, title: chunk.title.value, text: chunk.sourceRefs.map(ref => {
            const segment = segments.get(JSON.stringify([ref.materialId, ref.unitId, ref.segmentId]));
            if (!segment || !isDeepStrictEqual(segment.location, ref)) invalid(); return segment.text;
          }).join(''), sourceRefs: chunk.sourceRefs, contentOrigin: chunk.contentOrigin, coverage: chunk.coverage,
          durationSeconds: chunk.durationSeconds, durationMethod: chunk.durationMethod, vector: analysis.vector, isStrictlyLinear: analysis.isStrictlyLinear, order,
          ...(video.length ? { startSeconds: Math.min(...video.map(ref => ref.anchor.kind === 'video' ? ref.anchor.startSeconds : 0)),
            endSeconds: Math.max(...video.map(ref => ref.anchor.kind === 'video' ? ref.anchor.endSeconds : 0)) } : {}) };
        }) });
      const existing = checkpoint.completed[index];
      if (existing) { const actual = await this.read(scope, checkpoint, existing, signal); if (!isDeepStrictEqual(actual, expected)) invalid(); continue; }
      const artifact = await this.artifacts.putJSON(scope, expected, this.options(snapshotHash, lesson.id, signal));
      signal.throwIfAborted(); checkpoint = publicationCheckpointSchema.parse({ ...checkpoint, completed: [...checkpoint.completed, { lessonId: lesson.id, artifact }] });
      await save(checkpoint);
    }
    signal.throwIfAborted(); return checkpoint;
  }
  private options(snapshotHash: string, lessonId: string, signal: AbortSignal) {
    return { artifactType: 'creation-delivery', schemaVersion: 1, inputFingerprint: publicationArtifactFingerprint(snapshotHash, lessonId), schema: deliveryArtifactSchema, signal };
  }
  private async read(scope: StorageScope, checkpoint: PublicationCheckpoint, entry: PublicationCheckpoint['completed'][number], signal: AbortSignal): Promise<DeliveryArtifact> {
    const actual = await this.artifacts.ref(scope, entry.artifact.id);
    if (!isDeepStrictEqual(actual, entry.artifact)) invalid();
    const artifact = await this.artifacts.getJSON(scope, entry.artifact.id, this.options(checkpoint.snapshotHash, entry.lessonId, signal));
    if (artifact.requestId !== checkpoint.requestId || artifact.cohortId !== checkpoint.cohortId || artifact.snapshotHash !== checkpoint.snapshotHash ||
      artifact.sourceLessonId !== entry.lessonId || artifact.lessonId !== publicationLessonId(checkpoint.cohortId, entry.lessonId)) invalid();
    return artifact;
  }
  /** Complete-checkpoint recovery needs retained delivery artifacts only, no provider or acquisition availability. */
  async loadPrepared(scope: StorageScope, input: CreationSnapshot, value: PublicationCheckpoint, signal: AbortSignal) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(input);
    if (scope.draftId !== snapshot.draftId) invalid();
    const checkpoint = validatePublicationCheckpoint(snapshot, value.requestId, value.mode, value.cohortId, value);
    if (checkpoint.completed.length !== checkpoint.total) invalid();
    const result: DeliveryArtifact[] = [];
    for (const entry of checkpoint.completed) {
      signal.throwIfAborted(); const artifact = await this.read(scope, checkpoint, entry, signal);
      if (artifact.buildingFingerprint !== snapshot.review?.buildFingerprint || artifact.chunks.some(chunk => chunk.sourceRefs.some(ref => !snapshot.materials.some(material => material.id === ref.materialId)))) invalid();
      result.push(artifact);
    }
    if (new Set(result.flatMap(artifact => artifact.chunks.map(chunk => chunk.id))).size !== result.reduce((sum, artifact) => sum + artifact.chunks.length, 0)) invalid();
    signal.throwIfAborted(); return result;
  }
}

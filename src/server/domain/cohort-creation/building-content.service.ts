import 'server-only';
import { createHash } from 'node:crypto';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { generatedCurriculumSchema, type GeneratedCurriculum } from '@/src/shared/cohort-creation/artifacts';
import { buildingReceiptSchema } from '@/src/shared/cohort-creation/build';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { AnalysisContentService } from './analysis-content.service';
import { buildingArtifactFingerprint, validateBuildingCheckpoint } from './building.service';
import { groundBuildProposal } from './build';
import { understandingSourceIdentity } from './understanding.service';

function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Accepted curriculum does not match the owned analysis and source inventory.'); }
export function acceptedBuilding(input: CreationSnapshot) {
  const state = creationSnapshotSchema.parse(input); const accepted = state.processing?.building;
  if (!accepted?.complete || !accepted.checkpoint || !state.result) invalid();
  const checkpoint = validateBuildingCheckpoint(state, accepted.requestId, accepted.checkpoint);
  if (checkpoint.completed.length !== checkpoint.total) invalid();
  return checkpoint;
}

/** Reconstructs review/delivery data from owned receipts, never from arbitrary client/model JSON. */
export class BuildingContentService {
  constructor(private readonly content: Pick<AnalysisContentService, 'load'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>) {}
  async load(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    if (scope.draftId !== state.draftId || !state.result) invalid();
    const checkpoint = acceptedBuilding(state); const loaded = await this.content.load(scope, state, signal);
    if (checkpoint.analysisFingerprint !== loaded.checkpoint.inputFingerprint ||
      JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(loaded.checkpoint.partitionIds)) invalid();
    const seasons: GeneratedCurriculum['seasons'] = []; const unitSeasons = new Map<string, GeneratedCurriculum['seasons'][number]>();
    const warnings = new Set<string>();
    for (const [index, partition] of loaded.partitions.entries()) {
      signal.throwIfAborted(); const retained = checkpoint.completed[index]; const actual = await this.artifacts.ref(scope, retained.artifact.id);
      if (actual.kind !== 'artifact' || actual.id !== retained.artifact.id || actual.checksum !== retained.artifact.checksum || actual.byteLength !== retained.artifact.byteLength) invalid();
      const receipt = await this.artifacts.getJSON(scope, retained.artifact.id, { artifactType: 'creation-building', schemaVersion: 1,
        inputFingerprint: buildingArtifactFingerprint(checkpoint.inputFingerprint, partition.id), schema: buildingReceiptSchema, signal });
      const dependency = loaded.analysisReceipts[index].artifact;
      if (receipt.requestId !== checkpoint.requestId || receipt.inputFingerprint !== checkpoint.inputFingerprint || receipt.partitionId !== partition.id ||
        JSON.stringify(receipt.source) !== JSON.stringify(understandingSourceIdentity(partition)) || receipt.analysis.inputFingerprint !== loaded.checkpoint.inputFingerprint ||
        receipt.analysis.artifact.id !== dependency.id || receipt.analysis.artifact.checksum !== dependency.checksum || receipt.analysis.artifact.byteLength !== dependency.byteLength) invalid();
      const lessons = groundBuildProposal(receipt.proposal, partition, loaded.chunks[index], state.inputRevision);
      if (lessons.length !== retained.lessonCount) invalid();
      const key = JSON.stringify([partition.materialId, partition.unitId]); let season = unitSeasons.get(key);
      if (!season) {
        season = { id: createHash('sha256').update(JSON.stringify(['creation-season-v1', key, partition.extractionVersion])).digest('hex'),
          title: { value: loaded.chunks[index][0].title.value, origin: 'ai', acceptedRevision: state.inputRevision }, order: seasons.length, lessons: [] };
        unitSeasons.set(key, season); seasons.push(season);
      }
      for (const lesson of lessons) season.lessons.push({ ...lesson, order: season.lessons.length });
      for (const limitation of partition.coverage.limitations) warnings.add(limitation);
      if (partition.contentOrigin === 'ai') warnings.add('AI-authored source observations are not transcripts or exhaustive source coverage.');
      if (season.lessons.length > 100 || seasons.length > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'Curriculum exceeds 100 units or 100 lessons per unit; narrow the source scope.');
    }
    if (warnings.size > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'Source limitations exceed the review scope; narrow the selected material.');
    const curriculum = generatedCurriculumSchema.parse({ version: checkpoint.inputFingerprint, inputRevision: state.inputRevision,
      title: state.result.intent.topic, description: { value: state.result.intent.rawQuery, origin: 'user', acceptedRevision: state.inputRevision },
      seasons, warnings: [...warnings] });
    if (!curriculum.seasons.length || !curriculum.seasons.every(season => season.lessons.length)) invalid();
    signal.throwIfAborted(); return { ...loaded, analysisCheckpoint: loaded.checkpoint, checkpoint, curriculum };
  }
}

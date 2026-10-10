import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { buildingCheckpointSchema, buildingReceiptSchema, type BuildingCheckpoint } from '@/src/shared/cohort-creation/build';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { acceptedAnalysis, type AnalysisContentService } from './analysis-content.service';
import { understandingSourceIdentity } from './understanding.service';
import { validateBuildProposal, type CreationBuilding } from './build';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Retained build does not match accepted analysis or source revision.'); }
export function buildingInputFingerprint(input: CreationSnapshot, requestId: string) {
  const state = creationSnapshotSchema.parse(input); z.uuid().parse(requestId);
  return hash({ version: 'building-input-v1', draftId: state.draftId, requestId, inputRevision: state.inputRevision, analysis: acceptedAnalysis(state) });
}
export const buildingArtifactFingerprint = (inputFingerprint: string, partitionId: string) => hash({ version: 'building-receipt-v1', inputFingerprint, partitionId });
export function validateBuildingCheckpoint(snapshot: CreationSnapshot, requestId: string, value: unknown) {
  const checkpoint = buildingCheckpointSchema.parse(value); const analysis = acceptedAnalysis(snapshot);
  if (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision ||
    checkpoint.inputFingerprint !== buildingInputFingerprint(snapshot, requestId) || checkpoint.analysisFingerprint !== analysis.inputFingerprint ||
    JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(analysis.partitionIds)) invalid();
  return checkpoint;
}

/** One retained educational build per partition; no model controls persistence or navigation. */
export class BuildingService {
  constructor(private readonly content: Pick<AnalysisContentService, 'load'>, private readonly ai: CreationBuilding,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  async run(scope: StorageScope, value: CreationSnapshot, requestId: string, signal: AbortSignal,
    save: (checkpoint: BuildingCheckpoint) => Promise<void>, saved?: BuildingCheckpoint) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(value);
    if (scope.draftId !== snapshot.draftId || !snapshot.result) invalid();
    const inputFingerprint = buildingInputFingerprint(snapshot, requestId);
    let checkpoint = saved ? validateBuildingCheckpoint(snapshot, requestId, saved) : null;
    const loaded = await this.content.load(scope, snapshot, signal); const accepted = acceptedAnalysis(snapshot);
    if (JSON.stringify(loaded.checkpoint) !== JSON.stringify(accepted)) invalid();
    const minimum = new Map<string, number>(); const warnings = new Set<string>();
    for (const partition of loaded.partitions) {
      const key = JSON.stringify([partition.materialId, partition.unitId]); const count = (minimum.get(key) ?? 0) + 1;
      if (count > 100 || minimum.size >= 100 && !minimum.has(key)) throw new CreationStorageError('LIMIT_EXCEEDED', 'Curriculum exceeds 100 units or needs over 100 lessons per unit. Narrow the scope; nothing was truncated.');
      minimum.set(key, count);
      for (const limitation of partition.coverage.limitations) warnings.add(limitation);
      if (partition.contentOrigin === 'ai') warnings.add('AI-authored source observations are not transcripts or exhaustive source coverage.');
    }
    if (warnings.size > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'Source limitations exceed the review scope; narrow the selected material.');
    if (!checkpoint) {
      checkpoint = buildingCheckpointSchema.parse({ phase: 'building', requestId, inputRevision: snapshot.inputRevision, inputFingerprint,
        analysisFingerprint: accepted.inputFingerprint, total: accepted.total, partitionIds: accepted.partitionIds, completed: [] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    const unitCounts = new Map<string, number>();
    for (const [index, partition] of loaded.partitions.entries()) {
      signal.throwIfAborted(); const chunks = loaded.chunks[index]; const source = understandingSourceIdentity(partition);
      const analysis = { inputFingerprint: accepted.inputFingerprint, artifact: loaded.analysisReceipts[index].artifact };
      const options = { artifactType: 'creation-building', schemaVersion: 1,
        inputFingerprint: buildingArtifactFingerprint(inputFingerprint, partition.id), schema: buildingReceiptSchema, signal };
      const existing = checkpoint.completed[index]; let proposal;
      if (existing) {
        const actual = await this.artifacts.ref(scope, existing.artifact.id);
        if (actual.kind !== 'artifact' || actual.id !== existing.artifact.id || actual.checksum !== existing.artifact.checksum || actual.byteLength !== existing.artifact.byteLength) invalid();
        const receipt = await this.artifacts.getJSON(scope, existing.artifact.id, options);
        if (receipt.requestId !== requestId || receipt.inputFingerprint !== inputFingerprint || receipt.partitionId !== partition.id ||
          JSON.stringify(receipt.source) !== JSON.stringify(source) || JSON.stringify(receipt.analysis) !== JSON.stringify(analysis)) invalid();
        proposal = validateBuildProposal(receipt.proposal, chunks);
      } else proposal = validateBuildProposal(await this.ai.build(snapshot.result.intent, partition, chunks, loaded.analyses[index], signal), chunks);
      if (existing && existing.lessonCount !== proposal.lessons.length) invalid();
      const unit = JSON.stringify([partition.materialId, partition.unitId]);
      const count = (unitCounts.get(unit) ?? 0) + proposal.lessons.length;
      if (count > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'This learning unit exceeds 100 lessons. Narrow the scope; nothing was truncated.');
      unitCounts.set(unit, count);
      if (unitCounts.size > 100) throw new CreationStorageError('LIMIT_EXCEEDED', 'This draft exceeds 100 learning units. Narrow the scope; nothing was truncated.');
      if (existing) continue;
      signal.throwIfAborted(); const artifact = await this.artifacts.putJSON(scope,
        { schemaVersion: 1, requestId, inputFingerprint, partitionId: partition.id, source, analysis, model: this.ai.identity, proposal }, options);
      checkpoint = buildingCheckpointSchema.parse({ ...checkpoint, completed: [...checkpoint.completed, { partitionId: partition.id, artifact, lessonCount: proposal.lessons.length }] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    signal.throwIfAborted(); return checkpoint;
  }
}

import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { understandingCheckpointSchema, understandingReceiptSchema, type UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { ProcessingContentService } from './processing-content.service';
import { validateUnderstanding, type CreationUnderstanding } from './understanding';
import type { ProcessingPartition } from './processing-input';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function understandingInputFingerprint(snapshot: CreationSnapshot, requestId: string) {
  const state = creationSnapshotSchema.parse(snapshot); z.uuid().parse(requestId);
  return hash({ version: 'understanding-input-v1', draftId: state.draftId, requestId, inputRevision: state.inputRevision,
    intent: state.result?.intent, materials: state.materials, extractions: state.extractions, materialRefs: state.materialRefs, youtubeSources: state.youtubeSources });
}
export const understandingArtifactFingerprint = (inputFingerprint: string, partitionId: string) => hash({ version: 'understanding-receipt-v1', inputFingerprint, partitionId });
export function validateUnderstandingCheckpoint(snapshot: CreationSnapshot, requestId: string, value: unknown) {
  const checkpoint = understandingCheckpointSchema.parse(value);
  if (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision ||
    checkpoint.inputFingerprint !== understandingInputFingerprint(snapshot, requestId)) throw new Error('Understanding request unavailable');
  return checkpoint;
}
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Retained understanding does not match the source revision and partition ledger.'); }
export const understandingSourceIdentity = (partition: ProcessingPartition) => ({ materialId: partition.materialId, unitId: partition.unitId,
  extractionVersion: partition.extractionVersion, artifactId: partition.artifactId, segmentIds: partition.segments.map(segment => segment.id) });

/** Shared owned read for understanding restart and downstream processing. */
export async function readUnderstandingReceipt(artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>, scope: StorageScope,
  checkpoint: UnderstandingCheckpoint, partition: ProcessingPartition, artifact: UnderstandingCheckpoint['completed'][number]['artifact'], signal: AbortSignal) {
  signal.throwIfAborted(); const actual = await artifacts.ref(scope, artifact.id);
  if (actual.kind !== 'artifact' || actual.id !== artifact.id || actual.checksum !== artifact.checksum || actual.byteLength !== artifact.byteLength) invalid();
  const receipt = understandingReceiptSchema.parse(await artifacts.getJSON(scope, artifact.id, {
    artifactType: 'creation-understanding', schemaVersion: 1, inputFingerprint: understandingArtifactFingerprint(checkpoint.inputFingerprint, partition.id),
    schema: understandingReceiptSchema, signal }));
  signal.throwIfAborted();
  if (receipt.requestId !== checkpoint.requestId || receipt.inputFingerprint !== checkpoint.inputFingerprint || receipt.partitionId !== partition.id ||
    JSON.stringify(receipt.source) !== JSON.stringify(understandingSourceIdentity(partition))) invalid();
  validateUnderstanding(receipt.proposal, partition); return receipt;
}

/** Proposes immutable receipts; only the fenced job repository may accept/pin progress. */
export class UnderstandingService {
  constructor(private readonly content: Pick<ProcessingContentService, 'load'>, private readonly ai: CreationUnderstanding,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}

  async run(scope: StorageScope, value: CreationSnapshot, requestId: string, signal: AbortSignal,
    save: (checkpoint: UnderstandingCheckpoint) => Promise<void>, saved?: UnderstandingCheckpoint) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(value); const inputFingerprint = understandingInputFingerprint(snapshot, requestId);
    if (scope.draftId !== snapshot.draftId || !snapshot.result) invalid();
    let checkpoint = saved ? understandingCheckpointSchema.parse(saved) : null;
    if (checkpoint && (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision || checkpoint.inputFingerprint !== inputFingerprint)) invalid();
    const { partitions } = await this.content.load(scope, snapshot, signal);
    if (!checkpoint) {
      checkpoint = understandingCheckpointSchema.parse({ phase: 'understanding', requestId, inputRevision: snapshot.inputRevision, inputFingerprint,
        total: partitions.length, partitionIds: partitions.map(partition => partition.id), completed: [] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    if (checkpoint.total !== partitions.length || JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(partitions.map(partition => partition.id)) ||
      checkpoint.completed.some((item, index) => item.partitionId !== partitions[index].id)) invalid();
    for (const [index, partition] of partitions.entries()) {
      signal.throwIfAborted(); const source = understandingSourceIdentity(partition);
      const fingerprint = understandingArtifactFingerprint(inputFingerprint, partition.id);
      const options = { artifactType: 'creation-understanding', schemaVersion: 1, inputFingerprint: fingerprint, schema: understandingReceiptSchema, signal };
      const existing = checkpoint.completed[index];
      if (existing) {
        await readUnderstandingReceipt(this.artifacts, scope, checkpoint, partition, existing.artifact, signal); continue;
      }
      const proposal = validateUnderstanding(await this.ai.understand(snapshot.result.intent, partition, signal), partition);
      signal.throwIfAborted(); const artifact = await this.artifacts.putJSON(scope,
        { schemaVersion: 1, requestId, inputFingerprint, partitionId: partition.id, source, model: this.ai.identity, proposal }, options);
      checkpoint = understandingCheckpointSchema.parse({ ...checkpoint, completed: [...checkpoint.completed, { partitionId: partition.id, artifact }] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    signal.throwIfAborted(); return checkpoint;
  }
}

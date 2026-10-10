import 'server-only';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { UnderstandingContentService } from './understanding-content.service';
import { readChunkingReceipt, validateChunkingCheckpoint } from './chunking.service';
import { assembleGroundedChunks } from './chunking';

function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Accepted chunking does not match the owned retained source inventory.'); }
export function acceptedChunking(input: CreationSnapshot) {
  const state = creationSnapshotSchema.parse(input); const accepted = state.processing?.chunking;
  if (!accepted?.complete || !accepted.checkpoint || !state.result) invalid();
  const checkpoint = validateChunkingCheckpoint(state, accepted.requestId, accepted.checkpoint);
  if (checkpoint.completed.length !== checkpoint.total) invalid();
  return checkpoint;
}

/** Reads accepted evidence only. Actual text remains in the original source partitions. */
export class ChunkingContentService {
  constructor(private readonly content: Pick<UnderstandingContentService, 'load'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>) {}
  /** Read accepted partial work for the owner workspace; source evidence still passes the downstream reader. */
  async preview(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    const operation = state.processing?.chunking;
    if (scope.draftId !== state.draftId || !operation?.checkpoint) invalid();
    const checkpoint = validateChunkingCheckpoint(state, operation.requestId, operation.checkpoint);
    const { partitions, understanding, checkpoint: accepted } = await this.content.load(scope, state, signal);
    if (checkpoint.understandingFingerprint !== accepted.inputFingerprint || understanding.length !== partitions.length ||
      JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(partitions.map(partition => partition.id))) invalid();
    const chunks = [];
    for (const [index, retained] of checkpoint.completed.entries()) {
      const loaded = await readChunkingReceipt(this.artifacts, scope, checkpoint, partitions[index], understanding[index], retained, signal);
      chunks.push(...loaded.chunks);
    }
    signal.throwIfAborted(); return chunks;
  }
  async load(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    if (scope.draftId !== state.draftId) invalid();
    const checkpoint = acceptedChunking(state);
    const { partitions, understanding, checkpoint: accepted } = await this.content.load(scope, state, signal);
    if (checkpoint.understandingFingerprint !== accepted.inputFingerprint || understanding.length !== partitions.length ||
      JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(partitions.map(partition => partition.id))) invalid();
    const chunks = []; const receipts = [];
    for (const [index, partition] of partitions.entries()) {
      signal.throwIfAborted(); const evidence = understanding[index];
      if (JSON.stringify(evidence.artifact) !== JSON.stringify(accepted.completed[index].artifact)) invalid();
      const retained = checkpoint.completed[index];
      const loaded = await readChunkingReceipt(this.artifacts, scope, checkpoint, partition, evidence, retained, signal);
      chunks.push(loaded.chunks); receipts.push({ partitionId: partition.id, artifact: retained.artifact, receipt: loaded.receipt });
    }
    assembleGroundedChunks(partitions, chunks, signal);
    signal.throwIfAborted(); return { partitions, understanding, chunks, checkpoint, receipts };
  }
}

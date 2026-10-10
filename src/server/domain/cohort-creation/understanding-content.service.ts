import 'server-only';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { ProcessingContentService } from './processing-content.service';
import { readUnderstandingReceipt, validateUnderstandingCheckpoint } from './understanding.service';

function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Accepted understanding does not match the owned retained source inventory.'); }
export function acceptedUnderstanding(input: CreationSnapshot) {
  const state = creationSnapshotSchema.parse(input); const accepted = state.processing;
  if (!accepted?.complete || !accepted.checkpoint || !state.result) invalid();
  const checkpoint = validateUnderstandingCheckpoint(state, accepted.requestId, accepted.checkpoint);
  if (checkpoint.completed.length !== checkpoint.total) invalid();
  return checkpoint;
}

/** Reads accepted evidence only; cannot generate, pin artifacts or advance the workspace. */
export class UnderstandingContentService {
  constructor(private readonly content: Pick<ProcessingContentService, 'load'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>) {}
  async load(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    if (scope.draftId !== state.draftId) invalid();
    const checkpoint = acceptedUnderstanding(state); const { partitions } = await this.content.load(scope, state, signal);
    if (JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(partitions.map(partition => partition.id))) invalid();
    const understanding = [];
    for (const [index, partition] of partitions.entries()) {
      signal.throwIfAborted(); const artifact = checkpoint.completed[index].artifact;
      const receipt = await readUnderstandingReceipt(this.artifacts, scope, checkpoint, partition, artifact, signal);
      understanding.push({ partitionId: partition.id, artifact, receipt });
    }
    signal.throwIfAborted(); return { partitions, understanding, checkpoint };
  }
}

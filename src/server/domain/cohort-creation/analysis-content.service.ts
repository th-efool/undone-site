import 'server-only';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { ChunkingContentService } from './chunking-content.service';
import { readAnalysisReceipt, validateAnalysisCheckpoint } from './analysis.service';
import { groundAnalysis } from './analysis';

function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Accepted analysis does not match the owned chunk inventory.'); }
export function acceptedAnalysis(input: CreationSnapshot) {
  const state = creationSnapshotSchema.parse(input); const accepted = state.processing?.analysis;
  if (!accepted?.complete || !accepted.checkpoint || !state.result) invalid();
  const checkpoint = validateAnalysisCheckpoint(state, accepted.requestId, accepted.checkpoint);
  if (checkpoint.completed.length !== checkpoint.total) invalid();
  return checkpoint;
}

/** Loads accepted original content and typed analysis without generating or advancing state. */
export class AnalysisContentService {
  constructor(private readonly content: Pick<ChunkingContentService, 'load'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>) {}
  async load(scope: StorageScope, input: CreationSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const state = creationSnapshotSchema.parse(input);
    if (scope.draftId !== state.draftId) invalid();
    const checkpoint = acceptedAnalysis(state); const loaded = await this.content.load(scope, state, signal);
    if (checkpoint.chunkingFingerprint !== loaded.checkpoint.inputFingerprint ||
      JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(loaded.checkpoint.partitionIds)) invalid();
    const analyses = []; const receipts = [];
    for (const [index, partition] of loaded.partitions.entries()) {
      const retained = checkpoint.completed[index];
      const receipt = await readAnalysisReceipt(this.artifacts, scope, checkpoint, partition, loaded.chunks[index], loaded.receipts[index].artifact, retained, signal);
      analyses.push(groundAnalysis(receipt.proposal, partition, loaded.chunks[index], state.inputRevision, receipt.model));
      receipts.push({ partitionId: partition.id, artifact: retained.artifact, receipt });
    }
    signal.throwIfAborted(); return { ...loaded, chunkingCheckpoint: loaded.checkpoint, checkpoint, analyses, analysisReceipts: receipts };
  }
}

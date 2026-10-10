import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { analysisCheckpointSchema, analysisReceiptSchema, type AnalysisCheckpoint } from '@/src/shared/cohort-creation/analysis';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { acceptedChunking, type ChunkingContentService } from './chunking-content.service';
import { understandingSourceIdentity } from './understanding.service';
import { validateChunkAnalysis, type CreationAnalysis } from './analysis';
import type { ProcessingPartition } from './processing-input';
import type { GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import type { CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Retained analysis does not match accepted chunks or source revision.'); }
export function analysisInputFingerprint(input: CreationSnapshot, requestId: string) {
  const state = creationSnapshotSchema.parse(input); z.uuid().parse(requestId);
  return hash({ version: 'analysis-input-v1', draftId: state.draftId, requestId, inputRevision: state.inputRevision, chunking: acceptedChunking(state) });
}
export const analysisArtifactFingerprint = (inputFingerprint: string, partitionId: string) => hash({ version: 'analysis-receipt-v1', inputFingerprint, partitionId });
export function validateAnalysisCheckpoint(snapshot: CreationSnapshot, requestId: string, value: unknown) {
  const checkpoint = analysisCheckpointSchema.parse(value); const chunks = acceptedChunking(snapshot);
  if (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision ||
    checkpoint.inputFingerprint !== analysisInputFingerprint(snapshot, requestId) || checkpoint.chunkingFingerprint !== chunks.inputFingerprint ||
    JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(chunks.partitionIds) ||
    checkpoint.completed.some((item, index) => item.chunkCount !== chunks.completed[index].chunkCount)) invalid();
  return checkpoint;
}

export async function readAnalysisReceipt(artifacts: Pick<CreationArtifactRepository, 'getJSON' | 'ref'>, scope: StorageScope,
  checkpoint: AnalysisCheckpoint, partition: ProcessingPartition, chunks: GroundedChunk[], dependency: CreationObjectRef,
  retained: AnalysisCheckpoint['completed'][number], signal: AbortSignal) {
  signal.throwIfAborted(); const actual = await artifacts.ref(scope, retained.artifact.id);
  if (actual.kind !== 'artifact' || actual.id !== retained.artifact.id || actual.checksum !== retained.artifact.checksum ||
    actual.byteLength !== retained.artifact.byteLength || retained.partitionId !== partition.id || retained.chunkCount !== chunks.length) invalid();
  const receipt = await artifacts.getJSON(scope, retained.artifact.id, { artifactType: 'creation-analysis', schemaVersion: 1,
    inputFingerprint: analysisArtifactFingerprint(checkpoint.inputFingerprint, partition.id), schema: analysisReceiptSchema, signal });
  if (receipt.requestId !== checkpoint.requestId || receipt.inputFingerprint !== checkpoint.inputFingerprint || receipt.partitionId !== partition.id ||
    JSON.stringify(receipt.source) !== JSON.stringify(understandingSourceIdentity(partition)) ||
    receipt.chunking.inputFingerprint !== checkpoint.chunkingFingerprint || receipt.chunking.artifact.id !== dependency.id ||
    receipt.chunking.artifact.kind !== dependency.kind || receipt.chunking.artifact.checksum !== dependency.checksum ||
    receipt.chunking.artifact.byteLength !== dependency.byteLength) invalid();
  validateChunkAnalysis(receipt.proposal, chunks); signal.throwIfAborted(); return receipt;
}

/** Proposes immutable analysis receipts; acceptance and navigation remain fenced application operations. */
export class AnalysisService {
  constructor(private readonly content: Pick<ChunkingContentService, 'load'>, private readonly ai: CreationAnalysis,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  async run(scope: StorageScope, value: CreationSnapshot, requestId: string, signal: AbortSignal,
    save: (checkpoint: AnalysisCheckpoint) => Promise<void>, saved?: AnalysisCheckpoint) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(value);
    if (scope.draftId !== snapshot.draftId || !snapshot.result) invalid();
    const inputFingerprint = analysisInputFingerprint(snapshot, requestId);
    let checkpoint = saved ? validateAnalysisCheckpoint(snapshot, requestId, saved) : null;
    const loaded = await this.content.load(scope, snapshot, signal); const accepted = acceptedChunking(snapshot);
    if (JSON.stringify(loaded.checkpoint) !== JSON.stringify(accepted)) invalid();
    if (!checkpoint) {
      checkpoint = analysisCheckpointSchema.parse({ phase: 'analysis', requestId, inputRevision: snapshot.inputRevision, inputFingerprint,
        chunkingFingerprint: accepted.inputFingerprint, total: accepted.total, partitionIds: accepted.partitionIds, completed: [] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    for (const [index, partition] of loaded.partitions.entries()) {
      signal.throwIfAborted(); const chunks = loaded.chunks[index]; const source = understandingSourceIdentity(partition);
      const chunking = { inputFingerprint: accepted.inputFingerprint, artifact: loaded.receipts[index].artifact };
      const options = { artifactType: 'creation-analysis', schemaVersion: 1,
        inputFingerprint: analysisArtifactFingerprint(inputFingerprint, partition.id), schema: analysisReceiptSchema, signal };
      const existing = checkpoint.completed[index];
      if (existing) {
        await readAnalysisReceipt(this.artifacts, scope, checkpoint, partition, chunks, chunking.artifact, existing, signal); continue;
      }
      const proposal = validateChunkAnalysis(await this.ai.analyze(snapshot.result.intent, partition, chunks, signal), chunks);
      signal.throwIfAborted(); const artifact = await this.artifacts.putJSON(scope,
        { schemaVersion: 1, requestId, inputFingerprint, partitionId: partition.id, source, chunking, model: this.ai.identity, proposal }, options);
      checkpoint = analysisCheckpointSchema.parse({ ...checkpoint, completed: [...checkpoint.completed, { partitionId: partition.id, artifact, chunkCount: chunks.length }] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    signal.throwIfAborted(); return checkpoint;
  }
}

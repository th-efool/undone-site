import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { chunkingCheckpointSchema, type ChunkingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { CHUNK_LIMITS, chunkingReceiptSchema, type GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { acceptedUnderstanding, type UnderstandingContentService } from './understanding-content.service';
import { understandingSourceIdentity } from './understanding.service';
import { assembleGroundedChunks, groundChunkBoundaries, type CreationChunking } from './chunking';
import { creationFailure } from './errors';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function chunkingInputFingerprint(input: CreationSnapshot, requestId: string) {
  const state = creationSnapshotSchema.parse(input); z.uuid().parse(requestId);
  return hash({ version: 'chunking-input-v1', draftId: state.draftId, requestId, inputRevision: state.inputRevision,
    understanding: acceptedUnderstanding(state) });
}
export const chunkingArtifactFingerprint = (inputFingerprint: string, partitionId: string) => hash({ version: 'chunking-receipt-v1', inputFingerprint, partitionId });
export function validateChunkingCheckpoint(snapshot: CreationSnapshot, requestId: string, value: unknown) {
  const checkpoint = chunkingCheckpointSchema.parse(value); const understanding = acceptedUnderstanding(snapshot);
  if (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision ||
    checkpoint.inputFingerprint !== chunkingInputFingerprint(snapshot, requestId) || checkpoint.understandingFingerprint !== understanding.inputFingerprint ||
    JSON.stringify(checkpoint.partitionIds) !== JSON.stringify(understanding.partitionIds)) invalid();
  return checkpoint;
}
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Retained chunking does not match the accepted understanding, source revision or partition ledger.'); }

/** Proposes immutable receipts. Only the fenced job repository may accept/pin them. */
export class ChunkingService {
  constructor(private readonly content: Pick<UnderstandingContentService, 'load'>, private readonly ai: CreationChunking,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  async run(scope: StorageScope, value: CreationSnapshot, requestId: string, signal: AbortSignal,
    save: (checkpoint: ChunkingCheckpoint) => Promise<void>, saved?: ChunkingCheckpoint) {
    signal.throwIfAborted(); const snapshot = creationSnapshotSchema.parse(value);
    if (scope.draftId !== snapshot.draftId || !snapshot.result) invalid();
    const inputFingerprint = chunkingInputFingerprint(snapshot, requestId);
    let checkpoint = saved ? validateChunkingCheckpoint(snapshot, requestId, saved) : null;
    const { partitions, understanding, checkpoint: accepted } = await this.content.load(scope, snapshot, signal);
    if (JSON.stringify(accepted) !== JSON.stringify(acceptedUnderstanding(snapshot)) || understanding.length !== partitions.length ||
      JSON.stringify(accepted.partitionIds) !== JSON.stringify(partitions.map(partition => partition.id))) invalid();
    const minimumCounts = new Map<string, number>();
    for (const partition of partitions) {
      const key = JSON.stringify([partition.materialId, partition.unitId]); const minimum = (minimumCounts.get(key) ?? 0) + 1;
      if (minimum > CHUNK_LIMITS.perUnit) throw creationFailure('INVALID_REQUEST', 'This learning unit needs more than 200 chunks. Select less material; nothing was truncated.', false);
      minimumCounts.set(key, minimum);
    }
    if (!checkpoint) {
      checkpoint = chunkingCheckpointSchema.parse({ phase: 'chunking', requestId, inputRevision: snapshot.inputRevision, inputFingerprint,
        understandingFingerprint: accepted.inputFingerprint, total: partitions.length, partitionIds: accepted.partitionIds, completed: [] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    const groups: GroundedChunk[][] = []; const counts = new Map<string, number>(); let total = 0;
    for (const [index, partition] of partitions.entries()) {
      signal.throwIfAborted(); const evidence = understanding[index];
      if (evidence.partitionId !== partition.id || JSON.stringify(evidence.artifact) !== JSON.stringify(accepted.completed[index].artifact)) invalid();
      const dependency = { inputFingerprint: accepted.inputFingerprint, artifact: evidence.artifact };
      const source = understandingSourceIdentity(partition);
      const options = { artifactType: 'creation-chunking', schemaVersion: 1,
        inputFingerprint: chunkingArtifactFingerprint(inputFingerprint, partition.id), schema: chunkingReceiptSchema, signal };
      const existing = checkpoint.completed[index]; let proposal;
      if (existing) {
        const actual = await this.artifacts.ref(scope, existing.artifact.id);
        if (actual.kind !== 'artifact' || actual.id !== existing.artifact.id || actual.checksum !== existing.artifact.checksum || actual.byteLength !== existing.artifact.byteLength) invalid();
        const receipt = chunkingReceiptSchema.parse(await this.artifacts.getJSON(scope, existing.artifact.id, options));
        if (receipt.requestId !== requestId || receipt.inputFingerprint !== inputFingerprint || receipt.partitionId !== partition.id ||
          JSON.stringify(receipt.source) !== JSON.stringify(source) || JSON.stringify(receipt.understanding) !== JSON.stringify(dependency)) invalid();
        proposal = receipt.proposal;
      } else proposal = await this.ai.chunk(snapshot.result.intent, partition, evidence.receipt.proposal, signal);
      signal.throwIfAborted(); const chunks = groundChunkBoundaries(proposal, partition, evidence.receipt.proposal, snapshot.inputRevision, signal);
      if (existing && existing.chunkCount !== chunks.length) invalid();
      const unit = JSON.stringify([partition.materialId, partition.unitId]); const count = (counts.get(unit) ?? 0) + chunks.length;
      total += chunks.length;
      if (count > CHUNK_LIMITS.perUnit || total > CHUNK_LIMITS.perDraft) {
        throw creationFailure('INVALID_REQUEST', 'Chunk scope exceeds 200 chunks per learning unit or 2,500 per draft. Select less material; nothing was truncated.', false);
      }
      counts.set(unit, count); groups.push(chunks);
      // Never acknowledge a complete ledger before validating complete aggregate coverage.
      if (index === partitions.length - 1) assembleGroundedChunks(partitions, groups, signal);
      if (existing) continue;
      signal.throwIfAborted(); const artifact = await this.artifacts.putJSON(scope,
        { schemaVersion: 1, requestId, inputFingerprint, partitionId: partition.id, source, understanding: dependency, model: this.ai.identity, proposal }, options);
      checkpoint = chunkingCheckpointSchema.parse({ ...checkpoint, completed: [...checkpoint.completed, { partitionId: partition.id, artifact, chunkCount: chunks.length }] });
      signal.throwIfAborted(); await save(checkpoint);
    }
    signal.throwIfAborted(); return checkpoint;
  }
}

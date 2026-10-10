import { createHash } from 'node:crypto';
import type { LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { CHUNK_LIMITS, chunkBoundaryProposalSchema, groundedChunkSchema, type ChunkBoundaryProposal, type GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import type { UnderstandingProposal } from '@/src/shared/cohort-creation/processing';
import { creationFailure } from './errors';
import { validateProcessingPartition, type ProcessingPartition } from './processing-input';
import { validateUnderstanding } from './understanding';

export interface CreationChunking {
  readonly identity: { provider: string; modelId: string; adapterVersion: string };
  chunk(intent: LearningIntent, partition: ProcessingPartition, understanding: UnderstandingProposal, signal: AbortSignal): Promise<ChunkBoundaryProposal>;
}
function invalid(): never { throw creationFailure('AI_INVALID_OUTPUT', 'Chunk boundaries must cover retained segments exactly once, in order, with valid concept evidence.'); }
function scope(): never { throw creationFailure('INVALID_REQUEST', 'Chunk scope exceeds 200 chunks per learning unit or 2,500 per draft. Select less material; nothing was truncated.', false); }
const chunkId = (partitionId: string, startSegmentId: string, endSegmentId: string) => createHash('sha256').update(JSON.stringify({
  version: 'grounded-chunk-v1', partitionId, startSegmentId, endSegmentId })).digest('hex');

export function validateChunkBoundaries(value: unknown, partition: ProcessingPartition, understanding: UnderstandingProposal) {
  validateProcessingPartition(partition); const accepted = validateUnderstanding(understanding, partition);
  const proposal = chunkBoundaryProposalSchema.parse(value); let cursor = 0;
  const indices = new Map(partition.segments.map((segment, index) => [segment.id, index]));
  for (const chunk of proposal.chunks) {
    const start = indices.get(chunk.startSegmentId); const end = indices.get(chunk.endSegmentId);
    if (start !== cursor || end === undefined || end < start || end - start + 1 > CHUNK_LIMITS.segmentsPerChunk ||
      new Set(chunk.conceptIndices).size !== chunk.conceptIndices.length || chunk.conceptIndices.some(index => {
        const concept = accepted.concepts[index];
        return !concept || !concept.segmentIds.some(id => { const position = indices.get(id)!; return position >= start && position <= end; });
      })) invalid();
    cursor = end + 1;
  }
  if (cursor !== partition.segments.length) invalid();
  return proposal;
}

/** Pure application projection. Retained source bodies/anchors are never taken from AI output. */
export function groundChunkBoundaries(value: unknown, partition: ProcessingPartition, understanding: UnderstandingProposal,
  inputRevision: number, signal?: AbortSignal): GroundedChunk[] {
  signal?.throwIfAborted(); const proposal = validateChunkBoundaries(value, partition, understanding);
  const indices = new Map(partition.segments.map((segment, index) => [segment.id, index]));
  return proposal.chunks.map((chunk, position) => {
    signal?.throwIfAborted(); const segments = partition.segments.slice(indices.get(chunk.startSegmentId)!, indices.get(chunk.endSegmentId)! + 1);
    const sourceRefs = segments.map(segment => segment.location); const video = sourceRefs.filter(ref => ref.anchor.kind === 'video');
    if (video.length && video.length !== sourceRefs.length) invalid();
    // Reading estimates use a fixed 200 words/minute; video spans retain their existing estimated/source label.
    const durationSeconds = video.length ? Math.max(...video.map(ref => ref.anchor.kind === 'video' ? ref.anchor.endSeconds : 0)) -
      Math.min(...video.map(ref => ref.anchor.kind === 'video' ? ref.anchor.startSeconds : 0))
      : Math.ceil(segments.map(segment => segment.text).join('').trim().split(/\s+/u).length * 60 / 200);
    const id = chunkId(partition.id, chunk.startSegmentId, chunk.endSegmentId);
    return groundedChunkSchema.parse({ id, materialId: partition.materialId, unitId: partition.unitId, partitionId: partition.id,
      extractionVersion: partition.extractionVersion, artifactRef: partition.artifactId, position,
      title: { value: chunk.title, origin: 'ai', acceptedRevision: inputRevision },
      summary: { value: chunk.summary, origin: 'ai', acceptedRevision: inputRevision }, sourceRefs, durationSeconds,
      durationMethod: video.length ? video.some(ref => ref.anchor.kind === 'video' && ref.anchor.estimated) ? 'model_estimate' : 'source' : 'reading_estimate',
      conceptIndices: chunk.conceptIndices, contentOrigin: partition.contentOrigin, coverage: partition.coverage });
  });
}

/** All partition outputs must be present before accepting aggregate coverage and product limits. */
export function assembleGroundedChunks(partitions: ProcessingPartition[], groups: GroundedChunk[][], signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!partitions.length || groups.length !== partitions.length || new Set(partitions.map(partition => partition.id)).size !== partitions.length) invalid();
  const units = new Map<string, number>(); const inventories = new Map<string, { next: number; version: string; artifactId: string }>();
  const result: GroundedChunk[] = [];
  for (const [index, partition] of partitions.entries()) {
    signal?.throwIfAborted();
    validateProcessingPartition(partition); const chunks = groups[index].map(chunk => groundedChunkSchema.parse(chunk));
    if (!chunks.length || chunks.some((chunk, position) => chunk.partitionId !== partition.id || chunk.position !== position ||
      chunk.materialId !== partition.materialId || chunk.unitId !== partition.unitId || chunk.extractionVersion !== partition.extractionVersion ||
      chunk.artifactRef !== partition.artifactId || chunk.contentOrigin !== partition.contentOrigin || JSON.stringify(chunk.coverage) !== JSON.stringify(partition.coverage) ||
      chunk.id !== chunkId(partition.id, chunk.sourceRefs[0].segmentId, chunk.sourceRefs.at(-1)!.segmentId)) ||
      JSON.stringify(chunks.flatMap(chunk => chunk.sourceRefs)) !== JSON.stringify(partition.segments.map(segment => segment.location))) invalid();
    const key = JSON.stringify([partition.materialId, partition.unitId]); const inventory = inventories.get(key);
    if (partition.index !== (inventory?.next ?? 0) || inventory && (inventory.version !== partition.extractionVersion || inventory.artifactId !== partition.artifactId)) invalid();
    inventories.set(key, { next: partition.index + 1, version: partition.extractionVersion, artifactId: partition.artifactId });
    const count = (units.get(key) ?? 0) + chunks.length;
    if (count > CHUNK_LIMITS.perUnit || result.length + chunks.length > CHUNK_LIMITS.perDraft) scope();
    units.set(key, count);
    for (const chunk of chunks) { signal?.throwIfAborted(); result.push({ ...chunk, position: result.length }); }
  }
  if (new Set(result.map(chunk => chunk.id)).size !== result.length) invalid();
  return result;
}

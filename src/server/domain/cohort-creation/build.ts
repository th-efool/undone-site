import { createHash } from 'node:crypto';
import type { LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { buildProposalSchema, type BuildProposal } from '@/src/shared/cohort-creation/build';
import { chunkAnalysisSchema, generatedCurriculumSchema, type ChunkAnalysis } from '@/src/shared/cohort-creation/artifacts';
import { groundedChunkSchema, type GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import { analysisSourceContext } from './analysis';
import { creationFailure } from './errors';
import type { ProcessingPartition } from './processing-input';

export interface CreationBuilding {
  readonly identity: { provider: string; modelId: string; adapterVersion: string };
  build(intent: LearningIntent, partition: ProcessingPartition, chunks: GroundedChunk[], analyses: ChunkAnalysis[], signal: AbortSignal): Promise<BuildProposal>;
}
function invalid(): never { throw creationFailure('AI_INVALID_OUTPUT', 'Lessons must cover all accepted chunks exactly once in source order.'); }
export function validateBuildProposal(value: unknown, input: GroundedChunk[]) {
  const chunks = input.map(chunk => groundedChunkSchema.parse(chunk)); const proposal = buildProposalSchema.parse(value);
  if (!chunks.length || chunks.length > 200 || new Set(chunks.map(chunk => chunk.id)).size !== chunks.length) invalid();
  const indices = proposal.lessons.flatMap(lesson => lesson.chunkIndices);
  if (indices.length !== chunks.length || indices.some((index, position) => index !== position)) invalid();
  return proposal;
}
export function buildingSourceContext(partition: ProcessingPartition, chunks: GroundedChunk[], input: ChunkAnalysis[]) {
  const sources = analysisSourceContext(partition, chunks); const analyses = input.map(analysis => chunkAnalysisSchema.parse(analysis));
  if (analyses.length !== chunks.length || analyses.some((analysis, index) => analysis.chunkId !== chunks[index].id)) invalid();
  return sources.map((source, index) => ({ ...source, analysis: { vector: analyses[index].vector,
    isStrictlyLinear: analyses[index].isStrictlyLinear, confidence: analyses[index].confidence, reasoning: analyses[index].reasoning } }));
}
/** IDs and delivery fields come from accepted source dependencies, never from generated copy. */
export function groundBuildProposal(value: unknown, partition: ProcessingPartition, chunks: GroundedChunk[], inputRevision: number) {
  analysisSourceContext(partition, chunks); const proposal = validateBuildProposal(value, chunks);
  return proposal.lessons.map((lesson, order) => {
    const accepted = lesson.chunkIndices.map(index => chunks[index]);
    const id = createHash('sha256').update(JSON.stringify({ version: 'creation-lesson-v1', partitionId: partition.id,
      chunkIds: accepted.map(chunk => chunk.id) })).digest('hex');
    return generatedCurriculumSchema.shape.seasons.element.shape.lessons.element.parse({ id, order,
      title: { value: lesson.title, origin: 'ai', acceptedRevision: inputRevision },
      objectives: { value: lesson.objectives, origin: 'ai', acceptedRevision: inputRevision },
      type: accepted.every(chunk => chunk.sourceRefs.every(ref => ref.anchor.kind === 'video')) ? 'VIDEO' : 'ARTICLE',
      chunkIds: accepted.map(chunk => chunk.id), materialIds: [...new Set(accepted.map(chunk => chunk.materialId))],
      durationSeconds: accepted.reduce((sum, chunk) => sum + chunk.durationSeconds, 0) });
  });
}

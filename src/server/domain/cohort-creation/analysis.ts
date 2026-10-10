import type { LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { analysisProposalSchema, type AnalysisProposal } from '@/src/shared/cohort-creation/analysis';
import { chunkAnalysisSchema } from '@/src/shared/cohort-creation/artifacts';
import { groundedChunkSchema, type GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import { creationFailure } from './errors';
import { validateProcessingPartition, type ProcessingPartition } from './processing-input';

export interface CreationAnalysis {
  readonly identity: { provider: string; modelId: string; adapterVersion: string };
  analyze(intent: LearningIntent, partition: ProcessingPartition, chunks: GroundedChunk[], signal: AbortSignal): Promise<AnalysisProposal>;
}
const invalid = (): never => { throw creationFailure('AI_INVALID_OUTPUT', 'Analysis must cover each accepted chunk exactly once in source order.'); };

/** Source text is always read from the retained partition, never from generated summaries. */
export function analysisSourceContext(partition: ProcessingPartition, input: GroundedChunk[]) {
  validateProcessingPartition(partition);
  const chunks = input.map(chunk => groundedChunkSchema.parse(chunk));
  if (!chunks.length || chunks.length > 200 || new Set(chunks.map(chunk => chunk.id)).size !== chunks.length ||
    chunks.some(chunk => chunk.partitionId !== partition.id || chunk.materialId !== partition.materialId || chunk.unitId !== partition.unitId ||
      chunk.extractionVersion !== partition.extractionVersion || chunk.artifactRef !== partition.artifactId ||
      chunk.contentOrigin !== partition.contentOrigin || JSON.stringify(chunk.coverage) !== JSON.stringify(partition.coverage)) ||
    JSON.stringify(chunks.flatMap(chunk => chunk.sourceRefs)) !== JSON.stringify(partition.segments.map(segment => segment.location))) invalid();
  const segments = new Map(partition.segments.map(segment => [segment.id, segment]));
  return chunks.map((chunk, chunkIndex) => ({ chunkIndex, title: chunk.title.value, summary: chunk.summary.value,
    segments: chunk.sourceRefs.map(ref => ({ segmentId: ref.segmentId, text: segments.get(ref.segmentId)!.text })) }));
}

export function validateAnalysis(value: unknown, partition: ProcessingPartition, chunks: GroundedChunk[]) {
  analysisSourceContext(partition, chunks);
  return validateChunkAnalysis(value, chunks);
}

export function validateChunkAnalysis(value: unknown, chunks: GroundedChunk[]) {
  const proposal = analysisProposalSchema.parse(value);
  if (proposal.analyses.length !== chunks.length || proposal.analyses.some((item, index) => item.chunkIndex !== index)) invalid();
  return proposal;
}

export function groundAnalysis(value: unknown, partition: ProcessingPartition, chunks: GroundedChunk[],
  inputRevision: number, identity: CreationAnalysis['identity']) {
  const proposal = validateAnalysis(value, partition, chunks);
  return proposal.analyses.map(({ chunkIndex, ...analysis }) => chunkAnalysisSchema.parse({ ...analysis,
    chunkId: chunks[chunkIndex].id, modelId: identity.modelId, promptVersion: identity.adapterVersion, inputRevision }));
}

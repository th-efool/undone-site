import type { LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { creationFailure } from './errors';
import { validateProcessingPartition, type ProcessingPartition } from './processing-input';

/** The model proposes educational content and segment keys, never persisted IDs or commands. */
import { understandingProposalSchema, type UnderstandingProposal } from '@/src/shared/cohort-creation/processing';
export { understandingProposalSchema } from '@/src/shared/cohort-creation/processing';
export type { UnderstandingProposal } from '@/src/shared/cohort-creation/processing';
export interface CreationUnderstanding {
  readonly identity: { provider: string; modelId: string; adapterVersion: string };
  understand(intent: LearningIntent, partition: ProcessingPartition, signal: AbortSignal): Promise<UnderstandingProposal>;
}

export function validateUnderstanding(value: unknown, partition: ProcessingPartition) {
  validateProcessingPartition(partition); const proposal = understandingProposalSchema.parse(value);
  const segmentIds = new Set(partition.segments.map(segment => segment.id)); const labels = new Set<string>();
  for (const concept of proposal.concepts) {
    const label = concept.label.normalize('NFKC').toLowerCase();
    if (labels.has(label) || new Set(concept.segmentIds).size !== concept.segmentIds.length || concept.segmentIds.some(id => !segmentIds.has(id))) {
      throw creationFailure('AI_INVALID_OUTPUT', 'Understanding contains duplicate concepts or references outside the retained partition.');
    }
    labels.add(label);
  }
  return proposal;
}

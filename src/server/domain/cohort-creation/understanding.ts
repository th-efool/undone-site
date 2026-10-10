import { z } from 'zod';
import type { LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { creationFailure } from './errors';
import { validateProcessingPartition, type ProcessingPartition } from './processing-input';

/** The model proposes educational content and segment keys, never persisted IDs or commands. */
export const understandingProposalSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2000),
  concepts: z.array(z.strictObject({ label: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(2000),
    segmentIds: z.array(z.string().min(1).max(128)).min(1).max(50) })).min(1).max(20),
  limitations: z.array(z.string().trim().min(1).max(1000)).max(8),
});
export type UnderstandingProposal = z.infer<typeof understandingProposalSchema>;
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

import { z } from 'zod';
import type { ExistingCohortReference, LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { creationFailure } from './errors';

const text = (max: number) => z.string().trim().min(1).max(max);
export const intentProposalSchema = z.strictObject({
  topic: text(160), outcomes: z.array(text(300)).max(8),
  level: text(100).nullable(), language: text(80).nullable(),
  searchTerms: z.array(text(80)).min(1).max(8),
  uncertainties: z.array(text(300)).max(8),
});
export const rankingProposalSchema = z.strictObject({
  matches: z.array(z.strictObject({ candidateKey: text(128), reason: text(600) })).max(5),
});
export type IntentProposal = z.infer<typeof intentProposalSchema>;
export type RankingProposal = z.infer<typeof rankingProposalSchema>;

export interface CohortAi {
  interpret(query: string, signal: AbortSignal): Promise<IntentProposal>;
  rank(intent: LearningIntent, candidates: ExistingCohortReference[], signal: AbortSignal): Promise<RankingProposal>;
}

export function validateRanking(input: unknown, candidates: ExistingCohortReference[]): RankingProposal {
  const result = rankingProposalSchema.safeParse(input);
  const allowed = new Set(candidates.map(candidate => candidate.cohortId));
  if (!result.success) throw creationFailure('AI_INVALID_OUTPUT', 'The recommendation output was invalid. Try again.');
  const selected = result.data.matches.map(match => match.candidateKey);
  if (new Set(selected).size !== selected.length || selected.some(id => !allowed.has(id))) {
    throw creationFailure('AI_INVALID_OUTPUT', 'The recommendations referenced unavailable cohorts. Try again.');
  }
  return result.data;
}

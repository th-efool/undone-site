import { randomUUID } from 'node:crypto';
import {
  existingCohortSchema, learningIntentSchema, recommendationRequestSchema, recommendationResultSchema,
  type ExistingCohortReference, type LearningIntent, type RecommendationRequest, type RecommendationResult,
} from '@/src/shared/cohort-creation/contracts';
import { intentProposalSchema, validateRanking, type CohortAi } from './ai.contracts';
import { CreationFailure, creationFailure } from './errors';

export interface RecommendationRepository {
  findCandidates(intent: LearningIntent, signal: AbortSignal): Promise<ExistingCohortReference[]>;
  retainEligible(ids: string[], signal: AbortSignal): Promise<Set<string>>;
}

export class RecommendationService {
  constructor(private readonly ai: CohortAi, private readonly repository: RecommendationRepository) {}

  async recommend(input: RecommendationRequest, signal: AbortSignal): Promise<RecommendationResult> {
    const request = recommendationRequestSchema.parse(input);
    signal.throwIfAborted();
    const proposal = intentProposalSchema.parse(await this.ai.interpret(request.query, signal));
    const field = <T>(value: T) => ({ value, origin: 'ai' as const, acceptedRevision: request.inputRevision });
    const intent = learningIntentSchema.parse({
      id: randomUUID(), rawQuery: request.query, revision: request.inputRevision,
      topic: field(proposal.topic), outcomes: field(proposal.outcomes),
      level: proposal.level ? field(proposal.level) : null,
      language: proposal.language ? field(proposal.language) : null,
      searchTerms: proposal.searchTerms, uncertainties: proposal.uncertainties,
    });
    let candidates: ExistingCohortReference[];
    try {
      candidates = (await this.repository.findCandidates(intent, signal)).map(candidate => existingCohortSchema.parse(candidate));
      if (candidates.length > 50 || new Set(candidates.map(c => c.cohortId)).size !== candidates.length) throw new Error('Invalid catalog projection');
    } catch {
      signal.throwIfAborted();
      throw creationFailure('DATA_UNAVAILABLE', 'Cohorts could not be loaded. Try again.');
    }
    let mode: RecommendationResult['mode'] = 'ai';
    let matches: { candidateKey: string; reason: string }[] = [];
    if (candidates.length) {
      try {
        matches = validateRanking(await this.ai.rank(intent, candidates, signal), candidates).matches;
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof CreationFailure) || error.detail.code === 'CANCELLED' || error.detail.code === 'AI_TIMEOUT') throw error;
        mode = 'database_fallback';
        matches = candidates.slice(0, 5).map(candidate => ({
          candidateKey: candidate.cohortId,
          reason: 'Found by database search. AI relevance ranking is currently unavailable.',
        }));
      }
    }
    signal.throwIfAborted();
    let eligible: Set<string>;
    try {
      eligible = matches.length ? await this.repository.retainEligible(matches.map(match => match.candidateKey), signal) : new Set();
    } catch {
      signal.throwIfAborted();
      throw creationFailure('DATA_UNAVAILABLE', 'Cohort availability could not be checked. Try again.');
    }
    const byId = new Map(candidates.map(candidate => [candidate.cohortId, candidate]));
    const items = matches.filter(match => eligible.has(match.candidateKey)).map((match, index) => ({
      cohort: byId.get(match.candidateKey)!, reason: match.reason,
      rank: index + 1, isBestMatch: index === 0,
    }));
    signal.throwIfAborted();
    return recommendationResultSchema.parse({ requestId: request.requestId, inputRevision: request.inputRevision, intent, items, mode });
  }
}

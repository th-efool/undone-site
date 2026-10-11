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
    let intent: LearningIntent;
    let mode: RecommendationResult['mode'] = 'ai';
    try {
      const proposal = intentProposalSchema.parse(await this.ai.interpret(request.query, signal));
      const field = <T>(value: T) => ({ value, origin: 'ai' as const, acceptedRevision: request.inputRevision });
      intent = learningIntentSchema.parse({
        id: randomUUID(), rawQuery: request.query, revision: request.inputRevision,
        topic: field(proposal.topic), outcomes: field(proposal.outcomes),
        level: proposal.level ? field(proposal.level) : null,
        language: proposal.language ? field(proposal.language) : null,
        searchTerms: proposal.searchTerms, uncertainties: proposal.uncertainties,
      });
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof CreationFailure) || !['AI_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_OUTPUT', 'RATE_LIMITED'].includes(error.detail.code)) throw error;
      mode = 'database_fallback';
      const field = <T>(value: T) => ({ value, origin: 'application' as const, acceptedRevision: request.inputRevision });
      // Preserve the complete query; the topic is only a bounded display/search excerpt.
      intent = learningIntentSchema.parse({
        id: randomUUID(), rawQuery: request.query, revision: request.inputRevision,
        topic: field(request.query.slice(0, 160)), outcomes: field([]), level: null, language: null,
        searchTerms: [], uncertainties: ['AI interpretation was unavailable. These results use database matching against your original query.'],
      });
    }
    let candidates: ExistingCohortReference[];
    try {
      candidates = (await this.repository.findCandidates(intent, signal)).map(candidate => existingCohortSchema.parse(candidate));
      if (candidates.length > 50 || new Set(candidates.map(c => c.cohortId)).size !== candidates.length) throw new Error('Invalid catalog projection');
    } catch {
      signal.throwIfAborted();
      throw creationFailure('DATA_UNAVAILABLE', 'Cohorts could not be loaded. Try again.');
    }
    let matches: { candidateKey: string; reason: string }[] = [];
    if (candidates.length && mode === 'database_fallback') {
      matches = candidates.slice(0, 5).map(candidate => ({ candidateKey: candidate.cohortId,
        reason: 'Found by database search against your original query. AI interpretation is currently unavailable.' }));
    } else if (candidates.length) {
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

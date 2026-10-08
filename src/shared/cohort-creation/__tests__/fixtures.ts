import { learningIntentSchema, type ExistingCohortReference, type RecommendationResult } from '../contracts';

export const draftId = '11111111-1111-4111-8111-111111111111';
export const requestId = '22222222-2222-4222-8222-222222222222';
export const nextRequestId = '33333333-3333-4333-8333-333333333333';
export const intentProposal = {
  topic: 'Unreal Engine rendering', outcomes: ['Understand lighting'],
  level: null, language: null, searchTerms: ['Unreal', 'rendering'], uncertainties: ['Experience is unstated.'],
};
export const intent = learningIntentSchema.parse({
  id: draftId, rawQuery: 'I want to learn Unreal Engine rendering', revision: 1,
  topic: { value: intentProposal.topic, origin: 'ai', acceptedRevision: 1 },
  outcomes: { value: intentProposal.outcomes, origin: 'ai', acceptedRevision: 1 },
  level: null, language: null, searchTerms: intentProposal.searchTerms, uncertainties: intentProposal.uncertainties,
});
export const candidate: ExistingCohortReference = {
  cohortId: 'real-cohort', title: 'Real rendering cohort', description: 'A database description',
  coverImage: null, creatorName: 'Ada', difficulty: 'BEGINNER', categories: ['Graphics'],
  estimatedCompletionTime: null, memberCount: 7, lessonCount: 3, visibility: 'PUBLIC', isPublished: true,
};
export const result: RecommendationResult = {
  requestId, inputRevision: 1, intent, mode: 'ai',
  items: [{ cohort: candidate, reason: 'Covers lighting for your goal.', rank: 1, isBestMatch: true }],
};
export function modelOutput(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    }, warnings: [],
  };
}

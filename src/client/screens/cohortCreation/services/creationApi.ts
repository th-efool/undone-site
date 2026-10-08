import { apiUrl } from '@/src/shared/api/apiUrl';
import { errorResponseSchema, recommendationRequestSchema, recommendationResultSchema, type CreationError, type RecommendationRequest } from '@/src/shared/cohort-creation/contracts';

export class CreationClientError extends Error {
  constructor(readonly detail: CreationError) { super(detail.message); }
}

export async function requestRecommendations(input: RecommendationRequest, signal: AbortSignal) {
  const response = await fetch(apiUrl('/api/cohort-creation/recommendations'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recommendationRequestSchema.parse(input)), signal,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new CreationClientError(parsed.success ? parsed.data.error : {
      code: 'AI_UNAVAILABLE', message: 'Recommendations are temporarily unavailable. Try again.', retryable: true,
    });
  }
  const parsed = recommendationResultSchema.safeParse(body);
  if (!parsed.success || parsed.data.requestId !== input.requestId || parsed.data.inputRevision !== input.inputRevision || parsed.data.intent.rawQuery !== input.query.trim()) {
    throw new CreationClientError({ code: 'AI_INVALID_OUTPUT', message: 'The recommendation response could not be validated. Try again.', retryable: true });
  }
  return parsed.data;
}

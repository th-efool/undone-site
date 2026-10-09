import { recommendationRequestSchema } from '@/src/shared/cohort-creation/contracts';
import type { RecommendationService } from './recommendation.service';
import { CreationFailure, creationFailure } from './errors';
import { JobBudgetExceeded } from './durable-job';

const MAX_BODY_BYTES = 16_384;
export class RecommendationBudget {
  private calls = 0;
  private active = 0;
  private windowStart = 0;
  // Conservative shared process budget until authenticated/distributed budgets land in 3B.
  constructor(private readonly maxCalls = 10, private readonly windowMs = 600_000) {}
  acquire(now = Date.now()): (() => void) | null {
    if (now - this.windowStart >= this.windowMs) { this.calls = 0; this.windowStart = now; }
    if (this.calls >= this.maxCalls || this.active >= 2) return null;
    this.calls++; this.active++;
    let released = false;
    return () => { if (!released) { this.active--; released = true; } };
  }
}

async function readInput(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw creationFailure('INVALID_REQUEST', 'A learning query is required.', false);
  let bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw creationFailure('INVALID_REQUEST', 'The query request is too large.', false);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export function createRecommendationHandler(
  getService: () => Pick<RecommendationService, 'recommend'>,
  budget: RecommendationBudget,
  reserveDurableRequest?: () => Promise<void>,
) {
  return async (request: Request): Promise<Response> => {
    let input;
    try {
      const parsed = recommendationRequestSchema.safeParse(await readInput(request));
      if (!parsed.success) throw new Error('Invalid request');
      input = parsed.data;
    } catch {
      return Response.json({ error: { code: 'INVALID_REQUEST', message: 'Enter a learning query between 3 and 2,000 characters.', retryable: false } }, { status: 400 });
    }
    const release = budget.acquire();
    if (!release) return Response.json({ error: { code: 'RATE_LIMITED', message: 'Recommendations are busy. Try again shortly.', retryable: true } }, { status: 429, headers: { 'Retry-After': '600' } });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    try {
      await reserveDurableRequest?.();
      const result = await getService().recommend(input, signal);
      signal.throwIfAborted();
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const failure = signal.aborted
        ? creationFailure(signal.reason?.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'CANCELLED', 'The recommendation request stopped. You can retry.')
        : error instanceof JobBudgetExceeded ? creationFailure('RATE_LIMITED', 'Recommendation capacity is exhausted. Try again later.')
        : error instanceof CreationFailure ? error : creationFailure('AI_UNAVAILABLE', 'Recommendations are temporarily unavailable. Try again.');
      const status = failure.detail.code === 'CANCELLED' ? 499 : failure.detail.code === 'AI_TIMEOUT' ? 504 : failure.detail.code === 'RATE_LIMITED' ? 429 : 503;
      return Response.json({ error: failure.detail }, { status, headers: { 'Cache-Control': 'no-store' } });
    } finally { release(); }
  };
}

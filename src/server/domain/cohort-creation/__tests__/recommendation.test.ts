import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { VercelCohortAi } from '@/src/server/infrastructure/ai/vercelCohortAi';
import { RecommendationService, type RecommendationRepository } from '../recommendation.service';
import { createRecommendationHandler, RecommendationBudget } from '../recommendation.http';
import { creationFailure } from '../errors';
import { candidate, intent, intentProposal, modelOutput, requestId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { recommendationResultSchema } from '@/src/shared/cohort-creation/contracts';

const input = { requestId, query: intent.rawQuery, inputRevision: 1 };
const signal = () => new AbortController().signal;
function repository(candidates = [candidate]): RecommendationRepository {
  return { findCandidates: vi.fn(async () => candidates), retainEligible: vi.fn(async (ids: string[]) => new Set(ids)) };
}
function sdk(...outputs: unknown[]) {
  return new VercelCohortAi(new MockLanguageModelV4({ doGenerate: outputs.map(modelOutput) }));
}
function request(body: unknown = input) {
  return new Request('http://localhost/api/cohort-creation/recommendations', { method: 'POST', body: JSON.stringify(body) });
}

describe('recommendation service and HTTP vertical slice', () => {
  it('runs structured intent → database candidates → structured ranking → authoritative cards', async () => {
    const repo = repository();
    const service = new RecommendationService(sdk(intentProposal, { matches: [{ candidateKey: candidate.cohortId, reason: 'Matches your lighting goal.' }] }), repo);
    const response = await createRecommendationHandler(() => service, new RecommendationBudget())(request());
    expect(response.status).toBe(200);
    const result = recommendationResultSchema.parse(await response.json());
    expect(result.intent.rawQuery).toBe(input.query);
    expect(result.intent.topic.origin).toBe('ai');
    expect(result.items[0].cohort).toEqual(candidate);
    expect(repo.retainEligible).toHaveBeenCalledWith([candidate.cohortId], expect.any(AbortSignal));
  });
  it('does not rank or fabricate cards for an empty database', async () => {
    const ai = { interpret: vi.fn(async () => intentProposal), rank: vi.fn() };
    const result = await new RecommendationService(ai, repository([])).recommend(input, signal());
    expect(result.items).toEqual([]);
    expect(ai.rank).not.toHaveBeenCalled();
  });
  it('removes cohorts that become ineligible while the AI is running', async () => {
    const repo = repository(); repo.retainEligible = async () => new Set();
    const result = await new RecommendationService(sdk(intentProposal, { matches: [{ candidateKey: candidate.cohortId, reason: 'x' }] }), repo).recommend(input, signal());
    expect(result.items).toEqual([]);
  });
  it('labels genuine DB fallback when model ranking invents a reference', async () => {
    const result = await new RecommendationService(sdk(intentProposal, { matches: [{ candidateKey: 'invented', reason: 'x' }] }), repository()).recommend(input, signal());
    expect(result.mode).toBe('database_fallback');
    expect(result.items[0].cohort.cohortId).toBe(candidate.cohortId);
  });
  it('rejects unpublished/private projections at the application boundary', async () => {
    const repo = repository([{ ...candidate, isPublished: false } as unknown as typeof candidate]);
    await expect(new RecommendationService(sdk(intentProposal), repo).recommend(input, signal())).rejects.toMatchObject({ detail: { code: 'DATA_UNAVAILABLE' } });
  });
  it('does not turn cancellation or timeout into fallback success', async () => {
    const ai = { interpret: async () => intentProposal, rank: async () => { throw creationFailure('AI_TIMEOUT', 'Timed out'); } };
    await expect(new RecommendationService(ai, repository()).recommend(input, signal())).rejects.toMatchObject({ detail: { code: 'AI_TIMEOUT' } });
  });
  it('validates ingress before service/model construction, including oversized bodies', async () => {
    const getService = vi.fn();
    const handler = createRecommendationHandler(getService, new RecommendationBudget());
    expect((await handler(request({ ...input, stage: 'published' }))).status).toBe(400);
    expect((await handler(request({ ...input, query: 'x'.repeat(20000) }))).status).toBe(400);
    expect(getService).not.toHaveBeenCalled();
  });
  it('sanitizes unknown failures and releases the budget after failed requests', async () => {
    const service = { recommend: vi.fn(async () => { throw new Error('secret-provider-response'); }) };
    const handler = createRecommendationHandler(() => service, new RecommendationBudget(2));
    const first = await handler(request());
    expect(first.status).toBe(503);
    expect(JSON.stringify(await first.json())).not.toContain('secret-provider-response');
    expect((await handler(request())).status).toBe(503);
    expect((await handler(request())).status).toBe(429);
    expect(service.recommend).toHaveBeenCalledTimes(2);
  });
  it('keeps the process budget bounded while requests are active', () => {
    const budget = new RecommendationBudget(10, 100);
    const first = budget.acquire(100)!; const second = budget.acquire(100)!;
    expect(budget.acquire(100)).toBeNull(); first(); first();
    expect(budget.acquire(100)).not.toBeNull(); second();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  VectorScoringService,
  type VectorScoringResult,
} from '../vectorScoring.service';
import { DEFAULT_COHORT_MODEL } from '@/src/server/infrastructure/ai/modelRegistry';
import {
  clearAiMemoryCache,
  getCachedAiResult,
  setCachedAiResult,
} from '@/src/server/domain/cohort-creation/aiCache.repo';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
}));

describe('VectorScoringService AI Content Cache Hook', () => {
  const originalEnv = process.env;

  const sampleTranscript =
    'In this module we analyze memory barriers, CPU cache coherence protocols like MESI, ' +
    'and the implications for concurrent lock-free programming in modern systems architectures.';

  const sampleMetadata = {
    title: 'Cache Coherence and Concurrency',
    chunkIndex: 0,
    totalChunks: 3,
    duration: 180,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAiMemoryCache();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
    delete process.env.MONGODB_URI;
    delete process.env.COHORT_AI_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
    clearAiMemoryCache();
  });

  it('returns memoized 12D vector scoring result on cache hit without querying Gemini', async () => {
    const configuredModel = DEFAULT_COHORT_MODEL;
    const cacheKeyPayload = {
      text: sampleTranscript,
      title: sampleMetadata.title,
      chunkIndex: sampleMetadata.chunkIndex,
      totalChunks: sampleMetadata.totalChunks,
      duration: sampleMetadata.duration,
    };

    const memoizedResult: VectorScoringResult = {
      vector: [0.9, 0.7, 0.4, 0.6, 0.85, 0.5, 0.8, 0.75, 0.9, 0.6, 0.4, 0.5],
      vectorMap: {
        cognitive_load: 0.9,
        practicality_actionability: 0.7,
        visual_dependence: 0.4,
        scaffolding_guidance: 0.6,
        linearity_dependency: 0.85,
        novelty_divergence: 0.5,
        abstraction_depth: 0.8,
        pacing_density: 0.75,
        rigor_formality: 0.9,
        interactivity_agency: 0.6,
        breadth_scope: 0.4,
        emotional_energy: 0.5,
      },
      isStrictlyLinear: true,
      linearityDependencyScore: 0.85,
      isKeyConcept: true,
      summary: 'Memoized overview of MESI cache coherence.',
      confidenceScore: 0.98,
    };

    // Pre-populate Tier 1 AI cache
    await setCachedAiResult('vector_scoring', cacheKeyPayload, memoizedResult, configuredModel);

    const result = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );

    // Assert that Gemini model was never called
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();

    // Assert result matches cached entry exactly
    expect(result).toEqual(memoizedResult);
  });

  it('queries Gemini on cache miss, formats 12D vector, and populates cache', async () => {
    const rawVectorJson = {
      vector: {
        cognitive_load: 0.85,
        practicality_actionability: 0.65,
        visual_dependence: 0.3,
        scaffolding_guidance: 0.5,
        linearity_dependency: 0.7,
        novelty_divergence: 0.6,
        abstraction_depth: 0.75,
        pacing_density: 0.8,
        rigor_formality: 0.85,
        interactivity_agency: 0.4,
        breadth_scope: 0.5,
        emotional_energy: 0.6,
      },
      is_strictly_linear: true,
      confidence_score: 0.94,
      is_key_concept: true,
      summary: 'Detailed look at lock-free memory models.',
    };

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(rawVectorJson),
      },
    });

    const result = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );

    // Assert Gemini was invoked with default model
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_COHORT_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      })
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    expect(result.vector).toHaveLength(12);
    expect(result.isStrictlyLinear).toBe(true);
    expect(result.confidenceScore).toBe(0.94);
    expect(result.summary).toBe('Detailed look at lock-free memory models.');

    // Assert cache was populated
    const cacheKeyPayload = {
      text: sampleTranscript,
      title: sampleMetadata.title,
      chunkIndex: sampleMetadata.chunkIndex,
      totalChunks: sampleMetadata.totalChunks,
      duration: sampleMetadata.duration,
    };

    const cached = await getCachedAiResult<VectorScoringResult>(
      'vector_scoring',
      cacheKeyPayload,
      DEFAULT_COHORT_MODEL
    );

    expect(cached).toEqual(result);
  });

  it('avoids duplicate Gemini scoring calls on subsequent identical requests', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            vector: {},
            is_strictly_linear: false,
            confidence_score: 0.9,
            summary: 'First invocation result.',
          }),
      },
    });

    // 1st call -> Cache miss
    const firstResult = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // 2nd call -> Cache hit
    const secondResult = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(secondResult).toEqual(firstResult);
  });

  it('differentiates cache entries by configured AI model', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              vector: { cognitive_load: 0.5 },
              summary: 'Scored with default model',
            }),
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              vector: { cognitive_load: 0.9 },
              summary: 'Scored with custom pro model',
            }),
        },
      });

    // First call with default model
    delete process.env.COHORT_AI_MODEL;
    const resDefault = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );
    expect(resDefault.summary).toBe('Scored with default model');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Second call with custom model
    process.env.COHORT_AI_MODEL = 'gemini-1.5-pro-experimental';
    const resCustom = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );
    expect(resCustom.summary).toBe('Scored with custom pro model');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('falls back to deterministic NLP heuristic when Gemini rejects and does not cache broken results', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Rate limit exceeded 429'));

    const result = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.vector).toHaveLength(12);
    expect(result.confidenceScore).toBe(0.75); // Heuristic confidence

    // Verify cache has not stored the failure
    const cacheKeyPayload = {
      text: sampleTranscript,
      title: sampleMetadata.title,
      chunkIndex: sampleMetadata.chunkIndex,
      totalChunks: sampleMetadata.totalChunks,
      duration: sampleMetadata.duration,
    };
    const cached = await getCachedAiResult(
      'vector_scoring',
      cacheKeyPayload,
      DEFAULT_COHORT_MODEL
    );
    expect(cached).toBeNull();
  });

  it('normalizes whitespace and subtitle formatting cues so cache hits across unpruned and pruned inputs', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            vector: { cognitive_load: 0.8 },
            is_strictly_linear: true,
            confidence_score: 0.95,
            summary: 'Normalized whitespace cache test.',
          }),
      },
    });

    // 1st call with clean transcript -> Misses cache and calls Gemini once
    const firstResult = await VectorScoringService.scoreTranscript(
      sampleTranscript,
      sampleMetadata
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // 2nd call with dirty unpruned SRT transcript containing same semantic text
    const dirtyTranscript = `
1
00:00:01,000 --> 00:00:05,000
<font color="#ffffff">${sampleTranscript}</font>
`;
    const secondResult = await VectorScoringService.scoreTranscript(
      dirtyTranscript,
      sampleMetadata
    );

    // Cache hit! Gemini should NOT have been invoked again
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(secondResult).toEqual(firstResult);
  });
});

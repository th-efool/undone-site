import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { chunkingService, type SemanticChunkResult } from '../chunking.service';
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

describe('ChunkingService AI Content Cache Hook', () => {
  const originalEnv = process.env;

  const sampleText =
    'This is a comprehensive lecture on distributed systems architecture. ' +
    'We begin by analyzing consensus mechanisms such as Paxos and Raft. ' +
    'Then we transition to partition tolerance and the CAP theorem tradeoffs. ' +
    'Finally, we explore practical implementations in distributed databases.';

  const sampleDuration = 300;
  const sampleTitle = 'Distributed Systems 101';

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

  it('returns memoized chunks on cache hit without invoking GoogleGenerativeAI', async () => {
    const configuredModel =
      process.env.COHORT_AI_MODEL?.trim() || DEFAULT_COHORT_MODEL || 'gemini-3.1-flash-lite';
    const cacheKeyPayload = {
      text: sampleText,
      duration: sampleDuration,
      title: sampleTitle,
    };

    const memoizedChunks: SemanticChunkResult[] = [
      {
        start: 0,
        end: 150,
        title: 'Consensus Protocols',
        summary: 'Overview of Paxos and Raft.',
        text: 'We begin by analyzing consensus mechanisms...',
      },
      {
        start: 150,
        end: 300,
        title: 'CAP Theorem & Storage',
        summary: 'Partition tolerance in distributed databases.',
        text: 'Then we transition to partition tolerance...',
      },
    ];

    // Seed Tier 1 SHA-256 cache
    await setCachedAiResult('semantic_chunking', cacheKeyPayload, memoizedChunks, configuredModel);

    const result = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );

    // Assert that Gemini model was never queried
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();

    // Assert that result matches memoized payload exactly
    expect(result).toEqual(memoizedChunks);
  });

  it('queries Gemini on cache miss, returns formatted chunks, and populates cache', async () => {
    const configuredModel =
      process.env.COHORT_AI_MODEL?.trim() || DEFAULT_COHORT_MODEL || 'gemini-3.1-flash-lite';
    const rawGeminiOutput = [
      {
        title: 'Introduction & Consensus',
        summary: 'Understanding consensus fundamentals.',
        approximatePercentageStart: 0,
        approximatePercentageEnd: 50,
        text: 'This is a comprehensive lecture on distributed systems architecture.',
      },
      {
        title: 'Tradeoffs & Applications',
        summary: 'CAP theorem in practice.',
        approximatePercentageStart: 50,
        approximatePercentageEnd: 100,
        text: 'Finally, we explore practical implementations in distributed databases.',
      },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(rawGeminiOutput),
      },
    });

    const result = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );

    // Gemini should have been invoked
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: configuredModel,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      })
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(150);
    expect(result[0].title).toBe('Introduction & Consensus');
    expect(result[1].start).toBe(150);
    expect(result[1].end).toBe(300);

    // Verify item is now cached
    const cacheKeyPayload = {
      text: sampleText,
      duration: sampleDuration,
      title: sampleTitle,
    };
    const cachedResult = await getCachedAiResult<SemanticChunkResult[]>(
      'semantic_chunking',
      cacheKeyPayload,
      configuredModel
    );

    expect(cachedResult).toEqual(result);
  });

  it('avoids duplicate Gemini calls on subsequent identical invocations', async () => {
    const geminiPayload = [
      {
        title: 'Single Atomic Chunk',
        summary: 'Full lecture summary.',
        approximatePercentageStart: 0,
        approximatePercentageEnd: 100,
        text: sampleText,
      },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiPayload),
      },
    });

    // First call: cache miss -> queries Gemini
    const firstResult = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Second call: cache hit -> uses cache without calling Gemini
    const secondResult = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(secondResult).toEqual(firstResult);
  });

  it('differentiates cache keys when title or duration changes', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify([
              {
                title: 'Lesson V1',
                summary: 'Summary 1',
                approximatePercentageStart: 0,
                approximatePercentageEnd: 100,
                text: sampleText,
              },
            ]),
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify([
              {
                title: 'Lesson V2',
                summary: 'Summary 2',
                approximatePercentageStart: 0,
                approximatePercentageEnd: 100,
                text: sampleText,
              },
            ]),
        },
      });

    const res1 = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: 'Title A' }
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(res1[0].title).toBe('Lesson V1');

    const res2 = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: 'Title B' }
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(res2[0].title).toBe('Lesson V2');
  });

  it('falls back to heuristic segmentation when Gemini fails and avoids caching broken output', async () => {
    const configuredModel =
      process.env.COHORT_AI_MODEL?.trim() || DEFAULT_COHORT_MODEL || 'gemini-3.1-flash-lite';
    mockGenerateContent.mockRejectedValueOnce(new Error('503 Service Unavailable'));

    const result = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toContain(sampleTitle);

    // Verify failure was not cached
    const cacheKeyPayload = {
      text: sampleText,
      duration: sampleDuration,
      title: sampleTitle,
    };
    const cachedResult = await getCachedAiResult(
      'semantic_chunking',
      cacheKeyPayload,
      configuredModel
    );
    expect(cachedResult).toBeNull();
  });

  it('uses overridden model for both cache key and Gemini client call when COHORT_AI_MODEL is set', async () => {
    process.env.COHORT_AI_MODEL = 'gemini-custom-model';

    const customOutput = [
      {
        title: 'Custom Chunk',
        summary: 'Chunk generated with custom model.',
        approximatePercentageStart: 0,
        approximatePercentageEnd: 100,
        text: sampleText,
      },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(customOutput),
      },
    });

    const result = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );

    // Check Gemini client was called with overridden model
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-custom-model',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      })
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const cacheKeyPayload = {
      text: sampleText,
      duration: sampleDuration,
      title: sampleTitle,
    };

    // Verify cached under overridden model
    const cachedCustom = await getCachedAiResult<SemanticChunkResult[]>(
      'semantic_chunking',
      cacheKeyPayload,
      'gemini-custom-model'
    );
    expect(cachedCustom).toEqual(result);

    // Verify NOT cached under default model
    const cachedDefault = await getCachedAiResult<SemanticChunkResult[]>(
      'semantic_chunking',
      cacheKeyPayload,
      DEFAULT_COHORT_MODEL
    );
    expect(cachedDefault).toBeNull();

    // Verify second call with overridden model hits cache without calling Gemini again
    const secondResult = await chunkingService.semanticChunkTranscript(
      sampleText,
      sampleDuration,
      { title: sampleTitle }
    );
    expect(secondResult).toEqual(result);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { VectorScoringService } from '../vectorScoring.service';
import { DEFAULT_COHORT_MODEL } from '@/src/server/infrastructure/ai/modelRegistry';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  }),
}));

describe('VectorScoringService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses DEFAULT_COHORT_MODEL when COHORT_AI_MODEL is not set', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.COHORT_AI_MODEL;

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            vector: {
              cognitive_load: 0.8,
              practicality_actionability: 0.9,
              visual_dependence: 0.5,
              scaffolding_guidance: 0.7,
              linearity_dependency: 0.85,
              novelty_divergence: 0.4,
              abstraction_depth: 0.6,
              pacing_density: 0.75,
              rigor_formality: 0.8,
              interactivity_agency: 0.65,
              breadth_scope: 0.3,
              emotional_energy: 0.5,
            },
            is_strictly_linear: true,
            confidence_score: 0.95,
            is_key_concept: true,
            summary: 'Rust ownership and borrowing fundamentals.',
          }),
      },
    });

    const result = await VectorScoringService.evaluateChunk(
      'In this section we cover Rust ownership and borrowing rules.'
    );

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_COHORT_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      })
    );

    expect(result.confidenceScore).toBe(0.95);
    expect(result.isStrictlyLinear).toBe(true);
    expect(result.isKeyConcept).toBe(true);
    expect(result.summary).toBe('Rust ownership and borrowing fundamentals.');
    expect(result.vector).toHaveLength(12);
    expect(result.vectorMap.linearity_dependency).toBe(0.85);
  });

  it('respects process.env.COHORT_AI_MODEL when provided', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.COHORT_AI_MODEL = 'gemini-custom-flash';

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            vector: {},
            is_strictly_linear: false,
            confidence_score: 0.92,
          }),
      },
    });

    await VectorScoringService.scoreTranscript('Sample content');

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-custom-flash',
      })
    );
  });

  it('falls back to deterministic NLP heuristic when GEMINI_API_KEY is omitted', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await VectorScoringService.evaluateChunk(
      'Introduction to variables in JavaScript and primitive types.'
    );

    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
    expect(result.confidenceScore).toBe(0.75);
    expect(result.vector).toHaveLength(12);
    expect(typeof result.isStrictlyLinear).toBe('boolean');
  });

  it('falls back to deterministic NLP heuristic when Gemini throws an error', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockRejectedValueOnce(new Error('Model not found (404)'));

    const result = await VectorScoringService.evaluateChunk(
      'Advanced concurrent data structures and atomic operations.'
    );

    expect(mockGetGenerativeModel).toHaveBeenCalled();
    expect(result.confidenceScore).toBe(0.75);
    expect(result.vector).toHaveLength(12);
  });
});

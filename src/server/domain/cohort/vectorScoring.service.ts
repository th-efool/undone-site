import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PEDAGOGICAL_DIMENSIONS,
  type PedagogicalVector12D,
  type VectorArray12D,
} from '@/src/shared/curriculum/pedagogicalVector.types';
import {
  vectorToArray,
  arrayToVector,
  computeDeterministicChunkVector,
} from '@/src/shared/curriculum/pedagogicalVector.engine';
import { DEFAULT_COHORT_MODEL } from '@/src/server/infrastructure/ai/modelRegistry';
import { getCachedAiResult, setCachedAiResult } from '@/src/server/domain/cohort-creation/aiCache.repo';
import { pruneTranscriptWhitespace } from '@/src/shared/lib/aiPromptUtils';

export interface VectorScoringResult {
  vector: VectorArray12D;
  vectorMap: PedagogicalVector12D;
  isStrictlyLinear: boolean;
  linearityDependencyScore: number;
  isKeyConcept?: boolean;
  summary?: string;
  confidenceScore: number;
}

export class VectorScoringService {
  private static getClient(): GoogleGenerativeAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Evaluates a single chunk transcript segment across the 12 pedagogical dimensions.
   * Alias for scoreTranscript.
   */
  static async evaluateChunk(
    text: string,
    metadata?: {
      title?: string;
      chunkIndex?: number;
      totalChunks?: number;
      duration?: number;
    }
  ): Promise<VectorScoringResult> {
    return this.scoreTranscript(text, metadata);
  }

  /**
   * Evaluates an educational transcript (full video or chunk) across the 12 pedagogical dimensions
   * and determines strict linearity prerequisites.
   */
  static async scoreTranscript(
    text: string,
    metadata?: {
      title?: string;
      chunkIndex?: number;
      totalChunks?: number;
      duration?: number;
    }
  ): Promise<VectorScoringResult> {
    if (!text || text.trim().length === 0) {
      return this.heuristicFallback(text, metadata);
    }

    const cleanedText = pruneTranscriptWhitespace(text);
    if (!cleanedText || cleanedText.length === 0) {
      return this.heuristicFallback(cleanedText, metadata);
    }

    const configuredModel =
      process.env.COHORT_AI_MODEL?.trim() || DEFAULT_COHORT_MODEL || 'gemini-2.5-flash';
    const cacheKeyPayload = {
      text: cleanedText,
      title: metadata?.title,
      chunkIndex: metadata?.chunkIndex,
      totalChunks: metadata?.totalChunks,
      duration: metadata?.duration,
    };
    const cached = await getCachedAiResult<VectorScoringResult>('vector_scoring', cacheKeyPayload, configuredModel);
    if (cached && cached.vector && Array.isArray(cached.vector)) {
      return cached;
    }

    const client = this.getClient();

    if (!client) {
      return this.heuristicFallback(cleanedText, metadata);
    }

    try {
      const model = client.getGenerativeModel({
        model: configuredModel,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const prompt = `Pedagogical psychometrician for Undone. Analyze transcript segment. Output 12D Pedagogical Vector and linearity.

METADATA:
Title: ${metadata?.title || 'Unknown Lesson'} | Chunk: ${metadata?.chunkIndex !== undefined ? `#${metadata.chunkIndex + 1}/${metadata.totalChunks || 1}` : 'Full'} | Duration: ${metadata?.duration || 180}s

TRANSCRIPT:
"""
${cleanedText.slice(0, 24000)}
"""

RUBRIC (0.00-1.00):
1. cognitive_load (0=Light/Breezy -> 1=Dense/Complex theory)
2. practicality_actionability (0=Pure theory -> 1=Hands-on code/build)
3. visual_dependence (0=Audio-only -> 1=Screen-critical/diagrams)
4. scaffolding_guidance (0=Open sandbox -> 1=Step-by-step guided)
5. linearity_dependency (0=Standalone -> 1=Strict sequential prerequisite)
6. novelty_divergence (0=Common baseline -> 1=Esoteric/Uncharted)
7. abstraction_depth (0=Concrete syntax/fact -> 1=Meta-frameworks/Philosophy)
8. pacing_density (0=Spacious/Deliberate -> 1=Rapid-fire density)
9. rigor_formality (0=Conversational -> 1=Mathematical proofs/Formal spec)
10. interactivity_agency (0=Passive lecture -> 1=Active challenge/exercise)
11. breadth_scope (0=Micro-topic -> 1=Broad cross-domain)
12. emotional_energy (0=Calm/Contemplative -> 1=High energy/Inspiring)

LINEARITY:
- is_strictly_linear: true ONLY IF incomprehensible without preceding chunks (e.g. sequential derivation/tutorial); false if modular/standalone.

JSON SCHEMA:
{
  "vector": {
    "cognitive_load": 0.00,
    "practicality_actionability": 0.00,
    "visual_dependence": 0.00,
    "scaffolding_guidance": 0.00,
    "linearity_dependency": 0.00,
    "novelty_divergence": 0.00,
    "abstraction_depth": 0.00,
    "pacing_density": 0.00,
    "rigor_formality": 0.00,
    "interactivity_agency": 0.00,
    "breadth_scope": 0.00,
    "emotional_energy": 0.00
  },
  "is_strictly_linear": true,
  "confidence_score": 0.95,
  "is_key_concept": false,
  "summary": "1 sentence overview."
}
`;

      const response = await model.generateContent(prompt);
      const rawText = response.response.text();
      const parsed = JSON.parse(rawText);

      const vectorMap = arrayToVector(
        PEDAGOGICAL_DIMENSIONS.map((dim) => {
          const val = parsed.vector?.[dim];
          return typeof val === 'number' && !isNaN(val) ? Math.max(0, Math.min(1, val)) : 0.5;
        })
      );

      const vectorArray = vectorToArray(vectorMap);
      const isStrictlyLinear =
        typeof parsed.is_strictly_linear === 'boolean'
          ? parsed.is_strictly_linear
          : vectorMap.linearity_dependency >= 0.60;

      const finalResult: VectorScoringResult = {
        vector: vectorArray,
        vectorMap,
        isStrictlyLinear,
        linearityDependencyScore: vectorMap.linearity_dependency,
        isKeyConcept: Boolean(parsed.is_key_concept),
        summary: parsed.summary || '',
        confidenceScore: parsed.confidence_score ?? 0.9,
      };

      await setCachedAiResult('vector_scoring', cacheKeyPayload, finalResult, configuredModel);
      return finalResult;
    } catch (error) {
      console.warn('[VectorScoringService] Gemini evaluation failed, using fallback:', error);
      return this.heuristicFallback(cleanedText, metadata);
    }
  }

  /**
   * Deterministic NLP heuristic fallback for offline or zero-key environments.
   */
  private static heuristicFallback(
    text: string,
    metadata?: { title?: string; duration?: number; chunkIndex?: number; totalChunks?: number }
  ): VectorScoringResult {
    const computed = computeDeterministicChunkVector(text, { ...metadata, durationSeconds: metadata?.duration });

    return {
      vector: computed.vector,
      vectorMap: computed.vectorMap,
      isStrictlyLinear: computed.isStrictlyLinear,
      linearityDependencyScore: computed.vectorMap.linearity_dependency,
      isKeyConcept: computed.isKeyConcept,
      summary: metadata?.title || 'Heuristic evaluated chunk',
      confidenceScore: 0.75,
    };
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PEDAGOGICAL_DIMENSIONS,
  type PedagogicalVector12D,
  type VectorArray12D,
} from '@/src/shared/curriculum/pedagogicalVector.types';
import {
  vectorToArray,
  arrayToVector,
} from '@/src/shared/curriculum/pedagogicalVector.engine';

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
    const client = this.getClient();

    if (!client || !text || text.trim().length === 0) {
      return this.heuristicFallback(text, metadata);
    }

    try {
      const model = client.getGenerativeModel({
        model: 'gemini-3.6-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const prompt = `
You are an expert pedagogical psychometrician and curriculum engineer for SideQuestHQ.
Analyze the following educational video transcript segment and output an accurate 12-Dimensional Pedagogical Vector and linearity classification.

METADATA:
Title: ${metadata?.title || 'Unknown Lesson'}
Chunk: ${metadata?.chunkIndex !== undefined ? `#${metadata.chunkIndex + 1} of ${metadata.totalChunks || 1}` : 'Full Video'}
Duration: ${metadata?.duration || 180}s

TRANSCRIPT:
"""
${text.slice(0, 30000)}
"""

EVALUATION RUBRIC (Score each continuous dimension strictly between 0.00 and 1.00):
1. cognitive_load (0.0 = Light/Breezy/Low strain -> 1.0 = Dense/Heavy working memory/Complex theory)
2. practicality_actionability (0.0 = Pure theory/Observation -> 1.0 = Direct code/Hands-on terminal/Build)
3. visual_dependence (0.0 = Pure audio/Podcast/Screen-free -> 1.0 = Screen-critical/Visual diagrams/IDE)
4. scaffolding_guidance (0.0 = Open sandbox/Socratic -> 1.0 = Step-by-step guided blueprint)
5. linearity_dependency (0.0 = Standalone atom/Context-free -> 1.0 = Strict sequential prerequisite)
6. novelty_divergence (0.0 = Common baseline/Familiar -> 1.0 = Esoteric/Uncharted/Serendipitous)
7. abstraction_depth (0.0 = Concrete syntax/Fact -> 1.0 = Meta-frameworks/Philosophy/Abstract theory)
8. pacing_density (0.0 = Spacious/Deliberate -> 1.0 = Rapid-fire information density)
9. rigor_formality (0.0 = Intuitive/Conversational -> 1.0 = Mathematical proofs/Formal technical spec)
10. interactivity_agency (0.0 = Passive lecture -> 1.0 = Active exercise/Think-along challenge)
11. breadth_scope (0.0 = Micro single-topic focus -> 1.0 = Broad cross-domain synthesis)
12. emotional_energy (0.0 = Calming/Contemplative -> 1.0 = High energy/Inspiring spark/Fast paced)

LINEARITY CLASSIFICATION:
- is_strictly_linear (boolean): Set to true ONLY IF a learner cannot understand this chunk without watching preceding chunks (e.g. step-by-step code tutorial, mathematical derivation). Set to false if it is modular, tips, standalone Q&A, or self-contained.

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
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

      return {
        vector: vectorArray,
        vectorMap,
        isStrictlyLinear,
        linearityDependencyScore: vectorMap.linearity_dependency,
        isKeyConcept: Boolean(parsed.is_key_concept),
        summary: parsed.summary || '',
        confidenceScore: parsed.confidence_score ?? 0.9,
      };
    } catch (error) {
      console.warn('[VectorScoringService] Gemini evaluation failed, using fallback:', error);
      return this.heuristicFallback(text, metadata);
    }
  }

  /**
   * Deterministic NLP heuristic fallback for offline or zero-key environments.
   */
  private static heuristicFallback(
    text: string,
    metadata?: { title?: string; duration?: number; chunkIndex?: number }
  ): VectorScoringResult {
    const lower = (text || '').toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Fast heuristic keyword scoring
    const hasCode = /const |function |import |return |class |<div|npm |git |def |def /i.test(lower);
    const hasMath = /theorem|formula|equation|derivative|integral|matrix|proof|algorithm/i.test(lower);
    const hasPodcast = /interview|welcome back|today we are discussing|let's talk about|in this episode/i.test(lower);
    const hasSequentialWords = /first|second|then|next|finally|step 1|step 2|previously|as we saw/i.test(lower);

    const cognitiveLoad = hasMath ? 0.85 : hasCode ? 0.70 : Math.min(0.8, Math.max(0.2, wordCount / 400));
    const practicality = hasCode ? 0.90 : hasMath ? 0.50 : 0.30;
    const visualDependence = hasCode ? 0.85 : hasPodcast ? 0.15 : 0.50;
    const scaffolding = hasSequentialWords ? 0.75 : 0.45;
    const linearity = hasSequentialWords || hasCode ? 0.70 : 0.35;
    const novelty = 0.50;
    const abstraction = hasMath ? 0.85 : hasCode ? 0.35 : 0.50;
    const pacing = Math.min(1.0, Math.max(0.2, wordCount / ((metadata?.duration || 180) / 60 * 150)));
    const rigor = hasMath ? 0.90 : hasCode ? 0.75 : 0.40;
    const interactivity = hasCode ? 0.80 : 0.30;
    const breadth = hasPodcast ? 0.75 : 0.40;
    const energy = 0.60;

    const vectorArray: VectorArray12D = [
      cognitiveLoad,
      practicality,
      visualDependence,
      scaffolding,
      linearity,
      novelty,
      abstraction,
      pacing,
      rigor,
      interactivity,
      breadth,
      energy,
    ];

    const vectorMap = arrayToVector(vectorArray);

    return {
      vector: vectorArray,
      vectorMap,
      isStrictlyLinear: linearity >= 0.60,
      linearityDependencyScore: linearity,
      isKeyConcept: false,
      summary: metadata?.title || 'Heuristic evaluated chunk',
      confidenceScore: 0.6,
    };
  }
}

import { describe, it, expect } from 'vitest';
import {
  computeTargetVector,
  calculateWeightedSimilarity,
  vectorToArray,
  arrayToVector,
  rawCosineSimilarity,
  CHANNEL_BASE_VECTORS,
  TIME_OF_DAY_VECTORS,
  PEDAGOGICAL_DIMENSIONS
} from '../pedagogicalVector.engine';
import type { ChunkScoringContext, PedagogicalVector12D } from '../pedagogicalVector.types';

describe('pedagogicalVector.engine', () => {
  describe('computeTargetVector', () => {
    it('should correctly resolve defaultOptionId and apply USER_WEIGHT_CAP (0.25)', () => {
      // For 'spark' channel, 'novelty' control:
      // defaultNormalized: 0.0, defaultOptionId: 'familiar', dimensionDeltas: { novelty_divergence: 0.40, abstraction_depth: 0.15 }
      
      const contextDefault: ChunkScoringContext = {
        currentTime: new Date('2026-08-22T10:00:00Z'),
        activeChannel: 'spark',
        timeBlendWeight: 0.0, 
        rawStringPrefs: {
          'spark_novelty': 'familiar' // matches defaultOptionId, so diff is 0
        },
        userCompletedChunkIds: new Set()
      };
      
      const vecDefault = computeTargetVector(contextDefault);
      const baseSpark = CHANNEL_BASE_VECTORS['spark'];
      
      expect(vecDefault.novelty_divergence).toBeCloseTo(baseSpark.novelty_divergence);
      expect(vecDefault.abstraction_depth).toBeCloseTo(baseSpark.abstraction_depth);

      const contextNonDefault: ChunkScoringContext = {
        currentTime: new Date('2026-08-22T10:00:00Z'),
        activeChannel: 'spark',
        timeBlendWeight: 0.0, 
        rawStringPrefs: {
          'spark_novelty': 'unfamiliar' // does not match defaultOptionId, so userVal = 1.0, diff = 1.0
        },
        userCompletedChunkIds: new Set()
      };

      const vecNonDefault = computeTargetVector(contextNonDefault);
      
      // USER_WEIGHT_CAP is 0.25. Delta for novelty_divergence is 0.40.
      // Expected addition: 1.0 * 0.40 * 0.25 = 0.10
      expect(vecNonDefault.novelty_divergence).toBeCloseTo(baseSpark.novelty_divergence + 0.10);
      
      // Expected addition for abstraction_depth: 1.0 * 0.15 * 0.25 = 0.0375
      expect(vecNonDefault.abstraction_depth).toBeCloseTo(baseSpark.abstraction_depth + 0.0375);
    });

    it('should blend time of day correctly', () => {
      // Force an afternoon time (getHours() = 14)
      const testDate = new Date();
      testDate.setHours(14, 0, 0, 0);

      const context: ChunkScoringContext = {
        currentTime: testDate,
        activeChannel: 'build',
        timeBlendWeight: 0.5,
        userCompletedChunkIds: new Set()
      };

      const vec = computeTargetVector(context);
      const baseBuild = CHANNEL_BASE_VECTORS['build'];
      const baseAfternoon = TIME_OF_DAY_VECTORS['afternoon'];

      // Expected calculation: (1 - 0.5) * baseBuild + 0.5 * baseAfternoon
      const expectedCognitiveLoad = 0.5 * baseBuild.cognitive_load + 0.5 * baseAfternoon.cognitive_load;
      
      expect(vec.cognitive_load).toBeCloseTo(expectedCognitiveLoad);
    });
  });

  describe('vector and array conversions', () => {
    it('should correctly convert vector to array and back', () => {
      const arr = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5, 0.5];
      const vec = arrayToVector(arr);
      
      PEDAGOGICAL_DIMENSIONS.forEach((dim, idx) => {
        expect(vec[dim]).toBe(arr[idx]);
      });

      const arr2 = vectorToArray(vec);
      expect(arr2).toEqual(arr);
    });
  });

  describe('similarity calculations workflow simulation', () => {
    it('should accurately calculate weighted and unweighted similarities for render chunks', () => {
      // Simulate target vector
      const targetVec = CHANNEL_BASE_VECTORS['explore'];
      
      // Simulate chunk vector
      const chunkVec = { ...CHANNEL_BASE_VECTORS['explore'], cognitive_load: 0.1, novelty_divergence: 0.1 };

      // Uniform weights for simple test
      const weights: PedagogicalVector12D = {
        cognitive_load: 1,
        practicality_actionability: 1,
        visual_dependence: 1,
        scaffolding_guidance: 1,
        linearity_dependency: 1,
        novelty_divergence: 1,
        abstraction_depth: 1,
        pacing_density: 1,
        rigor_formality: 1,
        interactivity_agency: 1,
        breadth_scope: 1,
        emotional_energy: 1,
      };

      const similarity = calculateWeightedSimilarity(targetVec, chunkVec, weights);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);

      const targetArr = vectorToArray(targetVec);
      const chunkArr = vectorToArray(chunkVec);
      
      const rawSim = rawCosineSimilarity(targetArr, chunkArr);
      expect(rawSim).toBeCloseTo(similarity); // Should be very close since weights are all 1
    });
  });
});

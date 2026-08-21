/**
 * SideQuestHQ - Pedagogical Vector Constants & Math Engine
 * File: src/shared/curriculum/pedagogicalVector.engine.ts
 */

import {
  PEDAGOGICAL_DIMENSIONS,
  type PedagogicalDimension,
  type PedagogicalVector12D,
  type VectorArray12D,
  type TimeOfDaySlot,
  type ChannelId,
  type ChannelControlDelta,
  type ChunkScoringContext,
  type PedagogicalChunkMetadata,
} from './pedagogicalVector.types';

export type {
  PedagogicalDimension,
  PedagogicalVector12D,
  VectorArray12D,
  TimeOfDaySlot,
  ChannelId,
  ChannelControlDelta,
  ChunkScoringContext,
  PedagogicalChunkMetadata,
};
export { PEDAGOGICAL_DIMENSIONS };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS: 4 Time-of-Day Base Vectors
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_OF_DAY_VECTORS: Record<TimeOfDaySlot, PedagogicalVector12D> = {
  morning: {
    cognitive_load: 0.85,
    practicality_actionability: 0.50,
    visual_dependence: 0.70,
    scaffolding_guidance: 0.40,
    linearity_dependency: 0.75,
    novelty_divergence: 0.35,
    abstraction_depth: 0.80,
    pacing_density: 0.75,
    rigor_formality: 0.85,
    interactivity_agency: 0.65,
    breadth_scope: 0.40,
    emotional_energy: 0.80,
  },
  afternoon: {
    cognitive_load: 0.30,
    practicality_actionability: 0.35,
    visual_dependence: 0.20,
    scaffolding_guidance: 0.70,
    linearity_dependency: 0.20,
    novelty_divergence: 0.45,
    abstraction_depth: 0.30,
    pacing_density: 0.45,
    rigor_formality: 0.25,
    interactivity_agency: 0.30,
    breadth_scope: 0.60,
    emotional_energy: 0.50,
  },
  evening: {
    cognitive_load: 0.65,
    practicality_actionability: 0.95,
    visual_dependence: 0.85,
    scaffolding_guidance: 0.65,
    linearity_dependency: 0.50,
    novelty_divergence: 0.40,
    abstraction_depth: 0.35,
    pacing_density: 0.60,
    rigor_formality: 0.50,
    interactivity_agency: 0.90,
    breadth_scope: 0.45,
    emotional_energy: 0.70,
  },
  night: {
    cognitive_load: 0.40,
    practicality_actionability: 0.15,
    visual_dependence: 0.30,
    scaffolding_guidance: 0.30,
    linearity_dependency: 0.25,
    novelty_divergence: 0.85,
    abstraction_depth: 0.90,
    pacing_density: 0.30,
    rigor_formality: 0.35,
    interactivity_agency: 0.20,
    breadth_scope: 0.80,
    emotional_energy: 0.25,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS: 6 Channel Base Vectors
// ─────────────────────────────────────────────────────────────────────────────

export const CHANNEL_BASE_VECTORS: Record<ChannelId, PedagogicalVector12D> = {
  default: {
    cognitive_load: 0.50,
    practicality_actionability: 0.50,
    visual_dependence: 0.50,
    scaffolding_guidance: 0.50,
    linearity_dependency: 0.50,
    novelty_divergence: 0.50,
    abstraction_depth: 0.50,
    pacing_density: 0.50,
    rigor_formality: 0.50,
    interactivity_agency: 0.50,
    breadth_scope: 0.50,
    emotional_energy: 0.50,
  },
  spark: {
    cognitive_load: 0.45,
    practicality_actionability: 0.25,
    visual_dependence: 0.40,
    scaffolding_guidance: 0.50,
    linearity_dependency: 0.15,
    novelty_divergence: 0.85,
    abstraction_depth: 0.65,
    pacing_density: 0.60,
    rigor_formality: 0.30,
    interactivity_agency: 0.35,
    breadth_scope: 0.70,
    emotional_energy: 0.85,
  },
  explore: {
    cognitive_load: 0.55,
    practicality_actionability: 0.30,
    visual_dependence: 0.45,
    scaffolding_guidance: 0.35,
    linearity_dependency: 0.25,
    novelty_divergence: 0.90,
    abstraction_depth: 0.75,
    pacing_density: 0.50,
    rigor_formality: 0.40,
    interactivity_agency: 0.40,
    breadth_scope: 0.90,
    emotional_energy: 0.60,
  },
  build: {
    cognitive_load: 0.70,
    practicality_actionability: 0.95,
    visual_dependence: 0.90,
    scaffolding_guidance: 0.75,
    linearity_dependency: 0.60,
    novelty_divergence: 0.30,
    abstraction_depth: 0.25,
    pacing_density: 0.65,
    rigor_formality: 0.60,
    interactivity_agency: 0.95,
    breadth_scope: 0.35,
    emotional_energy: 0.75,
  },
  listen: {
    cognitive_load: 0.35,
    practicality_actionability: 0.20,
    visual_dependence: 0.05,
    scaffolding_guidance: 0.50,
    linearity_dependency: 0.30,
    novelty_divergence: 0.55,
    abstraction_depth: 0.55,
    pacing_density: 0.40,
    rigor_formality: 0.30,
    interactivity_agency: 0.15,
    breadth_scope: 0.65,
    emotional_energy: 0.45,
  },
  deep_dive: {
    cognitive_load: 0.90,
    practicality_actionability: 0.45,
    visual_dependence: 0.75,
    scaffolding_guidance: 0.50,
    linearity_dependency: 0.85,
    novelty_divergence: 0.35,
    abstraction_depth: 0.85,
    pacing_density: 0.70,
    rigor_formality: 0.90,
    interactivity_agency: 0.55,
    breadth_scope: 0.30,
    emotional_energy: 0.60,
  },
  quick: {
    cognitive_load: 0.35,
    practicality_actionability: 0.50,
    visual_dependence: 0.50,
    scaffolding_guidance: 0.60,
    linearity_dependency: 0.10,
    novelty_divergence: 0.40,
    abstraction_depth: 0.30,
    pacing_density: 0.85,
    rigor_formality: 0.40,
    interactivity_agency: 0.45,
    breadth_scope: 0.30,
    emotional_energy: 0.70,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS: Dimension Importance Weights per Channel
// ─────────────────────────────────────────────────────────────────────────────

export const CHANNEL_DIMENSION_WEIGHTS: Record<ChannelId, PedagogicalVector12D> = {
  default: {
    cognitive_load: 1.0,
    practicality_actionability: 1.0,
    visual_dependence: 1.0,
    scaffolding_guidance: 1.0,
    linearity_dependency: 1.0,
    novelty_divergence: 1.0,
    abstraction_depth: 1.0,
    pacing_density: 1.0,
    rigor_formality: 1.0,
    interactivity_agency: 1.0,
    breadth_scope: 1.0,
    emotional_energy: 1.0,
  },
  spark: {
    cognitive_load: 1.0,
    practicality_actionability: 0.8,
    visual_dependence: 0.9,
    scaffolding_guidance: 0.8,
    linearity_dependency: 1.5,
    novelty_divergence: 2.0,
    abstraction_depth: 1.2,
    pacing_density: 1.0,
    rigor_formality: 0.7,
    interactivity_agency: 0.8,
    breadth_scope: 1.5,
    emotional_energy: 1.8,
  },
  explore: {
    cognitive_load: 1.0,
    practicality_actionability: 0.8,
    visual_dependence: 0.8,
    scaffolding_guidance: 0.9,
    linearity_dependency: 1.2,
    novelty_divergence: 2.0,
    abstraction_depth: 1.5,
    pacing_density: 1.0,
    rigor_formality: 0.9,
    interactivity_agency: 0.8,
    breadth_scope: 2.0,
    emotional_energy: 1.2,
  },
  build: {
    cognitive_load: 1.2,
    practicality_actionability: 2.5,
    visual_dependence: 1.8,
    scaffolding_guidance: 1.4,
    linearity_dependency: 1.2,
    novelty_divergence: 0.6,
    abstraction_depth: 0.8,
    pacing_density: 1.0,
    rigor_formality: 1.2,
    interactivity_agency: 2.2,
    breadth_scope: 0.7,
    emotional_energy: 1.1,
  },
  listen: {
    cognitive_load: 1.2,
    practicality_actionability: 0.7,
    visual_dependence: 3.0,
    scaffolding_guidance: 1.0,
    linearity_dependency: 1.0,
    novelty_divergence: 1.0,
    abstraction_depth: 1.1,
    pacing_density: 1.4,
    rigor_formality: 0.8,
    interactivity_agency: 1.5,
    breadth_scope: 1.0,
    emotional_energy: 1.0,
  },
  deep_dive: {
    cognitive_load: 2.2,
    practicality_actionability: 1.0,
    visual_dependence: 1.2,
    scaffolding_guidance: 1.2,
    linearity_dependency: 1.8,
    novelty_divergence: 0.8,
    abstraction_depth: 2.0,
    pacing_density: 1.2,
    rigor_formality: 2.2,
    interactivity_agency: 1.0,
    breadth_scope: 1.0,
    emotional_energy: 0.9,
  },
  quick: {
    cognitive_load: 1.2,
    practicality_actionability: 1.0,
    visual_dependence: 1.0,
    scaffolding_guidance: 1.2,
    linearity_dependency: 2.5,
    novelty_divergence: 0.9,
    abstraction_depth: 0.8,
    pacing_density: 2.2,
    rigor_formality: 0.9,
    interactivity_agency: 1.0,
    breadth_scope: 1.0,
    emotional_energy: 1.3,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS: Slider Offset Deltas matching ChannelHub.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const CHANNEL_SLIDER_DELTAS: Record<ChannelId, ChannelControlDelta[]> = {
  default: [],
  spark: [
    {
      controlId: 'novelty',
      defaultNormalized: 0.0,
      defaultOptionId: 'familiar',
      dimensionDeltas: { novelty_divergence: 0.40, abstraction_depth: 0.15 },
    },
    {
      controlId: 'connectivity',
      defaultNormalized: 0.0,
      defaultOptionId: 'singular',
      dimensionDeltas: { breadth_scope: 0.45, novelty_divergence: 0.20 },
    },
    {
      controlId: 'abstraction',
      defaultNormalized: 0.0,
      defaultOptionId: 'concrete',
      dimensionDeltas: { abstraction_depth: 0.50, practicality_actionability: -0.25 },
    },
  ],
  explore: [
    {
      controlId: 'novelty',
      defaultNormalized: 0.0,
      defaultOptionId: 'adjacent',
      dimensionDeltas: { novelty_divergence: 0.45 },
    },
    {
      controlId: 'scope',
      defaultNormalized: 0.0,
      defaultOptionId: 'deep',
      dimensionDeltas: { breadth_scope: 0.50, cognitive_load: -0.15 },
    },
    {
      controlId: 'serendipity',
      defaultNormalized: 0.0,
      defaultOptionId: 'curated',
      dimensionDeltas: { novelty_divergence: 0.35, linearity_dependency: -0.20 },
    },
  ],
  build: [
    {
      controlId: 'guidance',
      defaultNormalized: 0.0,
      defaultOptionId: 'step_by_step',
      dimensionDeltas: { scaffolding_guidance: -0.50, cognitive_load: 0.25 },
    },
    {
      controlId: 'scope',
      defaultNormalized: 0.0,
      defaultOptionId: 'micro',
      dimensionDeltas: { cognitive_load: 0.30, breadth_scope: 0.35, linearity_dependency: 0.30 },
    },
    {
      controlId: 'constraint',
      defaultNormalized: 0.0,
      defaultOptionId: 'blueprint',
      dimensionDeltas: { scaffolding_guidance: -0.40, interactivity_agency: 0.20 },
    },
  ],
  listen: [
    {
      controlId: 'format',
      defaultNormalized: 0.0,
      defaultOptionId: 'story',
      dimensionDeltas: { rigor_formality: 0.15, emotional_energy: -0.10 },
    },
    {
      controlId: 'density',
      defaultNormalized: 0.0,
      defaultOptionId: 'casual',
      dimensionDeltas: { cognitive_load: 0.45, rigor_formality: 0.40, pacing_density: 0.25 },
    },
    {
      controlId: 'length',
      defaultNormalized: 0.0,
      defaultOptionId: 'short',
      dimensionDeltas: { breadth_scope: 0.30, cognitive_load: 0.15 },
    },
  ],
  deep_dive: [
    {
      controlId: 'depth',
      defaultNormalized: 0.0,
      defaultOptionId: 'high_level',
      dimensionDeltas: { abstraction_depth: 0.40, cognitive_load: 0.30 },
    },
    {
      controlId: 'rigor',
      defaultNormalized: 0.0,
      defaultOptionId: 'intuitive',
      dimensionDeltas: { rigor_formality: 0.45, cognitive_load: 0.25 },
    },
    {
      controlId: 'scaffolding',
      defaultNormalized: 0.0,
      defaultOptionId: 'guided',
      dimensionDeltas: { scaffolding_guidance: -0.50, interactivity_agency: 0.30 },
    },
  ],
  quick: [
    {
      controlId: 'length',
      defaultNormalized: 0.0,
      defaultOptionId: 'micro',
      dimensionDeltas: { breadth_scope: 0.20, cognitive_load: 0.15 },
    },
    {
      controlId: 'continuity',
      defaultNormalized: 0.0,
      defaultOptionId: 'standalone',
      dimensionDeltas: { linearity_dependency: 0.50 },
    },
    {
      controlId: 'density',
      defaultNormalized: 0.0,
      defaultOptionId: 'light',
      dimensionDeltas: { pacing_density: 0.35, cognitive_load: 0.30 },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATHEMATICS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function getTimeOfDaySlot(date: Date): TimeOfDaySlot {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function vectorToArray(vec: PedagogicalVector12D): VectorArray12D {
  return PEDAGOGICAL_DIMENSIONS.map((dim) => vec[dim]) as VectorArray12D;
}

export function arrayToVector(arr: number[]): PedagogicalVector12D {
  const vec = {} as PedagogicalVector12D;
  PEDAGOGICAL_DIMENSIONS.forEach((dim, idx) => {
    vec[dim] = Math.max(0.0, Math.min(1.0, arr[idx] ?? 0.5));
  });
  return vec;
}

/**
 * Calculates the final Target Query Vector from Channel, Time-of-Day, and User Slider Overrides.
 */
export function computeTargetVector(context: ChunkScoringContext): PedagogicalVector12D {
  const {
    currentTime,
    activeChannel,
    channelSliderValues = {},
    timeBlendWeight = 0.30,
  } = context;

  const timeSlot = getTimeOfDaySlot(currentTime);
  const timeVec = TIME_OF_DAY_VECTORS[timeSlot];
  const channelBaseVec = CHANNEL_BASE_VECTORS[activeChannel];

  // 1. Blend Channel Base with Chronobiological Profile
  const blended: PedagogicalVector12D = {} as PedagogicalVector12D;
  for (const dim of PEDAGOGICAL_DIMENSIONS) {
    blended[dim] = (1 - timeBlendWeight) * channelBaseVec[dim] + timeBlendWeight * timeVec[dim];
  }

  // 2. Apply Slider Modulations with 25% User Preference Weight Cap
  // As requested, the algorithm should not degrade entirely based on sliders.
  const USER_WEIGHT_CAP = 0.25;
  const sliderDefs = CHANNEL_SLIDER_DELTAS[activeChannel] || [];
  for (const ctrl of sliderDefs) {
    let userVal = ctrl.defaultNormalized;

    if (context.rawStringPrefs) {
      const prefStr = context.rawStringPrefs[`${activeChannel}_${ctrl.controlId}`];
      if (prefStr) {
        // If it matches defaultOptionId, it's 0.0, else 1.0
        userVal = (prefStr === ctrl.defaultOptionId) ? 0.0 : 1.0;
      }
    } else if (channelSliderValues && channelSliderValues[ctrl.controlId] !== undefined) {
      userVal = channelSliderValues[ctrl.controlId];
    }

    const diff = userVal - ctrl.defaultNormalized;

    if (Math.abs(diff) > 0.001) {
      for (const [dim, delta] of Object.entries(ctrl.dimensionDeltas) as [PedagogicalDimension, number][]) {
        blended[dim] = (blended[dim] || 0) + (diff * delta * USER_WEIGHT_CAP);
      }
    }
  }

  // 3. Clamp all dimensions to [0.0, 1.0]
  for (const dim of PEDAGOGICAL_DIMENSIONS) {
    blended[dim] = Math.max(0.0, Math.min(1.0, blended[dim]));
  }

  return blended;
}

/**
 * Weighted Cosine Similarity with dimensional weights.
 */
export function calculateWeightedSimilarity(
  target: PedagogicalVector12D,
  chunkVec: PedagogicalVector12D,
  weights: PedagogicalVector12D
): number {
  let dotProduct = 0;
  let normTarget = 0;
  let normChunk = 0;

  for (const dim of PEDAGOGICAL_DIMENSIONS) {
    const w = weights[dim];
    const t = target[dim];
    const c = chunkVec[dim];

    dotProduct += w * t * c;
    normTarget += w * t * t;
    normChunk += w * c * c;
  }

  if (normTarget === 0 || normChunk === 0) return 0;
  return dotProduct / (Math.sqrt(normTarget) * Math.sqrt(normChunk));
}

/**
 * Standard unweighted cosine similarity for raw float arrays.
 */
export function rawCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

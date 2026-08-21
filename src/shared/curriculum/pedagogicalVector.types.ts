/**
 * SideQuestHQ - 12-Dimensional Pedagogical Vector System
 * File: src/shared/curriculum/pedagogicalVector.types.ts
 */

// ==========================================
// 1. Vector Dimension Keys & Vector Shape
// ==========================================

export const PEDAGOGICAL_DIMENSIONS = [
  'cognitive_load',
  'practicality_actionability',
  'visual_dependence',
  'scaffolding_guidance',
  'linearity_dependency',
  'novelty_divergence',
  'abstraction_depth',
  'pacing_density',
  'rigor_formality',
  'interactivity_agency',
  'breadth_scope',
  'emotional_energy',
] as const;

export type PedagogicalDimension = typeof PEDAGOGICAL_DIMENSIONS[number];

export type PedagogicalVector12D = Record<PedagogicalDimension, number>;

export type VectorArray12D = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

// ==========================================
// 2. Chronobiology & Channel Definitions
// ==========================================

export type TimeOfDaySlot = 'morning' | 'afternoon' | 'evening' | 'night';

export type ChannelId = 'default' | 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

export interface ChannelControlDelta {
  controlId: string;
  defaultNormalized: number; // 0.0 to 1.0
  defaultOptionId?: string; // e.g. "short", "familiar"
  dimensionDeltas: Partial<Record<PedagogicalDimension, number>>;
}

// ==========================================
// 3. Chunk Metadata Extension
// ==========================================

export interface PedagogicalChunkMetadata {
  vector: PedagogicalVector12D;
  is_strictly_linear: boolean;
  confidence_score: number;
  evaluated_at?: string;
  evaluator_model?: string;
}

export interface ChunkScoringContext {
  currentTime: Date;
  activeChannel: ChannelId;
  channelSliderValues?: Record<string, number>; // controlId -> normalized float (0.0 to 1.0)
  rawStringPrefs?: Record<string, string>; // e.g. { "quick_length": "short" }
  timeBlendWeight?: number; // default 0.30
  userCompletedChunkIds: Set<string>;
}

// ==========================================
// 4. Gemini Evaluation Response Schema
// ==========================================

export interface GeminiVectorEvaluationResponse {
  vector: PedagogicalVector12D;
  is_strictly_linear: boolean;
  confidence_score: number;
  reasoning_summary: string;
}

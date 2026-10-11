import { z } from 'zod';
import type { PedagogicalDimension } from '@/src/shared/curriculum/pedagogicalVector.types';

const score = z.number().min(0).max(1);
// Explicit properties are required by provider JSON schemas. Enum-keyed records
// emit propertyNames/required without properties and are rejected by Google.
export const pedagogicalVectorSchema = z.strictObject({
  cognitive_load: score,
  practicality_actionability: score,
  visual_dependence: score,
  scaffolding_guidance: score,
  linearity_dependency: score,
  novelty_divergence: score,
  abstraction_depth: score,
  pacing_density: score,
  rigor_formality: score,
  interactivity_agency: score,
  breadth_scope: score,
  emotional_energy: score,
} satisfies Record<PedagogicalDimension, z.ZodNumber>);

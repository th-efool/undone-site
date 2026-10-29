import { z } from 'zod';
import { cohortSourceSchema, cohortWorkspaceSchema, type CohortSource } from './contracts';

export const cohortIntakeSchema = z.strictObject({
  requestId: z.uuid(),
  prompt: z.string().trim().min(1).max(4_000),
  mode: z.enum(['plan', 'search']).default('search'),
  source: z.strictObject({
    label: cohortSourceSchema.shape.label,
    text: z.string().min(1).max(200_000).refine(value => !!value.trim()),
  }).optional(),
  sources: z.array(cohortSourceSchema).max(100).optional(),
});
export type CohortIntakeInput = z.input<typeof cohortIntakeSchema>;
export type CohortIntake = z.output<typeof cohortIntakeSchema>;

export function initialCohort(
  prompt: string,
  options?: { mode?: 'plan' | 'search'; sources?: CohortSource[] }
) {
  const mode = options?.mode ?? 'search';
  const initialSources = options?.sources ?? [];

  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Draft Curriculum',
    intent: prompt,
    audience: '',
    dailyMinutes: 25,
    lessons: [],
    sources: initialSources,
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 0,
      sourceFingerprint: null,
      error: null,
      driver: 'durable',
    },
    journey: {
      version: 1,
      step: mode === 'plan' ? 'chat' : 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
  });
}

export function cohortIntakeEnabled(ownerId: string | null, env: Record<string, string | undefined>) {
  if (env.INTERACTION_COHORT_V2_ENABLED !== '1') return false;
  const owners = env.INTERACTION_COHORT_V2_OWNERS?.split(',').map(value => value.trim()).filter(Boolean) ?? [];
  return owners.length === 0 || (ownerId !== null && owners.includes(ownerId));
}

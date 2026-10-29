import { createHash } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export interface JourneyJobIntent {
  jobKey: string;
  stage: 'recommendations' | 'discovery';
  dependencyFingerprint: string;
  handlerVersion: number;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function planJourneyJobs(state: CohortWorkspace): JourneyJobIntent[] {
  if (!state.journey) return [];
  const jobs: JourneyJobIntent[] = [];
  const query = state.intent.trim().toLowerCase();

  const shouldPlanRecommendations =
    state.journey.step === 'recommendations' &&
    (!state.recommendations ||
      state.recommendations.status === 'failed' ||
      state.recommendations.status === 'queued');

  if (shouldPlanRecommendations) {
    const payload = {
      intentVersion: state.journey.intentVersion,
      query,
      adapterVersion: '1.0.0',
      generation: state.recommendations?.generation ?? 0,
    };
    jobs.push({
      jobKey: `journey:recommendations:${state.journey.intentVersion}`,
      stage: 'recommendations',
      dependencyFingerprint: digest(payload),
      handlerVersion: 1,
    });
  }

  if (state.journey.step === 'discovery' && state.discovery?.status === 'queued') {
    const payload = {
      intentVersion: state.journey.intentVersion,
      query,
      generation: state.discovery.generation,
    };
    jobs.push({
      jobKey: `journey:discovery:${state.journey.intentVersion}:${state.discovery.generation}`,
      stage: 'discovery',
      dependencyFingerprint: digest(payload),
      handlerVersion: 1,
    });
  }

  return jobs;
}

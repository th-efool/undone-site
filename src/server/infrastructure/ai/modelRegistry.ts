import 'server-only';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { creationFailure } from '@/src/server/domain/cohort-creation/errors';

export const DEFAULT_COHORT_MODEL = 'gemini-3.5-flash-lite';
export function createCohortModel(config: { apiKey?: string; modelId?: string } = {
  apiKey: process.env.GEMINI_API_KEY,
  modelId: process.env.COHORT_AI_MODEL,
}): LanguageModel {
  if (!config.apiKey?.trim()) {
    throw creationFailure('AI_UNAVAILABLE', 'Cohort recommendations are not configured yet.', false);
  }
  const modelId = config.modelId === undefined ? DEFAULT_COHORT_MODEL : config.modelId.trim();
  if (!modelId) throw creationFailure('AI_UNAVAILABLE', 'The cohort model is not configured.', false);
  return createGoogle({ apiKey: config.apiKey })(modelId);
}

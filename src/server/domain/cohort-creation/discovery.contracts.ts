import { z } from 'zod';
import { learningIntentSchema } from '@/src/shared/cohort-creation/contracts';
import { creationFailure } from './errors';

import { groundedSearchSchema, discoverySelectionSchema, type GroundedSearch, type DiscoveryCandidate, type DiscoverySelection } from '@/src/shared/cohort-creation/discovery';
export { DISCOVERY_LIMITS, groundedCitationSchema, groundedSearchSchema, discoveryCandidateSchema, discoverySelectionSchema } from '@/src/shared/cohort-creation/discovery';
export type { GroundedSearch, DiscoveryCandidate, DiscoverySelection } from '@/src/shared/cohort-creation/discovery';
export interface ResourceDiscovery {
  search(intent: z.infer<typeof learningIntentSchema>, signal: AbortSignal): Promise<GroundedSearch>;
  select(intent: z.infer<typeof learningIntentSchema>, candidates: DiscoveryCandidate[], signal: AbortSignal): Promise<DiscoverySelection>;
}
export function validateGroundedSearch(input: unknown): GroundedSearch {
  const result = groundedSearchSchema.safeParse(input);
  if (!result.success || new Set(result.data.citations.map(source => source.id)).size !== result.data.citations.length) {
    throw creationFailure('AI_INVALID_OUTPUT', 'Search grounding could not be validated. Try a narrower learning goal.', false);
  }
  if (result.data.attribution && new TextEncoder().encode(result.data.attribution.renderedContent).byteLength > 64 * 1024) {
    throw creationFailure('AI_INVALID_OUTPUT', 'Search attribution exceeds its allowed scope.', false);
  }
  for (const citation of result.data.citations) {
    const url = new URL(citation.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || /[\u0000-\u0020\u007f\\]/.test(citation.url)) {
      throw creationFailure('AI_INVALID_OUTPUT', 'Search returned an unsupported citation URL. Try again.', false);
    }
  }
  return result.data;
}
export function validateDiscoverySelection(input: unknown, candidates: DiscoveryCandidate[]): DiscoverySelection {
  const result = discoverySelectionSchema.safeParse(input); const allowed = new Set(candidates.map(candidate => candidate.key));
  if (!result.success || new Set(result.data.selected.map(item => item.candidateKey)).size !== result.data.selected.length ||
    result.data.selected.some(item => !allowed.has(item.candidateKey))) {
    throw creationFailure('AI_INVALID_OUTPUT', 'Source selection referenced unavailable candidates. Try again.');
  }
  return result.data;
}

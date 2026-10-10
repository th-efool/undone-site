import { z } from 'zod';
import { learningIntentSchema } from '@/src/shared/cohort-creation/contracts';
import { creationFailure } from './errors';

export const DISCOVERY_LIMITS = { citations: 30, candidates: 20, selected: 5, calls: 3 } as const;
export const groundedCitationSchema = z.strictObject({
  id: z.string().min(1).max(256), url: z.url().max(2048), title: z.string().max(300),
});
export const groundedSearchSchema = z.strictObject({ citations: z.array(groundedCitationSchema).max(DISCOVERY_LIMITS.citations),
  attribution: z.strictObject({ provider: z.literal('google_search'), renderedContent: z.string().max(64 * 1024) }).nullable(),
  searchedAt: z.iso.datetime(), model: z.strictObject({ provider: z.string().min(1).max(128), id: z.string().min(1).max(256) }) });
export const discoveryCandidateSchema = z.strictObject({
  key: z.string().regex(/^[a-f0-9]{64}$/), citationIds: z.array(z.string().min(1).max(256)).min(1).max(DISCOVERY_LIMITS.citations),
  url: z.url().max(2048), title: z.string().min(1).max(300), kind: z.enum(['web', 'youtube_video', 'youtube_playlist', 'github']),
  observedAt: z.iso.datetime(),
  observation: z.strictObject({ method: z.enum(['public_http', 'youtube_api', 'github_api']), requestedUrl: z.url().max(2048),
    redirects: z.array(z.url().max(2048)).max(3), titleOrigin: z.enum(['observed', 'application']), contentRetained: z.literal(false) }),
});
export const discoverySelectionSchema = z.strictObject({ selected: z.array(z.strictObject({
  candidateKey: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(1).max(600),
})).max(DISCOVERY_LIMITS.selected) });
export type GroundedSearch = z.infer<typeof groundedSearchSchema>;
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;
export type DiscoverySelection = z.infer<typeof discoverySelectionSchema>;
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

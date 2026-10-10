import { z } from 'zod';
import { retainedObjectRefSchema } from './storage';

export const DISCOVERY_LIMITS = { citations: 30, candidates: 20, selected: 5, calls: 3 } as const;
export const groundedCitationSchema = z.strictObject({ id: z.string().min(1).max(256), url: z.url().max(2048), title: z.string().max(300) });
export const groundedSearchSchema = z.strictObject({ citations: z.array(groundedCitationSchema).max(DISCOVERY_LIMITS.citations),
  attribution: z.strictObject({ provider: z.literal('google_search'), renderedContent: z.string().max(64 * 1024) }).nullable(),
  searchedAt: z.iso.datetime(), model: z.strictObject({ provider: z.string().min(1).max(128), id: z.string().min(1).max(256) }) });
export const discoveryCandidateSchema = z.strictObject({ key: z.string().regex(/^[a-f0-9]{64}$/),
  citationIds: z.array(z.string().min(1).max(256)).min(1).max(DISCOVERY_LIMITS.citations), url: z.url().max(2048), title: z.string().min(1).max(300),
  kind: z.enum(['web', 'youtube_video', 'youtube_playlist', 'github']), observedAt: z.iso.datetime(),
  observation: z.strictObject({ method: z.enum(['public_http', 'youtube_api', 'github_api']), requestedUrl: z.url().max(2048),
    redirects: z.array(z.url().max(2048)).max(3), titleOrigin: z.enum(['observed', 'application']), contentRetained: z.literal(false) }) });
export const discoverySelectionSchema = z.strictObject({ selected: z.array(z.strictObject({ candidateKey: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(1).max(600) })).max(DISCOVERY_LIMITS.selected) });
export const discoveryFailureSchema = z.strictObject({ citationId: z.string().min(1).max(256), code: z.enum(['INVALID_INPUT', 'LIMIT_EXCEEDED', 'UNAVAILABLE']),
  message: z.string().min(1).max(300) });
const artifactRef = retainedObjectRefSchema.extend({ kind: z.literal('artifact') });
export const discoveryCheckpointSchema = z.strictObject({ phase: z.literal('discovery_sources'), requestId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  searchArtifact: artifactRef, observationArtifact: artifactRef.nullable(), selectionArtifact: artifactRef.nullable(),
  processed: z.number().int().nonnegative().max(DISCOVERY_LIMITS.citations), total: z.number().int().nonnegative().max(DISCOVERY_LIMITS.citations),
}).refine(value => value.processed <= value.total && (!value.processed || !!value.observationArtifact) &&
  (!value.selectionArtifact || !!value.observationArtifact && value.processed === value.total), 'Invalid discovery progress');
export const discoveryResultSchema = z.strictObject({ checkpoint: discoveryCheckpointSchema,
  candidates: z.array(discoveryCandidateSchema).max(DISCOVERY_LIMITS.candidates), failures: z.array(discoveryFailureSchema).max(DISCOVERY_LIMITS.citations),
  selection: discoverySelectionSchema }).superRefine((value, ctx) => {
  const ids = [...value.candidates.flatMap(candidate => candidate.citationIds), ...value.failures.map(failure => failure.citationId)];
  const keys = value.candidates.map(candidate => candidate.key); const chosen = value.selection.selected.map(item => item.candidateKey);
  if (!value.checkpoint.selectionArtifact || value.checkpoint.processed !== value.checkpoint.total || ids.length !== value.checkpoint.total ||
    new Set(ids).size !== ids.length || new Set(keys).size !== keys.length || new Set(chosen).size !== chosen.length || chosen.some(key => !keys.includes(key))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid discovery result evidence or selection' });
  }
});
export type DiscoveryCheckpoint = z.infer<typeof discoveryCheckpointSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type GroundedSearch = z.infer<typeof groundedSearchSchema>;
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;
export type DiscoverySelection = z.infer<typeof discoverySelectionSchema>;

import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
export const querySchema = text(2000).min(3);
const revision = z.number().int().nonnegative();
const key = text(128);

export const originSchema = z.enum(['user', 'ai', 'application', 'database']);
export function fieldValueSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({ value, origin: originSchema, acceptedRevision: revision });
}

export const learningIntentSchema = z.strictObject({
  id: z.uuid(),
  rawQuery: querySchema,
  revision,
  topic: fieldValueSchema(text(160)),
  outcomes: fieldValueSchema(z.array(text(300)).max(8)),
  level: fieldValueSchema(text(100)).nullable(),
  language: fieldValueSchema(text(80)).nullable(),
  searchTerms: z.array(text(80)).max(8),
  uncertainties: z.array(text(300)).max(8),
});
export type LearningIntent = z.infer<typeof learningIntentSchema>;

// This is a database projection. The model never produces card metadata.
export const existingCohortSchema = z.strictObject({
  cohortId: key,
  title: text(500),
  description: z.string().max(10000),
  coverImage: z.string().max(2048).nullable(),
  creatorName: z.string().max(200).nullable(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  categories: z.array(z.string().max(200)).max(100),
  estimatedCompletionTime: z.string().max(200).nullable(),
  memberCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
  visibility: z.literal('PUBLIC'),
  isPublished: z.literal(true),
});
export type ExistingCohortReference = z.infer<typeof existingCohortSchema>;

export const recommendationSchema = z.strictObject({
  cohort: existingCohortSchema,
  reason: text(600),
  rank: z.number().int().min(1).max(5),
  isBestMatch: z.boolean(),
});
export const recommendationRequestSchema = z.strictObject({
  requestId: z.uuid(),
  inputRevision: revision,
  query: querySchema,
});
export const recommendationResultSchema = z.strictObject({
  requestId: z.uuid(),
  inputRevision: revision,
  intent: learningIntentSchema,
  items: z.array(recommendationSchema).max(5),
  mode: z.enum(['ai', 'database_fallback']),
}).superRefine((result, ctx) => {
  const ids = result.items.map(item => item.cohort.cohortId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate cohorts' });
  if (result.intent.revision !== result.inputRevision) ctx.addIssue({ code: 'custom', message: 'Intent revision mismatch' });
  result.items.forEach((item, index) => {
    if (item.rank !== index + 1 || item.isBestMatch !== (index === 0)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid recommendation ordering', path: ['items', index] });
    }
  });
});
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export type RecommendationResult = z.infer<typeof recommendationResultSchema>;

export const startingPointSchema = z.enum(['have_material', 'find_material', 'have_goal']);
export type StartingPoint = z.infer<typeof startingPointSchema>;
export const workspaceStageSchema = z.enum([
  'recommendations', 'starting_point', 'materials', 'processing',
  'ready', 'review', 'finalizing', 'published',
]);
export type WorkspaceStage = z.infer<typeof workspaceStageSchema>;
export const processingStageSchema = z.enum(['understanding', 'chunking', 'analyzing', 'building']);

export const creationErrorSchema = z.strictObject({
  code: z.enum([
    'INVALID_REQUEST', 'RATE_LIMITED', 'AI_UNAVAILABLE', 'AI_TIMEOUT',
    'AI_INVALID_OUTPUT', 'DATA_UNAVAILABLE', 'CANCELLED', 'INVALID_TRANSITION',
  ]),
  message: text(500),
  retryable: z.boolean(),
});
export type CreationError = z.infer<typeof creationErrorSchema>;
export const errorResponseSchema = z.strictObject({ error: creationErrorSchema });

// Foundation contracts for future artifacts; no ingestion/processing is executed in 3A.
export const githubPathSchema = z.string().min(1).max(1024).refine(path =>
  !/[\u0000-\u001f\u007f\\]/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..'), 'Select a repository-relative path');
export const githubRepositoryScopeSchema = z.strictObject({ ref: z.string().min(1).max(255).nullable().default(null),
  paths: z.array(githubPathSchema).min(1).max(100), connection: z.literal('github').optional() }).superRefine((selection, ctx) => {
  if (selection.paths.some((path, index) => selection.paths.some((other, otherIndex) => otherIndex !== index &&
    (path === other || path.startsWith(`${other}/`))))) ctx.addIssue({ code: 'custom', message: 'Select distinct, non-overlapping paths' });
});
export const materialSourceSchema = z.strictObject({
  id: key,
  kind: z.enum(['youtube_video', 'youtube_playlist', 'web', 'pdf', 'markdown', 'github', 'notion', 'generated_guide']),
  input: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('url'), url: z.url().max(2048), repositoryScope: githubRepositoryScopeSchema.optional() }),
    z.strictObject({ kind: z.literal('upload'), assetId: key }),
    z.strictObject({ kind: z.literal('goal'), intentId: z.uuid() }),
  ]),
  selectedUnitIds: z.array(key).max(100),
  status: z.enum(['pending', 'acquiring', 'ready', 'needs_input', 'failed']),
}).refine(source => source.input.kind !== 'url' || !source.input.repositoryScope || source.kind === 'github', 'Repository scope requires a GitHub source');
export const sourceLocationSchema = z.strictObject({
  materialId: key, unitId: key, segmentId: key,
  anchor: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('text'), start: z.number().int().nonnegative(), end: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('video'), startSeconds: z.number().nonnegative(), endSeconds: z.number().positive(), estimated: z.boolean() }),
    z.strictObject({ kind: z.literal('page'), page: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('block'), blockId: key }),
    z.strictObject({ kind: z.literal('file'), commit: key, path: githubPathSchema, startLine: z.number().int().positive(), endLine: z.number().int().positive() }),
  ]),
}).refine(({ anchor }) => {
  if (anchor.kind === 'text') return anchor.end > anchor.start;
  if (anchor.kind === 'video') return anchor.endSeconds > anchor.startSeconds;
  if (anchor.kind === 'file') return anchor.endLine >= anchor.startLine;
  return true;
}, 'Invalid source span');
export const extractedContentSchema = z.strictObject({
  materialId: key, version: key, checksum: key, artifactRef: key,
  extractionKind: z.enum(['text', 'authorized_caption', 'user_transcript', 'video_observation', 'generated_guide']),
  segmentCount: z.number().int().nonnegative(),
  complete: z.boolean(),
  selectionScope: z.enum(['main_article', 'full_text_response', 'video_observation', 'selected_paths']).optional(),
});
export const conceptSchema = z.strictObject({
  id: key, label: fieldValueSchema(text(200)), summary: fieldValueSchema(text(2000)),
  sourceRefs: z.array(sourceLocationSchema).max(100), prerequisiteIds: z.array(key).max(100),
});
export const chunkSchema = z.strictObject({
  id: key, materialId: key, extractionVersion: key, artifactRef: key,
  title: fieldValueSchema(text(300)), sourceRefs: z.array(sourceLocationSchema).min(1).max(100),
  durationSeconds: z.number().nonnegative(), durationMethod: z.enum(['source', 'reading_estimate', 'model_estimate']),
});
export type MaterialSource = z.infer<typeof materialSourceSchema>;
export type ExtractedContent = z.infer<typeof extractedContentSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type CreationChunk = z.infer<typeof chunkSchema>;

// Defaults safely decode existing schema-1 drafts/events without rewriting stored JSON.
export const creationArtifactRefSchema = z.strictObject({ id: z.uuid(), kind: z.literal('artifact'),
  byteLength: z.number().int().positive().max(25 * 1024 * 1024), checksum: z.string().regex(/^[a-f0-9]{64}$/) });
export const youtubeUnitObservationRefSchema = z.strictObject({ unitId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  artifact: creationArtifactRefSchema, version: z.string().regex(/^[a-f0-9]{64}$/), segmentCount: z.number().int().positive().max(200),
  textBytes: z.number().int().positive().max(1024 * 1024) });
export const youtubeSourceStateSchema = z.strictObject({ materialId: key, sourceRevision: revision,
  metadataFingerprint: z.string().regex(/^[a-f0-9]{64}$/), metadataArtifact: creationArtifactRefSchema,
  units: z.array(z.strictObject({ unitId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), title: z.string().min(1).max(1000), durationSeconds: z.number().int().positive() })).min(1).max(100),
  observations: z.array(youtubeUnitObservationRefSchema).max(100).default([]),
});
export const creationSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1), draftId: z.uuid(), storage: z.literal('postgres'), revision, inputRevision: revision,
  stage: z.enum(['recommendations', 'starting_point']), query: z.string().max(2000),
  status: z.enum(['idle', 'running', 'succeeded', 'failed', 'canceled']), activeRequestId: z.uuid().nullable(),
  result: recommendationResultSchema.nullable(), startingPoint: startingPointSchema.nullable(), error: creationErrorSchema.nullable(),
  materials: z.array(materialSourceSchema).max(20).default([]),
  extractions: z.array(extractedContentSchema).max(20).default([]),
  lastMaterialRequestId: z.uuid().nullable().default(null),
  materialRefs: z.array(z.strictObject({ materialId: key, ids: z.array(z.uuid()).min(1).max(102) })).max(20).default([]),
  youtubeSources: z.array(youtubeSourceStateSchema).max(20).default([]),
}).superRefine((state, ctx) => {
  if ((state.status === 'running') !== (state.activeRequestId !== null)) ctx.addIssue({ code: 'custom', message: 'Invalid active operation' });
  if (state.status === 'running' && ((state.stage === 'recommendations' && state.result !== null) ||
    (state.stage === 'starting_point' && (state.materials.filter(source => source.status === 'acquiring').length !== 1 || state.lastMaterialRequestId !== state.activeRequestId)))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid operation selection' });
  }
  // Material-only edits advance inputRevision without invalidating the accepted learning intent.
  if (state.result && (state.result.inputRevision > state.inputRevision || state.result.intent.rawQuery !== state.query)) {
    ctx.addIssue({ code: 'custom', message: 'Stale snapshot result' });
  }
  if ((state.stage === 'starting_point' || state.status === 'succeeded') && !state.result) {
    ctx.addIssue({ code: 'custom', message: 'Accepted intent is required' });
  }
  const ids = state.materials.map(source => source.id);
  if (new Set(state.youtubeSources.map(source => source.materialId)).size !== state.youtubeSources.length ||
    state.youtubeSources.some(source => source.sourceRevision > state.inputRevision || new Set(source.units.map(unit => unit.unitId)).size !== source.units.length ||
      !state.materials.some(material => material.id === source.materialId && ['youtube_video', 'youtube_playlist'].includes(material.kind)) ||
      !state.materialRefs.some(ref => ref.materialId === source.materialId && ref.ids.includes(source.metadataArtifact.id)) ||
      new Set(source.observations.map(unit => unit.unitId)).size !== source.observations.length ||
      source.observations.reduce((sum, unit) => sum + unit.textBytes, 0) > 1024 * 1024 ||
      source.observations.some(unit => !source.units.some(candidate => candidate.unitId === unit.unitId) ||
        !state.materials.find(material => material.id === source.materialId)?.selectedUnitIds.includes(unit.unitId) ||
        !state.materialRefs.some(ref => ref.materialId === source.materialId && ref.ids.includes(unit.artifact.id))))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid YouTube unit preview or provenance' });
  }
  if (new Set(ids).size !== ids.length || new Set(state.extractions.map(extraction => extraction.materialId)).size !== state.extractions.length ||
    new Set(state.materialRefs.map(ref => ref.materialId)).size !== state.materialRefs.length ||
    state.materialRefs.some(ref => !ids.includes(ref.materialId) || new Set(ref.ids).size !== ref.ids.length) ||
    state.materials.reduce((sum, source) => sum + source.selectedUnitIds.length, 0) > 100 ||
    state.materials.some(source => new Set(source.selectedUnitIds).size !== source.selectedUnitIds.length ||
      (['youtube_video', 'youtube_playlist'].includes(source.kind) && source.selectedUnitIds.some(id =>
        !state.youtubeSources.find(preview => preview.materialId === source.id)?.units.some(unit => unit.unitId === id)))) ||
    state.extractions.some(extraction => !state.materials.some(source => source.id === extraction.materialId && source.status === 'ready'))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid material selection or extraction' });
  }
});
export type CreationSnapshot = z.infer<typeof creationSnapshotSchema>;

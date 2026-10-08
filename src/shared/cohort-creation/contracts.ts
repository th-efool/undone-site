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

// Session-only foundation: this is not an authenticated, server-owned draft.
export const creationSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  draftId: z.uuid(),
  storage: z.literal('tab_session'),
  revision,
  inputRevision: revision,
  stage: z.enum(['recommendations', 'starting_point']),
  query: z.string().max(2000),
  status: z.enum(['idle', 'running', 'succeeded', 'failed', 'canceled']),
  activeRequestId: z.uuid().nullable(),
  result: recommendationResultSchema.nullable(),
  startingPoint: startingPointSchema.nullable(),
  error: creationErrorSchema.nullable(),
}).superRefine((state, ctx) => {
  if ((state.status === 'running') !== (state.activeRequestId !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid active operation' });
  }
  if (state.result && (state.result.inputRevision !== state.inputRevision || state.result.intent.rawQuery !== state.query)) {
    ctx.addIssue({ code: 'custom', message: 'Stale snapshot result' });
  }
  if (state.stage === 'starting_point' && !state.result) {
    ctx.addIssue({ code: 'custom', message: 'Starting point requires accepted intent' });
  }
  if (state.status === 'succeeded' && !state.result) {
    ctx.addIssue({ code: 'custom', message: 'Success requires accepted output' });
  }
});
export type CreationSnapshot = z.infer<typeof creationSnapshotSchema>;

// Foundation contracts for future artifacts; no ingestion/processing is executed in 3A.
export const materialSourceSchema = z.strictObject({
  id: key,
  kind: z.enum(['youtube_video', 'youtube_playlist', 'web', 'pdf', 'markdown', 'github', 'notion', 'generated_guide']),
  input: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('url'), url: z.url().max(2048) }),
    z.strictObject({ kind: z.literal('upload'), assetId: key }),
    z.strictObject({ kind: z.literal('goal'), intentId: z.uuid() }),
  ]),
  selectedUnitIds: z.array(key).max(100),
  status: z.enum(['pending', 'acquiring', 'ready', 'needs_input', 'failed']),
});
export const sourceLocationSchema = z.strictObject({
  materialId: key, unitId: key, segmentId: key,
  anchor: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('text'), start: z.number().int().nonnegative(), end: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('video'), startSeconds: z.number().nonnegative(), endSeconds: z.number().positive(), estimated: z.boolean() }),
    z.strictObject({ kind: z.literal('page'), page: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('block'), blockId: key }),
    z.strictObject({ kind: z.literal('file'), commit: key, path: text(1024), startLine: z.number().int().positive(), endLine: z.number().int().positive() }),
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

import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from 'interaction-builder/core';
import { youtubeVideoUrlSchema, youtubeTrackSchema, youtubeTimeScopeSchema } from './youtube-transcript';
import { githubRepoUrlSchema, githubRefSchema, githubPathsSchema } from './github-source';

const text = z.string().trim().min(1).max(4_000);
const id = z.string().min(1).max(200);
const sourceText = z.string().min(1).max(200_000).refine(value => value.trim().length > 0, 'Source text must contain non-whitespace content');
export const publicSourceUrlSchema = z.string().max(2048).url().refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port;
}, 'Use a public HTTPS URL without credentials or a custom port');
export const sourceInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('generated_guide'), goal: text, audience: z.string().max(500), dailyMinutes: z.number().int().min(1).max(1_440), intentVersion: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal('pdf'), uploadId: z.uuid(), pages: z.array(z.number().int().min(1).max(200)).min(1).max(200).optional() }),
  z.strictObject({ kind: z.literal('web'), url: publicSourceUrlSchema }),
  z.strictObject({
    kind: z.literal('youtube'),
    url: youtubeVideoUrlSchema,
    mode: z.enum(['transcript', 'video_observation']).optional(),
    track: youtubeTrackSchema.optional(),
    scope: youtubeTimeScopeSchema.optional(),
  }).superRefine((data, ctx) => {
    if ((!data.mode || data.mode === 'transcript') && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({ kind: z.literal('github'), repoUrl: githubRepoUrlSchema, ref: githubRefSchema, commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(), paths: githubPathsSchema.optional() }),
]);

export const cohortSourceSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  label: z.string().trim().min(1).max(300),
  text: z.union([sourceText, z.literal('')]),
  input: sourceInputSchema.optional(),
  retainedInputId: z.uuid().optional(),
  extractionId: z.uuid().optional(),
  locations: z.array(z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    page: z.number().int().positive().optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().nonnegative().optional(),
    segmentId: z.string().optional(),
    filePath: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  })).max(1000).optional(),
  provenance: z.strictObject({
    parserVersion: z.string().max(128),
    rawChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    scope: z.enum(['selected_pages', 'main_article', 'full_text_response', 'transcript_only', 'selected_files', 'video_observation']),
    finalUrl: z.string().max(2048).optional(),
    pageCount: z.number().int().positive().max(200).optional(),
    videoId: z.string().optional(),
    track: youtubeTrackSchema.optional(),
    timeScope: youtubeTimeScopeSchema.optional(),
    repoUrl: z.string().max(2048).optional(),
    ref: z.string().max(100).optional(),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
    fileCount: z.number().int().positive().max(25).optional(),
    model: z.strictObject({
      provider: z.string().max(256),
      modelId: z.string().max(256),
      adapterVersion: z.string().max(128),
    }).optional(),
    contentOrigin: z.enum(['external', 'ai']).optional(),
    limitations: z.array(z.string().max(1000)).max(20).optional(),
    estimatedIntervals: z.boolean().optional(),
  }).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  isRestricted: z.boolean().optional(),
  state: z.enum(['queued', 'ready', 'processing', 'failed', 'stale']),
}).superRefine((source,ctx) => { if (!source.input && !source.text.trim()) ctx.addIssue({ code:'custom',message:'Text sources require retained text' }); });
export type CohortSource = z.infer<typeof cohortSourceSchema>;

export const cohortChunkSchema = z.strictObject({
  id,
  sourceId: id,
  sourceVersion: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().min(1).max(24 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CohortChunk = z.infer<typeof cohortChunkSchema>;

export const cohortLessonSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  title: text,
  objective: text,
  sourceChunkIds: z.array(id).max(200),
  pinned: z.boolean(),
  manualOverride: z.boolean().optional(),
  evidenceStatus: z.enum(['valid', 'orphaned']).optional(),
});
export type CohortLesson = z.infer<typeof cohortLessonSchema>;

export const cohortTextJobViewSchema = z.strictObject({
  id, sourceId: id.nullable(), stage: z.enum(['acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly']),
  status: z.enum(['queued', 'running', 'accepted', 'failed', 'canceled', 'superseded']),
  attempts: z.number().int().nonnegative(), error: z.string().max(100).nullable(), retryable: z.boolean(),
});

export const cohortReleaseReceiptSchema = z.strictObject({
  effectKey: z.string().regex(/^[a-f0-9]{64}$/),
  cohortId: z.string().min(1),
  workspaceId: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(['private_activation', 'public_publish']),
  releasedAt: z.string(),
  destinationUrl: z.string().min(1),
});
export type CohortReleaseReceipt = z.infer<typeof cohortReleaseReceiptSchema>;

export const cohortReleaseStateSchema = z.strictObject({
  status: z.enum(['draft', 'prepared', 'released']),
  mode: z.enum(['private_activation', 'public_publish']).optional(),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  effectKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  cohortId: z.string().min(1).optional(),
  preparedAt: z.string().optional(),
  releasedAt: z.string().optional(),
  receipt: cohortReleaseReceiptSchema.optional(),
});
export type CohortReleaseState = z.infer<typeof cohortReleaseStateSchema>;

export const cohortJourneySchema = z.strictObject({
  version: z.literal(1),
  step: z.enum(['recommendations', 'starting_point', 'material_input', 'discovery', 'goal_setup', 'processing', 'ready', 'review', 'published']),
  branch: z.enum(['have_material', 'find_material', 'have_goal']).nullable(),
  processingStarted: z.boolean(),
  intentVersion: z.number().int().nonnegative(),
});
export type CohortJourney = z.infer<typeof cohortJourneySchema>;
const journeyResultFields = {
  requestId: id, fingerprint: z.string().min(1).max(200),
  status: z.enum(['queued', 'running', 'ready', 'failed', 'canceled']),
  resultId: id.optional(), generation: z.number().int().nonnegative(),
};
export const cohortRecommendationItemSchema = z.strictObject({
  id,
  label: z.string().trim().min(1).max(300),
  url: publicSourceUrlSchema,
  description: z.string().max(10000).optional(),
  coverImage: z.string().max(2048).nullable().optional(),
  creatorName: z.string().max(200).nullable().optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  categories: z.array(z.string().max(200)).max(100).optional(),
  estimatedCompletionTime: z.string().max(200).nullable().optional(),
  memberCount: z.number().int().nonnegative().optional(),
  lessonCount: z.number().int().nonnegative().optional(),
  reason: z.string().max(600).optional(),
  isBestMatch: z.boolean().optional(),
});
export const cohortDiscoveryItemSchema = z.strictObject({ id, label: z.string().trim().min(1).max(300), kind: z.literal('web'), url: publicSourceUrlSchema });
export const cohortRecommendationsSchema = z.strictObject({ ...journeyResultFields, items: z.array(cohortRecommendationItemSchema).max(20) });
export type CohortRecommendations = z.infer<typeof cohortRecommendationsSchema>;
export type CohortRecommendationItem = z.infer<typeof cohortRecommendationItemSchema>;
export const cohortDiscoverySchema = z.strictObject({ ...journeyResultFields, items: z.array(cohortDiscoveryItemSchema).max(20) });
export type CohortDiscovery = z.infer<typeof cohortDiscoverySchema>;
export type CohortDiscoveryItem = z.infer<typeof cohortDiscoveryItemSchema>;

export const cohortWorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().max(300),
  intent: text,
  audience: z.string().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  lessons: z.array(cohortLessonSchema).max(200),
  sources: z.array(cohortSourceSchema).max(20).default([]),
  chunks: z.array(cohortChunkSchema).max(2_000).default([]),
  understanding: z.array(z.strictObject({ sourceId: id, sourceVersion: z.number().int().nonnegative(), topics: z.array(z.string().max(120)).max(40) })).default([]),
  analyses: z.array(z.strictObject({ chunkId: id, summary: z.string().max(500), question: z.string().max(500) })).default([]),
  processing: z.strictObject({
    status: z.enum(['idle', 'queued', 'processing', 'ready', 'failed']),
    stage: z.enum(['acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly', 'done']).default('done'),
    generation: z.number().int().nonnegative().default(0),
    sourceFingerprint: z.string().nullable(),
    error: z.string().nullable(),
    jobs: z.array(cohortTextJobViewSchema).max(101).optional(),
    driver: z.enum(['snapshot', 'durable']).optional(),
  }).default({ status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null }),
  release: cohortReleaseStateSchema.optional(),
  journey: cohortJourneySchema.optional(),
  recommendations: cohortRecommendationsSchema.optional(),
  discovery: cohortDiscoverySchema.optional(),
});
export type CohortWorkspace = z.infer<typeof cohortWorkspaceSchema>;

export const cohortActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create_own_cohort') }),
  z.strictObject({ type: z.literal('choose_starting_point'), choice: z.enum(['have_material', 'find_material', 'have_goal']) }),
  z.strictObject({ type: z.literal('back_to_recommendations') }),
  z.strictObject({ type: z.literal('back_to_starting_point') }),
  z.strictObject({ type: z.literal('start_discovery') }),
  z.strictObject({ type: z.literal('select_discovery_resources'), resultId: id, candidateIds: z.array(id).min(1).max(20).refine(ids => new Set(ids).size === ids.length, 'Duplicate candidate') }),
  z.strictObject({ type: z.literal('start_goal_generation') }),
  z.strictObject({ type: z.literal('begin_material_processing') }),
  z.strictObject({ type: z.literal('open_review') }),
  z.strictObject({ type: z.literal('add_pdf_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), uploadId: z.uuid() }),
  z.strictObject({ type: z.literal('add_web_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), url: publicSourceUrlSchema }),
  z.strictObject({
    type: z.literal('add_youtube_source'),
    sourceId: id.optional(),
    label: z.string().trim().min(1).max(300),
    url: youtubeVideoUrlSchema,
    mode: z.enum(['transcript', 'video_observation']).optional(),
    track: youtubeTrackSchema.optional(),
    scope: youtubeTimeScopeSchema.optional(),
  }).superRefine((data, ctx) => {
    if (data.mode === 'transcript' && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({
    type: z.literal('set_youtube_mode'),
    sourceId: id,
    mode: z.enum(['transcript', 'video_observation']),
    track: youtubeTrackSchema.optional(),
  }).superRefine((data, ctx) => {
    if (data.mode === 'transcript' && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({ type: z.literal('add_github_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), repoUrl: githubRepoUrlSchema, ref: githubRefSchema.default('main'), paths: githubPathsSchema.optional() }),
  z.strictObject({ type: z.literal('set_pdf_pages'), sourceId: id, pages: z.array(z.number().int().min(1).max(200)).min(1).max(200) }),
  z.strictObject({ type: z.literal('refresh_web_source'), sourceId: id, url: publicSourceUrlSchema.optional() }),
  z.strictObject({ type: z.literal('set_youtube_scope'), sourceId: id, scope: youtubeTimeScopeSchema.optional() }),
  z.strictObject({ type: z.literal('set_github_scope'), sourceId: id, paths: githubPathsSchema }),
  z.strictObject({ type: z.literal('set_intent'), intent: text }),
  z.strictObject({ type: z.literal('set_audience'), audience: z.string().trim().max(500) }),
  z.strictObject({ type: z.literal('set_daily_minutes'), dailyMinutes: z.number().int().min(1).max(1_440) }),
  z.strictObject({ type: z.literal('edit_lesson'), lessonId: id, title: text.optional(), objective: text.optional() }).refine(value => value.title !== undefined || value.objective !== undefined, 'Lesson edit needs title or objective'),
  z.strictObject({ type: z.literal('add_lesson'), lessonId: id.optional(), title: text, objective: text }),
  z.strictObject({ type: z.literal('remove_lesson'), lessonId: id }),
  z.strictObject({ type: z.literal('reorder_lessons'), lessonIds: z.array(id).min(1).max(200) }),
  z.strictObject({ type: z.literal('set_lesson_pin'), lessonId: id, pinned: z.boolean() }),
  z.strictObject({ type: z.literal('add_text_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), text: sourceText }),
  z.strictObject({ type: z.literal('edit_text_source'), sourceId: id, label: z.string().trim().min(1).max(300), text: sourceText }),
  z.strictObject({ type: z.literal('remove_source'), sourceId: id }),
  z.strictObject({ type: z.literal('retry_processing') }),
  z.strictObject({ type: z.literal('retry_text_job'), jobId: id }),
  z.strictObject({ type: z.literal('cancel_text_processing') }),
  z.strictObject({ type: z.literal('cancel_source_processing'), sourceId:id }),
  z.strictObject({ type: z.literal('prepare_release'), mode: z.enum(['private_activation', 'public_publish']).default('private_activation'), candidateHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }),
  z.strictObject({ type: z.literal('commit_release'), mode: z.enum(['private_activation', 'public_publish']), candidateHash: z.string().regex(/^[a-f0-9]{64}$/), receipt: cohortReleaseReceiptSchema.optional() }),
]);
export type CohortAction = z.infer<typeof cohortActionSchema>;

export interface CohortActionContext {
  actionId: string;
  workspaceId: string;
  expectedRevision: number;
  currentRevision: number;
  entityVersions: ReadonlyMap<string, number>;
  /** Trusted repository proof loaded from an owned accepted discovery artifact. Never client supplied. */
  discoveryResult?: { resultId: string; fingerprint: string; items: z.infer<typeof cohortDiscoveryItemSchema>[] };
}

function ref(workspaceId: string, lesson: CohortLesson) {
  return entityRefSchema.parse({ kind: 'lesson', id: lesson.id, version: lesson.version });
}

export function planCohortAction(state: CohortWorkspace, actionInput: unknown, context: CohortActionContext): DomainActionPlan<CohortWorkspace> {
  const action = cohortActionSchema.parse(actionInput);
  if (context.expectedRevision !== context.currentRevision) throw new Error('STALE_WORKSPACE');
  const next = cohortWorkspaceSchema.parse(structuredClone(state));
  const changed: ReturnType<typeof ref>[] = [];
  const invalidated: string[] = [];
  const touch = (lesson: CohortLesson) => { lesson.version += 1; changed.push(ref(context.workspaceId, lesson)); };
  const invalidateRelease = () => {
    if (next.release && next.release.status !== 'draft') {
      next.release = { status: 'draft' };
      if (!invalidated.includes('release')) invalidated.push('release');
    }
  };
  const navigationResult = (summary: string): DomainActionPlan<CohortWorkspace> => ({ nextState: next, changed, invalidated, summary, undoable: false });
  const journey = () => {
    if (!next.journey) next.journey = { version: 1, step: 'recommendations', branch: null, processingStarted: next.sources.length > 0 || next.lessons.length > 0, intentVersion: 0 };
    return next.journey;
  };
  const requireStep = (...steps: CohortJourney['step'][]) => {
    const current = journey();
    if (!steps.includes(current.step)) throw new Error('INVALID_JOURNEY_TRANSITION');
    return current;
  };
  if (action.type === 'create_own_cohort') { requireStep('recommendations').step = 'starting_point'; return navigationResult('Starting point opened.'); }
  if (action.type === 'choose_starting_point') {
    const current = requireStep('starting_point'); current.branch = action.choice;
    current.step = action.choice === 'have_material' ? 'material_input' : action.choice === 'find_material' ? 'discovery' : 'goal_setup';
    return navigationResult('Starting point selected.');
  }
  if (action.type === 'back_to_recommendations' || action.type === 'back_to_starting_point') {
    const current = journey(); if (current.step === 'published') throw new Error('INVALID_JOURNEY_TRANSITION');
    current.step = action.type === 'back_to_recommendations' ? 'recommendations' : 'starting_point';
    return navigationResult('Journey navigation updated.');
  }
  if (action.type === 'start_discovery') {
    const current = requireStep('discovery'); if (current.branch !== 'find_material') throw new Error('INVALID_JOURNEY_BRANCH');
    if (next.discovery && ['queued', 'running', 'ready'].includes(next.discovery.status)) return navigationResult('Existing discovery retained.');
    next.discovery = { requestId: context.actionId, fingerprint: `pending:${current.intentVersion}:${context.actionId}`, status: 'queued', generation: (next.discovery?.generation ?? -1) + 1, items: [] };
    return navigationResult('Resource discovery requested.');
  }
  if (action.type === 'select_discovery_resources') {
    const current = requireStep('discovery');
    const projection = next.discovery; const proof = context.discoveryResult;
    if (current.branch !== 'find_material' || projection?.status !== 'ready' || projection.resultId !== action.resultId || !proof || proof.resultId !== action.resultId || proof.fingerprint !== projection.fingerprint) throw new Error('INVALID_DISCOVERY_RESULT');
    const candidates = z.array(cohortDiscoveryItemSchema).max(20).parse(proof.items);
    if (new Set(candidates.map(item => item.id)).size !== candidates.length) throw new Error('INVALID_DISCOVERY_RESULT');
    const selected = action.candidateIds.map(candidateId => {
      const candidate = candidates.find(item => item.id === candidateId);
      if (!candidate || !projection.items.some(item => item.id === candidate.id && item.url === candidate.url && item.kind === candidate.kind)) throw new Error('INVALID_DISCOVERY_CANDIDATE');
      return candidate;
    });
    if (next.sources.length + selected.length > 20) throw new Error('TOO_MANY_SOURCES');
    selected.forEach((candidate, index) => {
      const sourceId = `${context.actionId}:discovery:${index}`;
      if (sourceId.length > 200 || next.sources.some(item => item.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
      next.sources.push({ id: sourceId, version: 0, label: candidate.label, text: '', input: { kind: 'web', url: candidate.url }, checksum: null, state: 'queued' });
    });
    invalidateRelease(); current.step = 'material_input'; invalidated.push('sources', 'curriculum');
    if (current.processingStarted) next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return navigationResult('Selected resources retained.');
  }
  if (action.type === 'start_goal_generation' || action.type === 'begin_material_processing') {
    const current = requireStep(action.type === 'start_goal_generation' ? 'goal_setup' : 'material_input');
    if (action.type === 'start_goal_generation') {
      if (current.branch !== 'have_goal' || !next.intent.trim() || next.dailyMinutes < 1) throw new Error('GOAL_NOT_CONFIRMED');
      const sourceId = `generated-guide:${current.intentVersion}`;
      const input = { kind: 'generated_guide' as const, goal: next.intent, audience: next.audience, dailyMinutes: next.dailyMinutes, intentVersion: current.intentVersion };
      const existing = next.sources.find(item => item.id === sourceId);
      if (existing && existing.input?.kind !== 'generated_guide') throw new Error('DUPLICATE_SOURCE');
      if (!existing) {
        if (next.sources.length >= 20) throw new Error('TOO_MANY_SOURCES');
        next.sources.push({ id: sourceId, version: 0, label: 'Generated learning guide', text: '', input, checksum: null, state: 'queued' });
      } else if (JSON.stringify(existing.input) !== JSON.stringify(input)) {
        existing.input = input; existing.version++; existing.text = ''; existing.state = 'queued'; existing.checksum = null;
        delete existing.retainedInputId; delete existing.extractionId; delete existing.locations; delete existing.provenance;
      }
    } else if (!['have_material', 'find_material'].includes(current.branch ?? '') || !next.sources.length) throw new Error('NO_SOURCES');
    current.processingStarted = true; current.step = 'processing'; invalidateRelease();
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return navigationResult('Source processing requested.');
  }
  if (action.type === 'open_review') {
    const current = requireStep('ready');
    if (next.processing.status !== 'ready' || !next.processing.sourceFingerprint || !next.lessons.length) throw new Error('ASSEMBLY_NOT_READY');
    current.step = 'review'; return navigationResult('Curriculum review opened.');
  }
  if (next.journey && !next.journey.processingStarted && (action.type === 'retry_processing' || action.type === 'retry_text_job')) throw new Error('PROCESSING_NOT_STARTED');
  if (action.type === 'retry_text_job') {
    const job = next.processing.jobs?.find(item => item.id === action.jobId);
    if (!job || job.status !== 'failed' || !job.retryable) throw new Error('JOB_NOT_RETRYABLE');
    next.processing.status = 'queued'; next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Failed source job queued for retry.', undoable: false };
  }
  if (action.type === 'cancel_text_processing') {
    if (!next.processing.jobs?.length) throw new Error('NO_DURABLE_JOBS');
    next.processing.status = 'idle'; next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing canceled.', undoable: false };
  }
  if(action.type==='cancel_source_processing') {
    const source=next.sources.find(item=>item.id===action.sourceId);if(!source) throw new Error('UNKNOWN_SOURCE');
    const expected=context.entityVersions.get(source.id);if(expected!==undefined && expected!==source.version) throw new Error('STALE_ENTITY');
    if(!next.processing.jobs?.some(job=>job.sourceId===source.id && ['queued','running','failed'].includes(job.status))) throw new Error('NO_ACTIVE_SOURCE_JOBS');
    return {nextState:next,changed:[],invalidated:[],summary:'Selected source processing stopped; other sources continue.',undoable:false};
  }
  const queueAfterPreferenceChange = (readyStage: 'analysis' | 'assembly') => {
    invalidateRelease();
    if (!next.sources.length || (next.journey && !next.journey.processingStarted)) return;
    const stage = next.processing.status === 'ready' ? readyStage : next.processing.status === 'failed' ? 'acquisition' : next.processing.stage;
    next.processing = { ...next.processing, status: 'queued', stage, generation: next.processing.generation + 1, error: null };
  };

  if (action.type === 'set_intent') { invalidateRelease(); if (next.intent !== action.intent && next.journey) { next.journey.intentVersion++; delete next.recommendations; delete next.discovery; } next.intent = action.intent; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { invalidateRelease(); next.audience = action.audience; invalidated.push('analysis', 'curriculum'); queueAfterPreferenceChange('analysis'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { invalidateRelease(); next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }

  const queueProcessing = () => {
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
      return;
    }
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
  };

  if (action.type === 'add_text_source') {
    invalidateRelease();
    const sourceId = action.sourceId ?? context.actionId;
    if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
    if (next.sources.length >= 20) throw new Error('TOO_MANY_SOURCES');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    next.sources.push({ id: sourceId, version: 0, label: action.label, text: action.text, checksum: null, state: 'queued' });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Added source: ${action.label}`, undoable: true };
  }
  if (action.type === 'add_pdf_source' || action.type === 'add_web_source' || action.type === 'add_youtube_source' || action.type === 'add_github_source') {
    invalidateRelease();
    const sourceId = action.sourceId ?? context.actionId;
    if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
    if (next.sources.length >= 20) throw new Error('TOO_MANY_SOURCES');
    const input = action.type === 'add_pdf_source'
      ? { kind: 'pdf' as const, uploadId: action.uploadId }
      : action.type === 'add_web_source'
      ? { kind: 'web' as const, url: new URL(action.url).href.split('#')[0] }
      : action.type === 'add_youtube_source'
      ? {
          kind: 'youtube' as const,
          url: action.url,
          mode: action.mode ?? (action.track ? 'transcript' : 'video_observation'),
          ...(action.track ? { track: action.track } : {}),
          ...(action.scope ? { scope: action.scope } : {}),
        }
      : { kind: 'github' as const, repoUrl: action.repoUrl, ref: action.ref, ...(action.paths ? { paths: action.paths } : {}) };
    next.sources.push({ id: sourceId, version: 0, label: action.label, text: '', checksum: null, state: 'queued', input });
    queueProcessing();
    const labelKind = action.type === 'add_pdf_source' ? 'PDF' : action.type === 'add_web_source' ? 'web' : action.type === 'add_youtube_source' ? 'YouTube' : 'GitHub';
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: `Added ${labelKind} source: ${action.label}`, undoable: true };
  }
  if (action.type === 'set_youtube_mode') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expected = context.entityVersions.get(source.id);
    if (expected !== undefined && expected !== source.version) throw new Error('STALE_ENTITY');
    if (source.input?.kind !== 'youtube') throw new Error('INVALID_YOUTUBE_SOURCE');
    const currentMode = source.input.mode ?? 'transcript';
    if (currentMode === action.mode && (action.mode !== 'transcript' || JSON.stringify(source.input.track) === JSON.stringify(action.track))) {
      return { nextState: next, changed: [], invalidated: [], summary: 'YouTube acquisition mode unchanged.', undoable: false };
    }
    source.input = {
      ...source.input,
      mode: action.mode,
      track: action.mode === 'transcript' ? (action.track ?? source.input.track ?? { id: 'en', language: 'en', kind: 'manual', translated: false }) : undefined,
    };
    source.version++; source.text = ''; source.state = 'queued'; source.checksum = null;
    delete source.retainedInputId; delete source.extractionId; delete source.locations; delete source.provenance;
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(item => item.sourceId !== source.id);
    const valid = new Set(next.chunks.map(chunk => chunk.id)); next.analyses = next.analyses.filter(item => valid.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(id => valid.has(id)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(id => !valid.has(id))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: `YouTube acquisition mode updated to ${action.mode}.`, undoable: true };
  }
  if (action.type === 'set_pdf_pages' || action.type === 'refresh_web_source' || action.type === 'set_youtube_scope' || action.type === 'set_github_scope') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expected = context.entityVersions.get(source.id);
    if (expected !== undefined && expected !== source.version) throw new Error('STALE_ENTITY');
    if (action.type === 'set_pdf_pages') {
      if (source.input?.kind !== 'pdf' || new Set(action.pages).size !== action.pages.length) throw new Error('INVALID_PDF_SCOPE');
      source.input.pages = [...action.pages].sort((a,b) => a-b);
    } else if (action.type === 'refresh_web_source') {
      if (source.input?.kind !== 'web') throw new Error('INVALID_WEB_SOURCE');
      source.input.url = new URL(action.url ?? source.input.url).href.split('#')[0]; delete source.retainedInputId;
    } else if (action.type === 'set_youtube_scope') {
      if (source.input?.kind !== 'youtube') throw new Error('INVALID_YOUTUBE_SOURCE');
      if (action.scope) source.input.scope = action.scope;
      else delete source.input.scope;
    } else {
      if (source.input?.kind !== 'github') throw new Error('INVALID_GITHUB_SOURCE');
      source.input.paths = action.paths;
    }
    source.version++; source.text = ''; source.state = 'queued'; source.checksum = null;
    delete source.extractionId; delete source.locations; delete source.provenance;
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(item => item.sourceId !== source.id);
    const valid = new Set(next.chunks.map(chunk => chunk.id)); next.analyses = next.analyses.filter(item => valid.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(id => valid.has(id)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(id => !valid.has(id))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: 'Source scope updated.', undoable: true };
  }

  if (action.type === 'edit_text_source') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    if (source.input) throw new Error('SOURCE_REQUIRES_SCOPE_ACTION');
    const expectedVersion = context.entityVersions.get(source.id);
    if (expectedVersion !== undefined && expectedVersion !== source.version) throw new Error('STALE_ENTITY');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    source.version += 1;
    source.label = action.label;
    source.text = action.text;
    source.checksum = null;
    source.state = 'queued';
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== source.id);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Updated source: ${source.label}`, undoable: true };
  }
  if (action.type === 'remove_source') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expectedVersion = context.entityVersions.get(source.id);
    if (expectedVersion !== undefined && expectedVersion !== source.version) throw new Error('STALE_ENTITY');
    next.sources = next.sources.filter(item => item.id !== action.sourceId);
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== action.sourceId);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== action.sourceId);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
    } else {
      next.processing = { status: next.sources.length ? 'queued' : 'idle', stage: next.sources.length ? 'acquisition' : 'done', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    }
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Removed source: ${source.label}`, undoable: true };
  }
  if (action.type === 'retry_processing') {
    if (next.sources.length === 0) throw new Error('NO_SOURCES');
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing queued.', undoable: false };
  }

  if (action.type === 'add_lesson') {
    invalidateRelease();
    const newLesson: CohortLesson = {
      id: action.lessonId ?? crypto.randomUUID(),
      version: 0,
      title: action.title,
      objective: action.objective,
      sourceChunkIds: [],
      pinned: false,
    };
    next.lessons.push(newLesson);
    touch(newLesson);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Added lesson: ${newLesson.title}`, undoable: true };
  }

  if (action.type === 'remove_lesson') {
    invalidateRelease();
    const targetIdx = next.lessons.findIndex(item => item.id === action.lessonId);
    if (targetIdx === -1) throw new Error('UNKNOWN_LESSON');
    const target = next.lessons[targetIdx];
    const expectedVersion = context.entityVersions.get(target.id);
    if (expectedVersion !== undefined && expectedVersion !== target.version) throw new Error('STALE_ENTITY');
    if (target.pinned) throw new Error('PINNED_LESSON_LOCKED');
    next.lessons.splice(targetIdx, 1);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Removed lesson: ${target.title}`, undoable: true };
  }

  if (action.type === 'prepare_release') {
    if (next.processing.status === 'processing' || next.processing.status === 'queued') {
      throw new Error('PROCESSING_NOT_COMPLETE');
    }
    if (next.lessons.length === 0) {
      throw new Error('NO_LESSONS');
    }
    if (next.lessons.some(l => !l.title.trim() || !l.objective.trim())) {
      throw new Error('INCOMPLETE_LESSONS');
    }
    if (action.mode === 'public_publish') {
      if (next.lessons.some(l => l.evidenceStatus === 'orphaned')) {
        throw new Error('PUBLIC_RELEASE_ORPHANED_EVIDENCE');
      }
      if (next.sources.some(s => s.isRestricted)) {
        throw new Error('PUBLIC_RELEASE_RESTRICTED_SOURCE');
      }
    }
    next.release = {
      status: 'prepared',
      mode: action.mode,
      candidateHash: action.candidateHash,
      preparedAt: new Date().toISOString(),
    };
    return {
      nextState: next,
      changed: [],
      invalidated: ['release'],
      summary: `Workspace prepared for ${action.mode === 'public_publish' ? 'public publication' : 'private activation'}.`,
      undoable: true,
    };
  }

  if (action.type === 'commit_release') {
    next.release = {
      status: 'released',
      mode: action.mode,
      candidateHash: action.candidateHash,
      effectKey: action.receipt?.effectKey,
      cohortId: action.receipt?.cohortId,
      releasedAt: action.receipt?.releasedAt ?? new Date().toISOString(),
      receipt: action.receipt,
    };
    if (next.journey) next.journey.step = 'published';
    return {
      nextState: next,
      changed: [],
      invalidated: ['release'],
      summary: `Workspace released as ${action.mode === 'public_publish' ? 'public cohort' : 'private cohort'}.`,
      undoable: false,
    };
  }

  const lessonId = action.type === 'reorder_lessons' ? null : action.lessonId;
  const lesson = lessonId === null ? undefined : next.lessons.find(item => item.id === lessonId);
  if (action.type !== 'reorder_lessons' && !lesson) throw new Error('UNKNOWN_LESSON');
  if (lesson) {
    const expectedVersion = context.entityVersions.get(lesson.id);
    if (expectedVersion !== undefined && expectedVersion !== lesson.version) throw new Error('STALE_ENTITY');
  }
  if (action.type === 'edit_lesson' && lesson) {
    invalidateRelease();
    if (action.title !== undefined && lesson.pinned) throw new Error('PINNED_LESSON_TITLE');
    if (action.title !== undefined) lesson.title = action.title;
    if (action.objective !== undefined) lesson.objective = action.objective;
    lesson.manualOverride = true;
    touch(lesson); return { nextState: next, changed, invalidated, summary: `Lesson ${lesson.id} updated.`, undoable: true };
  }
  if (action.type === 'set_lesson_pin' && lesson) { invalidateRelease(); lesson.pinned = action.pinned; touch(lesson); return { nextState: next, changed, invalidated, summary: action.pinned ? `Lesson ${lesson.id} pinned.` : `Lesson ${lesson.id} unpinned.`, undoable: true }; }
  if (action.type === 'reorder_lessons') {
    invalidateRelease();
    const current = new Set(next.lessons.map(item => item.id));
    if (action.lessonIds.length !== next.lessons.length || action.lessonIds.some(item => !current.has(item)) || new Set(action.lessonIds).size !== action.lessonIds.length) throw new Error('INVALID_LESSON_ORDER');
    const byId = new Map(next.lessons.map(item => [item.id, item]));
    next.lessons = action.lessonIds.map(item => byId.get(item)!);
    next.lessons.forEach(touch); invalidated.push('curriculum-order');
    return { nextState: next, changed, invalidated, summary: 'Lesson order updated.', undoable: true };
  }
  throw new Error('UNSUPPORTED_ACTION');
}

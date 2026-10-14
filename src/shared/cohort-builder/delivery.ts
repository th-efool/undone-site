import { z } from 'zod';
import { type CohortWorkspace, cohortWorkspaceSchema } from './contracts';

export const deliveryChunkSchema = z.strictObject({
  chunkId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceLabel: z.string().min(1),
  text: z.string().min(1),
  order: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  page: z.number().int().positive().optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DeliveryChunk = z.infer<typeof deliveryChunkSchema>;

export const deliveryLessonSchema = z.strictObject({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  version: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(4_000),
  objective: z.string().trim().min(1).max(4_000),
  order: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
  lessonType: z.enum(['ARTICLE', 'VIDEO']),
  pinned: z.boolean(),
  manualOverride: z.boolean().optional(),
  evidenceStatus: z.enum(['valid', 'orphaned']),
  chunks: z.array(deliveryChunkSchema),
});
export type DeliveryLesson = z.infer<typeof deliveryLessonSchema>;

export const deliverySeasonSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  order: z.number().int().nonnegative(),
  lessons: z.array(deliveryLessonSchema).min(1),
});
export type DeliverySeason = z.infer<typeof deliverySeasonSchema>;

export const deliverySourceSchema = z.strictObject({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  version: z.number().int().nonnegative(),
  label: z.string().trim().min(1).max(300),
  kind: z.enum(['text', 'pdf', 'web', 'youtube', 'github']),
  url: z.string().optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  isRestricted: z.boolean().default(false),
  provenance: z.strictObject({
    parserVersion: z.string().max(128),
    rawChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    scope: z.enum(['selected_pages', 'main_article', 'full_text_response', 'transcript_only', 'selected_files']),
    finalUrl: z.string().optional(),
    pageCount: z.number().int().positive().max(200).optional(),
    videoId: z.string().optional(),
    track: z.any().optional(),
    timeScope: z.any().optional(),
    repoUrl: z.string().optional(),
    ref: z.string().optional(),
    commitSha: z.string().optional(),
    fileCount: z.number().int().optional(),
  }).optional(),
});
export type DeliverySource = z.infer<typeof deliverySourceSchema>;

export const deliveryCohortSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(4_000),
  audience: z.string().trim().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  learningOutcomes: z.array(z.string().trim().min(1).max(500)),
  primaryTopic: z.string().trim().min(1).max(300),
  language: z.string().trim().default('en'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});
export type DeliveryCohort = z.infer<typeof deliveryCohortSchema>;

export const deliveryMetadataSchema = z.strictObject({
  totalLessons: z.number().int().nonnegative(),
  totalEstimatedMinutes: z.number().int().nonnegative(),
  pinnedLessonCount: z.number().int().nonnegative(),
  hasManualOverrides: z.boolean(),
  retainedSourceCount: z.number().int().nonnegative(),
  hasOrphanedEvidence: z.boolean(),
});
export type DeliveryMetadata = z.infer<typeof deliveryMetadataSchema>;

export const learnerDeliveryPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().min(1),
  workspaceRevision: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(['private_activation', 'public_publish']),
  cohort: deliveryCohortSchema,
  sources: z.array(deliverySourceSchema),
  seasons: z.array(deliverySeasonSchema).min(1),
  metadata: deliveryMetadataSchema,
});
export type LearnerDeliveryPayload = z.infer<typeof learnerDeliveryPayloadSchema>;

export interface ProjectDeliveryOptions {
  workspaceId: string;
  workspaceRevision: number;
  cohortId: string;
  contentHash: string;
  mode: 'private_activation' | 'public_publish';
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language?: string;
}

/** Deterministic publication identifiers. */
export const deliveryCohortId = (workspaceId: string, contentHash: string): string =>
  `cohort_${workspaceId.slice(0, 8)}_${contentHash.slice(0, 16)}`;
export const deliverySeasonId = (cohortId: string, seasonIndex: number): string =>
  `${cohortId}_s${seasonIndex + 1}`;
export const deliveryLessonId = (cohortId: string, lessonId: string): string =>
  `${cohortId}_l_${lessonId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
export const deliverySourceId = (cohortId: string, sourceId: string): string =>
  `${cohortId}_src_${sourceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

/**
 * Pure projection from CohortWorkspace into a validated LearnerDeliveryPayload.
 */
export function projectCohortToLearnerDelivery(
  workspaceInput: CohortWorkspace,
  options: ProjectDeliveryOptions
): LearnerDeliveryPayload {
  const workspace = cohortWorkspaceSchema.parse(workspaceInput);
  if (!workspace.lessons.length) {
    throw new Error('CANNOT_PROJECT_EMPTY_CURRICULUM: Workspace has no lessons.');
  }

  const chunkMap = new Map(workspace.chunks.map(chunk => [chunk.id, chunk]));
  const sourceMap = new Map(workspace.sources.map(source => [source.id, source]));

  // Build projected delivery sources
  const sources: DeliverySource[] = workspace.sources.map(source => {
    const kind = source.input?.kind ?? 'text';
    const url = source.input?.kind === 'web'
      ? source.input.url
      : source.input?.kind === 'youtube'
      ? source.input.url
      : source.input?.kind === 'github'
      ? source.input.repoUrl
      : source.provenance?.finalUrl;

    return deliverySourceSchema.parse({
      id: deliverySourceId(options.cohortId, source.id),
      sourceId: source.id,
      version: source.version,
      label: source.label,
      kind,
      url,
      checksum: source.checksum,
      isRestricted: source.isRestricted ?? false,
      provenance: source.provenance,
    });
  });

  // Calculate per-lesson duration based on workspace.dailyMinutes
  const estimatedLessonSeconds = Math.max(180, Math.round((workspace.dailyMinutes * 60) / Math.max(1, workspace.lessons.length)));

  // Map each lesson to delivery representation
  const projectedLessons: DeliveryLesson[] = workspace.lessons.map((lesson, lessonIndex) => {
    const deliveryChunks: DeliveryChunk[] = [];

    for (const [chunkOrder, chunkId] of lesson.sourceChunkIds.entries()) {
      const chunk = chunkMap.get(chunkId);
      if (chunk) {
        const source = sourceMap.get(chunk.sourceId);
        // Find matching location page if available
        const location = source?.locations?.find(loc => loc.start <= chunk.start && loc.end >= chunk.end);

        deliveryChunks.push({
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          sourceLabel: source?.label ?? 'Source Material',
          text: chunk.text,
          order: chunkOrder,
          start: chunk.start,
          end: chunk.end,
          page: location?.page,
          checksum: chunk.checksum,
        });
      }
    }

    const isOrphaned = lesson.evidenceStatus === 'orphaned' ||
      (lesson.sourceChunkIds.length > 0 && deliveryChunks.length < lesson.sourceChunkIds.length);

    return deliveryLessonSchema.parse({
      id: deliveryLessonId(options.cohortId, lesson.id),
      lessonId: lesson.id,
      version: lesson.version,
      title: lesson.title,
      objective: lesson.objective,
      order: lessonIndex,
      durationSeconds: estimatedLessonSeconds,
      lessonType: 'ARTICLE',
      pinned: lesson.pinned,
      manualOverride: lesson.manualOverride,
      evidenceStatus: isOrphaned ? 'orphaned' : 'valid',
      chunks: deliveryChunks,
    });
  });

  // Group lessons into seasons deterministically
  // If multiple sources exist, group by first chunk's source; otherwise single season
  const seasonGroups = new Map<string, { title: string; lessons: DeliveryLesson[] }>();

  if (workspace.sources.length > 1) {
    for (const lesson of projectedLessons) {
      const firstChunk = lesson.chunks[0];
      const sourceId = firstChunk?.sourceId ?? 'general';
      const source = sourceMap.get(sourceId);
      const groupKey = sourceId;
      const groupTitle = source ? `Part: ${source.label}` : 'Core Questline';

      const existing = seasonGroups.get(groupKey);
      if (existing) {
        existing.lessons.push(lesson);
      } else {
        seasonGroups.set(groupKey, { title: groupTitle, lessons: [lesson] });
      }
    }
  }

  // Fallback: If 1 source or all lessons fell in 1 group, keep single coherent season
  if (seasonGroups.size <= 1) {
    seasonGroups.clear();
    seasonGroups.set('main', {
      title: 'Season 1: Core Curriculum',
      lessons: projectedLessons,
    });
  }

  const seasons: DeliverySeason[] = [...seasonGroups.values()].map((group, seasonIndex) => ({
    id: deliverySeasonId(options.cohortId, seasonIndex),
    title: group.title,
    order: seasonIndex,
    lessons: group.lessons.map((lesson, orderInSeason) => ({
      ...lesson,
      order: orderInSeason,
    })),
  }));

  const totalEstimatedMinutes = Math.ceil(
    projectedLessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0) / 60
  );

  const metadata: DeliveryMetadata = {
    totalLessons: projectedLessons.length,
    totalEstimatedMinutes,
    pinnedLessonCount: projectedLessons.filter(l => l.pinned).length,
    hasManualOverrides: projectedLessons.some(l => l.manualOverride),
    retainedSourceCount: sources.length,
    hasOrphanedEvidence: projectedLessons.some(l => l.evidenceStatus === 'orphaned'),
  };

  const cohort: DeliveryCohort = {
    id: options.cohortId,
    title: workspace.title.trim() || workspace.intent.slice(0, 100),
    description: workspace.intent,
    audience: workspace.audience || 'Curious learners',
    dailyMinutes: workspace.dailyMinutes,
    difficulty: options.difficulty ?? 'BEGINNER',
    learningOutcomes: [
      `Master core concepts of ${workspace.title || workspace.intent.slice(0, 50)}`,
      `Complete ${projectedLessons.length} targeted learning sessions`,
    ],
    primaryTopic: workspace.title || 'General Knowledge',
    language: options.language ?? 'en',
    visibility: options.mode === 'public_publish' ? 'PUBLIC' : 'PRIVATE',
  };

  return learnerDeliveryPayloadSchema.parse({
    schemaVersion: 1,
    workspaceId: options.workspaceId,
    workspaceRevision: options.workspaceRevision,
    contentHash: options.contentHash,
    mode: options.mode,
    cohort,
    sources,
    seasons,
    metadata,
  });
}

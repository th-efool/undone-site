import { z } from 'zod';
import { type CohortWorkspace, cohortWorkspaceSchema, cohortSourceProvenanceSchema } from './contracts';
import { computeDeterministicChunkVector } from '@/src/shared/curriculum/pedagogicalVector.engine';
import { deriveChunkVideoInterval, deriveChunkTitleAndSummary, deriveCohortTitle, deriveCohortDescription } from './cohort-metadata';

export const deliveryChunkSchema = z.strictObject({
  chunkId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceLabel: z.string().min(1),
  text: z.string().min(1),
  order: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  page: z.number().int().positive().optional(),
  startSeconds: z.number().int().nonnegative().optional(),
  endSeconds: z.number().int().nonnegative().optional(),
  timeRangeLabel: z.string().optional(),
  timestampUrl: z.string().optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  vector: z.array(z.number().min(0).max(1)).length(12).optional(),
  isStrictlyLinear: z.boolean().optional(),
  isKeyConcept: z.boolean().optional(),
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
  videoId: z.string().optional(),
  videoUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
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
  provenance: cohortSourceProvenanceSchema.optional(),
});
export type DeliverySource = z.infer<typeof deliverySourceSchema>;

export const deliveryCohortSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(4_000),
  coverImage: z.string().optional(),
  audience: z.string().trim().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  learningOutcomes: z.array(z.string().trim().min(1).max(500)),
  primaryTopic: z.string().trim().min(1).max(300),
  language: z.string().trim().default('en'),
  subtitle: z.string().trim().max(500).optional(),
  categories: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  requirements: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
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

/** Stable source grouping shared by the editable preview and delivery. */
export function getCohortSeasonGroups(workspace: CohortWorkspace, lessons = workspace.lessons) {
  const sourceMap = new Map(workspace.sources.map(source => [source.id, source]));
  if (workspace.sources.length <= 1) return [{ key: 'main', title: 'Season 1: Core Curriculum', lessons }];
  const groups = new Map<string, { key: string; title: string; lessons: typeof lessons }>();
  const chunkMap = new Map(workspace.chunks.map(chunk => [chunk.id, chunk]));
  for (const lesson of lessons) {
    const sourceId = lesson.sourceChunkIds.map(id => chunkMap.get(id)?.sourceId).find(Boolean) ?? 'general';
    const source = sourceMap.get(sourceId);
    const group = groups.get(sourceId) ?? { key: sourceId, title: source ? `Part: ${source.label}` : 'Core Questline', lessons: [] };
    group.lessons.push(lesson);
    groups.set(sourceId, group);
  }
  return [...groups.values()];
}

function extractYoutubeVideoId(input?: string | null): string | null {
  const trimmed = input?.trim() || '';
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const vParam = parsed.searchParams.get('v');
    if (vParam) return vParam;
    if (parsed.hostname?.includes('youtu.be')) {
      const pathname = parsed.pathname?.slice(1);
      if (pathname) return pathname.split('?')[0];
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return null;
}

export function getTopicCoverImage(topicOrTitle: string): string {
  const lower = topicOrTitle.toLowerCase();
  if (lower.includes('rust')) {
    return 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop';
  }
  if (lower.includes('python')) {
    return 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?q=80&w=1200&auto=format&fit=crop';
  }
  if (lower.includes('react') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('web') || lower.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1200&auto=format&fit=crop';
  }
  if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('deep learning') || lower.includes('llm')) {
    return 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop';
  }
  if (lower.includes('go') || lower.includes('golang')) {
    return 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop';
  }
  if (lower.includes('devops') || lower.includes('docker') || lower.includes('kubernetes') || lower.includes('cloud')) {
    return 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=1200&auto=format&fit=crop';
  }
  return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop';
}

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
    const kind = source.input?.kind === 'generated_guide' ? 'text' : (source.input?.kind ?? 'text');
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
    let detectedVideoId: string | undefined;
    let fallbackSourceUrl: string | undefined;

    for (const [chunkOrder, chunkId] of lesson.sourceChunkIds.entries()) {
      const chunk = chunkMap.get(chunkId);
      if (chunk) {
        const source = sourceMap.get(chunk.sourceId);
        const location = source?.locations?.find(loc => loc.start <= chunk.start && loc.end >= chunk.end);

        const videoId = source?.provenance?.videoId || (source?.input?.kind === 'youtube' ? extractYoutubeVideoId(source.input.url) : null) || extractYoutubeVideoId(source?.label);

        if (videoId && !detectedVideoId) {
          detectedVideoId = videoId;
        }
        if (source && !fallbackSourceUrl) {
          fallbackSourceUrl = source.input?.kind === 'youtube' ? source.input.url : source.provenance?.finalUrl;
        }

        const sourceChunks = workspace.chunks.filter(item => item.sourceId === chunk.sourceId && item.sourceVersion === chunk.sourceVersion)
          .sort((a, b) => a.start - b.start);
        const sourceChunkIndex = sourceChunks.findIndex(item => item.id === chunk.id);
        const interval = deriveChunkVideoInterval(chunk, source, sourceChunkIndex, sourceChunks.length);
        const { startSeconds, endSeconds } = interval;

        const formatTs = (sec: number) => {
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          return `${m}:${s.toString().padStart(2, '0')}`;
        };
        const timeRangeLabel = interval.isVideo && !interval.hasTiming ? 'Timing unavailable' : `${formatTs(startSeconds)} – ${formatTs(endSeconds)}`;
        const timestampUrl = videoId && interval.hasTiming
          ? `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`
          : undefined;

        const copy = deriveChunkTitleAndSummary(chunk, source, sourceChunkIndex);
        const scored = computeDeterministicChunkVector(chunk.text, {
          title: `${copy.title} - ${source?.label ?? ''}`,
          durationSeconds: interval.durationSeconds,
          chunkIndex: sourceChunkIndex,
          totalChunks: sourceChunks.length,
        });

        deliveryChunks.push({
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          sourceLabel: source?.label ?? 'Source Material',
          text: chunk.text,
          order: chunkOrder,
          start: chunk.start,
          end: chunk.end,
          page: location?.page,
          startSeconds,
          endSeconds,
          timeRangeLabel,
          timestampUrl,
          checksum: chunk.checksum,
          vector: scored.vector,
          isStrictlyLinear: scored.isStrictlyLinear,
          isKeyConcept: scored.isKeyConcept,
        });
      }
    }

    const isVideo = Boolean(detectedVideoId);
    const videoUrl = detectedVideoId ? `https://www.youtube.com/watch?v=${detectedVideoId}` : undefined;
    const thumbnailUrl = detectedVideoId ? `https://i.ytimg.com/vi/${detectedVideoId}/hqdefault.jpg` : undefined;
    const sourceUrl = videoUrl || fallbackSourceUrl;

    const isOrphaned = lesson.evidenceStatus === 'orphaned' ||
      (lesson.sourceChunkIds.length > 0 && deliveryChunks.length < lesson.sourceChunkIds.length);

    return deliveryLessonSchema.parse({
      id: deliveryLessonId(options.cohortId, lesson.id),
      lessonId: lesson.id,
      version: lesson.version,
      title: lesson.title,
      objective: lesson.objective,
      order: lessonIndex,
      durationSeconds: isVideo ? Math.max(1, deliveryChunks.reduce((sum, chunk) => sum + (chunk.endSeconds ?? 0) - (chunk.startSeconds ?? 0), 0)) : estimatedLessonSeconds,
      lessonType: isVideo ? 'VIDEO' : 'ARTICLE',
      videoId: detectedVideoId,
      videoUrl,
      thumbnailUrl,
      sourceUrl,
      pinned: lesson.pinned,
      manualOverride: lesson.manualOverride,
      evidenceStatus: isOrphaned ? 'orphaned' : 'valid',
      chunks: deliveryChunks,
    });
  });

  // Group lessons into seasons deterministically
  const projectedByLessonId = new Map(projectedLessons.map(lesson => [lesson.lessonId, lesson]));
  const seasons: DeliverySeason[] = getCohortSeasonGroups(workspace).map((group, seasonIndex) => ({
    id: deliverySeasonId(options.cohortId, seasonIndex),
    title: workspace.presentation?.seasonTitles?.[group.key] ?? group.title,
    order: seasonIndex,
    lessons: group.lessons.map((sourceLesson, orderInSeason) => ({
      ...projectedByLessonId.get(sourceLesson.id)!,
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

  const primaryTopic = workspace.title || 'General Knowledge';
  const firstVideoThumbnail = projectedLessons.find(l => l.thumbnailUrl)?.thumbnailUrl;
  const recommendedCover = workspace.recommendations?.items?.find(i => i.coverImage)?.coverImage;
  const coverImage = workspace.presentation?.coverImage || recommendedCover || firstVideoThumbnail || getTopicCoverImage(primaryTopic);

  const cohort: DeliveryCohort = {
    id: options.cohortId,
    title: deriveCohortTitle(workspace),
    description: deriveCohortDescription(workspace),
    coverImage,
    audience: workspace.audience || 'Curious learners',
    dailyMinutes: workspace.dailyMinutes,
    difficulty: options.difficulty ?? 'BEGINNER',
    learningOutcomes: [
      `Master core concepts of ${workspace.title || workspace.intent.slice(0, 50)}`,
      `Complete ${projectedLessons.length} targeted learning sessions`,
    ],
    primaryTopic,
    language: options.language ?? 'en',
    subtitle: workspace.presentation?.subtitle,
    categories: workspace.presentation?.categories ?? [],
    requirements: workspace.presentation?.requirements ?? [],
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

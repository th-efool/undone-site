import 'server-only';
import type { Prisma, SourceType } from '@/generated/prisma/client';
import type { LearnerDeliveryPayload, DeliverySource } from '@/src/shared/cohort-builder/delivery';

export interface DeliveryRightsValidationResult {
  allowed: boolean;
  violations: string[];
}

export interface MaterializedCohortResult {
  cohortId: string;
  isNew: boolean;
  visibility: 'PUBLIC' | 'PRIVATE';
  publishedAt: Date;
}

const SOURCE_TYPE_MAP: Record<DeliverySource['kind'], SourceType> = {
  text: 'MARKDOWN',
  pdf: 'PDF',
  web: 'WEBSITE',
  youtube: 'YOUTUBE_VIDEO',
  github: 'GITHUB_REPO',
};

/**
 * Validates visibility, copyright, and redistribution rights before publication.
 * Enforces that private/restricted sources or unredacted material cannot accidentally become public.
 */
export function validateDeliveryRights(delivery: LearnerDeliveryPayload): DeliveryRightsValidationResult {
  const violations: string[] = [];

  if (delivery.metadata.totalLessons === 0) {
    violations.push('Cannot release a cohort with zero lessons.');
  }

  if (delivery.mode === 'public_publish') {
    if (delivery.cohort.visibility !== 'PUBLIC') {
      violations.push('Public publish mode requires cohort visibility to be set to PUBLIC.');
    }
    if (delivery.sources.some(s => s.isRestricted)) {
      violations.push('Private, connector, or restricted sources cannot be published publicly without an approved redistribution policy.');
    }
    if (delivery.metadata.hasOrphanedEvidence) {
      violations.push('Lessons with orphaned or invalidated evidence cannot be published to the public directory.');
    }
    if (delivery.seasons.some(s => s.lessons.some(l => l.evidenceStatus === 'orphaned'))) {
      violations.push('Curriculum contains lessons with orphaned evidence status.');
    }
  } else if (delivery.mode === 'private_activation') {
    if (delivery.cohort.visibility !== 'PRIVATE') {
      violations.push('Private activation mode requires cohort visibility to be set to PRIVATE.');
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * Pure adapter mapping a validated LearnerDeliveryPayload to Prisma.CohortCreateInput.
 */
export function buildPrismaCohortCreateInput(
  delivery: LearnerDeliveryPayload,
  creatorId: string,
  now: Date = new Date()
): Prisma.CohortCreateInput {
  const rights = validateDeliveryRights(delivery);
  if (!rights.allowed) {
    throw new Error(`DELIVERY_RIGHTS_VIOLATION: ${rights.violations.join('; ')}`);
  }

  return {
    id: delivery.cohort.id,
    creator: { connect: { id: creatorId } },
    title: delivery.cohort.title,
    subtitle: delivery.cohort.subtitle,
    description: delivery.cohort.description,
    coverImage: delivery.cohort.coverImage,
    difficulty: delivery.cohort.difficulty,
    visibility: delivery.cohort.visibility,
    isPublished: true,
    publishedAt: now,
    primaryTopic: delivery.cohort.primaryTopic,
    language: delivery.cohort.language,
    learningOutcomes: delivery.cohort.learningOutcomes,
    tags: [...new Set([delivery.cohort.primaryTopic, ...(delivery.cohort.seo?.keywords ?? [])])].slice(0, 16),
    requirements: delivery.cohort.requirements,
    categories: delivery.cohort.categories,
    estimatedCompletionTime: `${delivery.metadata.totalEstimatedMinutes} mins`,
    creationSettings: {
      workspaceId: delivery.workspaceId,
      workspaceRevision: delivery.workspaceRevision,
      contentHash: delivery.contentHash,
      mode: delivery.mode,
      totalLessons: delivery.metadata.totalLessons,
      totalEstimatedMinutes: delivery.metadata.totalEstimatedMinutes,
      deliveryVersion: 1,
      seo: delivery.cohort.seo ?? null,
    } as Prisma.InputJsonValue,
    members: {
      create: [
        {
          userId: creatorId,
          role: 'CREATOR',
        },
      ],
    },
    community: {
      create: {
        chatEnabled: true,
        eventsEnabled: true,
        channels: {
          create: [{ name: 'general' }],
        },
      },
    },
    sources: {
      create: delivery.sources.map(source => ({
        id: source.id,
        title: source.label,
        type: SOURCE_TYPE_MAP[source.kind] ?? 'CUSTOM_LINK',
        url: source.url ?? `/cohort/${delivery.cohort.id}?source=${source.sourceId}`,
        chunkingMethod: 'retained-bounded-partitions-v1',
      })),
    },
    seasons: {
      create: delivery.seasons.map((season, seasonOrder) => ({
        id: season.id,
        title: season.title,
        order: seasonOrder,
        lessons: {
          create: season.lessons.map((lesson, lessonOrder) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.objective,
            duration: lesson.durationSeconds,
            order: lessonOrder,
            lessonType: lesson.lessonType,
            isPublished: true,
            thumbnailUrl: lesson.thumbnailUrl || (lesson.videoId ? `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg` : undefined),
            videoId: lesson.videoId,
            videoUrl: lesson.videoUrl,
            sourceUrl: lesson.sourceUrl || (lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}` : `/cohort/${delivery.cohort.id}?lesson=${lesson.lessonId}`),
            chunks: lesson.chunks.map(chunk => ({
              id: chunk.chunkId,
              title: chunk.sourceLabel,
              contentOrigin: 'user' as const,
              durationMethod: 'reading_estimate' as const,
              startSeconds: chunk.startSeconds || 0,
              endSeconds: chunk.endSeconds || 0,
              timeRangeLabel: chunk.timeRangeLabel || '',
              timestampUrl: chunk.timestampUrl || (lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}&t=${chunk.startSeconds || 0}s` : undefined),
              ...chunk,
            })) as Prisma.InputJsonValue,
          })),
        },
      })),
    },
  };
}

/**
 * Materializes the delivery DTO inside an existing Prisma transaction.
 * Honors idempotency, rights, and downgrade prevention.
 */
export async function materializeLearnerCohort(
  tx: Prisma.TransactionClient,
  creatorId: string,
  delivery: LearnerDeliveryPayload
): Promise<MaterializedCohortResult> {
  const rights = validateDeliveryRights(delivery);
  if (!rights.allowed) {
    throw new Error(`CANNOT_MATERIALIZE_COHORT: ${rights.violations.join('; ')}`);
  }

  const existing = await tx.cohort.findUnique({
    where: { id: delivery.cohort.id },
    select: { id: true, creatorId: true, visibility: true, creationSettings: true },
  });

  const now = new Date();

  if (existing) {
    if (existing.creatorId !== creatorId) {
      throw new Error('OWNERSHIP_MISMATCH: Existing published cohort is owned by a different user.');
    }

    const settings = existing.creationSettings as { contentHash?: string; workspaceId?: string } | null;
    if (settings?.workspaceId && settings.workspaceId !== delivery.workspaceId) {
      throw new Error('WORKSPACE_MISMATCH: Cohort ID was registered by another workspace.');
    }
    if (settings?.contentHash && settings.contentHash !== delivery.contentHash) {
      throw new Error('CONTENT_MUTATION_DENIED: Released cohort content is immutable. Create a new revision to publish updates.');
    }

    // Downgrade protection: A public cohort cannot be downgraded to private
    if (delivery.mode === 'private_activation' && existing.visibility === 'PUBLIC') {
      throw new Error('CANNOT_DOWNGRADE_PUBLIC_COHORT: A publicly published cohort cannot be downgraded to private activation.');
    }

    // Upgrade promotion: Private activation can be upgraded to public publish
    if (delivery.mode === 'public_publish' && existing.visibility === 'PRIVATE') {
      await tx.cohort.update({
        where: { id: existing.id },
        data: {
          visibility: 'PUBLIC',
          isPublished: true,
          creationSettings: {
            ...(existing.creationSettings as Record<string, unknown>),
            mode: 'public_publish',
            promotedAt: now.toISOString(),
            seo: delivery.cohort.seo ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return {
        cohortId: existing.id,
        isNew: false,
        visibility: 'PUBLIC',
        publishedAt: now,
      };
    }

    return {
      cohortId: existing.id,
      isNew: false,
      visibility: existing.visibility as 'PUBLIC' | 'PRIVATE',
      publishedAt: now,
    };
  }

  // First-time publication
  const createInput = buildPrismaCohortCreateInput(delivery, creatorId, now);
  const created = await tx.cohort.create({
    data: createInput,
    select: { id: true, visibility: true, publishedAt: true },
  });

  return {
    cohortId: created.id,
    isNew: true,
    visibility: created.visibility as 'PUBLIC' | 'PRIVATE',
    publishedAt: created.publishedAt ?? now,
  };
}

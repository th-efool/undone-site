import { NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { CohortService } from '@/src/server/domain/cohort/cohort.service';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';
import { Difficulty, Visibility, LessonType, SourceType } from '@/generated/prisma/client';
import { extractVideoId } from '@/src/server/imports/youtube/youtube-url';
import { getTopicCoverImage } from '@/src/shared/cohort-builder/delivery';
import { cohortTag } from '@/src/server/domain/cohort/public-cohort';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const sourceTypeMap: Record<string, SourceType> = {
  'YouTube Playlist': 'YOUTUBE_PLAYLIST',
  'YouTube Video': 'YOUTUBE_VIDEO',
  'Website': 'WEBSITE',
  'PDF': 'PDF',
  'Markdown': 'MARKDOWN',
  'GitHub Repository': 'GITHUB_REPO',
  'GitHub': 'GITHUB_REPO',
  'Notion Page': 'NOTION',
  'Notion Workspace': 'NOTION',
  'Notion': 'NOTION',
  'Custom Link': 'CUSTOM_LINK',
};

const publishSchema = z.object({
  draft: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    coverImage: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    visibility: z.enum(['Private', 'Unlisted', 'Public']).optional(),
    categories: z.array(z.string()).default([]),
    estimatedCompletionTime: z.string().optional(),
    language: z.string().optional(),
    primaryTopic: z.string().optional(),
    tags: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
    learningOutcomes: z.array(z.string()).default([]),
    sources: z.array(z.object({
      type: z.string(),
      title: z.string(),
      url: z.string(),
      thumbnailUrl: z.string().optional(),
      domain: z.string().optional(),
      metaTitle: z.string().optional(),
      chunkingMethod: z.string().optional(),
    })).default([]),
  }),
  curriculum: z.object({
    totalHours: z.string().optional(),
    totalLessons: z.number().optional(),
    totalSeasons: z.number().optional(),
    seasons: z.array(z.object({
      title: z.string(),
      lessons: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        duration: z.union([z.string(), z.number()]).optional(),
        thumbnail: z.string().optional(),
        videoId: z.string().optional(),
        videoUrl: z.string().optional(),
        sourceUrl: z.string().optional(),
        chunks: z.array(z.any()).optional(),
      })),
    })),
  }),
  qualityScore: z.number().optional(),
  forcePublishWithWeights: z.boolean().optional(),
});

function parseDurationToSeconds(duration: string | number | undefined): number {
  if (typeof duration === 'number') return isNaN(duration) ? 120 : Math.max(0, duration);
  if (duration === null || duration === undefined) return 120;
  const d = String(duration).toLowerCase().trim();
  if (!d) return 120;
  if (d.includes(':')) {
    const parts = d.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0] || '0', 10);
      const secs = parseInt(parts[1] || '0', 10);
      const total = (isNaN(mins) ? 0 : mins) * 60 + (isNaN(secs) ? 0 : secs);
      if (!isNaN(total) && total > 0) return total;
    }
    if (parts.length === 3) {
      const hrs = parseInt(parts[0] || '0', 10);
      const mins = parseInt(parts[1] || '0', 10);
      const secs = parseInt(parts[2] || '0', 10);
      const total = (isNaN(hrs) ? 0 : hrs) * 3600 + (isNaN(mins) ? 0 : mins) * 60 + (isNaN(secs) ? 0 : secs);
      if (!isNaN(total) && total > 0) return total;
    }
  }
  let total = 0;
  const hMatch = d.match(/(\d+)\s*(?:h|hr|hour)/);
  const mMatch = d.match(/(\d+)\s*(?:m|min|minute)/);
  const sMatch = d.match(/(\d+)\s*(?:s|sec|second)/);
  if (hMatch && hMatch[1]) total += parseInt(hMatch[1], 10) * 3600;
  if (mMatch && mMatch[1]) total += parseInt(mMatch[1], 10) * 60;
  if (sMatch && sMatch[1]) total += parseInt(sMatch[1], 10);
  if (total > 0 && !isNaN(total)) return total;
  const rawNum = parseInt(d, 10);
  if (!isNaN(rawNum) && rawNum > 0) return rawNum * 60;
  return 120;
}

export async function POST(request: NextRequest) {
  console.log('>>> [Publish Route] POST invoked <<<');
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return Response.json(
        {
          code: 'unauthorized',
          title: 'Unauthorized',
          message: 'You must be logged in to publish a cohort.',
        },
        { status: 401 },
      );
    }

    const jsonBody = await request.json().catch(() => null);

    if (!jsonBody) {
      return Response.json(
        { code: 'invalid_payload', title: 'Invalid Cohort Payload', message: 'Payload is missing.' },
        { status: 400 },
      );
    }

    const parseResult = publishSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return Response.json(
        {
          code: 'invalid_payload',
          title: 'Invalid Cohort Payload',
          message: parseResult.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 },
      );
    }

    const { draft, curriculum, qualityScore, forcePublishWithWeights } = parseResult.data;

    // 1. Get creator from session, or default to test user
    let creator = null;

    if (session.user.id) {
      creator = await userRepo.findById(session.user.id);
    } else if (session.user.email) {
      creator = await userRepo.findByEmail(session.user.email);
    }

    if (!creator) {
      return Response.json(
        {
          code: 'unauthorized',
          title: 'Unauthorized',
          message: 'You must be logged in to publish a cohort.',
        },
        { status: 401 },
      );
    }

    // 2. Map curriculum to seasons and lessons
    let firstVideoThumbnail: string | undefined;

    const seasons = (curriculum?.seasons ?? []).map((s, sIdx) => ({
      title: s.title,
      order: sIdx + 1,
      lessons: (s.lessons ?? []).map((l, lIdx) => {
        const videoId = l.videoId || extractVideoId(l.videoUrl || l.sourceUrl || '') || undefined;
        const isVideo = Boolean(videoId || (l.sourceUrl && (l.sourceUrl.includes('youtube.com') || l.sourceUrl.includes('youtu.be'))));
        const videoUrl = l.videoUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined);
        const thumbnailUrl = l.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);
        const sourceUrl = videoUrl || l.sourceUrl;

        if (thumbnailUrl && !firstVideoThumbnail) {
          firstVideoThumbnail = thumbnailUrl;
        }

        return {
          title: l.title,
          description: l.description,
          duration: parseDurationToSeconds(l.duration),
          order: lIdx + 1,
          lessonType: isVideo ? ('VIDEO' as LessonType) : ('ARTICLE' as LessonType),
          thumbnailUrl,
          videoId,
          videoUrl,
          sourceUrl,
          chunks: (l.chunks || []).map((c: any, cIdx: number) => ({
            ...c,
            order: c.order || cIdx + 1,
            startSeconds: c.startSeconds || 0,
            endSeconds: c.endSeconds || 0,
            timeRangeLabel: c.timeRangeLabel || '',
            timestampUrl: c.timestampUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${c.startSeconds || 0}s` : sourceUrl),
          })),
        };
      }),
    }));

    // 3. Map sources
    const sources = (draft?.sources ?? []).map(source => ({
      type: (source?.type && sourceTypeMap[source.type]) || 'CUSTOM_LINK',
      title: source?.title || 'Untitled Source',
      url: source?.url || '',
      thumbnailUrl: source?.thumbnailUrl,
      domain: source?.domain,
      metaTitle: source?.metaTitle,
      chunkingMethod: source?.chunkingMethod,
    }));

    const primaryTopic = draft.primaryTopic || draft.title || 'General Knowledge';
    const resolvedCover = draft.coverImage?.trim() || firstVideoThumbnail || getTopicCoverImage(primaryTopic);

    // 4. Publish the cohort using Domain Service
    console.log('>>> [Publish Route] Calling CohortService.publishCohort...');
    const dbCohort = await CohortService.publishCohort({
      creatorId: creator.id,
      title: (typeof draft.title === 'string' && draft.title.trim()) || 'Untitled Cohort',
      subtitle: draft.subtitle,
      description: draft.description,
      coverImage: resolvedCover,
      difficulty: draft.difficulty ? (draft.difficulty.toUpperCase() as Difficulty) : 'INTERMEDIATE',
      visibility: draft.visibility === 'Private' ? 'PRIVATE' : draft.visibility === 'Unlisted' ? 'INVITE_ONLY' : 'PUBLIC',
      categories: draft.categories || [],
      estimatedCompletionTime: draft.estimatedCompletionTime,
      language: draft.language,
      primaryTopic: draft.primaryTopic,
      tags: draft.tags || [],
      requirements: draft.requirements || [],
      learningOutcomes: draft.learningOutcomes || [],
      sources,
      seasons,
      forcePublishWithWeights,
    });
    console.log('>>> [Publish Route] CohortService.publishCohort returned successfully:', dbCohort?.id);

    if (!dbCohort || !dbCohort.id) {
      return Response.json(
        {
          code: 'publish_error',
          title: 'Publish Failed',
          message: 'Failed to create cohort record.',
        },
        { status: 500 },
      );
    }

    if (dbCohort.visibility === 'PUBLIC') {
      try {
        revalidateTag(cohortTag(dbCohort.id), 'max');
        revalidatePath(`/cohort/${dbCohort.id}`);
        revalidatePath(`/cohort/${dbCohort.id}/overview`);
        revalidatePath(`/cohort/${dbCohort.id}/questline`);
        revalidatePath(`/cohort/${dbCohort.id}/archives`);
        revalidatePath(`/cohort/${dbCohort.id}/events`);
        revalidatePath(`/cohort/${dbCohort.id}/hall-of-fame`);
        revalidatePath('/explore');
        revalidatePath('/sitemap.xml');
      } catch (err) {
        console.error('Failed to revalidate cache on publish:', err);
      }
    }

    console.log('>>> [Publish Route] Sending Response.json for cohort:', dbCohort.id);
    return Response.json({
      cohortId: dbCohort.id,
      cohortTitle: dbCohort.title || draft.title || 'Untitled Cohort',
      cohortUrl: `/cohort/${dbCohort.id}`,
      publishedAt: dbCohort.publishedAt ? new Date(dbCohort.publishedAt).toISOString() : new Date().toISOString(),
      version: '1.0.0',
      visibility: dbCohort.visibility || 'PUBLIC',
      totalHours: curriculum.totalHours || '0m',
      totalLessons: curriculum.totalLessons ?? 0,
      totalSeasons: curriculum.totalSeasons ?? 0,
      qualityScore: typeof qualityScore === 'number' && !isNaN(qualityScore) ? qualityScore : 90,
      coverImage: dbCohort.coverImage || '/images/landing/screen.webp',
    });
  } catch (error) {
    console.error('>>> [Publish Route] ERROR CAUGHT:', error);
    console.error('[Publish Route] Caught error during cohort publication:', error);
    if (error instanceof Error && error.message === 'WEIGHTS_REQUIRED') {
      return Response.json(
        {
          code: 'WEIGHTS_REQUIRED',
          title: 'Weights Required',
          message: 'WEIGHTS_REQUIRED',
        },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Publishing failed';
    return Response.json(
      {
        code: 'publish_error',
        title: 'Publish Failed',
        message,
      },
      { status: 500 },
    );
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { CohortService } from '@/src/server/domain/cohort/cohort.service';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';
import { Difficulty, Visibility, LessonType, SourceType } from '@/generated/prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sourceTypeMap: Record<string, SourceType> = {
  'YouTube Playlist': 'YOUTUBE_PLAYLIST',
  'YouTube Video': 'YOUTUBE_VIDEO',
  'Website': 'WEBSITE',
  'PDF': 'PDF',
  'Markdown': 'MARKDOWN',
  'GitHub Repository': 'GITHUB_REPO',
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
      })),
    })),
  }),
  qualityScore: z.number().optional(),
  forcePublishWithWeights: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
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

    if (!forcePublishWithWeights) {
      return Response.json(
        {
          code: 'WEIGHTS_REQUIRED',
          title: 'Weights Required',
          message: 'WEIGHTS_REQUIRED',
        },
        { status: 400 },
      );
    }


    // 1. Get or create a default user to act as the creator
    let creator = await userRepo.findByEmail('test@sidequesthq.com');
    if (!creator) {
      creator = await userRepo.create({
        email: 'test@sidequesthq.com',
        name: 'Test Creator',
        username: 'testcreator',
      });
    }

    // 2. Map curriculum to seasons and lessons
    const seasons = curriculum.seasons.map((s, sIdx) => ({
      title: s.title,
      order: sIdx + 1,
      lessons: s.lessons.map((l, lIdx) => ({
        title: l.title,
        description: l.description,
        duration: typeof l.duration === 'string' ? parseInt(l.duration) : (l.duration || 120),
        order: lIdx + 1,
        lessonType: 'VIDEO' as LessonType,
      })),
    }));

    // 3. Map sources
    const sources = draft.sources.map(source => ({
      type: sourceTypeMap[source.type] || 'CUSTOM_LINK',
      title: source.title,
      url: source.url,
      thumbnailUrl: source.thumbnailUrl,
      domain: source.domain,
      metaTitle: source.metaTitle,
      chunkingMethod: source.chunkingMethod,
    }));

    // 4. Publish the cohort using Domain Service
    const dbCohort = await CohortService.publishCohort({
      creatorId: creator.id,
      title: draft.title || 'Untitled Cohort',
      subtitle: draft.subtitle,
      description: draft.description,
      coverImage: draft.coverImage,
      difficulty: draft.difficulty ? (draft.difficulty.toUpperCase() as Difficulty) : 'INTERMEDIATE',
      visibility: draft.visibility === 'Private' ? 'PRIVATE' : draft.visibility === 'Unlisted' ? 'INVITE_ONLY' : 'PUBLIC',
      categories: draft.categories,
      estimatedCompletionTime: draft.estimatedCompletionTime,
      language: draft.language,
      primaryTopic: draft.primaryTopic,
      tags: draft.tags,
      requirements: draft.requirements,
      learningOutcomes: draft.learningOutcomes,
      sources,
      seasons,
      forcePublishWithWeights,
    });

    return Response.json({
      cohortId: dbCohort.id,
      cohortTitle: dbCohort.title,
      cohortUrl: `/cohort/${dbCohort.id}`,
      publishedAt: dbCohort.publishedAt?.toISOString(),
      version: '1.0.0',
      visibility: dbCohort.visibility,
      totalHours: curriculum.totalHours || '0m',
      totalLessons: curriculum.totalLessons || 0,
      totalSeasons: curriculum.totalSeasons || 0,
      qualityScore: qualityScore || 90,
      coverImage: dbCohort.coverImage || '/images/landing/screen.webp',
    });
  } catch (error) {
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

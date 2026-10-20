import { prisma } from '../client';
import type { Prisma } from '@/generated/prisma/client';
import { Difficulty, Visibility, LessonType, SourceType } from '@/generated/prisma/client';

export interface CreateCohortParams {
  creatorId: string;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  difficulty?: Difficulty;
  visibility?: Visibility;
  categories: string[];
  estimatedCompletionTime?: string;
  language?: string;
  primaryTopic?: string;
  tags: string[];
  requirements: string[];
  learningOutcomes: string[];
  sources: {
    type: SourceType;
    title: string;
    url: string;
    thumbnailUrl?: string;
    domain?: string;
    metaTitle?: string;
    chunkingMethod?: string;
  }[];
  seasons: {
    title: string;
    order: number;
    lessons: {
      title: string;
      description?: string;
      duration?: number;
      order: number;
      lessonType?: LessonType;
      thumbnailUrl?: string;
      videoId?: string;
      videoUrl?: string;
      sourceUrl?: string;
      chunks?: any;
      isPublished?: boolean;
    }[];
  }[];
  isPublished?: boolean;
  forcePublishWithWeights?: boolean;
}

export const cohortRepo = {
  async updatePublishStatus(
    cohortId: string,
    isPublished: boolean,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.cohort.update({
        where: { id: cohortId },
        data: { isPublished, publishedAt: isPublished ? new Date() : null },
      });

      const seasons = await tx.season.findMany({
        where: { cohortId },
        select: { id: true },
      });

      if (seasons.length > 0) {
        await tx.lesson.updateMany({
          where: {
            seasonId: { in: seasons.map((s) => s.id) },
          },
          data: {
            isPublished,
          },
        });
      }

      return updated;
    };

    if ('$transaction' in client) {
      return client.$transaction(execute);
    }
    return execute(client);
  },

  async createCohortWithCommunity(
    data: CreateCohortParams,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Create main cohort
      const cohort = await tx.cohort.create({
        data: {
          creatorId: data.creatorId,
          title: data.title,
          subtitle: data.subtitle,
          description: data.description,
          coverImage: data.coverImage,
          difficulty: data.difficulty ?? 'BEGINNER',
          visibility: data.visibility ?? 'PUBLIC',
          categories: data.categories || [],
          estimatedCompletionTime: data.estimatedCompletionTime,
          language: data.language,
          primaryTopic: data.primaryTopic,
          tags: data.tags || [],
          requirements: data.requirements || [],
          learningOutcomes: data.learningOutcomes || [],
          isPublished: data.isPublished ?? false,
          publishedAt: data.isPublished ? new Date() : null,
        },
      });

      // 2. Create sources
      if (data.sources && data.sources.length > 0) {
        await tx.cohortSource.createMany({
          data: data.sources.map((source) => ({
            cohortId: cohort.id,
            type: source.type,
            title: source.title,
            url: source.url,
            thumbnailUrl: source.thumbnailUrl,
            domain: source.domain,
            metaTitle: source.metaTitle,
            chunkingMethod: source.chunkingMethod,
          })),
        });
      }

      // 3. Create seasons and lessons
      if (data.seasons && data.seasons.length > 0) {
        for (const season of data.seasons) {
          const createdSeason = await tx.season.create({
            data: {
              cohortId: cohort.id,
              title: season.title,
              order: season.order,
            },
          });

          if (season.lessons && season.lessons.length > 0) {
            await tx.lesson.createMany({
              data: season.lessons.map((lesson) => ({
                seasonId: createdSeason.id,
                title: lesson.title,
                description: lesson.description,
                duration: lesson.duration,
                order: lesson.order,
                lessonType: lesson.lessonType ?? 'VIDEO',
                thumbnailUrl: lesson.thumbnailUrl,
                videoId: lesson.videoId,
                videoUrl: lesson.videoUrl,
                sourceUrl: lesson.sourceUrl,
                chunks: lesson.chunks || [],
                isPublished: lesson.isPublished ?? Boolean(data.isPublished ?? true),
              })),
            });
          }
        }
      }

      // 4. Create community and default channels
      const community = await tx.community.create({
        data: {
          cohortId: cohort.id,
          chatEnabled: true,
          eventsEnabled: true,
        },
      });

      await tx.channel.createMany({
        data: [
          { name: 'general', communityId: community.id },
          { name: 'resources', communityId: community.id },
        ],
      });

      // 5. Add creator as first member
      await tx.cohortMember.create({
        data: {
          cohortId: cohort.id,
          userId: data.creatorId,
          role: 'CREATOR',
        },
      });

      return cohort;
    };

    if ('$transaction' in client) {
      return client.$transaction(execute);
    }
    return execute(client);
  },

  async getFullCohort(id: string) {
    return prisma.cohort.findUnique({
      where: { id },
      include: {
        seasons: {
          orderBy: {
            order: 'asc',
          },
          include: {
            lessons: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });
  },
};

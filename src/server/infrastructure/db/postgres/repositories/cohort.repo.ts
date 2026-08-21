import { prisma } from '../client';
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
      chunks?: any;
    }[];
  }[];
  isPublished?: boolean;
  forcePublishWithWeights?: boolean;
}

export const cohortRepo = {
  async updatePublishStatus(cohortId: string, isPublished: boolean) {
    return prisma.cohort.update({
      where: { id: cohortId },
      data: { isPublished, publishedAt: isPublished ? new Date() : null },
    });
  },

  async createCohortWithCommunity(data: CreateCohortParams) {
    return prisma.cohort.create({
      data: {
        creatorId: data.creatorId,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        coverImage: data.coverImage,
        difficulty: data.difficulty ?? 'BEGINNER',
        visibility: data.visibility ?? 'PUBLIC',
        categories: data.categories,
        estimatedCompletionTime: data.estimatedCompletionTime,
        language: data.language,
        primaryTopic: data.primaryTopic,
        tags: data.tags,
        requirements: data.requirements,
        learningOutcomes: data.learningOutcomes,
        isPublished: data.isPublished ?? false,
        publishedAt: data.isPublished ? new Date() : null,
        
        sources: {
          create: data.sources.map(source => ({
            type: source.type,
            title: source.title,
            url: source.url,
            thumbnailUrl: source.thumbnailUrl,
            domain: source.domain,
            metaTitle: source.metaTitle,
            chunkingMethod: source.chunkingMethod,
          })),
        },
        
        // Nested create for seasons and lessons
        seasons: {
          create: data.seasons.map((season) => ({
            title: season.title,
            order: season.order,
            lessons: {
              create: season.lessons.map((lesson) => ({
                title: lesson.title,
                description: lesson.description,
                duration: lesson.duration,
                order: lesson.order,
                lessonType: lesson.lessonType ?? 'VIDEO',
                thumbnailUrl: lesson.thumbnailUrl,
                videoId: lesson.videoId,
                videoUrl: lesson.videoUrl,
                chunks: lesson.chunks || [],
              })),
            },
          })),
        },
        
        // Nested create for community and channels
        community: {
          create: {
            chatEnabled: true,
            eventsEnabled: true,
            channels: {
              create: [
                { name: 'general' },
                { name: 'resources' },
              ],
            },
          },
        },

        // Nested create for creator membership
        members: {
          create: [
            {
              userId: data.creatorId,
              role: 'CREATOR',
            },
          ],
        },
      },
      include: {
        community: true,
        seasons: true,
        members: true,
      }
    });
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

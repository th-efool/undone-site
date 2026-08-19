import { prisma } from '../client';
import { Difficulty, Visibility, LessonType } from '@/generated/prisma/client';

export interface CreateCohortParams {
  creatorId: string;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  difficulty?: Difficulty;
  visibility?: Visibility;
  seasons: {
    title: string;
    order: number;
    lessons: {
      title: string;
      description?: string;
      duration?: number;
      order: number;
      lessonType?: LessonType;
    }[];
  }[];
}

export const cohortRepo = {
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
        isPublished: true,
        publishedAt: new Date(),
        
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
      },
      include: {
        community: true,
        seasons: true,
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

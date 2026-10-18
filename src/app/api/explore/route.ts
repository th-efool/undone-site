import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { exploreRepo } from '@/src/server/infrastructure/db/mock/repositories/explore.repo';
import type { ArticlePreview, ExploreModel, SideQuest } from '@/src/client/screens/dashboard/explore/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const baseMock = exploreRepo?.getExplore?.() ?? {
      searchSuggestions: [],
      peopleFinishing: [],
      topics: [],
      trendingSideQuests: [],
      recentlyPublished: [],
    };

    // Query real published public cohorts
    const dbCohorts = await prisma.cohort.findMany({
      where: {
        isPublished: true,
        visibility: 'PUBLIC',
      },
      take: 12,
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        _count: { select: { members: true } },
        seasons: { include: { _count: { select: { lessons: true } } } },
      },
    });

    if (!dbCohorts || dbCohorts.length === 0) {
      return NextResponse.json(baseMock);
    }

    const mappedSideQuests: SideQuest[] = dbCohorts.map((cohort) => ({
      id: cohort.id,
      cohortId: cohort.id,
      title: cohort.title,
      subtitle: cohort.subtitle ?? cohort.description ?? 'Interactive cohort adventure',
      dailyGoal: cohort.estimatedCompletionTime ?? '20 min/day',
      thumbnail: cohort.coverImage || '/mock/thumbnails/deep-work.webp',
      featuredParticipants: cohort.creator?.image
        ? [{ id: cohort.creator.id ?? cohort.id, image: cohort.creator.image, alt: cohort.creator.name ?? 'Creator' }]
        : [],
      participantCount: `${cohort._count.members} participant${cohort._count.members === 1 ? '' : 's'}`,
    }));

    const mappedArticles: ArticlePreview[] = dbCohorts.map((cohort) => ({
      id: cohort.id,
      cohortId: cohort.id,
      title: cohort.title,
      author: cohort.creator?.name ?? 'SideQuest Guide',
      thumbnail: cohort.coverImage || '/mock/thumbnails/deep-work.webp',
      learnerCount: `${cohort._count.members} learner${cohort._count.members === 1 ? '' : 's'}`,
      publishedLabel: cohort.publishedAt
        ? new Date(cohort.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Recently published',
      bookmarked: false,
    }));

    // Blend DB cohorts ahead of starter mock items to ensure rich display even with few records
    const blendedTrendingSideQuests = [
      ...mappedSideQuests,
      ...(baseMock.trendingSideQuests || []).filter(
        (mock) => !mappedSideQuests.some((db) => db.id === mock.id),
      ),
    ];

    const blendedRecentlyPublished = [
      ...mappedArticles,
      ...(baseMock.recentlyPublished || []).filter(
        (mock) => !mappedArticles.some((db) => db.id === mock.id),
      ),
    ];

    const payload: ExploreModel & { trendingQuests: SideQuest[] } = {
      ...baseMock,
      trendingSideQuests: blendedTrendingSideQuests,
      recentlyPublished: blendedRecentlyPublished,
      trendingQuests: blendedTrendingSideQuests,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[API Explore Error]:', error);
    try {
      const fallback = exploreRepo?.getExplore?.() ?? {
        searchSuggestions: [],
        peopleFinishing: [],
        topics: [],
        trendingSideQuests: [],
        recentlyPublished: [],
      };
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
}


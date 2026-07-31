import { exploreMock } from '@/src/client/components/screens/dashboard/explore/mock/explore.mock';
import type { ExploreModel } from '@/src/client/components/screens/dashboard/explore/models';
import { cohortRepository } from './cohortRepository';

export const exploreRepository = {
  getExplore(): ExploreModel {
    const base = structuredClone(exploreMock);
    const allCohorts = cohortRepository.list();

    // Dynamically surface published user cohorts at top of Recently Published
    const userPublished = allCohorts.map((c) => ({
      id: c.id,
      title: c.title,
      author: c.creator?.name || 'Shaqun',
      thumbnail: c.coverImage || '/mock/thumbnails/docker.avif',
      learnerCount: '1 learner',
      publishedLabel: 'Just now',
      bookmarked: false,
    }));

    return {
      ...base,
      recentlyPublished: [...userPublished, ...base.recentlyPublished],
    };
  },
};

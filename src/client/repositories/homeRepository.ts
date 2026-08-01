import { homeMock } from '@/src/client/components/screens/dashboard/home/mock/home.mock';
import type { ActiveCohort, HomeModel } from '@/src/client/components/screens/dashboard/home/models';
import { cohortRepository } from './cohortRepository';
import { cohortStore } from './cohortStore';
import { feedCohortIds } from '@/src/client/mock/cohorts/feedCohorts';

function withCohortData<
  T extends { id: string; title: string; thumbnail: string; provider?: string },
>(item: T): T {
  const cohort = cohortRepository.getById(item.id);
  return {
    ...item,
    cohortId: cohort.id,
    title: cohort.title || item.title,
    thumbnail: cohort.coverImage || item.thumbnail,
    provider: cohort.creator?.name || item.provider || 'SideQuestHQ',
  };
}

export const homeRepository = {
  getHome(): HomeModel {
    const userPublishedIds = new Set(cohortStore.getUserCohorts().map((c) => c.id));

    // Filter all cohorts down to active feed cohorts + user-published cohorts
    const allCohorts = cohortRepository.list();
    const activeCandidates = allCohorts.filter(
      (c) => feedCohortIds.has(c.id) || userPublishedIds.has(c.id),
    );

    const activeCohortsMap = new Map<string, ActiveCohort>();

    // 1. Add active candidate cohorts with real progress
    activeCandidates.forEach((c, index) => {
      activeCohortsMap.set(c.id, {
        id: c.id,
        cohortId: c.id,
        rank: index + 1,
        title: c.title,
        provider: c.creator?.name || 'Educator',
        thumbnail: c.coverImage,
        minutesToday: 12,
        dailyGoalMinutes: 20,
        progressPercent: c.progress?.journeyProgress || 10,
        schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
        featured: index === 0,
      });
    });

    // 2. We no longer inject homeMock.activeCohorts because it polls the feed
    // with trash mocks if not strictly controlled. Active cohorts ONLY come from
    // the user's progress or the explicit feed cohorts.

    const activeList = Array.from(activeCohortsMap.values()).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    return {
      ...homeMock,
      activeCohorts: activeList.slice(0, 3),
      continueLater: homeMock.continueLater.map(withCohortData),
      recentlyCompleted: homeMock.recentlyCompleted
        .map((item) => withCohortData({ ...item, provider: '' }))
        .map((item) => ({
          id: item.id,
          cohortId: item.cohortId,
          title: item.title,
          thumbnail: item.thumbnail,
          completedLabel: item.completedLabel,
          progressPercent: item.progressPercent,
        })),
    };
  },
};

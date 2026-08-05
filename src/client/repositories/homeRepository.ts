import { homeMock } from '@/src/client/components/screens/dashboard/home/mock/home.mock';
import type { ActiveCohort, HomeModel } from '@/src/client/components/screens/dashboard/home/models';
import { cohortRepository } from './cohortRepository';
import { cohortStore } from './cohortStore';
import { feedCohortIds } from '@/src/client/mock/cohorts/feedCohorts';
import { homeStorageAdapter } from './homeStorageAdapter';

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

    let activeList = Array.from(activeCohortsMap.values()).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    let continueLaterList = homeMock.continueLater.map(withCohortData);

    // 2. Hydrate from local storage choices if available
    const stored = homeStorageAdapter.getStoredChoices();
    if (stored) {
      if (Array.isArray(stored.activeCohorts) && stored.activeCohorts.length > 0) {
        const storedMap = new Map(stored.activeCohorts.map((c) => [c.id, c]));
        
        const reorderedActive: ActiveCohort[] = [];
        stored.activeCohorts.forEach((storedCohort) => {
          const base = activeCohortsMap.get(storedCohort.id);
          if (base) {
            reorderedActive.push({
              ...base,
              ...storedCohort,
            });
          }
        });

        activeCandidates.forEach((c) => {
          if (!storedMap.has(c.id)) {
            const base = activeCohortsMap.get(c.id);
            if (base) reorderedActive.push(base);
          }
        });

        activeList = reorderedActive.map((item, idx) => ({ ...item, rank: idx + 1 }));
      }

      if (Array.isArray(stored.continueLater)) {
        continueLaterList = stored.continueLater.map(withCohortData);
      }
    }

    return {
      ...homeMock,
      activeCohorts: activeList.slice(0, 10),
      continueLater: continueLaterList,
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

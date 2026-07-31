import { homeMock } from '@/src/client/components/screens/dashboard/home/mock/home.mock';
import type { ActiveCohort, HomeModel } from '@/src/client/components/screens/dashboard/home/models';
import { cohortRepository } from './cohortRepository';

function withCohortData<
  T extends { id: string; title: string; thumbnail: string; provider?: string },
>(item: T): T {
  const cohort = cohortRepository.getById(item.id);
  return {
    ...item,
    cohortId: cohort.id,
    title: cohort.title,
    thumbnail: cohort.coverImage,
    provider: item.provider ? cohort.creator.name : item.provider,
  };
}

export const homeRepository = {
  getHome(): HomeModel {
    const userCohorts = cohortRepository.list();
    const userActive: ActiveCohort[] = userCohorts.map((c, index) => ({
      id: c.id,
      rank: index + 1,
      title: c.title,
      provider: c.creator.name,
      thumbnail: c.coverImage,
      minutesToday: 0,
      dailyGoalMinutes: 20,
      progressPercent: 0,
      schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
      featured: index === 0,
    }));

    return {
      ...homeMock,
      activeCohorts: [...userActive, ...homeMock.activeCohorts.map(withCohortData)],
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

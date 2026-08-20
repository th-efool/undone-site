import type { ActiveCohort, PausedCohort, CompletedCourse, HomeModel } from '@/src/client/screens/dashboard/home/models';
import { cohortRepository } from './cohortRepository';
import { cohortStore } from './cohortStore';
import { homeStorageAdapter } from './homeStorageAdapter';

export const homeRepository = {
  getHome(): HomeModel {
    const userPublishedIds = new Set(cohortStore.getUserCohorts().map((c) => c.id));

    // Filter all cohorts down to active feed cohorts + user-published cohorts
    const allCohorts = cohortRepository.list();
    const activeCandidates = allCohorts.filter(
      (c) => userPublishedIds.has(c.id),
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
        thumbnail: c.coverImage || '',
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

    let continueLaterList: PausedCohort[] = [];

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
        continueLaterList = stored.continueLater as PausedCohort[];
      }
    }

    return {
      hero: {
        title: 'Welcome back!',
        subtitle: 'Ready to continue your quests?',
        actionLabel: 'Explore Quests',
      },
      sections: {
        activeCohorts: { title: 'Active Cohorts' },
        continueLater: { title: 'Continue Later' },
        recentlyCompleted: { title: 'Recently Completed' },
      },
      searchPlaceholder: 'Search cohorts...',
      pauseOptions: [],
      summaries: [
        {
          id: 'active-cohorts',
          title: 'Active Cohorts',
          value: String(activeList.length),
          helperText: '+1 this week',
          helperTone: 'brand',
          icon: 'TrendingUp',
          iconTone: 'brand',
        },
        {
          id: 'study-hours',
          title: 'Hours Learning',
          value: '0',
          helperText: '+0 hours this week',
          helperTone: 'brand',
          icon: 'Clock',
          iconTone: 'brand',
        },
        {
          id: 'knowledge-points',
          title: 'Knowledge Points',
          value: '0',
          helperText: '+0 this week',
          helperTone: 'brand',
          icon: 'Star',
          iconTone: 'brand',
        },
      ],
      activeCohorts: activeList.slice(0, 10),
      continueLater: continueLaterList,
      recentlyCompleted: [],
    };
  },
};

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

    const DEFAULT_COHORTS: ActiveCohort[] = [
      {
        id: 'neuroscience-101',
        cohortId: 'neuroscience-101',
        rank: 1,
        title: 'Neuroscience 101',
        provider: 'Cognitive Science Dept',
        thumbnail: '/images/cohorts/neuroscience.webp',
        minutesToday: 15,
        dailyGoalMinutes: 20,
        progressPercent: 62,
        memberCount: 247,
        schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
        featured: true,
      },
      {
        id: 'cities-urban-systems',
        cohortId: 'cities-urban-systems',
        rank: 2,
        title: 'Cities & Urban Systems',
        provider: 'Urban Dynamics',
        thumbnail: '/images/cohorts/cities.webp',
        minutesToday: 10,
        dailyGoalMinutes: 20,
        progressPercent: 28,
        memberCount: 124,
        schedule: { days: ['Tue', 'Thu'], label: 'Tue, Thu' },
      },
      {
        id: 'ai-for-creators',
        cohortId: 'ai-for-creators',
        rank: 3,
        title: 'AI for Creators',
        provider: 'Studio Lab',
        thumbnail: '/images/cohorts/ai-creators.webp',
        minutesToday: 12,
        dailyGoalMinutes: 20,
        progressPercent: 41,
        memberCount: 89,
        schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
      },
      {
        id: 'game-design-basics',
        cohortId: 'game-design-basics',
        rank: 4,
        title: 'Game Design Basics',
        provider: 'Play Architecture',
        thumbnail: '/images/cohorts/game-design.webp',
        minutesToday: 8,
        dailyGoalMinutes: 15,
        progressPercent: 19,
        memberCount: 56,
        schedule: { days: ['Sat', 'Sun'], label: 'Weekends' },
      },
    ];

    let activeList = Array.from(activeCohortsMap.values()).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    if (activeList.length === 0) {
      activeList = DEFAULT_COHORTS;
    }

    let continueLaterList: PausedCohort[] = [];

    // 2. Hydrate from local storage choices if available
    const stored = homeStorageAdapter.getStoredChoices();
    if (stored) {
      if (Array.isArray(stored.activeCohorts) && stored.activeCohorts.length > 0) {
        const storedMap = new Map(stored.activeCohorts.map((c) => [c.id, c]));
        
        const reorderedActive: ActiveCohort[] = [];
        stored.activeCohorts.forEach((storedCohort) => {
          const base = activeCohortsMap.get(storedCohort.id) || DEFAULT_COHORTS.find((c) => c.id === storedCohort.id);
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

        if (reorderedActive.length > 0) {
          activeList = reorderedActive.map((item, idx) => ({ ...item, rank: idx + 1 }));
        }
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
        activeCohorts: { title: 'Subscribed Cohorts' },
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

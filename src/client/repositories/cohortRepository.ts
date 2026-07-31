import { cohortNavigationItems } from '@/src/client/components/screens/cohort/mocks/cohortMock';
import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortStore } from './cohortStore';

/**
 * Creates a minimal placeholder cohort for SSR when the real cohort
 * can't be found (e.g. user-published cohort not in localStorage on server).
 * Client hydration will replace this with real data.
 */
function createPlaceholder(id: string): Cohort {
  const template = cohortStore.getAll()[0];
  return {
    ...template,
    id,
    title: 'Loading...',
    subtitle: '',
    description: '',
    coverImage: '/mock/thumbnails/docker.avif',
    categories: [],
    stats: { rating: 0, explorerCount: 0, completionRate: 0 },
    progress: {
      journeyProgress: 0,
      completedQuests: 0,
      totalQuests: 0,
      dailyGoal: '',
      joinedDate: '',
    },
    overview: {
      ...template.overview,
      description: '',
      pillars: [],
      learningObjectives: [],
      journeySummary: [],
      expeditionStats: [],
      expeditionProgress: [],
      activeExplorers: [],
      activeExplorerOverflow: '',
    },
    questline: {
      ...template.questline,
      title: 'Loading...',
      description: '',
      seasons: [],
      assignmentFeed: [],
    },
    events: {
      ...template.events,
      title: 'Loading...',
      description: '',
      upcomingEvents: [],
      weeklySchedule: [],
    },
    archives: {
      ...template.archives,
      title: 'Loading...',
      description: '',
      items: [],
      contributors: [],
      trending: [],
    },
    hallOfFame: {
      ...template.hallOfFame,
      title: 'Loading...',
      subtitle: '',
      legends: [],
      recentAchievements: [],
    },
  };
}

export const cohortRepository = {
  list(): Cohort[] {
    return cohortStore.getAll();
  },
  getById(id: string): Cohort {
    // Look up by ID. If not found (e.g. server-side for user-published cohorts),
    // return a blank placeholder instead of falling back to Deep Work Mastery.
    // Client hydration via useCohort's useEffect will re-lookup from localStorage.
    const found = cohortStore.getById(id);
    if (found) return found;

    // For known catalog IDs, fall back to catalog[0] for backwards compat
    const catalog = cohortStore.getAll();
    const catalogMatch = catalog.find((c) => c.id === id);
    if (catalogMatch) return catalogMatch;

    // For user-published cohorts that aren't in memory yet (SSR),
    // return a blank placeholder — NOT Deep Work Mastery
    return createPlaceholder(id);
  },
  registerPublishedCohort(data: any): Cohort {
    return cohortStore.registerPublishedCohort(data);
  },
  navigationItems: cohortNavigationItems,
};

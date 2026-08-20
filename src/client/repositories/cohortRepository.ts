import type { Cohort } from '@/src/client/screens/cohort/models';
import { cohortStore } from './cohortStore';

const cohortNavigationItems = [
  { id: 'overview', label: 'Overview', href: 'overview', icon: 'info' as const },
  { id: 'questline', label: 'Questline', href: 'questline', icon: 'map' as const },
  { id: 'events', label: 'Events', href: 'events', icon: 'calendar' as const },
  { id: 'archives', label: 'Archives', href: 'archives', icon: 'archive' as const },
  { id: 'hall-of-fame', label: 'Hall of Fame', href: 'hall-of-fame', icon: 'award' as const },
];

function createPlaceholder(id: string): Cohort {
  return {
    id,
    title: 'Loading...',
    subtitle: '',
    description: '',
    coverImage: '',
    difficulty: 'Intermediate',
    categories: [],
    creator: { id: '', name: '', avatarUrl: '', role: '', bio: '', ctaLabel: '' },
    stats: { rating: 0, explorerCount: 0, completionRate: 0 },
    progress: {
      journeyProgress: 0,
      completedQuests: 0,
      totalQuests: 0,
      dailyGoal: '',
      joinedDate: '',
    },
    overview: {
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
      title: 'Loading...',
      description: '',
      filters: [],
      skipSeasonLabel: '',
      seasons: [],
      feedTitle: '',
      feedDescription: '',
      feedSeasonLabel: '',
      feedViewAllLabel: '',
      assignmentFeed: [],
      lockedFutureNotice: { icon: 'target', title: '', description: '' },
    },
    events: {
      title: 'Loading...',
      description: '',
      filters: [],
      upcomingEvents: [],
      weeklySchedule: [],
      calendarSync: [],
      suggestEvent: { title: '', description: '', buttonLabel: '', illustration: '' },
    },
    archives: {
      title: 'Loading...',
      description: '',
      categories: [],
      sortControls: [],
      items: [],
      contributors: [],
      trending: [],
      shareKnowledge: { title: '', description: '', buttonLabel: '', illustration: '' },
    },
    hallOfFame: {
      title: 'Loading...',
      subtitle: '',
      filters: [],
      timeRanges: [],
      categories: [],
      legends: [],
      userHighlights: [],
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

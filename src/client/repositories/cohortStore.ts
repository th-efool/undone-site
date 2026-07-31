import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortCatalog } from '@/src/client/mock/cohorts/cohortCatalog';
import { LessonStatus, LessonType, SeasonStatus } from '@/src/client/components/screens/cohort/models';

const LOCAL_STORAGE_KEY = 'sidequest_published_cohorts';

function loadStoredCohorts(): Cohort[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Cohort[];
  } catch {
    return [];
  }
}

function saveStoredCohorts(cohorts: Cohort[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cohorts));
  } catch (err) {
    console.error('Failed to save cohort to localStorage', err);
  }
}

class CohortStore {
  private userCohorts: Cohort[] = [];

  constructor() {
    this.userCohorts = loadStoredCohorts();
  }

  public getAll(): Cohort[] {
    if (typeof window !== 'undefined' && this.userCohorts.length === 0) {
      this.userCohorts = loadStoredCohorts();
    }
    return [...this.userCohorts, ...cohortCatalog];
  }

  public getById(id: string): Cohort | undefined {
    // Always reload from localStorage to ensure fresh data on client
    if (typeof window !== 'undefined') {
      this.userCohorts = loadStoredCohorts();
    }
    const all = [...this.userCohorts, ...cohortCatalog];
    return all.find((c) => c.id === id);
  }

  public registerPublishedCohort(data: {
    cohortId: string;
    title: string;
    description: string;
    coverImage: string;
    difficulty: Cohort['difficulty'];
    visibility: string;
    curriculum: any;
    onboarding?: any;
  }): Cohort {
    // CRITICAL: Must use data.cohortId directly so /cohort/[cohortId] matches!
    const targetId = data.cohortId || `cohort-${Date.now().toString(36)}`;

    const template = cohortCatalog[0];

    const lessonsList: any[] = [];
    const seasonsList = (data.curriculum?.seasons || []).map((s: any, sIdx: number) => {
      const seasonLessons = (s.lessons || []).map((l: any, lIdx: number) => {
        lessonsList.push(l);
        return {
          id: l.id || `lesson-${sIdx}-${lIdx}`,
          title: l.title,
          type: LessonType.Video,
          duration: l.duration || '12 min',
          status: lIdx === 0 ? LessonStatus.InStream : LessonStatus.Ready,
          totalChunks: l.chunkCount || 4,
          completedChunks: 0,
          thumbnail: l.thumbnail || (l.videoId ? `https://i.ytimg.com/vi/${l.videoId}/hqdefault.jpg` : data.coverImage) || '/mock/thumbnails/docker.avif',
        };
      });

      return {
        id: s.id || `season-${sIdx}`,
        badge: `Season ${sIdx + 1}`,
        title: s.title,
        status: sIdx === 0 ? SeasonStatus.InProgress : SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: s.estimatedDuration || '~5 hrs',
        questCount: s.lessons?.length || seasonLessons.length,
        summaryLabel: 'View Season Summary',
        lessons: seasonLessons,
      };
    });

    const coverArt = data.coverImage || '/mock/thumbnails/docker.avif';

    const newCohort: Cohort = {
      ...template,
      id: targetId,
      title: data.title,
      subtitle: data.onboarding?.welcomeMessage || `Interactive learning journey on SideQuestHQ`,
      description: data.description || `Master ${data.title} through hands-on quests and practice.`,
      coverImage: coverArt,
      difficulty: data.difficulty || 'Intermediate',
      categories: [{ id: 'programming', label: 'Programming' }],
      creator: {
        id: 'creator-user',
        name: 'Shaqun',
        avatarUrl: '/mock/avatars/a.webp',
        role: 'Quest Guide',
        bio: 'Building interactive learning cohorts on SideQuestHQ.',
        ctaLabel: 'View Quest Guide Profile',
      },
      stats: {
        rating: 5.0,
        explorerCount: 1,
        completionRate: 0,
      },
      progress: {
        journeyProgress: 0,
        completedQuests: 0,
        totalQuests: lessonsList.length || 0,
        dailyGoal: data.onboarding?.recommendedDailyGoal || '20 minutes of daily practice',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      },
      overview: {
        description: data.description || `${data.title} helps learners master skills through step-by-step quests and practical projects.`,
        pillars: [
          { id: 'p1', icon: 'target', title: 'Core Mastery', description: `Understand fundamental concepts in ${data.title}.` },
          { id: 'p2', icon: 'brain', title: 'Practical Quests', description: 'Apply knowledge by building real artifacts.' },
          { id: 'p3', icon: 'project', title: 'Capstone Project', description: 'Ship a full project to showcase your skill.' },
        ],
        learningObjectives: [
          { id: 'lo-1', text: `Master core principles of ${data.title}` },
          { id: 'lo-2', text: 'Build production-ready code and artifacts' },
          { id: 'lo-3', text: 'Complete hands-on assignments and quizzes' },
        ],
        journeySummary: [
          { id: 'js-1', icon: 'target', label: 'Quest Length', value: `${data.curriculum?.totalHours || '12 hours'}` },
          { id: 'js-2', icon: 'target', label: 'Quests', value: `${lessonsList.length || 0} quests` },
          { id: 'js-3', icon: 'target', label: 'Seasons', value: `${seasonsList.length || 0} seasons` },
        ],
        expeditionStats: [
          { id: 'es-1', icon: 'target', label: 'Lessons', value: `${lessonsList.length || 0}` },
          { id: 'es-2', icon: 'target', label: 'Seasons', value: `${seasonsList.length || 0}` },
          { id: 'es-3', icon: 'target', label: 'Assignments', value: '0' },
          { id: 'es-4', icon: 'target', label: 'Estimated Completion', value: '2–4 weeks' },
        ],
        expeditionProgress: [
          { id: 'ep-1', icon: 'target', label: 'Current Streak', value: '0 days' },
          { id: 'ep-2', icon: 'target', label: 'Total Time Invested', value: '0h 0m' },
        ],
        activeExplorers: ['/mock/avatars/a.webp'],
        activeExplorerOverflow: '',
      },
      questline: {
        ...template.questline,
        title: `${data.title} Questline`,
        description: data.description || `Complete hands-on quests for ${data.title}.`,
        filters: template.questline.filters,
        seasons: seasonsList.length > 0 ? seasonsList : template.questline.seasons,
        feedTitle: `${data.title} Assignments`,
        feedDescription: `Ship artifacts that prove your ${data.title} skills.`,
        assignmentFeed: [],
      },
      // Events, Archives, and Hall of Fame are EMPTY by default for new cohorts
      events: {
        title: 'Upcoming Sessions',
        description: `No events scheduled yet. Check back soon!`,
        filters: template.events.filters,
        upcomingEvents: [],
        weeklySchedule: [],
        calendarSync: template.events.calendarSync,
        suggestEvent: {
          title: 'Suggest an Event',
          description: `Have an idea for a ${data.title} session?`,
          buttonLabel: 'Suggest Event',
          illustration: '📝',
        },
      },
      archives: {
        title: 'Community Archives',
        description: `No archives yet. Be the first to share knowledge!`,
        categories: template.archives.categories,
        sortControls: template.archives.sortControls,
        items: [],
        contributors: [],
        trending: [],
        shareKnowledge: {
          title: 'Share your knowledge!',
          description: `Publish a resource for ${data.title}.`,
          buttonLabel: 'Create Note',
          illustration: '🧾',
        },
      },
      hallOfFame: {
        title: 'Hall of Fame',
        subtitle: `No legends yet. Be the first to earn your place!`,
        filters: template.hallOfFame.filters,
        timeRanges: template.hallOfFame.timeRanges,
        categories: template.hallOfFame.categories.map((c) => ({
          ...c,
          winner: undefined as any,
          primaryMetric: '—',
        })),
        legends: [],
        userHighlights: template.hallOfFame.userHighlights,
        recentAchievements: [],
      },
    };

    // Remove any previous cohort with same ID and prepend
    this.userCohorts = [newCohort, ...this.userCohorts.filter((c) => c.id !== targetId)];
    saveStoredCohorts(this.userCohorts);

    return newCohort;
  }
}

export const cohortStore = new CohortStore();

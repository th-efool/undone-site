import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortCatalog } from '@/src/client/mock/cohorts/cohortCatalog';
import { LessonStatus, LessonType, SeasonStatus, ArchiveType, EventStatus } from '@/src/client/components/screens/cohort/models';

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
    const all = this.getAll();
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
    const baseId = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const uniqueId = `${baseId || 'cohort'}-${Date.now().toString(36)}`;

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
          thumbnail: l.thumbnail || data.coverImage,
        };
      });

      return {
        id: s.id || `season-${sIdx}`,
        badge: `Season ${sIdx + 1}`,
        title: s.title,
        status: sIdx === 0 ? SeasonStatus.InProgress : SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: s.estimatedDuration || '~5 hrs',
        questCount: s.lessons?.length || 0,
        summaryLabel: 'View Season Summary',
        lessons: seasonLessons,
      };
    });

    const newCohort: Cohort = {
      ...template,
      id: uniqueId,
      title: data.title,
      subtitle: data.onboarding?.welcomeMessage || `A learning journey by SideQuestHQ`,
      description: data.description,
      coverImage: data.coverImage,
      difficulty: data.difficulty || 'Intermediate',
      categories: [{ id: 'programming', label: 'Programming' }],
      creator: {
        id: 'creator-user',
        name: 'Shaqun',
        avatarUrl: '/mock/avatars/a.webp',
        role: 'Cohort Creator',
        bio: 'Creator on SideQuestHQ building interactive learning journeys.',
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
        totalQuests: lessonsList.length,
        dailyGoal: data.onboarding?.recommendedDailyGoal || '20 minutes of practice',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      },
      overview: {
        ...template.overview,
        description: data.description,
        activeExplorers: ['/mock/avatars/a.webp'],
        activeExplorerOverflow: '+1',
      },
      questline: {
        ...template.questline,
        title: `${data.title} Questline`,
        description: data.description,
        seasons: seasonsList.length > 0 ? seasonsList : template.questline.seasons,
      },
    };

    this.userCohorts = [newCohort, ...this.userCohorts];
    saveStoredCohorts(this.userCohorts);

    return newCohort;
  }
}

export const cohortStore = new CohortStore();

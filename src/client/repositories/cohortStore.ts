import type { Cohort } from '@/src/client/screens/cohort/models';
import { LessonStatus, LessonType, SeasonStatus } from '@/src/client/screens/cohort/models';
import { isNativeApp } from '@/src/client/utils/isNative';
import { storageAdapter } from './storageAdapter';
import { getAvatar, getAvatarSlice } from '@/src/client/mock/avatars';

function loadStoredCohorts(): Cohort[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = storageAdapter.getStoredCohorts();
    return parsed;
  } catch {
    return [];
  }
}

function saveStoredCohorts(cohorts: Cohort[]) {
  if (typeof window === 'undefined') return;
  storageAdapter.saveStoredCohorts(cohorts);
}

function parseDurationToSeconds(val: string): number {
  if (!val) return 180;
  const hoursMatch = val.match(/(\d+)\s*h/i);
  const minsMatch = val.match(/(\d+)\s*m/i);
  const secsMatch = val.match(/(\d+)\s*s/i);
  let total = 0;
  if (hoursMatch) total += Number(hoursMatch[1]) * 3600;
  if (minsMatch) total += Number(minsMatch[1]) * 60;
  if (secsMatch) total += Number(secsMatch[1]);
  if (total === 0) {
    const num = Number(val.match(/\d+/)?.[0]);
    if (!isNaN(num)) total = num * 60;
  }
  return total || 180;
}

function formatSecs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    return [...this.userCohorts];
  }

  public getUserCohorts(): Cohort[] {
    if (typeof window !== 'undefined' && this.userCohorts.length === 0) {
      this.userCohorts = loadStoredCohorts();
    }
    return [...this.userCohorts];
  }

  public getById(id: string): Cohort | undefined {
    return this.getAll().find((c) => c.id === id);
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


    const lessonsList: any[] = [];
    const seasonsList = (data.curriculum?.seasons || []).map((s: any, sIdx: number) => {
      const seasonLessons = (s.lessons || []).map((l: any, lIdx: number) => {
        lessonsList.push(l);
        const videoId = l.videoId;
        const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined;

        let currentSec = 0;
        const rawChunks =
          l.chunks && l.chunks.length > 0
            ? l.chunks
            : Array.from({ length: l.chunkCount || 4 }, (_, cIdx) => ({
                id: `chunk-${sIdx}-${lIdx}-${cIdx + 1}`,
                title: `Part ${cIdx + 1}`,
                duration: '3 min',
                order: cIdx + 1,
              }));

        const chunksList = rawChunks.map((c: any, cIdx: number) => {
          const durSecs = parseDurationToSeconds(c.duration || '3 min');
          const startSecs = currentSec;
          const endSecs = startSecs + durSecs;
          currentSec = endSecs;

          const startFormatted = formatSecs(startSecs);
          const endFormatted = formatSecs(endSecs);
          const timestampUrl = videoId
            ? `https://www.youtube.com/watch?v=${videoId}&t=${startSecs}s`
            : undefined;

          return {
            id: c.id || `chunk-${sIdx}-${lIdx}-${cIdx + 1}`,
            title: c.title || `Part ${cIdx + 1}`,
            duration: c.duration || '3 min',
            order: cIdx + 1,
            startSeconds: startSecs,
            endSeconds: endSecs,
            timeRangeLabel: `${startFormatted} – ${endFormatted}`,
            timestampUrl,
          };
        });

        return {
          id: l.id || `lesson-${sIdx}-${lIdx}`,
          title: l.title,
          type: LessonType.Video,
          duration: l.duration || '12 min',
          status: lIdx === 0 ? LessonStatus.InStream : LessonStatus.Ready,
          totalChunks: chunksList.length,
          completedChunks: 0,
          thumbnail:
            l.thumbnail ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : data.coverImage) ||
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop',
          videoId,
          videoUrl,
          chunks: chunksList,
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
        avatarUrl: getAvatar('shaqun'),
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
        activeExplorers: getAvatarSlice(3, 2),
        activeExplorerOverflow: '',
      },
      questline: {
        title: `${data.title} Questline`,
        description: data.description || `Complete hands-on quests for ${data.title}.`,
        filters: [{ id: 'all', label: 'All Quests' }],
        skipSeasonLabel: 'Skip Season',
        seasons: seasonsList.length > 0 ? seasonsList : [],
        feedTitle: `${data.title} Assignments`,
        feedDescription: `Ship artifacts that prove your ${data.title} skills.`,
        feedSeasonLabel: 'View Season',
        feedViewAllLabel: 'View All Assignments',
        assignmentFeed: [],
        lockedFutureNotice: {
          icon: 'target',
          title: 'More Quests Coming Soon',
          description: 'Stay tuned for more quests in this cohort.',
        }
      },
      events: {
        title: 'Upcoming Sessions',
        description: `No events scheduled yet. Check back soon!`,
        filters: [{ id: 'all', label: 'All Events' }],
        upcomingEvents: [],
        weeklySchedule: [],
        calendarSync: [
          { id: 'google', label: 'Google Calendar', icon: 'google' },
          { id: 'apple', label: 'Apple Calendar', icon: 'apple' },
          { id: 'outlook', label: 'Outlook', icon: 'outlook' },
        ],
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
        categories: [{ id: 'all', label: 'All Resources' }],
        sortControls: [{ id: 'recent', label: 'Most Recent' }],
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
        filters: [{ id: 'all', label: 'All Time' }],
        timeRanges: [{ id: 'all', label: 'All Time' }],
        categories: [],
        legends: [],
        userHighlights: [],
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

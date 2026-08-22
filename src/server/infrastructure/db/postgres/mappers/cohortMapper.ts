import type { Cohort as DbCohort, Season, Lesson } from '@/generated/prisma';
import { SeasonStatus, LessonStatus, LessonType, type Cohort as UiCohort } from '@/src/client/screens/cohort/models';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function mapDbCohortToUiCohort(dbCohort: any): UiCohort {
  const totalQuests = (dbCohort.seasons || []).reduce((acc: number, s: any) => acc + (s.lessons?.length || 0), 0);
  const categories = (dbCohort.categories || []).map((cat: string, idx: number) => ({
    id: `cat-${idx}`,
    label: cat,
  }));

  const learningObjectives = (dbCohort.learningOutcomes || []).length > 0
    ? dbCohort.learningOutcomes.map((text: string, idx: number) => ({ id: `obj-${idx}`, text }))
    : [
        { id: 'obj-default-1', text: 'Master core concepts through structured seasons' },
        { id: 'obj-default-2', text: 'Complete hands-on quest lessons and projects' },
      ];

  const journeySummary = (dbCohort.requirements || []).length > 0
    ? dbCohort.requirements.map((req: string, idx: number) => ({
        id: `req-${idx}`,
        icon: 'target' as const,
        label: `Requirement ${idx + 1}`,
        value: req,
      }))
    : [
        { id: 'js-1', icon: 'compass' as const, label: 'Prerequisites', value: 'Open to all learners' },
        { id: 'js-2', icon: 'clock' as const, label: 'Commitment', value: dbCohort.estimatedCompletionTime || 'Self-paced' },
      ];

  const expeditionStats = [
    { id: 'es-1', icon: 'lesson' as const, label: 'Total Quests', value: `${totalQuests}` },
    { id: 'es-2', icon: 'book' as const, label: 'Seasons', value: `${dbCohort.seasons?.length || 0}` },
    { id: 'es-3', icon: 'clock' as const, label: 'Pacing', value: dbCohort.estimatedCompletionTime || 'Self-paced' },
    { id: 'es-4', icon: 'brain' as const, label: 'Language', value: dbCohort.language || 'English' },
  ];

  return {
    id: dbCohort.id,
    title: dbCohort.title || 'Untitled Cohort',
    subtitle: dbCohort.subtitle || '',
    description: dbCohort.description || '',
    coverImage: dbCohort.coverImage || '/images/landing/screen.webp',
    difficulty: dbCohort.difficulty || 'BEGINNER',
    categories,
    creator: {
      id: dbCohort.creator?.id || 'creator-unknown',
      name: dbCohort.creator?.name || 'SideQuest Guide',
      avatarUrl: dbCohort.creator?.image || '/mock/avatars/a.webp',
      role: dbCohort.creator?.role || 'Creator',
      bio: dbCohort.creator?.bio || 'Cohort Creator & Community Guide',
      ctaLabel: 'View Profile',
    },
    stats: { rating: 5, explorerCount: 0, completionRate: 0 },
    progress: {
      journeyProgress: 0,
      completedQuests: 0,
      totalQuests,
      dailyGoal: '30 mins/day',
      joinedDate: 'Joined recently',
    },
    overview: {
      description: dbCohort.description || 'Welcome to this cohort journey.',
      pillars: [
        { id: 'p1', icon: 'compass' as const, title: 'Structured Progression', description: 'Step-by-step quest structure designed for mastery.' },
        { id: 'p2', icon: 'brain' as const, title: 'Interactive Learning', description: 'Real-world lessons and verified source material.' },
        { id: 'p3', icon: 'target' as const, title: 'Community Driven', description: 'Collaborate and learn alongside fellow explorers.' },
      ],
      learningObjectives,
      journeySummary,
      expeditionStats,
      expeditionProgress: [],
      activeExplorers: [],
      activeExplorerOverflow: '',
    },
    questline: {
      title: `${dbCohort.title || 'Cohort'} Questline`,
      description: dbCohort.subtitle || 'Explore all seasons and quests in this cohort.',
      filters: [],
      skipSeasonLabel: 'Skip Season',
      seasons: (dbCohort.seasons || []).map((s: any, sIdx: number) => ({
        id: s.id,
        title: s.title || `Season ${sIdx + 1}`,
        badge: `Season ${s.order || sIdx + 1}`,
        status: sIdx === 0 ? SeasonStatus.InProgress : SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: '',
        questCount: s.lessons?.length || 0,
        summaryLabel: `${s.lessons?.length || 0} Lessons`,
        lessons: (s.lessons || []).map((l: any, lIdx: number) => {
          let chunks = Array.isArray(l.chunks) && l.chunks.length > 0 ? l.chunks : [];
          
          if (chunks.length === 0) {
            const durationSecs = l.duration || 0;
            const chunkInterval = 300; // 5 mins
            if (durationSecs > 0) {
              for (let i = 0; i < durationSecs; i += chunkInterval) {
                const start = i;
                const end = Math.min(i + chunkInterval, durationSecs);
                const partDurationSecs = end - start;
                chunks.push({
                  id: `chunk-${l.id}-${i}`,
                  title: `Part ${chunks.length + 1}`,
                  duration: `${Math.ceil(partDurationSecs / 60)}m`,
                  order: chunks.length + 1,
                  startSeconds: start,
                  endSeconds: end,
                  timeRangeLabel: `${formatTime(start)} - ${formatTime(end)}`,
                  isCompleted: false,
                  completionDate: null,
                });
              }
            }
          } else {
             // Map DB chunks to UI chunks
             chunks = chunks.map((c: any) => ({
                ...c,
                startSeconds: c.startSeconds || 0,
                endSeconds: c.endSeconds || 0,
                timeRangeLabel: c.timeRangeLabel || '',
                isCompleted: false,
                completionDate: null,
             }));
          }

          const isArticle = (l as any).lessonType === 'ARTICLE';

          return {
            id: l.id,
            title: l.title || `Lesson ${lIdx + 1}`,
            type: isArticle ? LessonType.Reading : LessonType.Video,
            duration: l.duration ? `${Math.ceil(l.duration / 60)}m` : '0m',
            status: sIdx === 0 && lIdx === 0 ? LessonStatus.InStream : LessonStatus.Ready,
            totalChunks: chunks.length || 1,
            completedChunks: 0,
            thumbnail: l.thumbnailUrl || '/mock/thumbnails/docker.avif',
            videoId: isArticle ? undefined : (l.videoId || l.videoUrl || ''),
            videoUrl: isArticle ? undefined : (l.videoUrl || ''),
            sourceUrl: (l as any).sourceUrl || (isArticle ? l.videoUrl : undefined),
            chunks,
          };
        }),
      })),
      feedTitle: 'Cohort Assignments',
      feedDescription: 'Complete these assignments to gain XP and unlock the next seasons.',
      feedSeasonLabel: 'Current Season',
      feedViewAllLabel: 'View All Assignments',
      assignmentFeed: [],
      lockedFutureNotice: { icon: 'book', title: 'More Quests Ahead', description: 'Complete the current season to unlock.' },
    },
    events: {
      title: 'Cohort Events',
      description: 'Join live sessions, AMAs, and study groups.',
      filters: [{ id: 'all', label: 'All Events', active: true }],
      upcomingEvents: [],
      weeklySchedule: [],
      calendarSync: [],
      suggestEvent: { title: 'Host an Event', description: 'Want to host a study group?', buttonLabel: 'Suggest Event', illustration: '' },
    },
    archives: {
      title: 'Knowledge Archives',
      description: 'Explore shared resources, notes, and community knowledge.',
      categories: [{ id: 'all', label: 'All Resources', active: true }],
      sortControls: [{ id: 'recent', label: 'Recently Added' }],
      items: [],
      contributors: [],
      trending: [],
      shareKnowledge: { title: 'Share Knowledge', description: 'Got a helpful resource?', buttonLabel: 'Contribute', illustration: '' },
    },
    hallOfFame: {
      title: 'Hall of Fame',
      subtitle: 'Celebrating the top explorers in this cohort.',
      filters: [{ id: 'all', label: 'All Categories', active: true }],
      timeRanges: [{ id: 'all-time', label: 'All Time', active: true }],
      categories: [{ id: 'cat-1', title: 'Top Contributors', subtitle: 'Most helpful members', rank: 1, winner: { name: 'Sia', avatarUrl: '/mock/avatars/sia.avif' }, primaryMetric: '100 XP', growthMetric: '+10%', badge: 'top-contributor', accent: 'amber' }],
      legends: [],
      userHighlights: [],
      recentAchievements: [],
    },
  };
}

/**
 * Feed Cohorts — Real YouTube video & playlist data for DSA, Operating Systems, and Networking.
 * Fully structured with videoId, videoUrl, and chunk startSeconds / endSeconds / timestampUrl.
 */

import {
  ArchiveType,
  EventStatus,
  LessonStatus,
  LessonType,
  SeasonStatus,
} from '@/src/client/components/screens/cohort/models';
import type { Cohort, Lesson, Season, LessonChunk } from '@/src/client/components/screens/cohort/models';
import { cohortMock as deepWorkMastery } from '@/src/client/components/screens/cohort/mocks/cohortMock';

import { ALL_MOCK_AVATARS, getAvatar } from '@/src/client/mock/avatars';

const avatars = ALL_MOCK_AVATARS;

function formatSecs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildChunks(lessonId: string, videoId: string, durationSecs: number, chunkSecs: number = 300): LessonChunk[] {
  const count = Math.max(1, Math.ceil(durationSecs / chunkSecs));
  return Array.from({ length: count }, (_, i) => {
    const startSecs = i * chunkSecs;
    const endSecs = Math.min(durationSecs, (i + 1) * chunkSecs);
    const chunkDurMins = Math.max(1, Math.round((endSecs - startSecs) / 60));
    return {
      id: `${lessonId}-chunk-${i + 1}`,
      title: `Part ${i + 1}`,
      duration: `${chunkDurMins}m`,
      order: i + 1,
      startSeconds: startSecs,
      endSeconds: endSecs,
      timeRangeLabel: `${formatSecs(startSecs)} – ${formatSecs(endSecs)}`,
      timestampUrl: `https://www.youtube.com/watch?v=${videoId}&t=${startSecs}s`,
    };
  });
}

function buildVideoLesson(
  lessonId: string,
  title: string,
  videoId: string,
  durationStr: string,
  durationSecs: number,
  status: LessonStatus,
  thumbnail: string,
  chunkSecs: number = 300
): Lesson {
  const chunksList = buildChunks(lessonId, videoId, durationSecs, chunkSecs);
  const completedChunks = status === LessonStatus.Completed ? chunksList.length : status === LessonStatus.InStream ? 1 : 0;
  return {
    id: lessonId,
    title,
    type: LessonType.Video,
    duration: durationStr,
    status,
    totalChunks: chunksList.length,
    completedChunks,
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    chunks: chunksList,
  };
}

// ═══════════════════════════════════════════════════════════════
// COHORT 1: DSA — Only What's Needed
// ═══════════════════════════════════════════════════════════════

const dsaLessonsSeason1: Lesson[] = [
  buildVideoLesson(
    'dsa-1',
    'Best Data Structures & Algorithms (DSA) Course - Clear Any FAANG Interview!',
    'rZ41y93P2Qo',
    '16 min',
    980,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-2',
    'Java vs C++ for Data Structures & Algorithms',
    'Nckx9qMy_kw',
    '11 min',
    675,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/Nckx9qMy_kw/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-3',
    'How I Cleared My Google Interviews - Use LeetCode Effectively!',
    'waGfV-IoOt8',
    '15 min',
    944,
    LessonStatus.InStream,
    'https://i.ytimg.com/vi/waGfV-IoOt8/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-4',
    'Introduction to Arrays and ArrayList in Java - Memory Management & Operations',
    'n60Dn0UsbEk',
    '1h 45m',
    6353,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/n60Dn0UsbEk/maxresdefault.jpg'
  ),
];

const dsaLessonsSeason2: Lesson[] = [
  buildVideoLesson(
    'dsa-5',
    'Linear Search Algorithm - Theory + Code + Questions',
    '_HRA37X8N_Q',
    '1h 15m',
    4544,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/_HRA37X8N_Q/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-6',
    'Binary Search Algorithm - Theory + Code',
    'f6UU7V3szVw',
    '58 min',
    3496,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/f6UU7V3szVw/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-7',
    'Time and Space Complexity COMPLETE Tutorial - What is Big O?',
    'mV3wrLBbuuE',
    '2h 28m',
    8904,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/mV3wrLBbuuE/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-8',
    'Bitwise Operators + Number Systems - Maths for DSA',
    'fzip9Aml6og',
    '2h 17m',
    8229,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/fzip9Aml6og/maxresdefault.jpg'
  ),
  buildVideoLesson(
    'dsa-9',
    'Linked List Interview Questions - Google, Facebook, Amazon, Microsoft',
    '70tx7KcMROc',
    '3h 08m',
    11291,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/70tx7KcMROc/maxresdefault.jpg'
  ),
];

export const dsaCohort: Cohort = {
  ...deepWorkMastery,
  id: 'dsa-only-whats-needed',
  title: "DSA — Only What's Needed",
  subtitle: 'Master data structures & algorithms for interviews without the fluff.',
  description: "A focused DSA curriculum from Kunal Kushwaha's playlists covering arrays, linked lists, trees, graphs, DP, and common interview patterns.",
  coverImage: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
  difficulty: 'Intermediate',
  categories: [
    { id: 'programming', label: 'Programming' },
    { id: 'dsa', label: 'DSA' },
    { id: 'interviews', label: 'Interviews' },
  ],
  creator: {
    id: 'kunal-kushwaha',
    name: 'Kunal Kushwaha',
    avatarUrl: getAvatar('kunal-kushwaha'),
    role: 'DSA Educator',
    bio: 'Teaching DSA and interview prep through hands-on Java programming.',
    ctaLabel: 'View Quest Guide Profile',
  },
  stats: { rating: 4.9, explorerCount: 8400, completionRate: 61 },
  progress: {
    journeyProgress: 25,
    completedQuests: 2,
    totalQuests: 9,
    dailyGoal: '20 minutes of DSA practice',
    joinedDate: 'July 15, 2026',
  },
  overview: {
    ...deepWorkMastery.overview,
    description: "DSA — Only What's Needed helps learners master data structures & algorithms through practical quests, focused code drills, and interview preparation.",
    pillars: [
      { id: 'p1', icon: 'target', title: 'Array & Search Patterns', description: 'Master binary search, two pointers, and sliding window.' },
      { id: 'p2', icon: 'brain', title: 'Linked Lists & Trees', description: 'Understand pointer manipulations and tree traversals.' },
      { id: 'p3', icon: 'project', title: 'Interview Capstone', description: 'Solve real FAANG interview questions with optimal time complexity.' },
    ],
    learningObjectives: [
      { id: 'lo-1', text: 'Master Array, Search, and Sorting algorithms' },
      { id: 'lo-2', text: 'Master Linked Lists, Stacks, Queues, and Trees' },
      { id: 'lo-3', text: 'Analyze Big-O Time & Space Complexity confidently' },
    ],
  },
  questline: {
    ...deepWorkMastery.questline,
    title: "DSA — Only What's Needed Questline",
    description: 'Complete hands-on quests for core data structures and algorithms.',
    seasons: [
      {
        id: 'dsa-season-1',
        badge: 'Season 1',
        title: 'Foundations & Array Searching',
        status: SeasonStatus.InProgress,
        progress: 50,
        estimatedDuration: '~3 hrs',
        questCount: dsaLessonsSeason1.length,
        summaryLabel: 'View Season Summary',
        lessons: dsaLessonsSeason1,
      },
      {
        id: 'dsa-season-2',
        badge: 'Season 2',
        title: 'Algorithms & Advanced Data Structures',
        status: SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: '~9 hrs',
        questCount: dsaLessonsSeason2.length,
        summaryLabel: 'View Season Summary',
        lessons: dsaLessonsSeason2,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// COHORT 2: Operating Systems
// ═══════════════════════════════════════════════════════════════

const osLessonsSeason1: Lesson[] = [
  buildVideoLesson(
    'os-1',
    'Complete Operating Systems in 1 Shot (With Notes) || For Placement Interviews',
    '3obEP8eLsCw',
    '15h 33m',
    55988,
    LessonStatus.InStream,
    'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
    600 // 10 min chunks
  ),
  buildVideoLesson(
    'os-2',
    'Complete Interview Questions OS in One Shot | Placement Revision | Operating System',
    'h8J7X1cEG4E',
    '50 min',
    3017,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/h8J7X1cEG4E/maxresdefault.jpg',
    300
  ),
];

export const osCohort: Cohort = {
  ...deepWorkMastery,
  id: 'operating-systems-core',
  title: 'Operating Systems',
  subtitle: 'Understand how your computer actually works under the hood.',
  description: 'Two comprehensive OS video courses covering processes, threads, memory management, file systems, scheduling, deadlocks, and real interview questions.',
  coverImage: 'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
  difficulty: 'Intermediate',
  categories: [
    { id: 'cs', label: 'Computer Science' },
    { id: 'os', label: 'Operating Systems' },
    { id: 'interviews', label: 'Interviews' },
  ],
  creator: {
    id: 'codehelp-babbar',
    name: 'CodeHelp - by Babbar',
    avatarUrl: getAvatar('codehelp-babbar'),
    role: 'CS Faculty',
    bio: 'Making complex CS concepts easy for placement preparation.',
    ctaLabel: 'View Quest Guide Profile',
  },
  stats: { rating: 4.7, explorerCount: 5600, completionRate: 58 },
  progress: {
    journeyProgress: 10,
    completedQuests: 0,
    totalQuests: 2,
    dailyGoal: '15 minutes of OS review',
    joinedDate: 'July 20, 2026',
  },
  overview: {
    ...deepWorkMastery.overview,
    description: 'Operating Systems helps learners master OS internals including CPU scheduling, memory virtualisation, concurrency, file systems, and interview questions.',
    pillars: [
      { id: 'p1', icon: 'target', title: 'Process & Threads', description: 'Understand process scheduling, context switching, and multithreading.' },
      { id: 'p2', icon: 'brain', title: 'Memory & Virtualization', description: 'Master paging, segmentation, and virtual memory management.' },
      { id: 'p3', icon: 'project', title: 'Deadlocks & Storage', description: 'Understand synchronization primitives, deadlocks, and file systems.' },
    ],
  },
  questline: {
    ...deepWorkMastery.questline,
    title: 'Operating Systems Questline',
    description: 'Complete hands-on quests for operating system internals and interview preparation.',
    seasons: [
      {
        id: 'os-season-1',
        badge: 'Season 1',
        title: 'OS Full Course & Placement Interview Questions',
        status: SeasonStatus.InProgress,
        progress: 10,
        estimatedDuration: '~16 hrs',
        questCount: osLessonsSeason1.length,
        summaryLabel: 'View Season Summary',
        lessons: osLessonsSeason1,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// COHORT 3: Networking
// ═══════════════════════════════════════════════════════════════

const networkingLessonsSeason1: Lesson[] = [
  buildVideoLesson(
    'net-1',
    'Top Network Engineer Interview Questions and Answers for 2025 | Atul Sharma',
    'nGvpClgugEI',
    '11h 44m',
    42252,
    LessonStatus.InStream,
    'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
    600
  ),
  buildVideoLesson(
    'net-2',
    'Top 20 Networking Interview Questions And Answers 2026 | Simplilearn',
    'e8TvhTCVCEo',
    '59 min',
    3551,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/e8TvhTCVCEo/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'net-3',
    'Day-1 | Top 100 Most Asked Network Engineer Interview Questions and Answers',
    '0DlOCy0OOzU',
    '18 min',
    1117,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/0DlOCy0OOzU/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'net-4',
    'Day-2 | Top 100 Most Asked Network Engineer Interview Questions and Answers',
    'QUxWQKgu8n4',
    '14 min',
    872,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/QUxWQKgu8n4/maxresdefault.jpg',
    300
  ),
];

export const networkingCohort: Cohort = {
  ...deepWorkMastery,
  id: 'networking-fundamentals',
  title: 'Networking',
  subtitle: 'Learn networking from packets to protocols to interview prep.',
  description: 'A complete networking curriculum covering OSI model, TCP/IP, DNS, HTTP, load balancing, CDNs, and common networking interview questions.',
  coverImage: 'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
  difficulty: 'Intermediate',
  categories: [
    { id: 'cs', label: 'Computer Science' },
    { id: 'networking', label: 'Networking' },
    { id: 'interviews', label: 'Interviews' },
  ],
  creator: {
    id: 'network-kings',
    name: 'Network Kings',
    avatarUrl: getAvatar('network-kings'),
    role: 'Networking Educators',
    bio: 'Helping engineers master networking concepts and ace interviews.',
    ctaLabel: 'View Quest Guide Profile',
  },
  stats: { rating: 4.8, explorerCount: 4200, completionRate: 64 },
  progress: {
    journeyProgress: 12,
    completedQuests: 0,
    totalQuests: 4,
    dailyGoal: '15 minutes of networking study',
    joinedDate: 'July 22, 2026',
  },
  overview: {
    ...deepWorkMastery.overview,
    description: 'Networking helps learners master computer networks, OSI layers, TCP/IP protocols, DNS resolution, HTTP/HTTPS, and real-world networking questions.',
    pillars: [
      { id: 'p1', icon: 'target', title: 'OSI Model & Layers', description: 'Understand physical to application layer data encapulation.' },
      { id: 'p2', icon: 'brain', title: 'TCP/IP & Routing', description: 'Master IP addressing, subnetting, TCP 3-way handshake, and routing.' },
      { id: 'p3', icon: 'project', title: 'Web Protocols & Security', description: 'Deep dive into DNS, HTTP/1/2/3, TLS/SSL, and load balancing.' },
    ],
  },
  questline: {
    ...deepWorkMastery.questline,
    title: 'Networking Questline',
    description: 'Complete hands-on quests for computer networking fundamentals and interview preparation.',
    seasons: [
      {
        id: 'net-season-1',
        badge: 'Season 1',
        title: 'Networking Protocols & Interview Questions',
        status: SeasonStatus.InProgress,
        progress: 12,
        estimatedDuration: '~14 hrs',
        questCount: networkingLessonsSeason1.length,
        summaryLabel: 'View Season Summary',
        lessons: networkingLessonsSeason1,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// COHORT 4: Celtic Mythology (Real 12-Episode Playlist by See U in History)
// ═══════════════════════════════════════════════════════════════

const celticLessonsSeason1: Lesson[] = [
  buildVideoLesson(
    'celtic-1',
    'Celtic Mythology: The Invasion of Ireland - Part 1/2 - The Battle of Moytura',
    'hMP_V2WWl3s',
    '14 min',
    840,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/hMP_V2WWl3s/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-2',
    'Celtic Mythology: The Battle for Ireland - Part 2/2 - The Battle of Moytura',
    'Uvnbikstp-w',
    '15 min',
    900,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/Uvnbikstp-w/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-3',
    'Brigid - The Celtic Goddess of Flames - Celtic Mythology and Folklore',
    'DykKYj4WVjE',
    '12 min',
    720,
    LessonStatus.InStream,
    'https://i.ytimg.com/vi/DykKYj4WVjE/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-4',
    'Cernunnos: The Celtic God of Forests - Celtic Mythology and Folklore',
    '3FB6VpcxGg8',
    '11 min',
    660,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/3FB6VpcxGg8/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-5',
    'Dagda: The Mighty Celtic God of Abundance - Celtic Mythology and Folklore',
    'Ru2bTBigJlc',
    '13 min',
    780,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/Ru2bTBigJlc/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-6',
    'Lugh - The Irish God of Light - Celtic Mythology',
    'wCW-iiZp3aw',
    '14 min',
    840,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/wCW-iiZp3aw/maxresdefault.jpg',
    300
  ),
];

const celticLessonsSeason2: Lesson[] = [
  buildVideoLesson(
    'celtic-7',
    'Nuada - The Celtic God of the Silver Arm',
    '8tZlnYgZx0c',
    '10 min',
    600,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/8tZlnYgZx0c/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-8',
    'The Return of the King - The Fomorians War - Ep 1 - Irish Mythology',
    'jc4ENOvvyeU',
    '16 min',
    960,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/jc4ENOvvyeU/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-9',
    'The War Approaches - The Fomorians War - Ep 2 - Irish Mythology',
    'sB292mees4Q',
    '15 min',
    900,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/sB292mees4Q/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-10',
    'The Fomorians War - Ep 3 - Irish Mythology',
    'GGRVondbc5g',
    '18 min',
    1080,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/GGRVondbc5g/maxresdefault.jpg',
    300
  ),
  buildVideoLesson(
    'celtic-11',
    'Celtic Mythology - The Fomorians War - Complete Saga',
    'mt0LqTs3b9w',
    '45 min',
    2700,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/mt0LqTs3b9w/maxresdefault.jpg',
    600
  ),
  buildVideoLesson(
    'celtic-12',
    'Banshees: The Frightening Women of Irish Folklore - Celtic Mythology',
    '8RAP_1E4rhc',
    '12 min',
    720,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/8RAP_1E4rhc/maxresdefault.jpg',
    300
  ),
];

export const celticMythologyCohort: Cohort = {
  ...deepWorkMastery,
  id: 'celtic-mythology',
  title: 'Celtic Mythology',
  subtitle: 'Explore ancient myths, deities, and epic folklore of the Celtic world.',
  description: 'A complete 12-video course from See U in History covering the Battle of Moytura, Tuatha Dé Danann gods (Lugh, Dagda, Brigid, Cernunnos), the Fomorians War, and Irish folklore.',
  coverImage: 'https://i.ytimg.com/vi/hMP_V2WWl3s/maxresdefault.jpg',
  difficulty: 'Beginner',
  categories: [
    { id: 'history', label: 'History' },
    { id: 'mythology', label: 'Mythology' },
    { id: 'folklore', label: 'Folklore' },
  ],
  creator: {
    id: 'see-u-in-history',
    name: 'See U in History / Mythology',
    avatarUrl: getAvatar('see-u-in-history'),
    role: 'Mythology Historian',
    bio: 'Uncovering ancient myths, legends, and folklore from around the globe.',
    ctaLabel: 'View Quest Guide Profile',
  },
  stats: { rating: 4.9, explorerCount: 3100, completionRate: 70 },
  progress: {
    journeyProgress: 18,
    completedQuests: 2,
    totalQuests: 12,
    dailyGoal: '15 minutes of myth exploration',
    joinedDate: 'July 25, 2026',
  },
  overview: {
    ...deepWorkMastery.overview,
    description: 'Celtic Mythology guides learners through ancient European sagas, legendary warriors, gods, and sacred traditions.',
    pillars: [
      { id: 'p1', icon: 'target', title: 'Battle of Moytura & Gods', description: 'Study the supernatural race of Celtic gods and invasion cycles.' },
      { id: 'p2', icon: 'brain', title: 'Fomorians War Saga', description: 'Analyze the epic conflict between the Tuatha Dé Danann and Fomorians.' },
      { id: 'p3', icon: 'project', title: 'Irish Folklore & Myths', description: 'Explore Banshees, Cernunnos, Dagda, and sacred Celtic lore.' },
    ],
  },
  questline: {
    ...deepWorkMastery.questline,
    title: 'Celtic Mythology Questline',
    description: 'Explore ancient sagas, deities, and legendary tales across 12 full video quests.',
    seasons: [
      {
        id: 'celtic-season-1',
        badge: 'Season 1',
        title: 'Invasions & Deities of Light',
        status: SeasonStatus.InProgress,
        progress: 33,
        estimatedDuration: '~1.5 hrs',
        questCount: celticLessonsSeason1.length,
        summaryLabel: 'View Season Summary',
        lessons: celticLessonsSeason1,
      },
      {
        id: 'celtic-season-2',
        badge: 'Season 2',
        title: 'The Fomorians War & Irish Folklore',
        status: SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: '~2 hrs',
        questCount: celticLessonsSeason2.length,
        summaryLabel: 'View Season Summary',
        lessons: celticLessonsSeason2,
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// COHORT 5: Rajvansh: Dynasties Of India (Real 12-Episode Playlist by EPIC TV)
// ═══════════════════════════════════════════════════════════════

const rajvanshLessonsSeason1: Lesson[] = [
  buildVideoLesson(
    'rajvansh-1',
    'Haryanka Dynasty | Rajvansh: Dynasties Of India | Full Episode | Ancient Indian History',
    'mHE5iGgQHj0',
    '42 min',
    2520,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/mHE5iGgQHj0/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-2',
    'Shishunaga Dynasty | Rajvansh: Dynasties Of India | Full Episode | Ancient Indian History',
    'M5sYFHMnCMs',
    '40 min',
    2400,
    LessonStatus.Completed,
    'https://i.ytimg.com/vi/M5sYFHMnCMs/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-3',
    'Nanda Dynasty | Rajvansh: Dynasties Of India | Full Episode | Ancient Indian History',
    '0IVpyB3LqhE',
    '38 min',
    2280,
    LessonStatus.InStream,
    'https://i.ytimg.com/vi/0IVpyB3LqhE/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-4',
    'Maurya Dynasty Part 1 | Rajvansh: Dynasties Of India | Full Episode | Ancient Indian History',
    'wHNFIGAyU5Y',
    '44 min',
    2640,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/wHNFIGAyU5Y/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-5',
    'Maurya Dynasty Part 2 | Rajvansh: Dynasties Of India | Full Episode | Ancient Indian History',
    'naOwWncICv8',
    '46 min',
    2760,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/naOwWncICv8/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-6',
    'Shunga And Kanva Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    '2pc5wPFdFQg',
    '41 min',
    2460,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/2pc5wPFdFQg/maxresdefault.jpg',
    450
  ),
];

const rajvanshLessonsSeason2: Lesson[] = [
  buildVideoLesson(
    'rajvansh-7',
    'Satavahana Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'lgfPT9YtunM',
    '43 min',
    2580,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/lgfPT9YtunM/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-8',
    'Kushan Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'p-nbiXJydW8',
    '45 min',
    2700,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/p-nbiXJydW8/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-9',
    'Gupta Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'dt74rNgCtrc',
    '47 min',
    2820,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/dt74rNgCtrc/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-10',
    'Pushyabhuti Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'qPUDFkfJ5LM',
    '40 min',
    2400,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/qPUDFkfJ5LM/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-11',
    'Chalukya Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'Q8YSBHyeesI',
    '44 min',
    2640,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/Q8YSBHyeesI/maxresdefault.jpg',
    450
  ),
  buildVideoLesson(
    'rajvansh-12',
    'Vakataka Dynasty | Rajvansh: Dynasties Of India | Full Episode | Indian History',
    'bcrHLmW2N7s',
    '39 min',
    2340,
    LessonStatus.Ready,
    'https://i.ytimg.com/vi/bcrHLmW2N7s/maxresdefault.jpg',
    450
  ),
];

export const rajvanshCohort: Cohort = {
  ...deepWorkMastery,
  id: 'rajvansh-dynasties-of-india',
  title: 'Rajvansh: Dynasties Of India',
  subtitle: 'Discover the epic sagas, rulers, and history of India\'s royal dynasties.',
  description: 'A 12-episode documentary series from EPIC TV covering ancient & medieval Indian dynasties including Haryanka, Nanda, Maurya, Shunga, Satavahana, Kushan, Gupta, Chalukya, and Vakataka.',
  coverImage: 'https://i.ytimg.com/vi/mHE5iGgQHj0/maxresdefault.jpg',
  difficulty: 'Beginner',
  categories: [
    { id: 'history', label: 'History' },
    { id: 'india', label: 'Indian History' },
    { id: 'dynasties', label: 'Dynasties' },
  ],
  creator: {
    id: 'epic-tv',
    name: 'EPIC TV',
    avatarUrl: getAvatar('epic-tv'),
    role: 'Infotainment Network',
    bio: 'India\'s premier infotainment channel documenting history, mythology, culture, and royal heritage.',
    ctaLabel: 'View Quest Guide Profile',
  },
  stats: { rating: 4.95, explorerCount: 5200, completionRate: 75 },
  progress: {
    journeyProgress: 20,
    completedQuests: 2,
    totalQuests: 12,
    dailyGoal: '20 minutes of history study',
    joinedDate: 'July 28, 2026',
  },
  overview: {
    ...deepWorkMastery.overview,
    description: 'Rajvansh: Dynasties Of India guides learners through political strategies, naval conquests, architectural marvels, and empire building across 12 full EPIC TV episodes.',
    pillars: [
      { id: 'p1', icon: 'target', title: 'Magadha to Mauryan Empire', description: 'Analyze statecraft of Haryanka, Nanda, and Maurya dynasties.' },
      { id: 'p2', icon: 'brain', title: 'Post-Mauryan & Imperial Guptas', description: 'Explore Shunga, Satavahana, Kushan, and Gupta golden age.' },
      { id: 'p3', icon: 'project', title: 'Southern & Classical Dynasties', description: 'Evaluate Chalukya, Vakataka, and Pushyabhuti heritage.' },
    ],
  },
  questline: {
    ...deepWorkMastery.questline,
    title: 'Rajvansh Questline',
    description: 'Explore royal dynasties and empires of India across 12 full documentary episodes.',
    seasons: [
      {
        id: 'rajvansh-season-1',
        badge: 'Season 1',
        title: 'Rise of Empires & Mauryan Rule',
        status: SeasonStatus.InProgress,
        progress: 33,
        estimatedDuration: '~4 hrs',
        questCount: rajvanshLessonsSeason1.length,
        summaryLabel: 'View Season Summary',
        lessons: rajvanshLessonsSeason1,
      },
      {
        id: 'rajvansh-season-2',
        badge: 'Season 2',
        title: 'Imperial Guptas & Regional Kingdoms',
        status: SeasonStatus.Locked,
        progress: 0,
        estimatedDuration: '~4 hrs',
        questCount: rajvanshLessonsSeason2.length,
        summaryLabel: 'View Season Summary',
        lessons: rajvanshLessonsSeason2,
      },
    ],
  },
};

export const feedCohorts: Cohort[] = [dsaCohort, osCohort, networkingCohort, celticMythologyCohort, rajvanshCohort];
export const feedCohortIds = new Set(['dsa-only-whats-needed', 'operating-systems-core', 'networking-fundamentals', 'celtic-mythology', 'rajvansh-dynasties-of-india']);



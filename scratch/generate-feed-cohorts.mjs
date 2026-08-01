// Generate feedCohorts.ts from real import data
// Run: node scratch/generate-feed-cohorts.mjs > src/client/mock/cohorts/feedCohorts.ts

const BASE_URL = 'http://localhost:3000';

const COHORTS = [
  {
    id: 'dsa-only-whats-needed',
    title: "DSA — Only What's Needed",
    subtitle: 'Master data structures & algorithms for interviews without the fluff.',
    description:
      "A focused DSA curriculum built from Kunal Kushwaha's Java + DSA playlist and interview preparation series. Covers arrays, linked lists, trees, graphs, dynamic programming, and common interview patterns.",
    difficulty: 'Intermediate',
    categories: ['Programming', 'DSA', 'Interviews'],
    focus: 'core data structures and algorithms for technical interviews',
    outcomes: ['Array Mastery', 'Tree & Graph Traversal', 'Dynamic Programming', 'Pattern Recognition', 'Interview Confidence'],
    events: ['DSA Mock Interview', 'Problem Solving Sprint', 'Code Review Session'],
    legends: ['Kunal K.', 'Ananya Singh', 'Ravi Teja', 'Priya Shah'],
    sources: [
      { url: 'https://www.youtube.com/playlist?list=PL9gnSGHSqcnr_DxHsP7AW9ftq0AtAyYqJ', type: 'YouTube Playlist' },
      { url: 'https://www.youtube.com/watch?v=Eb1ZPmGfxyY&list=PLh_njhZ_MgInv0amXTsZIIhTa3G3iNyZN', type: 'YouTube Playlist' },
    ],
  },
  {
    id: 'operating-systems-core',
    title: 'Operating Systems',
    subtitle: 'Understand how your computer actually works under the hood.',
    description:
      'Two comprehensive OS video courses covering processes, threads, memory management, file systems, scheduling, deadlocks, and real interview questions.',
    difficulty: 'Intermediate',
    categories: ['Computer Science', 'OS', 'Interviews'],
    focus: 'operating system internals and interview preparation',
    outcomes: ['Process Management', 'Memory Management', 'File Systems', 'Scheduling Algorithms', 'Deadlock Prevention'],
    events: ['OS Concepts Quiz', 'Interview Prep Sprint', 'Code Walkthrough'],
    legends: ['Babbar', 'Shraddha Khapra', 'Rohit Kumar', 'Neha Rao'],
    sources: [
      { url: 'https://www.youtube.com/watch?v=3obEP8eLsCw', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/watch?v=h8J7X1cEG4E', type: 'YouTube Video' },
    ],
  },
  {
    id: 'networking-fundamentals',
    title: 'Networking',
    subtitle: 'Learn networking from packets to protocols to interview prep.',
    description:
      'A complete networking curriculum covering OSI model, TCP/IP, DNS, HTTP, load balancing, CDNs, and common networking interview questions.',
    difficulty: 'Intermediate',
    categories: ['Computer Science', 'Networking', 'Interviews'],
    focus: 'computer networking fundamentals and interview preparation',
    outcomes: ['OSI Model Mastery', 'TCP/IP Deep Dive', 'DNS & HTTP', 'Network Security', 'Interview Questions'],
    events: ['Networking Lab', 'Protocol Deep Dive', 'Interview Q&A'],
    legends: ['Atul Sharma', 'Amit Gupta', 'Vanshika Iyer', 'Shaqun'],
    sources: [
      { url: 'https://www.youtube.com/watch?v=nGvpClgugEI', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/watch?v=e8TvhTCVCEo', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/playlist?list=PLmgyxPj-5jn5CiFwyJy7zrKurZLDjS17M', type: 'YouTube Playlist' },
    ],
  },
];

async function importSource(source, sourceId) {
  const res = await fetch(`${BASE_URL}/api/import/youtube/playlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId,
      title: 'Imported source',
      url: source.url,
      sourceType: source.type,
    }),
  });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'complete') return parsed.complete.source;
    } catch {}
  }
  return null;
}

async function generateCurriculum(title, description, importedSources) {
  const res = await fetch(`${BASE_URL}/api/curriculum/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, importedSources }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function run() {
  const allData = [];

  for (const cohort of COHORTS) {
    process.stderr.write(`Importing ${cohort.title}...\n`);
    const importedSources = [];
    for (let i = 0; i < cohort.sources.length; i++) {
      const src = await importSource(cohort.sources[i], `${cohort.id}-src-${i + 1}`);
      if (src) importedSources.push(src);
    }
    const curriculum = await generateCurriculum(cohort.title, cohort.description, importedSources);
    allData.push({
      ...cohort,
      importedSources,
      curriculum,
      coverImage: importedSources[0]?.thumbnail || '',
      creatorName: importedSources[0]?.creator || 'Educator',
    });
  }

  // Generate TypeScript
  let ts = `/**
 * Feed Cohorts — Real YouTube data for DSA, Operating Systems, and Networking.
 * Auto-generated from real YouTube API imports. Do not edit manually.
 * Generated: ${new Date().toISOString()}
 */

import {
  ArchiveType,
  EventStatus,
  LessonStatus,
  LessonType,
  SeasonStatus,
} from '@/src/client/components/screens/cohort/models';
import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortMock as deepWorkMastery } from '@/src/client/components/screens/cohort/mocks/cohortMock';

const avatars = [
  '/mock/avatars/a.webp',
  '/mock/avatars/b.webp',
  '/mock/avatars/c.webp',
  '/mock/avatars/d.webp',
  '/mock/avatars/e.webp',
];

function parseDurationToSeconds(val: string): number {
  if (!val) return 180;
  const isoMatch = /PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?/i.exec(val.toUpperCase());
  if (isoMatch) {
    return (Number(isoMatch[1] ?? 0) * 3600) + (Number(isoMatch[2] ?? 0) * 60) + Number(isoMatch[3] ?? 0);
  }
  const hmsMatch = val.match(/(\\d+):(\\d{1,2})(?::(\\d{1,2}))?/);
  if (hmsMatch) {
    if (hmsMatch[3]) return Number(hmsMatch[1]) * 3600 + Number(hmsMatch[2]) * 60 + Number(hmsMatch[3]);
    return Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]);
  }
  const minMatch = val.match(/(\\d+)\\s*m/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  return 180;
}

function formatSecs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return \`\${h}:\${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
  return \`\${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
}

`;

  for (const data of allData) {
    const c = data.curriculum;

    ts += `// ═══════════════════════════════════════════════════\n`;
    ts += `// ${data.title}\n`;
    ts += `// ${c.totalSeasons} seasons · ${c.totalLessons} lessons · ${c.totalHours}\n`;
    ts += `// ═══════════════════════════════════════════════════\n\n`;

    ts += `const ${toCamelId(data.id)}Seasons = [\n`;

    for (let si = 0; si < c.seasons.length; si++) {
      const season = c.seasons[si];
      ts += `  {\n`;
      ts += `    id: '${data.id}-season-${si + 1}',\n`;
      ts += `    badge: 'Season ${si + 1}',\n`;
      ts += `    title: ${JSON.stringify(season.title)},\n`;
      ts += `    status: ${si === 0 ? 'SeasonStatus.InProgress' : 'SeasonStatus.Locked'},\n`;
      ts += `    progress: ${si === 0 ? 15 : 0},\n`;
      ts += `    estimatedDuration: ${JSON.stringify(season.estimatedDuration)},\n`;
      ts += `    questCount: ${season.lessonCount},\n`;
      ts += `    summaryLabel: 'View Season Summary',\n`;
      ts += `    lessons: [\n`;

      for (let li = 0; li < season.lessons.length; li++) {
        const lesson = season.lessons[li];
        const videoId = lesson.videoId || '';
        const thumbnail = lesson.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : data.coverImage);
        const status = si === 0 && li < 2 ? 'LessonStatus.Completed' : si === 0 && li === 2 ? 'LessonStatus.InStream' : 'LessonStatus.Ready';

        // Build chunks with real time offsets
        const totalSecs = parseDurationToSecondsJS(lesson.duration);
        const chunkCount = lesson.chunkCount || Math.max(1, Math.ceil(totalSecs / 300));
        const chunkDuration = Math.max(60, Math.floor(totalSecs / chunkCount));

        ts += `      {\n`;
        ts += `        id: ${JSON.stringify(lesson.id)},\n`;
        ts += `        title: ${JSON.stringify(lesson.title)},\n`;
        ts += `        type: LessonType.Video,\n`;
        ts += `        duration: ${JSON.stringify(lesson.duration)},\n`;
        ts += `        status: ${status},\n`;
        ts += `        totalChunks: ${chunkCount},\n`;
        ts += `        completedChunks: ${status === 'LessonStatus.Completed' ? chunkCount : status === 'LessonStatus.InStream' ? Math.floor(chunkCount / 2) : 0},\n`;
        ts += `        thumbnail: ${JSON.stringify(thumbnail)},\n`;
        ts += `        videoId: ${JSON.stringify(videoId)},\n`;
        ts += `        videoUrl: ${videoId ? JSON.stringify(`https://www.youtube.com/watch?v=${videoId}`) : 'undefined'},\n`;
        ts += `        chunks: buildChunksFromDuration(${JSON.stringify(lesson.id)}, ${JSON.stringify(lesson.duration)}, ${JSON.stringify(videoId)}),\n`;
        ts += `      },\n`;
      }

      ts += `    ],\n`;
      ts += `  },\n`;
    }

    ts += `];\n\n`;
  }

  // Build the cohort objects
  for (const data of allData) {
    const c = data.curriculum;
    const camelId = toCamelId(data.id);

    ts += `const ${camelId}Cohort: Cohort = {\n`;
    ts += `  ...deepWorkMastery,\n`;
    ts += `  id: ${JSON.stringify(data.id)},\n`;
    ts += `  title: ${JSON.stringify(data.title)},\n`;
    ts += `  subtitle: ${JSON.stringify(data.subtitle)},\n`;
    ts += `  description: ${JSON.stringify(data.description)},\n`;
    ts += `  coverImage: ${JSON.stringify(data.coverImage)},\n`;
    ts += `  difficulty: ${JSON.stringify(data.difficulty)},\n`;
    ts += `  categories: ${JSON.stringify(data.categories)}.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label })),\n`;
    ts += `  creator: {\n`;
    ts += `    id: ${JSON.stringify(data.id + '-creator')},\n`;
    ts += `    name: ${JSON.stringify(data.creatorName)},\n`;
    ts += `    avatarUrl: avatars[0],\n`;
    ts += `    role: 'Educator',\n`;
    ts += `    bio: ${JSON.stringify(`Expert in ${data.focus}.`)},\n`;
    ts += `    ctaLabel: 'View Quest Guide Profile',\n`;
    ts += `  },\n`;
    ts += `  stats: { rating: 4.8, explorerCount: ${3000 + Math.floor(Math.random() * 5000)}, completionRate: ${55 + Math.floor(Math.random() * 20)} },\n`;
    ts += `  progress: {\n`;
    ts += `    journeyProgress: 12,\n`;
    ts += `    completedQuests: ${Math.min(4, c.totalLessons)},\n`;
    ts += `    totalQuests: ${c.totalLessons},\n`;
    ts += `    dailyGoal: '20 minutes of daily practice',\n`;
    ts += `    joinedDate: 'July 15, 2026',\n`;
    ts += `  },\n`;

    // Overview
    ts += `  overview: {\n`;
    ts += `    description: ${JSON.stringify(data.description)},\n`;
    ts += `    pillars: [\n`;
    for (let i = 0; i < Math.min(3, data.outcomes.length); i++) {
      ts += `      { id: 'p${i + 1}', icon: ${JSON.stringify(['target', 'brain', 'project'][i])}, title: ${JSON.stringify(data.outcomes[i])}, description: ${JSON.stringify(`Build durable skill in ${data.outcomes[i].toLowerCase()}.`)} },\n`;
    }
    ts += `    ],\n`;
    ts += `    learningObjectives: ${JSON.stringify(data.outcomes.map((o, i) => ({ id: `lo-${i}`, text: o })))},\n`;
    ts += `    journeySummary: [\n`;
    ts += `      { id: 'js-1', icon: 'target' as const, label: 'Quest Length', value: ${JSON.stringify(c.totalHours)} },\n`;
    ts += `      { id: 'js-2', icon: 'target' as const, label: 'Quests', value: '${c.totalLessons} quests' },\n`;
    ts += `      { id: 'js-3', icon: 'target' as const, label: 'Seasons', value: '${c.totalSeasons} seasons' },\n`;
    ts += `    ],\n`;
    ts += `    expeditionStats: [\n`;
    ts += `      { id: 'es-1', icon: 'target' as const, label: 'Lessons', value: '${c.totalLessons}' },\n`;
    ts += `      { id: 'es-2', icon: 'target' as const, label: 'Seasons', value: '${c.totalSeasons}' },\n`;
    ts += `      { id: 'es-3', icon: 'target' as const, label: 'Assignments', value: '8' },\n`;
    ts += `      { id: 'es-4', icon: 'target' as const, label: 'Estimated Completion', value: '3–5 weeks' },\n`;
    ts += `    ],\n`;
    ts += `    expeditionProgress: [\n`;
    ts += `      { id: 'ep-1', icon: 'target' as const, label: 'Current Streak', value: '3 days' },\n`;
    ts += `      { id: 'ep-2', icon: 'target' as const, label: 'Total Time Invested', value: '2h 40m' },\n`;
    ts += `    ],\n`;
    ts += `    activeExplorers: avatars.slice(0, 3),\n`;
    ts += `    activeExplorerOverflow: '+120',\n`;
    ts += `  },\n`;

    // Questline
    ts += `  questline: {\n`;
    ts += `    ...deepWorkMastery.questline,\n`;
    ts += `    title: ${JSON.stringify(data.title + ' Questline')},\n`;
    ts += `    description: ${JSON.stringify(`Complete hands-on quests for ${data.focus}.`)},\n`;
    ts += `    seasons: ${camelId}Seasons,\n`;
    ts += `    feedTitle: ${JSON.stringify(data.title + ' Assignments')},\n`;
    ts += `    feedDescription: ${JSON.stringify(`Ship artifacts that prove your ${data.focus} skills.`)},\n`;
    ts += `    assignmentFeed: ${JSON.stringify(data.outcomes.slice(0, 3).map((title, index) => ({
      id: `${data.id}-assignment-${index}`,
      title,
      type: index === 2 ? 'project' : 'assignment',
      description: `Create a practical ${title.toLowerCase()} artifact.`,
      duration: '~25 min',
      thumbnail: data.coverImage,
      icon: index === 2 ? 'project' : 'assignment',
      participants: avatars.slice(0, 3).map((avatarUrl, i) => ({ id: `${data.id}-p-${i}`, avatarUrl })),
      submittedCount: `+${90 + index * 47} submitted`,
      shareLabel: 'Share Work',
      doneLabel: 'Mark as Done',
    })))},\n`;
    ts += `  },\n`;

    // Events
    ts += `  events: {\n`;
    ts += `    title: 'Upcoming Events',\n`;
    ts += `    description: ${JSON.stringify(`Live sessions for ${data.title}.`)},\n`;
    ts += `    filters: deepWorkMastery.events.filters,\n`;
    ts += `    upcomingEvents: ${JSON.stringify(data.events.map((title, index) => ({
      id: `${data.id}-event-${index}`,
      date: { month: 'Aug', day: String(5 + index * 4), weekday: ['Tue', 'Sat', 'Wed'][index % 3] },
      title,
      description: `Join peers for ${title.toLowerCase()}.`,
      avatars: avatars.slice(0, 3).map((avatarUrl, i) => ({ id: `${data.id}-a-${i}`, avatarUrl })),
      attendeeCount: `+${120 + index * 54} attending`,
      time: ['7:00 PM – 8:00 PM', '8:00 PM – 9:00 PM', '6:30 PM – 8:00 PM'][index % 3],
      timezone: 'IST',
      platform: index % 2 ? 'Zoom' : 'Google Meet',
      status: index === 0 ? 'upcoming' : 'live',
    })))},\n`;
    ts += `    weeklySchedule: ${JSON.stringify(data.events.slice(0, 3).map((title, index) => ({
      id: `${data.id}-week-${index}`,
      date: ['Tue, Aug 5', 'Sat, Aug 9', 'Wed, Aug 13'][index],
      time: ['7:00 PM', '8:00 PM', '6:30 PM'][index],
      title,
      icon: ['👥', '⚡', '🎯'][index],
    })))},\n`;
    ts += `    calendarSync: deepWorkMastery.events.calendarSync,\n`;
    ts += `    suggestEvent: { title: 'Suggest an Event', description: ${JSON.stringify(`Have a ${data.focus} session idea?`)}, buttonLabel: 'Suggest Event', illustration: '📝' },\n`;
    ts += `  },\n`;

    // Archives & Hall of Fame
    ts += `  archives: deepWorkMastery.archives,\n`;
    ts += `  hallOfFame: deepWorkMastery.hallOfFame,\n`;
    ts += `};\n\n`;
  }

  // Helper function for chunk building
  ts = ts.replace(
    /^/,
    `function buildChunksFromDuration(lessonId: string, duration: string, videoId: string) {
  const totalSecs = parseDurationToSeconds(duration);
  const chunkTarget = 300; // 5 minutes
  const chunkCount = Math.max(1, Math.ceil(totalSecs / chunkTarget));
  const chunkSecs = Math.max(60, Math.floor(totalSecs / chunkCount));

  return Array.from({ length: chunkCount }, (_, i) => {
    const startSecs = i * chunkSecs;
    const endSecs = i === chunkCount - 1 ? totalSecs : (i + 1) * chunkSecs;
    return {
      id: \`\${lessonId}-chunk-\${i + 1}\`,
      title: \`Part \${i + 1}\`,
      duration: \`\${Math.round((endSecs - startSecs) / 60)}m\`,
      order: i + 1,
      startSeconds: startSecs,
      endSeconds: endSecs,
      timeRangeLabel: \`\${formatSecs(startSecs)} – \${formatSecs(endSecs)}\`,
      timestampUrl: videoId ? \`https://www.youtube.com/watch?v=\${videoId}&t=\${startSecs}s\` : undefined,
    };
  });
}

`
  );

  // Export
  ts += `export const feedCohorts: Cohort[] = [\n`;
  for (const data of allData) {
    ts += `  ${toCamelId(data.id)}Cohort,\n`;
  }
  ts += `];\n`;

  // Write to stdout
  process.stdout.write(ts);
}

function toCamelId(id) {
  return id
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function parseDurationToSecondsJS(val) {
  if (!val) return 180;
  const isoMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i.exec(val.toUpperCase());
  if (isoMatch) {
    return (Number(isoMatch[1] ?? 0) * 3600) + (Number(isoMatch[2] ?? 0) * 60) + Number(isoMatch[3] ?? 0);
  }
  const hmsMatch = val.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
  if (hmsMatch) {
    if (hmsMatch[3]) return Number(hmsMatch[1]) * 3600 + Number(hmsMatch[2]) * 60 + Number(hmsMatch[3]);
    return Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]);
  }
  const minMatch = val.match(/(\d+)\s*m/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  return 180;
}

run().catch((err) => console.error(err));

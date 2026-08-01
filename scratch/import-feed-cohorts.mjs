// Script to import 3 real cohorts for feed system
// Run: node scratch/import-feed-cohorts.mjs

const COHORTS = [
  {
    id: 'dsa-only-whats-needed',
    title: 'DSA — Only What\'s Needed',
    subtitle: 'Master data structures & algorithms for interviews without the fluff.',
    description: 'A focused DSA curriculum built from Kunal Kushwaha\'s Java + DSA playlist and interview preparation series. Covers arrays, linked lists, trees, graphs, dynamic programming, and common interview patterns — nothing more, nothing less.',
    coverImage: '', // will be set from first playlist thumbnail
    difficulty: 'Intermediate',
    categories: ['Programming', 'DSA', 'Interviews'],
    creator: { name: 'Kunal Kushwaha', role: 'DSA Educator' },
    focus: 'core data structures and algorithms for technical interviews',
    sources: [
      { url: 'https://www.youtube.com/playlist?list=PL9gnSGHSqcnr_DxHsP7AW9ftq0AtAyYqJ', type: 'YouTube Playlist' },
      { url: 'https://www.youtube.com/watch?v=Eb1ZPmGfxyY&list=PLh_njhZ_MgInv0amXTsZIIhTa3G3iNyZN', type: 'YouTube Playlist' },
    ],
  },
  {
    id: 'operating-systems-core',
    title: 'Operating Systems',
    subtitle: 'Understand how your computer actually works under the hood.',
    description: 'Two comprehensive OS video courses covering processes, threads, memory management, file systems, scheduling, deadlocks, and real interview questions. Everything you need for OS fundamentals.',
    coverImage: '',
    difficulty: 'Intermediate',
    categories: ['Computer Science', 'Operating Systems', 'Interviews'],
    creator: { name: 'Tech Educators', role: 'CS Faculty' },
    focus: 'operating system internals and interview preparation',
    sources: [
      { url: 'https://www.youtube.com/watch?v=3obEP8eLsCw', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/watch?v=h8J7X1cEG4E', type: 'YouTube Video' },
    ],
  },
  {
    id: 'networking-fundamentals',
    title: 'Networking',
    subtitle: 'Learn networking from packets to protocols to interview prep.',
    description: 'A complete networking curriculum covering OSI model, TCP/IP, DNS, HTTP, load balancing, CDNs, and common networking interview questions. Built from curated YouTube content.',
    coverImage: '',
    difficulty: 'Intermediate',
    categories: ['Computer Science', 'Networking', 'Interviews'],
    creator: { name: 'Network Academy', role: 'Networking Educators' },
    focus: 'computer networking fundamentals and interview preparation',
    sources: [
      { url: 'https://www.youtube.com/watch?v=nGvpClgugEI', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/watch?v=e8TvhTCVCEo', type: 'YouTube Video' },
      { url: 'https://www.youtube.com/playlist?list=PLmgyxPj-5jn5CiFwyJy7zrKurZLDjS17M', type: 'YouTube Playlist' },
    ],
  },
];

const BASE_URL = 'http://localhost:3000';

async function importSource(source, sourceId) {
  console.log(`  Importing: ${source.url} (${source.type})`);
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

  if (!res.ok) {
    console.error(`  FAILED: HTTP ${res.status}`);
    return null;
  }

  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim());
  let finalSource = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'complete') {
        finalSource = parsed.complete.source;
      }
    } catch {}
  }

  if (finalSource) {
    console.log(`  ✓ "${finalSource.title}" — ${finalSource.lessonCount} lessons`);
  } else {
    console.error(`  ✗ No complete event`);
  }
  return finalSource;
}

async function generateCurriculum(title, description, importedSources) {
  const res = await fetch(`${BASE_URL}/api/curriculum/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, importedSources }),
  });
  if (!res.ok) {
    console.error(`Curriculum generation failed: ${res.status}`);
    return null;
  }
  return await res.json();
}

async function publishCohort(cohortDef, curriculum, coverImage) {
  const res = await fetch(`${BASE_URL}/api/cohort/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft: {
        title: cohortDef.title,
        subtitle: cohortDef.subtitle,
        description: cohortDef.description,
        coverImage: coverImage,
        primaryTopic: cohortDef.title,
        categories: cohortDef.categories,
        difficulty: cohortDef.difficulty,
        prerequisites: [],
        visibility: 'Public',
      },
      curriculum,
      onboarding: {
        welcomeMessage: `Welcome to ${cohortDef.title}! Let's master ${cohortDef.focus} together.`,
        journeyIntroduction: `In this cohort, you'll work through ${curriculum.totalLessons} lessons across ${curriculum.totalSeasons} seasons, covering ${cohortDef.focus}.`,
        recommendedDailyGoal: '20 minutes of focused learning',
      },
      journeySettings: {
        difficulty: cohortDef.difficulty,
        visibility: 'Public',
      },
      cohortId: cohortDef.id,
    }),
  });

  if (!res.ok) {
    console.error(`Publish failed: ${res.status}`);
    const text = await res.text();
    console.error(text);
    return null;
  }

  const result = await res.json();
  console.log(`  ✓ Published: ${result.cohortTitle} → ${result.cohortUrl}`);
  return result;
}

async function processCohort(cohortDef) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`COHORT: ${cohortDef.title}`);
  console.log(`${'='.repeat(60)}`);

  // 1. Import all sources
  const importedSources = [];
  for (let i = 0; i < cohortDef.sources.length; i++) {
    const src = await importSource(cohortDef.sources[i], `${cohortDef.id}-src-${i + 1}`);
    if (src) importedSources.push(src);
  }

  if (importedSources.length === 0) {
    console.error(`  No sources imported! Skipping.`);
    return null;
  }

  const totalLessons = importedSources.reduce((sum, s) => sum + s.lessonCount, 0);
  console.log(`\n  Total sources: ${importedSources.length}, Total lessons: ${totalLessons}`);

  // 2. Generate curriculum
  console.log(`\n  Generating curriculum...`);
  const curriculum = await generateCurriculum(cohortDef.title, cohortDef.description, importedSources);
  if (!curriculum) return null;

  console.log(`  ✓ Curriculum: ${curriculum.totalSeasons} seasons, ${curriculum.totalLessons} lessons, ${curriculum.totalHours}`);

  // 3. Set cover image from first imported source
  const coverImage = cohortDef.coverImage || importedSources[0]?.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop';

  // 4. Publish
  console.log(`\n  Publishing cohort...`);
  const result = await publishCohort(cohortDef, curriculum, coverImage);

  return { cohortDef, importedSources, curriculum, publishResult: result };
}

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  SideQuestHQ — Feed Cohort Import & Publish Pipeline     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = [];
  for (const cohort of COHORTS) {
    const result = await processCohort(cohort);
    if (result) results.push(result);
  }

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Cohorts processed: ${results.length} / ${COHORTS.length}`);

  for (const r of results) {
    const c = r.curriculum;
    console.log(`\n  ${r.cohortDef.title}`);
    console.log(`    ID: ${r.cohortDef.id}`);
    console.log(`    Seasons: ${c.totalSeasons} | Lessons: ${c.totalLessons} | Duration: ${c.totalHours}`);
    console.log(`    URL: /cohort/${r.cohortDef.id}/questline`);
    if (r.publishResult) {
      console.log(`    Published URL: ${r.publishResult.cohortUrl}`);
    }
  }

  // Output the data we need for feedCohorts.ts
  console.log(`\n\n--- FEED COHORTS DATA (for feedCohorts.ts) ---`);
  for (const r of results) {
    console.log(`\nCohort: ${r.cohortDef.id}`);
    console.log(`  Cover: ${r.importedSources[0]?.thumbnail || 'N/A'}`);
    console.log(`  Creator: ${r.importedSources[0]?.creator || 'N/A'}`);
    console.log(`  Sources: ${r.importedSources.length}`);
    console.log(`  Season breakdown:`);
    for (const s of r.curriculum.seasons) {
      console.log(`    ${s.title}: ${s.lessonCount} lessons (${s.estimatedDuration})`);
      // Show first 3 lesson titles
      for (const l of s.lessons.slice(0, 3)) {
        console.log(`      - ${l.title} (${l.duration}) [videoId: ${l.videoId || 'none'}]`);
      }
      if (s.lessons.length > 3) {
        console.log(`      ... and ${s.lessons.length - 3} more`);
      }
    }
  }
}

run().catch((err) => console.error(err));

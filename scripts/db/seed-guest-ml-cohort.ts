import { prisma } from '../../src/server/infrastructure/db/postgres/client';
import { connectToMongoDB } from '../../src/server/infrastructure/db/mongodb/client';
import { CohortTranscript } from '../../src/server/database/mongo/models/CohortTranscript';
import { Chunk } from '../../src/server/database/mongo/models/Chunk';
import { UserCohortConfig } from '../../src/server/database/mongo/models/UserCohortConfig';
import { YoutubeMetadataReader } from '../../src/server/domain/cohort-creation/materials/youtube-metadata';
import {
  extractChaptersFromDescription,
  VercelMaterialObservation,
} from '../../src/server/infrastructure/ai/vercelMaterialObservation';
import { VectorScoringService } from '../../src/server/domain/cohort/vectorScoring.service';
import { createCohortModel } from '../../src/server/infrastructure/ai/modelRegistry';

const COHORT_ID = 'cohort_ml_foundations_01';
const SEASON_ID = 'ml_foundations_s1';

interface LessonSeedSpec {
  id: string;
  chunkPrefix: string;
  videoId: string;
  url: string;
  order: number;
  fallbackTitle: string;
  fallbackDuration: number;
  objective: string;
  fallbackChapters?: Array<{ startSeconds: number; endSeconds: number; text: string }>;
}

const LESSON_SPECS: LessonSeedSpec[] = [
  {
    id: 'ml_lesson_cs229_intro',
    chunkPrefix: 'ml_cs229',
    videoId: 'Bl4Feh_Mjvo',
    url: 'https://www.youtube.com/watch?v=Bl4Feh_Mjvo',
    order: 1,
    fallbackTitle: 'Stanford CS229 Machine Learning I Introduction I 2022 I Lecture 1',
    fallbackDuration: 4722,
    objective:
      'Build a rigorous foundation in what machine learning is, how supervised, unsupervised, and reinforcement learning differ, and how CS229 frames optimization and generalization.',
    fallbackChapters: [
      {
        startSeconds: 0,
        endSeconds: 720,
        text: 'Welcome to Stanford CS229: Course Goals, AI Context, and What Machine Learning Solves',
      },
      {
        startSeconds: 720,
        endSeconds: 1500,
        text: 'Defining Machine Learning: Learning from Experience, Tasks, and Performance Measures',
      },
      {
        startSeconds: 1500,
        endSeconds: 2340,
        text: 'Supervised Learning Foundations: Regression, Classification, and Mapping Inputs to Labels',
      },
      {
        startSeconds: 2340,
        endSeconds: 3120,
        text: 'Unsupervised Learning & Structure Discovery: Clustering, Density Estimation, and Representations',
      },
      {
        startSeconds: 3120,
        endSeconds: 3960,
        text: 'Reinforcement Learning & Sequential Decision-Making: Rewards, Policies, and Credit Assignment',
      },
      {
        startSeconds: 3960,
        endSeconds: 4722,
        text: 'CS229 Syllabus, Mathematical Prerequisites (Linear Algebra, Probability, Calculus), and Next Steps',
      },
    ],
  },
  {
    id: 'ml_lesson_all_ml_algos',
    chunkPrefix: 'ml_algos',
    videoId: 'E0Hmnixke2g',
    url: 'https://www.youtube.com/watch?v=E0Hmnixke2g&pp=ygUbbWFjaGluZSBsZWFybmluZyB2aXN1YWxpemVk',
    order: 2,
    fallbackTitle: 'All Machine Learning algorithms explained in 17 min',
    fallbackDuration: 990,
    objective:
      'Compare the major families of machine learning algorithms—from regression, KNN, SVMs, Naive Bayes, and tree ensembles to neural networks, clustering, and PCA—and learn when to use each.',
  },
  {
    id: 'ml_lesson_3b1b_nn',
    chunkPrefix: 'ml_3b1b',
    videoId: 'aircAruvnKk',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk&list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi',
    order: 3,
    fallbackTitle: 'But what is a neural network? | Deep learning chapter 1',
    fallbackDuration: 1120,
    objective:
      'Understand the visual and linear-algebraic structure of multilayer perceptrons: activations, weights, biases, edge/pattern hierarchy, and sigmoid vs. ReLU nonlinearities.',
  },
];

function formatTimeRange(startSec: number, endSec: number): string {
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  return `${fmt(startSec)} – ${fmt(endSec)}`;
}

function formatDurationBadge(seconds: number): string {
  const safe = Math.max(1, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

function cleanChapterTitle(rawText: string, fallback: string): string {
  const head = rawText.split(';')[0]?.split(':')[0]?.trim() || rawText.trim();
  const clean = head.replace(/\s+/g, ' ').slice(0, 88);
  return clean || fallback;
}

async function resolveVideoUnits() {
  const reader = new YoutubeMetadataReader();
  const resolved = new Map<
    string,
    {
      title: string;
      description: string;
      channelTitle: string;
      durationSeconds: number;
      thumbnailUrl: string;
      chapters: Array<{ startSeconds: number; endSeconds: number; text: string }>;
    }
  >();

  let observer: VercelMaterialObservation | null = null;
  try {
    const model = createCohortModel();
    observer = new VercelMaterialObservation(model, {
      beforeCall: async () => async () => {},
    });
  } catch {
    observer = null;
  }

  for (const spec of LESSON_SPECS) {
    let title = spec.fallbackTitle;
    let description = spec.objective;
    let channelTitle = 'YouTube';
    let durationSeconds = spec.fallbackDuration;
    const canonicalWatchUrl = `https://www.youtube.com/watch?v=${spec.videoId}`;

    try {
      const meta = await reader.read(canonicalWatchUrl, AbortSignal.timeout(15_000));
      const unit = meta.units[0];
      if (unit) {
        title = unit.title || title;
        description = unit.description || description;
        channelTitle = unit.channelTitle || channelTitle;
        durationSeconds = unit.durationSeconds || durationSeconds;
      }
    } catch (err) {
      console.warn(`[seed] Metadata read fallback for ${spec.videoId}:`, err instanceof Error ? err.message : err);
    }

    let chapters = extractChaptersFromDescription(description, durationSeconds);

    if (chapters.length === 0 && observer) {
      try {
        const obs = await observer.observeVideo(
          {
            videoId: spec.videoId,
            url: canonicalWatchUrl,
            title,
            description,
            channelId: 'unknown',
            channelTitle,
            publishedAt: new Date().toISOString(),
            durationSeconds,
            etag: `seed-${spec.videoId}`,
            privacy: 'public',
          },
          AbortSignal.timeout(12_000),
        );
        if (obs.canObserve && obs.observations.length >= 4) {
          chapters = obs.observations.map((o) => ({
            startSeconds: o.startSeconds,
            endSeconds: o.endSeconds,
            text: o.text,
          }));
        }
      } catch {
        // Fall through to structured fallback chapters
      }
    }

    if (chapters.length === 0) {
      chapters =
        spec.fallbackChapters ?? [
          {
            startSeconds: 0,
            endSeconds: durationSeconds,
            text: `${title} — ${spec.objective}`,
          },
        ];
    }

    resolved.set(spec.videoId, {
      title,
      description,
      channelTitle,
      durationSeconds,
      thumbnailUrl: `https://i.ytimg.com/vi/${spec.videoId}/hqdefault.jpg`,
      chapters,
    });
  }

  return resolved;
}

async function main() {
  console.log('🚀 Seeding Machine Learning & Neural Networks cohort for guest user...');

  // 1. Ensure Guest Explorer & Creator exist
  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@undone.com' },
    update: {},
    create: {
      email: 'guest@undone.com',
      name: 'Guest Explorer',
      username: 'guest-undone',
      role: 'EXPLORER',
    },
  });

  const creatorUser =
    (await prisma.user.findUnique({ where: { email: 'user_alpha@undone.com' } })) ?? guestUser;

  console.log(`👤 Creator: ${creatorUser.email} (${creatorUser.id})`);
  console.log(`👤 Guest:   ${guestUser.email} (${guestUser.id})`);

  // 2. Fetch YouTube metadata & chapters
  const videoUnits = await resolveVideoUnits();

  // 3. Build scored chunks for each lesson
  const totalDurationSeconds = LESSON_SPECS.reduce(
    (sum, spec) => sum + (videoUnits.get(spec.videoId)?.durationSeconds ?? spec.fallbackDuration),
    0,
  );
  const totalMinutes = Math.ceil(totalDurationSeconds / 60);

  const builtLessons: Array<{
    spec: LessonSeedSpec;
    meta: NonNullable<ReturnType<typeof videoUnits.get>>;
    fullTranscript: string;
    fullVector: number[];
    isStrictlyLinear: boolean;
    linearityDependencyScore: number;
    chunks: Array<{
      id: string;
      chunkId: string;
      chunkIndex: number;
      order: number;
      title: string;
      text: string;
      startSeconds: number;
      endSeconds: number;
      durationSeconds: number;
      duration: string;
      timeRangeLabel: string;
      timestampUrl: string;
      vector: number[];
      isStrictlyLinear: boolean;
      isKeyConcept: boolean;
      summary: string;
      contentOrigin: 'user';
      durationMethod: 'source';
    }>;
  }> = [];

  for (const spec of LESSON_SPECS) {
    const meta = videoUnits.get(spec.videoId)!;
    const totalChunks = meta.chapters.length;
    const scoredChunks = [];

    for (let i = 0; i < totalChunks; i++) {
      const ch = meta.chapters[i];
      const dur = Math.max(30, ch.endSeconds - ch.startSeconds);
      const chunkId = `${spec.chunkPrefix}_chk_${i}`;
      const chunkTitle = cleanChapterTitle(ch.text, `Part ${i + 1}`);
      const enrichedText = `${chunkTitle} (${meta.title} — ${meta.channelTitle}, ${formatTimeRange(ch.startSeconds, ch.endSeconds)}).\n\nTopics covered: ${ch.text}.\n\nLesson context: ${spec.objective}`;

      const score = await VectorScoringService.scoreTranscript(enrichedText, {
        title: `${meta.title} — ${chunkTitle}`,
        chunkIndex: i,
        totalChunks,
        duration: dur,
      });

      scoredChunks.push({
        id: chunkId,
        chunkId,
        chunkIndex: i,
        order: i,
        title: chunkTitle,
        text: enrichedText,
        startSeconds: ch.startSeconds,
        endSeconds: ch.endSeconds,
        durationSeconds: dur,
        duration: formatDurationBadge(dur),
        timeRangeLabel: formatTimeRange(ch.startSeconds, ch.endSeconds),
        timestampUrl: `https://www.youtube.com/watch?v=${spec.videoId}&t=${ch.startSeconds}s`,
        vector: score.vector,
        isStrictlyLinear: score.isStrictlyLinear,
        isKeyConcept: Boolean(score.isKeyConcept ?? (i === 0 || i === Math.floor(totalChunks / 2))),
        summary: score.summary || ch.text,
        contentOrigin: 'user' as const,
        durationMethod: 'source' as const,
      });
    }

    const fullTranscript = scoredChunks.map((c) => `${c.title}\n${c.text}`).join('\n\n');
    const macroScore = await VectorScoringService.scoreTranscript(fullTranscript, {
      title: meta.title,
      duration: meta.durationSeconds,
    });

    builtLessons.push({
      spec,
      meta,
      fullTranscript,
      fullVector: macroScore.vector,
      isStrictlyLinear: macroScore.isStrictlyLinear,
      linearityDependencyScore: macroScore.linearityDependencyScore,
      chunks: scoredChunks,
    });
  }

  // 4. Upsert Cohort, Sources, Season, Lessons, Community, Channels, Members in Postgres
  const cohortTitle = 'Foundations of Machine Learning & Neural Networks';
  const cohortSubtitle = 'From CS229 statistical foundations and core algorithms to deep neural architectures';
  const cohortDescription =
    'A visual and mathematical journey through modern machine learning: start with Stanford CS229 Lecture 1 on how learning problems are formulated, map out the complete landscape of supervised and unsupervised algorithms, and build intuition for multilayer neural networks with 3Blue1Brown.';
  const coverImage = '/images/cohorts/ai-creators.webp';

  await prisma.$transaction(async (tx) => {
    await tx.cohort.upsert({
      where: { id: COHORT_ID },
      update: {
        creatorId: creatorUser.id,
        title: cohortTitle,
        subtitle: cohortSubtitle,
        description: cohortDescription,
        coverImage,
        difficulty: 'INTERMEDIATE',
        visibility: 'PUBLIC',
        qualityScore: 95,
        isPublished: true,
        publishedAt: new Date(),
        categories: ['Data Science & AI', 'Computer Science'],
        estimatedCompletionTime: `${totalMinutes} mins`,
        language: 'en',
        primaryTopic: 'Machine Learning',
        tags: ['Machine Learning', 'Neural Networks', 'Deep Learning', 'CS229', 'Algorithms'],
        requirements: ['Basic familiarity with high-school algebra and functions'],
        learningOutcomes: [
          'Distinguish supervised, unsupervised, and reinforcement learning paradigms',
          'Choose between regression, SVM, trees, ensembles, clustering, and PCA',
          'Explain neurons, layers, weights, biases, and activations visually and mathematically',
        ],
      },
      create: {
        id: COHORT_ID,
        creatorId: creatorUser.id,
        title: cohortTitle,
        subtitle: cohortSubtitle,
        description: cohortDescription,
        coverImage,
        difficulty: 'INTERMEDIATE',
        visibility: 'PUBLIC',
        qualityScore: 95,
        isPublished: true,
        publishedAt: new Date(),
        categories: ['Data Science & AI', 'Computer Science'],
        estimatedCompletionTime: `${totalMinutes} mins`,
        language: 'en',
        primaryTopic: 'Machine Learning',
        tags: ['Machine Learning', 'Neural Networks', 'Deep Learning', 'CS229', 'Algorithms'],
        requirements: ['Basic familiarity with high-school algebra and functions'],
        learningOutcomes: [
          'Distinguish supervised, unsupervised, and reinforcement learning paradigms',
          'Choose between regression, SVM, trees, ensembles, clustering, and PCA',
          'Explain neurons, layers, weights, biases, and activations visually and mathematically',
        ],
      },
    });

    // Replace CohortSource rows cleanly
    await tx.cohortSource.deleteMany({ where: { cohortId: COHORT_ID } });
    await tx.cohortSource.createMany({
      data: builtLessons.map((item) => ({
        cohortId: COHORT_ID,
        type: 'YOUTUBE_VIDEO',
        title: item.meta.title,
        url: item.spec.url,
        thumbnailUrl: item.meta.thumbnailUrl,
        domain: 'youtube.com',
        metaTitle: `${item.meta.title} (${item.meta.channelTitle})`,
        chunkingMethod: 'author-chapters-and-observations-v1',
      })),
    });

    // Upsert Season
    await tx.season.upsert({
      where: { id: SEASON_ID },
      update: {
        cohortId: COHORT_ID,
        title: 'Season 1: Core Machine Learning & Neural Networks',
        order: 1,
      },
      create: {
        id: SEASON_ID,
        cohortId: COHORT_ID,
        title: 'Season 1: Core Machine Learning & Neural Networks',
        order: 1,
      },
    });

    // Upsert Lessons
    for (const item of builtLessons) {
      await tx.lesson.upsert({
        where: { id: item.spec.id },
        update: {
          seasonId: SEASON_ID,
          title: item.meta.title,
          description: item.spec.objective,
          videoUrl: `https://www.youtube.com/watch?v=${item.spec.videoId}`,
          videoId: item.spec.videoId,
          sourceUrl: item.spec.url,
          thumbnailUrl: item.meta.thumbnailUrl,
          duration: item.meta.durationSeconds,
          order: item.spec.order,
          lessonType: 'VIDEO',
          isPublished: true,
          chunks: item.chunks as any,
        },
        create: {
          id: item.spec.id,
          seasonId: SEASON_ID,
          title: item.meta.title,
          description: item.spec.objective,
          videoUrl: `https://www.youtube.com/watch?v=${item.spec.videoId}`,
          videoId: item.spec.videoId,
          sourceUrl: item.spec.url,
          thumbnailUrl: item.meta.thumbnailUrl,
          duration: item.meta.durationSeconds,
          order: item.spec.order,
          lessonType: 'VIDEO',
          isPublished: true,
          chunks: item.chunks as any,
        },
      });
    }

    // Ensure Community + default channels exist
    const existingCommunity = await tx.community.findUnique({ where: { cohortId: COHORT_ID } });
    if (!existingCommunity) {
      await tx.community.create({
        data: {
          cohortId: COHORT_ID,
          chatEnabled: true,
          eventsEnabled: true,
          channels: {
            create: [{ name: 'general' }, { name: 'resources' }],
          },
        },
      });
    }

    // Enroll Creator
    await tx.cohortMember.upsert({
      where: { cohortId_userId: { cohortId: COHORT_ID, userId: creatorUser.id } },
      update: { role: 'CREATOR' },
      create: {
        cohortId: COHORT_ID,
        userId: creatorUser.id,
        role: 'CREATOR',
      },
    });

    // Enroll Guest Explorer
    if (guestUser.id !== creatorUser.id) {
      await tx.cohortMember.upsert({
        where: { cohortId_userId: { cohortId: COHORT_ID, userId: guestUser.id } },
        update: { role: 'EXPLORER' },
        create: {
          cohortId: COHORT_ID,
          userId: guestUser.id,
          role: 'EXPLORER',
        },
      });
    }
  });

  // 5. Upsert MongoDB CohortTranscript, Chunk, and Guest UserCohortConfig
  await connectToMongoDB();

  const allSeededChunkIds: string[] = [];

  for (const item of builtLessons) {
    await CohortTranscript.findOneAndUpdate(
      { cohortId: COHORT_ID, lessonId: item.spec.id },
      {
        cohortId: COHORT_ID,
        lessonId: item.spec.id,
        fullTranscript: item.fullTranscript,
        chunks: item.chunks.map((c) => c.text),
        chunkVectors: item.chunks.map((c) => ({
          chunkIndex: c.chunkIndex,
          chunkId: c.chunkId,
          title: c.title,
          text: c.text,
          vector: c.vector,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          duration: c.durationSeconds,
          isKeyConcept: c.isKeyConcept,
          summary: c.summary,
        })),
        vectorEmbedding: item.fullVector,
        fullVector: item.fullVector,
        isStrictlyLinear: item.isStrictlyLinear,
        linearityDependencyScore: item.linearityDependencyScore,
        isVectorizable: true,
        isPublished: true,
      },
      { upsert: true, new: true },
    );

    const chunkOps = item.chunks.map((c) => {
      allSeededChunkIds.push(c.chunkId);
      return {
        updateOne: {
          filter: { chunkId: c.chunkId },
          update: {
            $set: {
              chunkId: c.chunkId,
              cohortId: COHORT_ID,
              lessonId: item.spec.id,
              chunkIndex: c.chunkIndex,
              title: c.title,
              text: c.text,
              vector: c.vector,
              macroVector: item.fullVector,
              startSeconds: c.startSeconds,
              endSeconds: c.endSeconds,
              duration: c.durationSeconds,
              isStrictlyLinear: item.isStrictlyLinear,
              isKeyConcept: c.isKeyConcept,
            },
          },
          upsert: true,
        },
      };
    });

    if (chunkOps.length > 0) {
      await Chunk.bulkWrite(chunkOps);
    }
  }

  // Cohort-level CohortTranscript for cohortVectorMap lookup in /api/feed
  const cohortFullTranscript = builtLessons.map((l) => l.fullTranscript).join('\n\n');
  const cohortMacroVector =
    builtLessons[0]?.fullVector ?? new Array(12).fill(0.5);
  await CohortTranscript.findOneAndUpdate(
    { cohortId: COHORT_ID, lessonId: 'default-lesson' },
    {
      cohortId: COHORT_ID,
      lessonId: 'default-lesson',
      fullTranscript: cohortFullTranscript,
      fullVector: cohortMacroVector,
      vectorEmbedding: cohortMacroVector,
      isStrictlyLinear: false,
      linearityDependencyScore: 0.45,
      isVectorizable: true,
      isPublished: true,
    },
    { upsert: true, new: true },
  );

  // Clean up any stale chunks for this cohort
  await Chunk.deleteMany({
    cohortId: COHORT_ID,
    chunkId: { $nin: allSeededChunkIds },
  });

  // Subscribe Guest Explorer in Mongo UserCohortConfig
  await UserCohortConfig.findOneAndUpdate(
    { userId: guestUser.id, cohortId: COHORT_ID },
    {
      $set: {
        userId: guestUser.id,
        cohortId: COHORT_ID,
        rank: 1,
        dailyGoalMinutes: 25,
        scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        scheduleLabel: 'Everyday',
        frequency: 'Often',
        orderStyle: 'Sequential',
        isPaused: false,
        isHidden: false,
        pausedUntil: null,
      },
      $unset: { pausedReason: 1 },
    },
    { upsert: true, new: true },
  );

  console.log(`✅ Cohort "${cohortTitle}" (${COHORT_ID}) seeded with ${builtLessons.length} lessons and ${allSeededChunkIds.length} chunks!`);
  console.log(`✅ Guest user ${guestUser.email} (${guestUser.id}) subscribed and active.`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

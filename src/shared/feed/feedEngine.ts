import type {
  FeedEngineInput,
  FeedEngineOutput,
  FeedItem,
  ChunkProgress,
  FeedChunkInput,
} from './feedEngine.types';
import { calculateChunkScore } from './feedScoring';
import * as curriculum from '@/src/shared/curriculum';
import type { ChannelId } from '@/src/shared/curriculum';

const CHANNEL_LABELS: Record<string, string> = {
  default: 'Smart Feed',
  spark: 'Spark',
  explore: 'Explore',
  build: 'Build',
  listen: 'Listen',
  deep_dive: 'Deep Dive',
  quick: 'Quick',
};

function scoreChannelMatchFallback(
  queryVec: number[],
  chunkVec: number[],
  activeChannel: ChannelId
): number {
  if (typeof curriculum.calculateChannelMatchScore === 'function') {
    return curriculum.calculateChannelMatchScore(queryVec, chunkVec, activeChannel);
  }
  if (typeof curriculum.rawCosineSimilarity === 'function') {
    return curriculum.rawCosineSimilarity(queryVec, chunkVec);
  }
  return 0;
}

function computeRagContextScore(
  chunk: FeedChunkInput,
  searchQuery?: string
): { score: number; matchedTerms: string[] } {
  if (!searchQuery || !searchQuery.trim()) return { score: 0, matchedTerms: [] };
  const terms = searchQuery
    .toLowerCase()
    .split(/[^a-z0-9_+-]+/)
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return { score: 0, matchedTerms: [] };

  const titleLower = `${chunk.lessonTitle || ''} ${chunk.chunkTitle || ''} ${chunk.seasonTitle || ''}`.toLowerCase();
  const bodyLower = (chunk.content?.text || '').toLowerCase();
  const matchedTerms: string[] = [];
  let hits = 0;

  for (const term of terms) {
    const inTitle = titleLower.includes(term);
    const inBody = bodyLower.includes(term);
    if (inTitle || inBody) {
      matchedTerms.push(term);
      hits += inTitle ? 2.0 : 1.0;
    }
  }

  if (matchedTerms.length === 0) return { score: -1.5, matchedTerms: [] };
  const coverage = matchedTerms.length / terms.length;
  return {
    score: Math.min(8.0, hits * 1.5 + coverage * 3.0),
    matchedTerms,
  };
}

function evaluateChannelModalityAndDuration(
  chunk: FeedChunkInput,
  microVec: number[],
  activeChannel: ChannelId,
  rawStringPrefs: Record<string, string> = {},
  channelSliderValues: Record<string, number> = {}
): { bonus: number; reasonTag: string } {
  const durSec = Math.max(30, (chunk.endSeconds || 0) - (chunk.startSeconds || 0) || parseDurationToSeconds(chunk.chunkDuration));
  const textLower = `${chunk.lessonTitle} ${chunk.chunkTitle} ${chunk.content?.text || ''}`.toLowerCase();

  // Vector indices:
  // 0: cognitive_load, 1: practicality, 2: visual_dependence, 3: scaffolding,
  // 4: linearity, 5: novelty, 6: abstraction, 7: pacing, 8: rigor,
  // 9: interactivity, 10: breadth, 11: emotional_energy
  const cogLoad = microVec[0] ?? 0.5;
  const practicality = microVec[1] ?? 0.5;
  const visualDep = microVec[2] ?? 0.5;
  const scaffolding = microVec[3] ?? 0.5;
  const linearity = microVec[4] ?? 0.5;
  const novelty = microVec[5] ?? 0.5;
  const abstraction = microVec[6] ?? 0.5;
  const pacing = microVec[7] ?? 0.5;
  const rigor = microVec[8] ?? 0.5;
  const interactivity = microVec[9] ?? 0.5;
  const breadth = microVec[10] ?? 0.5;
  const energy = microVec[11] ?? 0.5;

  let bonus = 0;
  let reasonTag = `${CHANNEL_LABELS[activeChannel] || 'Smart'} Match`;

  switch (activeChannel) {
    case 'quick': {
      const maxMinPref = Number(rawStringPrefs.max_duration || channelSliderValues.max_duration || 5);
      const targetMaxSec = maxMinPref <= 3 ? 195 : maxMinPref <= 5 ? 315 : 600;
      if (durSec <= targetMaxSec) {
        bonus += 3.2;
        reasonTag = `Quick Bite (${Math.max(1, Math.round(durSec / 60))}m) · High Pacing`;
      } else if (durSec <= 360) {
        bonus += 1.2;
      } else {
        bonus -= 2.8;
      }
      bonus += (pacing - 0.5) * 2.5 + (0.5 - cogLoad) * 2.0 + (0.5 - linearity) * 1.8;
      break;
    }
    case 'deep_dive': {
      if (durSec >= 240) {
        bonus += 2.6;
      } else if (durSec < 120) {
        bonus -= 1.8;
      }
      const depthScore = (cogLoad + abstraction + rigor) / 3;
      bonus += (depthScore - 0.45) * 5.0;
      if (rigor >= 0.65 || abstraction >= 0.65) {
        reasonTag = 'Deep Dive · High Rigor & Theory';
      } else {
        reasonTag = 'Deep Dive · Sequential Mastery';
      }
      break;
    }
    case 'build': {
      const hasBuildTerms = /cargo|fn |let |mut |struct |impl |trait |build|project|cli|code|implement|compile|terminal|hands-on|workshop/i.test(textLower);
      bonus += (practicality - 0.45) * 5.5 + (interactivity - 0.45) * 3.5 + (scaffolding - 0.45) * 2.0;
      if (hasBuildTerms) bonus += 2.2;
      if (abstraction > 0.75 && practicality < 0.45) bonus -= 2.5;
      reasonTag = practicality >= 0.65 || hasBuildTerms ? 'Build · Hands-On Code & Implementation' : 'Build · Guided Walkthrough';
      break;
    }
    case 'listen': {
      bonus += (0.6 - visualDep) * 5.5 + (breadth - 0.45) * 2.5;
      if (visualDep >= 0.75) bonus -= 2.5;
      reasonTag = visualDep <= 0.45 ? 'Listen · Audio-Friendly Concept' : 'Listen · Conceptual Overview';
      break;
    }
    case 'spark': {
      bonus += (energy - 0.45) * 4.5 + (novelty - 0.45) * 3.5 + (0.6 - cogLoad) * 2.5;
      if (durSec <= 300) bonus += 1.5;
      reasonTag = 'Spark · High-Energy Insight';
      break;
    }
    case 'explore': {
      bonus += (novelty - 0.45) * 5.0 + (breadth - 0.45) * 4.5 + (0.6 - linearity) * 2.5;
      reasonTag = 'Explore · Cross-Topic Discovery';
      break;
    }
    case 'default':
    default: {
      bonus += (scaffolding - 0.45) * 2.0 + (practicality - 0.45) * 1.5;
      reasonTag = 'Smart Feed · Balanced Progression';
      break;
    }
  }

  return { bonus, reasonTag };
}

export function generateFeed(input: FeedEngineInput): FeedEngineOutput {
  const {
    allChunks,
    chunkProgress,
    cohortStates,
    currentTime,
    dailyGoalMinutes,
    completedTodayMinutes,
    feedSize = 20,
    activeChannel = 'default',
    channelSliderValues = {},
    rawStringPrefs = {},
    searchQuery,
    targetQueryVector,
    cohortVectorMap = {},
    chunkVectorMap = {},
    requestedCohortId,
    requestedLessonId,
    requestedChunkId,
  } = input;

  const resolvedChannel = (activeChannel as ChannelId) || 'default';
  const cohortStateMap = new Map(cohortStates.map((s) => [s.cohortId, s]));

  // Compute or extract 12D target query vector Q
  const queryVec =
    targetQueryVector ||
    curriculum.vectorToArray(
      curriculum.computeTargetVector({
        currentTime,
        activeChannel: resolvedChannel,
        channelSliderValues,
        rawStringPrefs,
        userCompletedChunkIds: new Set(
          Object.values(chunkProgress)
            .filter((p) => p.status === 'completed')
            .map((p) => p.chunkId)
        ),
      })
    );

  // 1. Group all chunks by lesson
  const chunksByLesson = new Map<string, FeedChunkInput[]>();
  for (const chunk of allChunks) {
    const list = chunksByLesson.get(chunk.lessonId) || [];
    list.push(chunk);
    chunksByLesson.set(chunk.lessonId, list);
  }

  // 2. Channel-Aware Linearity Gating:
  // Non-linear channels (spark, explore, build, listen, quick) or explicit RAG searchQuery
  // unlock all uncompleted chunks so the best semantic/pedagogical match inside any lesson can surface.
  const enforceStrictFrontier =
    !searchQuery?.trim() &&
    (resolvedChannel === 'default' ||
      resolvedChannel === 'deep_dive' ||
      rawStringPrefs.context_need === 'linear' ||
      (channelSliderValues.context_need !== undefined && channelSliderValues.context_need > 0.65));

  const candidateChunks: FeedChunkInput[] = [];

  chunksByLesson.forEach((lessonChunks) => {
    lessonChunks.sort((a, b) => a.chunkOrder - b.chunkOrder);

    const firstChunk = lessonChunks[0];
    const cohortMeta = cohortVectorMap[firstChunk.cohortId];
    const lessonIsLinear =
      firstChunk.isStrictlyLinear !== undefined
        ? firstChunk.isStrictlyLinear
        : cohortMeta?.isStrictlyLinear ?? false;

    if (enforceStrictFrontier && lessonIsLinear) {
      const frontierChunk = lessonChunks.find((c) => {
        const prog = chunkProgress[c.chunkId];
        return !prog || prog.status !== 'completed';
      });
      if (frontierChunk) {
        candidateChunks.push(frontierChunk);
      }
    } else {
      for (const chunk of lessonChunks) {
        const prog = chunkProgress[chunk.chunkId];
        if (!prog || prog.status !== 'completed') {
          candidateChunks.push(chunk);
        }
      }
    }
  });

  const eligibleChunks = candidateChunks.length > 0 ? candidateChunks : allChunks;

  // 3. Score Eligible Chunks with Channel-Weighted 12D Vector + Modality Rules + RAG Context
  const previousCohortId: string | null = null;
  const scoredItems: FeedItem[] = [];

  for (let i = 0; i < eligibleChunks.length; i++) {
    const chunk = eligibleChunks[i];
    const progress: ChunkProgress = chunkProgress[chunk.chunkId] || {
      chunkId: chunk.chunkId,
      lessonId: chunk.lessonId,
      cohortId: chunk.cohortId,
      status: 'not-started',
      watchedSeconds: 0,
      totalSeconds: parseDurationToSeconds(chunk.chunkDuration),
    };

    const cohortState = cohortStateMap.get(chunk.cohortId);

    const heuristic = calculateChunkScore(
      chunk,
      progress,
      cohortState,
      previousCohortId,
      currentTime
    );

    const hasMacroVec = chunk.fullLessonVector || cohortVectorMap[chunk.cohortId]?.fullVector;
    const macroVec = hasMacroVec || new Array(12).fill(0);

    const hasMicroVec = chunk.chunkVector || chunkVectorMap[chunk.chunkId];
    const microVec = hasMicroVec || new Array(12).fill(0);

    const macroSim = hasMacroVec ? scoreChannelMatchFallback(queryVec, macroVec, resolvedChannel) : 0;
    const microSim = hasMicroVec ? scoreChannelMatchFallback(queryVec, microVec, resolvedChannel) : 0;

    // Weight micro-chunk vector at 75% and macro cohort vector at 25% so chunks within the same cohort differentiate sharply
    const hybridVectorScore = hasMicroVec && hasMacroVec
      ? 0.75 * microSim + 0.25 * macroSim
      : hasMicroVec
      ? microSim
      : macroSim;

    // Channel modality & duration evaluation
    const channelEval = hasMicroVec
      ? evaluateChannelModalityAndDuration(chunk, microVec, resolvedChannel, rawStringPrefs, channelSliderValues)
      : { bonus: 0, reasonTag: `${CHANNEL_LABELS[resolvedChannel] || 'Smart'} Match` };

    // RAG semantic/lexical query match
    const ragEval = computeRagContextScore(chunk, searchQuery);

    // Progression & positional bonuses
    let bonus = channelEval.bonus + ragEval.score;

    if (progress.status === 'in-progress') {
      const completionRatio = Math.min(1, progress.watchedSeconds / Math.max(1, progress.totalSeconds));
      bonus += 1.2 + 0.5 * completionRatio;
    } else if (chunk.isKeyConcept && (resolvedChannel === 'default' || resolvedChannel === 'deep_dive' || resolvedChannel === 'spark')) {
      bonus += 0.45;
    }

    // Slight sequential tie-breaker for default/deep_dive so Lesson 1 precedes Lesson 10 when scores are close
    if (resolvedChannel === 'default' || resolvedChannel === 'deep_dive') {
      const orderPenalty = Math.min(1.2, (chunk.seasonOrder * 10 + chunk.lessonOrder) * 0.02 + chunk.chunkOrder * 0.01);
      bonus -= orderPenalty;
    }

    // Direct Request / Query Param Overrides
    if (requestedChunkId && chunk.chunkId === requestedChunkId) {
      bonus += 1000;
    } else if (requestedLessonId && chunk.lessonId === requestedLessonId) {
      bonus += 500;
    } else if (requestedCohortId && chunk.cohortId === requestedCohortId) {
      bonus += 100;
    }

    const compositeScore = hybridVectorScore * 12 + heuristic.score + bonus;
    const matchPct = Math.max(55, Math.min(99, Math.round((hybridVectorScore * 0.75 + 0.22) * 100)));

    let matchReason = `${channelEval.reasonTag} · ${matchPct}% Fit`;
    if (ragEval.matchedTerms.length > 0) {
      matchReason = `RAG Match (${ragEval.matchedTerms.slice(0, 2).join(', ')}) · ${channelEval.reasonTag}`;
    } else if (progress.status === 'in-progress') {
      matchReason = `Resume In-Progress · ${channelEval.reasonTag}`;
    }

    scoredItems.push({
      chunkId: chunk.chunkId,
      chunkTitle: chunk.chunkTitle,
      chunkOrder: chunk.chunkOrder,
      chunkDuration: chunk.chunkDuration,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      lessonId: chunk.lessonId,
      cohortId: chunk.cohortId,
      lessonTitle: chunk.lessonTitle,
      cohortTitle: chunk.cohortTitle,
      lessonVideoId: chunk.lessonVideoId,
      lessonType: chunk.lessonType,
      content: chunk.content,
      lessonThumbnail: chunk.lessonThumbnail,
      totalChunksInLesson: chunk.totalChunksInLesson,
      matchScore: Math.round(compositeScore * 100) / 100,
      matchReason,
      lessonOrder: chunk.lessonOrder,
      seasonOrder: chunk.seasonOrder,
      totalLessonsInSeason: (chunk as any).totalLessonsInSeason,
    });
  }

  // 4. Sort by score descending
  scoredItems.sort((a, b) => b.matchScore - a.matchScore);

  // 5. Channel-Aware Interleaving:
  // - In `deep_dive` or when `requestedLessonId` is set, allow up to 2 consecutive chunks from the same lesson (in chunkOrder).
  // - In other channels (`spark`, `explore`, `quick`, `build`, `listen`), interleave across lessons for variety.
  const maxSameLesson = requestedLessonId ? 5 : resolvedChannel === 'deep_dive' ? 2 : 1;
  const interleaved: FeedItem[] = [];
  const pool = [...scoredItems];
  let lastLessonId: string | null = null;
  let sameLessonCount = 0;
  let lastCohortId: string | null = null;
  let sameCohortCount = 0;

  while (pool.length > 0) {
    let nextIndex = 0;

    const diffLessonIndex = pool.findIndex((item) => item.lessonId !== lastLessonId);
    const diffCohortIndex = pool.findIndex((item) => item.cohortId !== lastCohortId);

    if (lastLessonId !== null && sameLessonCount >= maxSameLesson && diffLessonIndex !== -1) {
      nextIndex = diffLessonIndex;
    } else if (!requestedCohortId && lastCohortId && sameCohortCount >= 2 && diffCohortIndex !== -1) {
      nextIndex = diffCohortIndex;
    }

    const [selected] = pool.splice(nextIndex, 1);

    if (selected.lessonId === lastLessonId) {
      sameLessonCount++;
    } else {
      lastLessonId = selected.lessonId;
      sameLessonCount = 1;
    }

    if (selected.cohortId === lastCohortId) {
      sameCohortCount++;
    } else {
      lastCohortId = selected.cohortId;
      sameCohortCount = 1;
    }

    interleaved.push(selected);

    if (interleaved.length >= feedSize) break;
  }

  // 6. Calculate summary metrics
  const uniqueCohorts = new Set(interleaved.map((item) => item.cohortId));
  const estimatedMinutes = interleaved.reduce((sum, item) => {
    return sum + parseDurationToSeconds(item.chunkDuration) / 60;
  }, 0);

  const goalPercent = Math.min(100, Math.round((completedTodayMinutes / dailyGoalMinutes) * 100));

  return {
    items: interleaved,
    totalAvailable: allChunks.length,
    dailyGoalProgress: {
      current: completedTodayMinutes,
      target: dailyGoalMinutes,
      percent: goalPercent,
    },
    stats: {
      cohortsCovered: uniqueCohorts.size,
      chunksRemaining: eligibleChunks.length,
      estimatedMinutes: Math.round(estimatedMinutes),
    },
  };
}

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 180;
  const minsMatch = duration.match(/(\d+)\s*m/i);
  const secsMatch = duration.match(/(\d+)\s*s/i);
  let total = 0;
  if (minsMatch) total += Number(minsMatch[1]) * 60;
  if (secsMatch) total += Number(secsMatch[1]);
  if (total === 0) {
    const num = Number(duration.match(/\d+/)?.[0]);
    if (!isNaN(num)) total = num * 60;
  }
  return total || 180;
}

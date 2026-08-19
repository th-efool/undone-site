import type {
  CurriculumChunk,
  CurriculumGenerationInput,
  CurriculumLesson,
  CurriculumSeason,
  CurriculumWarning,
  GeneratedCurriculum,
  ImportedLessonInput,
} from './curriculum.types';

const TARGET_SEASON_MINUTES = 600;
const MIN_SHORT_SEASON_MINUTES = 120;
const MAX_LONG_SEASON_MINUTES = 780;
const CHUNK_TARGET_MINUTES = 5;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
}

function seededRandom(seed: string) {
  let state = hashString(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function makeId(prefix: string, ...parts: Array<string | number>) {
  return `${prefix}-${parts.map((part) => String(part).replace(/[^a-z0-9]+/gi, '-')).join('-')}`;
}

function parseDurationToMinutes(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const hmsMatch = normalized.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hmsMatch) {
    const hours = hmsMatch[3] ? Number(hmsMatch[1]) : 0;
    const minutes = hmsMatch[3] ? Number(hmsMatch[2]) : Number(hmsMatch[1]);
    const seconds = hmsMatch[3] ? Number(hmsMatch[3]) : Number(hmsMatch[2]);
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
  }

  const isoMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(normalized.toUpperCase());
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0);
    const minutes = Number(isoMatch[2] ?? 0);
    const seconds = Number(isoMatch[3] ?? 0);
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
  }

  const compactMatch = normalized.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/);
  if (compactMatch && (compactMatch[1] || compactMatch[2] || compactMatch[3])) {
    const hours = Number(compactMatch[1] ?? 0);
    const minutes = Number(compactMatch[2] ?? 0);
    const seconds = Number(compactMatch[3] ?? 0);
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
  }

  return 0;
}

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return '0m';

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${mins}m`;
}

function buildChunkDurations(totalMinutes: number, lessonId: string) {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const random = seededRandom(lessonId);
  const baseCount = Math.max(1, Math.ceil(minutes / CHUNK_TARGET_MINUTES));
  const variance = minutes > CHUNK_TARGET_MINUTES ? (random() > 0.68 ? 1 : 0) : 0;
  const chunkCount = Math.max(1, baseCount + variance);

  if (chunkCount === 1) {
    return [minutes];
  }

  const weights = Array.from({ length: chunkCount }, () => 0.85 + random() * 0.35);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (minutes * weight) / totalWeight);
  const chunks = raw.map((value) => Math.max(1, Math.floor(value)));

  let remainder = minutes - chunks.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    chunks[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  while (remainder < 0 && order.length > 0) {
    const target = order[cursor % order.length].index;
    if (chunks[target] > 1) {
      chunks[target] -= 1;
      remainder += 1;
    }
    cursor += 1;
    if (cursor > order.length * 3) break;
  }

  return chunks;
}

function buildChunks(lesson: CurriculumLesson) {
  const totalMinutes = parseDurationToMinutes(lesson.duration);
  const chunkDurations = buildChunkDurations(totalMinutes, lesson.id);

  return chunkDurations.map((duration, index) => ({
    id: makeId('chunk', lesson.id, index + 1),
    title: `Part ${index + 1}`,
    duration: formatDuration(duration),
    order: index + 1,
  })) satisfies CurriculumChunk[];
}

function convertImportedLesson(
  lesson: ImportedLessonInput,
  sourceId: string,
  sourceTitle: string,
  sourceIndex: number,
) {
  const minutes = parseDurationToMinutes(lesson.duration);
  const seed = `${lesson.id}-${sourceId}`;
  const generatedLesson: CurriculumLesson = {
    id: makeId('lesson', lesson.id),
    title: lesson.title,
    description: lesson.description,
    thumbnail:
      lesson.thumbnail ||
      (lesson.videoId ? `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg` : '/mock/thumbnails/docker.avif'),
    videoId: lesson.videoId,
    duration: lesson.duration,
    chunkCount: 0,
    chunks: [],
    provider: lesson.provider,
    order: lesson.position,
    playlistPosition: lesson.position,
    sourceId,
    sourceTitle,
    publishedLabel: lesson.publishedLabel,
    difficulty: 'Intermediate',
    tags: sourceIndex === 0 ? [] : [sourceTitle],
    xp: Math.max(50, minutes * 12),
    resources: [],
    assignments: [],
    collapsed: true,
  };

  generatedLesson.chunks = buildChunks(generatedLesson);
  generatedLesson.chunkCount = generatedLesson.chunks.length;

  return generatedLesson;
}

function createSeasonFromLessons(index: number, lessons: CurriculumLesson[], existingSeason?: CurriculumSeason): CurriculumSeason {
  const first = lessons[0];
  const last = lessons[lessons.length - 1];
  const minutes = lessons.reduce((sum, lesson) => sum + parseDurationToMinutes(lesson.duration), 0);

  return {
    id: existingSeason?.id || makeId('season', index + 1),
    title: existingSeason?.title || `Season ${index + 1}`,
    description: existingSeason?.description || (
      lessons.length > 0
        ? `Lessons ${first.playlistPosition} - ${last.playlistPosition}`
        : 'Empty season placeholder.'
    ),
    thumbnail: existingSeason?.thumbnail || first?.thumbnail || '/mock/thumbnails/docker.avif',
    estimatedDuration: formatDuration(minutes),
    lessonCount: lessons.length,
    lessons,
    collapsed: existingSeason?.collapsed ?? false,
  };
}

function flattenLessons(seasons: CurriculumSeason[]) {
  return seasons.flatMap((season) => season.lessons);
}

function recomputeLessonMetadata(lesson: CurriculumLesson, order: number) {
  const minutes = parseDurationToMinutes(lesson.duration);
  const chunks = lesson.chunks.length ? lesson.chunks : buildChunks(lesson);

  return {
    ...lesson,
    order,
    chunkCount: chunks.length,
    chunks: chunks.map((chunk, index) => ({
      ...chunk,
      order: index + 1,
      title: `Part ${index + 1}`,
    })),
    xp: lesson.xp > 0 ? lesson.xp : Math.max(50, minutes * 12),
  };
}

function recalculateSeason(season: CurriculumSeason, index: number) {
  const lessons = season.lessons.map((lesson, lessonIndex) => recomputeLessonMetadata(lesson, lessonIndex + 1));
  const minutes = lessons.reduce((sum, lesson) => sum + parseDurationToMinutes(lesson.duration), 0);

  return {
    ...season,
    id: season.id || makeId('season', index + 1),
    title: season.title || `Season ${index + 1}`,
    description: season.description || 'Generated season.',
    thumbnail: lessons[0]?.thumbnail ?? season.thumbnail ?? '/mock/thumbnails/docker.avif',
    estimatedDuration: formatDuration(minutes),
    lessonCount: lessons.length,
    lessons,
  };
}

function buildWarnings(curriculum: GeneratedCurriculum) {
  const warnings: CurriculumWarning[] = [];
  const lessonNames = new Map<string, CurriculumLesson[]>();

  curriculum.seasons.forEach((season) => {
    if (season.lessonCount === 0) {
      warnings.push({
        id: makeId('warning', 'season-empty', season.id),
        scope: 'season',
        severity: 'warning',
        title: 'Empty season',
        message: `${season.title} does not contain any lessons.`,
        seasonId: season.id,
      });
    }

    const seasonMinutes = parseDurationToMinutes(season.estimatedDuration);
    if (seasonMinutes > MAX_LONG_SEASON_MINUTES) {
      warnings.push({
        id: makeId('warning', 'season-long', season.id),
        scope: 'season',
        severity: 'warning',
        title: 'Long season',
        message: `${season.title} runs longer than the preferred range.`,
        seasonId: season.id,
      });
    }

    if (seasonMinutes > 0 && seasonMinutes < MIN_SHORT_SEASON_MINUTES) {
      warnings.push({
        id: makeId('warning', 'season-short', season.id),
        scope: 'season',
        severity: 'info',
        title: 'Short season',
        message: `${season.title} is shorter than the preferred range.`,
        seasonId: season.id,
      });
    }

    season.lessons.forEach((lesson) => {
      if (!lesson.thumbnail) {
        warnings.push({
          id: makeId('warning', 'lesson-thumbnail', lesson.id),
          scope: 'lesson',
          severity: 'warning',
          title: 'Missing thumbnail',
          message: `${lesson.title} does not have a thumbnail yet.`,
          seasonId: season.id,
          lessonId: lesson.id,
        });
      }

      if (parseDurationToMinutes(lesson.duration) <= 0) {
        warnings.push({
          id: makeId('warning', 'lesson-duration', lesson.id),
          scope: 'lesson',
          severity: 'danger',
          title: 'Zero duration',
          message: `${lesson.title} does not have a valid duration.`,
          seasonId: season.id,
          lessonId: lesson.id,
        });
      }

      const normalizedName = lesson.title.trim().toLowerCase();
      if (!lessonNames.has(normalizedName)) {
        lessonNames.set(normalizedName, [lesson]);
      } else {
        lessonNames.get(normalizedName)?.push(lesson);
      }
    });
  });

  lessonNames.forEach((lessons, key) => {
    if (lessons.length > 1) {
      warnings.push({
        id: makeId('warning', 'lesson-duplicate', key),
        scope: 'curriculum',
        severity: 'warning',
        title: 'Duplicate lesson names',
        message: `${lessons.length} lessons share the name "${lessons[0].title}".`,
      });
    }
  });

  if (curriculum.totalLessons === 0) {
    warnings.push({
      id: makeId('warning', 'curriculum-empty', curriculum.id),
      scope: 'curriculum',
      severity: 'danger',
      title: 'No lessons available',
      message: 'The curriculum needs at least one imported lesson.',
    });
  }

  return warnings;
}

function finalizeCurriculum(curriculum: GeneratedCurriculum) {
  const seasons = curriculum.seasons.map((season, index) => recalculateSeason(season, index));
  const totalLessons = seasons.reduce((sum, season) => sum + season.lessonCount, 0);
  const totalChunks = seasons.reduce(
    (sum, season) => sum + season.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.chunkCount, 0),
    0,
  );
  const totalMinutes = seasons.reduce(
    (sum, season) => sum + parseDurationToMinutes(season.estimatedDuration),
    0,
  );

  const finalized: GeneratedCurriculum = {
    ...curriculum,
    seasons,
    totalSeasons: seasons.length,
    totalLessons,
    totalChunks,
    totalHours: formatDuration(totalMinutes),
    warnings: [],
  };

  finalized.warnings = buildWarnings(finalized);
  return finalized;
}

function buildSeasonsFromLessons(
  lessons: CurriculumLesson[],
  targetSeasonCount?: number,
  existingSeasons: CurriculumSeason[] = []
) {
  if (!lessons.length) {
    return [createSeasonFromLessons(0, [], existingSeasons[0])];
  }

  const totalMinutes = lessons.reduce((sum, lesson) => sum + parseDurationToMinutes(lesson.duration), 0);
  const autoSeasonCount = Math.max(1, Math.ceil(totalMinutes / TARGET_SEASON_MINUTES));
  const seasonCount = targetSeasonCount && targetSeasonCount > 0 ? targetSeasonCount : autoSeasonCount;
  const targetSeasonMinutes = totalMinutes / seasonCount;
  const seasons: CurriculumSeason[] = [];
  let currentLessons: CurriculumLesson[] = [];
  let currentMinutes = 0;
  let thresholdIndex = 1;

  const thresholds = Array.from({ length: Math.max(0, seasonCount - 1) }, (_, index) =>
    targetSeasonMinutes * (index + 1),
  );

  lessons.forEach((lesson, lessonIndex) => {
    const lessonMinutes = parseDurationToMinutes(lesson.duration);
    const nextThreshold = thresholds[thresholdIndex - 1];

    if (
      currentLessons.length > 0 &&
      nextThreshold !== undefined &&
      currentMinutes + lessonMinutes > nextThreshold &&
      seasons.length < seasonCount - 1
    ) {
      seasons.push(createSeasonFromLessons(seasons.length, currentLessons, existingSeasons[seasons.length]));
      currentLessons = [];
      currentMinutes = 0;
      thresholdIndex += 1;
    }

    currentLessons.push({
      ...lesson,
      order: currentLessons.length + 1,
    });
    currentMinutes += lessonMinutes;

    const isLastLesson = lessonIndex === lessons.length - 1;
    if (isLastLesson) {
      seasons.push(createSeasonFromLessons(seasons.length, currentLessons, existingSeasons[seasons.length]));
    }
  });

  return seasons;
}

export function generateCurriculum(input: CurriculumGenerationInput) {
  const importedSources = input.importedSources.filter((source) => source.lessons.length > 0);
  const lessons = importedSources.flatMap((source, sourceIndex) =>
    source.lessons.map((lesson) => convertImportedLesson(lesson, source.id, source.title, sourceIndex)),
  );

  const seasons = buildSeasonsFromLessons(lessons);

  return finalizeCurriculum({
    id: makeId('curriculum', input.title || 'generated'),
    title: input.title || 'Curriculum',
    description: input.description || 'Auto-generated curriculum from imported sources.',
    totalHours: '0m',
    totalLessons: 0,
    totalChunks: 0,
    totalSeasons: 0,
    seasons,
    warnings: [],
  });
}

export function regenerateChunks(curriculum: GeneratedCurriculum) {
  const seasons = curriculum.seasons.map((season) => ({
    ...season,
    lessons: season.lessons.map((lesson, lessonIndex) => {
      const chunks = buildChunks(lesson);
      return {
        ...lesson,
        order: lessonIndex + 1,
        chunks,
        chunkCount: chunks.length,
      };
    }),
  }));

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function rebalanceSeasons(curriculum: GeneratedCurriculum) {
  const lessons = flattenLessons(curriculum.seasons).map((lesson) => ({
    ...lesson,
    collapsed: lesson.collapsed,
  }));
  
  // Re-build seasons using existing metadata
  const seasons = buildSeasonsFromLessons(lessons, curriculum.seasons.length, curriculum.seasons);

  // Pad missing empty seasons if curriculum originally had them trailing
  if (seasons.length < curriculum.seasons.length) {
    for (let i = seasons.length; i < curriculum.seasons.length; i++) {
      seasons.push(createSeasonFromLessons(i, [], curriculum.seasons[i]));
    }
  }

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function restorePlaylistOrder(curriculum: GeneratedCurriculum) {
  const lessons = flattenLessons(curriculum.seasons)
    .slice()
    .sort((a, b) => a.playlistPosition - b.playlistPosition || a.sourceTitle.localeCompare(b.sourceTitle))
    .map((lesson) => ({
      ...lesson,
      collapsed: lesson.collapsed,
    }));

  const seasons = buildSeasonsFromLessons(lessons, curriculum.seasons.length, curriculum.seasons);

  if (seasons.length < curriculum.seasons.length) {
    for (let i = seasons.length; i < curriculum.seasons.length; i++) {
      seasons.push(createSeasonFromLessons(i, [], curriculum.seasons[i]));
    }
  }

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function createSeason(curriculum: GeneratedCurriculum, title?: string) {
  const seasons = [
    ...curriculum.seasons,
    {
      id: makeId('season', curriculum.seasons.length + 1, Date.now()),
      title: title || `Season ${curriculum.seasons.length + 1}`,
      description: 'New season placeholder.',
      thumbnail: '/mock/thumbnails/docker.avif',
      estimatedDuration: '0m',
      lessonCount: 0,
      lessons: [],
      collapsed: true,
    },
  ];

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function updateCurriculumMeta(
  curriculum: GeneratedCurriculum,
  patch: Partial<Pick<GeneratedCurriculum, 'title' | 'description'>>,
) {
  return finalizeCurriculum({
    ...curriculum,
    ...patch,
  });
}

export function updateSeason(
  curriculum: GeneratedCurriculum,
  seasonId: string,
  patch: Partial<Pick<CurriculumSeason, 'title' | 'description' | 'thumbnail' | 'collapsed'>>,
) {
  return finalizeCurriculum({
    ...curriculum,
    seasons: curriculum.seasons.map((season) => (season.id === seasonId ? { ...season, ...patch } : season)),
  });
}

export function updateLesson(
  curriculum: GeneratedCurriculum,
  lessonId: string,
  patch: Partial<
    Pick<
      CurriculumLesson,
      | 'title'
      | 'description'
      | 'thumbnail'
      | 'duration'
      | 'difficulty'
      | 'tags'
      | 'xp'
      | 'resources'
      | 'assignments'
      | 'collapsed'
    >
  >,
) {
  const seasons = curriculum.seasons.map((season) => ({
    ...season,
    lessons: season.lessons.map((lesson) => {
      if (lesson.id !== lessonId) {
        return lesson;
      }

      const nextLesson = { ...lesson, ...patch };
      if (patch.duration) {
        const chunks = buildChunks(nextLesson);
        nextLesson.chunks = chunks;
        nextLesson.chunkCount = chunks.length;
      }

      return nextLesson;
    }),
  }));

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function deleteSeason(curriculum: GeneratedCurriculum, seasonId: string) {
  const index = curriculum.seasons.findIndex((season) => season.id === seasonId);
  if (index < 0) return curriculum;

  const seasons = [...curriculum.seasons];
  const [removed] = seasons.splice(index, 1);

  if (removed.lessons.length) {
    const neighbor = seasons[index] ?? seasons[index - 1];
    if (neighbor) {
      neighbor.lessons = [...neighbor.lessons, ...removed.lessons];
    } else {
      seasons.push(createSeasonFromLessons(0, removed.lessons));
    }
  }

  if (!seasons.length) {
    seasons.push(createSeasonFromLessons(0, []));
  }

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function duplicateSeason(curriculum: GeneratedCurriculum, seasonId: string) {
  const index = curriculum.seasons.findIndex((season) => season.id === seasonId);
  if (index < 0) return curriculum;

  const season = curriculum.seasons[index];
  const copy: CurriculumSeason = {
    ...season,
    id: makeId('season', season.id, 'copy', Date.now()),
    title: `${season.title} copy`,
    lessons: season.lessons.map((lesson, lessonIndex) => {
      const lessonCopy: CurriculumLesson = {
        ...lesson,
        id: makeId('lesson', lesson.id, 'copy', Date.now(), lessonIndex + 1),
        title: `${lesson.title} copy`,
        chunks: lesson.chunks.map((chunk) => ({
          ...chunk,
          id: makeId('chunk', chunk.id, 'copy', Date.now()),
        })),
      };
      return lessonCopy;
    }),
  };

  const seasons = [...curriculum.seasons];
  seasons.splice(index + 1, 0, copy);
  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function splitSeason(curriculum: GeneratedCurriculum, seasonId: string) {
  const index = curriculum.seasons.findIndex((season) => season.id === seasonId);
  if (index < 0) return curriculum;

  const season = curriculum.seasons[index];
  if (season.lessons.length <= 1) return curriculum;

  const splitIndex = Math.max(1, Math.floor(season.lessons.length / 2));
  const firstLessons = season.lessons.slice(0, splitIndex);
  const secondLessons = season.lessons.slice(splitIndex);
  const seasons = [...curriculum.seasons];

  seasons[index] = {
    ...season,
    lessons: firstLessons,
  };
  seasons.splice(index + 1, 0, createSeasonFromLessons(index + 1, secondLessons));

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function mergeSeasons(curriculum: GeneratedCurriculum, seasonId: string, targetSeasonId: string) {
  const fromIndex = curriculum.seasons.findIndex((season) => season.id === seasonId);
  const toIndex = curriculum.seasons.findIndex((season) => season.id === targetSeasonId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return curriculum;

  const seasons = [...curriculum.seasons];
  const fromSeason = seasons[fromIndex];
  const toSeason = seasons[toIndex];
  const mergedLessons =
    fromIndex < toIndex
      ? [...fromSeason.lessons, ...toSeason.lessons]
      : [...toSeason.lessons, ...fromSeason.lessons];
  const insertIndex = Math.min(fromIndex, toIndex);
  const mergedSeason: CurriculumSeason = {
    ...toSeason,
    lessons: mergedLessons,
  };

  const nextSeasons = seasons.filter((_, index) => index !== fromIndex && index !== toIndex);
  nextSeasons.splice(insertIndex, 0, mergedSeason);

  return finalizeCurriculum({
    ...curriculum,
    seasons: nextSeasons,
  });
}

export function moveSeason(curriculum: GeneratedCurriculum, seasonId: string, targetId: string) {
  const seasons = [...curriculum.seasons];
  const fromIndex = seasons.findIndex((season) => season.id === seasonId);
  const toIndex = seasons.findIndex((season) => season.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return curriculum;

  const [season] = seasons.splice(fromIndex, 1);
  seasons.splice(toIndex, 0, season);

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function moveLesson(
  curriculum: GeneratedCurriculum,
  lessonId: string,
  targetSeasonId: string,
  targetLessonId?: string,
) {
  const seasons = curriculum.seasons.map((season) => ({
    ...season,
    lessons: [...season.lessons],
  }));

  let draggedLesson: CurriculumLesson | null = null;
  for (const season of seasons) {
    const lessonIndex = season.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (lessonIndex >= 0) {
      const [lesson] = season.lessons.splice(lessonIndex, 1);
      draggedLesson = lesson;
      break;
    }
  }

  if (!draggedLesson) return curriculum;

  const targetSeason = seasons.find((season) => season.id === targetSeasonId);
  if (!targetSeason) return curriculum;

  const insertIndex = targetLessonId
    ? targetSeason.lessons.findIndex((lesson) => lesson.id === targetLessonId)
    : targetSeason.lessons.length;

  const lessonToInsert: CurriculumLesson = draggedLesson;

  if (insertIndex < 0) {
    targetSeason.lessons.push(lessonToInsert);
  } else {
    targetSeason.lessons.splice(insertIndex, 0, lessonToInsert);
  }

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function duplicateLesson(curriculum: GeneratedCurriculum, lessonId: string) {
  const seasons = curriculum.seasons.map((season) => ({
    ...season,
    lessons: season.lessons.map((lesson) => ({ ...lesson })),
  }));

  for (const season of seasons) {
    const index = season.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) continue;

    const lesson = season.lessons[index];
    const copy: CurriculumLesson = {
      ...lesson,
      id: makeId('lesson', lesson.id, 'copy', Date.now()),
      title: `${lesson.title} copy`,
      chunks: lesson.chunks.map((chunk, chunkIndex) => ({
        ...chunk,
        id: makeId('chunk', chunk.id, 'copy', chunkIndex + 1),
      })),
    };

    season.lessons.splice(index + 1, 0, copy);
    break;
  }

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function deleteLesson(curriculum: GeneratedCurriculum, lessonId: string) {
  const seasons = curriculum.seasons.map((season) => ({
    ...season,
    lessons: season.lessons.filter((lesson) => lesson.id !== lessonId),
  }));

  return finalizeCurriculum({
    ...curriculum,
    seasons,
  });
}

export function regenerateChunksForCurriculum(curriculum: GeneratedCurriculum) {
  return regenerateChunks(curriculum);
}

export function autoBalanceCurriculum(curriculum: GeneratedCurriculum) {
  return rebalanceSeasons(curriculum);
}

export function rebuildFromPlaylistOrder(curriculum: GeneratedCurriculum) {
  return restorePlaylistOrder(curriculum);
}

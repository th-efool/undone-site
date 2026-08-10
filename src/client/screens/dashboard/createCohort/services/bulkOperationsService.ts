import type { GeneratedCurriculum, CurriculumSeason, CurriculumLesson } from '@/src/shared/curriculum';

class BulkOperationsService {
  autoRenameSeasons(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const seasonThemes = [
      'Foundations & Principles',
      'Core Mechanics & Practice',
      'Advanced Protocols & Systems',
      'Mastery & Real-world Projects',
      'Capstane & Synthesis',
    ];

    const seasons = curriculum.seasons.map((season, index) => {
      const theme = seasonThemes[index] || `Module ${index + 1}`;
      return {
        ...season,
        title: `Season ${index + 1}: ${theme}`,
      };
    });

    return { ...curriculum, seasons };
  }

  autoRenameLessons(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => {
        let cleanedTitle = lesson.title.replace(/^\d+[\.\:\-]\s*/, '').trim();
        if (!cleanedTitle) cleanedTitle = lesson.title;
        return {
          ...lesson,
          title: cleanedTitle,
        };
      }),
    }));

    return { ...curriculum, seasons };
  }

  regenerateChunkTitles(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const chunkTitles = ['Introduction & Context', 'Core Concept', 'Practical Demo', 'Key Takeaway', 'Action Item'];

    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => ({
        ...lesson,
        chunks: lesson.chunks.map((chunk, index) => ({
          ...chunk,
          title: chunkTitles[index % chunkTitles.length] || `Part ${index + 1}`,
        })),
      })),
    }));

    return { ...curriculum, seasons };
  }

  normalizeDurations(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => {
        if (!lesson.duration || lesson.duration === '0m' || lesson.duration === '0') {
          return {
            ...lesson,
            duration: '15m',
          };
        }
        return lesson;
      }),
    }));

    return { ...curriculum, seasons };
  }

  mergeEmptySeasons(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const activeSeasons = curriculum.seasons.filter((season) => season.lessons.length > 0);
    const seasons = activeSeasons.length > 0 ? activeSeasons : curriculum.seasons;
    return {
      ...curriculum,
      seasons,
      totalSeasons: seasons.length,
    };
  }

  deleteEmptyLessons(curriculum: GeneratedCurriculum): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.filter((l) => l.title.trim() && l.duration !== '0m'),
    }));
    return { ...curriculum, seasons };
  }

  bulkTag(curriculum: GeneratedCurriculum, lessonIds: string[], tag: string): GeneratedCurriculum {
    const normalized = tag.trim();
    if (!normalized) return curriculum;

    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => {
        if (!lessonIds.includes(lesson.id)) return lesson;
        if (lesson.tags.includes(normalized)) return lesson;
        return { ...lesson, tags: [...lesson.tags, normalized] };
      }),
    }));

    return { ...curriculum, seasons };
  }

  bulkDifficulty(curriculum: GeneratedCurriculum, lessonIds: string[], difficulty: string): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => (lessonIds.includes(lesson.id) ? { ...lesson, difficulty } : lesson)),
    }));
    return { ...curriculum, seasons };
  }

  bulkXP(curriculum: GeneratedCurriculum, lessonIds: string[], xp: number): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => (lessonIds.includes(lesson.id) ? { ...lesson, xp } : lesson)),
    }));
    return { ...curriculum, seasons };
  }

  bulkVisibility(curriculum: GeneratedCurriculum, lessonIds: string[], visibility: string): GeneratedCurriculum {
    const seasons = curriculum.seasons.map((season) => ({
      ...season,
      lessons: season.lessons.map((lesson) => (lessonIds.includes(lesson.id) ? { ...lesson, visibility } : lesson)),
    }));
    return { ...curriculum, seasons };
  }

  bulkDelete(curriculum: GeneratedCurriculum, lessonIds: string[], seasonIds: string[]): GeneratedCurriculum {
    let seasons = curriculum.seasons.filter((season) => !seasonIds.includes(season.id));
    seasons = seasons.map((season) => ({
      ...season,
      lessons: season.lessons.filter((lesson) => !lessonIds.includes(lesson.id)),
    }));
    return { ...curriculum, seasons };
  }
}

export const bulkOperationsService = new BulkOperationsService();

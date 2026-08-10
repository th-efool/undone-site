import { useMemo } from 'react';
import type { GeneratedCurriculum } from '@/src/shared/curriculum';
import type {
  ChecklistItem,
  PublishingChecklistModel,
  QualityDeduction,
  QualityGrade,
  QualityScoreModel,
} from '../models/intelligence';
import type { CreateCohortDraft } from '../models/createCohort';

export function useCurriculumQuality(
  curriculum: GeneratedCurriculum | null,
  draft: CreateCohortDraft,
) {
  const quality = useMemo<QualityScoreModel>(() => {
    if (!curriculum) {
      return {
        score: 0,
        grade: 'Incomplete',
        color: '#f87171',
        deductions: [],
      };
    }

    const deductions: QualityDeduction[] = [];
    let score = 100;

    // Check lessons
    let missingThumbnails = 0;
    let emptyDescriptions = 0;
    let missingObjectives = 0;
    let missingPrerequisites = 0;
    let zeroDurations = 0;

    curriculum.seasons.forEach((season) => {
      if (season.lessons.length === 0) {
        deductions.push({
          id: `deduction-empty-season-${season.id}`,
          category: 'season',
          title: 'Empty Season',
          message: `${season.title} has 0 lessons.`,
          penalty: 10,
          seasonId: season.id,
        });
        score -= 10;
      }

      if (season.title.toLowerCase().startsWith('season') && !season.title.includes(':') && season.title.length < 10) {
        deductions.push({
          id: `deduction-unnamed-season-${season.id}`,
          category: 'title',
          title: 'Default Season Name',
          message: `${season.title} has a generic default name.`,
          penalty: 5,
          seasonId: season.id,
        });
        score -= 5;
      }

      season.lessons.forEach((lesson) => {
        if (!lesson.thumbnail) missingThumbnails += 1;
        if (!lesson.description || lesson.description.length < 20) emptyDescriptions += 1;
        if (!lesson.learningObjectives || lesson.learningObjectives.length === 0) missingObjectives += 1;
        if (!lesson.prerequisites || lesson.prerequisites.length === 0) missingPrerequisites += 1;
        if (!lesson.duration || lesson.duration === '0m') zeroDurations += 1;
      });
    });

    if (missingThumbnails > 0) {
      const penalty = Math.min(15, missingThumbnails * 3);
      deductions.push({
        id: 'deduction-missing-thumbnails',
        category: 'thumbnail',
        title: 'Missing Lesson Thumbnails',
        message: `${missingThumbnails} lesson(s) are missing thumbnail artwork.`,
        penalty,
      });
      score -= penalty;
    }

    if (emptyDescriptions > 0) {
      const penalty = Math.min(15, emptyDescriptions * 3);
      deductions.push({
        id: 'deduction-empty-descriptions',
        category: 'description',
        title: 'Short or Missing Descriptions',
        message: `${emptyDescriptions} lesson(s) need detailed descriptions.`,
        penalty,
      });
      score -= penalty;
    }

    if (zeroDurations > 0) {
      const penalty = zeroDurations * 10;
      deductions.push({
        id: 'deduction-zero-durations',
        category: 'duration',
        title: 'Zero Duration Lessons',
        message: `${zeroDurations} lesson(s) have invalid duration.`,
        penalty,
      });
      score -= penalty;
    }

    if (!draft.coverImage || draft.coverImage.includes('placeholder')) {
      deductions.push({
        id: 'deduction-cover-image',
        category: 'curriculum',
        title: 'Default Cover Image',
        message: 'Cohort cover image should be customized.',
        penalty: 5,
      });
      score -= 5;
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    let grade: QualityGrade = 'Excellent';
    let color = '#34d399'; // Emerald / green

    if (finalScore < 50) {
      grade = 'Incomplete';
      color = '#f87171'; // Red
    } else if (finalScore < 75) {
      grade = 'Needs Attention';
      color = '#fbbf24'; // Amber
    } else if (finalScore < 90) {
      grade = 'Good';
      color = '#60a5fa'; // Blue
    }

    return {
      score: finalScore,
      grade,
      color,
      deductions,
    };
  }, [curriculum, draft.coverImage]);

  const checklist = useMemo<PublishingChecklistModel>(() => {
    if (!curriculum) {
      return {
        isReady: false,
        passedCount: 0,
        totalCount: 10,
        statusLabel: 'Needs Attention',
        items: [],
      };
    }

    const totalLessons = curriculum.totalLessons;
    const allThumbnails = curriculum.seasons.every((s) => s.lessons.every((l) => Boolean(l.thumbnail)));
    const noEmptySeasons = curriculum.seasons.every((s) => s.lessons.length > 0);
    const noZeroDurations = curriculum.seasons.every((s) => s.lessons.every((l) => l.duration && l.duration !== '0m'));
    const hasTags = draft.tags.length > 0;
    const hasCategories = draft.categories.length > 0;
    const hasOutcomes = draft.learningOutcomes.length > 0;

    const items: ChecklistItem[] = [
      { id: 'check-cover', label: 'Cohort cover image uploaded', passed: Boolean(draft.coverImage), required: true },
      { id: 'check-description', label: 'Cohort description & promise set', passed: Boolean(draft.description.trim()), required: true },
      { id: 'check-categories', label: 'Primary categories selected', passed: hasCategories, required: true },
      { id: 'check-outcomes', label: 'Learning outcomes defined', passed: hasOutcomes, required: true },
      { id: 'check-generated', label: 'Curriculum generated & chunked', passed: totalLessons > 0, required: true },
      { id: 'check-thumbnails', label: 'Every lesson has thumbnail artwork', passed: allThumbnails, required: false },
      { id: 'check-empty-seasons', label: 'No empty seasons', passed: noEmptySeasons, required: true },
      { id: 'check-durations', label: 'Valid lesson durations', passed: noZeroDurations, required: true },
      { id: 'check-tags', label: 'Discovery tags added', passed: hasTags, required: false },
      { id: 'check-warnings', label: 'No critical validation errors', passed: curriculum.warnings.filter((w) => w.severity === 'danger').length === 0, required: true },
    ];

    const passedCount = items.filter((i) => i.passed).length;
    const isReady = items.filter((i) => i.required).every((i) => i.passed);

    return {
      isReady,
      passedCount,
      totalCount: items.length,
      statusLabel: isReady ? 'Ready to Publish' : 'Needs Attention',
      items,
    };
  }, [curriculum, draft.categories.length, draft.coverImage, draft.description, draft.learningOutcomes.length, draft.tags.length]);

  return { quality, checklist };
}
